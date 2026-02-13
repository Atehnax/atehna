import { NextResponse } from 'next/server';
import { cleanupExpiredArchiveEntries } from '@/lib/server/deletedArchive';

export async function POST(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get('authorization');

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ message: 'Nedovoljen dostop.' }, { status: 401 });
    }

    const deletedCount = await cleanupExpiredArchiveEntries();
    return NextResponse.json({ success: true, deletedCount });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka na strežniku.' },
      { status: 500 }
    );
  }
}
