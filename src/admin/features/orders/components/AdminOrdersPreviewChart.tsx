'use client';

import { memo, useMemo } from 'react';
import { formatEuroWithSuffix, formatSlInteger } from '@/shared/domain/formatting';
import type { AnalyticsGlobalAppearance } from '@/shared/server/analyticsCharts';
import AdminAnalyticsComparisonRow, {
  createAdminAnalyticsTrend,
  type AdminAnalyticsComparisonItem
} from '@/shared/ui/admin-analytics-comparison-row';
import AdminAnalyticsSummaryCard from '@/shared/ui/admin-analytics-summary-card';

type RangePreset = '7d' | '1m' | '3m' | '6m' | '1y' | 'ytd' | 'max' | 'custom';
type StatusBucket = 'received' | 'in_progress' | 'sent' | 'finished' | 'other';

type PeriodMetrics = {
  orders: number;
  revenue: number;
  average: number;
  dailyAverage: number;
  maxOrderValue: number;
};

type AnalyticsCard = {
  key: string;
  focusKey: string;
  title: string;
  metric: string;
  comparisons: AdminAnalyticsComparisonItem[];
};

type OrderAnalyticsPreviewRow = {
  created_at: string;
  committed_at: string | null;
  contract_accepted_at: string | null;
  status: string;
  total: number | string | null;
  commitment_status: string | null;
  contract_status: string | null;
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

const isFinancialOrder = (order: OrderAnalyticsPreviewRow) =>
  order.contract_status === 'accepted' &&
  order.commitment_status === 'binding' &&
  order.status.trim().toLowerCase() !== 'cancelled';

const getFinancialTimestamp = (order: OrderAnalyticsPreviewRow) =>
  new Date(order.committed_at ?? order.contract_accepted_at ?? order.created_at).getTime();

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
  const financialOrders = orders.filter((order) => {
    const timestamp = getFinancialTimestamp(order);
    return isFinancialOrder(order) && Number.isFinite(timestamp) && timestamp >= startTs && timestamp <= endTs;
  });
  const orderValues = financialOrders.map((order) => toAmount(order.total));
  const revenue = orderValues.reduce((sum, value) => sum + value, 0);

  return {
    orders: periodOrders.length,
    revenue,
    average: financialOrders.length > 0 ? revenue / financialOrders.length : 0,
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

function AnalyticsMetricCard({ card }: { card: AnalyticsCard }) {
  return (
    <AdminAnalyticsSummaryCard
      href={`/admin/analitika?view=narocila&focus=${encodeURIComponent(card.focusKey)}`}
      title={card.title}
      metric={card.metric}
    >
      <AdminAnalyticsComparisonRow items={card.comparisons} />
    </AdminAnalyticsSummaryCard>
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
    const financialOrders = orders.filter((order) => {
      const timestamp = getFinancialTimestamp(order);
      return (
        isFinancialOrder(order) &&
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

    const revenue = financialOrders.reduce((sum, order) => sum + toAmount(order.total), 0);
    const average = financialOrders.length > 0 ? revenue / financialOrders.length : 0;
    const selectedDayCount = Math.max(
      1,
      Math.round((startOfLocalDay(safeRangeEnd).getTime() - startOfLocalDay(safeRangeStart).getTime()) / DAY_MS) + 1
    );
    const dailyAverage = revenue / selectedDayCount;
    const maxOrderValue = financialOrders.length
      ? Math.max(...financialOrders.map((order) => toAmount(order.total)))
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
            trend: createAdminAnalyticsTrend(thirtyDayMetrics.orders, previousThirtyDayMetrics.orders)
          }
        ]
      },
      {
        key: 'revenue-ma',
        focusKey: 'narocila-revenue-ma',
        title: 'VREDNOST NAROČIL',
        metric: formatCurrency(revenue),
        comparisons: [
          {
            label: '30d',
            value: formatCurrency(thirtyDayMetrics.revenue),
            trend: createAdminAnalyticsTrend(thirtyDayMetrics.revenue, previousThirtyDayMetrics.revenue)
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
            trend: createAdminAnalyticsTrend(thirtyDayMetrics.dailyAverage, previousThirtyDayMetrics.dailyAverage)
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
            trend: createAdminAnalyticsTrend(thirtyDayMetrics.average, previousThirtyDayMetrics.average)
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
            trend: createAdminAnalyticsTrend(thirtyDayMetrics.maxOrderValue, previousThirtyDayMetrics.maxOrderValue)
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
            trend: createAdminAnalyticsTrend(thirtyDayFinished, previousThirtyDayFinished)
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
