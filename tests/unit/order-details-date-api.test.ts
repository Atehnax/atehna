import * as manualDraftCustomer from '../../src/shared/domain/order/manualDraftCustomer';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import * as dateTime from '../../src/shared/domain/order/dateTime';
import * as period from '../../src/shared/domain/analytics/period';
import * as historicalDomain from '../../src/shared/domain/order/historicalOrder';
import * as auditDiff from '../../src/shared/audit/auditDiff';
type Handler = (request: Request, props: { params: Promise<{ orderId: string }> }) => Promise<Response>;
const compile = (file: string) => ts.transpileModule(readFileSync(resolve(file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const routeSource = compile('src/admin/api/orders/[orderId]/details/route.ts');
const historicalSource = compile('src/shared/server/historicalOrders.ts');
function setup(isHistorical = false) {
  let row: Record<string, unknown> = {
    id: 17, order_number: '#17', customer_type: 'individual', contact_name: 'Original customer', email: 'fixture@example.test',
    address_line1: 'Original1', postal_code: '1000', city: 'Ljubljana', country_code: 'SI',
    created_at: '2024-07-14T22:37:25.123Z', recorded_at: '2026-09-07T10:00:00.000Z',
    is_historical: isHistorical, is_draft: isHistorical, deleted_at: null, entry_source: isHistorical ? 'manual' : 'website',
    status: 'received', payment_status: 'unpaid', historical_fulfilled_at: null, historical_payment_at: null,
    historical_revision: '0', pricing_revision: 1, original_reference_system: 'ERP', original_reference: 'OLD17',
    commitment_status: 'pending_confirmation', contract_status: 'pending_seller_acceptance',
    subtotal: '100.00', tax: '22.00', shipping: '3.00', total: '125.00', parcel_count: 1,
    refund_history_complete: false, merchandise_refund_net: null
  };
  let before = { ...row };
  const writes: Array<{ sql: string; params: unknown[] }> = [];
  const auditEvents: Record<string, unknown>[] = [];
  const history: unknown[][] = [];
  const client = {
    async query(sql: string, params: unknown[] = []) {
      const normalized = sql.trim().toLowerCase();
      if (normalized === 'begin') before = { ...row };
      if (normalized === 'rollback') row = { ...before };
      if (normalized.startsWith('select 1 from order_stock_holds')) return { rows: [], rowCount: 0 };
      if (normalized.startsWith('select count(*)')) return { rows: [{ count: 1 }] };
      if (normalized.startsWith('select ') && normalized.includes('from orders')) return { rows: [{ ...row }] };
      if (normalized.startsWith('update orders')) {
        writes.push({ sql, params });
        if (normalized.includes('set customer_type')) {
          row = { ...row, customer_type: params[0], contact_name: params[2], created_at: params[10] ?? row.created_at };
        } else if (normalized.includes('set original_reference_system')) {
          row = { ...row, ...JSON.parse(String(params[15] ?? '{}')), created_at: params[3], historical_fulfilled_at: params[4], historical_payment_at: params[5],
            status: params[6], payment_status: params[7], is_draft: !params[11], historical_revision: String(Number(row.historical_revision) + 1) };
        }
        return { rows: [{ ...row }] };
      }
      if (normalized.startsWith('insert into order_historical_changes')) history.push(params);
      return { rows: [], rowCount: 0 };
    },
    release() {}
  };
  const pool = { connect: async () => client };
  const audit = { getAuditActor: async () => ({ actor_id: 'admin:date-test' }), insertAuditEventForRequest: async (_request: Request, event: Record<string, unknown>) => { auditEvents.push(event); } };
  const revalidate = { revalidateAdminOrderPaths() {} };
  const modules: Record<string, unknown> = {
    '@/shared/domain/order/manualDraftCustomer': manualDraftCustomer,
    'server-only': {}, 'next/server': { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } },
    './orders': { getOrderNumberAvailability: async () => null }, './gursAddresses': { getGursAddressById: async () => null },
    './db': { getPool: async () => pool }, '@/shared/server/db': { getPool: async () => pool },
    './audit': audit, '@/shared/server/audit': audit,
    './revalidateAdminOrders': revalidate, '@/shared/server/revalidateAdminOrders': revalidate,
    '@/shared/domain/order/historicalOrder': historicalDomain,
    '@/shared/domain/order/dateTime': dateTime, '@/shared/domain/analytics/period': period,
    '@/shared/server/orders': { getOrderNumberAvailability: async () => null },
    '@/shared/server/gursAddresses': { getGursAddressById: async () => null },
    '@/shared/audit/auditDiff': auditDiff,
    '@/shared/server/requestJson': { readRequiredJsonRecord: async (request: Request) => ({ ok: true, body: await request.json() }) },
    '@/shared/server/inventoryPolicy': { isStockEnforcementEnabled: async () => false },
    '@/shared/domain/inventory/inventoryPolicy': { stockEnforcementAppliedAfterDraftFinalization: () => false },
    '@/shared/domain/shipping/shipping': { validatePersistedOrderShippingReadiness: () => { throw new Error('Unexpected live draft finalization'); } },
    '@/shared/server/orderStockHolds': {
      commitOrderStockHolds: async () => { throw new Error('Unexpected stock mutation'); },
      OrderStockConflictError: class extends Error {}, OrderStockReconciliationRequiredError: class extends Error {}
    }
  };
  const load = (code: string) => {
    const exports = {};
    runInNewContext(code, { exports, require: (name: string) => { assert(name in modules, 'Unexpected dependency ' + name); return modules[name]; } });
    return exports;
  };
  modules['@/shared/server/historicalOrders'] = load(historicalSource);
  const { POST } = load(routeSource) as { POST: Handler };
  return {
    send: (body: Record<string, unknown>) => POST(new Request('http://localhost/api/admin/orders/17/details', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), { params: Promise.resolve({ orderId: '17' }) }),
    state: () => row, writes, history, auditEvents
  };
}
test('ordinary details persist summer and winter calendar dates as Ljubljana midnight', async () => {
  for (const [input, expected] of [['2024-07-16', '2024-07-15T22:00:00.000Z'], ['15/01/2024', '2024-01-14T23:00:00.000Z']]) {
    const fixture = setup();
    assert.equal((await fixture.send({ orderDate: input })).status, 200);
    assert.equal(fixture.state().created_at, expected);
    assert.ok(fixture.auditEvents.length > 0);
    assert.match(fixture.writes[0].sql, /created_at = coalesce\(\$11::timestamptz, created_at\)/);
  }
});
test('omitted or explicitly unchanged date preserves original time while other details save', async () => {
  for (const historical of [false, true]) {
    for (const body of [{ contactName: 'New customer' }, { contactName: 'New customer', orderDate: '2024-07-15' }]) {
      const fixture = setup(historical);
      assert.equal((await fixture.send(body)).status, 200);
      assert.equal(fixture.state().contact_name, 'New customer');
      assert.equal(fixture.state().created_at, '2024-07-14T22:37:25.123Z');
      assert.equal(fixture.state().recorded_at, '2026-09-07T10:00:00.000Z');
      assert.equal(fixture.state().historical_fulfilled_at, null);assert.equal(fixture.state().historical_payment_at, null);
      assert.equal(fixture.writes[0].params[10], null);
      if (historical) assert.equal(fixture.state().is_draft, true);
    }
  }
});
test('invalid explicit calendar inputs reject before details writes', async () => {
  for (const input of ['', null, 20240715, '2024-02-30', '31/02/2024', '2024-07-15T00:00:00Z']) {
    const fixture = setup();
    assert.equal((await fixture.send({ orderDate: input })).status, 400);
    assert.equal(fixture.writes.length, 0);
  }
});
test('historical customer details cannot bypass date revision and original-facts audit', async () => {
  const fixture = setup(true);
  const response = await fixture.send({ contactName: 'New customer', orderDate: '2024-07-16' });
  assert.equal(response.status, 409);assert.equal((await response.json()).code, 'ORDER_HISTORICAL_DATE_REQUIRES_FACTS');
  assert.equal(fixture.writes.length, 0);assert.equal(fixture.state().historical_revision, '0');
  const updated = await fixture.send({ expectedHistoricalRevision: '0', orderDate: '2024-07-16' });
  assert.equal(updated.status, 200);assert.equal(fixture.state().created_at, '2024-07-15T22:00:00.000Z');
  assert.equal(fixture.state().historical_revision, '1');assert.equal(fixture.history.length, 1);
  assert.equal(fixture.state().recorded_at, '2026-09-07T10:00:00.000Z');
  assert.equal(fixture.state().historical_fulfilled_at, null);assert.equal(fixture.state().historical_payment_at, null);
  assert.equal(fixture.state().payment_status, 'unpaid');
  assert.equal((await fixture.send({ expectedHistoricalRevision: '0', orderDate: '2024-07-17' })).status, 409);
});

