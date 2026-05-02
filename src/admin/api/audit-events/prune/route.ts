import { NextResponse } from 'next/server';
import { pruneExpiredAuditEvents } from '@/shared/server/audit';

async function handlePrune(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get('authorization');

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ message: 'Nedovoljen dostop.' }, { status: 401 });
    }

    const deletedCount = await pruneExpiredAuditEvents();
    return NextResponse.json({ success: true, deletedCount });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka pri čiščenju dnevnika sprememb.' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return handlePrune(request);
}

export async function POST(request: Request) {
  return handlePrune(request);
}
