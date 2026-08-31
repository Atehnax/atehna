import { NextResponse } from 'next/server';
import { revalidateAdminOrderPaths } from '@/shared/server/revalidateAdminOrders';
import { getPool } from '@/shared/server/db';
import { insertAuditEventForRequest } from '@/shared/server/audit';
import { formatOrderRowAddress } from '@/shared/domain/order/orderAddress';

type OrderDeleteRow = {
  id: number;
  order_number: string;
  contact_name: string;
  customer_type: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  country_code: string | null;
  created_at: string | null;
  deleted_at: string | null;
  source_quote_offer_version_id: string | number | null;
};

export async function DELETE(request: Request, props: { params: Promise<{ orderId: string }> }) {
  const params = await props.params;
  try {
    const orderId = Number(params.orderId);
    if (!Number.isFinite(orderId)) {
      return NextResponse.json({ message: 'Neveljaven ID naročila.' }, { status: 400 });
    }

    const pool = await getPool();
    const client = await pool.connect();
    let order: OrderDeleteRow | null = null;
    let newlyDeleted = false;

    try {
      await client.query('BEGIN');
      const orderResult = await client.query(
        `
        select id, order_number, contact_name, customer_type, address_line1,
               address_line2, postal_code, city, country_code, created_at,
               deleted_at, source_quote_offer_version_id
        from orders
        where id = $1
        for update
        `,
        [orderId]
      );

      if (orderResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({ message: 'Naročilo ne obstaja.' }, { status: 404 });
      }

      order = orderResult.rows[0] as OrderDeleteRow;

      if (order.source_quote_offer_version_id !== null) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          {
            code: 'QUOTE_DERIVED_ORDER_DELETE_BLOCKED',
            message:
              'Naročila, ustvarjenega iz ponudbe, ni mogoče izbrisati. Uporabite ustrezen preklic ali zavrnitev, da se ohrani sled ponudbe.'
          },
          { status: 409 }
        );
      }

      if (!order.deleted_at) {
        const deletedAtResult = await client.query(
          'update orders set deleted_at = now() where id = $1 returning deleted_at',
          [orderId]
        );
        const deletedAt = deletedAtResult.rows[0]?.deleted_at;

        await client.query(
          `
          insert into deleted_archive_entries (
            item_type,
            order_id,
            label,
            deleted_at,
            expires_at,
            payload
          )
          values ($1, $2, $3, $4, $4::timestamptz + interval '90 days', $5::jsonb)
          `,
          [
            'order',
            orderId,
            `${order.order_number || `#${orderId}`} · ${order.contact_name || 'Naročilo'}`,
            deletedAt,
            JSON.stringify({
              orderNumber: order.order_number || `#${orderId}`,
              orderCreatedAt: order.created_at,
              customerName: order.contact_name || null,
              address: formatOrderRowAddress(order) || null,
              customerType: order.customer_type || null
            })
          ]
        );

        await client.query(
          `
          update deleted_archive_entries
          set expires_at = greatest(expires_at, $2::timestamptz + interval '90 days')
          where item_type = 'pdf'
            and order_id = $1
          `,
          [orderId, deletedAt]
        );
        newlyDeleted = true;
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    if (!order) {
      return NextResponse.json({ message: 'Naročilo ne obstaja.' }, { status: 404 });
    }

    if (!newlyDeleted) {
      revalidateAdminOrderPaths(orderId);
      return NextResponse.json({ success: true });
    }

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
