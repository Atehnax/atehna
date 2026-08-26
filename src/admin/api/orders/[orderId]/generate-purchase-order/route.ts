import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      code: 'PURCHASE_ORDER_UPLOAD_ONLY',
      message:
        'Naročilnice ni mogoče ustvariti. Naloži jo lahko šola ali administrator.'
    },
    { status: 405 }
  );
}
