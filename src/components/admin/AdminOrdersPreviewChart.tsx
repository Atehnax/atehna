'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { Data, Layout } from 'plotly.js';
import PlotlyClient from '@/components/admin/charts/PlotlyClient';
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
  if (sorted.length % 2 === 0) return (sorted[middle - 1] + sorted[middle]) / 2;
  return sorted[middle];
};

const darkLayoutBase: Partial<Layout> = {
  autosize: true,
  paper_bgcolor: '#1e293b',
  plot_bgcolor: '#1e293b',
  margin: { l: 54, r: 20, t: 20, b: 50 },
  hovermode: 'x unified',
  font: { family: 'Inter, ui-sans-serif, system-ui, sans-serif', color: '#e2e8f0', size: 11 },
  legend: { orientation: 'h', x: 0, y: 1.18, font: { color: '#94a3b8', size: 10 } },
  hoverlabel: { bgcolor: '#0b1220', bordercolor: '#334155', font: { color: '#e2e8f0' } }
};

export default function AdminOrdersPreviewChart({ orders }: { orders: OrderRow[] }) {
  const router = useRouter();

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
      day.orders += 1;
      day.revenue += Number.isFinite(total) ? total : 0;
      day.values.push(Number.isFinite(total) ? total : 0);
      day.statuses[order.status] = (day.statuses[order.status] ?? 0) + 1;
    });

    const rows = Array.from(days.values());
    const x = rows.map((row) => row.date);
    const ordersSeries = rows.map((row) => row.orders);
    const revenueSeries = rows.map((row) => Number(row.revenue.toFixed(2)));
    const aovSeries = rows.map((row) => (row.orders > 0 ? row.revenue / row.orders : 0));
    const medianSeries = rows.map((row) => median(row.values));

    const statuses = ['received', 'in_progress', 'cancelled'];

    return {
      x,
      ordersSeries,
      ordersMa: movingAverage(ordersSeries, 7),
      revenueSeries,
      revenueMa: movingAverage(revenueSeries, 7),
      aovSeries,
      medianSeries,
      statusTraces: statuses.map((status, index) => ({
        status,
        color: ['#22d3ee', '#a78bfa', '#f59e0b'][index],
        y: rows.map((row) => row.statuses[status] ?? 0)
      }))
    };
  }, [orders]);

  const charts: Array<{
    key: string;
    focusKey: string;
    title: string;
    traces: Data[];
    layout: Partial<Layout>;
  }> = [
    {
      key: 'orders-ma',
      focusKey: 'narocila-orders-ma',
      title: 'Orders/day + 7d MA',
      traces: [
        {
          type: 'bar',
          name: 'Orders',
          x: data.x,
          y: data.ordersSeries,
          marker: { color: '#22d3ee', opacity: 0.72 },
          hovertemplate: 'Datum: %{x}<br>Orders: %{y:d}<extra></extra>'
        },
        {
          type: 'scatter',
          mode: 'lines',
          name: '7d MA',
          x: data.x,
          y: data.ordersMa,
          line: { color: '#f59e0b', width: 2 },
          hovertemplate: 'Datum: %{x}<br>7d MA: %{y:.2f}<extra></extra>'
        }
      ],
      layout: {
        ...darkLayoutBase,
        xaxis: { title: { text: 'Datum' }, tickfont: { color: '#94a3b8' }, gridcolor: 'rgba(148,163,184,0.18)' },
        yaxis: { title: { text: 'Število naročil' }, tickfont: { color: '#94a3b8' }, rangemode: 'tozero', gridcolor: 'rgba(148,163,184,0.18)' }
      }
    },
    {
      key: 'revenue-ma',
      focusKey: 'narocila-revenue-ma',
      title: 'Revenue/day + 7d MA',
      traces: [
        {
          type: 'bar',
          name: 'Revenue',
          x: data.x,
          y: data.revenueSeries,
          marker: { color: '#38bdf8', opacity: 0.72 },
          hovertemplate: 'Datum: %{x}<br>Revenue: %{y:.2f} EUR<extra></extra>'
        },
        {
          type: 'scatter',
          mode: 'lines',
          name: '7d MA',
          x: data.x,
          y: data.revenueMa,
          line: { color: '#f59e0b', width: 2 },
          hovertemplate: 'Datum: %{x}<br>7d MA: %{y:.2f} EUR<extra></extra>'
        }
      ],
      layout: {
        ...darkLayoutBase,
        xaxis: { title: { text: 'Datum' }, tickfont: { color: '#94a3b8' }, gridcolor: 'rgba(148,163,184,0.18)' },
        yaxis: { title: { text: 'Prihodki (EUR)' }, tickfont: { color: '#94a3b8' }, rangemode: 'tozero', gridcolor: 'rgba(148,163,184,0.18)' }
      }
    },
    {
      key: 'aov-median',
      focusKey: 'narocila-aov-median',
      title: 'AOV + median order value',
      traces: [
        {
          type: 'scatter',
          mode: 'lines+markers',
          name: 'AOV',
          x: data.x,
          y: data.aovSeries,
          line: { color: '#a78bfa', width: 2 },
          marker: { color: '#a78bfa', size: 4 },
          hovertemplate: 'Datum: %{x}<br>AOV: %{y:.2f} EUR<extra></extra>'
        },
        {
          type: 'scatter',
          mode: 'lines+markers',
          name: 'Median',
          x: data.x,
          y: data.medianSeries,
          line: { color: '#34d399', width: 2 },
          marker: { color: '#34d399', size: 4 },
          hovertemplate: 'Datum: %{x}<br>Median: %{y:.2f} EUR<extra></extra>'
        }
      ],
      layout: {
        ...darkLayoutBase,
        xaxis: { title: { text: 'Datum' }, tickfont: { color: '#94a3b8' }, gridcolor: 'rgba(148,163,184,0.18)' },
        yaxis: { title: { text: 'EUR' }, tickfont: { color: '#94a3b8' }, rangemode: 'tozero', gridcolor: 'rgba(148,163,184,0.18)' }
      }
    },
    {
      key: 'status-mix',
      focusKey: 'narocila-status-mix',
      title: 'Status mix over time',
      traces: data.statusTraces.map((statusTrace) => ({
        type: 'bar',
        name: statusTrace.status,
        x: data.x,
        y: statusTrace.y,
        marker: { color: statusTrace.color },
        hovertemplate: `Datum: %{x}<br>${statusTrace.status}: %{y:d}<extra></extra>`
      })),
      layout: {
        ...darkLayoutBase,
        barmode: 'stack',
        xaxis: { title: { text: 'Datum' }, tickfont: { color: '#94a3b8' }, gridcolor: 'rgba(148,163,184,0.18)' },
        yaxis: { title: { text: 'Število naročil' }, tickfont: { color: '#94a3b8' }, rangemode: 'tozero', gridcolor: 'rgba(148,163,184,0.18)' }
      }
    }
  ];

  return (
    <section className="mb-3 rounded-2xl border border-slate-700 bg-slate-900 p-3 shadow-sm" aria-label="Orders analytics previews">
      <div className="grid gap-3 md:grid-cols-2">
        {charts.map((chart) => (
          <button
            key={chart.key}
            type="button"
            onClick={() => router.push(`/admin/analitika?view=narocila&focus=${encodeURIComponent(chart.focusKey)}`)}
            className="rounded-xl border border-slate-700 bg-slate-800 p-2 text-left transition hover:border-cyan-500"
          >
            <p className="mb-1 text-xs font-semibold text-slate-200">{chart.title}</p>
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
