'use client';

import { memo, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import type { Data, Layout } from 'plotly.js';
import PlotlyClient from '@/components/admin/charts/PlotlyClient';
import { getBaseChartLayout, getChartThemeFromCssVars } from '@/components/admin/charts/chartTheme';
import type { OrderRow } from '@/components/admin/adminOrdersTableUtils';
import type { AnalyticsGlobalAppearance } from '@/lib/server/analyticsCharts';
import { formatLjubljanaDate } from '@/lib/format/dateTime';

type RangePreset = '7d' | '1m' | '3m' | '6m' | '1y' | 'ytd' | 'max' | 'custom';
type CustomerBucketKey = 'company' | 'school' | 'individual';

type Daily = {
  date: string;
  orders: number;
  revenue: number;
  companyOrders: number;
  schoolOrders: number;
  individualOrders: number;
};

type TooltipRow = { label: string; value: string; color: string; numericValue: number | null };
type HoverCard = { xLabel: string; rows: TooltipRow[]; left: number; top: number };

type ChartCard = {
  key: string;
  focusKey: string;
  title: string;
  value: string;
  delta: string;
  deltaClassName: string;
  traces: Data[];
  layout: Partial<Layout>;
  tooltipRowsAt: (index: number) => TooltipRow[];
  enforceTopDownTooltipOrder?: boolean;
};

const sortRowsTopToBottom = (rows: TooltipRow[]) =>
  [...rows].sort((a, b) => {
    const aValue = a.numericValue;
    const bValue = b.numericValue;
    const aValid = aValue !== null && Number.isFinite(aValue);
    const bValid = bValue !== null && Number.isFinite(bValue);
    if (aValid && bValid) {
      return (bValue as number) - (aValue as number);
    }
    if (aValid) return -1;
    if (bValid) return 1;
    return 0;
  });

const rangeOptions: Array<{ key: Exclude<RangePreset, 'custom'>; label: string }> = [
  { key: '7d', label: '7d' },
  { key: '1m', label: '1m' },
  { key: '3m', label: '3m' },
  { key: '6m', label: '6m' },
  { key: '1y', label: '1y' },
  { key: 'ytd', label: 'YTD' },
  { key: 'max', label: 'MAX' }
];


const movingAverage = (values: number[], window = 7) =>
  values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - (window - 1)), i + 1);
    return slice.reduce((sum, value) => sum + value, 0) / Math.max(slice.length, 1);
  });

const movingAverageNullable = (values: Array<number | null>, window = 7) =>
  values.map((_, i) => {
    const slice = values
      .slice(Math.max(0, i - (window - 1)), i + 1)
      .filter((value): value is number => value !== null);
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
  if (
    normalized.includes('podjet') ||
    normalized.includes('org') ||
    normalized.includes('company') ||
    normalized.includes('business')
  ) {
    return 'company';
  }
  if (normalized.includes('šol') || normalized.includes('sol') || normalized.includes('school')) {
    return 'school';
  }
  return 'individual';
};

const stat = (value: number, suffix = '') =>
  `${Intl.NumberFormat('sl-SI', { maximumFractionDigits: 2 }).format(value)}${suffix}`;

const formatInt = (value: number | null | undefined) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? '—'
    : Intl.NumberFormat('sl-SI', { maximumFractionDigits: 0 }).format(value);

const formatCurrency = (value: number | null | undefined) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? '—'
    : `${Intl.NumberFormat('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} EUR`;

const periodChange = (series: Array<number | null>, lookbackDays: number) => {
  if (series.length === 0) return null;
  const currentIndex = series.length - 1;
  const current = series[currentIndex];
  if (current === null || !Number.isFinite(current)) return null;

  for (let i = currentIndex - lookbackDays; i >= 0; i -= 1) {
    const previous = series[i];
    if (previous === null || !Number.isFinite(previous) || previous === 0) continue;
    return ((current - previous) / previous) * 100;
  }

  return null;
};

const formatDeltaPair = (sevenDay: number | null, thirtyDay: number | null) => {
  const fmt = (label: string, value: number | null) => {
    if (value === null || !Number.isFinite(value)) return `${label}: —`;
    const sign = value > 0 ? '+' : '';
    return `${label}: ${sign}${value.toFixed(1)}%`;
  };

  if ((sevenDay === null || !Number.isFinite(sevenDay)) && (thirtyDay === null || !Number.isFinite(thirtyDay))) {
    return { text: `${fmt('7d', sevenDay)}   ${fmt('30d', thirtyDay)}`, className: 'text-slate-500' };
  }

  const reference = sevenDay ?? thirtyDay ?? 0;
  const className = reference >= 0 ? 'text-emerald-700' : 'text-rose-700';
  return { text: `${fmt('7d', sevenDay)}   ${fmt('30d', thirtyDay)}`, className };
};


const formatTooltipDate = (value: string) => formatLjubljanaDate(value);


const readCssVarColor = (name: string, fallback: string) => {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
};

const toRgba = (hex: string, alpha: number) => {
  const clean = hex.replace('#', '').trim();
  const normalized =
    clean.length === 3
      ? clean
          .split('')
          .map((char) => `${char}${char}`)
          .join('')
      : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return hex;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

const fallbackAppearance: AnalyticsGlobalAppearance = {
  sectionBg: '#f1f0ec',
  canvasBg: '#ffffff',
  cardBg: '#ffffff',
  plotBg: '#ffffff',
  axisTextColor: '#111827',
  seriesPalette: ['#3e67d6', '#059669', '#a16207', '#3e67d6', '#3e67d6'],
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
  const [hoverCards, setHoverCards] = useState<Record<string, HoverCard>>({});

  const semanticChartColors = useMemo(() => {
    const info = readCssVarColor('--semantic-info', '#3e67d6');
    const success = readCssVarColor('--semantic-success', '#059669');
    const warning = readCssVarColor('--semantic-warning', '#a16207');

    return {
      orders: {
        line: info,
        fill: toRgba(info, 0.24)
      },
      revenue: {
        line: success,
        fill: toRgba(success, 0.24)
      },
      avgOrderValue: {
        line: warning,
        fill: toRgba(warning, 0.24)
      },
      customerStack: {
        totalFill: 'rgba(148, 163, 184, 0.3)',
        totalBorder: 'rgba(100, 116, 139, 0.85)',
        individual: toRgba(info, 0.8),
        company: toRgba(success, 0.8),
        school: toRgba(warning, 0.8)
      }
    };
  }, []);

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
    const totalDaily = rows.map((row) => row.companyOrders + row.schoolOrders + row.individualOrders);

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
      companyDaily,
      schoolDaily,
      individualDaily,
      totalDaily
    };
  }, [orders, fromDate, toDate]);

  const miniLayout = (isAreaStacked = false): Partial<Layout> => ({
    ...layoutBase,
    margin: { l: 8, r: 8, t: 8, b: 8 },
    showlegend: false,
    hovermode: 'x unified',
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    xaxis: {
      showgrid: false,
      showticklabels: false,
      zeroline: false,
      showline: false,
      fixedrange: true,
      hoverformat: '%Y-%m-%d',
      rangeslider: {
        visible: true,
        thickness: 0.18,
        bgcolor: 'rgba(148,163,184,0.18)',
        bordercolor: 'rgba(148,163,184,0.35)',
        borderwidth: 1
      }
    },
    yaxis: { showgrid: false, showticklabels: false, zeroline: false, showline: false, rangemode: 'tozero', fixedrange: true },
    barmode: isAreaStacked ? 'stack' : undefined
  });

  const charts: ChartCard[] = [
    {
      key: 'orders-ma',
      focusKey: 'narocila-orders-ma',
      title: 'Število naročil',
      value: stat(data.totalOrders),
      ...(() => {
        const delta = formatDeltaPair(periodChange(data.ordersSeries, 7), periodChange(data.ordersSeries, 30));
        return { delta: delta.text, deltaClassName: delta.className };
      })(),
      traces: [
        {
          type: 'bar',
          name: 'Število naročil',
          x: data.x,
          y: data.ordersSeries,
          marker: { color: semanticChartColors.orders.fill },
          hoverinfo: 'none'
        },
        {
          type: 'scatter',
          mode: 'lines',
          name: '7d MA',
          x: data.x,
          y: data.ordersMa,
          line: { color: semanticChartColors.orders.line, width: 2.1 },
          hoverinfo: 'none'
        }
      ],
      tooltipRowsAt: (i) => [
        { label: 'Število naročil', value: formatInt(data.ordersSeries[i]), color: semanticChartColors.orders.fill, numericValue: data.ordersSeries[i] ?? null },
        { label: '7d MA', value: formatInt(data.ordersMa[i]), color: semanticChartColors.orders.line, numericValue: data.ordersMa[i] ?? null }
      ],
      enforceTopDownTooltipOrder: true,
      layout: miniLayout(false)
    },
    {
      key: 'revenue-ma',
      focusKey: 'narocila-revenue-ma',
      title: 'Prihodki',
      value: `${Intl.NumberFormat('sl-SI', { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(data.totalRevenue)} €`,
      ...(() => {
        const delta = formatDeltaPair(periodChange(data.revenueSeries, 7), periodChange(data.revenueSeries, 30));
        return { delta: delta.text, deltaClassName: delta.className };
      })(),
      traces: [
        {
          type: 'bar',
          name: 'Prihodki',
          x: data.x,
          y: data.revenueSeries,
          marker: { color: semanticChartColors.revenue.fill },
          hoverinfo: 'none'
        },
        {
          type: 'scatter',
          mode: 'lines',
          name: '7d MA',
          x: data.x,
          y: data.revenueMa,
          line: { color: semanticChartColors.revenue.line, width: 2.1 },
          hoverinfo: 'none'
        }
      ],
      tooltipRowsAt: (i) => [
        { label: 'Prihodki', value: formatCurrency(data.revenueSeries[i]), color: semanticChartColors.revenue.fill, numericValue: data.revenueSeries[i] ?? null },
        { label: '7d MA', value: formatCurrency(data.revenueMa[i]), color: semanticChartColors.revenue.line, numericValue: data.revenueMa[i] ?? null }
      ],
      enforceTopDownTooltipOrder: true,
      layout: miniLayout(false)
    },
    {
      key: 'aov-ma',
      focusKey: 'narocila-aov-median',
      title: 'Povp. €/naročilo',
      value: `${stat(data.rangeAov)} €`,
      ...(() => {
        const delta = formatDeltaPair(periodChange(data.dailyAov, 7), periodChange(data.dailyAov, 30));
        return { delta: delta.text, deltaClassName: delta.className };
      })(),
      traces: [
        {
          type: 'bar',
          name: 'Povp. €/naročilo',
          x: data.x,
          y: data.dailyAov,
          marker: { color: semanticChartColors.avgOrderValue.fill },
          connectgaps: false,
          hoverinfo: 'none'
        },
        {
          type: 'scatter',
          mode: 'lines',
          name: '7d MA',
          x: data.x,
          y: data.dailyAovMa,
          line: { color: semanticChartColors.avgOrderValue.line, width: 2.1 },
          connectgaps: false,
          hoverinfo: 'none'
        }
      ],
      tooltipRowsAt: (i) => [
        { label: 'Povp. €/naročilo', value: formatCurrency(data.dailyAov[i]), color: semanticChartColors.avgOrderValue.fill, numericValue: data.dailyAov[i] ?? null },
        { label: '7d MA', value: formatCurrency(data.dailyAovMa[i]), color: semanticChartColors.avgOrderValue.line, numericValue: data.dailyAovMa[i] ?? null }
      ],
      enforceTopDownTooltipOrder: true,
      layout: miniLayout(false)
    },
    {
      key: 'customer-type-cumulative',
      focusKey: 'narocila-status-mix',
      title: 'F | P | Š',
      value: `${data.individualDaily.reduce((sum, value) => sum + value, 0)}  |  ${data.companyDaily.reduce((sum, value) => sum + value, 0)}  |  ${data.schoolDaily.reduce((sum, value) => sum + value, 0)}`,
      ...(() => {
        const delta = formatDeltaPair(periodChange(data.totalDaily, 7), periodChange(data.totalDaily, 30));
        return { delta: delta.text, deltaClassName: delta.className };
      })(),
      traces: [
        {
          type: 'bar',
          name: 'Skupaj',
          x: data.x,
          y: data.totalDaily,
          marker: {
            color: semanticChartColors.customerStack.totalFill,
            line: {
              color: semanticChartColors.customerStack.totalBorder,
              width: 1
            }
          },
          width: 0.98,
          offset: 0,
          hoverinfo: 'none'
        },
        {
          type: 'bar',
          name: 'Fizična oseba',
          x: data.x,
          y: data.individualDaily,
          marker: { color: semanticChartColors.customerStack.individual },
          width: 0.24,
          offset: -0.27,
          hoverinfo: 'none'
        },
        {
          type: 'bar',
          name: 'Podjetje',
          x: data.x,
          y: data.companyDaily,
          marker: { color: semanticChartColors.customerStack.company },
          width: 0.24,
          offset: 0,
          hoverinfo: 'none'
        },
        {
          type: 'bar',
          name: 'Šola',
          x: data.x,
          y: data.schoolDaily,
          marker: { color: semanticChartColors.customerStack.school },
          width: 0.24,
          offset: 0.27,
          hoverinfo: 'none'
        }
      ],
      tooltipRowsAt: (i) => [
        { label: 'Fizična oseba', value: formatInt(data.individualDaily[i]), color: semanticChartColors.customerStack.individual, numericValue: data.individualDaily[i] ?? null },
        { label: 'Podjetje', value: formatInt(data.companyDaily[i]), color: semanticChartColors.customerStack.company, numericValue: data.companyDaily[i] ?? null },
        { label: 'Šola', value: formatInt(data.schoolDaily[i]), color: semanticChartColors.customerStack.school, numericValue: data.schoolDaily[i] ?? null },
        { label: 'Skupaj', value: formatInt(data.totalDaily[i]), color: semanticChartColors.customerStack.totalBorder, numericValue: data.totalDaily[i] ?? null }
      ],
      enforceTopDownTooltipOrder: false,
      layout: {
        ...miniLayout(false),
        barmode: 'overlay',
        bargap: 0.02,
        bargroupgap: 0
      }
    }
  ];

  const handleHover = (chart: ChartCard, eventData: any) => {
    const point = eventData?.points?.[0];
    const domEvent = eventData?.event;
    if (!point || !domEvent?.currentTarget) return;

    const pointIndex = typeof point.pointIndex === 'number' ? point.pointIndex : point.pointNumber;
    if (typeof pointIndex !== 'number') return;

    const unsortedRows = chart.tooltipRowsAt(pointIndex);
    const rows = chart.enforceTopDownTooltipOrder ? sortRowsTopToBottom(unsortedRows) : unsortedRows;
    const pointY = typeof point.y === 'number' ? point.y : Number(point.y);
    if (!Number.isFinite(pointY)) return;

    const tooltipWidth = 380;
    const tooltipHeight = Math.max(176, 74 + rows.length * 34);
    const left = Math.min(
      window.innerWidth - tooltipWidth - 12,
      Math.max(12, domEvent.clientX + 40)
    );
    const top = Math.min(
      window.innerHeight - tooltipHeight - 12,
      Math.max(12, domEvent.clientY + 40)
    );

    setHoverCards((prev) => ({
      ...prev,
      [chart.key]: {
        xLabel: String(point.x ?? ''),
        rows,
        left,
        top
      }
    }));
  };

  const hideHover = (chartKey: string) => {
    setHoverCards((prev) => {
      const next = { ...prev };
      delete next[chartKey];
      return next;
    });
  };

  return (
    <section className="mb-3" aria-label="Orders analytics previews">
      <div className="mb-[15px] flex items-end justify-end gap-2">
        <div className="inline-flex h-8 items-center gap-1 rounded-full border border-slate-300 bg-white px-1">
          {rangeOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => onRangeChange?.(option.key)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition focus-visible:border focus-visible:border-[#3e67d6] focus-visible:outline-none focus-visible:ring-0 ${activeRange === option.key ? 'bg-[#e9efff] text-[#3659d6]' : 'border border-transparent text-slate-700 hover:bg-slate-100'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {charts.map((chart) => {
          const hoverCard = hoverCards[chart.key];
          return (
            <button
              key={chart.key}
              type="button"
              onClick={() => router.push(`/admin/analitika?view=narocila&focus=${encodeURIComponent(chart.focusKey)}`)}
              className="flex min-h-[124px] flex-col overflow-visible rounded-xl border px-3 py-2 text-left shadow-sm transition hover:border-[#b9c8ff] hover:bg-[#eef3ff] md:flex-row md:items-center md:justify-between"
              style={{
                background: `linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(246,248,251,0.96) 100%)`,
                borderColor: appearance.gridColor
              }}
            >
              <div className="relative flex h-full min-w-0 flex-1 items-center justify-center pr-0 text-center md:pr-2">
                {chart.key === 'customer-type-cumulative' ? (
                  <div className="w-full min-w-0 overflow-hidden">
                    <p className="absolute left-0 top-0 min-w-0 max-w-full truncate text-[clamp(0.75rem,1.2vw,0.875rem)] font-semibold tracking-wide text-slate-700">
                      {chart.title}
                    </p>
                    <p className="min-w-0 overflow-hidden text-[clamp(0.95rem,3.1vw,1.5rem)] font-bold leading-none text-slate-700">
                      <span>{data.individualDaily.reduce((sum, value) => sum + value, 0)}</span>
                      <span className="mx-2 font-thin text-slate-300">|</span>
                      <span>{data.companyDaily.reduce((sum, value) => sum + value, 0)}</span>
                      <span className="mx-2 font-thin text-slate-300">|</span>
                      <span>{data.schoolDaily.reduce((sum, value) => sum + value, 0)}</span>
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="absolute left-0 top-0 min-w-0 max-w-full truncate text-[clamp(0.75rem,1.2vw,0.875rem)] font-semibold tracking-wide text-slate-700">
                      {chart.title}
                    </p>
                    <p className="min-w-0 max-w-full truncate text-[clamp(1.1rem,3.4vw,1.7rem)] font-bold leading-none text-slate-700">{chart.value}</p>
                  </>
                )}
                <p className={`absolute bottom-[8px] left-0 text-[11px] font-medium leading-none ${chart.deltaClassName}`}>{chart.delta}</p>
              </div>

              <div className="relative mt-2 w-full min-w-0 rounded-md md:mt-0 md:w-[190px] md:shrink-0" style={{ backgroundColor: 'transparent' }}>
                <PlotlyClient
                  data={chart.traces}
                  layout={chart.layout}
                  config={{ responsive: true, displayModeBar: false }}
                  style={{ width: '100%', height: 118, maxWidth: '100%' }}
                  useResizeHandler
                  onHover={(eventData: any) => handleHover(chart, eventData)}
                  onUnhover={() => hideHover(chart.key)}
                  className="admin-orders-preview-plot"
                />

                {hoverCard ? createPortal(
                  <div
                    className="pointer-events-none fixed z-[120] min-w-[360px] max-w-[460px] rounded-xl border border-[color:var(--semantic-info-border)] bg-[color:var(--surface-muted)] px-[14px] py-3 text-left shadow-[0_10px_24px_rgba(15,23,42,0.15)]"
                    style={{ left: hoverCard.left, top: hoverCard.top }}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <p className="pr-3 text-[15px] font-semibold leading-none text-black">{formatTooltipDate(hoverCard.xLabel)}</p>
                    </div>
                    <div className="mb-2 h-px w-full bg-black/15" />
                    <div className="space-y-1">
                      {hoverCard.rows.map((row, index) => (
                        <div
                          key={`${row.label}-${index}`}
                          className="grid grid-cols-[minmax(180px,1fr)_auto] items-center gap-5 px-1 py-1"
                        >
                          <div className="flex items-center gap-2 text-slate-700">
                            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
                            <span className="text-[13px] font-semibold">{row.label}</span>
                          </div>
                          <span className="whitespace-nowrap text-right text-[13px] font-semibold text-slate-700">{row.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>,
                  document.body
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default memo(AdminOrdersPreviewChart);
