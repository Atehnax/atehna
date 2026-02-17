import { NextResponse } from 'next/server';
import {
  createAnalyticsChart,
  fetchAnalyticsCharts,
  type AnalyticsChartConfig,
  type AnalyticsChartType
} from '@/lib/server/analyticsCharts';

export const dynamic = 'force-dynamic';

const parseChartType = (value: unknown): AnalyticsChartType =>
  value === 'bar' || value === 'area' ? value : 'line';

const parseConfig = (value: unknown): AnalyticsChartConfig => {
  if (!value || typeof value !== 'object') {
    return {
      dataset: 'orders_daily',
      xField: 'date',
      yFields: ['order_count'],
      filters: { customerType: 'all', status: 'all' },
      transforms: { movingAverage7d: false }
    };
  }
  return value as AnalyticsChartConfig;
};

export async function GET() {
  try {
    const charts = await fetchAnalyticsCharts('narocila');
    return NextResponse.json({ charts });
  } catch (error) {
    console.error('Failed to fetch analytics charts', error);
    return NextResponse.json({ message: 'Ni mogoče naložiti grafov.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const title = typeof payload.title === 'string' ? payload.title.trim() : '';
    if (!title) {
      return NextResponse.json({ message: 'Naslov je obvezen.' }, { status: 400 });
    }

    const chart = await createAnalyticsChart({
      dashboardKey: 'narocila',
      title,
      description: typeof payload.description === 'string' ? payload.description : null,
      comment: typeof payload.comment === 'string' ? payload.comment : null,
      chartType: parseChartType(payload.chartType),
      config: parseConfig(payload.config)
    });

    return NextResponse.json({ chart }, { status: 201 });
  } catch (error) {
    console.error('Failed to create analytics chart', error);
    return NextResponse.json({ message: 'Graf ni bil ustvarjen.' }, { status: 500 });
  }
}
