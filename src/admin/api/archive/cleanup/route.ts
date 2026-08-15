import { NextResponse } from 'next/server';
import { cleanupExpiredArchiveEntries } from '@/shared/server/deletedArchive';
import { purgeExpiredCatalogItems } from '@/shared/server/catalogItems';

export async function POST(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get('authorization');

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ message: 'Nedovoljen dostop.' }, { status: 401 });
    }

    const purgedProductCount = await purgeExpiredCatalogItems();
    const deletedArchiveCount = await cleanupExpiredArchiveEntries();
    return NextResponse.json({
      success: true,
      deletedCount: purgedProductCount + deletedArchiveCount,
      purgedProductCount,
      deletedArchiveCount
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka na strežniku.' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ message: 'Nedovoljen dostop.' }, { status: 401 });
  }

  return POST(request);
}
