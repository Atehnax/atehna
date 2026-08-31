import { NextResponse } from 'next/server';
import { isDatabaseUnavailableError } from '@/shared/server/db';
import { fetchCustomerDirectoryRowForOrder } from '@/shared/server/customerDirectory';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  props: { params: Promise<{ orderId: string }> }
) {
  const { orderId: rawOrderId } = await props.params;
  const orderId = Number(rawOrderId);
  if (!Number.isSafeInteger(orderId) || orderId <= 0) {
    return NextResponse.json(
      { message: 'Neveljaven ID naročila.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const customer = await fetchCustomerDirectoryRowForOrder(orderId);
    if (!customer) {
      return NextResponse.json(
        { message: 'Stranka za to naročilo ni bila najdena.', customer: null },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    return NextResponse.json(
      { customer },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    const status = isDatabaseUnavailableError(error) ? 503 : 500;
    return NextResponse.json(
      { message: 'Podatkov o stranki trenutno ni mogoče naložiti.' },
      { status, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
