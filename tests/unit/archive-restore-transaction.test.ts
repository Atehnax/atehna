import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

type Entry = { id: number; item_type: 'order' | 'pdf'; order_id: number | null; document_id: number | null; label: string };
type Order = { id: number; deleted_at: string | null; archived_at: string | null };
type Document = { id: number; order_id: number; deleted_at: string | null; stale?: boolean; quoteEvidence?: boolean };
type Target = Pick<Entry, 'item_type' | 'order_id' | 'document_id'>;
const compile = (path: string) => ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const serverCode = compile('src/shared/server/deletedArchive.ts');
const routeCode = compile('src/admin/api/archive/route.ts');
const deleted = '2026-09-08T10:00:00Z';
const parent: Entry = { id: 1, item_type: 'order', order_id: 17, document_id: null, label: 'N-17' };
const child: Entry = { id: 2, item_type: 'pdf', order_id: 17, document_id: 29, label: 'Račun N-17' };

function setup(options: { entries?: Entry[]; orders?: Order[]; documents?: Document[]; updateNoRows?: 'order' | 'pdf'; auditFails?: boolean } = {}) {
  let state = { entries: structuredClone(options.entries ?? [parent, child]), orders: structuredClone(options.orders ?? [{ id: 17, deleted_at: deleted, archived_at: deleted }]), documents: structuredClone(options.documents ?? [{ id: 29, order_id: 17, deleted_at: deleted }]), audit: [] as Array<Record<string, unknown>> };
  let before = structuredClone(state), connects = 0, releases = 0;
  const queries: string[] = [], revalidated: string[] = [];
  const client = {
    async query(sql: string, params: unknown[] = []) {
      queries.push(sql);
      const ids = (params[0] ?? []) as number[];
      if (sql === 'BEGIN') { before = structuredClone(state); return { rows: [] }; }
      if (sql === 'COMMIT') return { rows: [] };
      if (sql === 'ROLLBACK') { state = structuredClone(before); return { rows: [] }; }
      if (sql.includes('from deleted_archive_entries e')) {
        const targets = JSON.parse(String(params[1])) as Target[];
        return { rows: state.entries.filter(entry => ids.includes(entry.id) || targets.some(target => target.item_type === entry.item_type && target.order_id === entry.order_id && target.document_id === entry.document_id)).map(entry => ({ ...entry })) };
      }
      if (sql.startsWith('select id, order_id from order_documents')) return { rows: state.documents.filter(document => ids.includes(document.id)).map(document => ({ ...document })) };
      if (sql.startsWith('select id, deleted_at from orders')) return { rows: state.orders.filter(order => ids.includes(order.id)).map(order => ({ ...order })) };
      if (sql.startsWith('select id, order_id, deleted_at from order_documents')) return { rows: state.documents.filter(document => ids.includes(document.id)).map(document => ({ ...document })) };
      if (sql.startsWith('select id from orders')) return { rows: state.orders.filter(order => ids.includes(order.id) && order.deleted_at).map(order => ({ id: order.id })) };
      if (sql.includes('d.order_pricing_revision <>')) return { rows: state.documents.filter(document => ids.includes(document.id) && document.stale).map(document => ({ id: document.id })) };
      if (sql.includes("document.type = 'purchase_order'")) return { rows: state.documents.filter(document => ids.includes(document.id) && document.quoteEvidence).map(document => ({ id: document.id })) };
      if (sql.startsWith('update orders')) {
        if (options.updateNoRows === 'order') return { rows: [] };
        const rows = state.orders.filter(order => ids.includes(order.id) && order.deleted_at);
        for (const row of rows) row.deleted_at = null;
        return { rows: rows.map(row => ({ id: row.id })) };
      }
      if (sql.startsWith('update order_documents')) {
        if (options.updateNoRows === 'pdf') return { rows: [] };
        const rows = state.documents.filter(document => ids.includes(document.id) && document.deleted_at);
        for (const row of rows) row.deleted_at = null;
        return { rows: rows.map(row => ({ id: row.id })) };
      }
      if (sql.startsWith('delete from deleted_archive_entries')) {
        const rows = state.entries.filter(entry => ids.includes(entry.id));
        state.entries = state.entries.filter(entry => !ids.includes(entry.id));
        return { rows: rows.map(row => ({ id: row.id })) };
      }
      throw Error('Unexpected query: ' + sql);
    },
    release() { releases += 1; }
  };
  const modules: Record<string, unknown> = {
    '@/shared/server/db': { getPool: async () => ({ connect: async () => { connects += 1; return client; } }) },
    '@/shared/server/diagnostics/instrumentation': { instrumentCatalogLoader: (_name: string, _route: string, run: () => unknown) => run() },
    '@/shared/server/audit': { insertAuditEventForRequest: async (_request: Request, event: Record<string, unknown>, transaction: unknown) => {
      assert.equal(transaction, client);
      if (options.auditFails) throw Error('Audit failed');
      state.audit.push(event);
    } },
    '@/shared/server/purgeDeletedArchive': { ArchiveDeleteConflictError: class extends Error {}, permanentlyDeleteArchiveEntries: () => { throw Error('Not a restore'); } },
    '@/shared/server/requestJson': { readRequiredJsonRecord: async (request: Request) => ({ ok: true, body: await request.json() }) },
    'next/server': { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } },
    'next/cache': { revalidatePath: (path: string) => revalidated.push(path) }
  };
  const require = (id: string) => { assert.ok(id in modules, 'Unexpected import: ' + id); return modules[id]; };
  const server: Record<string, unknown> = {};
  runInNewContext(serverCode, { exports: server, require });
  modules['@/shared/server/deletedArchive'] = server;
  const route: { PATCH?: (request: Request) => Promise<Response> } = {};
  runInNewContext(routeCode, { exports: route, require });
  return { state: () => state, queries, revalidated, counts: () => ({ connects, releases }), send: (body: unknown) => route.PATCH!(new Request('http://localhost/api/admin/archive', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })) };
}

test('mixed IDs and targets restore once in one archive/order/document-locked transaction with matching audit', async () => {
  const fixture = setup();
  const response = await fixture.send({ ids: [1, 1], targets: [{ item_type: 'pdf', order_id: 17, document_id: 29 }, { item_type: 'order', order_id: 17, document_id: null }] });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, restoredCount: 2 });
  assert.equal(fixture.counts().connects, 1); assert.equal(fixture.counts().releases, 1);
  assert.match(fixture.queries[1], /order by e.id for update/);
  assert.ok(fixture.queries.findIndex(sql => sql.startsWith('select id, deleted_at from orders')) < fixture.queries.findIndex(sql => sql.startsWith('select id, order_id, deleted_at from order_documents')));
  assert.ok(fixture.queries.filter(sql => sql.startsWith('update ')).every(sql => sql.endsWith('and deleted_at is not null returning id')));
  assert.equal(fixture.queries.at(-1), 'COMMIT');
  assert.equal(fixture.state().orders[0].deleted_at, null);
  assert.equal(fixture.state().orders[0].archived_at, deleted);
  assert.equal(fixture.state().documents[0].deleted_at, null);
  assert.equal(fixture.state().entries.length, 0);
  assert.equal(fixture.state().audit.length, 2);
  assert.ok(fixture.state().audit.every(event => event.action === 'restored'));
});

test('purged or missing archive selections fail before mutation and never create restoration audit', async () => {
  for (const body of [{ ids: [99] }, { ids: [1], targets: [{ item_type: 'pdf', order_id: 17, document_id: 999 }] }, { ids: [1, 999] }]) {
    const fixture = setup();
    const response = await fixture.send(body);
    assert.equal(response.status, 409); assert.equal((await response.json()).code, 'ARCHIVE_RESTORE_CONFLICT');
    assert.equal(fixture.queries.at(-1), 'ROLLBACK');
    assert.equal(fixture.queries.some(sql => sql.startsWith('update ')), false);
    assert.equal(fixture.state().audit.length, 0);
    assert.equal(fixture.state().orders[0].deleted_at, deleted);
    assert.equal(fixture.revalidated.length, 0);
  }
});

test('stale trash rows cannot falsely restore already active or missing resources', async () => {
  for (const options of [{ orders: [] }, { orders: [{ id: 17, deleted_at: null, archived_at: deleted }] }, { documents: [] }, { documents: [{ id: 29, order_id: 17, deleted_at: null }] }]) {
    const fixture = setup(options);
    assert.equal((await fixture.send({ ids: [1, 2] })).status, 409);
    assert.equal(fixture.queries.at(-1), 'ROLLBACK');
    assert.equal(fixture.queries.some(sql => sql.startsWith('update ')), false);
    assert.equal(fixture.state().audit.length, 0);
  }
});

test('unexpected zero-row updates and failed audits roll back the whole mixed restoration', async () => {
  for (const options of [{ updateNoRows: 'order' as const }, { updateNoRows: 'pdf' as const }, { auditFails: true }]) {
    const fixture = setup(options);
    const response = await fixture.send({ ids: [1], targets: [{ item_type: 'pdf', order_id: 17, document_id: 29 }] });
    assert.equal(response.status, options.auditFails ? 500 : 409);
    assert.equal(fixture.queries.at(-1), 'ROLLBACK');
    assert.equal(fixture.state().orders[0].deleted_at, deleted);
    assert.equal(fixture.state().documents[0].deleted_at, deleted);
    assert.equal(fixture.state().entries.length, 2);
    assert.equal(fixture.state().audit.length, 0);
    assert.equal(fixture.revalidated.length, 0);
  }
});

test('restoration still requires deleted PDF parents and preserves revision and immutable quote guards', async () => {
  const orphan = setup();
  assert.notEqual((await orphan.send({ ids: [2] })).status, 200);
  assert.equal(orphan.state().documents[0].deleted_at, deleted);
  for (const guard of [{ stale: true }, { quoteEvidence: true }]) {
    const fixture = setup({ documents: [{ id: 29, order_id: 17, deleted_at: deleted, ...guard }] });
    assert.equal((await fixture.send({ ids: [1, 2] })).status, 409);
    assert.equal(fixture.queries.some(sql => sql.startsWith('update ')), false);
    assert.equal(fixture.state().audit.length, 0);
  }
});

test('invalid mixed selections are rejected rather than silently dropping malformed targets', async () => {
  for (const body of [{ ids: [1, '2'] }, { ids: [1.5] }, { ids: [1], targets: [{}] }, { ids: '1' }, { targets: [{ item_type: 'pdf', order_id: -1, document_id: 29 }] }, {}]) {
    const fixture = setup();
    assert.equal((await fixture.send(body)).status, 400);
    assert.equal(fixture.counts().connects, 0);
  }
});
