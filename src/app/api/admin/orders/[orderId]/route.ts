import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db';
import { recordDeletedArchiveEntry } from '@/lib/server/deletedArchive';

const isMissingColumnError = (error: unknown) =>
  Boolean(error && typeof error === 'object' && 'code' in error && error.code === '42703');

export async function DELETE(
  _request: Request,
  { params }: { params: { orderId: string } }
) {
  try {
    const orderId = Number(params.orderId);
    if (!Number.isFinite(orderId)) {
      return NextResponse.json({ message: 'Neveljaven ID naročila.' }, { status: 400 });
    }

    const pool = await getPool();

    const orderResult = await pool.query(
      'select id, order_number, contact_name from orders where id = $1',
      [orderId]
    );

    if (orderResult.rowCount === 0) {
      return NextResponse.json({ message: 'Naročilo ne obstaja.' }, { status: 404 });
    }

    const order = orderResult.rows[0] as {
      id: number;
      order_number: string | null;
      contact_name: string | null;
    };

    try {
      await pool.query('update orders set deleted_at = now() where id = $1', [orderId]);
    } catch (error) {
      if (!isMissingColumnError(error)) throw error;
      await pool.query('delete from orders where id = $1', [orderId]);
      return NextResponse.json({ success: true });
    }

    await recordDeletedArchiveEntry({
      itemType: 'order',
      orderId,
      label: `${order.order_number || `#${order.id}`} · ${order.contact_name || 'Naročilo'}`,
      payload: { orderNumber: order.order_number }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka na strežniku.' },
      { status: 500 }
    );
  }
}
