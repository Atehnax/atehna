import { NextResponse } from 'next/server';
import { getPool } from '@/shared/server/db';
import { processDueOrderEmailJobs } from '@/shared/server/orderEmailJobs';

export const dynamic = 'force-dynamic';

export async function POST() {
  if (process.env.E2E_MODE !== '1') {
    return new NextResponse(null, { status: 404 });
  }

  const result = await processDueOrderEmailJobs(await getPool(), {
    maxJobs: 25,
    deadlineMs: 5_000
  });
  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'private, no-store' }
  });
}
