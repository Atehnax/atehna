import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildBusinessActivity,
  BusinessActivityInputError,
  parseBusinessActivityQuery,
  resolveBusinessActivityWindow
} from '@/shared/domain/analytics/activity';
import { aggregateBusinessAnalytics } from '@/shared/domain/analytics/metrics';
import { localDate, localInstant, resolveBusinessPeriod } from '@/shared/domain/analytics/period';
import type { BusinessFilters, CanonicalOrder } from '@/shared/domain/analytics/businessAnalytics';

const asOf = new Date('2026-09-05T10:00:00.000Z');
const filters = { customerType: 'all', source: 'all', status: 'all' } as const;
const order = (override: Partial<CanonicalOrder> = {}): CanonicalOrder => ({
  id: '1', number: 'N-1', submittedAt: '2026-09-01T10:00:00.000Z', fulfilledAt: null,
  customerKey: null, customerType: 'school', customerName: 'Šola', activityCents: 12345,
  fulfilledCents: null, refundCents: null, refundComplete: false, status: 'cancelled', source: 'direct',
  addressSnapshot: {}, snapshotOrigin: 'captured', shippingGrossCents: null, shippingTaxRate: null,
  shippingSnapshot: null, packedWeightGrams: null, carrierCostNetCents: null, parcelCount: null,
  preparationMinutes: null, oversize: null, lines: [], ...override
});

test('activity windows are Monday-aligned, span the requested width and end today without future days', () => {
  const window = resolveBusinessActivityWindow('80', asOf);
  assert.equal(new Date(window.from + 'T12:00:00Z').getUTCDay(), 1);
  assert.equal(window.to, '2026-09-05');
  assert.equal(window.start, localInstant(window.from).toISOString());
  assert.equal(window.endExclusive, asOf.toISOString());
  const result = buildBusinessActivity([], window, filters, null);
  assert.equal(result.days.length, 79 * 7 + 6);
  assert.equal(result.days.at(-1)?.date, '2026-09-05');
  assert.equal(result.days.filter(day => day.partial).length, 1);
  assert.equal(resolveBusinessActivityWindow(null, asOf).weeks, 53);
  assert.equal(resolveBusinessActivityWindow('53', asOf).from, '2025-09-01');
  assert.equal(resolveBusinessActivityWindow('1', asOf).from, '2026-08-31');
});

test('bounded week input rejects malformed and excessive spans before querying', () => {
  for (const value of ['0', '521', '-1', '1.5', '', ' ', '2e2', 'Infinity', 'NaN', '0x20']) {
    assert.throws(() => resolveBusinessActivityWindow(value, asOf), BusinessActivityInputError);
  }
  assert.equal(resolveBusinessActivityWindow('520', asOf).weeks, 520);
  assert.throws(() => resolveBusinessActivityWindow('1', new Date('invalid')), BusinessActivityInputError);
});

test('dashboard period and frozen reference parameters cannot affect the independent history window', () => {
  const params = new URLSearchParams('weeks=80&range=30D&from=2026-09-01&to=2026-09-02&asOf=2025-01-01');
  const current = parseBusinessActivityQuery(params, asOf);
  params.set('range', 'custom');
  params.set('from', 'not-a-date');
  params.set('asOf', '2099-01-01');
  assert.deepEqual(parseBusinessActivityQuery(params, asOf), current);
  assert.equal(current.window.asOf, asOf.toISOString());
  for (const invalid of ['source=invalid', 'customerType=invalid', 'status=invalid']) {
    assert.throws(() => parseBusinessActivityQuery(new URLSearchParams(invalid), asOf), BusinessActivityInputError);
  }
  const filtered = parseBusinessActivityQuery(new URLSearchParams('customerType=school&source=quote&status=cancelled'), asOf);
  assert.deepEqual(filtered.filters, { customerType: 'school', source: 'quote', status: 'cancelled' });
});

test('Ljubljana midnight and both DST changes preserve local Monday and calendar-day boundaries', () => {
  const spring = resolveBusinessActivityWindow('2', new Date('2026-03-30T00:30:00Z'));
  assert.equal(spring.from, '2026-03-23');
  assert.equal(spring.to, '2026-03-30');
  assert.equal(spring.start, '2026-03-22T23:00:00.000Z');
  const autumn = resolveBusinessActivityWindow('2', new Date('2026-10-26T00:30:00Z'));
  assert.equal(autumn.from, '2026-10-19');
  assert.equal(autumn.to, '2026-10-26');
  assert.equal(autumn.start, '2026-10-18T22:00:00.000Z');
  const yearBoundary = resolveBusinessActivityWindow('1', new Date('2026-12-31T23:30:00Z'));
  assert.equal(yearBoundary.to, '2027-01-01');
  assert.equal(yearBoundary.from, '2026-12-28');
  const result = buildBusinessActivity([
    order({ submittedAt: '2026-03-28T23:00:00.000Z' }),
    order({ id: '2', submittedAt: '2026-03-29T22:00:00.000Z' })
  ], spring, filters, '2026-03-23');
  assert.equal(result.days.find(day => day.date === '2026-03-29')?.orderCount, 1);
  assert.equal(result.days.find(day => day.date === '2026-03-30')?.orderCount, 1);
});

test('activity days match canonical report counts, exact cents, missing values and cancellation eligibility', () => {
  const window = resolveBusinessActivityWindow('80', asOf);
  const rows = [
    order({ id: 'history', submittedAt: '2024-01-01T10:00:00.000Z' }),
    order(),
    order({ id: '2', activityCents: 20001, source: 'quote' }),
    order({ id: '3', activityCents: null, status: 'new' }),
    order({ id: 'midnight', submittedAt: '2026-09-01T22:00:00.000Z', customerType: 'company' }),
    order({ id: 'future', submittedAt: asOf.toISOString() })
  ];
  for (const applied of [filters, { ...filters, source: 'quote' as const }, { ...filters, customerType: 'school' as const, status: 'cancelled' }]) {
    const businessFilters: BusinessFilters = { range: 'custom', from: window.from, to: window.to, ...applied };
    const full = aggregateBusinessAnalytics({
      allOrders: rows, quotes: [], filters: businessFilters,
      period: resolveBusinessPeriod(businessFilters, asOf), asOf: asOf.toISOString()
    });
    const activity = buildBusinessActivity(rows, window, applied, localDate(rows[0].submittedAt));
    assert.deepEqual(activity.days, full.days.map(({ date, orderCount, activityValue, valueCount, available, partial }) => ({
      date, orderCount, activityValue, valueCount, available, partial
    })));
  }
  const activity = buildBusinessActivity(rows, window, filters, '2024-01-01');
  const day = activity.days.find(day => day.date === '2026-09-01')!;
  assert.equal(day.orderCount, 3);
  assert.equal(day.activityValue, 323.46);
  assert.equal(day.valueCount, 2);
});

test('empty and unobserved history remain distinguishable independently of active customer filters', () => {
  const window = resolveBusinessActivityWindow('1', asOf);
  const empty = buildBusinessActivity([], window, filters, null);
  assert.ok(empty.days.every(day => day.orderCount === 0 && !day.available));
  const known = buildBusinessActivity([], window, { ...filters, customerType: 'school' }, '2026-09-02');
  assert.equal(known.days.find(day => day.date === '2026-09-01')?.available, false);
  assert.equal(known.days.find(day => day.date === '2026-09-02')?.available, true);
  assert.equal(known.days.find(day => day.date === '2026-09-02')?.orderCount, 0);
});
