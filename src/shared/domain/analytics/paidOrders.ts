import type { BusinessAnalyticsResponse, BusinessBox, BusinessFilters, CanonicalOrder } from './businessAnalytics';
import { calendarDates, inPeriod, localDate, shiftCalendarYears, type BusinessPeriod } from './period';
import { describe, histogram } from './statistics';
import { CUSTOMER_TYPE_FORM_OPTIONS } from '@/shared/domain/order/customerType';

/** Payment is explicit; a shipment/completion or historical entry never implies it. */
export function isPaidOrder(order: CanonicalOrder): boolean {
  return order.paymentStatus === 'paid' && order.status !== 'cancelled' && order.contractStatus !== 'rejected';
}
/** Current saved order value, not the potentially superseded submission snapshot. */
export function paidOrderCents(order: CanonicalOrder): number | null {
  return order.paidCents === undefined ? order.activityCents : order.paidCents;
}
export function paidOrderNetCents(order: CanonicalOrder): number | null {
  const amount = paidOrderCents(order);
  return amount !== null && order.refundComplete && order.refundCents !== null ? amount - order.refundCents : null;
}
function total(rows: CanonicalOrder[], value = paidOrderCents): number | null {
  let cents = 0n;
  for (const row of rows) {
    const amount = value(row);
    if (amount === null) return null;
    cents += BigInt(amount);
  }
  if (cents > BigInt(Number.MAX_SAFE_INTEGER) || cents < BigInt(Number.MIN_SAFE_INTEGER)) throw new Error('Znesek presega varno velikost prikaza.');
  return Number(cents) / 100;
}
function box(key: string, label: string, orders: CanonicalOrder[]): BusinessBox {
  const values = orders.map(paidOrderCents).filter((value): value is number => value !== null).map(value => value / 100).sort((a, b) => a - b);
  const stats = describe(values);
  const low = stats.q1 === null || stats.iqr === null ? null : stats.q1 - 1.5 * stats.iqr;
  const high = stats.q3 === null || stats.iqr === null ? null : stats.q3 + 1.5 * stats.iqr;
  const within = values.filter(value => low !== null && high !== null && value >= low && value <= high);
  return { key, label, n: stats.n, minimum: stats.min, q1: stats.q1, median: stats.median, q3: stats.q3, maximum: stats.max, lowerWhisker: within[0] ?? null, upperWhisker: within.at(-1) ?? null, outliers: values.filter(value => low !== null && high !== null && (value < low || value > high)) };
}
export function aggregatePaidOrders(orders: CanonicalOrder[], period: BusinessPeriod, filters: BusinessFilters, historyFrom: string | null, bins?: number): BusinessAnalyticsResponse['paid'] {
  const activity = orders.filter(order => inPeriod(order.submittedAt, period));
  const current = activity.filter(isPaidOrder);
  const previous = orders.filter(order => isPaidOrder(order) && inPeriod(order.submittedAt, period.comparison));
  const values = current.map(order => { const amount = paidOrderCents(order); return amount === null ? null : amount / 100; });
  const statistics = describe(values);
  const daily = new Map<string, CanonicalOrder[]>(), previousDaily = new Map<string, CanonicalOrder[]>();
  for (const order of current) { const date = localDate(order.submittedAt); daily.set(date, [...(daily.get(date) ?? []), order]); }
  for (const order of previous) { const date = localDate(order.submittedAt); previousDaily.set(date, [...(previousDaily.get(date) ?? []), order]); }
  const previousDates = calendarDates(period.comparison.from, period.comparison.to);
  const days = calendarDates(period.from, period.to).map((date, index) => {
    const rows = daily.get(date) ?? [];
    const previousDate = period.range === 'YTD' ? shiftCalendarYears(date, -1) : previousDates[index] ?? null;
    const comparisonRows = previousDate ? previousDaily.get(previousDate) ?? [] : [];
    const previousAvailable = historyFrom !== null && previousDate !== null && previousDate >= historyFrom;
    return { date, orderCount: rows.length, activityValue: total(rows) ?? 0, valueCount: rows.filter(order => paidOrderCents(order) !== null).length, available: historyFrom !== null && date >= historyFrom, partial: period.partialToday && date === period.to, previousDate, previousCount: previousAvailable ? comparisonRows.length : null, previousValue: previousAvailable ? total(comparisonRows) : null, rollingCount7: null as number | null, rollingValue7: null as number | null };
  });
  days.forEach((day, index) => {
    const window = days.slice(index - 6, index + 1);
    if (index >= 6 && window.every(point => point.available)) {
      day.rollingCount7 = window.reduce((sum, point) => sum + point.orderCount, 0) / 7;
      day.rollingValue7 = window.every(point => point.valueCount === point.orderCount) ? window.reduce((sum, point) => sum + point.activityValue, 0) / 7 : null;
    }
  });
  const types = [...CUSTOMER_TYPE_FORM_OPTIONS, { value: 'unknown', label: 'Neznan tip' }].filter(type => filters.customerType === 'all' || type.value === filters.customerType);
  const previousAvailable = historyFrom !== null && period.comparison.from >= historyFrom;
  return { count: current.length, value: total(current), valueOrders: statistics.n, refundAdjustedValue: total(current, paidOrderNetCents), refundKnownOrders: current.filter(order => paidOrderNetCents(order) !== null).length, excludedCount: activity.filter(order => order.paymentStatus === 'paid' && !isPaidOrder(order)).length, previousCount: previousAvailable ? previous.length : null, previousValue: previousAvailable ? total(previous) : null, days, orders: { statistics, histogram: histogram(values, bins), boxes: types.map(type => box(type.value, type.label, current.filter(order => order.customerType === type.value))), sourceBoxes: ['direct', 'quote'].filter(source => filters.source === 'all' || source === filters.source).map(source => box(source, source === 'direct' ? 'Neposredno' : 'Iz ponudbe', current.filter(order => order.source === source))) } };
}
