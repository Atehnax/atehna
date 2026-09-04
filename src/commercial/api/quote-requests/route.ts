import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import type { PoolClient } from 'pg';
import { isCustomerType, type CustomerType } from '@/shared/domain/order/customerType';
import {
  DEFAULT_QUOTE_DELIVERY_TERMS,
  DEFAULT_QUOTE_PAYMENT_TERMS,
  isQuoteReason,
  type QuoteReason
} from '@/shared/domain/quote/quoteTypes';
import { getPool } from '@/shared/server/db';
import { getGursAddressById } from '@/shared/server/gursAddresses';
import {
  buildAuthoritativeOrderQuote,
  normalizeOrderQuoteCustomerLabels,
  OrderCommerceError,
  parseOrderSelections,
  type AuthoritativeOrderQuote,
  type OrderSelection
} from '@/shared/server/orderCommerce';
import {
  exchangeQuoteAccessToken,
  issueQuoteAccessToken,
  setQuoteAccessSessionCookie
} from '@/shared/server/quoteAccess';
import {
  decryptQuoteAccessBootstrap,
  encryptQuoteAccessBootstrap,
  type EncryptedQuoteAccessBootstrap
} from '@/shared/server/quoteAccessBootstrapCipher';
import { arePublicQuoteRequestsEnabled } from '@/shared/server/quoteFeatureFlags';
import {
  consumeQuoteRateLimit,
  requestNetworkSubject
} from '@/shared/server/quoteRateLimit';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';
import { requestOriginMatchesHost } from '@/shared/server/requestSecurity';
import {
  enqueueQuoteEmailEvent,
  scheduleQuoteEmailJobs
} from '@/shared/server/quoteEmailJobs';

export const runtime = 'nodejs';

type QuoteRequestCustomer = {
  customerType: CustomerType;
  customerName: string;
  organizationName: string | null;
  contactName: string;
  email: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  postalCode: string;
  countryCode: 'SI';
  gursHouseNumberId: string | null;
  reference: string | null;
};

type StoredQuoteRequestResponse = {
  quoteRequestId: number;
  requestNumber: string;
  status: 'received';
  createdAt: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const POSTAL_CODE_PATTERN = /^\d{4}$/u;
const MAX_IDEMPOTENCY_KEY_LENGTH = 200;
const MIN_IDEMPOTENCY_KEY_LENGTH = 8;
const privateHeaders = {
  'Cache-Control': 'no-store, private',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow, noarchive'
};

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
}

function limited(value: string, length: number, label: string): string {
  if (value.length > length) {
    throw new OrderCommerceError(400, 'FIELD_TOO_LONG', `${label} je predolg.`);
  }
  return value;
}

function normalizeCustomer(body: Record<string, unknown>): QuoteRequestCustomer {
  const customerType = text(body.customerType);
  if (!isCustomerType(customerType)) {
    throw new OrderCommerceError(
      400,
      'INVALID_CUSTOMER_TYPE',
      'Izberite veljaven tip naročnika.'
    );
  }
  const customerName = limited(text(body.customerName), 240, 'Naročnik');
  const organizationName = limited(
    text(body.organizationName),
    240,
    'Organizacija'
  );
  const submittedContactName = limited(
    text(body.contactName),
    240,
    'Kontaktna oseba'
  );
  const contactName =
    customerType === 'individual' ? customerName : submittedContactName;
  const email = limited(text(body.email).toLowerCase(), 320, 'Email');
  const addressLine1 = limited(text(body.addressLine1), 300, 'Naslov');
  const addressLine2 = limited(text(body.addressLine2), 500, 'Dodatni naslov');
  const city = limited(text(body.city), 120, 'Kraj');
  const postalCode = limited(text(body.postalCode), 16, 'Poštna številka');
  const reference = limited(text(body.reference), 240, 'Referenca');
  const gursHouseNumberId = limited(
    text(body.gursHouseNumberId),
    100,
    'GURS ID'
  );
  if (!customerName || !contactName || !addressLine1 || !city) {
    throw new OrderCommerceError(
      400,
      'CUSTOMER_FIELDS_REQUIRED',
      'Izpolnite obvezne podatke naročnika in naslova.'
    );
  }
  if (customerType !== 'individual' && !organizationName) {
    throw new OrderCommerceError(
      400,
      'ORGANIZATION_NAME_REQUIRED',
      'Vnesite naziv organizacije.'
    );
  }
  if (!EMAIL_PATTERN.test(email)) {
    throw new OrderCommerceError(400, 'INVALID_EMAIL', 'Vnesite veljaven email.');
  }
  if (!POSTAL_CODE_PATTERN.test(postalCode)) {
    throw new OrderCommerceError(
      400,
      'INVALID_POSTAL_CODE',
      'Poštna številka mora vsebovati štiri številke.'
    );
  }
  return {
    customerType,
    customerName,
    organizationName: customerType === 'individual' ? null : organizationName,
    contactName,
    email,
    addressLine1,
    addressLine2: addressLine2 || null,
    city,
    postalCode,
    countryCode: 'SI',
    gursHouseNumberId: gursHouseNumberId || null,
    reference: reference || null
  };
}

async function canonicalizeAddress(
  client: PoolClient,
  customer: QuoteRequestCustomer
): Promise<QuoteRequestCustomer> {
  if (!customer.gursHouseNumberId) return customer;
  await client.query('savepoint quote_gurs_lookup');
  try {
    const address = await getGursAddressById(customer.gursHouseNumberId, client);
    await client.query('release savepoint quote_gurs_lookup');
    return address
      ? {
          ...customer,
          gursHouseNumberId: address.gursHouseNumberId,
          addressLine1: address.addressLine1,
          postalCode: address.postalCode,
          city: address.postalName
        }
      : { ...customer, gursHouseNumberId: null };
  } catch {
    await client.query('rollback to savepoint quote_gurs_lookup').catch(() => undefined);
    await client.query('release savepoint quote_gurs_lookup').catch(() => undefined);
    return { ...customer, gursHouseNumberId: null };
  }
}

function readReason(body: Record<string, unknown>): QuoteReason {
  const value = body.quoteReason ?? body.reason ?? 'formal_offer';
  if (!isQuoteReason(value)) {
    throw new OrderCommerceError(
      400,
      'INVALID_QUOTE_REASON',
      'Izberite veljaven razlog za ponudbo.'
    );
  }
  return value;
}

function readIdempotencyKey(request: Request, body: Record<string, unknown>): string {
  const key = text(request.headers.get('idempotency-key') ?? body.idempotencyKey);
  if (
    key.length < MIN_IDEMPOTENCY_KEY_LENGTH ||
    key.length > MAX_IDEMPOTENCY_KEY_LENGTH ||
    /[\s\u0000-\u001f\u007f]/u.test(key)
  ) {
    throw new OrderCommerceError(
      400,
      'IDEMPOTENCY_KEY_REQUIRED',
      'Zahteva mora vsebovati veljaven Idempotency-Key.'
    );
  }
  return key;
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function requestHash(input: {
  customer: QuoteRequestCustomer;
  reason: QuoteReason;
  message: string | null;
  selections: OrderSelection[];
  estimateFingerprint: string;
  shippingConfigurationVersion: number;
}): string {
  return sha256(JSON.stringify({ intent: 'quote_request', ...input }));
}

async function reserveIdempotencyKey(
  client: PoolClient,
  keyHash: string,
  fingerprint: string
): Promise<
  | { kind: 'new' }
  | {
      kind: 'replay';
      quoteRequestId: number;
      response: StoredQuoteRequestResponse;
      bootstrap: EncryptedQuoteAccessBootstrap;
    }
> {
  const inserted = await client.query(
    `
      insert into quote_request_idempotency_keys (
        key_hash,
        request_hash,
        intent
      )
      values ($1, $2, 'quote_request')
      on conflict (key_hash) do nothing
      returning id
    `,
    [keyHash, fingerprint]
  );
  if (inserted.rowCount === 1) return { kind: 'new' };

  const existing = await client.query(
    `
      select
        request_hash,
        quote_request_id,
        response_json,
        bootstrap_token_ciphertext,
        bootstrap_token_iv,
        bootstrap_token_tag
      from quote_request_idempotency_keys
      where key_hash = $1
      for update
    `,
    [keyHash]
  );
  const row = existing.rows[0];
  if (!row || row.request_hash !== fingerprint) {
    throw new OrderCommerceError(
      409,
      'IDEMPOTENCY_KEY_CONFLICT',
      'Idempotency-Key je bil že uporabljen za drugo dejanje.'
    );
  }
  if (
    !row.quote_request_id ||
    !row.response_json ||
    !row.bootstrap_token_ciphertext ||
    !row.bootstrap_token_iv ||
    !row.bootstrap_token_tag
  ) {
    throw new OrderCommerceError(
      409,
      'QUOTE_REQUEST_IN_PROGRESS',
      'Povpraševanje s tem ključem se še obdeluje.'
    );
  }
  return {
    kind: 'replay',
    quoteRequestId: Number(row.quote_request_id),
    response: row.response_json as StoredQuoteRequestResponse,
    bootstrap: {
      ciphertext: String(row.bootstrap_token_ciphertext),
      initializationVector: String(row.bootstrap_token_iv),
      authenticationTag: String(row.bootstrap_token_tag)
    }
  };
}

function customerResponse(
  access: { tokenId: string; token: string; expiresAt: string },
  status: 200 | 201
) {
  const response = NextResponse.json(
    { accessId: access.tokenId },
    { status, headers: privateHeaders }
  );
  setQuoteAccessSessionCookie(response, access);
  return response;
}

function errorResponse(error: unknown) {
  if (error instanceof OrderCommerceError) {
    return NextResponse.json(
      { code: error.code, message: error.message, issues: error.issues },
      { status: error.status, headers: privateHeaders }
    );
  }
  console.error('[quote-requests.create] failed', {
    message: error instanceof Error ? error.message : 'Unknown error'
  });
  return NextResponse.json(
    {
      code: 'QUOTE_REQUEST_CREATE_FAILED',
      message: 'Povpraševanja trenutno ni mogoče poslati.'
    },
    { status: 500, headers: privateHeaders }
  );
}

async function insertRequestItems(
  client: PoolClient,
  quoteRequestId: number,
  estimate: AuthoritativeOrderQuote
) {
  for (const [index, item] of estimate.items.entries()) {
    await client.query(
      `
        insert into quote_request_items (
          quote_request_id, line_number, catalog_item_id, catalog_variant_id,
          product_slug, product_name, variant_name, sku, unit, quantity,
          min_order, available_stock_at_request, category_id, category_path,
          selected_attributes, image_url, base_unit_net, discount_pct,
          unit_net, unit_tax, unit_gross, line_net, line_tax, line_gross,
          tax_rate, currency, snapshot_json
        )
        values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
          $14, $15::jsonb, $16, $17, $18, $19, $20, $21, $22, $23,
          $24, $25, 'EUR', $26::jsonb
        )
      `,
      [
        quoteRequestId,
        index + 1,
        item.productId,
        item.variantId,
        item.productSlug,
        item.productName,
        item.variantName,
        item.sku,
        item.unit,
        item.quantity,
        item.minOrder,
        item.availableStock,
        item.categoryId,
        item.categoryPath,
        JSON.stringify(item.attributes),
        item.imageUrl,
        item.listUnitNet.toFixed(2),
        item.discountPct,
        item.unitNet.toFixed(2),
        item.unitTax.toFixed(2),
        item.unitGross.toFixed(2),
        item.lineNet.toFixed(2),
        item.lineTax.toFixed(2),
        item.lineGross.toFixed(2),
        item.taxRate,
        JSON.stringify(item.snapshot)
      ]
    );
  }
}

export async function POST(request: NextRequest) {
  if (!arePublicQuoteRequestsEnabled()) {
    return NextResponse.json(
      { code: 'QUOTE_REQUESTS_DISABLED', message: 'Povpraševanja trenutno niso na voljo.' },
      { status: 404, headers: privateHeaders }
    );
  }
  if (!requestOriginMatchesHost(request)) {
    return NextResponse.json(
      { code: 'INVALID_ORIGIN', message: 'Zahteve ni mogoče potrditi.' },
      { status: 403, headers: privateHeaders }
    );
  }

  const parsed = await readRequiredJsonRecord(request);
  if (!parsed.ok) return parsed.response;
  let client: PoolClient | null = null;
  try {
    const body = parsed.body;
    const pool = await getPool();
    const rate = await consumeQuoteRateLimit(pool, {
      scope: 'quote_request',
      subjectHash: requestNetworkSubject(request),
      maximumAttempts: 8,
      windowSeconds: 15 * 60,
      blockSeconds: 30 * 60
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { code: 'RATE_LIMITED', message: 'Poskusite znova pozneje.' },
        {
          status: 429,
          headers: {
            ...privateHeaders,
            'Retry-After': String(rate.retryAfterSeconds)
          }
        }
      );
    }

    let customer = normalizeCustomer(body);
    const reason = readReason(body);
    const messageValue = limited(
      text(body.customerMessage ?? body.quoteMessage),
      4_000,
      'Sporočilo'
    );
    const customerMessage = messageValue || null;
    const estimateFingerprint = text(
      body.estimateFingerprint ?? body.quoteFingerprint
    );
    const shippingConfigurationVersion = Number(
      body.shippingConfigurationVersion
    );
    if (
      !/^order-(?:estimate|quote)-v1:[a-f0-9]{64}$/u.test(estimateFingerprint) ||
      !Number.isSafeInteger(shippingConfigurationVersion) ||
      shippingConfigurationVersion < 1
    ) {
      throw new OrderCommerceError(
        400,
        'ESTIMATE_REQUIRED',
        'Pred oddajo ponovno osvežite okvirni izračun.'
      );
    }
    const selections = parseOrderSelections(body.items);
    const idempotencyKey = readIdempotencyKey(request, body);
    const keyHash = sha256(idempotencyKey);

    client = await pool.connect();
    await client.query('begin');
    customer = await canonicalizeAddress(client, customer);
    const fingerprint = requestHash({
      customer,
      reason,
      message: customerMessage,
      selections,
      estimateFingerprint,
      shippingConfigurationVersion
    });
    const reservation = await reserveIdempotencyKey(
      client,
      keyHash,
      fingerprint
    );
    if (reservation.kind === 'replay') {
      const token = decryptQuoteAccessBootstrap(
        reservation.bootstrap,
        keyHash,
        reservation.quoteRequestId
      );
      const verified = await exchangeQuoteAccessToken(
        client,
        token,
        'request_confirmation'
      );
      if (!verified || verified.quoteRequestId !== reservation.quoteRequestId) {
        throw new OrderCommerceError(
          409,
          'QUOTE_ACCESS_REPLAY_UNAVAILABLE',
          'Varne povezave za povpraševanje ni mogoče ponovno izdati.'
        );
      }
      await client.query('commit');
      client.release();
      client = null;
      return customerResponse(
        {
          tokenId: verified.tokenId,
          token,
          expiresAt: verified.expiresAt
        },
        200
      );
    }

    const customerLabels = normalizeOrderQuoteCustomerLabels([
      customer.organizationName,
      customer.contactName,
      customer.customerName
    ]);
    const estimate = await buildAuthoritativeOrderQuote(client, selections, {
      customerLabels
    });
    if (
      estimate.shippingConfigurationVersion !== shippingConfigurationVersion ||
      estimate.quoteFingerprint !== estimateFingerprint
    ) {
      await client.query('rollback');
      client.release();
      client = null;
      return NextResponse.json(
        {
          code: 'ESTIMATE_CHANGED',
          message: 'Okvirni izračun se je spremenil. Preverite ga in poskusite znova.',
          estimate
        },
        { status: 409, headers: privateHeaders }
      );
    }

    const numberingYear = new Date().getUTCFullYear();
    const counterResult = await client.query(
      `
        insert into quote_number_counters (
          year,
          last_request_sequence,
          updated_at
        )
        values ($1, 1, now())
        on conflict (year)
        do update
        set last_request_sequence =
              quote_number_counters.last_request_sequence + 1,
            updated_at = now()
        returning last_request_sequence
      `,
      [numberingYear]
    );
    const requestSequence = Number(
      counterResult.rows[0]?.last_request_sequence ?? 0
    );
    if (
      !Number.isSafeInteger(requestSequence) ||
      requestSequence < 1 ||
      requestSequence > 999_999
    ) {
      throw new Error('Letno zaporedje povpraševanj je izčrpano.');
    }
    const requestNumber =
      `POV-${numberingYear}-${String(requestSequence).padStart(6, '0')}`;
    const requestResult = await client.query(
      `
        insert into quote_requests (
          request_number, status, customer_type, organization_name,
          contact_name, email, address_line1, address_line2, city, postal_code,
          country_code, gurs_house_number_id, reference, quote_reason,
          customer_message, billing_snapshot_json, shipping_snapshot_json,
          estimate_fingerprint, estimate_json, state_version
        )
        values (
          $1, 'received', $2, $3, $4, $5, $6, $7, $8, $9, 'SI', $10,
          $11, $12, $13, $14::jsonb, $15::jsonb, $16, $17::jsonb, 1
        )
        returning id, request_number, created_at
      `,
      [
        requestNumber,
        customer.customerType,
        customer.organizationName,
        customer.contactName,
        customer.email,
        customer.addressLine1,
        customer.addressLine2,
        customer.city,
        customer.postalCode,
        customer.gursHouseNumberId,
        customer.reference,
        reason,
        customerMessage,
        JSON.stringify({
          customerType: customer.customerType,
          organizationName: customer.organizationName,
          contactName: customer.contactName,
          email: customer.email,
          addressLine1: customer.addressLine1,
          addressLine2: customer.addressLine2,
          city: customer.city,
          postalCode: customer.postalCode,
          countryCode: customer.countryCode,
          gursHouseNumberId: customer.gursHouseNumberId,
          reference: customer.reference
        }),
        JSON.stringify(estimate.shipping),
        estimate.quoteFingerprint.split(':').at(-1),
        JSON.stringify(estimate)
      ]
    );
    const row = requestResult.rows[0] as {
      id: string | number;
      request_number: string;
      created_at: string | Date;
    };
    const quoteRequestId = Number(row.id);
    await insertRequestItems(client, quoteRequestId, estimate);
    const initialShipping = estimate.totals.shipping ?? 0;
    const initialTotal =
      Math.round(
        (estimate.totals.net + estimate.totals.tax + initialShipping) * 100
      ) / 100;
    const customerSnapshot = {
      customerType: customer.customerType,
      organizationName: customer.organizationName,
      contactName: customer.contactName,
      email: customer.email,
      addressLine1: customer.addressLine1,
      addressLine2: customer.addressLine2,
      city: customer.city,
      postalCode: customer.postalCode,
      countryCode: customer.countryCode,
      gursHouseNumberId: customer.gursHouseNumberId,
      reference: customer.reference
    };
    const draftResult = await client.query(
      `
        insert into quote_offer_versions (
          quote_request_id,
          version_number,
          status,
          is_current,
          customer_snapshot_json,
          billing_snapshot_json,
          delivery_terms,
          payment_terms,
          acceptance_method,
          subtotal,
          tax,
          shipping,
          total,
          currency,
          tax_rate,
          shipping_snapshot_json,
          valid_until,
          created_by_actor_type
        )
        values (
          $1, 1, 'draft', false, $2::jsonb, $2::jsonb, $3, $4, $5, $6,
          $7, $8, $9, 'EUR', $10, $11::jsonb,
          $12::timestamptz + interval '1 month', 'system'
        )
        returning id
      `,
      [
        quoteRequestId,
        JSON.stringify(customerSnapshot),
        DEFAULT_QUOTE_DELIVERY_TERMS,
        DEFAULT_QUOTE_PAYMENT_TERMS,
        customer.customerType === 'school' ? 'purchase_order' : 'online',
        estimate.totals.net.toFixed(2),
        estimate.totals.tax.toFixed(2),
        initialShipping.toFixed(2),
        initialTotal.toFixed(2),
        estimate.items.length === 1 ? estimate.items[0].taxRate : 0.22,
        JSON.stringify(estimate.shipping),
        row.created_at
      ]
    );
    const draftOfferVersionId = Number(draftResult.rows[0]?.id);
    await client.query(
      `
        insert into quote_offer_version_items (
          quote_offer_version_id, line_number, catalog_item_id,
          catalog_variant_id, product_slug, product_name, variant_name, sku,
          unit, quantity, min_order, available_stock_at_request, category_id,
          category_path, selected_attributes, image_url, base_unit_net,
          discount_pct, unit_net, unit_tax, unit_gross, line_net, line_tax,
          line_gross, tax_rate, currency, snapshot_json
        )
        select
          $2, line_number, catalog_item_id, catalog_variant_id, product_slug,
          product_name, variant_name, sku, unit, quantity, min_order,
          available_stock_at_request, category_id, category_path,
          selected_attributes, image_url, base_unit_net, discount_pct,
          unit_net, unit_tax, unit_gross, line_net, line_tax, line_gross,
          tax_rate, currency, snapshot_json
        from quote_request_items
        where quote_request_id = $1
        order by line_number
      `,
      [quoteRequestId, draftOfferVersionId]
    );
    await client.query(
      `
        insert into quote_events (
          quote_request_id,
          event_key,
          event_type,
          actor_type,
          occurred_at,
          request_id,
          correlation_id,
          metadata_json
        )
        values (
          $1, $2, 'request_received', 'customer', now(), $3,
          coalesce($4, $3, gen_random_uuid()::text), $5::jsonb
        )
      `,
      [
        quoteRequestId,
        `request-received:${quoteRequestId}`,
        request.headers.get('x-request-id'),
        request.headers.get('x-correlation-id'),
        JSON.stringify({
          intent: 'quote_request',
          reason,
          shippingStatus: estimate.shipping.status,
          stockReserved: false,
          orderCreated: false
        })
      ]
    );
    await client.query(
      `
        insert into quote_events (
          quote_request_id,
          quote_offer_version_id,
          event_key,
          event_type,
          actor_type,
          occurred_at,
          metadata_json
        )
        values ($1, $2, $3, 'draft_created', 'system', now(), $4::jsonb)
      `,
      [
        quoteRequestId,
        draftOfferVersionId,
        `draft-created:${draftOfferVersionId}`,
        JSON.stringify({
          versionNumber: 1,
          source: 'quote_request_estimate',
          shippingRequiresAdminConfirmation:
            estimate.shipping.status === 'manual_quote'
        })
      ]
    );
    const access = await issueQuoteAccessToken(client, {
      quoteRequestId,
      scopes: ['request_confirmation']
    });
    const responsePayload: StoredQuoteRequestResponse = {
      quoteRequestId,
      requestNumber: row.request_number,
      status: 'received',
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : String(row.created_at)
    };
    const bootstrap = encryptQuoteAccessBootstrap(
      access.token,
      keyHash,
      quoteRequestId
    );
    let quoteEmailQueued = false;
    await client.query('savepoint quote_request_email');
    try {
      const jobs = await enqueueQuoteEmailEvent(client, {
        quoteRequestId,
        eventKey: `quote-request-submitted:${quoteRequestId}`,
        eventType: 'quote_request_submitted'
      });
      quoteEmailQueued = jobs.length > 0;
      if (quoteEmailQueued) {
        await client.query(
          `
            insert into quote_events (
              quote_request_id, event_key, event_type, actor_type,
              occurred_at, metadata_json
            )
            values ($1, $2, 'quote_email_queued', 'system', now(), $3::jsonb)
            on conflict (event_key) where event_key is not null do nothing
          `,
          [
            quoteRequestId,
            `quote-email-queued:request:${quoteRequestId}`,
            JSON.stringify({
              eventType: 'quote_request_submitted',
              jobCount: jobs.length
            })
          ]
        );
      }
      await client.query('release savepoint quote_request_email');
    } catch (emailError) {
      await client.query('rollback to savepoint quote_request_email');
      await client.query('release savepoint quote_request_email');
      await client.query(
        `
          insert into quote_events (
            quote_request_id, event_key, event_type, actor_type,
            occurred_at, metadata_json
          )
          values ($1, $2, 'quote_email_provider_failed', 'system', now(), $3::jsonb)
          on conflict (event_key) where event_key is not null do nothing
        `,
        [
          quoteRequestId,
          `quote-email-enqueue-failed:request:${quoteRequestId}`,
          JSON.stringify({ stage: 'enqueue', eventType: 'quote_request_submitted' })
        ]
      );
      console.error('[quote-request] email enqueue failed', {
        quoteRequestId,
        message:
          emailError instanceof Error ? emailError.message : 'Unknown error'
      });
    }
    await client.query(
      `
        update quote_request_idempotency_keys
        set quote_request_id = $1,
            response_json = $2::jsonb,
            bootstrap_token_ciphertext = $3,
            bootstrap_token_iv = $4,
            bootstrap_token_tag = $5,
            completed_at = now()
        where key_hash = $6
      `,
      [
        quoteRequestId,
        JSON.stringify(responsePayload),
        bootstrap.ciphertext,
        bootstrap.initializationVector,
        bootstrap.authenticationTag,
        keyHash
      ]
    );
    await client.query('commit');
    client.release();
    client = null;
    if (quoteEmailQueued) scheduleQuoteEmailJobs(pool);
    return customerResponse(access, 201);
  } catch (error) {
    if (client) {
      await client.query('rollback').catch(() => undefined);
      client.release();
    }
    return errorResponse(error);
  }
}
