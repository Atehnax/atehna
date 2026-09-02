import { NextResponse } from 'next/server';
import { ORDER_STATUS_SELLER_ACCEPTANCE_REQUIRED } from '@/shared/domain/order/contractStatus';
import { getPool } from '@/shared/server/db';
import { insertAuditEventForRequest } from '@/shared/server/audit';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';
import { revalidateAdminOrderPaths } from '@/shared/server/revalidateAdminOrders';
import {
  enqueueQuoteEmailEvent,
  scheduleQuoteEmailJobs
} from '@/shared/server/quoteEmailJobs';
import { isQuoteAdminEnabled } from '@/shared/server/quoteFeatureFlags';
import { lockQuoteWorkflow } from '@/shared/server/quoteAccess';
import {
  requireQuoteCustomerEmailConfirmation
} from '@/shared/server/adminCustomerEmailConfirmation';

type CommitmentStatus = 'binding' | 'pending_confirmation' | 'rejected';

const COMMITMENT_STATUSES = new Set<CommitmentStatus>([
  'binding',
  'pending_confirmation',
  'rejected'
]);

function isCommitmentStatus(value: string): value is CommitmentStatus {
  return COMMITMENT_STATUSES.has(value as CommitmentStatus);
}

type LockedSchoolOrder = Readonly<{
  order_number: string;
  customer_type: string;
  commitment_status: CommitmentStatus;
  contract_status: string;
  source_quote_offer_version_id: string | number | null;
}>;

type SourceQuoteForRejection = Readonly<{
  id: number;
  quoteRequestId: number;
  status: string;
  isCurrent: boolean;
  requestStatus: string;
}>;

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
  if (nextStatus === 'binding') {
    return NextResponse.json(ORDER_STATUS_SELLER_ACCEPTANCE_REQUIRED, {
      status: 409
    });
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
      const lockedQuoteRequestId = Number(
        quoteWorkflowResult.rows[0]?.quote_request_id ?? 0
      );
      if (lockedQuoteRequestId > 0) {
        await lockQuoteWorkflow(client, lockedQuoteRequestId);
      }

      const orderResult = await client.query(
        `
          select
            order_number,
            customer_type,
            commitment_status,
            contract_status,
            source_quote_offer_version_id
          from orders
          where id = $1
          for update
        `,
        [orderId]
      );
      const order = orderResult.rows[0] as LockedSchoolOrder | undefined;
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
          stockNotCommitted: true
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
      if (nextStatus !== 'rejected') {
        await client.query('rollback');
        return NextResponse.json(
          {
            code: 'ORDER_COMMITMENT_TRANSITION_UNAVAILABLE',
            message:
              'Čakajoče naročilo lahko zavrnete ali sprejmete s spremembo statusa na »V obdelavi«.'
          },
          { status: 409 }
        );
      }

      let sourceQuote: SourceQuoteForRejection | null = null;
      let quoteEmailQueued = false;
      if (order.source_quote_offer_version_id !== null) {
        if (!isQuoteAdminEnabled()) {
          await client.query('rollback');
          return NextResponse.json(
            { code: 'QUOTE_ADMIN_DISABLED', message: 'Ponudbe niso omogočene.' },
            { status: 404 }
          );
        }
        const quoteResult = await client.query(
          `
            select
              offer.id,
              offer.quote_request_id,
              offer.status,
              offer.is_current,
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
        sourceQuote = {
          id: Number(row.id),
          quoteRequestId: Number(row.quote_request_id),
          status: String(row.status),
          isCurrent: row.is_current === true,
          requestStatus: String(row.request_status)
        };
        if (
          sourceQuote.status !== 'issued' ||
          !sourceQuote.isCurrent ||
          sourceQuote.requestStatus !== 'awaiting_purchase_order_review'
        ) {
          await client.query('rollback');
          return NextResponse.json(
            {
              code: 'QUOTE_PURCHASE_ORDER_REVIEW_STALE',
              message:
                'Naročilnice ni mogoče zavrniti, ker ponudba ni več trenutna izdana različica.'
            },
            { status: 409 }
          );
        }
      }

      if (sourceQuote) {
        const confirmationChallenge =
          await requireQuoteCustomerEmailConfirmation({
            client,
            quoteRequestId: sourceQuote.quoteRequestId,
            eventType: 'quote_withdrawn',
            action: 'reject_school_purchase_order',
            actionLabel: 'Zavrnitev naročilnice in umik ponudbe',
            customerEmailConfirmationToken:
              bodyResult.body.customerEmailConfirmationToken
          });
        if (confirmationChallenge) {
          await client.query('rollback');
          return NextResponse.json(confirmationChallenge, { status: 428 });
        }
      }

      const rejectedAt = new Date().toISOString();
      await client.query(
        `
          update orders
          set commitment_status = 'rejected',
              contract_status = 'rejected',
              contract_rejected_at = $2,
              contract_rejected_actor_type = 'admin',
              contract_rejected_actor_id = null,
              contract_rejection_reason = 'Naročilnica oziroma šolsko naročilo je bilo zavrnjeno.',
              contract_rejection_evidence_json = $3::jsonb,
              contract_state_version = contract_state_version + 1
          where id = $1
            and customer_type = 'school'
            and commitment_status = 'pending_confirmation'
            and contract_status = 'pending_seller_acceptance'
          returning commitment_status, contract_status
        `,
        [
          orderId,
          rejectedAt,
          JSON.stringify({
            channel: 'purchase_order_review',
            action: 'reject_school_order'
          })
        ]
      );

      if (sourceQuote) {
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
                `quote-email-queued:school-purchase-order-rejected:${sourceQuote.id}`,
                JSON.stringify({
                  eventType: 'quote_withdrawn',
                  jobCount: jobs.length
                })
              ]
            );
          }
          await client.query('release savepoint quote_rejection_email');
        } catch (emailError) {
          await client.query('rollback to savepoint quote_rejection_email');
          await client.query('release savepoint quote_rejection_email');
          console.error(
            '[orders.commitment-status] rejection email enqueue failed',
            {
              orderId,
              quoteRequestId: sourceQuote.quoteRequestId,
              message:
                emailError instanceof Error
                  ? emailError.message
                  : 'Unknown error'
            }
          );
        }
      }

      await insertAuditEventForRequest(
        request,
        {
          entityType: 'order',
          entityId: String(orderId),
          entityLabel: `Naročilo ${order.order_number}`,
          action: 'status_changed',
          summary: `Naročilo ${order.order_number}: šolsko naročilo zavrnjeno`,
          diff: {
            commitment_status: {
              label: 'Zavezujoči status',
              before: previousStatus,
              after: 'rejected'
            },
            contract_status: {
              label: 'Pogodbeni status',
              before: order.contract_status,
              after: 'rejected'
            }
          },
          metadata: {
            order_number: order.order_number,
            stock_committed: false,
            changed_field_count: 2,
            source_quote_offer_version_id: sourceQuote?.id ?? null,
            source_quote_request_id: sourceQuote?.quoteRequestId ?? null
          }
        },
        client
      );
      await client.query('commit');

      revalidateAdminOrderPaths(orderId);
      if (quoteEmailQueued) scheduleQuoteEmailJobs(pool);
      return NextResponse.json({
        commitmentStatus: 'rejected',
        contractStatus: 'rejected',
        stockNotCommitted: true
      });
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : 'Napaka na strežniku.'
      },
      { status: 500 }
    );
  }
}
