import { createHash, randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getQuoteCustomerMessage } from '@/shared/domain/quote/quoteCustomerMessage';
import {
  buildQuoteDocumentBlobPath,
  deletePrivateOrderDocumentBlob,
  uploadPrivateOrderDocumentBlob
} from '@/shared/server/blob';
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
import { verifyQuoteAccessSession } from '@/shared/server/quoteAccess';
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
import { requestOriginMatchesHost } from '@/shared/server/requestSecurity';
import { revalidateAdminOrderPaths } from '@/shared/server/revalidateAdminOrders';
import { isQuoteOnlineAcceptanceEnabled } from '@/shared/server/quoteFeatureFlags';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const headers = {
  'Cache-Control': 'no-store, private',
  'Referrer-Policy': 'no-referrer'
};

type UploadFormat = {
  extension: 'pdf' | 'jpg';
  contentType: 'application/pdf' | 'image/jpeg';
  formatMarker: 'customer-upload-pdf-v1' | 'customer-upload-jpeg-v1';
};

function uploadFormat(bytes: Buffer): UploadFormat | null {
  if (bytes.length >= 5 && bytes.subarray(0, 5).toString('ascii') === '%PDF-') {
    return {
      extension: 'pdf',
      contentType: 'application/pdf',
      formatMarker: 'customer-upload-pdf-v1'
    };
  }
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return {
      extension: 'jpg',
      contentType: 'image/jpeg',
      formatMarker: 'customer-upload-jpeg-v1'
    };
  }
  return null;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function number(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error('Ponudba vsebuje neveljaven znesek.');
  return parsed;
}

function orderResponse(
  stored: StoredQuoteResponse,
  access: { tokenId: string; token: string; expiresAt: string }
) {
  const response = NextResponse.json(
    { orderAccessId: access.tokenId, status: stored.status },
    { status: stored.httpStatus, headers }
  );
  setOrderAccessSessionCookie(response, access);
  return response;
}

export async function POST(request: NextRequest) {
  if (!isQuoteOnlineAcceptanceEnabled()) {
    return NextResponse.json(
      { code: 'QUOTE_RESPONSE_DISABLED', message: 'Spletni odgovor trenutno ni na voljo.' },
      { status: 503, headers }
    );
  }
  if (!requestOriginMatchesHost(request)) {
    return NextResponse.json(
      { code: 'INVALID_ORIGIN', message: 'Zahteve ni mogoče potrditi.' },
      { status: 403, headers }
    );
  }
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { code: 'INVALID_MULTIPART', message: 'Datoteke ni mogoče prebrati.' },
      { status: 400, headers }
    );
  }
  const file = formData.get('file');
  if (!(file instanceof File) || file.size < 1 || file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      {
        code: 'INVALID_PURCHASE_ORDER_FILE',
        message: 'Naročilnica mora biti PDF ali JPG do 10 MB.'
      },
      { status: 400, headers }
    );
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const format = uploadFormat(bytes);
  if (!format) {
    return NextResponse.json(
      { code: 'INVALID_PURCHASE_ORDER_FILE', message: 'Datoteka mora biti veljaven PDF ali JPG.' },
      { status: 400, headers }
    );
  }
  const contentHash = createHash('sha256').update(bytes).digest('hex');
  const offerNumber = String(formData.get('offerNumber') ?? '').trim();
  const versionNumber = Number(formData.get('versionNumber'));
  const idempotencyBody = {
    idempotencyKey: formData.get('Idempotency-Key') ?? formData.get('idempotencyKey')
  };
  const pool = await getPool();
  const client = await pool.connect();
  let uploadedPath: string | null = null;
  let orderIdForRevalidation: number | null = null;
  let commitAttempted = false;
  let clientReleased = false;
  try {
    await client.query('begin');
    const access = await verifyQuoteAccessSession(client, request, {
      scope: 'purchase_order',
      requireCsrf: true
    });
    if (!access || !access.quoteOfferVersionId || !access.accessSessionHash) {
      await client.query('rollback');
      return NextResponse.json({ message: 'Ponudba ni dostopna.' }, { status: 404, headers });
    }
    const rate = await consumeQuoteRateLimit(client, {
      scope: 'purchase_order',
      subjectHash: quoteRateSubjectHash(
        requestNetworkSubject(request),
        access.tokenId,
        access.quoteOfferVersionId
      ),
      maximumAttempts: 5,
      windowSeconds: 60 * 60,
      blockSeconds: 2 * 60 * 60
    });
    if (!rate.allowed) {
      await client.query('rollback');
      return NextResponse.json(
        { code: 'RATE_LIMITED', message: 'Preveč poskusov. Poskusite pozneje.' },
        { status: 429, headers: { ...headers, 'Retry-After': String(rate.retryAfterSeconds) } }
      );
    }
    const idempotencyKey = readQuoteResponseIdempotencyKey(
      request,
      idempotencyBody
    );
    const keyHash = quoteResponseSha256(idempotencyKey);
    const requestHash = quoteResponseSha256(
      JSON.stringify({
        intent: 'quote_response',
        action: 'purchase_order',
        quoteOfferVersionId: access.quoteOfferVersionId,
        offerNumber,
        versionNumber,
        contentHash
      })
    );
    const reservation = await reserveQuoteResponseIdempotency(client, {
      keyHash,
      requestHash,
      quoteOfferVersionId: access.quoteOfferVersionId,
      action: 'purchase_order'
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
            'Dostopa do naročila ni mogoče obnoviti.'
          );
        }
        await client.query('commit');
        return orderResponse(reservation.response, {
          tokenId: verified.tokenId,
          token,
          expiresAt: verified.expiresAt
        });
      }
      await client.query('commit');
      return NextResponse.json(reservation.response, {
        status: reservation.response.httpStatus,
        headers
      });
    }
    const offerResult = await client.query(
      `
        select
          offer.*,
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
      throw new QuoteResponseIdempotencyError(
        'OFFER_NOT_RESPONDABLE',
        'Ponudba ni pripravljena ali ni več veljavna.'
      );
    }
    if (
      offerNumber !== offer.offer_number ||
      versionNumber !== Number(offer.version_number)
    ) {
      throw new QuoteResponseIdempotencyError(
        'OFFER_VERSION_MISMATCH',
        'Naročilnica se ne nanaša na prikazano ponudbo.'
      );
    }
    if (
      offer.customer_type !== 'school' &&
      !['purchase_order', 'online_or_purchase_order'].includes(
        String(offer.acceptance_method)
      )
    ) {
      throw new QuoteResponseIdempotencyError(
        'PURCHASE_ORDER_NOT_ALLOWED',
        'Ta ponudba ne uporablja postopka z naročilnico.'
      );
    }
    const existingOrder = await client.query(
      'select id from orders where source_quote_offer_version_id = $1',
      [access.quoteOfferVersionId]
    );
    if (existingOrder.rowCount) {
      throw new QuoteResponseIdempotencyError(
        'PURCHASE_ORDER_ALREADY_UPLOADED',
        'Naročilnica za to ponudbo je že bila oddana.'
      );
    }
    const verificationResult = await client.query(
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
      [
        access.quoteRequestId,
        access.quoteOfferVersionId,
        access.accessSessionHash
      ]
    );
    const verificationId = verificationResult.rows[0]?.id
      ? String(verificationResult.rows[0].id)
      : null;
    if (!verificationId) {
      throw new QuoteResponseIdempotencyError(
        'OTP_REQUIRED',
        'Pred oddajo naročilnice potrdite email z varnostno kodo.'
      );
    }
    const consumedOtp = await consumeVerifiedQuoteOtp(client, {
      verificationId,
      quoteRequestId: access.quoteRequestId,
      quoteOfferVersionId: access.quoteOfferVersionId,
      accessSessionHash: access.accessSessionHash
    });
    if (!consumedOtp) {
      throw new QuoteResponseIdempotencyError(
        'OTP_REQUIRED',
        'Varnostna potrditev je potekla.'
      );
    }
    const itemsResult = await client.query(
      'select * from quote_offer_version_items where quote_offer_version_id = $1 order by line_number',
      [access.quoteOfferVersionId]
    );
    const items: FrozenOrderLine[] = itemsResult.rows.map((item) => {
      if (item.catalog_item_id === null || item.catalog_variant_id === null) {
        throw new QuoteResponseIdempotencyError(
          'OFFER_ITEMS_UNAVAILABLE',
          'Ponudba nima več popolnih povezav na artikle.'
        );
      }
      return {
        variantId: Number(item.catalog_variant_id),
        productId: Number(item.catalog_item_id),
        productSlug: String(item.product_slug),
        productName: String(item.product_name),
        variantName: String(item.variant_name),
        sku: String(item.sku),
        unit: item.unit === null ? null : String(item.unit),
        quantity: Number(item.quantity),
        categoryId: item.category_id === null ? null : String(item.category_id),
        categoryPath: item.category_path === null ? null : String(item.category_path),
        attributes: record(item.selected_attributes) as Record<string, string | number>,
        imageUrl: item.image_url === null ? null : String(item.image_url),
        listUnitNet: number(item.base_unit_net),
        discountPct: number(item.discount_pct),
        unitNet: number(item.unit_net),
        unitTax: number(item.unit_tax),
        unitGross: number(item.unit_gross),
        lineNet: number(item.line_net),
        lineTax: number(item.line_tax),
        lineGross: number(item.line_gross),
        taxRate: number(item.tax_rate),
        snapshot: record(item.snapshot_json)
      };
    });
    const customer = record(offer.customer_snapshot_json);
    const shippingSnapshot = record(offer.shipping_snapshot_json);
    const automaticCents =
      shippingSnapshot.status === 'calculated'
        ? Number(shippingSnapshot.automaticAmountCents)
        : null;
    const finalCents = Math.round(number(offer.shipping) * 100);
    const shippingOverride =
      automaticCents === finalCents
        ? null
        : {
            automaticAmountCents:
              Number.isSafeInteger(automaticCents) ? automaticCents : null,
            originalAmountCents:
              Number.isSafeInteger(automaticCents) ? automaticCents : null,
            overrideAmountCents: finalCents,
            reason:
              String(
                record(offer.shipping_confirmation_json).reason ??
                  'Znesek dostave je potrjen v ponudbi.'
              )
          };
    const placed = await placeOrderFromFrozenSnapshot(client, {
      customer: {
        customerType: 'school',
        organizationName:
          customer.organizationName == null
            ? String(offer.organization_name ?? '') || null
            : String(customer.organizationName),
        contactName: String(customer.contactName ?? offer.contact_name),
        email: String(customer.email ?? offer.email),
        addressLine1: String(customer.addressLine1 ?? offer.address_line1 ?? ''),
        addressLine2:
          customer.addressLine2 == null ? null : String(customer.addressLine2),
        city: String(customer.city ?? offer.city ?? ''),
        postalCode: String(customer.postalCode ?? offer.postal_code ?? ''),
        countryCode: String(customer.countryCode ?? offer.country_code ?? 'SI'),
        gursHouseNumberId:
          customer.gursHouseNumberId == null
            ? null
            : String(customer.gursHouseNumberId),
        reference:
          customer.reference == null ? null : String(customer.reference),
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
      shipping: {
        automaticAmount:
          Number.isSafeInteger(automaticCents) ? automaticCents! / 100 : null,
        snapshot: shippingSnapshot,
        override: shippingOverride,
        parcelCount:
          Number.isSafeInteger(Number(shippingSnapshot.parcelCount)) &&
          Number(shippingSnapshot.parcelCount) > 0
            ? Number(shippingSnapshot.parcelCount)
            : 1
      },
      pricingVersion: `quote-offer-v1:${offer.content_hash}-school-uncommitted`,
      commitmentStatus: 'pending_confirmation',
      contractStatus: 'pending_seller_acceptance',
      sourceQuoteOfferVersionId: access.quoteOfferVersionId,
      commitStock: false,
      stockActor: { type: 'school_purchase_order' }
    });
    orderIdForRevalidation = placed.orderId;

    const quoteDocumentAccessId = randomUUID();
    const extension = format.extension;
    const blob = await uploadPrivateOrderDocumentBlob(
      buildQuoteDocumentBlobPath(quoteDocumentAccessId, extension),
      bytes,
      format.contentType
    );
    uploadedPath = blob.pathname;
    const uploadedAt = new Date().toISOString();
    await client.query(
      `
        insert into quote_documents (
          quote_offer_version_id, customer_access_id, document_type, filename,
          blob_pathname, version_number, document_number, issued_at,
          content_sha256, offer_content_hash, terms_hash, created_by_actor_type,
          created_by_actor_id
        )
        values (
          $1, $2, 'purchase_order', $3, $4, 1, $5, $6, $7, $8, $9,
          'customer', $10
        )
      `,
      [
        access.quoteOfferVersionId,
        quoteDocumentAccessId,
        `narocilnica-${offer.offer_number}.${extension}`,
        blob.pathname,
        `NAROCILNICA-${offer.offer_number}-V1`,
        uploadedAt,
        contentHash,
        offer.content_hash,
        offer.terms_hash,
        access.tokenId
      ]
    );
    const orderDocumentAccessId = randomUUID();
    await client.query(
      `
        insert into order_documents (
          order_id, customer_access_id, type, filename, blob_pathname,
          version_number, order_pricing_revision, document_number, issued_at,
          content_sha256, legal_status, format_marker
        )
        values (
          $1, $2, 'purchase_order', $3, $4, 1, 1, $5, $6, $7,
          'operational', $8
        )
      `,
      [
        placed.orderId,
        orderDocumentAccessId,
        `narocilnica-${offer.offer_number}.${extension}`,
        blob.pathname,
        `NAROCILNICA-${placed.orderId}-V1`,
        uploadedAt,
        contentHash,
        format.formatMarker
      ]
    );
    await client.query(
      `
        update quote_requests
        set status = 'awaiting_purchase_order_review',
            state_version = state_version + 1,
            updated_at = now()
        where id = $1
      `,
      [access.quoteRequestId]
    );
    await client.query(
      `
        update quote_access_tokens
        set scopes = array_remove(scopes, 'offer_response')
        where quote_offer_version_id = $1
          and revoked_at is null
      `,
      [access.quoteOfferVersionId]
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
        customerType: 'school',
        organizationName:
          customer.organizationName == null
            ? String(offer.organization_name ?? '') || null
            : String(customer.organizationName),
        contactName: String(customer.contactName ?? offer.contact_name),
        email: String(customer.email ?? offer.email),
        addressLine1: String(customer.addressLine1 ?? offer.address_line1 ?? ''),
        addressLine2:
          customer.addressLine2 == null ? null : String(customer.addressLine2),
        postalCode: String(customer.postalCode ?? offer.postal_code ?? ''),
        city: String(customer.city ?? offer.city ?? ''),
        countryCode: String(customer.countryCode ?? offer.country_code ?? 'SI'),
        reference:
          customer.reference == null ? null : String(customer.reference),
        notes: null
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
      shipping: shippingSnapshot as never
    });
    await client.query(
      `
        insert into quote_events (
          quote_request_id, quote_offer_version_id, event_key, event_type,
          actor_type, actor_id, occurred_at, request_id, correlation_id,
          metadata_json
        )
        values (
          $1, $2, $3, 'customer_purchase_order_uploaded', 'customer', $4,
          $5, $6, coalesce($7, $6, gen_random_uuid()::text), $8::jsonb
        )
      `,
      [
        access.quoteRequestId,
        access.quoteOfferVersionId,
        `customer-purchase-order:${access.quoteOfferVersionId}:${contentHash}`,
        access.tokenId,
        uploadedAt,
        request.headers.get('x-request-id'),
        request.headers.get('x-correlation-id'),
        JSON.stringify({
          quoteDocumentAccessId,
          orderId: placed.orderId,
          orderNumber: placed.orderNumber,
          contentHash,
          verificationId,
          verifiedIdentity: `email-sha256:${consumedOtp.targetEmailHash}`,
          stockCommitted: false
        })
      ]
    );
    const stored: StoredQuoteResponse = {
      httpStatus: 201,
      status: 'awaiting_purchase_order_review',
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
    commitAttempted = true;
    await client.query('commit');
    uploadedPath = null;
    scheduleInitialOrderSummaryJob(pool, placed.orderId);
    revalidateAdminOrderPaths(placed.orderId);
    return orderResponse(stored, orderAccess);
  } catch (error) {
    const rollbackConfirmed = await client
      .query('rollback')
      .then(() => true)
      .catch(() => false);
    if (!rollbackConfirmed) {
      client.release(
        error instanceof Error
          ? error
          : new Error('Quote purchase-order transaction failed')
      );
      clientReleased = true;
    }
    if (uploadedPath) {
      let safeToDelete = !commitAttempted && rollbackConfirmed;
      if (commitAttempted) {
        if (!clientReleased) {
          client.release();
          clientReleased = true;
        }
        let referenced: boolean | null = null;
        try {
          const referenceResult = await pool.query(
            `
              select (
                exists (
                  select 1
                  from quote_documents
                  where blob_pathname = $1
                )
                or exists (
                  select 1
                  from order_documents
                  where blob_pathname = $1
                )
              ) as referenced
            `,
            [uploadedPath]
          );
          referenced = referenceResult.rows[0]?.referenced === true;
        } catch (referenceError) {
          console.error('[quote.purchase-order] blob reference check failed', {
            pathname: uploadedPath,
            message:
              referenceError instanceof Error
                ? referenceError.message
                : 'Unknown error'
          });
        }

        // A COMMIT error has an unknown outcome until the original connection
        // confirms a subsequent ROLLBACK/no-active-transaction response and a
        // fresh connection confirms that neither durable document row exists.
        safeToDelete = rollbackConfirmed && referenced === false;
        if (!safeToDelete) {
          console.error('[quote.purchase-order] retained blob after ambiguous commit', {
            pathname: uploadedPath,
            rollbackConfirmed,
            referenced
          });
        }
      }
      if (safeToDelete) {
        await deletePrivateOrderDocumentBlob(uploadedPath).catch(() => undefined);
      }
    }
    if (error instanceof QuoteResponseIdempotencyError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: 409, headers }
      );
    }
    console.error('[quote.purchase-order] failed', {
      orderId: orderIdForRevalidation,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      { code: 'PURCHASE_ORDER_UPLOAD_FAILED', message: 'Naročilnice trenutno ni mogoče oddati.' },
      { status: 500, headers }
    );
  } finally {
    if (!clientReleased) client.release();
  }
}
