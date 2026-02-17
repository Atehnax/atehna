import { NextResponse } from 'next/server';
import {
  deleteAnalyticsChart,
  updateAnalyticsChart,
  type AnalyticsChartConfig,
  type AnalyticsChartType
} from '@/lib/server/analyticsCharts';

export const dynamic = 'force-dynamic';

const parseChartType = (value: unknown): AnalyticsChartType | undefined => {
  const allowed: AnalyticsChartType[] = [
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
  return allowed.includes(value as AnalyticsChartType) ? (value as AnalyticsChartType) : undefined;
};

export async function PATCH(request: Request, { params }: { params: { chartId: string } }) {
  try {
    const chartId = Number(params.chartId);
    if (!Number.isFinite(chartId)) return NextResponse.json({ message: 'Neveljaven ID.' }, { status: 400 });

    const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const chart = await updateAnalyticsChart(chartId, {
      title: typeof payload.title === 'string' ? payload.title : undefined,
      description:
        typeof payload.description === 'string' || payload.description === null
          ? (payload.description as string | null)
          : undefined,
      comment:
        typeof payload.comment === 'string' || payload.comment === null
          ? (payload.comment as string | null)
          : undefined,
      chartType: parseChartType(payload.chartType),
      config: payload.config as AnalyticsChartConfig | undefined
    });

    if (!chart) return NextResponse.json({ message: 'Graf ni najden.' }, { status: 404 });
    return NextResponse.json({ chart });
  } catch (error) {
    console.error('Failed to update analytics chart', error);
    return NextResponse.json({ message: 'Posodobitev ni uspela.' }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: { chartId: string } }) {
  try {
    const chartId = Number(params.chartId);
    if (!Number.isFinite(chartId)) return NextResponse.json({ message: 'Neveljaven ID.' }, { status: 400 });
    const deleted = await deleteAnalyticsChart(chartId);
    if (!deleted) return NextResponse.json({ message: 'Graf ni bil izbrisan.' }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Failed to delete analytics chart', error);
    return NextResponse.json({ message: 'Brisanje ni uspelo.' }, { status: 500 });
  }
}
