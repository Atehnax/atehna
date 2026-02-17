import { NextResponse } from 'next/server';
import {
  createAnalyticsChart,
  fetchAnalyticsCharts,
  fetchGlobalAnalyticsAppearance,
  type AnalyticsChartConfig,
  type AnalyticsChartType
} from '@/lib/server/analyticsCharts';

export const dynamic = 'force-dynamic';

const chartTypes: AnalyticsChartType[] = [
  'line',
  'spline',
  'area',
  'bar',
  'grouped_bar',
  'stacked_bar',
  'stacked_area',
  'scatter',
  'bubble',
  'histogram',
  'box',
  'heatmap',
  'waterfall',
  'combo'
];

const parseChartType = (value: unknown): AnalyticsChartType =>
  chartTypes.includes(value as AnalyticsChartType) ? (value as AnalyticsChartType) : 'line';

const fallbackConfig = (): AnalyticsChartConfig => ({
  dataset: 'orders_daily',
  xField: 'date',
  xTitle: 'Datum',
  xTickFormat: '',
  xDateFormat: '%Y-%m-%d',
  xScale: 'linear',
  yLeftTitle: 'Vrednost',
  yLeftScale: 'linear',
  yLeftTickFormat: '',
  yRightEnabled: false,
  yRightTitle: 'Vrednost (desno)',
  yRightScale: 'linear',
  yRightTickFormat: '',
  grain: 'day',
  quickRange: '90d',
  filters: { customerType: 'all', status: 'all', paymentStatus: 'all', includeNulls: true },
  series: []
});

const parseConfig = (value: unknown): AnalyticsChartConfig =>
  value && typeof value === 'object' ? (value as AnalyticsChartConfig) : fallbackConfig();

export async function GET() {
  try {
    const [charts, appearance] = await Promise.all([
      fetchAnalyticsCharts('narocila'),
      fetchGlobalAnalyticsAppearance('narocila')
    ]);
    return NextResponse.json({ charts, appearance });
  } catch (error) {
    console.error('Failed to fetch analytics charts', error);
    return NextResponse.json({ message: 'Ni mogoče naložiti grafov.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const title = typeof payload.title === 'string' ? payload.title.trim() : '';
    if (!title) return NextResponse.json({ message: 'Naslov je obvezen.' }, { status: 400 });

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
