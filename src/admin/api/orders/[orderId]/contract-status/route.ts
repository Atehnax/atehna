import { NextResponse } from 'next/server';
import { getPool } from '@/shared/server/db';
import { insertAuditEventForRequest } from '@/shared/server/audit';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';
import {
  OrderStockReconciliationRequiredError,
  releaseOrderStockHolds
} from '@/shared/server/orderStockHolds';
import { revalidateAdminOrderPaths } from '@/shared/server/revalidateAdminOrders';
import {
  enqueueOrderEmailEvent,
  scheduleOrderEmailJobs
} from '@/shared/server/orderEmailJobs';

type RequestedContractStatus = 'accepted' | 'rejected';

function isRequestedContractStatus(value: unknown): value is RequestedContractStatus {
  return value === 'accepted' || value === 'rejected';
}

export async function POST(
  request: Request,
  props: { params: Promise<{ orderId: string }> }
) {
  const { orderId: rawOrderId } = await props.params;
  const orderId = Number(rawOrderId);
  if (!Number.isSafeInteger(orderId) || orderId <= 0) {
    return NextResponse.json({ message: 'Neveljaven ID naročila.' }, { status: 400 });
  }

  const parsed = await readRequiredJsonRecord(request);
  if (!parsed.ok) return parsed.response;
  const contractStatus = parsed.body.contractStatus;
  const reason =
    typeof parsed.body.reason === 'string' ? parsed.body.reason.trim() : '';
  if (!isRequestedContractStatus(contractStatus)) {
    return NextResponse.json(
      { message: 'Izberite sprejem ali zavrnitev naročila.' },
      { status: 400 }
    );
  }
  if (contractStatus === 'rejected' && !reason) {
    return NextResponse.json(
      { message: 'Pri zavrnitvi navedite razlog.' },
      { status: 400 }
    );
  }
  if (reason.length > 2_000) {
    return NextResponse.json({ message: 'Razlog je predolg.' }, { status: 400 });
  }

  const pool = await getPool();
  const client = await pool.connect();
  let emailQueued = false;
  try {
    await client.query('begin');
    const currentResult = await client.query(
      `
        select
          id,
          order_number,
          customer_type,
          status,
          commitment_status,
          contract_status,
          source_quote_offer_version_id,
          deleted_at,
          is_draft
        from orders
        where id = $1
        for update
      `,
      [orderId]
    );
    const current = currentResult.rows[0] as
      | {
          order_number: string;
          customer_type: string;
          status: string;
          commitment_status: string;
          contract_status: string;
          source_quote_offer_version_id: string | number | null;
          deleted_at: string | null;
          is_draft: boolean;
        }
      | undefined;
    if (!current) {
      await client.query('rollback');
      return NextResponse.json({ message: 'Naročilo ne obstaja.' }, { status: 404 });
    }
    if (current.is_draft || current.deleted_at) {
      await client.query('rollback');
      return NextResponse.json(
        { message: 'Osnutka ali izbrisanega naročila ni mogoče sprejeti.' },
        { status: 409 }
      );
    }
    if (current.source_quote_offer_version_id) {
      await client.query('rollback');
      return NextResponse.json(
        { message: 'Naročilo iz sprejete ponudbe je že pogodbeno potrjeno.' },
        { status: 409 }
      );
    }
    if (current.customer_type === 'school') {
      await client.query('rollback');
      return NextResponse.json(
        {
          message:
            'Šolsko naročilo potrdite v postopku pregleda naročilnice.'
        },
        { status: 409 }
      );
    }
    if (current.contract_status === contractStatus) {
      await client.query('commit');
      return NextResponse.json({ contractStatus, unchanged: true });
    }
    if (current.contract_status !== 'pending_seller_acceptance') {
      await client.query('rollback');
      return NextResponse.json(
        { message: 'Končnega pogodbenega statusa ni mogoče ponovno spremeniti.' },
        { status: 409 }
      );
    }
    if (current.status === 'cancelled' && contractStatus === 'accepted') {
      await client.query('rollback');
      return NextResponse.json(
        { message: 'Preklicanega naročila ni mogoče sprejeti.' },
        { status: 409 }
      );
    }

    const occurredAt = new Date().toISOString();
    let releasedUnits = 0;
    if (contractStatus === 'accepted') {
      await client.query(
        `
          update orders
          set contract_status = 'accepted',
              contract_accepted_at = $2,
              contract_accepted_actor_type = 'admin',
              contract_accepted_actor_id = null,
              contract_acceptance_evidence_json = $3::jsonb,
              contract_state_version = contract_state_version + 1,
              committed_at = $2
          where id = $1
        `,
        [
          orderId,
          occurredAt,
          JSON.stringify({
            channel: 'admin',
            action: 'accept_direct_order',
            buttonWording: 'Sprejmi naročilo'
          })
        ]
      );
    } else {
      const release = await releaseOrderStockHolds(
        client,
        orderId,
        'seller_rejected',
        { type: 'admin' }
      );
      releasedUnits = release.releasedUnits;
      await client.query(
        `
          update orders
          set contract_status = 'rejected',
              contract_rejected_at = $2,
              contract_rejected_actor_type = 'admin',
              contract_rejected_actor_id = null,
              contract_rejection_reason = $3,
              contract_rejection_evidence_json = $4::jsonb,
              contract_state_version = contract_state_version + 1
          where id = $1
        `,
        [
          orderId,
          occurredAt,
          reason,
          JSON.stringify({
            channel: 'admin',
            action: 'reject_direct_order',
            stockReleasedUnits: releasedUnits
          })
        ]
      );
    }

    await insertAuditEventForRequest(
      request,
      {
        entityType: 'order',
        entityId: String(orderId),
        entityLabel: `Naročilo ${current.order_number}`,
        action: 'status_changed',
        summary:
          contractStatus === 'accepted'
            ? `Naročilo ${current.order_number}: prodajalec sprejel naročilo`
            : `Naročilo ${current.order_number}: prodajalec zavrnil naročilo`,
        diff: {
          contract_status: {
            label: 'Pogodbeni status',
            before: current.contract_status,
            after: contractStatus
          }
        },
        metadata: {
          order_number: current.order_number,
          reason: reason || null,
          stock_released_units: releasedUnits
        }
      },
      client
    );
    await client.query('savepoint order_contract_email');
    try {
      const jobs = await enqueueOrderEmailEvent(client, {
        orderId,
        eventKey: `order-contract-${contractStatus}:${orderId}`,
        eventType:
          contractStatus === 'accepted' ? 'order_accepted' : 'order_rejected',
        occurredAt,
        previousStatus: current.contract_status
      });
      emailQueued = jobs.length > 0;
      await client.query('release savepoint order_contract_email');
    } catch (emailError) {
      await client.query('rollback to savepoint order_contract_email');
      await client.query('release savepoint order_contract_email');
      console.error('[orders.contract-status] email enqueue failed', {
        orderId,
        contractStatus,
        message:
          emailError instanceof Error ? emailError.message : 'Unknown error'
      });
    }
    await client.query('commit');
    revalidateAdminOrderPaths(orderId);
    if (emailQueued) scheduleOrderEmailJobs(pool, orderId);
    return NextResponse.json({
      contractStatus,
      occurredAt,
      stockReleasedUnits: releasedUnits
    });
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    if (error instanceof OrderStockReconciliationRequiredError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: 409 }
      );
    }
    console.error('[orders.contract-status] failed', {
      orderId,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      { message: 'Pogodbenega statusa trenutno ni mogoče spremeniti.' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
