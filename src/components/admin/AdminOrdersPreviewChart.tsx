'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { Data, Layout } from 'plotly.js';
import PlotlyClient from '@/components/admin/charts/PlotlyClient';
import { getBaseChartLayout, getChartThemeFromCssVars } from '@/components/admin/charts/chartTheme';
import type { OrderRow } from '@/components/admin/adminOrdersTableUtils';

type Daily = {
  date: string;
  orders: number;
  revenue: number;
  values: number[];
  statuses: Record<string, number>;
};

const movingAverage = (values: number[], window = 7) =>
  values.map((_, index) => {
    const start = Math.max(0, index - (window - 1));
    const slice = values.slice(start, index + 1);
    return slice.reduce((sum, value) => sum + value, 0) / Math.max(slice.length, 1);
  });

const median = (values: number[]) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
};

const valueLine = (label: string, format: string) => `${label}: %{y${format}}`;

export default function AdminOrdersPreviewChart({ orders }: { orders: OrderRow[] }) {
  const router = useRouter();
  const chartTheme = getChartThemeFromCssVars();
  const layoutBase = getBaseChartLayout(chartTheme);

  const data = useMemo(() => {
    const days = new Map<string, Daily>();
    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);

    for (let i = 89; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.set(key, { date: key, orders: 0, revenue: 0, values: [], statuses: {} });
    }

    orders.forEach((order) => {
      const key = new Date(order.created_at).toISOString().slice(0, 10);
      const day = days.get(key);
      if (!day) return;

      const total = typeof order.total === 'number' ? order.total : Number(order.total ?? 0);
      const safeTotal = Number.isFinite(total) ? total : 0;
      day.orders += 1;
      day.revenue += safeTotal;
      day.values.push(safeTotal);
      day.statuses[order.status] = (day.statuses[order.status] ?? 0) + 1;
    });

    const rows = Array.from(days.values());
    const x = rows.map((row) => row.date);
    const ordersSeries = rows.map((row) => row.orders);
    const revenueSeries = rows.map((row) => Number(row.revenue.toFixed(2)));

    return {
      x,
      ordersSeries,
      ordersMa: movingAverage(ordersSeries, 7),
      revenueSeries,
      revenueMa: movingAverage(revenueSeries, 7),
      aovSeries: rows.map((row) => (row.orders > 0 ? row.revenue / row.orders : 0)),
      medianSeries: rows.map((row) => median(row.values)),
      statusTraces: [
        { status: 'received', color: chartTheme.series.primary, y: rows.map((row) => row.statuses.received ?? 0) },
        { status: 'in_progress', color: chartTheme.series.tertiary, y: rows.map((row) => row.statuses.in_progress ?? 0) },
        { status: 'cancelled', color: chartTheme.series.danger, y: rows.map((row) => row.statuses.cancelled ?? 0) }
      ]
    };
  }, [orders, chartTheme.series.danger, chartTheme.series.primary, chartTheme.series.tertiary]);

  const charts: Array<{ key: string; focusKey: string; title: string; traces: Data[]; layout: Partial<Layout> }> = [
    {
      key: 'orders-ma',
      focusKey: 'narocila-orders-ma',
      title: 'Orders/day + 7d MA',
      traces: [
        { type: 'bar', name: 'Orders', x: data.x, y: data.ordersSeries, marker: { color: chartTheme.series.primary, opacity: 0.6 }, hovertemplate: `${valueLine('Orders', ':,.0f')}<extra></extra>` },
        { type: 'scatter', mode: 'lines', name: '7d MA', x: data.x, y: data.ordersMa, line: { color: chartTheme.series.secondary, width: 2 }, hovertemplate: `${valueLine('7d MA', ':,.2f')}<extra></extra>` }
      ],
      layout: {
        ...layoutBase,
        xaxis: { title: { text: 'Datum' }, tickfont: { color: chartTheme.mutedText }, gridcolor: chartTheme.grid, hoverformat: '%Y-%m-%d' },
        yaxis: { title: { text: 'Število naročil' }, tickfont: { color: chartTheme.mutedText }, gridcolor: chartTheme.grid, rangemode: 'tozero' },
        hovermode: 'x unified',
        showlegend: false
      }
    },
    {
      key: 'revenue-ma',
      focusKey: 'narocila-revenue-ma',
      title: 'Revenue/day + 7d MA',
      traces: [
        { type: 'bar', name: 'Revenue', x: data.x, y: data.revenueSeries, marker: { color: chartTheme.series.neutral, opacity: 0.6 }, hovertemplate: `${valueLine('Revenue', ':,.2f')} EUR<extra></extra>` },
        { type: 'scatter', mode: 'lines', name: '7d MA', x: data.x, y: data.revenueMa, line: { color: chartTheme.series.secondary, width: 2 }, hovertemplate: `${valueLine('7d MA', ':,.2f')} EUR<extra></extra>` }
      ],
      layout: {
        ...layoutBase,
        xaxis: { title: { text: 'Datum' }, tickfont: { color: chartTheme.mutedText }, gridcolor: chartTheme.grid, hoverformat: '%Y-%m-%d' },
        yaxis: { title: { text: 'Prihodki (EUR)' }, tickfont: { color: chartTheme.mutedText }, gridcolor: chartTheme.grid, rangemode: 'tozero' },
        showlegend: false
      }
    },
    {
      key: 'aov-median',
      focusKey: 'narocila-aov-median',
      title: 'AOV + median order value',
      traces: [
        { type: 'scatter', mode: 'lines', name: 'AOV', x: data.x, y: data.aovSeries, line: { color: chartTheme.series.tertiary, width: 2 }, hovertemplate: `${valueLine('AOV', ':,.2f')} EUR<extra></extra>` },
        { type: 'scatter', mode: 'lines', name: 'Median', x: data.x, y: data.medianSeries, line: { color: chartTheme.series.quaternary, width: 2 }, hovertemplate: `${valueLine('Median', ':,.2f')} EUR<extra></extra>` }
      ],
      layout: {
        ...layoutBase,
        xaxis: { title: { text: 'Datum' }, tickfont: { color: chartTheme.mutedText }, gridcolor: chartTheme.grid, hoverformat: '%Y-%m-%d' },
        yaxis: { title: { text: 'EUR' }, tickfont: { color: chartTheme.mutedText }, gridcolor: chartTheme.grid, rangemode: 'tozero' },
        showlegend: false
      }
    },
    {
      key: 'status-mix',
      focusKey: 'narocila-status-mix',
      title: 'Status mix over time',
      traces: data.statusTraces.map((trace) => ({ type: 'bar', name: trace.status, x: data.x, y: trace.y, marker: { color: trace.color }, hovertemplate: `${valueLine(trace.status, ':,.0f')}<extra></extra>` })),
      layout: {
        ...layoutBase,
        barmode: 'stack',
        xaxis: { title: { text: 'Datum' }, tickfont: { color: chartTheme.mutedText }, gridcolor: chartTheme.grid, hoverformat: '%Y-%m-%d' },
        yaxis: { title: { text: 'Število naročil' }, tickfont: { color: chartTheme.mutedText }, gridcolor: chartTheme.grid, rangemode: 'tozero' },
        showlegend: false
      }
    }
  ];

  return (
    <section className="mb-3 rounded-2xl border border-[var(--chart-border)] bg-[var(--chart-canvas)] p-3 shadow-sm" aria-label="Orders analytics previews">
      <div className="grid gap-3 md:grid-cols-2">
        {charts.map((chart) => (
          <button key={chart.key} type="button" onClick={() => router.push(`/admin/analitika?view=narocila&focus=${encodeURIComponent(chart.focusKey)}`)} className="rounded-xl border border-[var(--chart-border)] bg-[var(--chart-card)] p-2 text-left transition hover:border-cyan-500">
            <p className="mb-1 text-xs font-semibold text-[var(--chart-text)]">{chart.title}</p>
            <PlotlyClient
              data={chart.traces}
              layout={chart.layout}
              config={{ responsive: true, displayModeBar: false }}
              style={{ width: '100%', height: 210 }}
              useResizeHandler
            />
          </button>
        ))}
      </div>
    </section>
  );
}
