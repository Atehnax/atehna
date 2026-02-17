import { NextResponse } from 'next/server';
import {
  fetchGlobalAnalyticsAppearance,
  updateGlobalAnalyticsAppearance
} from '@/lib/server/analyticsCharts';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const appearance = await fetchGlobalAnalyticsAppearance('narocila');
    return NextResponse.json({ appearance });
  } catch (error) {
    console.error('Failed to fetch analytics appearance', error);
    return NextResponse.json({ message: 'Ni mogoče naložiti videza grafov.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const appearance = await updateGlobalAnalyticsAppearance(
      {
        sectionBg: typeof payload.sectionBg === 'string' ? payload.sectionBg : undefined,
        canvasBg: typeof payload.canvasBg === 'string' ? payload.canvasBg : undefined,
        cardBg: typeof payload.cardBg === 'string' ? payload.cardBg : undefined,
        plotBg: typeof payload.plotBg === 'string' ? payload.plotBg : undefined,
        axisTextColor: typeof payload.axisTextColor === 'string' ? payload.axisTextColor : undefined,
        seriesPalette: Array.isArray(payload.seriesPalette) ? payload.seriesPalette.filter((v): v is string => typeof v === 'string') : undefined,
        gridColor: typeof payload.gridColor === 'string' ? payload.gridColor : undefined,
        gridOpacity: Number.isFinite(Number(payload.gridOpacity)) ? Number(payload.gridOpacity) : undefined
      },
      'narocila'
    );

    return NextResponse.json({ appearance });
  } catch (error) {
    console.error('Failed to update analytics appearance', error);
    return NextResponse.json({ message: 'Shranjevanje videza ni uspelo.' }, { status: 500 });
  }
}
