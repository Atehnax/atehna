import type { BusinessDay, BusinessFilters, CanonicalOrder } from './businessAnalytics';
import { matchesBusinessFilters, sumCents } from './metrics';
import { addCalendarDays, BUSINESS_TIMEZONE, calendarDates, inPeriod, localDate, localInstant } from './period';
import { isCustomerType } from '../order/customerType';
import { isOrderStatus } from '../order/orderStatus';

export class BusinessActivityInputError extends Error {}
export type BusinessActivityFilters = Pick<BusinessFilters, 'customerType' | 'status' | 'source'>;
export type BusinessActivityWindow = {
  weeks: number;
  asOf: string;
  from: string;
  to: string;
  start: string;
  endExclusive: string;
};
export type BusinessActivityResponse = BusinessActivityWindow & {
  timezone: typeof BUSINESS_TIMEZONE;
  filters: BusinessActivityFilters;
  coverage: { historyFrom: string | null };
  days: Pick<BusinessDay, 'date' | 'orderCount' | 'activityValue' | 'valueCount' | 'available' | 'partial'>[];
};

/** A viewport-sized calendar always ends in the current Ljubljana week. */
export function resolveBusinessActivityWindow(value: string | null, asOf = new Date()): BusinessActivityWindow {
  const weeks = value === null ? 53 : Number(value);
  if (value !== null && !/^\d+$/.test(value) || !Number.isSafeInteger(weeks) || weeks < 1 || weeks > 520) {
    throw new BusinessActivityInputError('Število tednov mora biti celo število med 1 in 520.');
  }
  if (!Number.isFinite(asOf.getTime())) throw new BusinessActivityInputError('Neveljaven referenčni čas.');
  const to = localDate(asOf);
  const mondayOffset = (new Date(to + 'T12:00:00Z').getUTCDay() + 6) % 7;
  const from = addCalendarDays(to, -mondayOffset - (weeks - 1) * 7);
  return { weeks, asOf: asOf.toISOString(), from, to, start: localInstant(from).toISOString(), endExclusive: asOf.toISOString() };
}

/** Period controls and caller-supplied reference times intentionally have no effect. */
export function parseBusinessActivityQuery(params: URLSearchParams, asOf = new Date()) {
  const customerType = params.get('customerType') ?? 'all';
  const status = params.get('status') ?? 'all';
  const source = params.get('source') ?? 'all';
  if (customerType !== 'all' && customerType !== 'unknown' && !isCustomerType(customerType)) throw new BusinessActivityInputError('Neveljaven tip naročnika.');
  if (status !== 'all' && !isOrderStatus(status)) throw new BusinessActivityInputError('Neveljaven status.');
  if (source !== 'all' && source !== 'direct' && source !== 'quote') throw new BusinessActivityInputError('Neveljaven vir naročila.');
  return { window: resolveBusinessActivityWindow(params.get('weeks'), asOf), filters: { customerType, status, source } satisfies BusinessActivityFilters };
}

/** Count the same submitted-order population and exact net cents as the business report. */
export function buildBusinessActivity(
  orders: CanonicalOrder[],
  window: BusinessActivityWindow,
  filters: BusinessActivityFilters,
  historyFrom: string | null
): BusinessActivityResponse {
  const daily = new Map<string, CanonicalOrder[]>();
  for (const order of orders) {
    if (!matchesBusinessFilters(order, { range: 'custom', ...filters }) || !inPeriod(order.submittedAt, window)) continue;
    const date = localDate(order.submittedAt);
    const rows = daily.get(date) ?? [];
    rows.push(order);
    daily.set(date, rows);
  }
  return {
    ...window,
    timezone: BUSINESS_TIMEZONE,
    filters,
    coverage: { historyFrom },
    days: calendarDates(window.from, window.to).map(date => {
      const rows = daily.get(date) ?? [];
      return {
        date,
        orderCount: rows.length,
        activityValue: sumCents(rows.map(order => order.activityCents)) ?? 0,
        valueCount: rows.filter(order => order.activityCents !== null).length,
        available: historyFrom !== null && date >= historyFrom,
        partial: date === window.to
      };
    })
  };
}
