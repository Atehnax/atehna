import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db';

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
    const result = await pool.query('DELETE FROM orders WHERE id = $1', [orderId]);

    if (result.rowCount === 0) {
      return NextResponse.json({ message: 'Naročilo ne obstaja.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka na strežniku.' },
      { status: 500 }
    );
  }
}
