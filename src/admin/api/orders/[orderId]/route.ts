import { NextResponse } from 'next/server';
import { revalidateAdminOrderPaths } from '@/shared/server/revalidateAdminOrders';
import { getPool } from '@/shared/server/db';
import { insertAuditEventForRequest } from '@/shared/server/audit';

export async function DELETE(request: Request, props: { params: Promise<{ orderId: string }> }) {
  const params = await props.params;
  try {
    const orderId = Number(params.orderId);
    if (!Number.isFinite(orderId)) {
      return NextResponse.json({ message: 'Neveljaven ID naročila.' }, { status: 400 });
    }

    const pool = await getPool();
    const orderResult = await pool.query(
      'select id, order_number, contact_name, customer_type, delivery_address, created_at, deleted_at from orders where id = $1',
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      return NextResponse.json({ message: 'Naročilo ne obstaja.' }, { status: 404 });
    }

    const order = orderResult.rows[0] as {
      id: number;
      order_number: string;
      contact_name: string;
      customer_type: string | null;
      delivery_address: string | null;
      created_at: string | null;
      deleted_at: string | null;
    };

    if (order.deleted_at) {
      revalidateAdminOrderPaths(orderId);
      return NextResponse.json({ success: true });
    }

    await pool.query('update orders set deleted_at = now() where id = $1', [orderId]);
    await pool.query(
      `
      insert into deleted_archive_entries (item_type, order_id, label, payload)
      values ($1, $2, $3, $4::jsonb)
      `,
      [
        'order',
        orderId,
        `${order.order_number || `#${orderId}`} · ${order.contact_name || 'Naročilo'}`,
        JSON.stringify({
          orderNumber: order.order_number || `#${orderId}`,
          orderCreatedAt: order.created_at,
          customerName: order.contact_name || null,
          address: order.delivery_address || null,
          customerType: order.customer_type || null
        })
      ]
    );

    const orderNumber = order.order_number || `#${orderId}`;
    await insertAuditEventForRequest(request, {
      entityType: 'order',
      entityId: String(orderId),
      entityLabel: `Naročilo ${orderNumber}`,
      action: 'deleted',
      summary: `Naročilo ${orderNumber}: izbrisano`,
      diff: {
        deleted_at: {
          label: 'Izbrisano',
          before: 'prazno',
          after: 'nastavljeno'
        }
      },
      metadata: {
        order_number: orderNumber,
        soft_delete: true
      }
    });

    revalidateAdminOrderPaths(orderId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka na strežniku.' },
      { status: 500 }
    );
  }
}
