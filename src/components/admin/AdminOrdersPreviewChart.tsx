'use client';

import { memo, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { Data, Layout } from 'plotly.js';
import PlotlyClient from '@/components/admin/charts/PlotlyClient';
import { getBaseChartLayout, getChartThemeFromCssVars } from '@/components/admin/charts/chartTheme';
import type { OrderRow } from '@/components/admin/adminOrdersTableUtils';
import type { AnalyticsGlobalAppearance } from '@/lib/server/analyticsCharts';

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
  `<span style="display:flex;justify-content:space-between;align-items:center;gap:10px;min-width:180px;"><span>${label}</span><span style="font-variant-numeric:tabular-nums;">%{y${valueFormat}}${suffix}</span></span><extra></extra>`;

const stat = (value: number, suffix = '') => `${Intl.NumberFormat('sl-SI', { maximumFractionDigits: 2 }).format(value)}${suffix}`;

const fallbackAppearance: AnalyticsGlobalAppearance = {
  sectionBg: '#f3f4f6',
  canvasBg: '#ffffff',
  cardBg: '#ffffff',
  plotBg: '#ffffff',
  axisTextColor: '#1f2937',
  seriesPalette: ['#2563eb', '#0ea5e9', '#14b8a6', '#f59e0b', '#ef4444'],
  gridColor: '#d1d5db',
  gridOpacity: 0.35
};

function AdminOrdersPreviewChart({
  orders,
  appearance = fallbackAppearance,
  fromDate,
  toDate
}: {
  orders: OrderRow[];
  appearance?: AnalyticsGlobalAppearance;
  fromDate?: string;
  toDate?: string;
}) {
  const router = useRouter();
  const chartTheme = getChartThemeFromCssVars();
  const layoutBase = getBaseChartLayout(chartTheme);

  const data = useMemo(() => {
    const selectedOrders = orders.filter((order) => {
      const timestamp = new Date(order.created_at).getTime();
      if (Number.isNaN(timestamp)) return false;
      if (fromDate) {
        const fromTs = new Date(`${fromDate}T00:00:00`).getTime();
        if (!Number.isNaN(fromTs) && timestamp < fromTs) return false;
      }
      if (toDate) {
        const toTs = new Date(`${toDate}T23:59:59.999`).getTime();
        if (!Number.isNaN(toTs) && timestamp > toTs) return false;
      }
      return true;
    });

    const allDates = selectedOrders
      .map((order) => new Date(order.created_at))
      .filter((date) => !Number.isNaN(date.getTime()))
      .map((date) => {
        date.setUTCHours(0, 0, 0, 0);
        return date;
      })
      .sort((a, b) => a.getTime() - b.getTime());

    const fallbackDate = new Date();
    fallbackDate.setUTCHours(0, 0, 0, 0);
    const start = allDates[0] ?? fallbackDate;
    const end = allDates[allDates.length - 1] ?? fallbackDate;

    const days = new Map<string, Daily>();
    const cursor = new Date(start);
    while (cursor.getTime() <= end.getTime()) {
      const key = cursor.toISOString().slice(0, 10);
      days.set(key, { date: key, orders: 0, revenue: 0, values: [], statuses: {} });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    selectedOrders.forEach((order) => {
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
        statusMix:
          (rows[rows.length - 1]?.statuses.received ?? 0) +
          (rows[rows.length - 1]?.statuses.in_progress ?? 0) +
          (rows[rows.length - 1]?.statuses.cancelled ?? 0)
      },
      statusTraces: [
        {
          status: 'received',
          color: appearance.seriesPalette[0] ?? chartTheme.series.primary,
          y: rows.map((row) => row.statuses.received ?? 0)
        },
        {
          status: 'in_progress',
          color: appearance.seriesPalette[2] ?? chartTheme.series.tertiary,
          y: rows.map((row) => row.statuses.in_progress ?? 0)
        },
        {
          status: 'cancelled',
          color: appearance.seriesPalette[4] ?? chartTheme.series.danger,
          y: rows.map((row) => row.statuses.cancelled ?? 0)
        }
      ]
    };
  }, [orders, appearance, fromDate, toDate, chartTheme.series.danger, chartTheme.series.primary, chartTheme.series.tertiary]);

  const miniLayout = (isStacked = false): Partial<Layout> => ({
    ...layoutBase,
    margin: { l: 8, r: 8, t: 8, b: 8 },
    showlegend: false,
    hovermode: 'x',
    paper_bgcolor: appearance.canvasBg,
    plot_bgcolor: appearance.plotBg,
    xaxis: { showgrid: false, showticklabels: false, zeroline: false, showline: false, fixedrange: true, hoverformat: '%Y-%m-%d' },
    yaxis: { showgrid: false, showticklabels: false, zeroline: false, showline: false, rangemode: 'tozero', fixedrange: true },
    barmode: isStacked ? 'stack' : undefined,
    hoverlabel: {
      bgcolor: appearance.canvasBg,
      bordercolor: appearance.gridColor,
      font: { color: appearance.axisTextColor, size: 11 },
      align: 'left'
    }
  });

  const charts: Array<{ key: string; focusKey: string; title: string; value: string; traces: Data[]; layout: Partial<Layout> }> = [
    {
      key: 'orders-ma',
      focusKey: 'narocila-orders-ma',
      title: 'Orders/day',
      value: stat(data.latest.orders),
      traces: [
        {
          type: 'scatter',
          mode: 'lines',
          name: 'Orders',
          x: data.x,
          y: data.ordersSeries,
          line: { color: appearance.seriesPalette[0], width: 1.8 },
          hovertemplate: compactHover('Orders', ':,.0f')
        },
        {
          type: 'scatter',
          mode: 'lines',
          name: 'MA',
          x: data.x,
          y: data.ordersMa,
          line: { color: appearance.seriesPalette[3], width: 1.4, dash: 'dot' },
          hoverinfo: 'skip'
        }
      ],
      layout: miniLayout(false)
    },
    {
      key: 'revenue-ma',
      focusKey: 'narocila-revenue-ma',
      title: 'Revenue/day',
      value: `${stat(data.latest.revenue)} €`,
      traces: [
        {
          type: 'scatter',
          mode: 'lines',
          name: 'Revenue',
          x: data.x,
          y: data.revenueSeries,
          line: { color: appearance.seriesPalette[1], width: 1.8 },
          hovertemplate: compactHover('Revenue', ':,.2f', ' EUR')
        },
        {
          type: 'scatter',
          mode: 'lines',
          name: 'MA',
          x: data.x,
          y: data.revenueMa,
          line: { color: appearance.seriesPalette[3], width: 1.4, dash: 'dot' },
          hoverinfo: 'skip'
        }
      ],
      layout: miniLayout(false)
    },
    {
      key: 'aov-median',
      focusKey: 'narocila-aov-median',
      title: 'AOV',
      value: `${stat(data.latest.aov)} €`,
      traces: [
        {
          type: 'scatter',
          mode: 'lines',
          name: 'AOV',
          x: data.x,
          y: data.aovSeries,
          line: { color: appearance.seriesPalette[2], width: 1.8 },
          hovertemplate: compactHover('AOV', ':,.2f', ' EUR')
        },
        {
          type: 'scatter',
          mode: 'lines',
          name: 'Median',
          x: data.x,
          y: data.medianSeries,
          line: { color: appearance.seriesPalette[4], width: 1.4, dash: 'dot' },
          hoverinfo: 'skip'
        }
      ],
      layout: miniLayout(false)
    },
    {
      key: 'status-mix',
      focusKey: 'narocila-status-mix',
      title: 'Status mix',
      value: stat(data.latest.statusMix),
      traces: data.statusTraces.map((trace) => ({
        type: 'bar',
        name: trace.status,
        x: data.x,
        y: trace.y,
        marker: { color: trace.color },
        hovertemplate: compactHover(trace.status, ':,.0f')
      })),
      layout: miniLayout(true)
    }
  ];

  return (
    <section
      className="mb-3 rounded-2xl border p-3 shadow-sm"
      style={{ backgroundColor: appearance.sectionBg, borderColor: appearance.gridColor }}
      aria-label="Orders analytics previews"
    >
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {charts.map((chart) => (
          <button
            key={chart.key}
            type="button"
            onClick={() => router.push(`/admin/analitika?view=narocila&focus=${encodeURIComponent(chart.focusKey)}`)}
            className="flex min-h-[110px] items-center justify-between rounded-xl border px-2 py-1.5 text-left transition hover:border-slate-400"
            style={{ backgroundColor: appearance.cardBg, borderColor: appearance.gridColor }}
          >
            <div className="flex h-full min-w-[88px] flex-col justify-center pr-2">
              <p className="text-[11px] font-medium" style={{ color: appearance.axisTextColor }}>
                {chart.title}
              </p>
              <p className="mt-1 text-lg font-semibold" style={{ color: appearance.axisTextColor }}>
                {chart.value}
              </p>
            </div>
            <div className="w-[145px]">
              <PlotlyClient
                data={chart.traces}
                layout={chart.layout}
                config={{ responsive: true, displayModeBar: false }}
                style={{ width: '100%', height: 105 }}
                useResizeHandler
              />
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

export default memo(AdminOrdersPreviewChart);
