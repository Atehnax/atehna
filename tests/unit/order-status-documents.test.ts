import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import * as documentsPolicy from '../../src/shared/domain/order/orderStatusDocuments';
import { validateLockedOrderStatusDocuments } from '../../src/shared/server/orderStatusDocuments';
import type { PoolClient } from 'pg';

const { orderStatusDocumentBlock } = documentsPolicy;
const documentTypes = ['order_summary', 'purchase_order', 'dobavnica', 'predracun', 'invoice'];

test('document requirements cover every customer, source, target and document combination', () => {
  for (const customer_type of ['school', 'company', 'individual']) {
    for (const entry_source of ['website', 'manual', null]) {
      for (const is_historical of [false, true]) {
        for (const status of ['received', 'in_progress', 'cancelled', 'partially_sent', 'sent', 'finished']) {
          for (let mask = 0; mask < 32; mask += 1) {
            const available = documentTypes.filter((_, index) => mask & (1 << index));
            const has = (type: string) => available.includes(type);
            const expectedAllowed = !['partially_sent', 'sent', 'finished'].includes(status)
              || (is_historical ? has('invoice') :
                has('dobavnica') && (customer_type !== 'school' || has('purchase_order')) &&
                (status === 'finished'
                  ? has('invoice') && (entry_source === 'manual' || has('order_summary'))
                  : has('predracun')));
            assert.equal(orderStatusDocumentBlock({ customer_type, entry_source, is_historical }, status, available) === null,
              expectedAllowed, JSON.stringify({ customer_type, entry_source, is_historical, status, available }));
          }
        }
      }
    }
  }
});

test('blocked admin warning names the target and missing documents, without exempt documents', () => {
  const block = orderStatusDocumentBlock({ customer_type: 'company', entry_source: 'manual' }, 'finished', ['invoice']);
  assert.equal(block?.code, 'ORDER_STATUS_DOCUMENTS_REQUIRED');
  assert.deepEqual(block?.missingDocumentTypes, ['dobavnica']);
  assert.match(block!.message, /»Zaključeno«/u);
  assert.match(block!.message, /Dobavnica/u);
  assert.doesNotMatch(block!.message, /Predračun|Naročilnica|Potrditev naročila/u);
  const school = orderStatusDocumentBlock({ customer_type: 'school' }, 'sent', []);
  assert.deepEqual(school?.missingDocumentTypes, ['dobavnica', 'predracun', 'purchase_order']);
});

test('database guard checks only active current documents while retaining historical source invoices', async () => {
  const calls: string[] = [];
  const client = { query: async (sql: string, values: unknown[]) => {
    calls.push(sql); assert.deepEqual(values, [17]);
    return { rows: [{ type: 'invoice' }, { type: 'dobavnica' }] };
  } } as unknown as PoolClient;
  assert.equal(await validateLockedOrderStatusDocuments(client, 17, { entry_source: 'manual', customer_type: 'company' }, 'finished'), null);
  assert.match(calls[0], /d\.deleted_at is null/u);
  assert.match(calls[0], /d\.order_pricing_revision = o\.pricing_revision/u);
  assert.match(calls[0], /d\.order_delivery_plan_revision = o\.delivery_plan_revision/u);
  assert.match(calls[0], /o\.is_historical and d\.type = 'invoice'/u);
  assert.match(calls[0], /for share of d/u);
  assert.equal(await validateLockedOrderStatusDocuments(client, 17, {}, 'cancelled'), null);
  assert.equal(calls.length, 1);
});

test('status endpoint rejects missing documents before email confirmation or any status side effects', async () => {
  const sql: string[] = [];
  const row = { id: 17, status: 'in_progress', customer_type: 'school', entry_source: 'website', is_historical: false };
  const client = { query: async (query: string) => { sql.push(query); return { rows: query.includes('from orders') ? [row] : [] }; }, release() {} };
  const modules: Record<string, unknown> = {
    'next/server': { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } },
    '@/shared/server/historicalOrders': { rejectHistoricalOrderOperation: async () => null },
    '@/shared/server/db': { getPool: async () => ({ connect: async () => client }) },
    '@/shared/server/requestJson': { readRequiredJsonRecord: async (request: Request) => ({ ok: true, body: await request.json() }) },
    '@/shared/domain/order/orderStatus': { isOrderStatus: () => true },
    '@/shared/server/orderDeliveryPlan': { normalizeOrderDeliveryPlanRevision: () => 1 },
    '@/shared/server/inventoryPolicy': { isStockEnforcementEnabled: async () => false },
    '@/shared/server/orderStatusDocuments': { validateLockedOrderStatusDocuments: async (_client: unknown, _id: number, order: typeof row, status: string) => orderStatusDocumentBlock(order, status, []) },
    '@/shared/server/orderStockHolds': { OrderStockConflictError: class extends Error {}, OrderStockReconciliationRequiredError: class extends Error {} }
  };
  const exports: { POST?: (request: Request, props: unknown) => Promise<Response> } = {};
  const code = ts.transpileModule(readFileSync(resolve('src/admin/api/orders/[orderId]/status/route.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(code, { exports, require: (name: string) => modules[name] ?? {} });
  for (const confirmationOnly of [false, true]) {
    const response = await exports.POST!(new Request('http://localhost/status', { method: 'POST', body: JSON.stringify({ status: 'sent', confirmationOnly }) }), { params: Promise.resolve({ orderId: '17' }) });
    assert.equal(response.status, 409);
    assert.deepEqual((await response.json()).missingDocumentTypes, ['dobavnica', 'predracun', 'purchase_order']);
  }
  assert.equal(sql.filter((query) => query === 'rollback').length, 2);
  assert.equal(sql.some((query) => /update |insert |commit$/iu.test(query)), false);
});
