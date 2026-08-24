import { NextResponse } from 'next/server';
import type { PoolClient } from 'pg';
import { revalidateAdminOrderPaths } from '@/shared/server/revalidateAdminOrders';
import { isOrderStatus } from '@/shared/domain/order/orderStatus';
import { getPool } from '@/shared/server/db';
import { insertAuditEventForRequest } from '@/shared/server/audit';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';
import {
  SCHOOL_PURCHASE_ORDER_PROOF_FORMAT_MARKERS,
  schoolExecutionBlock
} from '@/shared/domain/order/schoolOrderWorkflow';
import {
  enqueueOrderEmailEvent,
  scheduleOrderEmailJobs
} from '@/shared/server/orderEmailJobs';

export async function POST(
  request: Request,
  props: { params: Promise<{ orderId: string }> }
) {
  const params = await props.params;
  let client: PoolClient | null = null;
  try {
    const orderId = Number(params.orderId);
    if (!Number.isFinite(orderId)) {
      return NextResponse.json(
        { message: 'Neveljaven ID naročila.' },
        { status: 400 }
      );
    }

    const bodyResult = await readRequiredJsonRecord(request);
    if (!bodyResult.ok) return bodyResult.response;

    const status = String(bodyResult.body?.status ?? '').trim();
    if (!status || !isOrderStatus(status)) {
      return NextResponse.json(
        { message: 'Status manjka ali je neveljaven.' },
        { status: 400 }
      );
    }

    const pool = await getPool();
    client = await pool.connect();
    await client.query('begin');
    const current = await client.query(
      'select id, order_number, status, customer_type, commitment_status from orders where id = $1 for update',
      [orderId]
    );
    if (current.rows.length === 0) {
      await client.query('rollback');
      client.release();
      client = null;
      return NextResponse.json(
        { message: 'Naročilo ne obstaja.' },
        { status: 404 }
      );
    }

    const previousStatus =
      current.rows[0]?.status === null || current.rows[0]?.status === undefined
        ? null
        : String(current.rows[0].status);
    const orderNumber = String(current.rows[0]?.order_number ?? `#${orderId}`);
    const workflow = current.rows[0];
    const purchaseOrderResult = await client.query(
      `
        select id
        from order_documents
        where order_id = $1
          and type = 'purchase_order'
          and deleted_at is null
          and format_marker = any($2::text[])
        order by id desc
        limit 1
        for share
      `,
      [orderId, [...SCHOOL_PURCHASE_ORDER_PROOF_FORMAT_MARKERS]]
    );
    const executionBlock = schoolExecutionBlock(
      String(workflow?.customer_type ?? ''),
      workflow?.commitment_status === null ||
        workflow?.commitment_status === undefined
        ? null
        : String(workflow.commitment_status),
      status,
      purchaseOrderResult.rowCount === 1
    );
    if (executionBlock) {
      await client.query('rollback');
      client.release();
      client = null;
      return NextResponse.json(executionBlock, { status: 409 });
    }
    const changed = previousStatus !== status;

    if (changed) {
      await client.query('update orders set status = $1 where id = $2', [
        status,
        orderId
      ]);
      const statusLogResult = await client.query(
        `
          insert into order_status_logs (order_id, previous_status, new_status)
          values ($1, $2, $3)
          returning id, created_at
        `,
        [orderId, previousStatus, status]
      );
      const statusLog = statusLogResult.rows[0] as {
        id: string | number;
        created_at: string | Date;
      };
      await enqueueOrderEmailEvent(client, {
        orderId,
        eventKey: `order-status:${statusLog.id}`,
        eventType: status,
        occurredAt:
          statusLog.created_at instanceof Date
            ? statusLog.created_at.toISOString()
            : String(statusLog.created_at),
        previousStatus
      });
      await insertAuditEventForRequest(
        request,
        {
          entityType: 'order',
          entityId: String(orderId),
          entityLabel: `Naročilo ${orderNumber}`,
          action: 'status_changed',
          summary: `Naročilo ${orderNumber}: status spremenjen`,
          diff: {
            status: {
              label: 'Status naročila',
              before: previousStatus,
              after: status
            }
          },
          metadata: {
            order_number: orderNumber,
            changed_field_count: 1
          }
        },
        client
      );
    }

    await client.query('commit');
    client.release();
    client = null;

    if (changed) scheduleOrderEmailJobs(pool, orderId);
    revalidateAdminOrderPaths(orderId);
    return NextResponse.json({ status });
  } catch (error) {
    if (client) {
      await client.query('rollback').catch(() => undefined);
      client.release();
    }
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : 'Napaka na strežniku.'
      },
      { status: 500 }
    );
  }
}
