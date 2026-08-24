import { NextResponse } from 'next/server';
import { getPool } from '@/shared/server/db';
import {
  resetFailedOrderEmailJobs,
  scheduleOrderEmailJobs
} from '@/shared/server/orderEmailJobs';
import { getOrderEmailAdminState } from '@/shared/server/orderEmailSettings';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const pool = await getPool();
    const resetCount = await resetFailedOrderEmailJobs(pool);
    if (resetCount > 0) scheduleOrderEmailJobs(pool);
    return NextResponse.json({
      resetCount,
      state: await getOrderEmailAdminState()
    });
  } catch (error) {
    console.error('[orders.email-job] failed retry request', {
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      { message: 'Ponovni poskus pošiljanja ni uspel.' },
      { status: 500 }
    );
  }
}
