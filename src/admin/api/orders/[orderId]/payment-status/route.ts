import { NextResponse } from 'next/server';
import { revalidateAdminOrderPaths } from '@/shared/server/revalidateAdminOrders';
import { isPaymentStatus } from '@/shared/domain/order/paymentStatus';
import { getPool } from '@/shared/server/db';
import { ensureOrderPaymentLogsTable } from '@/shared/server/orderPaymentLogs';


export async function POST(
  request: Request,
  { params }: { params: { orderId: string } }
) {
  try {
    const orderId = Number(params.orderId);
    if (!Number.isFinite(orderId)) {
      return NextResponse.json({ message: 'Neveljaven ID naročila.' }, { status: 400 });
    }

    const body = await request.json();
    const { status, note } = body ?? {};

    if (!status || typeof status !== 'string' || !isPaymentStatus(status)) {
      return NextResponse.json({ message: 'Manjka ali je neveljaven status plačila.' }, { status: 400 });
    }

    const pool = await getPool();
    await ensureOrderPaymentLogsTable();
    const current = await pool.query('SELECT payment_status FROM orders WHERE id = $1', [orderId]);
    const previousStatus = current.rows[0]?.payment_status ?? null;

    await pool.query(
      'UPDATE orders SET payment_status = $1, payment_notes = $2 WHERE id = $3',
      [status, note || null, orderId]
    );

    await pool.query(
      'INSERT INTO order_payment_logs (order_id, previous_status, new_status, note) VALUES ($1, $2, $3, $4)',
      [orderId, previousStatus, status, note || null]
    );

    revalidateAdminOrderPaths(orderId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka na strežniku.' },
      { status: 500 }
    );
  }
}
