import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db';
function revalidateAdminOrderPaths(orderId?: number) {
  revalidatePath('/admin/orders');
  revalidatePath('/admin/arhiv-izbrisanih');
  if (typeof orderId === 'number' && Number.isFinite(orderId)) {
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath('/admin/orders/[orderId]', 'page');
  }
}



export async function POST() {
  try {
    const pool = await getPool();
    let result;

    try {
      result = await pool.query(
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
      returning id
      `
      );
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === '42703')) {
        throw error;
      }

      result = await pool.query(
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
          payment_status
        )
        select
          id,
          '#' || id,
          'company',
          'Osnutek',
          'draft@atehna.si',
          'received',
          'unpaid'
        from next_id
        returning id
        `
      );
    }

    const row = result.rows[0] as { id: number } | undefined;
    if (!row) {
      return NextResponse.json({ message: 'Osnutka ni bilo mogoče ustvariti.' }, { status: 500 });
    }

    revalidateAdminOrderPaths(row.id);
    return NextResponse.json({ orderId: row.id });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka na strežniku.' },
      { status: 500 }
    );
  }
}
