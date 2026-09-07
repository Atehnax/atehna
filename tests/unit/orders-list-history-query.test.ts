import * as manualDraftSql from '../../src/shared/server/manualDraftCustomers';
import * as manualDraftCustomer from '../../src/shared/domain/order/manualDraftCustomer';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as publicCodes from '@/shared/domain/commercePublicCode';
import * as pagination from '@/shared/domain/pagination';
import { ORDER_ATTENTION_STATUSES } from '@/shared/domain/order/orderStatus';
import type { fetchOrdersListPage, fetchOrderAttentionCount } from '@/shared/server/orders';
const source = readFileSync(resolve(process.cwd(), 'src/shared/server/orders.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function loader(rawOrders: Record<string, unknown>[] = []) {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  const modules: Record<string, unknown> = {
    '@/shared/domain/order/manualDraftCustomer': manualDraftCustomer,
    '@/shared/server/manualDraftCustomers': manualDraftSql,
    '@/shared/server/db': { getPool: async () => ({ query: async (sql: string, params: unknown[] = []) => {
      assert.match(sql.trim(), /^(with|select) /u, 'loader must remain read-only');
      queries.push({ sql, params: [...params] });
      return { rows: [{ total_count: rawOrders.length, orders_json: rawOrders, documents_json: [], count: 3 }] };
    } }) },
    '@/shared/server/diagnostics/instrumentation': {
      instrumentCatalogLoader: (_name: string, _path: string, task: () => unknown) => task(),
      profileRoutePhase: (_phase: string, _name: string, task: () => unknown) => task()
    },
    '@/shared/domain/order/orderTypes': { normalizeOrderPdfFilenameForPresentation: (_type: string, filename: string) => filename },
    '@/shared/domain/pagination': pagination,
    '@/shared/domain/order/orderStatus': { ORDER_ATTENTION_STATUSES },
    '@/shared/domain/commercePublicCode': publicCodes
  };
  const exports: { fetchOrdersListPage?: typeof fetchOrdersListPage; fetchOrderAttentionCount?: typeof fetchOrderAttentionCount } = {};
  runInNewContext(compiled, { exports, require(id: string) { assert.ok(id in modules, `Unexpected loader dependency ${id}`); return modules[id]; } });
  return { list: exports.fetchOrdersListPage!, attention: exports.fetchOrderAttentionCount!, queries };
}
function verifyBindings(query: { sql: string; params: unknown[] }) {
  const positions = [...new Set([...query.sql.matchAll(/\$(\d+)/gu)].map(match => Number(match[1])))].sort((a, b) => a - b);
  assert.deepEqual(positions, Array.from({ length: query.params.length }, (_, index) => index + 1));
}

test('default order loader excludes trash and business archive with25 rows; explicit archive keeps identical scope filters', async () => {
  const fixture = loader();
  await fixture.list();
  assert.match(fixture.queries[0].sql, /orders.deleted_at is null and orders.archived_at is null/u);
  assert.deepEqual(fixture.queries[0].params, [25, 0]);
  verifyBindings(fixture.queries[0]);
  await fixture.list({ archived: true, entrySource: 'unknown', history: 'historical', pageSize: 'all' });
  assert.match(fixture.queries[1].sql, /orders.archived_at is not null and orders.entry_source is null and orders.is_historical = true/u);
  assert.match(fixture.queries[1].sql, /orders.deleted_at is null/u);
  assert.doesNotMatch(fixture.queries[1].sql, /limit \$|offset \$/u);
  assert.equal(fixture.queries[1].params.length, 0);
});

test('source, dates, original reference and public offer code keep distinct exact bindings before document filter/pagination', async () => {
  const fixture = loader();
  const base = '23456789ABCDEFGH';
  const query = publicCodes.formatOfferCode(base, 3);
  await fixture.list({ archived: true, entrySource: 'manual', history: 'current', fromDate: '2024-01-01', toDate: '2024-12-31', status: 'sent', query, documentType: 'racun', page: 2, pageSize: 25 });
  const captured = fixture.queries[0];
  assert.deepEqual(captured.params, ['manual', '2024-01-01', '2024-12-31', 'sent', `%${query}%`, base, 3, 'racun', 25, 25]);
  assert.match(captured.sql, /orders.entry_source = \$1/u);
  assert.match(captured.sql, /orders.is_historical = false/u);
  assert.match(captured.sql, /orders.original_reference ilike \$5/u);
  assert.match(captured.sql, /orders.original_reference_system ilike \$5/u);
  assert.match(captured.sql, /public_code_request.public_code_base = \$6/u);
  assert.match(captured.sql, /public_code_offer.version_number = \$7/u);
  assert.match(captured.sql, /od.type = \$8/u);
  assert.match(captured.sql, /limit \$9\s+offset \$10/u);
  verifyBindings(captured);
});

test('unknown original reference text stays a parameter and does not become SQL or inferred website provenance', async () => {
  const fixture = loader();
  const text = "legacy-' or 1=1 --";
  await fixture.list({ entrySource: 'website', query: text, history: 'historical' });
  const query = fixture.queries[0];
  assert.deepEqual(query.params, ['website', `%${text}%`, 25, 0]);
  assert.ok(!query.sql.includes(text));
  assert.match(query.sql, /orders.original_reference ilike \$2/u);
  verifyBindings(query);
});

test('historical/source fields preserve null distinctions and both dates in loader output', async () => {
  const fixture = loader([{ id: 17, order_number: '17', public_code_base: '23456789ABCDEFGH', customer_type: 'company', created_at: '2022-01-02T10:00:00Z', recorded_at: '2026-09-07T09:00:00Z', entry_source: null, is_historical: true, original_reference_system: 'Prejšnji sistem', original_reference: 'OLD-17', archived_at: '2026-09-07T10:00:00Z', historical_revision: 4, merchandise_refund_net: '1.25', refund_history_complete: false }]);
  const result = await fixture.list({ archived: true });
  assert.equal(result.totalCount, 1);
  const order = result.orders[0];
  assert.equal(order.created_at, '2022-01-02T10:00:00Z');
  assert.equal(order.recorded_at, '2026-09-07T09:00:00Z');
  assert.equal(order.entry_source, null);
  assert.equal(order.is_historical, true);
  assert.equal(order.original_reference, 'OLD-17');
  assert.equal(order.original_reference_system, 'Prejšnji sistem');
  assert.equal(order.archived_at, '2026-09-07T10:00:00Z');
  assert.equal(order.historical_revision, 4);
  assert.equal(order.merchandise_refund_net, 1.25);
  assert.equal(order.refund_history_complete, false);
});

test('operational attention count excludes historical, archived and deleted orders together', async () => {
  const fixture = loader();
  assert.equal(await fixture.attention(), 3);
  assert.match(fixture.queries[0].sql, /orders.deleted_at is null\s+and orders.archived_at is null\s+and not orders.is_historical/u);
  assert.deepEqual([...fixture.queries[0].params[0] as string[]], [...ORDER_ATTENTION_STATUSES]);
});

test('manual legacy draft rows expose blank customer names without changing real identities or stored rows', async () => {
  const legacy={id:18,order_number:'#18',public_code_base:'23456789ABCDEFGH',customer_type:'company',contact_name:'Osnutek',organization_name:null,email:'draft@atehna.si',entry_source:'manual',is_draft:true,created_at:'2024-01-01T10:00:00Z'};
  const actual={...legacy,id:19,email:'real@example.test',address_line1:'Real street 2'};
  const fixture=loader([legacy,actual]);const result=await fixture.list({includeDrafts:true});
  assert.equal(result.orders[0].contact_name,'');assert.equal(result.orders[1].contact_name,'Osnutek');assert.equal(legacy.contact_name,'Osnutek');
  assert.doesNotMatch(fixture.queries[0].sql,/orders.contact_name in/);
  await fixture.list();assert.match(fixture.queries[1].sql,/orders.contact_name in/);
});
