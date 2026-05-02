import { NextResponse } from 'next/server';
import {
  createAnalyticsChart,
  fetchAnalyticsCharts,
  fetchGlobalAnalyticsAppearance,
  type AnalyticsChartType
} from '@/shared/server/analyticsCharts';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';

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
    const body = await readRequiredJsonRecord(request);
    if (!body.ok) return body.response;
    const payload = body.body;
    const title = typeof payload.title === 'string' ? payload.title.trim() : '';
    if (!title) return NextResponse.json({ message: 'Naslov je obvezen.' }, { status: 400 });

    const chart = await createAnalyticsChart({
      dashboardKey: 'narocila',
      title,
      description: typeof payload.description === 'string' ? payload.description : null,
      comment: typeof payload.comment === 'string' ? payload.comment : null,
      chartType: parseChartType(payload.chartType),
      config: payload.config
    });

    return NextResponse.json({ chart }, { status: 201 });
  } catch (error) {
    console.error('Failed to create analytics chart', error);
    return NextResponse.json({ message: 'Graf ni bil ustvarjen.' }, { status: 500 });
  }
}
