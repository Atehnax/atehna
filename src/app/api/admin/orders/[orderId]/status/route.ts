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
