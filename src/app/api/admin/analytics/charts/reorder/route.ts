import { NextResponse } from 'next/server';
import { reorderAnalyticsCharts } from '@/lib/server/analyticsCharts';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as { ids?: unknown };
    const ids = Array.isArray(payload.ids)
      ? payload.ids.map((id) => Number(id)).filter((id) => Number.isFinite(id))
      : [];

    if (ids.length === 0) {
      return NextResponse.json({ message: 'Seznam ID-jev je prazen.' }, { status: 400 });
    }

    await reorderAnalyticsCharts(ids, 'narocila');
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Failed to reorder analytics charts', error);
    return NextResponse.json({ message: 'Razporeditev ni uspela.' }, { status: 500 });
  }
}
