import assert from 'node:assert/strict';
import { Client } from 'pg';
import { readE2eEnvironment } from './e2e-database.mjs';
import { buildAuditEventsPageQuery } from '../src/shared/server/auditPagination';
import { groupAuditEvents } from '../src/shared/audit/auditPresentation';
import type { AuditEventRecord } from '../src/shared/audit/auditTypes';
import type { PageSizeValue } from '../src/shared/domain/pagination';

// No environment-file loading, schema install, or persistent fixture DML.
// Every write below explicitly targets a temporary relation on one connection.
const environment = readE2eEnvironment();
const client = new Client({ connectionString: environment.databaseUrl, ssl: false });
const cases: string[] = [];
let queries = 0;
let transaction = false;
let serial = 0;
const baseTime = Date.UTC(2026, 8, 6, 12);
type Fixture = AuditEventRecord;
type DatabaseEvent = {
  id: string | null;occurred_at: Date;created_at: Date;actor_id: string | null;actor_name: string | null;actor_email: string | null;
  entity_type: AuditEventRecord['entityType'];entity_id: string;entity_label: string | null;action: AuditEventRecord['action'];
  summary: string;diff_json: AuditEventRecord['diff'];metadata_json: AuditEventRecord['metadata'];request_id: string | null;source: string;retention_until: Date | null;
  audit_total?: number;audit_page?: number;audit_page_count?: number;
};
const make = (offsetMs: number, overrides: Partial<Fixture> = {}): Fixture => ({
  id: `00000000-0000-4000-8000-${String(++serial).padStart(12, '0')}`,
  occurredAt: new Date(baseTime - offsetMs).toISOString(),createdAt: new Date(baseTime).toISOString(),
  actorId: 'actor-a',actorName: 'Synthetic administrator',actorEmail: null,entityType: 'item',entityId: 'item-a',entityLabel: 'Synthetic item',
  action: 'updated',summary: 'Synthetic audit change',diff: { name: { label: 'Naziv', before: 'Before', after: `After ${serial}` } },
  metadata: {},requestId: null,source: 'temporary-pagination-regression',retentionUntil: null,...overrides
});
const mapRow = (row: DatabaseEvent): AuditEventRecord => ({
  id: row.id!,occurredAt: row.occurred_at.toISOString(),createdAt: row.created_at.toISOString(),
  actorId: row.actor_id,actorName: row.actor_name,actorEmail: row.actor_email,entityType: row.entity_type,entityId: row.entity_id,entityLabel: row.entity_label,
  action: row.action,summary: row.summary,diff: row.diff_json,metadata: row.metadata_json,requestId: row.request_id,source: row.source,retentionUntil: row.retention_until?.toISOString() ?? null
});
async function replaceFixtures(events: Fixture[]) {
  await client.query('delete from pg_temp.audit_events');
  await client.query(`insert into pg_temp.audit_events
    (id,occurred_at,created_at,actor_id,actor_name,actor_email,entity_type,entity_id,entity_label,action,summary,diff_json,metadata_json,request_id,source,retention_until)
    select "id"::uuid,"occurredAt"::timestamptz,"createdAt"::timestamptz,"actorId","actorName","actorEmail","entityType","entityId","entityLabel",action,summary,diff,metadata,"requestId",source,"retentionUntil"::timestamptz
    from jsonb_to_recordset($1::jsonb) as fixture(
      id text,"occurredAt" text,"createdAt" text,"actorId" text,"actorName" text,"actorEmail" text,"entityType" text,"entityId" text,"entityLabel" text,
      action text,summary text,diff jsonb,metadata jsonb,"requestId" text,source text,"retentionUntil" text)`, [JSON.stringify(events)]);
}
async function verify(label: string, expectedSizes: number[], whereSql = '', filterParams: unknown[] = []) {
  // Identical SQL order is required before the JS oracle's stable millisecond sort.
  const reference = await client.query<DatabaseEvent>(`select * from pg_temp.audit_events ${whereSql} order by occurred_at desc,created_at desc,id desc`, filterParams);
  const allGroups = groupAuditEvents(reference.rows.map(mapRow));
  assert.deepEqual(allGroups.map(group => group.events.length), expectedSizes, `${label}: explicit grouping expectation`);
  const numericPageIds: string[][] = [];
  for (const [page, pageSize] of [[1, 25], [2, 25], [999, 25], [999, 'all']] as const) {
    const query = buildAuditEventsPageQuery(whereSql, filterParams, page, pageSize as PageSizeValue);
    assert.deepEqual(query.params.slice(0, filterParams.length), filterParams, `${label}: filter bindings preserved`);
    const response = await client.query<DatabaseEvent>(query.sql, query.params);queries++;
    const pageCount = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(allGroups.length / pageSize));
    const clamped = Math.min(page, pageCount);
    assert.equal(response.rows[0]?.audit_total, allGroups.length, `${label}: total groups`);
    assert.equal(response.rows[0]?.audit_page_count, pageCount, `${label}: page count`);
    assert.equal(response.rows[0]?.audit_page, clamped, `${label}: clamped page`);
    const expected = pageSize === 'all' ? allGroups : allGroups.slice((clamped - 1) * pageSize, clamped * pageSize);
    const actualEvents = response.rows.filter(event => event.id !== null).map(mapRow);
    const actualGroups = groupAuditEvents(actualEvents);
    assert.deepEqual(actualGroups.map(group => group.id), expected.map(group => group.id), `${label}: complete stable group IDs`);
    assert.deepEqual(actualEvents.map(event => event.id), expected.flatMap(group => group.events.map(event => event.id)), `${label}: every selected event exactly once`);
    assert.deepEqual(actualGroups, expected, `${label}: expanded changes, summaries, identities and deletion IDs remain complete`);
    if (!expected.length) { assert.equal(response.rows.length, 1);assert.equal(response.rows[0].id, null); }
    if (pageSize === 25 && page <= pageCount) numericPageIds.push(actualEvents.map(event => event.id));
  }
  if (allGroups.length > 25) {
    const ids = numericPageIds.flat();assert.equal(new Set(ids).size, ids.length, `${label}: page overlap`);
    assert.deepEqual(new Set(ids), new Set(reference.rows.map(event => event.id)), `${label}: no lost events across pages`);
  }
  cases.push(label);
}
async function check(label: string, events: Fixture[], sizes: number[], whereSql = '', params: unknown[] = []) {
  await replaceFixtures(events);await verify(label, sizes, whereSql, params);
}

try {
  await client.connect();
  const identity = await client.query('select current_database() as name,current_user as username,host(inet_server_addr()) as address,inet_server_port() as port');
  assert.equal(identity.rows[0].name, environment.databaseIdentity.database);
  assert.equal(identity.rows[0].username, environment.databaseIdentity.effectiveUser);
  assert.equal(identity.rows[0].port, environment.databaseIdentity.serverPort);
  assert.ok(['127.0.0.1', '::1'].includes(identity.rows[0].address));
  await client.query('begin');transaction = true;
  await client.query('set local search_path = pg_temp');
  await client.query("set local statement_timeout = '10s'");
  await client.query(`create temporary table audit_events (
    id uuid primary key,occurred_at timestamptz not null,created_at timestamptz not null,actor_id text,actor_name text,actor_email text,
    entity_type text not null,entity_id text not null,entity_label text,action text not null,summary text not null,
    diff_json jsonb not null,metadata_json jsonb not null,request_id text,source text not null,retention_until timestamptz
  ) on commit drop`);
  const relation = await client.query("select relpersistence,relnamespace = pg_my_temp_schema() as temporary from pg_class where oid = 'audit_events'::regclass");
  assert.deepEqual(relation.rows, [{ relpersistence: 't', temporary: true }]);

  await check('34 events form five complete rows at page size25', [
    ...Array.from({ length: 30 }, (_, i) => make(i)),
    ...Array.from({ length: 4 }, (_, i) => make(20_000 * (i + 1), { entityId: `single-${i}` }))
  ], [30, 1, 1, 1, 1]);
  await check('26 groups keep the30-event page-boundary group intact', [
    ...Array.from({ length: 24 }, (_, i) => make(i * 20_000, { entityId: `single-${i}` })),
    ...Array.from({ length: 30 }, (_, i) => make(480_000 + i, { entityId: 'boundary-group' })),
    make(510_000, { entityId: 'last-page' })
  ], [...Array<number>(24).fill(1), 30, 1]);
  const lastPage = buildAuditEventsPageQuery('', [], 2, 25);
  const deleting = (await client.query<DatabaseEvent>(lastPage.sql, lastPage.params)).rows.filter(event => event.id !== null).map(event => event.id);
  assert.equal(deleting.length, 1);await client.query('delete from pg_temp.audit_events where id=any($1::uuid[])', [deleting]);
  await verify('deleting the last group clamps page2 back to1', [...Array<number>(24).fill(1), 30]);
  const firstPage = buildAuditEventsPageQuery('', [], 1, 25);
  const selected = (await client.query<DatabaseEvent>(firstPage.sql, firstPage.params)).rows.filter(event => event.id !== null).map(event => event.id);
  assert.equal(selected.length, 54);await client.query('delete from pg_temp.audit_events where id=any($1::uuid[])', [selected]);
  await verify('deleting complete visible groups leaves empty sentinel metadata', []);
  await check('adjacent9second links form a chain spanning18seconds', [make(0), make(9_000), make(18_000)], [3]);
  const interleaved = [make(0, { entityId: 'a' }), make(1_000, { entityId: 'b' }), make(2_000, { entityId: 'a' })];
  await check('an unrelated interleaved entity separates matching outer events', interleaved, [1, 1, 1]);
  await check('filters apply before adjacency and retain only matching deletion IDs', interleaved, [2], 'where entity_id = $1', ['a']);
  await check('nonempty shared request joins different entities', [make(0, { entityId: 'a', requestId: 'shared' }), make(1_000, { entityId: 'b', requestId: 'shared' })], [2]);
  await check('empty request never joins different entities', [make(0, { entityId: 'a', requestId: '' }), make(1_000, { entityId: 'b', requestId: '' })], [1, 1]);
  await check('category reorder joins identities but does not absorb unrelated update', [make(0, { entityType: 'category', entityId: 'a', action: 'reordered' }), make(1_000, { entityType: 'category', entityId: 'b', action: 'reordered' }), make(2_000, { entityType: 'category', entityId: 'c' })], [2, 1]);
  await check('actor and type boundaries override same request', [make(0, { requestId: 'shared' }), make(1_000, { actorId: 'other', requestId: 'shared' }), make(2_000, { actorId: 'other', entityType: 'order', requestId: 'shared' })], [1, 1, 1]);
  await check('actor fallback preserves nullish rather than truthy semantics', [make(0, { actorId: null, actorName: 'actor-a' }), make(1_000, { actorId: 'actor-a', actorName: 'different' }), make(2_000, { actorId: '', actorName: 'actor-a' }), make(3_000, { actorId: null, actorName: '' })], [2, 2]);
  await check('ten-second boundary is inclusive and the next millisecond separates', [make(0), make(10_000), make(20_001)], [2, 1]);
  await check('PostgreSQL microseconds follow JavaScript millisecond boundary', [make(0, { occurredAt: '2026-09-06T12:00:10.000900Z' }), make(0, { occurredAt: '2026-09-06T12:00:00.000100Z' })], [2]);
  await check('microseconds cannot hide a complete millisecond beyond boundary', [make(0, { occurredAt: '2026-09-06T12:00:10.001000Z' }), make(0, { occurredAt: '2026-09-06T12:00:00.000999Z' })], [1, 1]);
  await check('tied timestamps retain deterministic creation and ID ordering', [make(0, { entityId: 'a' }), make(0, { entityId: 'b' }), make(0, { entityId: 'a' }), make(0, { entityId: 'a', createdAt: '2026-09-06T12:00:01.000Z' })], [2, 1, 1]);
  await check('parameterized text and action filters preserve matching group details', [make(0, { summary: "Fixture O'Reilly", action: 'price_changed' }), make(1_000, { summary: 'Excluded', action: 'stock_changed' }), make(2_000, { summary: "Fixture O'Reilly", action: 'price_changed' })], [2], 'where summary ilike $1 and action = any($2::text[])', ["%O'Reilly%", ['price_changed']]);
  await check('empty filtered result returns one null-event sentinel', [make(0)], [], 'where entity_id = $1', ['absent']);
  await client.query('rollback');transaction = false;
  assert.equal((await client.query("select to_regclass('pg_temp.audit_events') is null as removed")).rows[0].removed, true);
  console.log(JSON.stringify({ status: 'passed', cases: cases.length, queries, temporaryOnly: true, rolledBack: true, checks: cases }, null, 2));
} finally {
  if (transaction) await client.query('rollback');
  await client.end();
}
