import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

type Order = { order_number: string; archived_at: string | null; deleted_at: string | null; is_draft: boolean };
type Query = { sql: string; params?: unknown[] };
type Handler = (request: Request, props: { params: Promise<{ orderId: string }> }) => Promise<Response>;
const source = readFileSync(resolve(process.cwd(), 'src/admin/api/orders/[orderId]/archive/route.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function setup(initial: Order | null, options: { auditFails?: boolean; updateFails?: boolean } = {}) {
  let order = initial ? { ...initial } : null;
  let transactionBefore: Order | null = null;
  let connects = 0;
  let releases = 0;
  const queries: Query[] = [];
  const audit: Array<Record<string, unknown>> = [];
  const revalidated: number[] = [];
  const client = {
    async query(sql: string, params?: unknown[]) {
      queries.push({ sql, params });
      if (sql === 'begin') transactionBefore = order ? { ...order } : null;
      if (sql.startsWith('select ')) return { rows: order ? [{ ...order }] : [] };
      if (sql.startsWith('update ')) {
        if (options.updateFails) throw new Error('fixture update failure');
        if (order) order.archived_at = params?.[1] ? '2026-09-07T10:00:00Z' : null;
      }
      if (sql === 'rollback') order = transactionBefore ? { ...transactionBefore } : null;
      return { rows: [] };
    },
    release() { releases += 1; }
  };
  const modules: Record<string, unknown> = {
    'next/server': { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } },
    '@/shared/server/db': { getPool: async () => ({ connect: async () => { connects += 1; return client; } }) },
    '@/shared/server/audit': { insertAuditEventForRequest: async (_request: Request, event: Record<string, unknown>, transaction: unknown) => {
      assert.equal(transaction, client, 'audit must use the same locked transaction');
      if (options.auditFails) throw new Error('fixture audit failure');
      audit.push(event);
    } },
    '@/shared/server/revalidateAdminOrders': { revalidateAdminOrderPaths: (id: number) => revalidated.push(id) }
  };
  const exports: { PATCH?: Handler } = {};
  runInNewContext(compiled, {
    exports,
    require(id: string) { assert.ok(id in modules, `Unexpected operational dependency ${id}`); return modules[id]; },
    console: { error() {} }
  });
  assert.ok(exports.PATCH);
  return {
    async send(archived: unknown, id = '17') {
      return exports.PATCH!(new Request('http://localhost/api/admin/orders/17/archive', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ archived }) }), { params: Promise.resolve({ orderId: id }) });
    },
    queries, audit, revalidated,
    state: () => ({ order, connects, releases })
  };
}
const active: Order = { order_number: 'SI-17', archived_at: null, deleted_at: null, is_draft: false };

test('archive and unarchive update only archive state and write the audit inside the same row-locked transaction', async () => {
  const fixture = setup(active);
  const response = await fixture.send(true);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, archived: true });
  assert.deepEqual(fixture.queries.map(query => query.sql.split(' ')[0]), ['begin', 'select', 'update', 'commit']);
  assert.match(fixture.queries[1].sql, /for update$/u);
  assert.match(fixture.queries[2].sql, /^update orders set archived_at = case when \$2::boolean then now\(\) else null end where id = \$1$/u);
  assert.deepEqual([...fixture.queries[2].params!], [17, true]);
  assert.equal(fixture.audit[0].action, 'archived');
  assert.equal(fixture.audit[0].entityType, 'order');
  assert.equal(fixture.audit[0].entityId, '17');
  assert.deepEqual(fixture.revalidated, [17]);
  assert.equal(fixture.state().releases, 1);
  assert.equal((await fixture.send(false)).status, 200);
  assert.equal(fixture.state().order?.archived_at, null);
  assert.equal(fixture.audit[1].action, 'restored');
  assert.equal(fixture.state().order?.deleted_at, null);
  assert.equal(fixture.state().releases, 2);
  assert.doesNotMatch(fixture.queries.map(query => query.sql).join('\n'), /stock|inventory|payment|shipping|email|delete\s+from|order_documents/iu);
});

test('repeating the current archive state is idempotent and produces no duplicate audit or update', async () => {
  for (const archived of [false, true]) {
    const fixture = setup({ ...active, archived_at: archived ? '2026-01-01T00:00:00Z' : null });
    assert.equal((await fixture.send(archived)).status, 200);
    assert.deepEqual(fixture.queries.map(query => query.sql.split(' ')[0]), ['begin', 'select', 'commit']);
    assert.equal(fixture.audit.length, 0);
    assert.equal(fixture.state().releases, 1);
  }
});

test('missing and deleted orders cannot enter or leave the business archive', async () => {
  for (const record of [null, { ...active, deleted_at: '2026-01-01T00:00:00Z' }]) {
    const fixture = setup(record);
    assert.equal((await fixture.send(true)).status, 404);
    assert.deepEqual(fixture.queries.map(query => query.sql.split(' ')[0]), ['begin', 'select', 'rollback']);
    assert.equal(fixture.audit.length, 0);
    assert.equal(fixture.revalidated.length, 0);
    assert.equal(fixture.state().releases, 1);
  }
});

test('invalid archive requests never acquire a database connection', async () => {
  for (const [archived, id] of [[null, '17'], ['true', '17'], [true, '0'], [true, '1.5'], [false, '9007199254740993']]) {
    const fixture = setup(active);
    assert.equal((await fixture.send(archived, String(id))).status, 400);
    assert.equal(fixture.state().connects, 0);
  }
});

test('audit or update failure rolls back the state and does not publish a successful refresh', async () => {
  for (const failure of [{ auditFails: true }, { updateFails: true }]) {
    const fixture = setup(active, failure);
    assert.equal((await fixture.send(true)).status, 500);
    assert.equal(fixture.queries.at(-1)?.sql, 'rollback');
    assert.equal(fixture.state().order?.archived_at, null);
    assert.equal(fixture.revalidated.length, 0);
    assert.equal(fixture.state().releases, 1);
  }
});
