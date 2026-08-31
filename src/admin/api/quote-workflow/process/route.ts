import { NextResponse } from 'next/server';
import { getPool } from '@/shared/server/db';
import { isQuoteAdminEnabled } from '@/shared/server/quoteFeatureFlags';
import { processQuoteDocumentJobs } from '@/shared/server/quoteDocumentJobs';
import { processQuoteEmailJobs } from '@/shared/server/quoteEmailJobs';
import { expireDueQuoteOffers } from '@/shared/server/quoteLifecycleJobs';

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
  if (!isQuoteAdminEnabled()) {
    return NextResponse.json({ success: true, disabled: true });
  }
  try {
    const pool = await getPool();
    const expiry = await expireDueQuoteOffers(pool, { maximumOffers: 100 });
    const documents = await processQuoteDocumentJobs(pool, { maximumJobs: 10 });
    const email = await processQuoteEmailJobs(pool, { limit: 25 });
    return NextResponse.json({
      success: true,
      disabled: false,
      expiry,
      documents,
      email
    });
  } catch (error) {
    console.error('[quote-workflow] cron processing failed', {
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      { message: 'Obdelava ponudb ni uspela.' },
      { status: 500 }
    );
  }
}
