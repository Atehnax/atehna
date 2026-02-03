import { NextResponse } from 'next/server';
import { updateOrderStatus } from '@/lib/server/orders';

export async function POST(request: Request, context: { params: { orderId: string } }) {
  const formData = await request.formData();
  const action = String(formData.get('action') ?? '');
  const reason = formData.get('reason') ? String(formData.get('reason')) : null;

  const orderId = context.params.orderId;

  switch (action) {
    case 'mark_paid':
      await updateOrderStatus(orderId, 'paid');
      break;
    case 'flag':
      await updateOrderStatus(orderId, 'flagged', reason ?? 'Označeno za pregled.');
      break;
    case 'cancel':
      await updateOrderStatus(orderId, 'cancelled', reason ?? 'Preklicano.');
      break;
    default:
      return NextResponse.json({ error: 'Neveljavno dejanje.' }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
