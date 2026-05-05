'use client';

import { memo, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { formatEuroWithSuffix, formatSlInteger } from '@/shared/domain/formatting';
import type { AnalyticsGlobalAppearance } from '@/shared/server/analyticsCharts';

type RangePreset = '7d' | '1m' | '3m' | '6m' | '1y' | 'ytd' | 'max' | 'custom';
type StatusBucket = 'received' | 'in_progress' | 'sent' | 'finished' | 'other';

type PeriodMetrics = {
  orders: number;
  revenue: number;
  average: number;
  dailyAverage: number;
  maxOrderValue: number;
};

type TrendBadgeData = {
  value: string;
  direction: 'positive' | 'negative' | 'neutral';
};

type ComparisonItem = {
  label: string;
  value: string;
  trend: TrendBadgeData;
};

type AnalyticsCard = {
  key: string;
  focusKey: string;
  title: string;
  metric: string;
  comparisons: ComparisonItem[];
};

type OrderAnalyticsPreviewRow = {
  created_at: string;
  status: string;
  total: number | string | null;
};

const rangeOptions: Array<{ key: Exclude<RangePreset, 'custom'>; label: string }> = [
  { key: '7d', label: '7D' },
  { key: '1m', label: '1M' },
  { key: '3m', label: '3M' },
  { key: '6m', label: '6M' },
  { key: '1y', label: '1Y' },
  { key: 'ytd', label: 'YTD' },
  { key: 'max', label: 'MAX' }
];

const DAY_MS = 24 * 60 * 60 * 1000;

const parseDateOnly = (value?: string) => {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const startOfLocalDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfLocalDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
};

const shiftDateByDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const formatInt = (value: number | null | undefined) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? '—'
    : formatSlInteger(value);

const formatCurrency = (value: number | null | undefined) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? '—'
    : formatEuroWithSuffix(value);

const toAmount = (value: OrderAnalyticsPreviewRow['total']) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.').trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const toStatusBucket = (status: string): StatusBucket => {
  const normalized = status.toLowerCase();
  if (normalized.includes('received') || normalized.includes('prejet')) return 'received';
  if (normalized.includes('in_progress') || normalized.includes('obdel')) return 'in_progress';
  if (normalized.includes('partially_sent') || normalized.includes('sent') || normalized.includes('poslan')) return 'sent';
  if (normalized.includes('finished') || normalized.includes('zaklju')) return 'finished';
  return 'other';
};

const getPeriodMetrics = (orders: OrderAnalyticsPreviewRow[], start: Date, end: Date): PeriodMetrics => {
  const startTs = start.getTime();
  const endTs = end.getTime();
  const dayCount = Math.max(
    1,
    Math.round((startOfLocalDay(end).getTime() - startOfLocalDay(start).getTime()) / DAY_MS) + 1
  );
  const periodOrders = orders.filter((order) => {
    const timestamp = new Date(order.created_at).getTime();
    return Number.isFinite(timestamp) && timestamp >= startTs && timestamp <= endTs;
  });
  const orderValues = periodOrders.map((order) => toAmount(order.total));
  const revenue = orderValues.reduce((sum, value) => sum + value, 0);

  return {
    orders: periodOrders.length,
    revenue,
    average: periodOrders.length > 0 ? revenue / periodOrders.length : 0,
    dailyAverage: revenue / dayCount,
    maxOrderValue: orderValues.length ? Math.max(...orderValues) : 0
  };
};

const getFinishedOrderCount = (orders: OrderAnalyticsPreviewRow[], start: Date, end: Date) => {
  const startTs = start.getTime();
  const endTs = end.getTime();
  return orders.filter((order) => {
    const timestamp = new Date(order.created_at).getTime();
    return (
      Number.isFinite(timestamp) &&
      timestamp >= startTs &&
      timestamp <= endTs &&
      toStatusBucket(order.status) === 'finished'
    );
  }).length;
};

const trendPercent = (current: number, previous: number) => {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return 0;
  if (previous <= 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

const trendBadge = (value: number): TrendBadgeData => {
  const direction = value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral';
  return {
    direction,
    value: `${Intl.NumberFormat('sl-SI', { maximumFractionDigits: 1 }).format(Math.abs(value))}%`
  };
};

function TrendBadge({ trend }: { trend: TrendBadgeData }) {
  const arrowClass =
    trend.direction === 'positive'
      ? 'border-x-[4px] border-b-[6px] border-x-transparent border-b-current text-[#409762]'
      : trend.direction === 'negative'
        ? 'border-x-[4px] border-t-[6px] border-x-transparent border-t-current text-[#d25a0b]'
        : '';
  return (
    <span className={`inline-flex items-center gap-1 text-[14px] font-semibold leading-none ${trend.direction === 'neutral' ? 'text-[#7c8798]' : trend.direction === 'positive' ? 'text-[#4f8d59]' : 'text-[#d25a0b]'}`}>
      {arrowClass ? <span aria-hidden="true" className={`inline-block h-0 w-0 ${arrowClass}`} /> : null}
      {trend.value}
    </span>
  );
}

function ComparisonRow({ items }: { items: ComparisonItem[] }) {
  return (
    <div className="mt-3 flex min-w-0 flex-col gap-y-2 whitespace-nowrap text-[14px] leading-none">
      {items.map((item) => (
        <div key={item.label} className="flex min-w-0 items-center gap-2">
          <span className="font-semibold uppercase tracking-[0.04em] text-[#707986]">{item.label}</span>
          <span className="font-semibold text-[#334155]" title={item.value}>{item.value}</span>
          <TrendBadge trend={item.trend} />
        </div>
      ))}
    </div>
  );
}

function AnalyticsMetricCard({ card }: { card: AnalyticsCard }) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.push(`/admin/analitika?view=narocila&focus=${encodeURIComponent(card.focusKey)}`)}
      className="min-h-[94px] min-w-0 rounded-[11px] border border-[#e5e7eb] bg-white px-5 py-[11px] text-left shadow-[0_1px_2px_rgba(15,23,42,0.05),0_8px_20px_rgba(15,23,42,0.035)] transition hover:-translate-y-px hover:shadow-[0_3px_8px_rgba(15,23,42,0.07),0_14px_28px_rgba(15,23,42,0.05)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f80ed]/25"
    >
      <p className="min-w-0 whitespace-nowrap text-[11px] font-bold uppercase leading-3 tracking-[0.035em] text-[#6f7784]" title={card.title}>{card.title}</p>
      <p className="mt-2 truncate text-[27px] font-semibold leading-none tracking-[-0.035em] text-[#334155]" title={card.metric}>{card.metric}</p>
      <ComparisonRow items={card.comparisons} />
    </button>
  );
}

function AdminOrdersPreviewChart({
  orders,
  fromDate,
  toDate,
  activeRange = '1m',
  onRangeChange
}: {
  orders: OrderAnalyticsPreviewRow[];
  appearance?: AnalyticsGlobalAppearance;
  fromDate?: string;
  toDate?: string;
  activeRange?: RangePreset;
  onRangeChange?: (range: Exclude<RangePreset, 'custom'>) => void;
}) {
  const cards = useMemo<AnalyticsCard[]>(() => {
    const orderDates = orders
      .map((order) => new Date(order.created_at))
      .filter((date) => !Number.isNaN(date.getTime()));
    const fallbackDate = startOfLocalDay(new Date());
    const earliestOrderDate = orderDates.length
      ? startOfLocalDay(new Date(Math.min(...orderDates.map((date) => date.getTime()))))
      : fallbackDate;
    const latestOrderDate = orderDates.length
      ? startOfLocalDay(new Date(Math.max(...orderDates.map((date) => date.getTime()))))
      : fallbackDate;

    const rangeStart = parseDateOnly(fromDate) ?? earliestOrderDate;
    const rangeEnd = parseDateOnly(toDate) ?? latestOrderDate;
    const safeRangeStart = rangeStart.getTime() <= rangeEnd.getTime() ? rangeStart : rangeEnd;
    const safeRangeEnd = rangeStart.getTime() <= rangeEnd.getTime() ? rangeEnd : rangeStart;
    const rangeStartBoundary = startOfLocalDay(safeRangeStart);
    const rangeEndBoundary = endOfLocalDay(safeRangeEnd);
    const selectedOrders = orders.filter((order) => {
      const timestamp = new Date(order.created_at).getTime();
      return (
        Number.isFinite(timestamp) &&
        timestamp >= rangeStartBoundary.getTime() &&
        timestamp <= rangeEndBoundary.getTime()
      );
    });

    const thirtyDayMetrics = getPeriodMetrics(
      selectedOrders,
      startOfLocalDay(shiftDateByDays(safeRangeEnd, -29)),
      rangeEndBoundary
    );
    const previousThirtyDayMetrics = getPeriodMetrics(
      orders,
      startOfLocalDay(shiftDateByDays(safeRangeEnd, -59)),
      endOfLocalDay(shiftDateByDays(safeRangeEnd, -30))
    );

    const revenue = selectedOrders.reduce((sum, order) => sum + toAmount(order.total), 0);
    const average = selectedOrders.length > 0 ? revenue / selectedOrders.length : 0;
    const selectedDayCount = Math.max(
      1,
      Math.round((startOfLocalDay(safeRangeEnd).getTime() - startOfLocalDay(safeRangeStart).getTime()) / DAY_MS) + 1
    );
    const dailyAverage = revenue / selectedDayCount;
    const maxOrderValue = selectedOrders.length
      ? Math.max(...selectedOrders.map((order) => toAmount(order.total)))
      : 0;
    const statusTotals = selectedOrders.reduce(
      (totals, order) => {
        const bucket = toStatusBucket(order.status);
        if (bucket !== 'other') totals[bucket] += 1;
        return totals;
      },
      { received: 0, in_progress: 0, sent: 0, finished: 0 }
    );
    const thirtyDayFinished = getFinishedOrderCount(
      selectedOrders,
      startOfLocalDay(shiftDateByDays(safeRangeEnd, -29)),
      rangeEndBoundary
    );
    const previousThirtyDayFinished = getFinishedOrderCount(
      orders,
      startOfLocalDay(shiftDateByDays(safeRangeEnd, -59)),
      endOfLocalDay(shiftDateByDays(safeRangeEnd, -30))
    );

    return [
      {
        key: 'orders-ma',
        focusKey: 'narocila-orders-ma',
        title: 'NAROČILA',
        metric: formatInt(selectedOrders.length),
        comparisons: [
          {
            label: '30d',
            value: formatInt(thirtyDayMetrics.orders),
            trend: trendBadge(trendPercent(thirtyDayMetrics.orders, previousThirtyDayMetrics.orders))
          }
        ]
      },
      {
        key: 'revenue-ma',
        focusKey: 'narocila-revenue-ma',
        title: 'PRIHODKI',
        metric: formatCurrency(revenue),
        comparisons: [
          {
            label: '30d',
            value: formatCurrency(thirtyDayMetrics.revenue),
            trend: trendBadge(trendPercent(thirtyDayMetrics.revenue, previousThirtyDayMetrics.revenue))
          }
        ]
      },
      {
        key: 'daily-average',
        focusKey: 'narocila-revenue-ma',
        title: 'POVPREČJE NA DAN',
        metric: formatCurrency(dailyAverage),
        comparisons: [
          {
            label: '30d',
            value: formatCurrency(thirtyDayMetrics.dailyAverage),
            trend: trendBadge(trendPercent(thirtyDayMetrics.dailyAverage, previousThirtyDayMetrics.dailyAverage))
          }
        ]
      },
      {
        key: 'aov-ma',
        focusKey: 'narocila-aov-median',
        title: 'POVPREČJE',
        metric: formatCurrency(average),
        comparisons: [
          {
            label: '30d',
            value: formatCurrency(thirtyDayMetrics.average),
            trend: trendBadge(trendPercent(thirtyDayMetrics.average, previousThirtyDayMetrics.average))
          }
        ]
      },
      {
        key: 'max-order-value',
        focusKey: 'narocila-max-order-value',
        title: 'NAJVIŠJA VREDNOST NAROČILA',
        metric: formatCurrency(maxOrderValue),
        comparisons: [
          {
            label: '30d',
            value: formatCurrency(thirtyDayMetrics.maxOrderValue),
            trend: trendBadge(trendPercent(thirtyDayMetrics.maxOrderValue, previousThirtyDayMetrics.maxOrderValue))
          }
        ]
      },
      {
        key: 'status-finished',
        focusKey: 'narocila-status-mix',
        title: 'STATUSI NAROČIL',
        metric: `${formatInt(statusTotals.finished)} zaključenih`,
        comparisons: [
          {
            label: '30d',
            value: formatInt(thirtyDayFinished),
            trend: trendBadge(trendPercent(thirtyDayFinished, previousThirtyDayFinished))
          }
        ]
      }
    ];
  }, [orders, fromDate, toDate]);

  return (
    <section className="mb-3 font-['Inter',system-ui,sans-serif]" aria-label="Orders analytics summary">
      <div className="mb-3 flex items-end justify-end gap-2">
        <div className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-300 bg-white px-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          {rangeOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => onRangeChange?.(option.key)}
              className={`rounded-md px-3 py-1 text-xs font-semibold tracking-[0] transition focus-visible:border focus-visible:border-[#3e67d6] focus-visible:outline-none focus-visible:ring-0 ${activeRange === option.key ? 'bg-[color:var(--blue-500)] text-white' : 'border border-transparent text-slate-700 hover:bg-[color:var(--hover-neutral)]'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-[14px] sm:grid-cols-2 lg:grid-cols-5">
        {cards
          .filter((card) => card.key !== 'status-finished')
          .map((card) => (
            <AnalyticsMetricCard
              key={card.key}
              card={card.key === 'aov-ma' ? { ...card, title: 'POVPREČJE NA NAROČILO' } : card}
            />
          ))}
      </div>
    </section>
  );
}

export default memo(AdminOrdersPreviewChart);
