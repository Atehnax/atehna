import { NextResponse } from 'next/server';
import { getPool } from '@/shared/server/db';
import {
  processDueOrderEmailJobs,
  pruneSentOrderEmailJobs
} from '@/shared/server/orderEmailJobs';
import { isOrderEmailSchemaReady } from '@/shared/server/orderEmailSettings';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (
    !cronSecret ||
    request.headers.get('authorization') !== `Bearer ${cronSecret}`
  ) {
    return NextResponse.json({ message: 'Nedovoljen dostop.' }, { status: 401 });
  }

  try {
    const pool = await getPool();
    if (!(await isOrderEmailSchemaReady(pool))) {
      return NextResponse.json({
        success: true,
        claimed: 0,
        sent: 0,
        retried: 0,
        failed: 0,
        disabled: true,
        pruned: 0
      });
    }
    const result = await processDueOrderEmailJobs(pool, {
      maxJobs: 100,
      deadlineMs: 45_000
    });
    const pruned = await pruneSentOrderEmailJobs(pool, { retentionDays: 30 });
    return NextResponse.json({ success: true, ...result, pruned });
  } catch (error) {
    console.error('[orders.email-job] cron processing failed', {
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      { message: 'Obdelava čakalne vrste e-pošte ni uspela.' },
      { status: 500 }
    );
  }
}
