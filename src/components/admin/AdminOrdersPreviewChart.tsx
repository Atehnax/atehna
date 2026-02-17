'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { Data, Layout } from 'plotly.js';
import PlotlyClient from '@/components/admin/charts/PlotlyClient';
import { getBaseChartLayout, getChartThemeFromCssVars } from '@/components/admin/charts/chartTheme';
import type { OrderRow } from '@/components/admin/adminOrdersTableUtils';

type Daily = { date: string; orders: number; revenue: number; values: number[]; statuses: Record<string, number> };

const movingAverage = (values: number[], window = 7) =>
  values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - (window - 1)), i + 1);
    return slice.reduce((sum, value) => sum + value, 0) / Math.max(slice.length, 1);
  });

const median = (values: number[]) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
};

const compactHover = (label: string, valueFormat: string, suffix = '') =>
  '%{x|%Y-%m-%d}<br>' +
  `<span style="display:flex;justify-content:space-between;gap:10px;min-width:150px;"><span>${label}</span><span>%{y${valueFormat}}${suffix}</span></span><extra></extra>`;

const stat = (value: number, suffix = '') => `${Intl.NumberFormat('sl-SI', { maximumFractionDigits: 2 }).format(value)}${suffix}`;

export default function AdminOrdersPreviewChart({ orders }: { orders: OrderRow[] }) {
  const router = useRouter();
  const chartTheme = getChartThemeFromCssVars();
  const layoutBase = getBaseChartLayout(chartTheme);

  const data = useMemo(() => {
    const days = new Map<string, Daily>();
    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);

    for (let i = 29; i >= 0; i -= 1) {
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
    const aovSeries = rows.map((row) => (row.orders > 0 ? row.revenue / row.orders : 0));
    const medianSeries = rows.map((row) => median(row.values));

    return {
      x,
      ordersSeries,
      ordersMa: movingAverage(ordersSeries, 7),
      revenueSeries,
      revenueMa: movingAverage(revenueSeries, 7),
      aovSeries,
      medianSeries,
      latest: {
        orders: ordersSeries[ordersSeries.length - 1] ?? 0,
        revenue: revenueSeries[revenueSeries.length - 1] ?? 0,
        aov: aovSeries[aovSeries.length - 1] ?? 0,
        statusMix: (rows[rows.length - 1]?.statuses.received ?? 0) + (rows[rows.length - 1]?.statuses.in_progress ?? 0) + (rows[rows.length - 1]?.statuses.cancelled ?? 0)
      },
      statusTraces: [
        { status: 'received', color: chartTheme.series.primary, y: rows.map((row) => row.statuses.received ?? 0) },
        { status: 'in_progress', color: chartTheme.series.tertiary, y: rows.map((row) => row.statuses.in_progress ?? 0) },
        { status: 'cancelled', color: chartTheme.series.danger, y: rows.map((row) => row.statuses.cancelled ?? 0) }
      ]
    };
  }, [orders, chartTheme.series.danger, chartTheme.series.primary, chartTheme.series.tertiary]);

  const miniLayout = (isStacked = false): Partial<Layout> => ({
    ...layoutBase,
    margin: { l: 8, r: 8, t: 8, b: 8 },
    showlegend: false,
    hovermode: 'x',
    paper_bgcolor: chartTheme.card,
    plot_bgcolor: chartTheme.card,
    xaxis: { showgrid: false, showticklabels: false, zeroline: false, showline: false, fixedrange: true },
    yaxis: { showgrid: false, showticklabels: false, zeroline: false, showline: false, rangemode: 'tozero', fixedrange: true },
    barmode: isStacked ? 'stack' : undefined,
    hoverlabel: { bgcolor: chartTheme.tooltipBg, bordercolor: chartTheme.tooltipBorder, font: { color: chartTheme.text, size: 11 }, align: 'left' }
  });

  const charts: Array<{ key: string; focusKey: string; title: string; value: string; traces: Data[]; layout: Partial<Layout> }> = [
    {
      key: 'orders-ma', focusKey: 'narocila-orders-ma', title: 'Orders/day', value: stat(data.latest.orders),
      traces: [
        { type: 'scatter', mode: 'lines', name: 'Orders', x: data.x, y: data.ordersSeries, line: { color: chartTheme.series.primary, width: 1.8 }, hovertemplate: compactHover('Orders', ':,.0f') },
        { type: 'scatter', mode: 'lines', name: 'MA', x: data.x, y: data.ordersMa, line: { color: chartTheme.series.secondary, width: 1.4, dash: 'dot' }, hoverinfo: 'skip' }
      ],
      layout: miniLayout(false)
    },
    {
      key: 'revenue-ma', focusKey: 'narocila-revenue-ma', title: 'Revenue/day', value: `${stat(data.latest.revenue)} €`,
      traces: [
        { type: 'scatter', mode: 'lines', name: 'Revenue', x: data.x, y: data.revenueSeries, line: { color: chartTheme.series.neutral, width: 1.8 }, hovertemplate: compactHover('Revenue', ':,.2f', ' EUR') },
        { type: 'scatter', mode: 'lines', name: 'MA', x: data.x, y: data.revenueMa, line: { color: chartTheme.series.secondary, width: 1.4, dash: 'dot' }, hoverinfo: 'skip' }
      ],
      layout: miniLayout(false)
    },
    {
      key: 'aov-median', focusKey: 'narocila-aov-median', title: 'AOV', value: `${stat(data.latest.aov)} €`,
      traces: [
        { type: 'scatter', mode: 'lines', name: 'AOV', x: data.x, y: data.aovSeries, line: { color: chartTheme.series.tertiary, width: 1.8 }, hovertemplate: compactHover('AOV', ':,.2f', ' EUR') },
        { type: 'scatter', mode: 'lines', name: 'Median', x: data.x, y: data.medianSeries, line: { color: chartTheme.series.quaternary, width: 1.4, dash: 'dot' }, hoverinfo: 'skip' }
      ],
      layout: miniLayout(false)
    },
    {
      key: 'status-mix', focusKey: 'narocila-status-mix', title: 'Status mix', value: stat(data.latest.statusMix),
      traces: data.statusTraces.map((trace) => ({ type: 'bar', name: trace.status, x: data.x, y: trace.y, marker: { color: trace.color }, hovertemplate: compactHover(trace.status, ':,.0f') })),
      layout: miniLayout(true)
    }
  ];

  return (
    <section className="mb-3 rounded-2xl border border-[var(--chart-border)] bg-[var(--chart-canvas)] p-3 shadow-sm" aria-label="Orders analytics previews">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {charts.map((chart) => (
          <button key={chart.key} type="button" onClick={() => router.push(`/admin/analitika?view=narocila&focus=${encodeURIComponent(chart.focusKey)}`)} className="flex min-h-[110px] items-center justify-between rounded-xl border border-[var(--chart-border)] bg-[var(--chart-card)] px-2 py-1.5 text-left transition hover:border-cyan-500">
            <div className="flex h-full min-w-[88px] flex-col justify-center pr-2">
              <p className="text-[11px] font-medium text-slate-300">{chart.title}</p>
              <p className="mt-1 text-lg font-semibold text-[var(--chart-text)]">{chart.value}</p>
            </div>
            <div className="w-[145px]">
              <PlotlyClient data={chart.traces} layout={chart.layout} config={{ responsive: true, displayModeBar: false }} style={{ width: '100%', height: 105 }} useResizeHandler />
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
