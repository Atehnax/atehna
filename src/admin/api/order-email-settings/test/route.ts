import { NextResponse } from 'next/server';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';
import { getOrderEmailSettings } from '@/shared/server/orderEmailSettings';
import {
  OrderEmailDeliveryError,
  sendOrderEmailTest
} from '@/shared/server/orderEmailJobs';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await readRequiredJsonRecord(request);
    if (!body.ok) return body.response;
    const config = body.body.config ?? await getOrderEmailSettings();
    const result = await sendOrderEmailTest(config, body.body.recipient);
    return NextResponse.json({
      success: true,
      providerMessageId: result.providerMessageId,
      message: 'Testna e-pošta je bila sprejeta v pošiljanje.'
    });
  } catch (error) {
    const status = error instanceof OrderEmailDeliveryError ? error.status : 500;
    return NextResponse.json(
      {
        message:
          error instanceof OrderEmailDeliveryError
            ? error.message
            : 'Pošiljanje testne e-pošte ni uspelo.'
      },
      { status }
    );
  }
}
