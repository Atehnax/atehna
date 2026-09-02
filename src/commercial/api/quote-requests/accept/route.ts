import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import type { PoolClient } from 'pg';
import { isCustomerType } from '@/shared/domain/order/customerType';
import { getQuoteCustomerMessage } from '@/shared/domain/quote/quoteCustomerMessage';
import { getPool } from '@/shared/server/db';
import {
  issueOrderAccessToken,
  setOrderAccessSessionCookie,
  verifyOrderAccessToken
} from '@/shared/server/orderAccess';
import {
  decryptOrderAccessBootstrap,
  encryptOrderAccessBootstrap
} from '@/shared/server/orderAccessBootstrapCipher';
import {
  enqueueInitialOrderSummaryJob,
  scheduleInitialOrderSummaryJob
} from '@/shared/server/orderSummaryJobs';
import {
  placeOrderFromFrozenSnapshot,
  type FrozenOrderLine
} from '@/shared/server/orderPlacement';
import { OrderStockConflictError } from '@/shared/server/orderStockHolds';
import { verifyQuoteAccessSession } from '@/shared/server/quoteAccess';
import {
  enqueueQuoteEmailEvent,
  scheduleQuoteEmailJobs
} from '@/shared/server/quoteEmailJobs';
import { isQuoteOnlineAcceptanceEnabled } from '@/shared/server/quoteFeatureFlags';
import { QUOTE_ACCEPTANCE_BUTTON_WORDING } from '@/shared/domain/quote/quoteOfferTerms';
import { consumeVerifiedQuoteOtp } from '@/shared/server/quoteOtp';
import {
  consumeQuoteRateLimit,
  quoteRateSubjectHash,
  requestNetworkSubject
} from '@/shared/server/quoteRateLimit';
import {
  completeQuoteResponseIdempotency,
  QuoteResponseIdempotencyError,
  quoteResponseSha256,
  readQuoteResponseIdempotencyKey,
  reserveQuoteResponseIdempotency,
  type StoredQuoteResponse
} from '@/shared/server/quoteResponseIdempotency';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';
import { requestOriginMatchesHost } from '@/shared/server/requestSecurity';
import { revalidateAdminOrderPaths } from '@/shared/server/revalidateAdminOrders';
import {
  CatalogOrderabilityError,
  isCatalogSerializationFailure,
  lockCatalogOrderability,
  requireLockedCatalogVariantOrderable
} from '@/shared/server/catalogOrderabilityLocks';
import { isStockEnforcementEnabled } from '@/shared/server/inventoryPolicy';
import { getQuoteStockAcceptanceMode } from '@/shared/server/quoteEmailSettings';

export const runtime = 'nodejs';

const privateHeaders = {
  'Cache-Control': 'no-store, private',
  'Referrer-Policy': 'no-referrer'
};

function number(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error('Ponudba vsebuje neveljaven znesek.');
  return parsed;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function responseWithOrderSession(
  response: StoredQuoteResponse,
  session: { tokenId: string; token: string; expiresAt: string }
) {
  const nextResponse = NextResponse.json(
    {
      orderAccessId: session.tokenId,
      status: response.status ?? 'accepted'
    },
    { status: response.httpStatus, headers: privateHeaders }
  );
  setOrderAccessSessionCookie(nextResponse, session);
  return nextResponse;
}

async function lockedOfferItems(
  client: PoolClient,
  offerVersionId: number
): Promise<FrozenOrderLine[]> {
  const result = await client.query(
    `
      select *
      from quote_offer_version_items
      where quote_offer_version_id = $1
      order by line_number
    `,
    [offerVersionId]
  );
  return result.rows.map((row) => {
    if (row.catalog_item_id === null || row.catalog_variant_id === null) {
      throw new CatalogOrderabilityError({
        variantId: Number(row.catalog_variant_id ?? 0),
        reason: 'catalog_link_missing',
        label: String(row.product_name) + ' – ' + String(row.variant_name)
      });
    }
    return {
      variantId: Number(row.catalog_variant_id),
      productId: Number(row.catalog_item_id),
      productSlug: String(row.product_slug),
      productName: String(row.product_name),
      variantName: String(row.variant_name),
      sku: String(row.sku),
      unit: row.unit === null ? null : String(row.unit),
      quantity: Number(row.quantity),
      categoryId: row.category_id === null ? null : String(row.category_id),
      categoryPath: row.category_path === null ? null : String(row.category_path),
      attributes: record(row.selected_attributes) as Record<string, string | number>,
      imageUrl: row.image_url === null ? null : String(row.image_url),
      listUnitNet: number(row.base_unit_net),
      discountPct: number(row.discount_pct),
      unitNet: number(row.unit_net),
      unitTax: number(row.unit_tax),
      unitGross: number(row.unit_gross),
      lineNet: number(row.line_net),
      lineTax: number(row.line_tax),
      lineGross: number(row.line_gross),
      taxRate: number(row.tax_rate),
      snapshot: record(row.snapshot_json)
    };
  });
}

async function lockAndValidateCatalog(
  client: PoolClient,
  items: FrozenOrderLine[],
  stockEnforcementEnabled: boolean
): Promise<void> {
  const variantIds = Array.from(new Set(items.map((item) => item.variantId))).sort(
    (left, right) => left - right
  );
  const byId = await lockCatalogOrderability(client, variantIds);
  for (const item of items) {
    const variant = requireLockedCatalogVariantOrderable({
      variant: byId.get(item.variantId),
      variantId: item.variantId,
      productId: item.productId,
      label: item.productName + ' – ' + item.variantName
    });
    if (stockEnforcementEnabled && variant.inventory < item.quantity) {
      throw new OrderStockConflictError({
        variantId: item.variantId,
        requestedQuantity: item.quantity,
        availableStock: variant?.inventory ?? 0,
        label: `${item.productName} – ${item.variantName}`
      });
    }
  }
}

function shippingForOrder(
  offer: Record<string, unknown>
): {
  automaticAmount: number | null;
  snapshot: Record<string, unknown>;
  override: Record<string, unknown> | null;
  parcelCount: number;
} {
  const snapshot = record(offer.shipping_snapshot_json);
  const finalCents = Math.round(number(offer.shipping) * 100);
  const automaticCents =
    snapshot.status === 'calculated' &&
    Number.isSafeInteger(Number(snapshot.automaticAmountCents))
      ? Number(snapshot.automaticAmountCents)
      : null;
  const override =
    automaticCents === finalCents
      ? null
      : {
          automaticAmountCents: automaticCents,
          originalAmountCents: automaticCents,
          overrideAmountCents: finalCents,
          reason:
            String(
              record(offer.shipping_confirmation_json).reason ??
                'Znesek dostave je potrjen v izdani ponudbi.'
            ).trim() || 'Znesek dostave je potrjen v izdani ponudbi.'
        };
  return {
    automaticAmount: automaticCents === null ? null : automaticCents / 100,
    snapshot,
    override,
    parcelCount:
      Number.isSafeInteger(Number(snapshot.parcelCount)) &&
      Number(snapshot.parcelCount) > 0
        ? Number(snapshot.parcelCount)
        : 1
  };
}

async function latestVerifiedOtpId(
  client: PoolClient,
  quoteRequestId: number,
  quoteOfferVersionId: number,
  accessSessionHash: string
): Promise<string | null> {
  const result = await client.query(
    `
      select id
      from quote_email_verifications
      where quote_request_id = $1
        and quote_offer_version_id = $2
        and access_session_hash = $3
        and purpose = 'offer_response'
        and status = 'verified'
        and consumed_at is null
        and expires_at > now()
      order by verified_at desc, created_at desc
      limit 1
      for update
    `,
    [quoteRequestId, quoteOfferVersionId, accessSessionHash]
  );
  return result.rows[0]?.id ? String(result.rows[0].id) : null;
}

export async function POST(request: NextRequest) {
  if (!isQuoteOnlineAcceptanceEnabled()) {
    return NextResponse.json(
      { code: 'QUOTE_RESPONSE_DISABLED', message: 'Spletni sprejem trenutno ni na voljo.' },
      { status: 503, headers: privateHeaders }
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
  const pool = await getPool();
  const client = await pool.connect();
  let orderIdForRevalidation: number | null = null;
  try {
    await client.query('begin isolation level serializable');
    const access = await verifyQuoteAccessSession(client, request, {
      scope: 'offer_response',
      requireCsrf: true
    });
    if (!access || !access.quoteOfferVersionId || !access.accessSessionHash) {
      await client.query('rollback');
      return NextResponse.json(
        { code: 'QUOTE_ACCESS_DENIED', message: 'Ponudba ni dostopna.' },
        { status: 404, headers: privateHeaders }
      );
    }
    const rate = await consumeQuoteRateLimit(client, {
      scope: 'offer_response',
      subjectHash: quoteRateSubjectHash(
        requestNetworkSubject(request),
        access.tokenId,
        access.quoteOfferVersionId
      ),
      maximumAttempts: 8,
      windowSeconds: 15 * 60,
      blockSeconds: 60 * 60
    });
    if (!rate.allowed) {
      await client.query('rollback');
      return NextResponse.json(
        { code: 'RATE_LIMITED', message: 'Preveč poskusov. Poskusite pozneje.' },
        {
          status: 429,
          headers: {
            ...privateHeaders,
            'Retry-After': String(rate.retryAfterSeconds)
          }
        }
      );
    }
    const idempotencyKey = readQuoteResponseIdempotencyKey(request, parsed.body);
    const keyHash = quoteResponseSha256(idempotencyKey);
    const requestHash = quoteResponseSha256(
      JSON.stringify({
        intent: 'quote_response',
        action: 'accept',
        quoteOfferVersionId: access.quoteOfferVersionId,
        offerNumber: parsed.body.offerNumber ?? null,
        versionNumber: parsed.body.versionNumber ?? null
      })
    );
    const reservation = await reserveQuoteResponseIdempotency(client, {
      keyHash,
      requestHash,
      quoteOfferVersionId: access.quoteOfferVersionId,
      action: 'accept'
    });
    if (reservation.kind === 'replay') {
      if (
        reservation.response.orderId &&
        reservation.response.orderAccessId &&
        reservation.bootstrap
      ) {
        const token = decryptOrderAccessBootstrap(
          reservation.bootstrap,
          keyHash,
          reservation.response.orderId
        );
        const verified = await verifyOrderAccessToken(
          client,
          token,
          'confirmation',
          reservation.response.orderId
        );
        if (!verified) {
          throw new QuoteResponseIdempotencyError(
            'ORDER_ACCESS_REPLAY_UNAVAILABLE',
            'Dostopa do ustvarjenega naročila ni mogoče obnoviti.'
          );
        }
        await client.query('commit');
        return responseWithOrderSession(reservation.response, {
          tokenId: verified.tokenId,
          token,
          expiresAt: verified.expiresAt
        });
      }
      await client.query('commit');
      return NextResponse.json(reservation.response, {
        status: reservation.response.httpStatus,
        headers: privateHeaders
      });
    }

    const offerResult = await client.query(
      `
        select
          offer.*,
          request.request_number,
          request.customer_type,
          request.organization_name,
          request.contact_name,
          request.email,
          request.address_line1,
          request.address_line2,
          request.city,
          request.postal_code,
          request.country_code,
          request.gurs_house_number_id,
          request.reference
        from quote_offer_versions offer
        join quote_requests request on request.id = offer.quote_request_id
        where offer.id = $1 and offer.quote_request_id = $2
        for update of offer, request
      `,
      [access.quoteOfferVersionId, access.quoteRequestId]
    );
    const offer = offerResult.rows[0] as Record<string, unknown> | undefined;
    if (
      !offer ||
      offer.status !== 'issued' ||
      offer.is_current !== true ||
      new Date(String(offer.valid_until)).getTime() <= Date.now() ||
      !offer.document_sha256
    ) {
      const code = offer?.document_sha256
        ? 'OFFER_NOT_RESPONDABLE'
        : 'OFFER_DOCUMENT_PENDING';
      const stored: StoredQuoteResponse = {
        httpStatus: 409,
        code,
        message:
          code === 'OFFER_DOCUMENT_PENDING'
            ? 'Dokument ponudbe se še pripravlja. Poskusite čez trenutek.'
            : 'Ponudba ni več veljavna.'
      };
      await completeQuoteResponseIdempotency(client, {
        keyHash,
        response: stored
      });
      await client.query('commit');
      return NextResponse.json(stored, { status: 409, headers: privateHeaders });
    }
    // This must be a separate statement after the offer/request row locks are
    // acquired. Under READ COMMITTED, a waiter otherwise keeps the pre-lock
    // statement snapshot and can miss a stock-block event committed by the
    // transaction that released the lock.
    const stockEnforcementEnabled = await isStockEnforcementEnabled(client);
    const stockAcceptanceMode = await getQuoteStockAcceptanceMode(client);
    const stockBlockResult =
      stockEnforcementEnabled && stockAcceptanceMode === 'automatic'
        ? await client.query(
            `
              select exists (
                select 1
                from quote_events blocked_event
                where blocked_event.quote_offer_version_id = $1
                  and blocked_event.event_type = 'acceptance_blocked_stock'
              ) as acceptance_blocked_by_stock
            `,
            [access.quoteOfferVersionId]
          )
        : null;
    if (stockBlockResult?.rows[0]?.acceptance_blocked_by_stock === true) {
      const stored: StoredQuoteResponse = {
        httpStatus: 409,
        code: 'STOCK_REVIEW_REQUIRED',
        message:
          'Sprejem ponudbe je zaradi spremenjene zaloge blokiran. Atehna mora ponudbo umakniti ali izdati novo različico.'
      };
      await completeQuoteResponseIdempotency(client, {
        keyHash,
        response: stored
      });
      await client.query('commit');
      return NextResponse.json(stored, { status: 409, headers: privateHeaders });
    }
    if (
      parsed.body.offerNumber !== offer.offer_number ||
      Number(parsed.body.versionNumber) !== Number(offer.version_number)
    ) {
      throw new QuoteResponseIdempotencyError(
        'OFFER_VERSION_MISMATCH',
        'Odgovor se ne nanaša na prikazano različico ponudbe.'
      );
    }
    if (
      offer.customer_type === 'school' ||
      offer.acceptance_method === 'purchase_order'
    ) {
      throw new QuoteResponseIdempotencyError(
        'PURCHASE_ORDER_REQUIRED',
        'Za to ponudbo naložite naročilnico.'
      );
    }
    const verificationId = await latestVerifiedOtpId(
      client,
      access.quoteRequestId,
      access.quoteOfferVersionId,
      access.accessSessionHash
    );
    if (!verificationId) {
      throw new QuoteResponseIdempotencyError(
        'OTP_REQUIRED',
        'Pred sprejemom potrdite email z varnostno kodo.'
      );
    }
    await client.query(
      `
        insert into quote_events (
          quote_request_id, quote_offer_version_id, event_key, event_type,
          actor_type, occurred_at, metadata_json
        )
        values ($1, $2, $3, 'customer_acceptance_attempted', 'customer', now(), $4::jsonb)
        on conflict (event_key) where event_key is not null do nothing
      `,
      [
        access.quoteRequestId,
        access.quoteOfferVersionId,
        `acceptance-attempt:${keyHash}`,
        JSON.stringify({ accessTokenId: access.tokenId })
      ]
    );

    await client.query('savepoint quote_accept_conversion');
    let conversionSavepointActive = true;
    try {
      const items = await lockedOfferItems(client, access.quoteOfferVersionId);
      await lockAndValidateCatalog(client, items, stockEnforcementEnabled);
      const acceptedAt = new Date().toISOString();
      const acceptanceId = randomUUID();
      const consumedOtp = await consumeVerifiedQuoteOtp(client, {
        verificationId,
        quoteRequestId: access.quoteRequestId,
        quoteOfferVersionId: access.quoteOfferVersionId,
        accessSessionHash: access.accessSessionHash
      });
      if (!consumedOtp) {
        throw new QuoteResponseIdempotencyError(
          'OTP_REQUIRED',
          'Varnostna potrditev je potekla. Zahtevajte novo kodo.'
        );
      }
      const customerSnapshot = record(offer.customer_snapshot_json);
      const customerTypeValue = String(
        customerSnapshot.customerType ?? offer.customer_type
      );
      if (!isCustomerType(customerTypeValue)) {
        throw new Error('Vrsta naročnika v ponudbi ni veljavna.');
      }
      const shipping = shippingForOrder(offer);
      const placed = await placeOrderFromFrozenSnapshot(client, {
        customer: {
          customerType: customerTypeValue,
          organizationName:
            customerSnapshot.organizationName == null
              ? null
              : String(customerSnapshot.organizationName),
          contactName: String(
            customerSnapshot.contactName ?? offer.contact_name
          ),
          email: String(customerSnapshot.email ?? offer.email),
          addressLine1: String(
            customerSnapshot.addressLine1 ?? offer.address_line1 ?? ''
          ),
          addressLine2:
            customerSnapshot.addressLine2 == null
              ? null
              : String(customerSnapshot.addressLine2),
          city: String(customerSnapshot.city ?? offer.city ?? ''),
          postalCode: String(
            customerSnapshot.postalCode ?? offer.postal_code ?? ''
          ),
          countryCode: String(
            customerSnapshot.countryCode ?? offer.country_code ?? 'SI'
          ),
          gursHouseNumberId:
            customerSnapshot.gursHouseNumberId == null
              ? null
              : String(customerSnapshot.gursHouseNumberId),
          reference:
            customerSnapshot.reference == null
              ? null
              : String(customerSnapshot.reference),
          notes:
            getQuoteCustomerMessage(
              offer.seller_message,
              offer.customer_visible_notes
            ) || null
        },
        items,
        totals: {
          net: number(offer.subtotal),
          tax: number(offer.tax),
          shipping: number(offer.shipping),
          gross: number(offer.total),
          currency: 'EUR'
        },
        shipping,
        pricingVersion: `quote-offer-v1:${offer.content_hash}`,
        commitmentStatus: 'binding',
        contractStatus: 'accepted',
        contractAcceptedAt: acceptedAt,
        contractActor: {
          type: 'customer',
          id: verificationId
        },
        contractEvidence: {
          acceptanceId,
          quoteOfferVersionId: access.quoteOfferVersionId,
          offerNumber: offer.offer_number,
          channel: 'online',
          verifiedIdentity: `email-sha256:${consumedOtp.targetEmailHash}`,
          verificationId,
          verifiedAt: consumedOtp.verifiedAt,
          acceptanceWording: QUOTE_ACCEPTANCE_BUTTON_WORDING,
          termsVersion: offer.terms_version,
          termsHash: offer.terms_hash,
          contentHash: offer.content_hash,
          documentSha256: offer.document_sha256
        },
        sourceQuoteOfferVersionId: access.quoteOfferVersionId,
        commitStock: true,
        stockEnforcementEnabled,
        stockActor: { type: 'customer', id: verificationId }
      });
      orderIdForRevalidation = placed.orderId;
      const userAgentHash = quoteResponseSha256(
        request.headers.get('user-agent') ?? ''
      );
      await client.query(
        `
          insert into quote_offer_acceptances (
            id, quote_offer_version_id, accepted_at, channel, actor_type,
            actor_id, verified_identity, verification_evidence_json,
            acceptance_wording, terms_version, terms_hash, content_hash,
            document_sha256, request_id, correlation_id, ip_hash,
            user_agent_hash
          )
          values (
            $1, $2, $3, 'online', 'customer', $4, $5, $6::jsonb, $7, $8,
            $9, $10, $11, $12, $13, $14, $15
          )
        `,
        [
          acceptanceId,
          access.quoteOfferVersionId,
          acceptedAt,
          verificationId,
          `email-sha256:${consumedOtp.targetEmailHash}`,
          JSON.stringify({
            method: 'email_otp',
            verificationId,
            verifiedAt: consumedOtp.verifiedAt,
            targetEmailHash: consumedOtp.targetEmailHash,
            quoteAccessTokenId: access.tokenId
          }),
          QUOTE_ACCEPTANCE_BUTTON_WORDING,
          offer.terms_version,
          offer.terms_hash,
          offer.content_hash,
          offer.document_sha256,
          request.headers.get('x-request-id'),
          request.headers.get('x-correlation-id'),
          requestNetworkSubject(request),
          userAgentHash
        ]
      );
      await client.query(
        `
          update quote_offer_versions
          set status = 'accepted',
              is_current = false,
              accepted_at = $2,
              state_version = state_version + 1,
              updated_at = now()
          where id = $1
        `,
        [access.quoteOfferVersionId, acceptedAt]
      );
      await client.query(
        `
          update quote_requests
          set status = 'converted_to_order',
              state_version = state_version + 1,
              updated_at = now()
          where id = $1
        `,
        [access.quoteRequestId]
      );
      const orderAccess = await issueOrderAccessToken(client, placed.orderId, {
        scopes: ['confirmation']
      });
      await enqueueInitialOrderSummaryJob(client, {
        orderId: placed.orderId,
        orderNumber: placed.orderNumber,
        createdAt: placed.createdAt,
        commitmentStatus: placed.commitmentStatus,
        customer: {
          customerType: customerTypeValue,
          organizationName:
            customerSnapshot.organizationName == null
              ? null
              : String(customerSnapshot.organizationName),
          contactName: String(customerSnapshot.contactName ?? offer.contact_name),
          email: String(customerSnapshot.email ?? offer.email),
          addressLine1: String(customerSnapshot.addressLine1 ?? offer.address_line1 ?? ''),
          addressLine2:
            customerSnapshot.addressLine2 == null
              ? null
              : String(customerSnapshot.addressLine2),
          postalCode: String(customerSnapshot.postalCode ?? offer.postal_code ?? ''),
          city: String(customerSnapshot.city ?? offer.city ?? ''),
          countryCode: String(customerSnapshot.countryCode ?? offer.country_code ?? 'SI'),
          reference:
            customerSnapshot.reference == null
              ? null
              : String(customerSnapshot.reference),
          notes:
            getQuoteCustomerMessage(
              offer.seller_message,
              offer.customer_visible_notes
            ) || null
        },
        items: items.map((item) => ({
          sku: item.sku,
          productName: item.productName,
          variantName: item.variantName,
          unit: item.unit,
          quantity: item.quantity,
          unitNet: item.unitNet
        })),
        totals: {
          net: number(offer.subtotal),
          tax: number(offer.tax),
          shipping: number(offer.shipping),
          gross: number(offer.total)
        },
        shipping: shipping.snapshot as never
      });
      await client.query(
        `
          insert into quote_events (
            quote_request_id, quote_offer_version_id, event_key, event_type,
            actor_type, actor_id, occurred_at, request_id, correlation_id,
            metadata_json
          )
          values
            ($1, $2, $3, 'customer_accepted', 'customer', $4, $5, $6,
             coalesce($7, $6, gen_random_uuid()::text), $8::jsonb),
            ($1, $2, $9, 'order_created', 'system', null, $5, $6,
             coalesce($7, $6, gen_random_uuid()::text), $10::jsonb)
        `,
        [
          access.quoteRequestId,
          access.quoteOfferVersionId,
          `customer-accepted:${acceptanceId}`,
          verificationId,
          acceptedAt,
          request.headers.get('x-request-id'),
          request.headers.get('x-correlation-id'),
          JSON.stringify({
            acceptanceId,
            wording: QUOTE_ACCEPTANCE_BUTTON_WORDING,
            verifiedIdentity: `email-sha256:${consumedOtp.targetEmailHash}`
          }),
          `order-created:${placed.orderId}`,
          JSON.stringify({
            orderId: placed.orderId,
            orderNumber: placed.orderNumber,
            sourceQuoteOfferVersionId: access.quoteOfferVersionId
          })
        ]
      );
      await client.query('savepoint quote_acceptance_email');
      try {
        const jobs = await enqueueQuoteEmailEvent(client, {
          quoteRequestId: access.quoteRequestId,
          quoteOfferVersionId: access.quoteOfferVersionId,
          eventKey: `quote-accepted:${acceptanceId}`,
          eventType: 'quote_accepted',
          detail: `Ustvarjeno je bilo naročilo ${placed.orderNumber}.`
        });
        if (jobs.length > 0) {
          await client.query(
            `
              insert into quote_events (
                quote_request_id, quote_offer_version_id, event_key,
                event_type, actor_type, occurred_at, metadata_json
              )
              values ($1, $2, $3, 'quote_email_queued', 'system', now(), $4::jsonb)
              on conflict (event_key) where event_key is not null do nothing
            `,
            [
              access.quoteRequestId,
              access.quoteOfferVersionId,
              `quote-email-queued:accepted:${acceptanceId}`,
              JSON.stringify({ eventType: 'quote_accepted', jobCount: jobs.length })
            ]
          );
        }
        await client.query('release savepoint quote_acceptance_email');
      } catch (emailError) {
        await client.query('rollback to savepoint quote_acceptance_email');
        await client.query('release savepoint quote_acceptance_email');
        await client.query(
          `
            insert into quote_events (
              quote_request_id, quote_offer_version_id, event_key,
              event_type, actor_type, occurred_at, metadata_json
            )
            values ($1, $2, $3, 'quote_email_provider_failed', 'system', now(), $4::jsonb)
            on conflict (event_key) where event_key is not null do nothing
          `,
          [
            access.quoteRequestId,
            access.quoteOfferVersionId,
            `quote-email-enqueue-failed:accepted:${acceptanceId}`,
            JSON.stringify({ stage: 'enqueue', eventType: 'quote_accepted' })
          ]
        );
        console.error('[quote.accept] email enqueue failed', {
          quoteRequestId: access.quoteRequestId,
          offerVersionId: access.quoteOfferVersionId,
          message:
            emailError instanceof Error ? emailError.message : 'Unknown error'
        });
      }
      const stored: StoredQuoteResponse = {
        httpStatus: 201,
        status: 'accepted',
        orderId: placed.orderId,
        orderAccessId: orderAccess.tokenId
      };
      const bootstrap = encryptOrderAccessBootstrap(
        orderAccess.token,
        keyHash,
        placed.orderId
      );
      await completeQuoteResponseIdempotency(client, {
        keyHash,
        response: stored,
        bootstrap
      });
      await client.query('release savepoint quote_accept_conversion');
      conversionSavepointActive = false;
      await client.query('commit');
      scheduleInitialOrderSummaryJob(pool, placed.orderId);
      scheduleQuoteEmailJobs(pool);
      revalidateAdminOrderPaths(placed.orderId);
      return responseWithOrderSession(stored, orderAccess);
    } catch (error) {
      if (conversionSavepointActive) {
        try {
          await client.query('rollback to savepoint quote_accept_conversion');
          await client.query('release savepoint quote_accept_conversion');
          conversionSavepointActive = false;
        } catch (savepointError) {
          if (isCatalogSerializationFailure(error)) throw error;
          throw savepointError;
        }
      }
      if (error instanceof CatalogOrderabilityError) {
        const stored: StoredQuoteResponse = {
          httpStatus: 409,
          code: error.code,
          message:
            'Eden od artiklov v ponudbi ni več na voljo za naročilo. Obrnite se na Atehno za novo različico ponudbe.'
        };
        await completeQuoteResponseIdempotency(client, {
          keyHash,
          response: stored
        });
        await client.query('commit');
        return NextResponse.json(stored, {
          status: 409,
          headers: privateHeaders
        });
      }
      if (error instanceof OrderStockConflictError) {
        const stored: StoredQuoteResponse = {
          httpStatus: 409,
          code: 'STOCK_CHANGED',
          message:
            stockAcceptanceMode === 'automatic'
              ? 'Zaloga se je spremenila. Povpraševanje ostaja odprto za novo različico ponudbe.'
              : 'Zaloga se je spremenila. Sprejem ni bil izveden; ponudba ostaja odprta za ročni pregled in ponovni poskus.'
        };
        if (stockAcceptanceMode === 'manual') {
          await completeQuoteResponseIdempotency(client, {
            keyHash,
            response: stored
          });
          await client.query('commit');
          return NextResponse.json(stored, {
            status: 409,
            headers: privateHeaders
          });
        }
        await client.query(
          `
            insert into quote_events (
              quote_request_id, quote_offer_version_id, event_key, event_type,
              actor_type, occurred_at, metadata_json
            )
            values ($1, $2, $3, 'acceptance_blocked_stock', 'system', now(), $4::jsonb)
            on conflict (event_key) where event_key is not null do nothing
          `,
          [
            access.quoteRequestId,
            access.quoteOfferVersionId,
            `acceptance-blocked-stock:${keyHash}`,
            JSON.stringify({
              variantId: error.variantId,
              requestedQuantity: error.requestedQuantity,
              availableStock: error.availableStock,
              orderCreated: false,
              stockCommitted: false
            })
          ]
        );
        await client.query('savepoint quote_stock_email');
        try {
          const jobs = await enqueueQuoteEmailEvent(client, {
            quoteRequestId: access.quoteRequestId,
            quoteOfferVersionId: access.quoteOfferVersionId,
            eventKey: `quote-acceptance-blocked-stock:${keyHash}`,
            eventType: 'quote_acceptance_blocked_stock'
          });
          if (jobs.length > 0) {
            await client.query(
              `
                insert into quote_events (
                  quote_request_id, quote_offer_version_id, event_key,
                  event_type, actor_type, occurred_at, metadata_json
                )
                values ($1, $2, $3, 'quote_email_queued', 'system', now(), $4::jsonb)
                on conflict (event_key) where event_key is not null do nothing
              `,
              [
                access.quoteRequestId,
                access.quoteOfferVersionId,
                `quote-email-queued:stock-blocked:${keyHash}`,
                JSON.stringify({
                  eventType: 'quote_acceptance_blocked_stock',
                  jobCount: jobs.length
                })
              ]
            );
          }
          await client.query('release savepoint quote_stock_email');
        } catch (emailError) {
          await client.query('rollback to savepoint quote_stock_email');
          await client.query('release savepoint quote_stock_email');
          console.error('[quote.accept] stock-conflict email enqueue failed', {
            quoteRequestId: access.quoteRequestId,
            offerVersionId: access.quoteOfferVersionId,
            message:
              emailError instanceof Error ? emailError.message : 'Unknown error'
          });
        }
        await completeQuoteResponseIdempotency(client, {
          keyHash,
          response: stored
        });
        await client.query('commit');
        scheduleQuoteEmailJobs(pool);
        return NextResponse.json(stored, {
          status: 409,
          headers: privateHeaders
        });
      }
      throw error;
    }
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    if (error instanceof QuoteResponseIdempotencyError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: 409, headers: privateHeaders }
      );
    }
    if (isCatalogSerializationFailure(error)) {
      return NextResponse.json(
        {
          code: 'QUOTE_CONCURRENT_CATALOG_CHANGE',
          message: 'Katalog se je med potrjevanjem spremenil. Poskusite znova.'
        },
        { status: 409, headers: privateHeaders }
      );
    }
    if (error instanceof CatalogOrderabilityError) {
      return NextResponse.json(
        {
          code: error.code,
          message:
            'Eden od artiklov v ponudbi ni več na voljo za naročilo. Obrnite se na Atehno za novo različico ponudbe.'
        },
        { status: 409, headers: privateHeaders }
      );
    }
    console.error('[quote.accept] failed', {
      orderId: orderIdForRevalidation,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      { code: 'QUOTE_ACCEPT_FAILED', message: 'Ponudbe trenutno ni mogoče sprejeti.' },
      { status: 500, headers: privateHeaders }
    );
  } finally {
    client.release();
  }
}
