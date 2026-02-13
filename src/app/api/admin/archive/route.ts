import { NextResponse } from 'next/server';
import { fetchArchiveEntries } from '@/lib/server/deletedArchive';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const typeParam = searchParams.get('type');
    const type = typeParam === 'order' || typeParam === 'pdf' ? typeParam : 'all';
    const entries = await fetchArchiveEntries(type);
    return NextResponse.json({ entries });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka na strežniku.' },
      { status: 500 }
    );
  }
}
