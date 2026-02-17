'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import PlotlyClient from '@/components/admin/charts/PlotlyClient';
import type { OrderRow } from '@/components/admin/adminOrdersTableUtils';

type RangeOption = '30d' | '90d' | '180d';

const rangeDays: Record<RangeOption, number> = {
  '30d': 30,
  '90d': 90,
  '180d': 180
};

const movingAverage = (values: number[], window = 7) =>
  values.map((_, index) => {
    const start = Math.max(0, index - (window - 1));
    const slice = values.slice(start, index + 1);
    const sum = slice.reduce((acc, value) => acc + value, 0);
    return sum / slice.length;
  });

const ymdUtc = (iso: string) => {
  const timestamp = new Date(iso).getTime();
  if (Number.isNaN(timestamp)) return null;
  return new Date(timestamp).toISOString().slice(0, 10);
};

export default function AdminOrdersPreviewChart({ orders }: { orders: OrderRow[] }) {
  const router = useRouter();
  const [range, setRange] = useState<RangeOption>('90d');

  const chartData = useMemo(() => {
    const dayCount = rangeDays[range];
    const end = new Date();
    end.setUTCHours(0, 0, 0, 0);
    const start = new Date(end.getTime() - (dayCount - 1) * 24 * 60 * 60 * 1000);

    const dayKeys: string[] = [];
    const counts = new Map<string, number>();

    for (let index = 0; index < dayCount; index += 1) {
      const date = new Date(start.getTime() + index * 24 * 60 * 60 * 1000);
      const key = date.toISOString().slice(0, 10);
      dayKeys.push(key);
      counts.set(key, 0);
    }

    orders.forEach((order) => {
      const key = ymdUtc(order.created_at);
      if (!key || !counts.has(key)) return;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    const values = dayKeys.map((key) => counts.get(key) ?? 0);
    const ma7 = movingAverage(values, 7);

    return { dayKeys, values, ma7 };
  }, [orders, range]);

  const navigateToAnalytics = () => {
    router.push('/admin/analitika?view=narocila');
  };

  return (
    <section
      className="mb-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
      aria-label="Predogled analitike naročil"
      role="region"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          navigateToAnalytics();
        }
      }}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Naročila / dan (predogled)</h2>
        <div className="inline-flex rounded-lg border border-slate-200 p-0.5">
          {(['30d', '90d', '180d'] as RangeOption[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setRange(option)}
              className={`rounded-md px-2 py-1 text-xs font-semibold ${
                range === option ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div onClick={navigateToAnalytics} className="cursor-pointer" aria-label="Odpri podrobno analitiko naročil">
        <PlotlyClient
          data={[
            {
              type: 'bar',
              name: 'Naročila',
              x: chartData.dayKeys,
              y: chartData.values,
              marker: { color: '#0f766e', opacity: 0.65 },
              hovertemplate:
                'Datum: %{x}<br>Naročila: %{y:d}<br>7d MA: %{customdata:.2f}<extra></extra>',
              customdata: chartData.ma7
            },
            {
              type: 'scatter',
              mode: 'lines',
              name: '7d MA',
              x: chartData.dayKeys,
              y: chartData.ma7,
              line: { color: '#1e293b', width: 2 },
              hovertemplate: 'Datum: %{x}<br>7d MA: %{y:.2f}<extra></extra>'
            }
          ]}
          layout={{
            autosize: true,
            hovermode: 'x unified',
            margin: { l: 56, r: 24, t: 16, b: 52 },
            paper_bgcolor: 'white',
            plot_bgcolor: 'white',
            xaxis: {
              title: { text: 'Datum' },
              tickangle: -25,
              showgrid: true,
              gridcolor: 'rgba(100,116,139,0.14)'
            },
            yaxis: {
              title: { text: 'Število naročil' },
              rangemode: 'tozero',
              showgrid: true,
              gridcolor: 'rgba(100,116,139,0.14)'
            },
            legend: { orientation: 'h', x: 0, y: 1.15 },
            font: { family: 'Inter, ui-sans-serif, system-ui, sans-serif', size: 12, color: '#0f172a' },
            hoverlabel: { bgcolor: '#0f172a', font: { color: '#ffffff' } }
          }}
          config={{ responsive: true, displayModeBar: false }}
          style={{ width: '100%', height: 320 }}
          onClick={() => navigateToAnalytics()}
          useResizeHandler
        />
      </div>
    </section>
  );
}
