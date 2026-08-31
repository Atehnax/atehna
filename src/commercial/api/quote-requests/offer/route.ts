import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/shared/server/db';
import { verifyQuoteAccessSession } from '@/shared/server/quoteAccess';
import { isQuoteOnlineAcceptanceEnabled } from '@/shared/server/quoteFeatureFlags';

export const runtime = 'nodejs';

const privateHeaders = {
  'Cache-Control': 'no-store, private',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow, noarchive'
};

function number(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(request: NextRequest) {
  try {
    const pool = await getPool();
    const access = await verifyQuoteAccessSession(pool, request, {
      scope: 'offer_review',
      requireCsrf: true
    });
    if (!access || !access.quoteOfferVersionId || !access.accessSessionHash) {
      return NextResponse.json(
        { code: 'QUOTE_ACCESS_DENIED', message: 'Ponudba ni dostopna.' },
        { status: 404, headers: privateHeaders }
      );
    }
    const client = await pool.connect();
    try {
      await client.query('begin');
      const result = await client.query(
        `
          select
            offer.id,
            offer.quote_request_id,
            offer.version_number,
            offer.offer_number,
            offer.status,
            offer.is_current,
            offer.customer_snapshot_json,
            offer.seller_message,
            offer.customer_visible_notes,
            offer.delivery_terms,
            offer.payment_terms,
            offer.acceptance_method,
            offer.subtotal,
            offer.tax,
            offer.shipping,
            offer.total,
            offer.currency,
            offer.terms_text,
            offer.terms_version,
            offer.issued_at,
            offer.valid_until,
            request.request_number,
            request.customer_type,
            coalesce(item_rows.items, '[]'::jsonb) as items,
            coalesce(document_rows.documents, '[]'::jsonb) as documents
          from quote_offer_versions offer
          join quote_requests request on request.id = offer.quote_request_id
          left join lateral (
            select jsonb_agg(
              jsonb_build_object(
                'lineNumber', item.line_number,
                'sku', item.sku,
                'productName', item.product_name,
                'variantName', item.variant_name,
                'unit', item.unit,
                'quantity', item.quantity,
                'unitNet', item.unit_net,
                'unitTax', item.unit_tax,
                'unitGross', item.unit_gross,
                'lineNet', item.line_net,
                'lineTax', item.line_tax,
                'lineGross', item.line_gross,
                'taxRate', item.tax_rate,
                'imageUrl', item.image_url
              )
              order by item.line_number
            ) as items
            from quote_offer_version_items item
            where item.quote_offer_version_id = offer.id
          ) item_rows on true
          left join lateral (
            select jsonb_agg(
              jsonb_build_object(
                'accessId', document.customer_access_id,
                'filename', document.filename,
                'contentSha256', document.content_sha256
              )
              order by document.created_at desc
            ) as documents
            from quote_documents document
            where document.quote_offer_version_id = offer.id
              and document.document_type = 'offer'
          ) document_rows on true
          where offer.id = $1
            and offer.quote_request_id = $2
        `,
        [access.quoteOfferVersionId, access.quoteRequestId]
      );
      const row = result.rows[0];
      if (!row) {
        await client.query('rollback');
        return NextResponse.json(
          { code: 'QUOTE_ACCESS_DENIED', message: 'Ponudba ni dostopna.' },
          { status: 404, headers: privateHeaders }
        );
      }
      const computedExpired =
        row.status === 'issued' &&
        new Date(String(row.valid_until)).getTime() < Date.now();
      const [verificationResult, resultingOrderResult] = await Promise.all([
        client.query(
          `
            select 1
            from quote_email_verifications
            where quote_request_id = $1
              and quote_offer_version_id = $2
              and access_session_hash = $3
              and purpose = 'offer_response'
              and status = 'verified'
              and consumed_at is null
              and expires_at > now()
            limit 1
          `,
          [
            access.quoteRequestId,
            access.quoteOfferVersionId,
            access.accessSessionHash
          ]
        ),
        client.query(
          `
            select access.id
            from orders
            join order_access_tokens access on access.order_id = orders.id
            where orders.source_quote_offer_version_id = $1
              and access.revoked_at is null
              and access.expires_at > now()
              and 'confirmation' = any(access.scopes)
            order by access.created_at desc
            limit 1
          `,
          [access.quoteOfferVersionId]
        )
      ]);
      const documents = Array.isArray(row.documents) ? row.documents : [];
      const emailVerified = verificationResult.rowCount === 1;
      const responseEnabled =
        isQuoteOnlineAcceptanceEnabled() &&
        !computedExpired &&
        row.status === 'issued' &&
        row.is_current === true;
      const isSchool = row.customer_type === 'school';
      const canAccept =
        responseEnabled &&
        !isSchool &&
        row.acceptance_method !== 'purchase_order' &&
        documents.length > 0;
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
          values ($1, $2, $3, 'offer_viewed', 'customer', now(), $4::jsonb)
          on conflict (event_key) where event_key is not null do nothing
        `,
        [
          access.quoteRequestId,
          access.quoteOfferVersionId,
          `offer-viewed:${access.quoteOfferVersionId}:${access.tokenId}`,
          JSON.stringify({ accessTokenId: access.tokenId })
        ]
      );
      await client.query('commit');
      return NextResponse.json(
        {
          requestNumber: row.request_number,
          offerNumber: row.offer_number,
          versionNumber: number(row.version_number),
          status: computedExpired ? 'expired' : row.status,
          isCurrent: row.is_current === true,
          customer: row.customer_snapshot_json,
          sellerMessage: row.seller_message,
          customerVisibleNotes: row.customer_visible_notes,
          deliveryTerms: row.delivery_terms,
          paymentTerms: row.payment_terms,
          acceptanceMethod: row.acceptance_method,
          items: row.items,
          totals: {
            net: number(row.subtotal),
            tax: number(row.tax),
            shipping: number(row.shipping),
            gross: number(row.total),
            currency: row.currency
          },
          termsText: row.terms_text,
          termsVersion: row.terms_version,
          issuedAt:
            row.issued_at instanceof Date
              ? row.issued_at.toISOString()
              : String(row.issued_at),
          validUntil:
            row.valid_until instanceof Date
              ? row.valid_until.toISOString()
              : String(row.valid_until),
          documents,
          responseEnabled,
          emailVerificationRequired: true,
          emailVerified,
          canAccept,
          canDecline: responseEnabled,
          canUploadPurchaseOrder:
            responseEnabled &&
            (isSchool ||
              row.acceptance_method === 'purchase_order' ||
              row.acceptance_method === 'online_or_purchase_order'),
          resultingOrderAccessId:
            resultingOrderResult.rows[0]?.id
              ? String(resultingOrderResult.rows[0].id)
              : null
        },
        { headers: privateHeaders }
      );
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[quote.offer] failed', {
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      { code: 'QUOTE_OFFER_FAILED', message: 'Ponudbe trenutno ni mogoče prikazati.' },
      { status: 500, headers: privateHeaders }
    );
  }
}
