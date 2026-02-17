import { NextResponse } from 'next/server';
import { revalidateAdminOrderPaths } from '@/lib/server/revalidateAdminOrders';
import { getPool } from '@/lib/server/db';


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
    const status = String(body?.status ?? '').trim();

    if (!status) {
      return NextResponse.json({ message: 'Status manjka.' }, { status: 400 });
    }

    const pool = await getPool();
    await pool.query('UPDATE orders SET status = $1 WHERE id = $2', [status, orderId]);

    revalidateAdminOrderPaths(orderId);
    return NextResponse.json({ status });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka na strežniku.' },
      { status: 500 }
    );
  }
}
