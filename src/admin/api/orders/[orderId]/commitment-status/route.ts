import { NextResponse } from 'next/server';
import { getPool } from '@/shared/server/db';
import { insertAuditEventForRequest } from '@/shared/server/audit';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';
import { revalidateAdminOrderPaths } from '@/shared/server/revalidateAdminOrders';
import {
  SCHOOL_PURCHASE_ORDER_PROOF_FORMAT_MARKERS,
  schoolBindingBlock
} from '@/shared/domain/order/schoolOrderWorkflow';
import { validateLockedOrderShippingReadiness } from '@/shared/server/orderShippingReadiness';
import {
  enqueueQuoteEmailEvent,
  scheduleQuoteEmailJobs
} from '@/shared/server/quoteEmailJobs';
import { isQuoteAdminEnabled } from '@/shared/server/quoteFeatureFlags';
import { lockQuoteWorkflow } from '@/shared/server/quoteAccess';
import {
  isCatalogSerializationFailure,
  lockCatalogOrderability
} from '@/shared/server/catalogOrderabilityLocks';

type CommitmentStatus = 'binding' | 'pending_confirmation' | 'rejected';

const COMMITMENT_STATUSES = new Set<CommitmentStatus>([
  'binding',
  'pending_confirmation',
  'rejected'
]);

function isCommitmentStatus(value: string): value is CommitmentStatus {
  return COMMITMENT_STATUSES.has(value as CommitmentStatus);
}

export async function POST(
  request: Request,
  props: { params: Promise<{ orderId: string }> }
) {
  const params = await props.params;
  const orderId = Number(params.orderId);
  if (!Number.isSafeInteger(orderId) || orderId <= 0) {
    return NextResponse.json(
      { message: 'Neveljaven ID naročila.' },
      { status: 400 }
    );
  }

  const bodyResult = await readRequiredJsonRecord(request);
  if (!bodyResult.ok) return bodyResult.response;
  const nextStatus = String(
    bodyResult.body.commitmentStatus ?? bodyResult.body.status ?? ''
  ).trim();
  if (!isCommitmentStatus(nextStatus)) {
    return NextResponse.json(
      { message: 'Neveljaven status zavezujočega naročila.' },
      { status: 400 }
    );
  }

  try {
    const pool = await getPool();
    const client = await pool.connect();
    try {
      await client.query('begin isolation level serializable');
      const quoteWorkflowResult = await client.query(
        `
          select offer.quote_request_id
          from orders order_record
          join quote_offer_versions offer
            on offer.id = order_record.source_quote_offer_version_id
          where order_record.id = $1
        `,
        [orderId]
      );
      const quoteRequestId = Number(
        quoteWorkflowResult.rows[0]?.quote_request_id ?? 0
      );
      if (quoteRequestId > 0) {
        await lockQuoteWorkflow(client, quoteRequestId);
      }
      const orderResult = await client.query(
        `
          select
            id,
            order_number,
            customer_type,
            commitment_status,
            contract_status,
            source_quote_offer_version_id,
            status,
            deleted_at,
            is_draft,
            subtotal,
            tax,
            shipping,
            automatic_shipping,
            shipping_snapshot_json,
            shipping_override_json,
            shipping_override_stale,
            parcel_count,
            total
          from orders
          where id = $1
          for update
        `,
        [orderId]
      );
      const order = orderResult.rows[0] as
        | {
            order_number: string;
            customer_type: string;
            commitment_status: CommitmentStatus;
            contract_status: string;
            source_quote_offer_version_id: string | number | null;
            status: string;
            deleted_at: string | null;
            is_draft: boolean;
            subtotal: unknown;
            tax: unknown;
            shipping: unknown;
            automatic_shipping: unknown;
            shipping_snapshot_json: unknown;
            shipping_override_json: unknown;
            shipping_override_stale: unknown;
            parcel_count: unknown;
            total: unknown;
          }
        | undefined;
      if (!order) {
        await client.query('rollback');
        return NextResponse.json(
          { message: 'Naročilo ne obstaja.' },
          { status: 404 }
        );
      }

      const previousStatus = order.commitment_status;
      if (previousStatus === nextStatus) {
        await client.query('commit');
        return NextResponse.json({
          commitmentStatus: nextStatus,
          stockNotCommitted: nextStatus !== 'binding'
        });
      }
      if (order.customer_type !== 'school') {
        await client.query('rollback');
        return NextResponse.json(
          {
            message:
              'Zavezujočega statusa neposrednega naročila ni mogoče spremeniti.'
          },
          { status: 409 }
        );
      }
      if (previousStatus === 'binding') {
        await client.query('rollback');
        return NextResponse.json(
          {
            message:
              'Zavezujočega naročila ni mogoče razveljaviti brez evidence premika oziroma vračila zaloge.'
          },
          { status: 409 }
        );
      }
      if (previousStatus === 'rejected') {
        await client.query('rollback');
        return NextResponse.json(
          { message: 'Zavrnjenega šolskega naročila ni mogoče ponovno odpreti.' },
          { status: 409 }
        );
      }

      let purchaseOrderDocumentId: number | null = null;
      let purchaseOrderContentSha256: string | null = null;
      let sourceQuote:
        | {
            id: number;
            quoteRequestId: number;
            offerNumber: string;
            status: string;
            isCurrent: boolean;
            requestStatus: string;
            validUntil: Date;
            termsVersion: string;
            termsHash: string;
            contentHash: string;
            documentSha256: string;
            stockBlocked: boolean;
          }
        | null = null;
      let quoteEmailQueued = false;

      if (
        order.source_quote_offer_version_id !== null &&
        (nextStatus === 'binding' || nextStatus === 'rejected')
      ) {
        const quoteResult = await client.query(
          `
            select
              offer.id,
              offer.quote_request_id,
              offer.offer_number,
              offer.status,
              offer.is_current,
              offer.valid_until,
              offer.terms_version,
              offer.terms_hash,
              offer.content_hash,
              offer.document_sha256,
              exists (
                select 1
                from quote_events blocked_event
                where blocked_event.quote_offer_version_id = offer.id
                  and blocked_event.event_type = 'acceptance_blocked_stock'
              ) as stock_blocked,
              quote_request.status as request_status
            from quote_offer_versions offer
            join quote_requests quote_request
              on quote_request.id = offer.quote_request_id
            where offer.id = $1
            for update of offer, quote_request
          `,
          [order.source_quote_offer_version_id]
        );
        const row = quoteResult.rows[0];
        if (!row) {
          await client.query('rollback');
          return NextResponse.json(
            { message: 'Izvorna ponudba naročila ne obstaja.' },
            { status: 409 }
          );
        }
        if (!isQuoteAdminEnabled()) {
          await client.query('rollback');
          return NextResponse.json(
            { code: 'QUOTE_ADMIN_DISABLED', message: 'Ponudbe niso omogočene.' },
            { status: 404 }
          );
        }
        sourceQuote = {
          id: Number(row.id),
          quoteRequestId: Number(row.quote_request_id),
          offerNumber: String(row.offer_number),
          status: String(row.status),
          isCurrent: row.is_current === true,
          requestStatus: String(row.request_status),
          validUntil: new Date(String(row.valid_until)),
          termsVersion: String(row.terms_version),
          termsHash: String(row.terms_hash),
          contentHash: String(row.content_hash),
          documentSha256: String(row.document_sha256),
          stockBlocked: row.stock_blocked === true
        };
        if (
          sourceQuote.status !== 'issued' ||
          !sourceQuote.isCurrent ||
          sourceQuote.requestStatus !== 'awaiting_purchase_order_review'
        ) {
          await client.query('rollback');
          return NextResponse.json(
            {
              message:
                'Naročilnice ni mogoče potrditi ali zavrniti, ker ponudba ni več trenutna izdana različica.'
            },
            { status: 409 }
          );
        }
        if (nextStatus === 'binding' && !sourceQuote.documentSha256) {
          await client.query('rollback');
          return NextResponse.json(
            { message: 'Ponudba nima vezanega nespremenljivega dokumenta.' },
            { status: 409 }
          );
        }
        if (nextStatus === 'binding' && sourceQuote.stockBlocked) {
          await client.query('rollback');
          return NextResponse.json(
            {
              code: 'STOCK_CHANGED_REQUIRES_REVISION',
              message:
                'Zaloga se je spremenila. Naročilnico zavrnite in izdajte novo različico ponudbe.'
            },
            { status: 409 }
          );
        }
      }

      if (nextStatus === 'binding') {
        if (order.deleted_at || order.status === 'cancelled') {
          await client.query('rollback');
          return NextResponse.json(
            {
              message:
                'Izbrisanega ali preklicanega naročila ni mogoče potrditi.'
            },
            { status: 409 }
          );
        }

        const shippingReadiness = await validateLockedOrderShippingReadiness(
          client,
          orderId,
          order as unknown as Record<string, unknown>
        );
        if (!shippingReadiness.ok) {
          await client.query('rollback');
          return NextResponse.json(
            {
              code: 'ORDER_COMMITMENT_SHIPPING_NOT_READY',
              message: shippingReadiness.message
            },
            { status: 409 }
          );
        }

        const purchaseOrderResult = await client.query(
          `
            select id, content_sha256, issued_at
            from order_documents
            where order_id = $1
              and type = 'purchase_order'
              and deleted_at is null
              and format_marker = any($2::text[])
              and order_pricing_revision = (
                select pricing_revision from orders where id = $1
              )
            order by id desc
            limit 1
            for share
          `,
          [orderId, [...SCHOOL_PURCHASE_ORDER_PROOF_FORMAT_MARKERS]]
        );
        const purchaseOrderBlock = schoolBindingBlock(
          order.customer_type,
          nextStatus,
          purchaseOrderResult.rowCount === 1
        );
        if (purchaseOrderBlock) {
          await client.query('rollback');
          return NextResponse.json(purchaseOrderBlock, { status: 409 });
        }
        purchaseOrderDocumentId = Number(purchaseOrderResult.rows[0]?.id ?? 0);
        purchaseOrderContentSha256 = String(
          purchaseOrderResult.rows[0]?.content_sha256 ?? ''
        );
        const purchaseOrderSubmittedAt = new Date(
          String(purchaseOrderResult.rows[0]?.issued_at)
        );
        if (
          sourceQuote &&
          (Number.isNaN(purchaseOrderSubmittedAt.getTime()) ||
            Number.isNaN(sourceQuote.validUntil.getTime()) ||
            purchaseOrderSubmittedAt.getTime() > sourceQuote.validUntil.getTime())
        ) {
          await client.query('rollback');
          return NextResponse.json(
            {
              message:
                'Naročilnica ni bila oddana v času veljavnosti izvorne ponudbe.'
            },
            { status: 409 }
          );
        }

        const itemsResult = await client.query(
          `
            select
              catalog_item_id,
              catalog_variant_id,
              sum(quantity)::integer as quantity
            from order_items
            where order_id = $1
            group by catalog_item_id, catalog_variant_id
            order by catalog_item_id, catalog_variant_id
          `,
          [orderId]
        );
        const items = itemsResult.rows as Array<{
          catalog_item_id: string | number | null;
          catalog_variant_id: string | number | null;
          quantity: string | number;
        }>;
        if (
          items.length === 0 ||
          items.some(
            (item) =>
              item.catalog_item_id === null || item.catalog_variant_id === null
          )
        ) {
          await client.query('rollback');
          return NextResponse.json(
            {
              message:
                'Naročilo nima popolnih povezav na različice in ga ni mogoče varno potrditi.'
            },
            { status: 409 }
          );
        }

        await client.query('savepoint school_stock_commit');
        const lockedVariants = await lockCatalogOrderability(
          client,
          items.map((item) => Number(item.catalog_variant_id))
        );
        const quoteForStockConflict = sourceQuote;
        const respondToStockConflict = async (input: {
          code: 'INSUFFICIENT_STOCK' | 'STOCK_COMMIT_CONFLICT';
          message: string;
          variantId: number;
          requestedQuantity: number;
          availableStock: number;
        }) => {
          if (!quoteForStockConflict) {
            await client.query('rollback');
            return NextResponse.json(input, { status: 409 });
          }
          await client.query('rollback to savepoint school_stock_commit');
          await client.query('release savepoint school_stock_commit');
          await client.query(
            `
              insert into quote_events (
                quote_request_id, quote_offer_version_id, event_key, event_type,
                actor_type, occurred_at, request_id, correlation_id, metadata_json
              )
              values (
                $1, $2, $3, 'acceptance_blocked_stock', 'system', now(), $4,
                coalesce($5, $4, gen_random_uuid()::text), $6::jsonb
              )
              on conflict (event_key) where event_key is not null do nothing
            `,
            [
              quoteForStockConflict.quoteRequestId,
              quoteForStockConflict.id,
              `acceptance-blocked-stock:school:${quoteForStockConflict.id}`,
              request.headers.get('x-request-id'),
              request.headers.get('x-correlation-id'),
              JSON.stringify({
                orderId,
                orderNumber: order.order_number,
                purchaseOrderDocumentId,
                variantId: input.variantId,
                requestedQuantity: input.requestedQuantity,
                availableStock: input.availableStock,
                orderCreated: true,
                orderRemainsPending: true,
                stockCommitted: false,
                requiresRevision: true
              })
            ]
          );
          await client.query('savepoint quote_stock_email');
          try {
            const jobs = await enqueueQuoteEmailEvent(client, {
              quoteRequestId: quoteForStockConflict.quoteRequestId,
              quoteOfferVersionId: quoteForStockConflict.id,
              eventKey: `school-quote-stock-blocked:${quoteForStockConflict.id}`,
              eventType: 'quote_acceptance_blocked_stock',
              detail:
                'Naročilnice ni mogoče potrditi zaradi spremenjene zaloge; potrebna je nova različica ponudbe.'
            });
            quoteEmailQueued = jobs.length > 0;
            if (quoteEmailQueued) {
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
                  quoteForStockConflict.quoteRequestId,
                  quoteForStockConflict.id,
                  `quote-email-queued:school-stock-blocked:${quoteForStockConflict.id}`,
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
            console.error('[orders.commitment-status] stock email enqueue failed', {
              orderId,
              quoteRequestId: quoteForStockConflict.quoteRequestId,
              message:
                emailError instanceof Error ? emailError.message : 'Unknown error'
            });
          }
          await client.query('commit');
          if (quoteEmailQueued) scheduleQuoteEmailJobs(pool);
          return NextResponse.json(
            {
              ...input,
              code: 'STOCK_CHANGED_REQUIRES_REVISION',
              message:
                'Zaloga se je spremenila. Naročilnico zavrnite in izdajte novo različico ponudbe.'
            },
            { status: 409 }
          );
        };

        for (const item of items) {
          const variantId = Number(item.catalog_variant_id);
          const quantity = Number(item.quantity);
          const variant = lockedVariants.get(variantId);
          if (
            !variant ||
            variant.itemId !== Number(item.catalog_item_id) ||
            variant.variantStatus !== 'active' ||
            variant.productStatus !== 'active' ||
            variant.categoryId === null ||
            variant.categoryIsActive !== true ||
            variant.inventory < quantity
          ) {
            return respondToStockConflict({
              message: `Zaloga različice ${variantId} ne zadošča za potrditev naročila.`,
              code: 'INSUFFICIENT_STOCK',
              variantId,
              requestedQuantity: quantity,
              availableStock: variant?.inventory ?? 0
            });
          }

          const decrementResult = await client.query(
            `
              update catalog_item_variants
              set inventory = inventory - $1,
                  updated_at = now()
              where id = $2
                and inventory >= $1
            `,
            [quantity, variantId]
          );
          if (decrementResult.rowCount !== 1) {
            return respondToStockConflict({
              message: `Zaloge različice ${variantId} med potrjevanjem ni bilo mogoče varno rezervirati.`,
              code: 'STOCK_COMMIT_CONFLICT',
              variantId,
              requestedQuantity: quantity,
              availableStock: variant.inventory
            });
          }
          await client.query(
            `
              insert into order_stock_holds (
                order_id,
                catalog_variant_id,
                quantity,
                state,
                committed_at,
                committed_by_actor_type,
                committed_by_actor_id
              )
              values ($1, $2, $3, 'held', now(), 'school_purchase_order', $4)
            `,
            [orderId, variantId, quantity, String(purchaseOrderDocumentId)]
          );
        }
        await client.query('release savepoint school_stock_commit');
      }

      if (nextStatus === 'binding') {
        await client.query(
          `
            update orders
            set commitment_status = 'binding',
                contract_status = 'accepted',
                contract_accepted_at = now(),
                contract_accepted_actor_type = 'school_purchase_order',
                contract_accepted_actor_id = $2,
                contract_acceptance_evidence_json = $3::jsonb,
                contract_state_version = contract_state_version + 1,
                committed_at = now()
            where id = $1
          `,
          [
            orderId,
            String(purchaseOrderDocumentId),
            JSON.stringify({
              channel: 'purchase_order_review',
              purchaseOrderDocumentId,
              buttonWording: 'Potrdi naročilnico in naročilo'
            })
          ]
        );
      } else if (nextStatus === 'rejected') {
        await client.query(
          `
            update orders
            set commitment_status = 'rejected',
                contract_status = 'rejected',
                contract_rejected_at = now(),
                contract_rejected_actor_type = 'admin',
                contract_rejected_actor_id = null,
                contract_rejection_reason = 'Naročilnica oziroma šolsko naročilo je bilo zavrnjeno.',
                contract_rejection_evidence_json = $2::jsonb,
                contract_state_version = contract_state_version + 1
            where id = $1
          `,
          [
            orderId,
            JSON.stringify({
              channel: 'purchase_order_review',
              action: 'reject_school_order'
            })
          ]
        );
      } else {
        await client.query(
          'update orders set commitment_status = $1 where id = $2',
          [nextStatus, orderId]
        );
      }

      if (sourceQuote && nextStatus === 'binding') {
        const acceptedAt = new Date().toISOString();
        await client.query(
          `
            insert into quote_offer_acceptances (
              quote_offer_version_id,
              accepted_at,
              channel,
              actor_type,
              actor_id,
              verified_identity,
              verification_evidence_json,
              acceptance_wording,
              terms_version,
              terms_hash,
              content_hash,
              document_sha256,
              request_id,
              correlation_id
            )
            values (
              $1, $2, 'purchase_order_validation', 'school_purchase_order',
              $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12
            )
          `,
          [
            sourceQuote.id,
            acceptedAt,
            String(purchaseOrderDocumentId),
            `purchase-order-sha256:${purchaseOrderContentSha256}`,
            JSON.stringify({
              orderId,
              purchaseOrderDocumentId,
              purchaseOrderContentSha256,
              validationChannel: 'admin_purchase_order_review'
            }),
            'Potrdi naročilnico in naročilo',
            sourceQuote.termsVersion,
            sourceQuote.termsHash,
            sourceQuote.contentHash,
            sourceQuote.documentSha256,
            request.headers.get('x-request-id'),
            request.headers.get('x-correlation-id')
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
          [sourceQuote.id, acceptedAt]
        );
        await client.query(
          `
            update quote_requests
            set status = 'converted_to_order',
                state_version = state_version + 1,
                updated_at = now()
            where id = $1
          `,
          [sourceQuote.quoteRequestId]
        );
        await client.query(
          `
            insert into quote_events (
              quote_request_id, quote_offer_version_id, event_key, event_type,
              actor_type, occurred_at, request_id, correlation_id, metadata_json
            )
            values
              ($1, $2, $3, 'admin_purchase_order_validated', 'admin', $6, $7,
               coalesce($8, $7, gen_random_uuid()::text), $9::jsonb),
              ($1, $2, $4, 'customer_accepted', 'customer', $6, $7,
               coalesce($8, $7, gen_random_uuid()::text), $9::jsonb),
              ($1, $2, $5, 'order_created', 'system', $6, $7,
               coalesce($8, $7, gen_random_uuid()::text), $9::jsonb)
          `,
          [
            sourceQuote.quoteRequestId,
            sourceQuote.id,
            `purchase-order-validated:${sourceQuote.id}`,
            `school-offer-accepted:${sourceQuote.id}`,
            `quote-order-created:${sourceQuote.id}`,
            acceptedAt,
            request.headers.get('x-request-id'),
            request.headers.get('x-correlation-id'),
            JSON.stringify({
              orderId,
              orderNumber: order.order_number,
              purchaseOrderDocumentId,
              purchaseOrderContentSha256
            })
          ]
        );
        await client.query('savepoint quote_acceptance_email');
        try {
          const jobs = await enqueueQuoteEmailEvent(client, {
            quoteRequestId: sourceQuote.quoteRequestId,
            quoteOfferVersionId: sourceQuote.id,
            eventKey: `school-quote-accepted:${sourceQuote.id}`,
            eventType: 'quote_accepted',
            detail: `Ustvarjeno je bilo naročilo ${order.order_number}.`
          });
          quoteEmailQueued = jobs.length > 0;
          if (quoteEmailQueued) {
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
                sourceQuote.quoteRequestId,
                sourceQuote.id,
                `quote-email-queued:school-accepted:${sourceQuote.id}`,
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
              sourceQuote.quoteRequestId,
              sourceQuote.id,
              `quote-email-enqueue-failed:school-accepted:${sourceQuote.id}`,
              JSON.stringify({ stage: 'enqueue', eventType: 'quote_accepted' })
            ]
          );
          console.error('[orders.commitment-status] quote email enqueue failed', {
            orderId,
            quoteRequestId: sourceQuote.quoteRequestId,
            message:
              emailError instanceof Error ? emailError.message : 'Unknown error'
          });
        }
      } else if (sourceQuote && nextStatus === 'rejected') {
        const rejectedAt = new Date().toISOString();
        await client.query(
          `
            update quote_offer_versions
            set status = 'withdrawn',
                is_current = false,
                withdrawn_at = $2,
                withdrawal_reason = $3,
                state_version = state_version + 1,
                updated_at = now()
            where id = $1
          `,
          [
            sourceQuote.id,
            rejectedAt,
            'Naročilnica se ne ujema z izdano ponudbo; potrebna je nova različica.'
          ]
        );
        await client.query(
          `
            update quote_requests
            set status = 'withdrawn',
                state_version = state_version + 1,
                updated_at = now()
            where id = $1
          `,
          [sourceQuote.quoteRequestId]
        );
        await client.query(
          `
            update quote_access_tokens
            set revoked_at = coalesce(revoked_at, now())
            where quote_offer_version_id = $1
              and revoked_at is null
          `,
          [sourceQuote.id]
        );
        await client.query(
          `
            insert into quote_events (
              quote_request_id, quote_offer_version_id, event_key, event_type,
              actor_type, occurred_at, request_id, correlation_id, reason,
              metadata_json
            )
            values
              ($1, $2, $3, 'admin_purchase_order_rejected', 'admin', $5, $6,
               coalesce($7, $6, gen_random_uuid()::text), $8, $9::jsonb),
              ($1, $2, $4, 'offer_withdrawn', 'admin', $5, $6,
               coalesce($7, $6, gen_random_uuid()::text), $8, $9::jsonb)
          `,
          [
            sourceQuote.quoteRequestId,
            sourceQuote.id,
            `purchase-order-rejected:${sourceQuote.id}`,
            `offer-withdrawn:purchase-order-rejected:${sourceQuote.id}`,
            rejectedAt,
            request.headers.get('x-request-id'),
            request.headers.get('x-correlation-id'),
            'Naročilnica se ne ujema z izdano ponudbo.',
            JSON.stringify({ orderId, orderNumber: order.order_number })
          ]
        );
        await client.query('savepoint quote_rejection_email');
        try {
          const jobs = await enqueueQuoteEmailEvent(client, {
            quoteRequestId: sourceQuote.quoteRequestId,
            quoteOfferVersionId: sourceQuote.id,
            eventKey: `school-quote-purchase-order-rejected:${sourceQuote.id}`,
            eventType: 'quote_withdrawn',
            detail:
              'Naročilnica se ne ujema z izdano ponudbo. Za nadaljevanje je potrebna nova različica ponudbe.'
          });
          quoteEmailQueued = quoteEmailQueued || jobs.length > 0;
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
                sourceQuote.quoteRequestId,
                sourceQuote.id,
                `quote-email-queued:school-purchase-order-rejected:${sourceQuote.id}`,
                JSON.stringify({ eventType: 'quote_withdrawn', jobCount: jobs.length })
              ]
            );
          }
          await client.query('release savepoint quote_rejection_email');
        } catch (emailError) {
          await client.query('rollback to savepoint quote_rejection_email');
          await client.query('release savepoint quote_rejection_email');
          console.error('[orders.commitment-status] rejection email enqueue failed', {
            orderId,
            quoteRequestId: sourceQuote.quoteRequestId,
            message:
              emailError instanceof Error ? emailError.message : 'Unknown error'
          });
        }
      }
      await insertAuditEventForRequest(
        request,
        {
          entityType: 'order',
          entityId: String(orderId),
          entityLabel: `Naročilo ${order.order_number}`,
          action: 'status_changed',
          summary: `Naročilo ${order.order_number}: zavezujoči status spremenjen`,
          diff: {
            commitment_status: {
              label: 'Zavezujoči status',
              before: previousStatus,
              after: nextStatus
            }
          },
          metadata: {
            order_number: order.order_number,
            stock_committed: nextStatus === 'binding'
          }
        },
        client
      );
      await client.query('commit');

      revalidateAdminOrderPaths(orderId);
      if (quoteEmailQueued) scheduleQuoteEmailJobs(pool);
      return NextResponse.json({
        commitmentStatus: nextStatus,
        stockNotCommitted: nextStatus !== 'binding'
      });
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    if (isCatalogSerializationFailure(error)) {
      return NextResponse.json(
        {
          code: 'QUOTE_CONCURRENT_CATALOG_CHANGE',
          message: 'Katalog se je med potrjevanjem spremenil. Poskusite znova.'
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : 'Napaka na strežniku.'
      },
      { status: 500 }
    );
  }
}
