import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import type { PoolClient } from 'pg';
import { getPool } from '@/shared/server/db';
import { getGursAddressById } from '@/shared/server/gursAddresses';
import { isCustomerType, type CustomerType } from '@/shared/domain/order/customerType';
import type { OrderContractStatus } from '@/shared/domain/order/contractStatus';
import {
  buildAuthoritativeOrderQuote,
  normalizeOrderQuoteCustomerLabels,
  ORDER_QUOTE_FINGERPRINT_VERSION,
  OrderCommerceError,
  parseOrderSelections,
  type AuthoritativeOrderLine,
  type AuthoritativeOrderQuote,
  type OrderSelection
} from '@/shared/server/orderCommerce';
import { placeOrderFromFrozenSnapshot } from '@/shared/server/orderPlacement';
import { isStockEnforcementEnabled } from '@/shared/server/inventoryPolicy';
import { OrderStockConflictError } from '@/shared/server/orderStockHolds';
import {
  issueOrderAccessToken,
  setOrderAccessSessionCookie,
  verifyOrderAccessToken
} from '@/shared/server/orderAccess';
import {
  decryptOrderAccessBootstrap,
  encryptOrderAccessBootstrap,
  type EncryptedOrderAccessBootstrap
} from '@/shared/server/orderAccessBootstrapCipher';
import {
  enqueueInitialOrderSummaryJob,
  scheduleInitialOrderSummaryJob
} from '@/shared/server/orderSummaryJobs';
import {
  enqueueOrderEmailEvent,
  scheduleOrderEmailJobs
} from '@/shared/server/orderEmailJobs';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';
import { revalidateAdminOrderPaths } from '@/shared/server/revalidateAdminOrders';

export const runtime = 'nodejs';

type NormalizedCustomer = {
  customerType: CustomerType;
  customerName: string;
  organizationName: string | null;
  contactName: string;
  email: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  postalCode: string;
  gursHouseNumberId: string | null;
  countryCode: 'SI';
  reference: string | null;
  notes: string | null;
};

type StoredOrderResponse = {
  orderId: number;
  orderNumber: string;
  status: 'received';
  paymentStatus: 'unpaid';
  commitmentStatus: 'binding' | 'pending_confirmation';
  contractStatus: OrderContractStatus;
  stockNotCommitted: boolean;
  createdAt: string;
  items: AuthoritativeOrderLine[];
  totals: {
    net: number;
    tax: number;
    shipping: number;
    gross: number;
    currency: 'EUR';
  };
  shipping: AuthoritativeOrderQuote['shipping'];
  shippingConfigurationVersion: number;
  quoteFingerprint: string;
  pricingVersion: AuthoritativeOrderQuote['pricingVersion'];
  customer: NormalizedCustomer;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const POSTAL_CODE_PATTERN = /^\d{4}$/;
const MAX_IDEMPOTENCY_KEY_LENGTH = 200;
const MIN_IDEMPOTENCY_KEY_LENGTH = 8;
const QUOTE_FINGERPRINT_PATTERN = new RegExp(
  `^${ORDER_QUOTE_FINGERPRINT_VERSION}:[a-f0-9]{64}$`
);

function readShippingConfigurationVersion(body: Record<string, unknown>): number {
  const version = Number(body.shippingConfigurationVersion);
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new OrderCommerceError(
      400,
      'SHIPPING_CONFIGURATION_VERSION_REQUIRED',
      'Pred oddajo ponovno osvežite izračun poštnine.'
    );
  }
  return version;
}

function readQuoteFingerprint(body: Record<string, unknown>): string {
  const fingerprint = text(body.quoteFingerprint);
  if (!QUOTE_FINGERPRINT_PATTERN.test(fingerprint)) {
    throw new OrderCommerceError(
      400,
      'QUOTE_FINGERPRINT_REQUIRED',
      'Pred oddajo ponovno osvežite celoten izračun naročila.'
    );
  }
  return fingerprint;
}

function shippingQuoteResponse(
  code: 'SHIPPING_QUOTE_CHANGED' | 'SHIPPING_MANUAL_QUOTE_REQUIRED',
  message: string,
  quote: AuthoritativeOrderQuote
) {
  return NextResponse.json(
    { code, message, quote },
    {
      status: 409,
      headers: { 'Cache-Control': 'no-store' }
    }
  );
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
}

function optionalText(value: unknown): string | null {
  const normalized = text(value);
  return normalized || null;
}

function limited(value: string, maxLength: number, fieldName: string): string {
  if (value.length > maxLength) {
    throw new OrderCommerceError(
      400,
      'FIELD_TOO_LONG',
      `${fieldName} je predolg.`
    );
  }
  return value;
}

function normalizeCustomer(body: Record<string, unknown>): NormalizedCustomer {
  const customerTypeValue = text(body.customerType);
  if (!isCustomerType(customerTypeValue)) {
    throw new OrderCommerceError(
      400,
      'INVALID_CUSTOMER_TYPE',
      'Izberite veljaven tip naročnika.'
    );
  }

  const addressLine1 = limited(text(body.addressLine1), 300, 'Naslov');
  const city = limited(text(body.city), 120, 'Kraj');
  const postalCode = limited(text(body.postalCode), 16, 'Poštna številka');
  const email = limited(text(body.email), 320, 'Email');
  const customerName = limited(text(body.customerName), 240, 'Naročnik');
  const organizationName = limited(text(body.organizationName), 240, 'Organizacija');
  const contactName = limited(text(body.contactName), 240, 'Kontaktna oseba');
  const reference = optionalText(body.reference);
  const notes = optionalText(body.notes);
  const addressLine2Value = optionalText(body.addressLine2);
  const gursHouseNumberIdValue =
    typeof body.gursHouseNumberId === 'string'
      ? optionalText(body.gursHouseNumberId)
      : null;

  if (!customerName) {
    throw new OrderCommerceError(400, 'CUSTOMER_NAME_REQUIRED', 'Vnesite naročnika.');
  }
  if (customerTypeValue !== 'individual' && !organizationName) {
    throw new OrderCommerceError(
      400,
      'ORGANIZATION_NAME_REQUIRED',
      'Vnesite naziv organizacije.'
    );
  }
  if (!contactName) {
    throw new OrderCommerceError(
      400,
      'CONTACT_NAME_REQUIRED',
      'Vnesite kontaktno osebo.'
    );
  }
  if (!EMAIL_PATTERN.test(email)) {
    throw new OrderCommerceError(400, 'INVALID_EMAIL', 'Vnesite veljaven email naslov.');
  }
  if (!addressLine1) {
    throw new OrderCommerceError(400, 'ADDRESS_REQUIRED', 'Vnesite ulico in hišno številko.');
  }
  if (!city) {
    throw new OrderCommerceError(400, 'CITY_REQUIRED', 'Vnesite kraj.');
  }
  if (!POSTAL_CODE_PATTERN.test(postalCode)) {
    throw new OrderCommerceError(
      400,
      'INVALID_POSTAL_CODE',
      'Poštna številka mora vsebovati štiri številke.'
    );
  }

  return {
    customerType: customerTypeValue,
    customerName,
    organizationName: customerTypeValue === 'individual' ? null : organizationName,
    contactName,
    email,
    addressLine1,
    addressLine2: addressLine2Value
      ? limited(addressLine2Value, 500, 'Dodatni podatki naslova')
      : null,
    city,
    postalCode,
    gursHouseNumberId: gursHouseNumberIdValue
      ? limited(gursHouseNumberIdValue, 100, 'GURS ID naslova')
      : null,
    countryCode: 'SI',
    reference: reference ? limited(reference, 240, 'Referenca') : null,
    notes: notes ? limited(notes, 4_000, 'Opombe') : null
  };
}

async function canonicalizeGursAddress(
  client: PoolClient,
  customer: NormalizedCustomer
): Promise<NormalizedCustomer> {
  if (!customer.gursHouseNumberId) return customer;

  await client.query('savepoint gurs_address_lookup');
  try {
    const address = await getGursAddressById(
      customer.gursHouseNumberId,
      client
    );
    await client.query('release savepoint gurs_address_lookup');

    if (!address) {
      return { ...customer, gursHouseNumberId: null };
    }

    return {
      ...customer,
      gursHouseNumberId: address.gursHouseNumberId,
      addressLine1: address.addressLine1,
      postalCode: address.postalCode,
      city: address.postalName
    };
  } catch (error) {
    await client
      .query('rollback to savepoint gurs_address_lookup')
      .catch(() => undefined);
    await client
      .query('release savepoint gurs_address_lookup')
      .catch(() => undefined);
    console.warn('[orders.create] GURS address lookup failed; using manual address', {
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return { ...customer, gursHouseNumberId: null };
  }
}

function readIdempotencyKey(request: Request, body: Record<string, unknown>): string {
  const key = text(request.headers.get('idempotency-key') ?? body.idempotencyKey);
  if (
    key.length < MIN_IDEMPOTENCY_KEY_LENGTH ||
    key.length > MAX_IDEMPOTENCY_KEY_LENGTH ||
    /[\s\u0000-\u001f\u007f]/.test(key)
  ) {
    throw new OrderCommerceError(
      400,
      'IDEMPOTENCY_KEY_REQUIRED',
      'Zahteva mora vsebovati veljaven Idempotency-Key.'
    );
  }
  return key;
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function requestFingerprint(
  customer: NormalizedCustomer,
  selections: OrderSelection[],
  quoteFingerprint: string,
  shippingConfigurationVersion: number
): string {
  return sha256(
    JSON.stringify({
      intent: 'direct_order',
      customer,
      items: selections,
      quoteFingerprint,
      shippingConfigurationVersion
    })
  );
}

function toCustomerOrderResponse(accessId: string) {
  return { accessId };
}

function createCustomerOrderResponse(
  session: {
    tokenId: string;
    token: string;
    expiresAt: string;
  },
  status: 200 | 201
) {
  const nextResponse = NextResponse.json(
    toCustomerOrderResponse(session.tokenId),
    {
      status,
      headers: {
        'Cache-Control': 'no-store, private',
        'Referrer-Policy': 'no-referrer'
      }
    }
  );
  setOrderAccessSessionCookie(nextResponse, session);
  return nextResponse;
}

async function reserveIdempotencyKey(
  client: PoolClient,
  keyHash: string,
  requestHash: string
): Promise<
  | { kind: 'new' }
  | {
      kind: 'replay';
      orderId: number;
      response: StoredOrderResponse;
      encryptedBootstrap: EncryptedOrderAccessBootstrap;
    }
> {
  const inserted = await client.query(
    `
      insert into order_idempotency_keys (key_hash, request_hash)
      values ($1, $2)
      on conflict (key_hash) do nothing
      returning id
    `,
    [keyHash, requestHash]
  );
  if (inserted.rowCount === 1) return { kind: 'new' };

  const existing = await client.query(
    `
      select
        keys.request_hash,
        keys.order_id,
        keys.response_json,
        keys.bootstrap_token_ciphertext,
        keys.bootstrap_token_iv,
        keys.bootstrap_token_tag
      from order_idempotency_keys keys
      where keys.key_hash = $1
    `,
    [keyHash]
  );
  const row = existing.rows[0] as
    | {
        request_hash: string;
        order_id: string | number | null;
        response_json: StoredOrderResponse | null;
        bootstrap_token_ciphertext: string | null;
        bootstrap_token_iv: string | null;
        bootstrap_token_tag: string | null;
      }
    | undefined;

  if (!row || row.request_hash !== requestHash) {
    throw new OrderCommerceError(
      409,
      'IDEMPOTENCY_KEY_CONFLICT',
      'Idempotency-Key je bil že uporabljen za drugo zahtevo.'
    );
  }
  if (
    !row.order_id ||
    !row.response_json ||
    Object.keys(row.response_json).length === 0 ||
    !row.bootstrap_token_ciphertext ||
    !row.bootstrap_token_iv ||
    !row.bootstrap_token_tag
  ) {
    throw new OrderCommerceError(
      409,
      'ORDER_REQUEST_IN_PROGRESS',
      'Naročilo s tem ključem se še obdeluje.'
    );
  }

  return {
    kind: 'replay',
    orderId: Number(row.order_id),
    response: row.response_json,
    encryptedBootstrap: {
      ciphertext: row.bootstrap_token_ciphertext,
      initializationVector: row.bootstrap_token_iv,
      authenticationTag: row.bootstrap_token_tag
    }
  };
}

async function insertOrder(
  client: PoolClient,
  customer: NormalizedCustomer,
  quote: AuthoritativeOrderQuote,
  stockEnforcementEnabled: boolean
) {
  if (
    quote.shipping.status !== 'calculated' ||
    quote.totals.shipping === null ||
    quote.totals.gross === null
  ) {
    throw new OrderCommerceError(
      409,
      'SHIPPING_MANUAL_QUOTE_REQUIRED',
      'Naročila brez dokončnega izračuna poštnine ni mogoče oddati.'
    );
  }

  const commitmentStatus: 'binding' | 'pending_confirmation' =
    customer.customerType === 'school' ? 'pending_confirmation' : 'binding';
  const stockNotCommitted = commitmentStatus === 'pending_confirmation';
  const contractStatus: OrderContractStatus = stockNotCommitted
    ? 'pending_seller_acceptance'
    : 'accepted';

  return placeOrderFromFrozenSnapshot(client, {
    customer,
    items: quote.items,
    totals: {
      net: quote.totals.net,
      tax: quote.totals.tax,
      shipping: quote.totals.shipping,
      gross: quote.totals.gross,
      currency: quote.totals.currency
    },
    shipping: {
      automaticAmount: quote.shipping.automaticAmountCents / 100,
      snapshot: quote.shipping as unknown as Record<string, unknown>,
      override: null,
      parcelCount: quote.shipping.parcelCount
    },
    pricingVersion: stockNotCommitted
      ? `${quote.pricingVersion}-school-uncommitted`
      : stockEnforcementEnabled
        ? `${quote.pricingVersion}-stock-committed`
        : `${quote.pricingVersion}-stock-enforcement-disabled`,
    commitmentStatus,
    contractStatus,
    contractActor:
      contractStatus === 'accepted' ? { type: 'system' } : undefined,
    contractEvidence: {
      channel: 'checkout',
      action:
        contractStatus === 'accepted'
          ? 'automatic_direct_order_acceptance'
          : 'await_school_purchase_order_review',
      buttonWording:
        customer.customerType === 'school'
          ? 'Pošlji naročilo v potrditev'
          : 'Naročilo z obveznostjo plačila'
    },
    commitStock: !stockNotCommitted,
    stockEnforcementEnabled,
    stockActor: {
      type: customer.customerType === 'school' ? 'school_purchase_order' : 'customer'
    }
  });
}
function safelyRevalidateAdminOrderPaths(orderId: number) {
  try {
    revalidateAdminOrderPaths(orderId);
  } catch (error) {
    console.error('[orders.create] admin order revalidation failed', {
      orderId,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

function errorResponse(error: unknown) {
  if (error instanceof OrderCommerceError) {
    return NextResponse.json(
      {
        code: error.code,
        message: error.message,
        issues: error.issues
      },
      {
        status: error.status,
        headers: { 'Cache-Control': 'no-store' }
      }
    );
  }
  if (error instanceof OrderStockConflictError) {
    return NextResponse.json(
      {
        code: error.code,
        message: error.message,
        issues: [
          {
            code: error.code,
            message: error.message,
            variantId: error.variantId,
            availableStock: error.availableStock
          }
        ]
      },
      {
        status: 409,
        headers: { 'Cache-Control': 'no-store' }
      }
    );
  }

  console.error('[orders.create] failed', {
    message: error instanceof Error ? error.message : 'Unknown error'
  });
  return NextResponse.json(
    { code: 'ORDER_CREATE_FAILED', message: 'Naročila trenutno ni mogoče oddati.' },
    {
      status: 500,
      headers: { 'Cache-Control': 'no-store' }
    }
  );
}

export async function POST(request: Request) {
  const bodyResult = await readRequiredJsonRecord(request);
  if (!bodyResult.ok) return bodyResult.response;

  let client: PoolClient | null = null;
  try {
    const body = bodyResult.body;
    let customer = normalizeCustomer(body);
    const shippingConfigurationVersion = readShippingConfigurationVersion(body);
    const submittedQuoteFingerprint = readQuoteFingerprint(body);
    const idempotencyKey = readIdempotencyKey(request, body);
    const keyHash = sha256(idempotencyKey);
    const pool = await getPool();
    client = await pool.connect();
    await client.query('begin');
    customer = await canonicalizeGursAddress(client, customer);

    const selections = parseOrderSelections(body.items);
    const requestHash = requestFingerprint(
      customer,
      selections,
      submittedQuoteFingerprint,
      shippingConfigurationVersion
    );
    const reservation = await reserveIdempotencyKey(client, keyHash, requestHash);

    if (reservation.kind === 'replay') {
      let accessToken: string;
      try {
        accessToken = decryptOrderAccessBootstrap(
          reservation.encryptedBootstrap,
          keyHash,
          reservation.orderId
        );
      } catch (error) {
        console.error('[orders.create] idempotent bootstrap decryption failed', {
          orderId: reservation.orderId,
          message: error instanceof Error ? error.message : 'Unknown error'
        });
        throw new OrderCommerceError(
          409,
          'ORDER_ACCESS_REPLAY_UNAVAILABLE',
          'Povezave za potrditev ni mogoče ponovno izdati. Obrnite se na podporo.'
        );
      }
      const verifiedAccess = await verifyOrderAccessToken(
        client,
        accessToken,
        'confirmation',
        reservation.orderId
      );
      if (!verifiedAccess) {
        throw new OrderCommerceError(
          409,
          'ORDER_ACCESS_REPLAY_UNAVAILABLE',
          'Povezava za potrditev je potekla ali je bila preklicana.'
        );
      }
      await client.query('commit');
      client.release();
      client = null;

      scheduleInitialOrderSummaryJob(pool, reservation.orderId);
      scheduleOrderEmailJobs(pool, reservation.orderId);
      safelyRevalidateAdminOrderPaths(reservation.orderId);

      return createCustomerOrderResponse(
        {
          tokenId: verifiedAccess.tokenId,
          token: accessToken,
          expiresAt: verifiedAccess.expiresAt
        },
        200
      );
    }

    const stockEnforcementEnabled =
      await isStockEnforcementEnabled(client);
    const quoteCustomerLabels = normalizeOrderQuoteCustomerLabels([
      customer.organizationName,
      customer.contactName,
      customer.customerName
    ]);
    const quote = await buildAuthoritativeOrderQuote(client, selections, {
      lockVariants: true,
      customerLabels: quoteCustomerLabels,
      stockEnforcementEnabled
    });
    if (
      quote.shippingConfigurationVersion !== shippingConfigurationVersion ||
      quote.quoteFingerprint !== submittedQuoteFingerprint
    ) {
      await client.query('rollback');
      client.release();
      client = null;
      return shippingQuoteResponse(
        'SHIPPING_QUOTE_CHANGED',
        'Izračun naročila se je spremenil. Preverite posodobljene cene in poštnino ter naročilo oddajte znova.',
        quote
      );
    }
    if (quote.shipping.status === 'manual_quote') {
      await client.query('rollback');
      client.release();
      client = null;
      return shippingQuoteResponse(
        'SHIPPING_MANUAL_QUOTE_REQUIRED',
        quote.shipping.reason,
        quote
      );
    }
    if (quote.totals.shipping === null || quote.totals.gross === null) {
      await client.query('rollback');
      client.release();
      client = null;
      return shippingQuoteResponse(
        'SHIPPING_MANUAL_QUOTE_REQUIRED',
        'Poštnine za naročilo ni mogoče varno določiti. Potrebna je ročna ponudba.',
        quote
      );
    }
    const storedTotals: StoredOrderResponse['totals'] = {
      net: quote.totals.net,
      tax: quote.totals.tax,
      shipping: quote.totals.shipping,
      gross: quote.totals.gross,
      currency: quote.totals.currency
    };
    const inserted = await insertOrder(
      client,
      customer,
      quote,
      stockEnforcementEnabled
    );
    const accessToken = await issueOrderAccessToken(client, inserted.orderId, {
      scopes:
        customer.customerType === 'school'
          ? ['confirmation', 'purchase_order']
          : ['confirmation']
    });
    const storedResponse: StoredOrderResponse = {
      orderId: inserted.orderId,
      orderNumber: inserted.orderNumber,
      status: 'received',
      paymentStatus: 'unpaid',
      commitmentStatus: inserted.commitmentStatus,
      contractStatus: inserted.contractStatus,
      stockNotCommitted: inserted.stockNotCommitted,
      createdAt: inserted.createdAt,
      items: quote.items,
      totals: storedTotals,
      shipping: quote.shipping,
      shippingConfigurationVersion: quote.shippingConfigurationVersion,
      quoteFingerprint: quote.quoteFingerprint,
      pricingVersion: quote.pricingVersion,
      customer
    };

    const encryptedBootstrap = encryptOrderAccessBootstrap(
      accessToken.token,
      keyHash,
      inserted.orderId
    );
    await enqueueInitialOrderSummaryJob(client, storedResponse);
    const initialEmailEvent =
      inserted.contractStatus === 'accepted'
        ? {
            eventKey: `order-auto-accepted:${inserted.orderId}`,
            eventType: 'order_accepted' as const
          }
        : {
            eventKey: `order-submitted:${inserted.orderId}`,
            eventType: 'order_submitted' as const
          };
    await enqueueOrderEmailEvent(client, {
      orderId: inserted.orderId,
      ...initialEmailEvent,
      occurredAt: inserted.createdAt,
      previousStatus: null,
      customerOrderAccessToken:
        customer.customerType === 'school' ? accessToken.token : null
    });
    await client.query(
      `
        update order_idempotency_keys
        set order_id = $1,
            response_json = $2::jsonb,
            bootstrap_token_ciphertext = $3,
            bootstrap_token_iv = $4,
            bootstrap_token_tag = $5,
            completed_at = now()
        where key_hash = $6
      `,
      [
        inserted.orderId,
        JSON.stringify(storedResponse),
        encryptedBootstrap.ciphertext,
        encryptedBootstrap.initializationVector,
        encryptedBootstrap.authenticationTag,
        keyHash
      ]
    );
    await client.query('commit');
    client.release();
    client = null;

    scheduleInitialOrderSummaryJob(pool, inserted.orderId);
    scheduleOrderEmailJobs(pool, inserted.orderId);
    safelyRevalidateAdminOrderPaths(inserted.orderId);

    return createCustomerOrderResponse(accessToken, 201);
  } catch (error) {
    if (client) {
      await client.query('rollback').catch(() => undefined);
      client.release();
    }
    return errorResponse(error);
  }
}
