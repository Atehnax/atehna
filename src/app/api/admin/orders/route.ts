import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db';

export async function POST() {
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
      returning id
      `
    );

    const row = result.rows[0] as { id: number } | undefined;
    if (!row) {
      return NextResponse.json({ message: 'Osnutka ni bilo mogoče ustvariti.' }, { status: 500 });
    }

    return NextResponse.json({ orderId: row.id });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka na strežniku.' },
      { status: 500 }
    );
  }
}
