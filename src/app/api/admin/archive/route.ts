import { NextResponse } from 'next/server';
import { fetchArchiveEntries, permanentlyDeleteArchiveEntries, restoreArchiveEntries } from '@/lib/server/deletedArchive';

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

export async function DELETE(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { ids?: number[] };
    const ids = Array.isArray(body.ids) ? body.ids.filter((id) => Number.isFinite(id)) : [];
    if (ids.length === 0) {
      return NextResponse.json({ message: 'Ni izbranih zapisov za trajni izbris.' }, { status: 400 });
    }

    const deletedCount = await permanentlyDeleteArchiveEntries(ids);
    return NextResponse.json({ success: true, deletedCount });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka na strežniku.' },
      { status: 500 }
    );
  }
}


export async function PATCH(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { ids?: number[] };
    const ids = Array.isArray(body.ids) ? body.ids.filter((id) => Number.isFinite(id)) : [];
    if (ids.length === 0) {
      return NextResponse.json({ message: 'Ni izbranih zapisov za obnovo.' }, { status: 400 });
    }

    const restoredCount = await restoreArchiveEntries(ids);
    return NextResponse.json({ success: true, restoredCount });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka na strežniku.' },
      { status: 500 }
    );
  }
}
