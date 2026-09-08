import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { aggregateBusinessAnalytics, isRealisedOrder, matchesBusinessFilters, orderHref } from '@/shared/domain/analytics/metrics';
import { isPaidOrder, paidOrderCents, paidOrderNetCents } from '@/shared/domain/analytics/paidOrders';
import { parseBusinessOriginFilters } from '@/shared/domain/analytics/filters';
import { inPeriod, localDate, resolveBusinessPeriod } from '@/shared/domain/analytics/period';
import { isCustomerType } from '@/shared/domain/order/customerType';
import { isOrderStatus } from '@/shared/domain/order/orderStatus';
import type { BusinessFilters, CanonicalOrder } from '@/shared/domain/analytics/businessAnalytics';

const asOf = new Date('2026-09-08T12:00:00.000Z');
const filters: BusinessFilters = { range: 'custom', from: '2026-08-01', to: '2026-08-31', customerType: 'all', status: 'all', source: 'all' };
const order = (patch: Partial<CanonicalOrder> = {}): CanonicalOrder => ({
  id: '1', number: 'N-1', submittedAt: '2026-08-15T10:00:00.000Z', fulfilledAt: null,
  paymentStatus: 'paid', contractStatus: 'accepted', paidCents: 12001, activityCents: 10000, fulfilledCents: null,
  customerKey: 'profile:1', customerType: 'company', customerName: 'Primer', refundCents: 0, refundComplete: true,
  status: 'in_progress', source: 'direct', entrySource: 'manual', isHistorical: false, addressSnapshot: {}, snapshotOrigin: 'captured',
  shippingGrossCents: null, shippingTaxRate: null, shippingSnapshot: null, packedWeightGrams: null, carrierCostNetCents: null,
  parcelCount: null, preparationMinutes: null, oversize: null,
  lines: [{ id: 'line', key: 'sku:1', name: 'Artikel', category: 'Primer', quantity: 1, lineNetCents: 12001, unitCostCents: 4000 }], ...patch
});
const aggregate = (rows: CanonicalOrder[], patch: Partial<BusinessFilters> = {}) => {
  const selected = { ...filters, ...patch };
  return aggregateBusinessAnalytics({ allOrders: rows, quotes: [], filters: selected, period: resolveBusinessPeriod(selected, asOf), asOf: asOf.toISOString() });
};

// Exercise the real server declarations with a controlled canonical database reader.
function server(rows: CanonicalOrder[]) {
  const path = 'src/shared/server/businessAnalytics.ts';
  const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
  const names = ['BusinessAnalyticsInputError', 'parseBusinessFilters', 'parseBusinessAsOf', 'optionalBound', 'fetchBusinessRecords', 'businessRecordsCsv', 'iso', 'object', 'nullableNumber', 'decimalCents', 'mapCanonicalOrder', 'canonicalOrdersCandidatesSql', 'canonicalOrdersSql'];
  const selected = source.statements.filter(statement => ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement) ? names.includes(statement.name?.text ?? '') : ts.isVariableStatement(statement) && statement.declarationList.declarations.some(declaration => ts.isIdentifier(declaration.name) && names.includes(declaration.name.text)));
  assert.equal(selected.length, names.length);
  const code = ts.transpileModule(selected.map(node => node.getText(source)).join('\n'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  return runInNewContext(`${code}; ({ ${names.join(', ')} });`, { exports: {}, isPaidOrder, paidOrderCents, paidOrderNetCents, matchesBusinessFilters, isRealisedOrder, orderHref, inPeriod, localDate, resolveBusinessPeriod, isCustomerType, isOrderStatus, parseBusinessOriginFilters, readOrders: async () => rows, withSnapshot: (run: (client: object) => unknown) => run({}) });
}
const params = (extra = '') => new URLSearchParams(`range=custom&from=2026-08-01&to=2026-08-31&asOf=${asOf.toISOString()}&${extra}`);

test('core paid cohort requires payment and excludes cancelled, rejected and refunded mismatches', () => {
  const rows = [order(), order({ id: 'sent-unpaid', status: 'sent', paymentStatus: 'unpaid' }), order({ id: 'finished-unpaid', status: 'finished', paymentStatus: 'unpaid' }), order({ id: 'refunded', paymentStatus: 'refunded' }), order({ id: 'cancelled-paid', status: 'cancelled' }), order({ id: 'rejected-paid', contractStatus: 'rejected' }), order({ id: 'unknown', paymentStatus: null })];
  assert.deepEqual(rows.filter(isPaidOrder).map(row => row.id), ['1']);
  const result = aggregate(rows);
  assert.equal(result.paid.count, 1);
  assert.equal(result.paid.excludedCount, 2);
  assert.equal(result.paid.value, 120.01);
  assert.equal(result.summary.orderCount, 7, 'operational activity retains non-paying and cancelled entries');
  assert.equal(result.summary.realisedCount, 0, 'payment does not require shipment');
});

test('paid values use saved current order amount rather than superseded submission or shipping snapshot', () => {
  const mapped = server([]).mapCanonicalOrder({ id: '1', order_number: 'N-1', created_at: order().submittedAt, currency: 'EUR', subtotal: '120.01', payment_status: 'paid', status: 'received', contract_status: 'pending_seller_acceptance', analytics_snapshot_json: { origin: 'captured', subtotalNetCents: 10000, shippingGrossCents: 2000 }, analytics_fulfilled_merchandise_net: '90.00' });
  assert.equal(mapped.activityCents, 10000);
  assert.equal(mapped.paidCents, 12001);
  assert.equal(mapped.paymentStatus, 'paid');
  assert.equal(aggregate([mapped]).paid.value, 120.01);
  assert.equal(aggregate([{ ...mapped, paidCents: null }]).paid.value, null, 'unsupported currency or missing paid value cannot use stale fallback');
});

test('manual and historical entries enter paid cohort only with explicit payment', () => {
  const result = aggregate([order({ isHistorical: true, snapshotOrigin: 'legacy', refundCents: null, refundComplete: false }), order({ id: '2', isHistorical: true, status: 'finished', paymentStatus: 'unpaid' }), order({ id: '3', entrySource: 'website', paidCents: 20000 })], { entrySource: 'manual', history: 'historical' });
  assert.equal(result.paid.count, 1);
  assert.equal(result.paid.value, 120.01);
  assert.equal(result.paid.refundAdjustedValue, null);
  assert.equal(result.paid.refundKnownOrders, 0);
});

test('daily totals, comparison, histograms and boxes share the same paid cohort and order-date boundaries', () => {
  const rows = [order({ id: 'old', submittedAt: '2026-01-01T12:00:00.000Z', paymentStatus: 'unpaid' }), order({ id: 'comparison', submittedAt: '2026-07-15T12:00:00.000Z', paidCents: 9000 }), order({ submittedAt: '2026-07-31T22:00:00.000Z' }), order({ id: '2', paidCents: 20000, fulfilledAt: '2026-09-01T10:00:00.000Z' }), order({ id: 'unpaid', paymentStatus: 'unpaid', paidCents: 999999 })];
  const paid = aggregate(rows).paid;
  assert.equal(paid.count, 2);
  assert.equal(paid.value, 320.01);
  assert.equal(paid.previousCount, 1);
  assert.equal(paid.previousValue, 90);
  assert.equal(paid.orders.statistics.mean, 160.005);
  assert.equal(paid.orders.statistics.median, 160.005);
  assert.equal(paid.days[0].orderCount, 1, 'Ljubljana midnight selects order date');
  assert.equal(paid.days.reduce((sum, day) => sum + day.orderCount, 0), paid.count);
  assert.equal(paid.days.reduce((sum, day) => sum + Math.round(day.activityValue * 100), 0), 32001);
  assert.equal(paid.orders.histogram.reduce((sum, bin) => sum + bin.count, 0), 2);
  assert.equal(paid.orders.boxes.reduce((sum, box) => sum + box.n, 0), 2);
  assert.equal(aggregate([order()]).paid.previousValue, null);
});

test('unknown paid amounts and refund histories remain visibly incomplete while observed empty cohorts are zero', () => {
  const paid = aggregate([order(), order({ id: '2', paidCents: null })]).paid;
  assert.equal(paid.count, 2);
  assert.equal(paid.valueOrders, 1);
  assert.equal(paid.value, null);
  assert.equal(paid.orders.statistics.missing, 1);
  assert.equal(paid.days.find(day => day.orderCount === 2)?.valueCount, 1);
  assert.equal(aggregate([order({ refundCents: 2000 })]).paid.refundAdjustedValue, 100.01);
  assert.equal(aggregate([order({ refundComplete: false })]).paid.refundAdjustedValue, null);
  const empty = aggregate([order({ paymentStatus: 'unpaid' })]).paid;
  assert.equal(empty.count, 0); assert.equal(empty.value, 0); assert.equal(empty.orders.statistics.mean, null);
});

test('customer concentration and retention ignore earlier unpaid purchases and preserve stable identities', () => {
  const result = aggregate([order({ id: 'older-unpaid', paymentStatus: 'unpaid', submittedAt: '2026-01-01T12:00:00.000Z' }), order(), order({ id: 'unlinked', customerKey: null }), order({ id: 'cancelled', status: 'cancelled', customerKey: 'profile:2' })]);
  assert.equal(result.customers.totalCustomers, 1);
  assert.equal(result.customers.customers[0].value, 120.01);
  assert.equal(result.customers.unlinkedOrders, 1);
  assert.equal(result.cohorts.rows[0].month, '2026-08');
  assert.equal(result.cohorts.rows[0].customers, 1);
});

test('paid product contribution uses recorded costs only and excludes unpaid and cancelled item demand', () => {
  const result = aggregate([order(), order({ id: 'missing-cost', lines: [{ ...order().lines[0], unitCostCents: null }] }), order({ id: 'unpaid', paymentStatus: 'unpaid' }), order({ id: 'cancelled', status: 'cancelled' })]);
  assert.equal(result.products.soldUnits, 2);
  assert.equal(result.products.costCoveredUnits, 1);
  assert.equal(result.products.points[0].value, 240.02);
  assert.equal(result.products.points[0].contributionPerUnit, 80.01);
  assert.match(result.definitions.costs, /ni čisti dobiček/);
  assert.match(result.products.points[0].href, /basis=paid/);
});

test('protected record selector, CSV, histogram bounds and customer/product drilldowns reconcile with paid totals', async () => {
  const rows = [order(), order({ id: '2', paidCents: 20000, customerKey: 'profile:2' }), order({ id: '3', paymentStatus: 'unpaid' }), order({ id: '4', status: 'cancelled' })];
  const api = server(rows), result = aggregate(rows);
  const records = await api.fetchBusinessRecords(params('basis=paid'), true);
  assert.equal(records.total, result.paid.count);
  assert.equal(records.records.reduce((sum: number, row: { value: number }) => sum + row.value, 0), result.paid.value);
  assert.ok(records.records.every((row: { paymentStatus: string }) => row.paymentStatus === 'paid'));
  assert.equal((await api.fetchBusinessRecords(params('basis=paid&min=120&max=121'), true)).total, 1);
  assert.equal((await api.fetchBusinessRecords(params('basis=paid&productKey=sku:1'), true)).total, 2);
  assert.equal((await api.fetchBusinessRecords(params('basis=lorenz&topCustomerCount=1'), true)).records[0].id, '2');
  assert.equal((await api.fetchBusinessRecords(params('basis=paid&cohort=2026-08&cohortMonth=0'), true)).total, 2);
  assert.equal((await api.fetchBusinessRecords(params('basis=activity'), true)).total, 4);
  const csv = api.businessRecordsCsv(records.records);
  assert.match(csv, /Status plačila/);
  assert.equal(csv.split('\r\n').length, result.paid.count + 1);
});

test('canonical SQL retains draft, trash and test exclusions for both paid and operational analytics', () => {
  const sql = server([]).canonicalOrdersSql(false, false);
  assert.match(sql, /candidate\.payment_status/);
  assert.match(sql, /order_record\.deleted_at is null/);
  assert.match(sql, /order_record\.is_draft = false/);
  assert.match(sql, /order_record\.analytics_is_test = false/);
  assert.match(sql, /coalesce\(source_request\.intake_source, ''\) <> 'admin_testing'/);
  assert.match(sql, /candidate\.opportunity_order_rank = 1/);
  assert.doesNotMatch(sql, /archived_at is null/);
});
