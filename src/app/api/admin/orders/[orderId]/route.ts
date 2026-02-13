import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db';

async function hasOrdersDeletedAtColumn() {
  const pool = await getPool();
  const result = await pool.query(
    `
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'deleted_at'
    limit 1
    `
  );
  return Number(result.rowCount ?? 0) > 0;
}

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
    const supportsSoftDelete = await hasOrdersDeletedAtColumn();

    const orderResult = await pool.query(
      supportsSoftDelete
        ? 'select id, order_number, contact_name, deleted_at from orders where id = $1'
        : 'select id, order_number, contact_name, null::timestamptz as deleted_at from orders where id = $1',
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      return NextResponse.json({ message: 'Naročilo ne obstaja.' }, { status: 404 });
    }

    const order = orderResult.rows[0] as {
      id: number;
      order_number: string;
      contact_name: string;
      deleted_at: string | null;
    };

    if (order.deleted_at) {
      return NextResponse.json({ success: true });
    }

    if (supportsSoftDelete) {
      await pool.query('update orders set deleted_at = now() where id = $1', [orderId]);

      try {
        await pool.query(
          `
          insert into deleted_archive_entries (item_type, order_id, label, payload)
          values ($1, $2, $3, $4::jsonb)
          `,
          [
            'order',
            orderId,
            `${order.order_number || `#${orderId}`} · ${order.contact_name || 'Naročilo'}`,
            JSON.stringify({ orderNumber: order.order_number || `#${orderId}` })
          ]
        );
      } catch (error) {
        if (!(error && typeof error === 'object' && 'code' in error && error.code === '42P01')) {
          throw error;
        }
      }

      return NextResponse.json({ success: true });
    }

    await pool.query('delete from orders where id = $1', [orderId]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka na strežniku.' },
      { status: 500 }
    );
  }
}
