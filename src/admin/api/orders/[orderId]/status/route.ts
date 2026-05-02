import { NextResponse } from 'next/server';
import { revalidateAdminOrderPaths } from '@/shared/server/revalidateAdminOrders';
import { isOrderStatus } from '@/shared/domain/order/orderStatus';
import { getPool } from '@/shared/server/db';
import { insertAuditEventForRequest } from '@/shared/server/audit';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';


export async function POST(request: Request, props: { params: Promise<{ orderId: string }> }) {
  const params = await props.params;
  try {
    const orderId = Number(params.orderId);
    if (!Number.isFinite(orderId)) {
      return NextResponse.json({ message: 'Neveljaven ID naročila.' }, { status: 400 });
    }

    const bodyResult = await readRequiredJsonRecord(request);
    if (!bodyResult.ok) return bodyResult.response;

    const body = bodyResult.body;
    const status = String(body?.status ?? '').trim();

    if (!status || !isOrderStatus(status)) {
      return NextResponse.json({ message: 'Status manjka ali je neveljaven.' }, { status: 400 });
    }

    const pool = await getPool();
    const current = await pool.query('SELECT id, order_number, status FROM orders WHERE id = $1', [orderId]);
    const previousStatus = current.rows[0]?.status === null || current.rows[0]?.status === undefined
      ? null
      : String(current.rows[0].status);

    if (current.rows.length === 0) {
      return NextResponse.json({ message: 'Naročilo ne obstaja.' }, { status: 404 });
    }

    await pool.query('UPDATE orders SET status = $1 WHERE id = $2', [status, orderId]);
    if (previousStatus !== status) {
      await pool.query(
        'INSERT INTO order_status_logs (order_id, previous_status, new_status) VALUES ($1, $2, $3)',
        [orderId, previousStatus, status]
      );
      const orderNumber = String(current.rows[0]?.order_number ?? `#${orderId}`);
      await insertAuditEventForRequest(request, {
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
      });
    }

    revalidateAdminOrderPaths(orderId);
    return NextResponse.json({ status });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka na strežniku.' },
      { status: 500 }
    );
  }
}
