'use client';

import { memo, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { Data, Layout } from 'plotly.js';
import PlotlyClient from '@/components/admin/charts/PlotlyClient';
import { getBaseChartLayout, getChartThemeFromCssVars } from '@/components/admin/charts/chartTheme';
import type { OrderRow } from '@/components/admin/adminOrdersTableUtils';
import type { AnalyticsGlobalAppearance } from '@/lib/server/analyticsCharts';

type RangePreset = '7d' | '1m' | '3m' | '6m' | '1y' | 'ytd' | 'custom';
type CustomerBucketKey = 'company' | 'school' | 'individual';

type Daily = {
  date: string;
  orders: number;
  revenue: number;
  companyOrders: number;
  schoolOrders: number;
  individualOrders: number;
};

const rangeOptions: Array<{ key: Exclude<RangePreset, 'custom'>; label: string }> = [
  { key: '7d', label: '7d' },
  { key: '1m', label: '1m' },
  { key: '3m', label: '3m' },
  { key: '6m', label: '6m' },
  { key: '1y', label: '1y' },
  { key: 'ytd', label: 'YTD' }
];

const movingAverage = (values: number[], window = 7) =>
  values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - (window - 1)), i + 1);
    return slice.reduce((sum, value) => sum + value, 0) / Math.max(slice.length, 1);
  });

const movingAverageNullable = (values: Array<number | null>, window = 7) =>
  values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - (window - 1)), i + 1).filter((value): value is number => value !== null);
    if (slice.length === 0) return null;
    return slice.reduce((sum, value) => sum + value, 0) / slice.length;
  });

const cumulative = (values: number[]) => {
  let running = 0;
  return values.map((value) => {
    running += value;
    return running;
  });
};

const toCustomerBucket = (customerType: string): CustomerBucketKey => {
  const normalized = customerType.toLowerCase();
  if (normalized.includes('podjet') || normalized.includes('org') || normalized.includes('company') || normalized.includes('business')) {
    return 'company';
  }
  if (normalized.includes('šol') || normalized.includes('sol') || normalized.includes('school')) {
    return 'school';
  }
  return 'individual';
};

const compactHover = (valueToken: string, suffix = "") =>
  `<span style=\"display:block;min-width:180px;font-size:13px;font-weight:600;line-height:1.4;\">%{fullData.name}: ${valueToken}${suffix}</span>` +
  `<span style=\"display:block;margin-top:10px;font-size:12px;font-weight:500;line-height:1.4;\">Datum: %{x|%Y-%m-%d}</span><extra></extra>`;

const stat = (value: number, suffix = '') => `${Intl.NumberFormat('sl-SI', { maximumFractionDigits: 2 }).format(value)}${suffix}`;

const sevenDayChange = (series: Array<number | null>) => {
  if (series.length === 0) return null;
  const currentIndex = series.length - 1;
  const current = series[currentIndex];
  if (current === null || !Number.isFinite(current)) return null;

  for (let i = currentIndex - 7; i >= 0; i -= 1) {
    const previous = series[i];
    if (previous === null || !Number.isFinite(previous) || previous === 0) continue;
    return ((current - previous) / previous) * 100;
  }

  return null;
};

const formatDelta = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) {
    return { text: '7d: —', className: 'text-slate-500' };
  }

  const sign = value > 0 ? '+' : '';
  const className = value >= 0 ? 'text-emerald-700' : 'text-rose-700';
  return { text: `7d: ${sign}${value.toFixed(1)}%`, className };
};

const fallbackAppearance: AnalyticsGlobalAppearance = {
  sectionBg: '#f1f0ec',
  canvasBg: '#ffffff',
  cardBg: '#ffffff',
  plotBg: '#ffffff',
  axisTextColor: '#111827',
  seriesPalette: ['#65c8cc', '#5fb6ba', '#7a8f6a', '#b08968', '#a24a45'],
  gridColor: '#d8d6cf',
  gridOpacity: 0.35
};

function AdminOrdersPreviewChart({
  orders,
  appearance = fallbackAppearance,
  fromDate,
  toDate,
  activeRange = '1m',
  onRangeChange
}: {
  orders: OrderRow[];
  appearance?: AnalyticsGlobalAppearance;
  fromDate?: string;
  toDate?: string;
  activeRange?: RangePreset;
  onRangeChange?: (range: Exclude<RangePreset, 'custom'>) => void;
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

    const start = allDates[0] ?? (fromDate ? new Date(`${fromDate}T00:00:00`) : fallbackDate);
    const end = allDates[allDates.length - 1] ?? (toDate ? new Date(`${toDate}T00:00:00`) : fallbackDate);

    const days = new Map<string, Daily>();
    const cursor = new Date(start);
    while (cursor.getTime() <= end.getTime()) {
      const key = cursor.toISOString().slice(0, 10);
      days.set(key, {
        date: key,
        orders: 0,
        revenue: 0,
        companyOrders: 0,
        schoolOrders: 0,
        individualOrders: 0
      });
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

      const bucket = toCustomerBucket(order.customer_type);
      if (bucket === 'company') day.companyOrders += 1;
      if (bucket === 'school') day.schoolOrders += 1;
      if (bucket === 'individual') day.individualOrders += 1;
    });

    const rows = Array.from(days.values());
    const x = rows.map((row) => row.date);
    const ordersSeries = rows.map((row) => row.orders);
    const revenueSeries = rows.map((row) => Number(row.revenue.toFixed(2)));

    const dailyAov = rows.map((row) => (row.orders > 0 ? Number((row.revenue / row.orders).toFixed(2)) : null));
    const dailyAovMa = movingAverageNullable(dailyAov, 7);

    const totalOrders = ordersSeries.reduce((sum, value) => sum + value, 0);
    const totalRevenue = revenueSeries.reduce((sum, value) => sum + value, 0);
    const rangeAov = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const companyDaily = rows.map((row) => row.companyOrders);
    const schoolDaily = rows.map((row) => row.schoolOrders);
    const individualDaily = rows.map((row) => row.individualOrders);

    return {
      x,
      totalOrders,
      totalRevenue,
      rangeAov,
      ordersSeries,
      ordersMa: movingAverage(ordersSeries, 7),
      revenueSeries,
      revenueMa: movingAverage(revenueSeries, 7),
      dailyAov,
      dailyAovMa,
      companyCum: cumulative(companyDaily),
      schoolCum: cumulative(schoolDaily),
      individualCum: cumulative(individualDaily)
    };
  }, [orders, fromDate, toDate]);

  const miniLayout = (isAreaStacked = false): Partial<Layout> => ({
    ...layoutBase,
    margin: { l: 8, r: 8, t: 8, b: 8 },
    showlegend: false,
    hovermode: 'x unified',
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    xaxis: { showgrid: false, showticklabels: false, zeroline: false, showline: false, fixedrange: true, hoverformat: '%Y-%m-%d', rangeslider: { visible: true, thickness: 0.18, bgcolor: 'rgba(148,163,184,0.18)', bordercolor: 'rgba(148,163,184,0.35)', borderwidth: 1 } },
    yaxis: { showgrid: false, showticklabels: false, zeroline: false, showline: false, rangemode: 'tozero', fixedrange: true },
    hoverlabel: {
      bgcolor: '#f8f7fc',
      bordercolor: '#d8d6cf',
      font: { color: '#111827', size: 13, family: 'Inter, system-ui, sans-serif' },
      align: 'left'
    },
    barmode: isAreaStacked ? 'stack' : undefined
  });

  const charts: Array<{ key: string; focusKey: string; title: string; value: string; delta: string; deltaClassName: string; traces: Data[]; layout: Partial<Layout> }> = [
    {
      key: 'orders-ma',
      focusKey: 'narocila-orders-ma',
      title: 'Število naročil',
      value: stat(data.totalOrders),
      ...(() => {
        const delta = formatDelta(sevenDayChange(data.ordersSeries));
        return { delta: delta.text, deltaClassName: delta.className };
      })(),
      traces: [
        {
          type: 'scatter',
          mode: 'lines',
          name: 'Naročila / dan',
          x: data.x,
          y: data.ordersSeries,
          line: { color: appearance.seriesPalette[0], width: 1.9 },
          hovertemplate: compactHover('%{y:,.0f}')
        },
        {
          type: 'scatter',
          mode: 'lines',
          name: '7DMA',
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
      title: 'Prihodki',
      value: `${Intl.NumberFormat('sl-SI', { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(data.totalRevenue)} €`,
      ...(() => {
        const delta = formatDelta(sevenDayChange(data.revenueSeries));
        return { delta: delta.text, deltaClassName: delta.className };
      })(),
      traces: [
        {
          type: 'scatter',
          mode: 'lines',
          name: 'Prihodki / dan',
          x: data.x,
          y: data.revenueSeries,
          line: { color: appearance.seriesPalette[1], width: 1.9 },
          hovertemplate: compactHover('%{y:,.2f}', ' EUR')
        },
        {
          type: 'scatter',
          mode: 'lines',
          name: '7DMA',
          x: data.x,
          y: data.revenueMa,
          line: { color: appearance.seriesPalette[3], width: 1.4, dash: 'dot' },
          hoverinfo: 'skip'
        }
      ],
      layout: miniLayout(false)
    },
    {
      key: 'aov-ma',
      focusKey: 'narocila-aov-median',
      title: 'Povp. €/naročilo',
      value: `${stat(data.rangeAov)} €`,
      ...(() => {
        const delta = formatDelta(sevenDayChange(data.dailyAov));
        return { delta: delta.text, deltaClassName: delta.className };
      })(),
      traces: [
        {
          type: 'scatter',
          mode: 'lines',
          name: 'AOV / dan',
          x: data.x,
          y: data.dailyAov,
          line: { color: appearance.seriesPalette[2], width: 1.9 },
          connectgaps: false,
          hovertemplate: compactHover('%{y:,.2f}', ' EUR')
        },
        {
          type: 'scatter',
          mode: 'lines',
          name: '7DMA',
          x: data.x,
          y: data.dailyAovMa,
          line: { color: appearance.seriesPalette[4], width: 1.4, dash: 'dot' },
          connectgaps: false,
          hoverinfo: 'skip'
        }
      ],
      layout: miniLayout(false)
    },
    {
      key: 'customer-type-cumulative',
      focusKey: 'narocila-status-mix',
      title: 'F | P | Š',
      value: `${data.individualCum.at(-1) ?? 0} | ${data.companyCum.at(-1) ?? 0} | ${data.schoolCum.at(-1) ?? 0}`,
      ...(() => {
        const delta = formatDelta(sevenDayChange(data.companyCum.map((value, index) => value + data.schoolCum[index] + data.individualCum[index])));
        return { delta: delta.text, deltaClassName: delta.className };
      })(),
      traces: [
        {
          type: 'scatter',
          mode: 'lines',
          name: 'Šole',
          x: data.x,
          y: data.schoolCum,
          stackgroup: 'customers',
          fill: 'tozeroy',
          line: { color: appearance.seriesPalette[2], width: 1.2 },
          hovertemplate: compactHover('%{y:,.0f}')
        },
        {
          type: 'scatter',
          mode: 'lines',
          name: 'Podjetja',
          x: data.x,
          y: data.companyCum,
          stackgroup: 'customers',
          fill: 'tonexty',
          line: { color: appearance.seriesPalette[0], width: 1.2 },
          hovertemplate: compactHover('%{y:,.0f}')
        },
        {
          type: 'scatter',
          mode: 'lines',
          name: 'Fiz. os.',
          x: data.x,
          y: data.individualCum,
          stackgroup: 'customers',
          fill: 'tonexty',
          line: { color: appearance.seriesPalette[3], width: 1.2 },
          hovertemplate: compactHover('%{y:,.0f}')
        }
      ],
      layout: miniLayout(true)
    }
  ];

  return (
    <section className="mb-3" aria-label="Orders analytics previews">
      <div className="mb-2 flex min-h-[30px] items-center justify-end gap-3">
        <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5 text-[11px] shadow-sm">
          {rangeOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => onRangeChange?.(option.key)}
              className={`rounded px-2 py-0.5 transition ${activeRange === option.key ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {charts.map((chart) => (
          <button
            key={chart.key}
            type="button"
            onClick={() => router.push(`/admin/analitika?view=narocila&focus=${encodeURIComponent(chart.focusKey)}`)}
            className="flex min-h-[124px] items-center justify-between rounded-xl border px-3 py-2 text-left shadow-sm transition hover:border-slate-400"
            style={{ background: `linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(246,248,251,0.96) 100%)`, borderColor: appearance.gridColor }}
          >
            <div className="relative flex h-full min-w-[88px] flex-1 items-center justify-center pr-2 text-center">
              {chart.key === 'customer-type-cumulative' ? (
                <div className="w-full">
                  <p className="absolute left-0 top-0 whitespace-nowrap text-sm font-semibold tracking-wide text-[#111827]">{chart.title}</p>
                  <p className="whitespace-nowrap text-2xl font-bold leading-none text-[#111827]">{chart.value}</p>
                </div>
              ) : (
                <>
                  <p className="absolute left-0 top-0 whitespace-nowrap text-sm font-semibold tracking-wide" style={{ color: "#111827" }}>
                    {chart.title}
                  </p>
                  <p className="whitespace-nowrap text-2xl font-bold leading-none" style={{ color: "#111827" }}>
                    {chart.value}
                  </p>
                </>
              )}
              <p className={`absolute bottom-0 left-0 text-[11px] font-medium ${chart.deltaClassName}`}>{chart.delta}</p>
            </div>
            <div className="w-[190px] rounded-md" style={{ backgroundColor: 'transparent' }}>
              <PlotlyClient
                data={chart.traces}
                layout={chart.layout}
                config={{ responsive: true, displayModeBar: false }}
                style={{ width: '100%', height: 118 }}
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
