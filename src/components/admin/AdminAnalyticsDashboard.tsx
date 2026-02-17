'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import PlotlyClient from '@/components/admin/charts/PlotlyClient';
import type { OrdersAnalyticsResponse } from '@/lib/server/orderAnalytics';

type RangeOption = '30d' | '90d' | '180d';

type Props = {
  initialData: OrdersAnalyticsResponse;
};

const movingAverage = (values: number[], window = 7) =>
  values.map((_, index) => {
    const start = Math.max(0, index - (window - 1));
    const series = values.slice(start, index + 1);
    return series.reduce((sum, value) => sum + value, 0) / Math.max(series.length, 1);
  });

const formatEur = (value: number) =>
  new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(value);

const chartLayoutBase = {
  autosize: true,
  paper_bgcolor: 'white',
  plot_bgcolor: 'white',
  margin: { l: 58, r: 24, t: 20, b: 52 },
  hovermode: 'x unified' as const,
  font: { family: 'Inter, ui-sans-serif, system-ui, sans-serif', size: 12, color: '#0f172a' },
  legend: { orientation: 'h' as const, x: 0, y: 1.15 },
  xaxis: {
    title: { text: 'Datum' },
    showgrid: true,
    gridcolor: 'rgba(100,116,139,0.14)',
    tickangle: -25
  },
  hoverlabel: { bgcolor: '#0f172a', font: { color: '#fff' } }
};

export default function AdminAnalyticsDashboard({ initialData }: Props) {
  const [data, setData] = useState<OrdersAnalyticsResponse>(initialData);
  const [range, setRange] = useState<RangeOption>(initialData.range);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/admin/analytics/orders?range=${range}&grouping=day`);
        if (!response.ok) return;
        const payload = (await response.json()) as OrdersAnalyticsResponse;
        if (!cancelled) setData(payload);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    if (range !== initialData.range) {
      void load();
    }

    return () => {
      cancelled = true;
    };
  }, [range, initialData.range]);

  const series = useMemo(() => {
    const dates = data.days.map((day) => day.date);
    const orderCount = data.days.map((day) => day.order_count);
    const revenue = data.days.map((day) => day.revenue_total);
    const aov = data.days.map((day) => day.aov);
    const leadP50 = data.days.map((day) => day.lead_time_p50_hours);
    const leadP90 = data.days.map((day) => day.lead_time_p90_hours);

    const statusKeys = Array.from(
      new Set(data.days.flatMap((day) => Object.keys(day.status_buckets))).values()
    );

    return {
      dates,
      orderCount,
      orderCountMA: movingAverage(orderCount, 7),
      revenue,
      revenueMA: movingAverage(revenue, 7),
      aov,
      leadP50,
      leadP90,
      statusKeys
    };
  }, [data]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Analitika naročil</h1>
          <p className="text-xs text-slate-500">Agregacija: {data.timezone}, dnevno. MA je jasno označen kot 7d MA.</p>
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 p-0.5">
          {(['30d', '90d', '180d'] as RangeOption[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setRange(option)}
              className={`rounded-md px-2 py-1 text-xs font-semibold ${
                option === range ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? <p className="text-xs text-slate-500">Nalagam analitiko…</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Naročila / dan + 7d MA" ariaLabel="Graf naročil na dan">
          <PlotlyClient
            data={[
              {
                type: 'bar',
                name: 'Naročila',
                x: series.dates,
                y: series.orderCount,
                marker: { color: '#0f766e', opacity: 0.65 },
                hovertemplate: 'Datum: %{x}<br>Naročila: %{y:d}<extra></extra>'
              },
              {
                type: 'scatter',
                mode: 'lines',
                name: '7d MA',
                x: series.dates,
                y: series.orderCountMA,
                line: { color: '#1e293b', width: 2 },
                hovertemplate: 'Datum: %{x}<br>7d MA: %{y:.2f}<extra></extra>'
              }
            ]}
            layout={{
              ...chartLayoutBase,
              yaxis: { title: { text: 'Število naročil' }, rangemode: 'tozero', showgrid: true, gridcolor: 'rgba(100,116,139,0.14)' }
            }}
            config={{ responsive: true }}
            useResizeHandler
            style={{ width: '100%', height: 340 }}
          />
        </ChartCard>

        <ChartCard title="Prihodki / dan + 7d MA" ariaLabel="Graf prihodkov na dan">
          <PlotlyClient
            data={[
              {
                type: 'bar',
                name: 'Prihodki',
                x: series.dates,
                y: series.revenue,
                marker: { color: '#0ea5e9', opacity: 0.65 },
                hovertemplate: 'Datum: %{x}<br>Prihodki: %{y:.2f} EUR<extra></extra>'
              },
              {
                type: 'scatter',
                mode: 'lines',
                name: '7d MA',
                x: series.dates,
                y: series.revenueMA,
                line: { color: '#0369a1', width: 2 },
                hovertemplate: 'Datum: %{x}<br>7d MA: %{y:.2f} EUR<extra></extra>'
              }
            ]}
            layout={{
              ...chartLayoutBase,
              yaxis: {
                title: { text: 'Prihodki (EUR)' },
                rangemode: 'tozero',
                tickprefix: '€ ',
                showgrid: true,
                gridcolor: 'rgba(100,116,139,0.14)'
              }
            }}
            config={{ responsive: true }}
            useResizeHandler
            style={{ width: '100%', height: 340 }}
          />
        </ChartCard>

        <ChartCard title="AOV / dan" ariaLabel="Graf povprečne vrednosti naročila">
          <PlotlyClient
            data={[
              {
                type: 'scatter',
                mode: 'lines+markers',
                name: 'AOV',
                x: series.dates,
                y: series.aov,
                marker: { color: '#7c3aed', size: 5 },
                line: { color: '#7c3aed', width: 2 },
                hovertemplate: 'Datum: %{x}<br>AOV: %{y:.2f} EUR<extra></extra>'
              }
            ]}
            layout={{
              ...chartLayoutBase,
              yaxis: { title: { text: 'AOV (EUR)' }, tickprefix: '€ ', showgrid: true, gridcolor: 'rgba(100,116,139,0.14)' }
            }}
            config={{ responsive: true }}
            useResizeHandler
            style={{ width: '100%', height: 340 }}
          />
        </ChartCard>

        <ChartCard title="Status mix skozi čas" ariaLabel="Sestava statusov skozi čas">
          <PlotlyClient
            data={series.statusKeys.map((status, index) => ({
              type: 'bar',
              name: status,
              x: series.dates,
              y: data.days.map((day) => day.status_buckets[status] ?? 0),
              hovertemplate: `Datum: %{x}<br>Status (${status}): %{y:d}<extra></extra>`,
              marker: { color: ['#0f766e', '#1e293b', '#0369a1', '#16a34a', '#f97316', '#a855f7'][index % 6] }
            }))}
            layout={{
              ...chartLayoutBase,
              barmode: 'stack',
              yaxis: { title: { text: 'Število naročil' }, rangemode: 'tozero', showgrid: true, gridcolor: 'rgba(100,116,139,0.14)' }
            }}
            config={{ responsive: true }}
            useResizeHandler
            style={{ width: '100%', height: 340 }}
          />
        </ChartCard>

        <ChartCard title="Fulfilment lead time p50 / p90" ariaLabel="Lead time p50 p90">
          <PlotlyClient
            data={[
              {
                type: 'scatter',
                mode: 'lines+markers',
                name: 'p50',
                x: series.dates,
                y: series.leadP50,
                line: { color: '#0f766e', width: 2 },
                hovertemplate: 'Datum: %{x}<br>p50: %{y:.2f} h<extra></extra>'
              },
              {
                type: 'scatter',
                mode: 'lines+markers',
                name: 'p90',
                x: series.dates,
                y: series.leadP90,
                line: { color: '#dc2626', width: 2 },
                hovertemplate: 'Datum: %{x}<br>p90: %{y:.2f} h<extra></extra>'
              }
            ]}
            layout={{
              ...chartLayoutBase,
              yaxis: { title: { text: 'Lead time (hours)' }, rangemode: 'tozero', showgrid: true, gridcolor: 'rgba(100,116,139,0.14)' }
            }}
            config={{ responsive: true }}
            useResizeHandler
            style={{ width: '100%', height: 340 }}
          />
        </ChartCard>

        <ChartCard title="Delež tipa kupca skozi čas (P/Š/F)" ariaLabel="Delež tipov kupcev skozi čas">
          <PlotlyClient
            data={(['P', 'Š', 'F'] as const).map((bucket, index) => ({
              type: 'scatter',
              mode: 'lines',
              stackgroup: 'customerType',
              groupnorm: 'percent',
              name: bucket,
              x: series.dates,
              y: data.days.map((day) => day.customer_type_buckets[bucket] ?? 0),
              hovertemplate: `Datum: %{x}<br>${bucket}: %{y:.2f}%<extra></extra>`,
              line: { color: ['#0f766e', '#0284c7', '#9333ea'][index], width: 1.5 }
            }))}
            layout={{
              ...chartLayoutBase,
              yaxis: { title: { text: 'Delež (%)' }, ticksuffix: '%', range: [0, 100], showgrid: true, gridcolor: 'rgba(100,116,139,0.14)' }
            }}
            config={{ responsive: true }}
            useResizeHandler
            style={{ width: '100%', height: 340 }}
          />
        </ChartCard>
      </div>

      <p className="text-xs text-slate-500">Prihodki skupaj v prikazu: {formatEur(series.revenue.reduce((sum, value) => sum + value, 0))}</p>
    </div>
  );
}

function ChartCard({
  title,
  children,
  ariaLabel
}: {
  title: string;
  children: ReactNode;
  ariaLabel: string;
}) {
  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
      role="region"
      aria-label={ariaLabel}
      tabIndex={0}
    >
      <h2 className="mb-2 text-sm font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}
