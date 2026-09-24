import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Pool } from 'pg';
import {
  buildInstitutionReleasePlan, releaseInstitutionDirectories, validateInstitutionReleaseTarget,
  type InstitutionReleaseArchive, type InstitutionReleaseSnapshot
} from '../../scripts/release-institution-directories';

const target = { host: 'database.example.test', port: '5432', database: 'atehna' };
const columns = ['naziv', 'e-naslov', 'telefon'].map((id, position) => ({ id, label: id, position }));
const row = (id: string, name: string, email: string, position = 0) => ({ id, position, cells: { naziv: name, 'e-naslov': email, telefon: '01 123' } });
const rawIds = ['dijaski-domovi', 'glasbene-sole', 'vrtci-z-enotami', 'vrtci', 'srednje-sole', 'visje-strokovne-sole', 'izobrazevanje-odraslih', 'osnovne-sole-posebne-potrebe', 'zavodi-posebne-potrebe'];
const archive = (): InstitutionReleaseArchive => ({ version: 1, directories: rawIds.map(id => ({ id, label: id, columns, rows: [] })) });
const snapshot = (): InstitutionReleaseSnapshot => ({ primaryColumns: columns, primaryRows: [row('p1', 'OSNOVNA ŠOLA One', 'live@school.si')], primaryMeta: [{ key: 'schools', seed_version: 2 }], documents: [], orderLinks: [] });
const canonicalSnapshot = (plan: ReturnType<typeof buildInstitutionReleasePlan>): InstitutionReleaseSnapshot => ({ primaryColumns: plan.directories[0].columns, primaryRows: plan.directories[0].rows, primaryMeta: [{ key: 'schools', seed_version: 3 }], documents: plan.directories.slice(1).map(directory => ({ id: directory.id, seed_version: 3, content: { columns: directory.columns, rows: directory.rows } })), orderLinks: [] });

function mockedPool(initial: InstitutionReleaseSnapshot, failOnWrite = false) {
  let state = structuredClone(initial);
  let saved = structuredClone(initial);
  const queries: string[] = [];
  const query = async (sql: string, values: unknown[] = []) => {
    queries.push(sql);
    if (sql === 'begin') { saved = structuredClone(state); return { rows: [] }; }
    if (sql === 'rollback') { state = structuredClone(saved); return { rows: [] }; }
    if (sql === 'commit' || sql.startsWith('set ') || sql.startsWith('lock ')) return { rows: [] };
    if (sql === 'select current_database() as name') return { rows: [{ name: target.database }] };
    if (sql.includes('from school_directory_columns')) return { rows: structuredClone(state.primaryColumns) };
    if (sql.startsWith('select') && sql.includes('from school_directory_rows')) return { rows: structuredClone(state.primaryRows) };
    if (sql.startsWith('select') && sql.includes('from school_directory_meta')) return { rows: structuredClone(state.primaryMeta) };
    if (sql.startsWith('select') && sql.includes('from institution_directories')) return { rows: structuredClone(state.documents).sort((a, b) => a.id.localeCompare(b.id)) };
    if (sql.startsWith('select') && sql.includes('from orders')) return { rows: structuredClone(state.orderLinks) };
    if (sql.startsWith('update orders')) {
      let count = 0;
      for (const order of state.orderLinks) if ((values[2] as number[]).includes(order.id) && order.school_directory_row_id === values[0]) { order.school_directory_row_id = values[1] as string; count++; }
      return { rows: [], rowCount: count };
    }
    if (sql.startsWith('insert into school_directory_rows')) { state.primaryRows = JSON.parse(values[0] as string); return { rows: [] }; }
    if (sql.startsWith('delete from school_directory_rows')) { state.primaryRows = state.primaryRows.filter(row => (values[0] as string[]).includes(row.id)); return { rows: [] }; }
    if (sql.startsWith('update school_directory_meta')) { state.primaryMeta[0].seed_version = values[0] as number; return { rows: [] }; }
    if (sql.startsWith('insert into institution_directories')) {
      if (failOnWrite) throw new Error('simulated document write failure');
      const document = { id: values[0] as string, seed_version: values[1] as number, content: JSON.parse(values[2] as string) };
      state.documents = [...state.documents.filter(existing => existing.id !== document.id), document];
      return { rows: [] };
    }
    if (sql.startsWith('delete from institution_directories')) { state.documents = state.documents.filter(document => document.id !== 'vrtci-z-enotami'); return { rows: [] }; }
    throw new Error(`Unexpected test query: ${sql}`);
  };
  return { pool: { connect: async () => ({ query, release() {} }) } as unknown as Pool, queries, current: () => state };
}
const writes = (queries: string[]) => queries.filter(query => /^(insert|update|delete)/.test(query));
async function temporary(run: (path: string) => Promise<void>) { const path = await mkdtemp(join(tmpdir(), 'atehna-institution-release-')); try { await run(path); } finally { await rm(path, { recursive: true, force: true }); } }

test('release target must explicitly match DATABASE_URL host and database without exposing credentials', () => {
  assert.deepEqual(validateInstitutionReleaseTarget('postgres://user:secret@database.example.test/atehna', target.host, target.database), target);
  assert.throws(() => validateInstitutionReleaseTarget(undefined, target.host, target.database), /explicit DATABASE_URL/);
  assert.throws(() => validateInstitutionReleaseTarget('postgres://user:secret@wrong.example.test/atehna', target.host, target.database), error => error instanceof Error && /does not match/.test(error.message) && !error.message.includes('secret'));
  assert.throws(() => validateInstitutionReleaseTarget('postgres://user:secret@database.example.test/wrong', target.host, target.database), /does not match/);
});

test('missing directories start from raw archives against live edited schools while existing directories retain edits', () => {
  const data = snapshot(), raw = archive();
  raw.directories.find(directory => directory.id === 'vrtci')!.rows = [row('k1', 'OSNOVNA ŠOLA One vrtec', 'old@school.si')];
  raw.directories.find(directory => directory.id === 'glasbene-sole')!.rows = [row('outdated', 'Old archive', 'old-music@school.si')];
  data.documents = [{ id: 'glasbene-sole', seed_version: 1, content: { columns, rows: [row('edited', 'Edited music institution', 'new-music@school.si')] } }];
  const before = structuredClone({ data, raw });
  const plan = buildInstitutionReleasePlan(data, raw, target);
  assert.equal(plan.initializedDirectories.length, 8);
  assert.equal(plan.initializedDirectories.includes('glasbene-sole'), false);
  assert.equal(plan.directories.find(directory => directory.id === 'vrtci')!.rows[0].id, 'k1', 'different live email must not suppress archived kindergarten');
  assert.equal(plan.directories.find(directory => directory.id === 'glasbene-sole')!.rows[0].id, 'edited');
  assert.equal(plan.directories[0].rows[0].cells['e-naslov'], 'live@school.si');
  assert.equal(plan.directories[0].rows[0].cells.naziv, 'OŠ One');
  assert.deepEqual({ data, raw }, before);
});

test('retired kindergarten-units archive is never reintroduced, including an intentionally empty consolidated Vrtci', () => {
  const raw = archive();
  raw.directories.find(directory => directory.id === 'vrtci-z-enotami')!.rows = [row('old-unit', 'Archived unit', 'old@school.si')];
  const first = buildInstitutionReleasePlan(snapshot(), raw, target);
  const saved = canonicalSnapshot(first);
  saved.documents.find(document => document.id === 'vrtci')!.content.rows = [];
  const next = buildInstitutionReleasePlan(saved, raw, target);
  assert.equal(next.initializedDirectories.length, 0);
  assert.equal(next.directories.find(directory => directory.id === 'vrtci')!.rows.length, 0);
  assert.equal(next.changed, false);
});

test('order remaps retain live primary survivor and all source identities, with names normalized independently', () => {
  const data = snapshot(); data.primaryRows.push(row('p2', 'Osnovna šola Two', 'LIVE@SCHOOL.SI', 1));
  data.orderLinks = [{ id: 91, school_directory_row_id: 'p2' }, { id: 92, school_directory_row_id: 'unrelated' }];
  const plan = buildInstitutionReleasePlan(data, archive(), target);
  assert.deepEqual(plan.orderRemaps, [{ sourceRowId: 'p2', canonicalRowId: 'p1', orderIds: [91] }]);
  assert.equal(plan.groups[0].sources[1].row.cells.naziv, 'Osnovna šola Two');
  assert.equal(plan.nameChanges[0].after, 'OŠ One');
});

test('dry run writes reviewed backup and fingerprint without data mutations; stale apply rolls back before DML', async () => temporary(async path => {
  const raw = archive(), data = snapshot();
  const first = mockedPool(data);
  const dry = await releaseInstitutionDirectories(first.pool, { target, outputDirectory: join(path, 'dry'), archive: raw });
  assert.equal(dry.applied, false);
  assert.equal(writes(first.queries).length, 0);
  assert.ok(first.queries.includes('set transaction isolation level repeatable read read only'));
  assert.equal(JSON.parse(await readFile(join(path, 'dry', 'plan.json'), 'utf8')).planSha256, dry.planSha256);
  assert.deepEqual(JSON.parse(await readFile(join(path, 'dry', 'before.json'), 'utf8')).snapshot, data);
  const edited = structuredClone(data); edited.primaryRows[0].cells.telefon = 'changed during review';
  const second = mockedPool(edited);
  await assert.rejects(releaseInstitutionDirectories(second.pool, { target, outputDirectory: join(path, 'apply'), apply: true, expectedPlanSha256: dry.planSha256, archive: raw }), /plan changed/);
  assert.equal(writes(second.queries).length, 0);
  assert.ok(second.queries.some(query => query.startsWith('lock table')));
  assert.equal(second.queries.at(-1), 'rollback');
}));

test('reviewed apply persists verified output and order links; the next plan is a no-op', async () => temporary(async path => {
  const data = snapshot(), raw = archive();
  data.primaryRows.push(row('p2', 'Osnovna šola Two', 'live@school.si', 1));
  data.orderLinks = [{ id: 91, school_directory_row_id: 'p2' }, { id: 92, school_directory_row_id: 'unrelated' }];
  const mock = mockedPool(data);
  const reviewed = buildInstitutionReleasePlan(data, raw, target);
  const result = await releaseInstitutionDirectories(mock.pool, { target, outputDirectory: join(path, 'apply'), apply: true, expectedPlanSha256: reviewed.planSha256, archive: raw });
  assert.equal(result.applied, true);
  assert.equal(result.remappedOrders, 1);
  assert.equal(mock.queries.at(-1), 'commit');
  assert.deepEqual(mock.current().orderLinks, [{ id: 91, school_directory_row_id: 'p1' }, { id: 92, school_directory_row_id: 'unrelated' }]);
  assert.equal(mock.current().primaryRows[0].cells.naziv, 'OŠ One');
  assert.equal(mock.current().documents.length, 8);
  assert.equal(buildInstitutionReleasePlan(mock.current(), raw, target).changed, false);
}));

test('apply requires a reviewed plan hash and changed raw archive also invalidates that hash', async () => temporary(async path => {
  const data = snapshot(), raw = archive(), mock = mockedPool(data);
  await assert.rejects(releaseInstitutionDirectories(mock.pool, { target, outputDirectory: path, apply: true, archive: raw }), /requires --plan-sha256/);
  assert.equal(mock.queries.length, 0);
  const oldPlan = buildInstitutionReleasePlan(data, raw, target);
  raw.directories[0].rows.push(row('new-row', 'New dormitory', 'new@school.si'));
  assert.notEqual(buildInstitutionReleasePlan(data, raw, target).planSha256, oldPlan.planSha256);
}));


test('a failed apply rolls back earlier row/order changes while keeping the complete pre-write backup', async () => temporary(async path => {
  const data = snapshot(), raw = archive();
  data.primaryRows.push(row('p2', 'Osnovna šola Two', 'live@school.si', 1));
  data.orderLinks = [{ id: 91, school_directory_row_id: 'p2' }];
  const mock = mockedPool(data, true);
  const plan = buildInstitutionReleasePlan(data, raw, target);
  await assert.rejects(releaseInstitutionDirectories(mock.pool, { target, outputDirectory: path, apply: true, expectedPlanSha256: plan.planSha256, archive: raw }), /simulated document write failure/);
  assert.equal(mock.queries.at(-1), 'rollback');
  assert.deepEqual(mock.current(), data);
  assert.deepEqual(JSON.parse(await readFile(join(path, 'before.json'), 'utf8')).snapshot, data);
  assert.equal(writes(mock.queries).some(query => /customer/.test(query)), false);
}));
