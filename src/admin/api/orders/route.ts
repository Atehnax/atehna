import { NextResponse } from 'next/server';
import { revalidateAdminOrderPaths } from '@/shared/server/revalidateAdminOrders';
import { getPool } from '@/shared/server/db';
import { insertAuditEventForRequest } from '@/shared/server/audit';


export async function POST(request: Request) {
  try {
    const pool = await getPool();

    const result = await pool.query(
      `
      with next_id as (
        select nextval('orders_id_seq') as id
      )
      insert into orders (
        id,
        order_number,
        customer_type,
        contact_name,
        email,
        status,
        payment_status,
        is_draft
      )
      select
        id,
        '#' || id,
        'company',
        'Osnutek',
        'draft@atehna.si',
        'received',
        'unpaid',
        true
      from next_id
      returning id, order_number
      `
    );

    const row = result.rows[0] as { id: number; order_number: string } | undefined;
    if (!row) {
      return NextResponse.json({ message: 'Osnutka ni bilo mogoče ustvariti.' }, { status: 500 });
    }

    await insertAuditEventForRequest(request, {
      entityType: 'order',
      entityId: String(row.id),
      entityLabel: `Naročilo ${row.order_number || `#${row.id}`}`,
      action: 'created',
      summary: `Naročilo ${row.order_number || `#${row.id}`}: dodano`,
      diff: {
        status: {
          label: 'Status naročila',
          before: 'prazno',
          after: 'received'
        },
        payment_status: {
          label: 'Plačilo',
          before: 'prazno',
          after: 'unpaid'
        }
      },
      metadata: {
        order_number: row.order_number || `#${row.id}`,
        is_draft: true
      }
    });

    revalidateAdminOrderPaths(row.id);
    return NextResponse.json({ orderId: row.id });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka na strežniku.' },
      { status: 500 }
    );
  }
}
