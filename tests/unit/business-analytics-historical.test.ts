import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { aggregateBusinessAnalytics, isRealisedOrder, quoteDeadline } from '@/shared/domain/analytics/metrics';
import { parseBusinessOriginFilters } from '@/shared/domain/analytics/filters';
import { parseQuoteGoLiveDate, quoteAnalyticsStart, type BusinessAnalyticsSettings } from '@/shared/domain/analytics/businessSettings';
import { localInstant, resolveBusinessPeriod } from '@/shared/domain/analytics/period';
import { buildBusinessActivity, parseBusinessActivityQuery, resolveBusinessActivityWindow } from '@/shared/domain/analytics/activity';
import { buildBusinessQuotePreview } from '@/shared/domain/analytics/quotePreview';
import { isCustomerType } from '@/shared/domain/order/customerType';
import type { BusinessFilters, CanonicalOrder, CanonicalQuote, CanonicalQuoteRequest } from '@/shared/domain/analytics/businessAnalytics';

const asOf = new Date('2026-09-05T12:00:00.000Z');
const settings: BusinessAnalyticsSettings = { quoteGoLiveDate: '2026-08-01', revision: '1', updatedAt: null };
const filters: BusinessFilters = { range: 'custom', from: '2026-08-01', to: '2026-08-31', customerType: 'all', status: 'all', source: 'all' };
const order = (patch: Partial<CanonicalOrder> = {}): CanonicalOrder => ({
  id: '1', number: 'N-1', submittedAt: '2026-08-05T10:00:00.000Z', fulfilledAt: '2026-09-01T10:00:00.000Z',
  customerKey: 'profile:1', customerType: 'company', customerName: 'Primer', activityCents: 10000, fulfilledCents: 10000,
  refundCents: 0, refundComplete: true, status: 'finished', source: 'direct', entrySource: 'manual', isHistorical: false,
  addressSnapshot: {}, snapshotOrigin: 'captured', shippingGrossCents: null, shippingTaxRate: null, shippingSnapshot: null,
  packedWeightGrams: null, carrierCostNetCents: null, parcelCount: null, preparationMinutes: null, oversize: null,
  lines: [{ id: '1', key: 'variant:1', name: 'Artikel', category: 'Kategorija', quantity: 1, lineNetCents: 10000, unitCostCents: null }], ...patch
});
const request = (patch: Partial<CanonicalQuoteRequest> = {}): CanonicalQuoteRequest => ({ id: 'q1', number: 'POV-1', createdAt: '2026-08-01T10:00:00.000Z', customerType: 'company', customerName: 'Primer', entrySource: 'website', ...patch });
const quote = (patch: Partial<CanonicalQuote> = {}): CanonicalQuote => ({ ...request(), firstIssuedAt: '2026-08-02T10:00:00.000Z', acceptedAt: '2026-08-03T10:00:00.000Z', initialValueCents: 10000, mature: true, acceptedInWindow: true, ...patch });
function aggregate(orders: CanonicalOrder[], quotes: CanonicalQuote[] = [], requests: CanonicalQuoteRequest[] = [], applied: Partial<BusinessFilters> = {}, configured: BusinessAnalyticsSettings | undefined = settings) {
  const selected = { ...filters, ...applied };
  return aggregateBusinessAnalytics({ allOrders: orders, quotes, quoteRequests: requests, settings: configured, filters: selected, period: resolveBusinessPeriod(selected, asOf), asOf: asOf.toISOString() });
}

test('realised sums, products and customer cohorts use order date rather than later shipment date', () => {
  const august = order();
  const july = order({ id: '2', submittedAt: '2026-07-31T10:00:00.000Z', fulfilledAt: '2026-08-20T10:00:00.000Z', customerKey: 'profile:2' });
  const result = aggregate([august, july]);
  assert.equal(result.summary.orderCount, 1);
  assert.equal(result.summary.realisedCount, 1);
  assert.equal(result.summary.realisedValue, 100);
  assert.equal(result.customers.totalCustomers, 1);
  assert.equal(result.products.soldUnits, 1);
  assert.equal(result.cohorts.rows[0].month, '2026-08');
  assert.equal(result.cohorts.rows[0].retention[0], 1);
  assert.match(result.definitions.realised, /Datum odpreme ne določa obdobja/);
  assert.equal(aggregate([order({ fulfilledAt: '2026-09-06T12:00:00.000Z' })]).summary.realisedCount, 0);
});

test('completed historical orders contribute without inventing an unknown shipment date or refund history', () => {
  const historical = order({ isHistorical: true, realised: true, fulfilledAt: null, refundCents: null, refundComplete: false, snapshotOrigin: 'legacy' });
  const result = aggregate([historical]);
  assert.equal(result.summary.orderCount, 1);
  assert.equal(result.summary.activityValue, 100);
  assert.equal(result.summary.realisedCount, 1);
  assert.equal(result.summary.realisedValue, null);
  assert.equal(result.products.soldUnits, 1);
  assert.equal(result.cohorts.rows[0].month, '2026-08');
  assert.ok(result.coverage.warnings.some(warning => warning.includes('datum odpreme manjka')));
  assert.equal(isRealisedOrder(order({ realised: false, fulfilledAt: null }), asOf.toISOString()), false);
  assert.equal(historical.fulfilledAt, null);
});

test('entry channel and historical classification are independent of direct/quote flow and agree with heatmap', () => {
  const rows = [order(), order({ id: '2', source: 'quote', entrySource: 'manual', isHistorical: true }), order({ id: '3', source: 'quote', entrySource: 'website' }), order({ id: '4', entrySource: null })];
  assert.equal(aggregate(rows, [], [], { entrySource: 'manual' }).summary.orderCount, 2);
  assert.equal(aggregate(rows, [], [], { source: 'quote', entrySource: 'manual', history: 'historical' }).summary.orderCount, 1);
  assert.equal(aggregate(rows, [], [], { entrySource: 'unknown' }).summary.orderCount, 1);
  const selected = parseBusinessActivityQuery(new URLSearchParams('weeks=12&entrySource=manual&history=historical&source=quote'), asOf);
  const heatmap = buildBusinessActivity(rows, selected.window, selected.filters, '2026-01-01');
  assert.equal(heatmap.days.reduce((total, day) => total + day.orderCount, 0), 1);
  assert.equal(heatmap.days.reduce((total, day) => total + day.activityValue, 0), 100);
  assert.throws(() => parseBusinessOriginFilters(new URLSearchParams('entrySource=admin')));
  assert.throws(() => parseBusinessOriginFilters(new URLSearchParams('history=true')));
  assert.throws(() => parseBusinessActivityQuery(new URLSearchParams('history=invalid'), asOf));
  assert.equal(resolveBusinessActivityWindow('12', asOf).from, selected.window.from);
});

test('go-live is explicit, validates real dates and respects Ljubljana DST midnight', () => {
  assert.equal(parseQuoteGoLiveDate(null), null);
  for (const invalid of [undefined, '', '2026-02-30', '2099-01-01', 20260101]) assert.throws(() => parseQuoteGoLiveDate(invalid, '2026-09-05'));
  assert.equal(quoteAnalyticsStart('2026-03-29'), '2026-03-28T23:00:00.000Z');
  assert.equal(quoteAnalyticsStart('2026-03-30'), '2026-03-29T22:00:00.000Z');
  const unconfigured = aggregateBusinessAnalytics({ allOrders: [order()], quotes: [quote()], quoteRequests: [request()], filters, period: resolveBusinessPeriod(filters, asOf), asOf: asOf.toISOString() });
  assert.equal(unconfigured.summary.orderCount, 1);
  assert.equal(unconfigured.quotes.enabled, false);
  assert.equal(unconfigured.quotes.issuedCount, null);
  assert.equal(unconfigured.quotes.requestCount, null);
  assert.equal(unconfigured.summary.quoteAcceptance.rate, null);
  assert.equal(buildBusinessQuotePreview([quote()], asOf).current.issued, null);
});

test('request receipt and first offer issuance have separate go-live cohorts; tests and historical opportunities never convert', () => {
  const before = '2026-07-31T10:00:00.000Z';
  const at = localInstant('2026-08-01').toISOString();
  const requests = [request({ createdAt: at }), request({ id: 'manual', entrySource: 'manual' }), request({ id: 'before', createdAt: before }), request({ id: 'test', isTest: true }), request({ id: 'old', isHistorical: true })];
  const quotes = [quote({ createdAt: before }), quote({ id: 'manual', entrySource: 'manual' }), quote({ id: 'old-issue', firstIssuedAt: before }), quote({ id: 'test', isTest: true }), quote({ id: 'historical', isHistorical: true })];
  const result = aggregate([order({ isHistorical: true })], quotes, requests);
  assert.equal(result.quotes.requestCount, 2);
  assert.equal(result.quotes.issuedCount, 2);
  assert.equal(result.quotes.mature.total, 2);
  assert.equal(result.quotes.mature.accepted, 2);
  assert.equal(aggregate([], quotes, requests, { entrySource: 'manual' }).quotes.issuedCount, 1);
  assert.equal(aggregate([], quotes, requests, { history: 'historical' }).quotes.mature.total, 0);
  assert.equal(aggregate([], quotes, requests, { source: 'direct' }).quotes.issuedCount, 0);
});

function serverDeclarations(names: string[], bindings: Record<string, unknown>) {
  const path = 'src/shared/server/businessAnalytics.ts';
  const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
  const selected = source.statements.filter(statement => ts.isFunctionDeclaration(statement) ? names.includes(statement.name?.text ?? '') : ts.isVariableStatement(statement) && statement.declarationList.declarations.some(declaration => ts.isIdentifier(declaration.name) && names.includes(declaration.name.text)));
  assert.equal(selected.length, names.length);
  const code = ts.transpileModule(selected.map(node => node.getText(source)).join('\n'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  return runInNewContext(`${code}; ({ ${names.join(', ')} });`, { exports: {}, ...bindings });
}

test('canonical SQL and mapper use displayed date, retain archived records and preserve unknown entry channel', () => {
  const { mapCanonicalOrder, canonicalOrdersSql } = serverDeclarations(['iso', 'object', 'nullableNumber', 'decimalCents', 'mapCanonicalOrder', 'canonicalOrdersCandidatesSql', 'canonicalOrdersSql'], { isCustomerType });
  const row = { id: 1, order_number: 'N-1', created_at: '2026-03-28T23:00:00.000Z', analytics_submitted_at: '2026-09-01T12:00:00.000Z', contract_status: 'accepted', commitment_status: 'binding', status: 'finished', is_historical: true, currency: 'EUR', subtotal: '100.00', analytics_fulfilled_merchandise_net: '100.00' };
  const mapped: CanonicalOrder = mapCanonicalOrder(row);
  assert.equal(mapped.submittedAt, row.created_at);
  assert.equal(mapped.entrySource, null);
  assert.equal(mapped.isHistorical, true);
  assert.equal(mapped.realised, true);
  assert.equal(mapped.fulfilledAt, null);
  const sql: string = canonicalOrdersSql(false, true);
  assert.match(sql, /order_record\.created_at < \$1::timestamptz/);
  assert.match(sql, /candidate\.created_at >= \$2::timestamptz/);
  assert.match(sql, /deleted_at is null/);
  assert.match(sql, /analytics_is_test = false/);
  assert.doesNotMatch(sql, /archived_at is null|coalesce\([^)]*analytics_submitted_at/);
});

test('quote readers retain first-version deduplication and apply independent dates without querying unconfigured history', async () => {
  const calls: { sql: string; args: string[] }[] = [];
  const client = { query: async (sql: string, args: string[]) => { calls.push({ sql, args }); return { rows: [] }; } };
  const readers = serverDeclarations(['iso', 'object', 'decimalCents', 'quoteEntrySource', 'readQuotes', 'readQuoteRequests'], { isCustomerType, quoteDeadline, quoteAnalyticsStart, profileRoutePhase: (_a: string, _b: string, run: () => unknown) => run() });
  await readers.readQuotes(client, asOf, { ...settings, quoteGoLiveDate: null });
  await readers.readQuoteRequests(client, asOf, { ...settings, quoteGoLiveDate: null });
  assert.equal(calls.length, 0);
  await readers.readQuotes(client, asOf, settings);
  await readers.readQuoteRequests(client, asOf, settings);
  assert.match(calls[0].sql, /distinct on \(quote_request_id\)/);
  assert.match(calls[0].sql, /order by quote_request_id, issued_at, version_number, id/);
  assert.match(calls[0].sql, /first_issue\.issued_at >= \$2/);
  assert.match(calls[1].sql, /request\.created_at >= \$2/);
  for (const call of calls) {
    assert.equal(call.args[1], '2026-07-31T22:00:00.000Z');
    assert.match(call.sql, /intake_source <> 'admin_testing'/);
    assert.match(call.sql, /not exists[\s\S]*historical_order\.is_historical/);
  }
});
