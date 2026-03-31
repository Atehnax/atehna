'use client';

import { memo, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import type { Data, Layout } from 'plotly.js';
import PlotlyClient from '@/admin/components/charts/PlotlyClient';
import { getBaseChartLayout, getChartThemeFromCssVars } from '@/admin/components/charts/chartTheme';
import type { OrderRow } from '@/admin/components/adminOrdersTableUtils';
import type { AnalyticsGlobalAppearance } from '@/shared/server/analyticsCharts';
import { formatLjubljanaDate } from '@/shared/domain/order/dateTime';

type RangePreset = '7d' | '1m' | '3m' | '6m' | '1y' | 'ytd' | 'max' | 'custom';
type CustomerBucketKey = 'company' | 'school' | 'individual';

type Daily = {
  date: string;
  orders: number;
  revenue: number;
  companyOrders: number;
  schoolOrders: number;
  individualOrders: number;
  statusReceived: number;
  statusInProgress: number;
  statusSent: number;
  statusFinished: number;
  statusOther: number;
};

type TooltipRow = { label: string; value: string; color: string; numericValue: number | null };
type HoverCard = { xLabel: string; rows: TooltipRow[]; left: number; top: number };

type ChartCard = {
  key: string;
  focusKey: string;
  title: string;
  subtitleNode?: ReactNode;
  metricColor: string;
  metricText: string;
  metricFullText?: string;
  detailRowNode?: ReactNode;
  lowestNode: ReactNode;
  highestNode: ReactNode;
  sevenDayNode: ReactNode;
  thirtyDayNode: ReactNode;
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

type BucketMode = 'day' | 'day-2' | 'week' | 'month';

const getBucketMode = (pointCount: number): BucketMode => {
  if (pointCount < 20) return 'day';
  if (pointCount <= 30) return 'day-2';
  if (pointCount > 183) return 'month';
  return 'week';
};

type PointRow = { date: string; values: Array<number | null> };

const aggregateSeries = (x: string[], seriesList: Array<Array<number | null>>, mode: BucketMode) => {
  if (mode === 'day') return { x, series: seriesList };
  if (mode === 'day-2') {
    const keepIndexes = x.map((_, index) => index).filter((index) => index % 2 === 0 || index === x.length - 1);
    return {
      x: keepIndexes.map((index) => x[index]),
      series: seriesList.map((series) => keepIndexes.map((index) => series[index] ?? null))
    };
  }

  const grouped = new Map<string, PointRow>();
  x.forEach((date, index) => {
    const sourceDate = new Date(`${date}T00:00:00Z`);
    if (Number.isNaN(sourceDate.getTime())) return;
    let key = date;
    if (mode === 'week') {
      const day = sourceDate.getUTCDay();
      const diffToMonday = (day + 6) % 7;
      sourceDate.setUTCDate(sourceDate.getUTCDate() - diffToMonday);
      key = sourceDate.toISOString().slice(0, 10);
    }
    if (mode === 'month') {
      key = `${sourceDate.getUTCFullYear()}-${String(sourceDate.getUTCMonth() + 1).padStart(2, '0')}-01`;
    }

    const row = grouped.get(key) ?? { date: key, values: seriesList.map(() => 0) };
    row.values = row.values.map((value, seriesIndex) => {
      const next = seriesList[seriesIndex][index];
      return (value ?? 0) + (next ?? 0);
    });
    grouped.set(key, row);
  });

  const rows = Array.from(grouped.values()).sort((a, b) => a.date.localeCompare(b.date));
  return {
    x: rows.map((row) => row.date),
    series: seriesList.map((_, seriesIndex) => rows.map((row) => row.values[seriesIndex]))
  };
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

const formatCompactK = (value: number | null | undefined) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  if (Math.abs(value) < 1000) return Intl.NumberFormat('sl-SI', { maximumFractionDigits: 2 }).format(value);
  return `${Intl.NumberFormat('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value / 1000)}k`;
};

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

const formatDeltaValue = (value: number | null) =>
  value === null || !Number.isFinite(value) ? '—' : `${value.toFixed(1)}%`;
const getTrendClass = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return 'text-slate-500';
  return value >= 0 ? 'text-emerald-700' : 'text-rose-700';
};

const formatCurrencyWhole = (value: number | null | undefined) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? '—'
    : `${Intl.NumberFormat('sl-SI', { maximumFractionDigits: 0 }).format(value)} €`;

const formatMetricCompact = (value: number | null | undefined, suffix = '') => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const base = Intl.NumberFormat('sl-SI', { maximumFractionDigits: 0 }).format(value);
  return `${base}${suffix ? ` ${suffix}` : ''}`;
};


const formatTooltipDate = (value: string) => formatLjubljanaDate(value);

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec'];

const formatAxisDayLabel = (dateIso: string) => {
  const date = new Date(`${dateIso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  const month = MONTH_LABELS[date.getUTCMonth()] ?? '';
  const day = date.getUTCDate();
  if (day === 1) return `${month} 1`;
  return String(day);
};

const getAxisLabels = (x: string[], mode: BucketMode) => {
  if (mode === 'month') {
    return x.map((value) => {
      const date = new Date(`${value}T00:00:00Z`);
      if (Number.isNaN(date.getTime())) return '';
      return MONTH_LABELS[date.getUTCMonth()] ?? '';
    });
  }
  if (mode === 'week') {
    return x.map((value, index) => {
      const date = new Date(`${value}T00:00:00Z`);
      if (Number.isNaN(date.getTime())) return '';
      if (index === 0) return formatAxisDayLabel(value);
      const previous = new Date(`${x[index - 1]}T00:00:00Z`);
      if (Number.isNaN(previous.getTime())) return formatAxisDayLabel(value);
      if (previous.getUTCMonth() !== date.getUTCMonth()) return `${MONTH_LABELS[date.getUTCMonth()]} 1`;
      return String(date.getUTCDate());
    });
  }
  return x.map((value) => formatAxisDayLabel(value));
};

const formatObservedRange = (x: string[]) => {
  if (!x.length) return '';
  const start = new Date(`${x[0]}T00:00:00Z`);
  const end = new Date(`${x[x.length - 1]}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '';
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const formatPart = (date: Date, includeYear: boolean) =>
    `${date.getUTCDate()}. ${MONTH_LABELS[date.getUTCMonth()]}${includeYear ? ` ${date.getUTCFullYear()}` : ''}`;
  return sameYear
    ? `${formatPart(start, false)} – ${formatPart(end, false)}`
    : `${formatPart(start, true)} – ${formatPart(end, true)}`;
};

type StatusBucket = 'received' | 'in_progress' | 'sent' | 'finished' | 'other';
const toStatusBucket = (status: string): StatusBucket => {
  const normalized = status.toLowerCase();
  if (normalized.includes('received') || normalized.includes('prejet')) return 'received';
  if (normalized.includes('in_progress') || normalized.includes('obdel')) return 'in_progress';
  if (normalized.includes('partially_sent') || normalized.includes('sent') || normalized.includes('poslan')) return 'sent';
  if (normalized.includes('finished') || normalized.includes('zaklju')) return 'finished';
  return 'other';
};


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
        line: info,
        bottom: toRgba(info, 0.38),
        middle: toRgba(info, 0.26),
        top: toRgba(info, 0.16)
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
        individualOrders: 0,
        statusReceived: 0,
        statusInProgress: 0,
        statusSent: 0,
        statusFinished: 0,
        statusOther: 0
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

      const statusBucket = toStatusBucket(order.status);
      if (statusBucket === 'received') day.statusReceived += 1;
      if (statusBucket === 'in_progress') day.statusInProgress += 1;
      if (statusBucket === 'sent') day.statusSent += 1;
      if (statusBucket === 'finished') day.statusFinished += 1;
      if (statusBucket === 'other') day.statusOther += 1;
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
    const statusReceivedDaily = rows.map((row) => row.statusReceived);
    const statusInProgressDaily = rows.map((row) => row.statusInProgress);
    const statusSentDaily = rows.map((row) => row.statusSent);
    const statusFinishedDaily = rows.map((row) => row.statusFinished);
    const statusOtherDaily = rows.map((row) => row.statusOther);

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
      statusReceivedDaily,
      statusInProgressDaily,
      statusSentDaily,
      statusFinishedDaily,
      statusOtherDaily
    };
  }, [orders, fromDate, toDate]);

  const chartBucketMode = getBucketMode(data.x.length);
  const observedRangeLabel = formatObservedRange(data.x);

  const miniLayout = (isAreaStacked = false, axisX: string[] = data.x): Partial<Layout> => {
    const axisLabels = getAxisLabels(axisX, chartBucketMode);
    return {
      ...layoutBase,
      margin: { l: 5, r: 5, t: 8, b: 14 },
      showlegend: false,
      hovermode: 'x unified',
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      xaxis: {
        showgrid: false,
        showticklabels: true,
        zeroline: false,
        showline: true,
        linecolor: 'rgba(100,116,139,0.35)',
        tickfont: { family: '"SF Pro Display","Helvetica Neue","Neue Haas Grotesk","Inter",system-ui,sans-serif', size: chartBucketMode === 'day' ? 9 : 10, color: '#6b7280' },
        tickmode: 'array',
        tickvals: axisX,
        ticktext: axisLabels,
        tickangle: 0,
        automargin: false,
        fixedrange: true,
        hoverformat: '%Y-%m-%d'
      },
      yaxis: {
        showgrid: true,
        gridcolor: 'rgba(148,163,184,0.17)',
        gridwidth: 1,
        showticklabels: true,
        tickfont: { family: '"SF Pro Display","Helvetica Neue","Neue Haas Grotesk","Inter",system-ui,sans-serif', size: 10, color: '#6b7280' },
        tickformat: '~s',
        automargin: true,
        zeroline: false,
        showline: true,
        linecolor: 'rgba(100,116,139,0.35)',
        rangemode: 'tozero',
        fixedrange: true
      },
      barmode: isAreaStacked ? 'stack' : undefined
    };
  };

  const charts: ChartCard[] = [
    {
      key: 'orders-ma',
      focusKey: 'narocila-orders-ma',
      title: `Naročila (${observedRangeLabel})`,
      ...(() => {
        const sevenDay = periodChange(data.ordersSeries, 7);
        const thirtyDay = periodChange(data.ordersSeries, 30);
        const count = data.totalOrders;
        const individualTotal = data.individualDaily.reduce((sum, value) => sum + value, 0);
        const companyTotal = data.companyDaily.reduce((sum, value) => sum + value, 0);
        const schoolTotal = data.schoolDaily.reduce((sum, value) => sum + value, 0);
        const aggregated = aggregateSeries(
          data.x,
          [data.schoolDaily, data.companyDaily, data.individualDaily, data.ordersMa],
          chartBucketMode
        );
        const schoolDaily = aggregated.series[0].map((value) => (value ?? 0) as number);
        const companyDaily = aggregated.series[1].map((value) => (value ?? 0) as number);
        const individualDaily = aggregated.series[2].map((value) => (value ?? 0) as number);
        const ordersSeries = schoolDaily.map((value, index) => value + companyDaily[index] + individualDaily[index]);
        const ordersMa = movingAverage(ordersSeries, 7);
        const highestValue = Math.max(...ordersSeries, 0);
        const lowestValue = Math.min(...ordersSeries, 0);
        const highestIndex = ordersSeries.findIndex((value) => value === highestValue);
        const lowestIndex = ordersSeries.findIndex((value) => value === lowestValue);
        return {
          detailRowNode: (
            <>
              Šole: <span className="text-[#93c5fd]">{formatInt(schoolTotal)}</span>
              {' · '}
              Podjetja: <span className="text-[#c4b5fd]">{formatInt(companyTotal)}</span>
              {' · '}
              Fizične osebe: <span className="text-[#fcd34d]">{formatInt(individualTotal)}</span>
            </>
          ),
          metricColor: semanticChartColors.orders.line,
          metricText: formatMetricCompact(count),
          metricFullText: formatInt(count),
          lowestNode: <>Najnižje: <span className="text-slate-900">{formatInt(lowestValue)}</span></>,
          highestNode: <>Najvišje: <span className="text-slate-900">{formatInt(highestValue)}</span></>,
          sevenDayNode: <>7d: <span className={getTrendClass(sevenDay)}>{formatDeltaValue(sevenDay)}</span></>,
          thirtyDayNode: <>30d: <span className={getTrendClass(thirtyDay)}>{formatDeltaValue(thirtyDay)}</span></>,
          traces: [
            {
              type: 'bar',
              name: 'Šola',
              x: aggregated.x,
              y: schoolDaily,
              marker: { color: '#93c5fd' },
              hoverinfo: 'none'
            },
            {
              type: 'bar',
              name: 'Podjetje',
              x: aggregated.x,
              y: companyDaily,
              marker: { color: '#c4b5fd' },
              hoverinfo: 'none'
            },
            {
              type: 'bar',
              name: 'Fizična oseba',
              x: aggregated.x,
              y: individualDaily,
              marker: { color: '#fcd34d' },
              hoverinfo: 'none'
            },
            {
              type: 'scatter',
              mode: 'lines',
              name: '7d MA',
              x: aggregated.x,
              y: ordersMa,
              line: { color: semanticChartColors.orders.line, width: 2.1 },
              hoverinfo: 'none'
            },
            {
              type: 'scatter',
              mode: 'markers',
              name: 'Najvišje',
              x: highestIndex >= 0 ? [aggregated.x[highestIndex]] : [],
              y: highestIndex >= 0 ? [ordersSeries[highestIndex] + Math.max(highestValue * 0.06, 0.8)] : [],
              marker: { color: '#059669', size: 8 },
              cliponaxis: false,
              hoverinfo: 'none'
            },
            {
              type: 'scatter',
              mode: 'markers',
              name: 'Najnižje',
              x: lowestIndex >= 0 ? [aggregated.x[lowestIndex]] : [],
              y: lowestIndex >= 0 ? [ordersSeries[lowestIndex] + Math.max(highestValue * 0.03, 0.4)] : [],
              marker: { color: '#e11d48', size: 8 },
              cliponaxis: false,
              hoverinfo: 'none'
            }
          ],
          tooltipRowsAt: (i: number) => [
            { label: 'Vsi tipi', value: formatInt(ordersSeries[i]), color: semanticChartColors.orders.line, numericValue: ordersSeries[i] ?? null },
            { label: 'Šole', value: formatInt(schoolDaily[i]), color: '#93c5fd', numericValue: schoolDaily[i] ?? null },
            { label: 'Podjetja', value: formatInt(companyDaily[i]), color: '#c4b5fd', numericValue: companyDaily[i] ?? null },
            { label: 'Fizične osebe', value: formatInt(individualDaily[i]), color: '#fcd34d', numericValue: individualDaily[i] ?? null },
            { label: 'Najvišje', value: formatInt(highestValue), color: '#059669', numericValue: highestValue },
            { label: 'Najnižje', value: formatInt(lowestValue), color: '#e11d48', numericValue: lowestValue }
          ],
          layout: miniLayout(true, aggregated.x)
        };
      })(),
      enforceTopDownTooltipOrder: true
    },
    {
      key: 'revenue-ma',
      focusKey: 'narocila-revenue-ma',
      title: `Prihodki (${observedRangeLabel})`,
      ...(() => {
        const sevenDay = periodChange(data.revenueSeries, 7);
        const thirtyDay = periodChange(data.revenueSeries, 30);
        const aggregated = aggregateSeries(data.x, [data.revenueSeries, data.revenueMa], chartBucketMode);
        const revenueSeries = aggregated.series[0].map((value) => (value ?? 0) as number);
        const revenueMa = movingAverage(revenueSeries, 7);
        const highestValue = Math.max(...revenueSeries, 0);
        const lowestValue = Math.min(...revenueSeries, 0);
        const highestIndex = revenueSeries.findIndex((value) => value === highestValue);
        const lowestIndex = revenueSeries.findIndex((value) => value === lowestValue);
        return {
          metricColor: semanticChartColors.revenue.line,
          metricText: formatMetricCompact(data.totalRevenue, '€'),
          metricFullText: formatCurrencyWhole(data.totalRevenue),
          lowestNode: <>Najnižje: <span className="text-slate-900">{formatCurrencyWhole(lowestValue)}</span></>,
          highestNode: <>Najvišje: <span className="text-slate-900">{formatCurrencyWhole(highestValue)}</span></>,
          sevenDayNode: <>7d: <span className={getTrendClass(sevenDay)}>{formatDeltaValue(sevenDay)}</span></>,
          thirtyDayNode: <>30d: <span className={getTrendClass(thirtyDay)}>{formatDeltaValue(thirtyDay)}</span></>,
          traces: [
            {
              type: 'bar',
              name: 'Prihodki',
              x: aggregated.x,
              y: revenueSeries,
              marker: { color: semanticChartColors.revenue.fill },
              hoverinfo: 'none'
            },
            {
              type: 'scatter',
              mode: 'lines',
              name: '7d MA',
              x: aggregated.x,
              y: revenueMa,
              line: { color: semanticChartColors.revenue.line, width: 2.1 },
              hoverinfo: 'none'
            },
            {
              type: 'scatter',
              mode: 'markers',
              name: 'Najvišje',
              x: highestIndex >= 0 ? [aggregated.x[highestIndex]] : [],
              y: highestIndex >= 0 ? [revenueSeries[highestIndex] + Math.max(highestValue * 0.06, 1)] : [],
              marker: { color: '#059669', size: 8 },
              cliponaxis: false,
              hoverinfo: 'none'
            },
            {
              type: 'scatter',
              mode: 'markers',
              name: 'Najnižje',
              x: lowestIndex >= 0 ? [aggregated.x[lowestIndex]] : [],
              y: lowestIndex >= 0 ? [revenueSeries[lowestIndex] + Math.max(highestValue * 0.03, 0.5)] : [],
              marker: { color: '#e11d48', size: 8 },
              cliponaxis: false,
              hoverinfo: 'none'
            }
          ],
          tooltipRowsAt: (i: number) => [
            { label: 'Prihodki', value: formatCurrency(revenueSeries[i]), color: semanticChartColors.revenue.fill, numericValue: revenueSeries[i] ?? null },
            { label: '7d MA', value: formatCurrency(revenueMa[i]), color: semanticChartColors.revenue.line, numericValue: revenueMa[i] ?? null },
            { label: 'Najvišje', value: formatCurrencyWhole(highestValue), color: '#059669', numericValue: highestValue },
            { label: 'Najnižje', value: formatCurrencyWhole(lowestValue), color: '#e11d48', numericValue: lowestValue }
          ],
          layout: miniLayout(false, aggregated.x)
        };
      })(),
      enforceTopDownTooltipOrder: true
    },
    {
      key: 'aov-ma',
      focusKey: 'narocila-aov-median',
      title: `Povprečje (${observedRangeLabel})`,
      ...(() => {
        const sevenDay = periodChange(data.dailyAov, 7);
        const thirtyDay = periodChange(data.dailyAov, 30);
        const aggregated = aggregateSeries(data.x, [data.dailyAov, data.dailyAovMa], chartBucketMode);
        const dailyAovSeries = aggregated.series[0].map((value) => value ?? 0);
        const dailyAovMa = movingAverage(dailyAovSeries, 7);
        const highestValue = Math.max(...dailyAovSeries, 0);
        const lowestValue = Math.min(...dailyAovSeries, 0);
        const highestIndex = dailyAovSeries.findIndex((value) => value === highestValue);
        const lowestIndex = dailyAovSeries.findIndex((value) => value === lowestValue);
        const sortedValues = dailyAovSeries.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
        const medianValue = sortedValues.length
          ? sortedValues[Math.floor((sortedValues.length - 1) / 2)]
          : null;
        return {
          metricColor: semanticChartColors.avgOrderValue.line,
          metricText: formatMetricCompact(data.rangeAov, '€'),
          metricFullText: formatCurrencyWhole(data.rangeAov),
          detailRowNode: <>Median: <span className="text-slate-900">{formatCurrencyWhole(medianValue)}</span></>,
          lowestNode: <>Najnižje: <span className="text-slate-900">{formatCurrencyWhole(lowestValue)}</span></>,
          highestNode: <>Najvišje: <span className="text-slate-900">{formatCurrencyWhole(highestValue)}</span></>,
          sevenDayNode: <>7d: <span className={getTrendClass(sevenDay)}>{formatDeltaValue(sevenDay)}</span></>,
          thirtyDayNode: <>30d: <span className={getTrendClass(thirtyDay)}>{formatDeltaValue(thirtyDay)}</span></>,
          traces: [
            {
              type: 'bar',
              name: 'Povprečje',
              x: aggregated.x,
              y: dailyAovSeries,
              marker: { color: semanticChartColors.avgOrderValue.fill },
              connectgaps: false,
              hoverinfo: 'none'
            },
            {
              type: 'scatter',
              mode: 'lines',
              name: '7d MA',
              x: aggregated.x,
              y: dailyAovMa,
              line: { color: semanticChartColors.avgOrderValue.line, width: 2.1 },
              connectgaps: false,
              hoverinfo: 'none'
            },
            {
              type: 'scatter',
              mode: 'markers',
              name: 'Najvišje',
              x: highestIndex >= 0 ? [aggregated.x[highestIndex]] : [],
              y: highestIndex >= 0 ? [dailyAovSeries[highestIndex] + Math.max(highestValue * 0.06, 0.8)] : [],
              marker: { color: '#059669', size: 8 },
              cliponaxis: false,
              hoverinfo: 'none'
            },
            {
              type: 'scatter',
              mode: 'markers',
              name: 'Najnižje',
              x: lowestIndex >= 0 ? [aggregated.x[lowestIndex]] : [],
              y: lowestIndex >= 0 ? [dailyAovSeries[lowestIndex] + Math.max(highestValue * 0.03, 0.4)] : [],
              marker: { color: '#e11d48', size: 8 },
              cliponaxis: false,
              hoverinfo: 'none'
            }
          ],
          tooltipRowsAt: (i: number) => [
            { label: 'Povprečje', value: formatCurrency(dailyAovSeries[i]), color: semanticChartColors.avgOrderValue.fill, numericValue: dailyAovSeries[i] ?? null },
            { label: '7d MA', value: formatCurrency(dailyAovMa[i]), color: semanticChartColors.avgOrderValue.line, numericValue: dailyAovMa[i] ?? null },
            { label: 'Najvišje', value: formatCurrencyWhole(highestValue), color: '#059669', numericValue: highestValue },
            { label: 'Najnižje', value: formatCurrencyWhole(lowestValue), color: '#e11d48', numericValue: lowestValue }
          ],
          layout: miniLayout(false, aggregated.x)
        };
      })(),
      enforceTopDownTooltipOrder: true
    },
    {
      key: 'order-statuses',
      focusKey: 'narocila-status-mix',
      title: `Statusi naročil (${observedRangeLabel})`,
      ...(() => {
        const aggregated = aggregateSeries(
          data.x,
          [data.statusReceivedDaily, data.statusInProgressDaily, data.statusSentDaily, data.statusFinishedDaily, data.statusOtherDaily],
          chartBucketMode
        );
        const receivedDaily = aggregated.series[0].map((value) => (value ?? 0) as number);
        const inProgressDaily = aggregated.series[1].map((value) => (value ?? 0) as number);
        const sentDaily = aggregated.series[2].map((value) => (value ?? 0) as number);
        const finishedDaily = aggregated.series[3].map((value) => (value ?? 0) as number);
        const otherDaily = aggregated.series[4].map((value) => (value ?? 0) as number);
        const totalsDaily = receivedDaily.map((v, i) => v + inProgressDaily[i] + sentDaily[i] + finishedDaily[i] + otherDaily[i]);
        const activeDaily = receivedDaily.map((v, i) => v + inProgressDaily[i] + sentDaily[i]);
        const sevenDay = periodChange(activeDaily, 7);
        const thirtyDay = periodChange(activeDaily, 30);
        const activeTotal = activeDaily.reduce((sum, value) => sum + value, 0);
        const totalsByStatus = {
          Prejeto: receivedDaily.reduce((sum, value) => sum + value, 0),
          'V obdelavi': inProgressDaily.reduce((sum, value) => sum + value, 0),
          Poslano: sentDaily.reduce((sum, value) => sum + value, 0),
          Zaključeno: finishedDaily.reduce((sum, value) => sum + value, 0),
          Ostalo: otherDaily.reduce((sum, value) => sum + value, 0)
        };
        const sortedStatuses = Object.entries(totalsByStatus).sort((a, b) => b[1] - a[1]);
        const highestValue = Math.max(...totalsDaily, 0);
        const lowestValue = Math.min(...totalsDaily, 0);
        return {
          metricColor: semanticChartColors.orders.line,
          metricText: formatMetricCompact(activeTotal),
          metricFullText: formatInt(activeTotal),
          lowestNode: <>Najnižje: <span className="text-slate-900">{sortedStatuses[sortedStatuses.length - 1]?.[0] ?? '—'} ({formatInt(sortedStatuses[sortedStatuses.length - 1]?.[1] ?? 0)})</span></>,
          highestNode: <>Najvišje: <span className="text-slate-900">{sortedStatuses[0]?.[0] ?? '—'} ({formatInt(sortedStatuses[0]?.[1] ?? 0)})</span></>,
          sevenDayNode: <>7d: <span className={getTrendClass(sevenDay)}>{formatDeltaValue(sevenDay)}</span></>,
          thirtyDayNode: <>30d: <span className={getTrendClass(thirtyDay)}>{formatDeltaValue(thirtyDay)}</span></>,
          traces: [
            { type: 'bar', name: 'Prejeto', x: aggregated.x, y: receivedDaily, marker: { color: '#93c5fd' }, hoverinfo: 'none' },
            { type: 'bar', name: 'V obdelavi', x: aggregated.x, y: inProgressDaily, marker: { color: '#60a5fa' }, hoverinfo: 'none' },
            { type: 'bar', name: 'Poslano', x: aggregated.x, y: sentDaily, marker: { color: '#38bdf8' }, hoverinfo: 'none' },
            { type: 'bar', name: 'Zaključeno', x: aggregated.x, y: finishedDaily, marker: { color: '#0284c7' }, hoverinfo: 'none' },
            { type: 'bar', name: 'Ostalo', x: aggregated.x, y: otherDaily, marker: { color: '#cbd5e1' }, hoverinfo: 'none' },
            {
              type: 'scatter',
              mode: 'lines',
              name: '7d MA',
              x: aggregated.x,
              y: movingAverage(activeDaily, 7),
              line: { color: semanticChartColors.orders.line, width: 2.1 },
              hoverinfo: 'none'
            },
            {
              type: 'scatter',
              mode: 'markers',
              name: 'Najvišje',
              x: [aggregated.x[totalsDaily.findIndex((value) => value === highestValue)]],
              y: [highestValue + Math.max(highestValue * 0.06, 0.8)],
              marker: { color: '#059669', size: 8 },
              cliponaxis: false,
              hoverinfo: 'none'
            },
            {
              type: 'scatter',
              mode: 'markers',
              name: 'Najnižje',
              x: [aggregated.x[totalsDaily.findIndex((value) => value === lowestValue)]],
              y: [lowestValue + Math.max(highestValue * 0.03, 0.4)],
              marker: { color: '#e11d48', size: 8 },
              cliponaxis: false,
              hoverinfo: 'none'
            }
          ],
          tooltipRowsAt: (i: number) => [
            { label: 'Prejeto', value: formatInt(receivedDaily[i]), color: '#93c5fd', numericValue: receivedDaily[i] ?? null },
            { label: 'V obdelavi', value: formatInt(inProgressDaily[i]), color: '#60a5fa', numericValue: inProgressDaily[i] ?? null },
            { label: 'Poslano', value: formatInt(sentDaily[i]), color: '#38bdf8', numericValue: sentDaily[i] ?? null },
            { label: 'Zaključeno', value: formatInt(finishedDaily[i]), color: '#0284c7', numericValue: finishedDaily[i] ?? null },
            { label: 'Najvišje', value: formatInt(highestValue), color: '#059669', numericValue: highestValue },
            { label: 'Najnižje', value: formatInt(lowestValue), color: '#e11d48', numericValue: lowestValue }
          ],
          layout: miniLayout(true, aggregated.x)
        };
      })(),
      enforceTopDownTooltipOrder: false
    }
  ];

  const handleHover = (chart: ChartCard, eventData: any) => {
    const point = eventData?.points?.[0];
    const domEvent = eventData?.event;
    if (!point || !domEvent?.currentTarget) return;

    const pointIndex = typeof point.pointIndex === 'number' ? point.pointIndex : point.pointNumber;
    if (typeof pointIndex !== 'number') return;

    const unsortedRows = chart.tooltipRowsAt(pointIndex);
    const rows = unsortedRows;
    const pointY = typeof point.y === 'number' ? point.y : Number(point.y);
    if (!Number.isFinite(pointY)) return;

    const tooltipWidth = 200;
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
        <div className="inline-flex h-8 items-center gap-1 rounded-xl border border-slate-300 bg-white px-1">
          {rangeOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => onRangeChange?.(option.key)}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition focus-visible:border focus-visible:border-[#3e67d6] focus-visible:outline-none focus-visible:ring-0 ${activeRange === option.key ? 'bg-[color:var(--blue-500)] text-white' : 'border border-transparent text-slate-700 hover:bg-[color:var(--hover-neutral)]'}`}
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
              className="flex min-h-[150px] flex-col overflow-visible rounded-xl border px-3 py-2 text-left shadow-sm transition hover:border-[color:var(--blue-500)] hover:bg-[color:var(--hover-neutral)]"
              style={{
                fontFamily: '"SF Pro Display","Helvetica Neue","Neue Haas Grotesk","Inter",system-ui,sans-serif',
                background: `linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(246,248,251,0.96) 100%)`,
                borderColor: appearance.gridColor
              }}
            >
              <div className="mb-0 h-[68px] w-full min-w-0">
                <div className="space-y-1 text-[color:var(--text-strong)]">
                  {(() => {
                    const metricLength = chart.metricText.length;
                    const isLongMetric = metricLength >= 6;
                    const rangeStart = chart.title.lastIndexOf(' (');
                    const baseTitle = rangeStart > 0 ? chart.title.slice(0, rangeStart) : chart.title;
                    const rangeTitle = rangeStart > 0 ? chart.title.slice(rangeStart) : '';
                    return (
                      <>
                  <p className="truncate text-left text-[13px] leading-4 tracking-[0.005em] text-slate-600"><span className="font-semibold">{baseTitle}</span><span className="font-normal">{rangeTitle}</span></p>
                  <div className={`mx-auto grid ${isLongMetric ? 'grid-cols-[minmax(168px,1fr)_auto]' : 'grid-cols-[minmax(168px,1fr)_auto]'} grid-rows-3 gap-x-2 gap-y-0.5`}>
                    <div className="row-start-2 text-[10px] leading-[1] text-slate-600">
                      <p className="self-center whitespace-nowrap [&_span]:font-medium">{chart.detailRowNode ?? ''}</p>
                    </div>
                    <div className="row-start-3 grid grid-cols-2 items-center gap-x-1.5 text-[10px] leading-[1] text-slate-600">
                      <p className="self-center whitespace-nowrap [&_span]:font-medium">{chart.sevenDayNode}</p>
                      <p className="self-center whitespace-nowrap [&_span]:font-medium">{chart.thirtyDayNode}</p>
                    </div>
                    <div className="row-span-3 flex h-[30px] items-start justify-center pr-4">
                      <p
                        className="whitespace-nowrap text-left text-[34px] font-normal leading-[1] tracking-[-0.02em]"
                        style={{ color: chart.metricColor }}
                        title={chart.metricFullText ?? chart.metricText}
                      >
                        {chart.metricText}
                      </p>
                    </div>
                  </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className="relative mt-0 w-full min-w-0 rounded-md" style={{ backgroundColor: 'transparent' }}>
                <PlotlyClient
                  data={chart.traces}
                  layout={chart.layout}
                  config={{ responsive: true, displayModeBar: false }}
                  style={{ width: '100%', height: 96, maxWidth: '100%' }}
                  useResizeHandler
                  onHover={(eventData: any) => handleHover(chart, eventData)}
                  onUnhover={() => hideHover(chart.key)}
                  className="admin-orders-preview-plot"
                />

                {hoverCard ? createPortal(
                  <div
                    className="pointer-events-none fixed z-[120] min-w-[180px] max-w-[230px] rounded-xl border border-[color:var(--semantic-info-border)] bg-[color:var(--surface-muted)] px-[12px] py-2 text-left shadow-[0_10px_24px_rgba(15,23,42,0.15)]"
                    style={{ left: hoverCard.left, top: hoverCard.top }}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <p className="pr-3 text-[15px] font-semibold leading-none text-black">{formatTooltipDate(hoverCard.xLabel)}</p>
                    </div>
                    <div className="mb-2 h-px w-full bg-black/15" />
                    <div className="space-y-0.5">
                      {hoverCard.rows.map((row, index) => (
                        <div
                          key={`${row.label}-${index}`}
                          className="grid grid-cols-[minmax(180px,1fr)_auto] items-center gap-5 px-1 py-0.5"
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
