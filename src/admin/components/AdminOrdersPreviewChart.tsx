'use client';

import { memo, useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { OrderRow } from '@/admin/components/adminOrdersTableUtils';
import type { AnalyticsGlobalAppearance } from '@/shared/server/analyticsCharts';

type RangePreset = '7d' | '1m' | '3m' | '6m' | '1y' | 'ytd' | 'max' | 'custom';
type CustomerBucketKey = 'company' | 'school' | 'individual';
type StatusBucket = 'received' | 'in_progress' | 'sent' | 'finished' | 'other';
type CardTone = 'orders' | 'revenue' | 'average' | 'status';
type HeaderIconName = 'calendar' | 'wallet' | 'star';
type FooterIconName = 'briefcase' | 'clock' | 'box' | 'check' | 'tag' | 'cart' | 'bag' | 'chart';

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

type FooterMetric = {
  icon: FooterIconName;
  label: string;
  value: string;
};

type AnalyticsCard = {
  key: string;
  focusKey: string;
  tone: CardTone;
  icon: HeaderIconName;
  title: string;
  metric: string;
  comparisons: ComparisonItem[];
  footerMetrics?: FooterMetric[];
};

type HeatmapDay = {
  date: Date;
  count: number;
  level: number;
};

type HeatmapWeek = {
  label: string;
  days: HeatmapDay[];
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

const heatmapWeekCount = 53;
const heatmapMonthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec'];
const heatmapColors = ['#eef2f7', '#dcfce7', '#bbf7d0', '#86efac', '#4ade80', '#22c55e'];
const DAY_MS = 24 * 60 * 60 * 1000;

const toneStyles: Record<CardTone, { accent: string; bg: string; border: string; statBg: string }> = {
  orders: {
    accent: '#2f80ed',
    bg: '#fbfcff',
    border: '#d9e5f6',
    statBg: '#f4f8ff'
  },
  revenue: {
    accent: '#409762',
    bg: '#fbfdfb',
    border: '#dce9df',
    statBg: '#f4fbf5'
  },
  average: {
    accent: '#ed7916',
    bg: '#fffaf6',
    border: '#f0dfcf',
    statBg: '#fff5ec'
  },
  status: {
    accent: '#64748b',
    bg: '#ffffff',
    border: '#e5e7eb',
    statBg: '#f8fafc'
  }
};

const trendBadgeClasses = {
  positive: 'bg-[#edf8ef] text-[#409762]',
  negative: 'bg-[#fff1e6] text-[#d25a0b]',
  neutral: 'bg-[#edf4ff] text-[#2f80ed]'
};

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

const pad2 = (value: number) => String(value).padStart(2, '0');

const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const startOfWeek = (date: Date) => {
  const next = startOfLocalDay(date);
  next.setDate(next.getDate() - next.getDay());
  return next;
};

const formatShortDate = (date: Date) =>
  `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${String(date.getFullYear()).slice(-2)}`;

const formatRangeLabel = (start: Date, end: Date) => `${formatShortDate(start)} – ${formatShortDate(end)}`;

const formatInt = (value: number | null | undefined) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? '—'
    : Intl.NumberFormat('sl-SI', { maximumFractionDigits: 0 }).format(value);

const formatCurrency = (value: number | null | undefined) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? '—'
    : `${Intl.NumberFormat('sl-SI', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(value)} €`;

const toAmount = (value: OrderRow['total']) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.').trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const toCustomerBucket = (customerType: string): CustomerBucketKey => {
  const normalized = customerType.toLowerCase();
  if (normalized === 'school' || normalized.includes('šol') || normalized.includes('sol') || normalized.includes('school')) {
    return 'school';
  }
  if (
    normalized === 'company' ||
    normalized.includes('podjet') ||
    normalized.includes('org') ||
    normalized.includes('business')
  ) {
    return 'company';
  }
  return 'individual';
};

const toStatusBucket = (status: string): StatusBucket => {
  const normalized = status.toLowerCase();
  if (normalized.includes('received') || normalized.includes('prejet')) return 'received';
  if (normalized.includes('in_progress') || normalized.includes('obdel')) return 'in_progress';
  if (normalized.includes('partially_sent') || normalized.includes('sent') || normalized.includes('poslan')) return 'sent';
  if (normalized.includes('finished') || normalized.includes('zaklju')) return 'finished';
  return 'other';
};

const getPeriodMetrics = (orders: OrderRow[], start: Date, end: Date): PeriodMetrics => {
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

const getFinishedOrderCount = (orders: OrderRow[], start: Date, end: Date) => {
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

const median = (values: number[]) => {
  const sortedValues = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sortedValues.length) return 0;
  const middle = Math.floor(sortedValues.length / 2);
  if (sortedValues.length % 2 === 1) return sortedValues[middle];
  return (sortedValues[middle - 1] + sortedValues[middle]) / 2;
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

const buildHeatmapWeeks = (orders: OrderRow[]): HeatmapWeek[] => {
  const today = startOfLocalDay(new Date());
  const latestOrderDate = orders
    .map((order) => startOfLocalDay(new Date(order.created_at)))
    .filter((date) => !Number.isNaN(date.getTime()))
    .reduce<Date | null>((latest, date) => {
      if (!latest || date.getTime() > latest.getTime()) return date;
      return latest;
    }, null);
  const heatmapEndDate = latestOrderDate && latestOrderDate.getTime() > today.getTime() ? latestOrderDate : today;
  const firstWeekStart = shiftDateByDays(startOfWeek(heatmapEndDate), -(heatmapWeekCount - 1) * 7);
  const countsByDate = orders.reduce((counts, order) => {
    const createdAt = startOfLocalDay(new Date(order.created_at));
    if (Number.isNaN(createdAt.getTime())) return counts;
    const key = toDateKey(createdAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());

  const allCounts: number[] = [];
  const weeks = Array.from({ length: heatmapWeekCount }, (_, weekIndex) => {
    const weekStart = shiftDateByDays(firstWeekStart, weekIndex * 7);
    const previousWeekStart = weekIndex > 0 ? shiftDateByDays(firstWeekStart, (weekIndex - 1) * 7) : null;
    const label =
      weekIndex === 0 || previousWeekStart?.getMonth() !== weekStart.getMonth()
        ? heatmapMonthLabels[weekStart.getMonth()]
        : '';
    const days = Array.from({ length: 7 }, (_, dayIndex) => {
      const date = shiftDateByDays(weekStart, dayIndex);
      const count = countsByDate.get(toDateKey(date)) ?? 0;
      allCounts.push(count);
      return { date, count, level: 0 };
    });
    return { label, days };
  });
  const maxCount = Math.max(...allCounts, 0);

  return weeks.map((week) => ({
    ...week,
    days: week.days.map((day) => ({
      ...day,
      level: day.count <= 0 || maxCount <= 0 ? 0 : Math.max(1, Math.ceil((day.count / maxCount) * 5))
    }))
  }));
};

function SvgIcon({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? 'h-5 w-5'} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

function HeaderIcon({ name }: { name: HeaderIconName }) {
  if (name === 'wallet') {
    return <SvgIcon><path d="M4.8 7.6h12.8a2.4 2.4 0 0 1 2.4 2.4v6.4a2.4 2.4 0 0 1-2.4 2.4H5.6A2.6 2.6 0 0 1 3 16.2V7.8A2.8 2.8 0 0 1 5.8 5h11.1" /><path d="M16.4 12.2h3.6v4h-3.6a2 2 0 0 1 0-4Z" /><path d="M6.2 9h8.3" /></SvgIcon>;
  }
  if (name === 'star') {
    return <SvgIcon><path d="m12 3.7 2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8L12 3.7Z" /></SvgIcon>;
  }
  return <SvgIcon><rect x="4.2" y="5.8" width="15.6" height="14" rx="2.2" /><path d="M8 3.8v4" /><path d="M16 3.8v4" /><path d="M4.2 10h15.6" /></SvgIcon>;
}

function FooterIcon({ name }: { name: FooterIconName }) {
  if (name === 'clock') return <SvgIcon className="mx-auto h-5 w-5"><circle cx="12" cy="12" r="8.2" /><path d="M12 7.5v5l3.2 1.9" /></SvgIcon>;
  if (name === 'box') return <SvgIcon className="mx-auto h-5 w-5"><path d="m12 3.8 7.2 4-7.2 4-7.2-4 7.2-4Z" /><path d="M4.8 7.8v8.4l7.2 4 7.2-4V7.8" /><path d="M12 11.8v8.4" /></SvgIcon>;
  if (name === 'check') return <SvgIcon className="mx-auto h-5 w-5"><circle cx="12" cy="12" r="8.2" /><path d="m8.6 12.1 2.1 2.2 4.7-5" /></SvgIcon>;
  if (name === 'tag') return <SvgIcon className="mx-auto h-5 w-5"><path d="M4.5 6.5v5.1l7.9 7.9 6.9-6.9-7.9-7.9H6.3a1.8 1.8 0 0 0-1.8 1.8Z" /><path d="M8.3 8.4h.01" /></SvgIcon>;
  if (name === 'cart') return <SvgIcon className="mx-auto h-5 w-5"><path d="M4 5.2h2l2.2 9.3h8.6l2.1-6.6H7.1" /><circle cx="9.2" cy="18.2" r="1.1" /><circle cx="16.2" cy="18.2" r="1.1" /></SvgIcon>;
  if (name === 'bag') return <SvgIcon className="mx-auto h-5 w-5"><path d="M6.2 8.5h11.6l.8 11H5.4l.8-11Z" /><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5" /></SvgIcon>;
  if (name === 'chart') return <SvgIcon className="mx-auto h-5 w-5"><path d="M5 18.5h14" /><path d="M7 15v3.5" /><path d="M11 11v7.5" /><path d="M15 7.5v11" /><path d="M18.5 5.5 15 8.9l-3-2.5L7.3 11" /></SvgIcon>;
  return <SvgIcon className="mx-auto h-5 w-5"><path d="M8.2 6.8V5.5a2 2 0 0 1 2-2h3.6a2 2 0 0 1 2 2v1.3" /><rect x="5" y="6.8" width="14" height="13" rx="2.3" /><path d="M9 10.5h6" /></SvgIcon>;
}

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

function ComparisonInline({ items }: { items: ComparisonItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {items.map((item) => (
        <div key={item.label} className="min-w-0 rounded-[10px] border border-[#dfe4ea] bg-[color:var(--stat-bg)] px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase leading-none tracking-[0.08em] text-[#7c8798]">{item.label}</span>
          <TrendBadge trend={item.trend} />
          </div>
          <p className="mt-2 truncate text-[14px] font-semibold leading-none text-[#172234]" title={item.value}>{item.value}</p>
        </div>
      ))}
    </div>
  );
}

function FooterMetrics({ metrics, accent }: { metrics: FooterMetric[]; accent: string }) {
  return (
    <div className="mt-5 grid border-t border-[#dfe4ea] pt-5" style={{ gridTemplateColumns: `repeat(${metrics.length}, minmax(0, 1fr))` }}>
      {metrics.map((metric, index) => (
        <div key={metric.label} className={`min-w-0 px-0.5 text-center ${index > 0 ? 'border-l border-[#dfe4ea]' : ''}`}>
          <div className="mb-3 flex justify-center text-[color:var(--metric-accent)]" style={{ '--metric-accent': accent } as React.CSSProperties}>
            <FooterIcon name={metric.icon} />
          </div>
          <p className="mx-auto flex min-h-[28px] max-w-[84px] items-start justify-center text-center text-[11px] font-semibold leading-[14px] text-[#7c8798]" title={metric.label}>{metric.label}</p>
          <p className="mt-0.5 truncate text-[16px] font-semibold leading-5 text-[#243047]" title={metric.value}>{metric.value}</p>
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

function ActivityHeatmap({ orders }: { orders: OrderRow[] }) {
  const weeks = useMemo(() => buildHeatmapWeeks(orders), [orders]);
  const legendLevels = [0, 1, 2, 3, 4, 5];

  return (
    <article className="mb-3 rounded-[11px] border border-[#e5e7eb] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_8px_20px_rgba(15,23,42,0.035)]">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-[14px] font-semibold leading-none text-[#111827]">Aktivnost naročil</h2>
        <div className="flex items-center gap-2 whitespace-nowrap text-[12px] font-medium leading-none text-[#4b5563]">
          <span>Ni podatkov</span>
          <span className="h-3.5 w-3.5 rounded-[4px] bg-[#eef2f7]" />
          <span>Manj</span>
          <div className="flex items-center gap-1">
            {legendLevels.slice(1).map((level) => (
              <span key={level} className="h-3.5 w-3.5 rounded-[4px]" style={{ backgroundColor: heatmapColors[level] }} />
            ))}
          </div>
          <span>Več</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-[34px_minmax(0,1fr)] gap-x-2">
        <div aria-hidden="true" />
        <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${heatmapWeekCount}, minmax(0, 1fr))` }}>
          {weeks.map((week, index) => (
            <div key={`${week.label}-${index}`} className="h-4 text-[11px] leading-none text-[#64748b]">
              {week.label}
            </div>
          ))}
        </div>

        <div className="grid gap-[3px] pt-[3px]" style={{ gridTemplateRows: 'repeat(7, 12px)' }} aria-hidden="true">
          <span />
          <span className="text-[11px] leading-3 text-[#64748b]">M</span>
          <span />
          <span className="text-[11px] leading-3 text-[#64748b]">S</span>
          <span />
          <span className="text-[11px] leading-3 text-[#64748b]">P</span>
          <span />
        </div>
        <div className="flex gap-[3px] pt-[3px]">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="flex min-w-0 flex-1 flex-col gap-[3px]">
              {week.days.map((day) => (
                <span
                  key={toDateKey(day.date)}
                  className="h-3 rounded-[3px]"
                  style={{ backgroundColor: heatmapColors[day.level] }}
                  title={`${formatShortDate(day.date)}: ${formatInt(day.count)}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

function PlaceholderCard() {
  return (
    <article aria-hidden="true" className="min-w-0 rounded-[12px] border border-[#dfe4ea] bg-[#fbfbfc] px-4 py-3 shadow-[0_2px_4px_rgba(15,23,42,0.045),0_12px_26px_rgba(15,23,42,0.03)]" />
  );
}

function AdminOrdersPreviewChart({
  orders,
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

    const sevenDayMetrics = getPeriodMetrics(
      selectedOrders,
      startOfLocalDay(shiftDateByDays(safeRangeEnd, -6)),
      rangeEndBoundary
    );
    const thirtyDayMetrics = getPeriodMetrics(
      selectedOrders,
      startOfLocalDay(shiftDateByDays(safeRangeEnd, -29)),
      rangeEndBoundary
    );
    const previousSevenDayMetrics = getPeriodMetrics(
      orders,
      startOfLocalDay(shiftDateByDays(safeRangeEnd, -13)),
      endOfLocalDay(shiftDateByDays(safeRangeEnd, -7))
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
        tone: 'orders',
        icon: 'calendar',
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
        tone: 'revenue',
        icon: 'wallet',
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
        tone: 'average',
        icon: 'star',
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
        tone: 'average',
        icon: 'star',
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
        tone: 'revenue',
        icon: 'wallet',
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
        tone: 'status',
        icon: 'calendar',
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
