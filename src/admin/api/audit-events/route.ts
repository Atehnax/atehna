import { NextResponse } from 'next/server';
import { deleteAuditEventsByIds, fetchAuditEvents, normalizeAuditFilters } from '@/shared/server/audit';
import { isDatabaseUnavailableError } from '@/shared/server/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filters = normalizeAuditFilters({
      q: searchParams.get('q'),
      entity_type: searchParams.get('entity_type'),
      entity_id: searchParams.get('entity_id'),
      entity_query: searchParams.get('entity_query'),
      action: searchParams.get('action'),
      actor_id: searchParams.get('actor_id'),
      date_from: searchParams.get('date_from'),
      date_to: searchParams.get('date_to'),
      deletion_from: searchParams.get('deletion_from'),
      deletion_to: searchParams.get('deletion_to'),
      page: searchParams.get('page'),
      page_size: searchParams.get('page_size')
    });
    const result = await fetchAuditEvents(filters);
    return NextResponse.json(result);
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return NextResponse.json({
        events: [],
        total: 0,
        page: 1,
        pageSize: 25,
        pageCount: 1,
        warning: 'Dnevnika sprememb trenutno ni mogoče naložiti, ker baza ni dosegljiva.'
      });
    }
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka pri nalaganju dnevnika sprememb.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json().catch(() => null) as { eventIds?: unknown } | null;
    const eventIds = Array.isArray(body?.eventIds)
      ? body.eventIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
      : [];

    if (eventIds.length === 0) {
      return NextResponse.json({ message: 'Izberite vsaj en zapis za izbris.' }, { status: 400 });
    }

    const result = await deleteAuditEventsByIds(eventIds);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Brisanje zapisov ni uspelo.' },
      { status: 500 }
    );
  }
}
