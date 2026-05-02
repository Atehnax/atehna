import { NextResponse } from 'next/server';
import { revalidateAdminOrderPaths } from '@/shared/server/revalidateAdminOrders';
import { isPaymentStatus } from '@/shared/domain/order/paymentStatus';
import { getPool } from '@/shared/server/db';
import { computeObjectDiff, diffHasEntries } from '@/shared/audit/auditDiff';
import { insertAuditEventForRequest } from '@/shared/server/audit';


export async function POST(request: Request, props: { params: Promise<{ orderId: string }> }) {
  const params = await props.params;
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
    const current = await pool.query('SELECT id, order_number, payment_status, admin_order_notes FROM orders WHERE id = $1', [orderId]);
    if (current.rows.length === 0) {
      return NextResponse.json({ message: 'NaroÄilo ne obstaja.' }, { status: 404 });
    }
    const previousStatus = current.rows[0]?.payment_status ?? null;

    await pool.query('UPDATE orders SET payment_status = $1, admin_order_notes = $2 WHERE id = $3', [status, note || null, orderId]);

    try {
      await pool.query(
        'INSERT INTO order_payment_logs (order_id, previous_status, new_status, note) VALUES ($1, $2, $3, $4)',
        [orderId, previousStatus, status, note || null]
      );
    } catch (error) {
      const errorCode = typeof error === 'object' && error !== null ? (error as { code?: string }).code : null;
      if (errorCode !== '42P01') throw error;
    }

    const orderNumber = String(current.rows[0]?.order_number ?? `#${orderId}`);
    const diff = computeObjectDiff(
      {
        payment_status: previousStatus,
        admin_order_notes: current.rows[0]?.admin_order_notes ?? null
      },
      {
        payment_status: status,
        admin_order_notes: note || null
      },
      { entityType: 'order', fields: ['payment_status', 'admin_order_notes'] }
    );
    if (diffHasEntries(diff)) {
      await insertAuditEventForRequest(request, {
        entityType: 'order',
        entityId: String(orderId),
        entityLabel: `Naročilo ${orderNumber}`,
        action: previousStatus !== status ? 'status_changed' : 'updated',
        summary: previousStatus !== status
          ? `Naročilo ${orderNumber}: plačilo spremenjeno`
          : `Naročilo ${orderNumber}: opomba spremenjena`,
        diff,
        metadata: {
          order_number: orderNumber,
          changed_field_count: Object.keys(diff).length
        }
      });
    }

    revalidateAdminOrderPaths(orderId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka na strežniku.' },
      { status: 500 }
    );
  }
}
