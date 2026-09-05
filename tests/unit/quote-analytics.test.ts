import assert from 'node:assert/strict';
import test from 'node:test';
import { aggregateBusinessAnalytics, quoteDeadline } from '@/shared/domain/analytics/metrics';
import { resolveBusinessPeriod } from '@/shared/domain/analytics/period';
import { buildBusinessQuotePreview, projectBusinessQuoteSummary } from '@/shared/domain/analytics/quotePreview';
import type { CanonicalQuote } from '@/shared/domain/analytics/businessAnalytics';
const asOf = new Date('2026-09-05T12:00:00.000Z');
const quote = (id: string, firstIssuedAt: string, acceptedAt: string | null): CanonicalQuote => ({ id, number: id, createdAt: new Date(Date.parse(firstIssuedAt) - 24 * 3600000).toISOString(), firstIssuedAt, acceptedAt, customerType: 'school', customerName: 'Preizkus', initialValueCents: 10000, mature: quoteDeadline(firstIssuedAt) <= asOf.toISOString(), acceptedInWindow: acceptedAt !== null && acceptedAt <= quoteDeadline(firstIssuedAt) });
const rows = [quote('old', '2026-05-01T08:00:00.000Z', null), quote('a', '2026-07-15T08:00:00.000Z', '2026-07-16T08:00:00.000Z'), quote('b', '2026-08-01T08:00:00.000Z', '2026-09-03T08:00:00.000Z'), quote('c', '2026-08-05T08:00:00.000Z', null), quote('d', '2026-08-30T08:00:00.000Z', '2026-08-31T08:00:00.000Z')];
test('order-page quote cards project exactly the canonical first-issue cohort and mature denominator', () => {
  const preview = buildBusinessQuotePreview(rows, asOf);
  const filters = { range: '90D', source: 'all' as const, customerType: 'all' as const, status: 'all' };
  const canonical = aggregateBusinessAnalytics({ allOrders: [], quotes: rows, filters, period: resolveBusinessPeriod(filters, asOf), asOf: asOf.toISOString() });
  assert.deepEqual(preview.current, projectBusinessQuoteSummary(canonical.quotes));
  assert.deepEqual(preview.current, { issued: 4, mature: 3, accepted: 1, acceptanceRate: 1 / 3, medianResponseHours: 24, medianDecisionHours: 24 });
  assert.equal(preview.last30Days.issued, 1);
  assert.equal(preview.last30Days.mature, 0);
  assert.equal(preview.last30Days.acceptanceRate, null);
  assert.equal(preview.previous30Days?.issued, 3);
  const href = new URL(preview.href, 'https://example.test');
  assert.equal(href.pathname, '/admin/analitika');
  assert.equal(href.searchParams.get('view'), 'ponudbe');
  assert.equal(href.searchParams.get('range'), '90D');
  assert.equal(href.searchParams.get('asOf'), asOf.toISOString());
});
test('empty and incomplete quote history never fabricate conversion or prior comparison', () => {
  const empty = buildBusinessQuotePreview([], asOf);
  assert.equal(empty.current.issued, 0);
  assert.equal(empty.current.acceptanceRate, null);
  assert.equal(empty.current.medianDecisionHours, null);
  assert.equal(empty.previous30Days, null);
  assert.equal(buildBusinessQuotePreview(rows.slice(-1), asOf).previous30Days, null);
});
test('prior quote preview period ends at the same elapsed Ljubljana clock', () => {
  const preview = buildBusinessQuotePreview([...rows, quote('excluded-late', '2026-08-06T13:00:00.000Z', null)], asOf);
  assert.equal(preview.previous30Days?.issued, 3);
  assert.equal(preview.current.issued, 5);
});
