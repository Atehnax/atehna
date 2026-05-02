import { NextResponse } from 'next/server';
import { getOrderNumberAvailability } from '@/shared/server/orders';
import type { OrderNumberAvailabilityResult } from '@/shared/domain/order/orderTypes';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = Number(searchParams.get('orderId'));
    const value = searchParams.get('value') ?? '';

    if (!Number.isFinite(orderId)) {
      return NextResponse.json({ message: 'Neveljaven ID naročila.' }, { status: 400 });
    }

    const availability = await getOrderNumberAvailability(value, orderId);
    return NextResponse.json<OrderNumberAvailabilityResult>(availability);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka na strežniku.' },
      { status: 500 }
    );
  }
}
