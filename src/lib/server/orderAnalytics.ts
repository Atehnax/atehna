import { getPool } from '@/lib/server/db';
import { fetchOrders, type OrderRow } from '@/lib/server/orders';

export const ANALYTICS_TIMEZONE = 'UTC';

export type AnalyticsRange = '30d' | '90d' | '180d' | '365d';
export type AnalyticsGrouping = 'day';

type DateWindow = {
  fromIso: string;
  toIso: string;
  fromYmd: string;
  toYmd: string;
};

export type OrdersAnalyticsDay = {
  date: string;
  order_count: number;
  revenue_total: number;
  aov: number;
  median_order_value: number;
  cancelled_count: number;
  paid_count: number;
  payment_success_rate: number;
  cancellation_rate: number;
  status_buckets: Record<string, number>;
  payment_status_buckets: Record<string, number>;
  customer_type_buckets: Record<'P' | 'Š' | 'F', number>;
  lead_time_p50_hours: number | null;
  lead_time_p90_hours: number | null;
};

export type OrdersAnalyticsResponse = {
  timezone: string;
  range: AnalyticsRange;
  grouping: AnalyticsGrouping;
  from: string;
  to: string;
  days: OrdersAnalyticsDay[];
};

export const emptyOrdersAnalyticsResponse = (range: AnalyticsRange = '90d'): OrdersAnalyticsResponse => {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  return {
    timezone: ANALYTICS_TIMEZONE,
    range,
    grouping: 'day',
    from: today,
    to: today,
    days: [
      {
        date: today,
        order_count: 0,
        revenue_total: 0,
        aov: 0,
        median_order_value: 0,
        cancelled_count: 0,
        paid_count: 0,
        payment_success_rate: 0,
        cancellation_rate: 0,
        status_buckets: {},
        payment_status_buckets: {},
        customer_type_buckets: { P: 0, Š: 0, F: 0 },
        lead_time_p50_hours: null,
        lead_time_p90_hours: null
      }
    ]
  };
};

const DAY_MS = 24 * 60 * 60 * 1000;
const toYmdUtc = (value: Date) => value.toISOString().slice(0, 10);

const parseYmd = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const date = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const normalizeRange = (value?: string | null): AnalyticsRange => {
  if (value === '30d' || value === '180d' || value === '365d') return value;
  return '90d';
};

const rangeToDays = (range: AnalyticsRange) => (range === '30d' ? 30 : range === '180d' ? 180 : range === '365d' ? 365 : 90);

const resolveWindow = ({ range, from, to }: { range: AnalyticsRange; from?: string | null; to?: string | null }): DateWindow => {
  const parsedFrom = parseYmd(from);
  const parsedTo = parseYmd(to);

  const toDate = parsedTo ?? new Date(new Date().toISOString().slice(0, 10));
  const fromDate = parsedFrom ?? new Date(toDate.getTime() - (rangeToDays(range) - 1) * DAY_MS);

  if (fromDate.getTime() > toDate.getTime()) {
    return {
      fromIso: toDate.toISOString(),
      toIso: fromDate.toISOString(),
      fromYmd: toYmdUtc(toDate),
      toYmd: toYmdUtc(fromDate)
    };
  }

  return {
    fromIso: fromDate.toISOString(),
    toIso: new Date(toDate.getTime() + DAY_MS - 1).toISOString(),
    fromYmd: toYmdUtc(fromDate),
    toYmd: toYmdUtc(toDate)
  };
};

const statusLabel = (status: string | null | undefined) => {
  const normalized = (status ?? 'unknown').trim();
  return normalized.length > 0 ? normalized : 'unknown';
};

const customerBucket = (customerType: string | null | undefined): 'P' | 'Š' | 'F' => {
  const value = (customerType ?? '').toLowerCase().trim();
  if (['school', 'sola', 'šola', 'vrtec'].includes(value)) return 'Š';
  if (['person', 'fizicna', 'fizična', 'individual'].includes(value)) return 'F';
  return 'P';
};

const percentile = (values: number[], percentileRank: number): number | null => {
  if (values.length === 0) return null;
  const sortedValues = [...values].sort((left, right) => left - right);
  const index = (sortedValues.length - 1) * percentileRank;
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);
  const weight = index - lowerIndex;

  if (lowerIndex === upperIndex) return sortedValues[lowerIndex] ?? null;
  const lower = sortedValues[lowerIndex] ?? 0;
  const upper = sortedValues[upperIndex] ?? lower;
  return lower + (upper - lower) * weight;
};

async function fetchPaidLogTimestamps(orderIds: number[]) {
  if (orderIds.length === 0) return new Map<number, string>();

  const pool = await getPool();
  try {
    const result = await pool.query(
      `
      select order_id, min(created_at) as paid_at
      from order_payment_logs
      where order_id = any($1::bigint[])
        and new_status = 'paid'
      group by order_id
      `,
      [orderIds]
    );

    return new Map<number, string>(
      result.rows
        .map((row) => [Number(row.order_id), String(row.paid_at)] as const)
        .filter((entry) => Number.isFinite(entry[0]))
    );
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      ['42P01', '42501'].includes((error as { code?: string }).code ?? '')
    ) {
      return new Map<number, string>();
    }
    throw error;
  }
}

const toFiniteNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.').trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

export async function fetchOrdersAnalytics(params?: {
  range?: string | null;
  from?: string | null;
  to?: string | null;
  grouping?: string | null;
}): Promise<OrdersAnalyticsResponse> {
  const range = normalizeRange(params?.range);
  const grouping: AnalyticsGrouping = 'day';
  const window = resolveWindow({ range, from: params?.from, to: params?.to });

  const orders = await fetchOrders({ includeDrafts: true, fromDate: window.fromIso, toDate: window.toIso });
  const paidAtByOrder = await fetchPaidLogTimestamps(orders.map((order) => order.id));

  const bucketByDay = new Map<
    string,
    OrdersAnalyticsDay & { leadHours: number[]; orderValues: number[] }
  >();

  const seedDays: string[] = [];
  let cursor = new Date(`${window.fromYmd}T00:00:00.000Z`).getTime();
  const end = new Date(`${window.toYmd}T00:00:00.000Z`).getTime();

  while (cursor <= end) {
    const key = new Date(cursor).toISOString().slice(0, 10);
    seedDays.push(key);
    bucketByDay.set(key, {
      date: key,
      order_count: 0,
      revenue_total: 0,
      aov: 0,
      median_order_value: 0,
      cancelled_count: 0,
      paid_count: 0,
      payment_success_rate: 0,
      cancellation_rate: 0,
      status_buckets: {},
      payment_status_buckets: {},
      customer_type_buckets: { P: 0, Š: 0, F: 0 },
      lead_time_p50_hours: null,
      lead_time_p90_hours: null,
      leadHours: [],
      orderValues: []
    });
    cursor += DAY_MS;
  }

  orders.forEach((order: OrderRow) => {
    const createdAt = new Date(order.created_at);
    if (Number.isNaN(createdAt.getTime())) return;

    const dayKey = createdAt.toISOString().slice(0, 10);
    const dayBucket = bucketByDay.get(dayKey);
    if (!dayBucket) return;

    const orderTotal = toFiniteNumber(order.total);
    dayBucket.order_count += 1;
    dayBucket.revenue_total += orderTotal;
    dayBucket.orderValues.push(orderTotal);

    const status = statusLabel(order.status);
    dayBucket.status_buckets[status] = (dayBucket.status_buckets[status] ?? 0) + 1;
    if (status === 'cancelled') dayBucket.cancelled_count += 1;

    const paymentStatus = statusLabel(order.payment_status);
    dayBucket.payment_status_buckets[paymentStatus] =
      (dayBucket.payment_status_buckets[paymentStatus] ?? 0) + 1;
    if (paymentStatus === 'paid') dayBucket.paid_count += 1;

    const customer = customerBucket(order.customer_type);
    dayBucket.customer_type_buckets[customer] += 1;

    const paidAt = paidAtByOrder.get(order.id);
    if (paidAt) {
      const paidTimestamp = new Date(paidAt).getTime();
      if (!Number.isNaN(paidTimestamp)) {
        const leadHours = (paidTimestamp - createdAt.getTime()) / (1000 * 60 * 60);
        if (Number.isFinite(leadHours) && leadHours >= 0) dayBucket.leadHours.push(leadHours);
      }
    }
  });

  const days = seedDays.map((dayKey) => {
    const bucket = bucketByDay.get(dayKey)!;
    const aov = bucket.order_count > 0 ? bucket.revenue_total / bucket.order_count : 0;
    const medianOrderValue = percentile(bucket.orderValues, 0.5) ?? 0;
    const paymentSuccessRate = bucket.order_count > 0 ? (bucket.paid_count / bucket.order_count) * 100 : 0;
    const cancellationRate = bucket.order_count > 0 ? (bucket.cancelled_count / bucket.order_count) * 100 : 0;
    const p50 = percentile(bucket.leadHours, 0.5);
    const p90 = percentile(bucket.leadHours, 0.9);

    return {
      date: dayKey,
      order_count: bucket.order_count,
      revenue_total: Number(bucket.revenue_total.toFixed(2)),
      aov: Number(aov.toFixed(2)),
      median_order_value: Number(medianOrderValue.toFixed(2)),
      cancelled_count: bucket.cancelled_count,
      paid_count: bucket.paid_count,
      payment_success_rate: Number(paymentSuccessRate.toFixed(2)),
      cancellation_rate: Number(cancellationRate.toFixed(2)),
      status_buckets: bucket.status_buckets,
      payment_status_buckets: bucket.payment_status_buckets,
      customer_type_buckets: bucket.customer_type_buckets,
      lead_time_p50_hours: p50 === null ? null : Number(p50.toFixed(2)),
      lead_time_p90_hours: p90 === null ? null : Number(p90.toFixed(2))
    };
  });

  return {
    timezone: ANALYTICS_TIMEZONE,
    range,
    grouping,
    from: window.fromYmd,
    to: window.toYmd,
    days
  };
}
