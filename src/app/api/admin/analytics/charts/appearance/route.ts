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
        canvasBg: typeof payload.canvasBg === 'string' ? payload.canvasBg : undefined,
        cardBg: typeof payload.cardBg === 'string' ? payload.cardBg : undefined,
        plotBg: typeof payload.plotBg === 'string' ? payload.plotBg : undefined,
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
