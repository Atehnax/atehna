import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  qualifyInstitutionRowId as qualify, parseInstitutionRowId as parse, combineInstitutionDirectoryView as combine,
  planInstitutionDirectoryViewMutation as plan, applyInstitutionDirectoryViewMutation as apply,
  type InstitutionDirectoryViewSource
} from '@/shared/domain/institutionDirectoryView';
import { INSTITUTION_DIRECTORY_VIEWS, resolveInstitutionDirectoryViewId, InstitutionDirectoryValidationError, InstitutionDirectoryConflictError, type InstitutionDirectoryId } from '@/shared/domain/institutionDirectory';
import type { SchoolDirectoryData, SchoolDirectoryRow } from '@/shared/domain/schoolDirectory';
import { loadBoundServerModule } from './support/loadBoundServerModule';

const columns = [{ id: 'naziv', label: 'Naziv', position: 0 }, { id: 'email', label: 'Email', position: 1 }];
const row = (id = 'same-id', naziv = 'Name', position = 0): SchoolDirectoryRow => ({ id, position, cells: { naziv, email: 'a@test.si' } });
const source = (directoryId: InstitutionDirectoryId, rows = [row()]): InstitutionDirectoryViewSource => ({ directoryId, data: { columns, rows, updatedAt: '2026-09-24T10:00:00.000Z', persistenceAvailable: true } });
const originals = () => [source('osnovne-sole'), source('vrtci')];
const allowed = ['osnovne-sole', 'vrtci'] as const;
const deleting = (sources = originals()) => ({ operation: 'delete-rows', rows: sources.map(source => ({ rowId: qualify(source.directoryId, 'same-id'), expectedCells: source.data.rows[0].cells })) });

test('qualified source identities prevent collisions and reject invalid or nested namespaces', () => {
  assert.deepEqual(parse(qualify('vrtci', 'row-1')), { directoryId: 'vrtci', rowId: 'row-1' });
  for (const invalid of ['row-1', 'unknown::row-1', 'vrtci::bad/id', 'vrtci::', 'vrtci::osnovne-sole::row-1', null]) assert.throws(() => parse(invalid), InstitutionDirectoryValidationError);
  const combined = combine(originals());
  assert.deepEqual(combined.rows.map(row => row.id), ['osnovne-sole::same-id', 'vrtci::same-id']);
  assert.deepEqual(combined.rows.map(row => row.position), [0, 1]);
});

test('aggregate union fills absent columns and persistence requires every source to be live', () => {
  const sources = originals();
  sources[1].data.columns = [...columns, { id: 'extra', label: 'Extra', position: 2 }];
  sources[1].data.rows = [{ ...row(), cells: { ...row().cells, extra: 'Custom' } }];
  sources[1].data.persistenceAvailable = false;
  const result = combine(sources);
  assert.equal(result.columns.length, 3);
  assert.equal(result.rows[0].cells.extra, '');
  assert.equal(result.rows[1].cells.extra, 'Custom');
  assert.equal(result.persistenceAvailable, false);
});

test('delete and duplicate operate atomically across source directories without changing originals', () => {
  const sources = originals();
  const before = structuredClone(sources);
  const deleted = apply(sources, allowed, deleting(sources));
  assert.ok(deleted.changes.every(change => change.content.rows.length === 0));
  assert.deepEqual(deleted.result.deletedRowIds, ['osnovne-sole::same-id', 'vrtci::same-id']);
  const duplicated = apply(sources, allowed, { operation: 'duplicate-rows', rows: sources.map(source => ({ sourceRowId: qualify(source.directoryId, 'same-id'), newRowId: qualify(source.directoryId, 'copy'), expectedCells: source.data.rows[0].cells })) });
  assert.deepEqual(duplicated.result.rows?.map(row => row.id), ['osnovne-sole::copy', 'vrtci::copy']);
  assert.ok(duplicated.result.rows?.every(row => row.cells.naziv === 'Name kopija'));
  assert.deepEqual(sources, before);
});

test('stale second-directory snapshots reject the whole batch and qualify conflict rows', () => {
  const sources = originals();
  const mutation = deleting(sources);
  mutation.rows[1] = { ...mutation.rows[1], expectedCells: { ...mutation.rows[1].expectedCells, naziv: 'Old' } };
  assert.throws(() => apply(sources, allowed, mutation), error => {
    assert.ok(error instanceof InstitutionDirectoryConflictError);
    assert.equal(error.rows[0].id, 'vrtci::same-id');
    assert.equal(error.rows[0].position, 1);
    return true;
  });
  assert.equal(sources[0].data.rows.length, 1);
});

test('source constraints block cross-view edits, cross-directory duplication, schema mutations and forged targets', () => {
  for (const input of [
    { operation: 'add-row', rowId: qualify('vrtci', 'new'), targetDirectoryId: 'osnovne-sole' },
    { operation: 'add-row', rowId: qualify('srednje-sole', 'new') },
    { operation: 'add-column', columnId: 'new', label: 'New' },
    { operation: 'duplicate-rows', rows: [{ sourceRowId: qualify('vrtci', 'same-id'), newRowId: qualify('osnovne-sole', 'copy'), expectedCells: row().cells }] }
  ]) assert.throws(() => plan(allowed, input), InstitutionDirectoryValidationError);
});

test('targeted add and update return qualified rows with complete union cells', () => {
  const sources = originals();
  const added = apply(sources, allowed, { operation: 'add-row', rowId: qualify('vrtci', 'new'), targetDirectoryId: 'vrtci' });
  assert.equal(added.changes.length, 1);
  assert.equal(added.changes[0].directoryId, 'vrtci');
  assert.equal(added.result.row?.id, 'vrtci::new');
  const updated = apply(sources, allowed, { operation: 'update-row', rowId: qualify('vrtci', 'same-id'), cells: { naziv: 'Edited' }, expectedCells: { naziv: 'Name' } });
  assert.equal(updated.result.row?.cells.naziv, 'Edited');
  assert.equal(updated.result.row?.cells.email, 'a@test.si');
});

test('foreign union blanks are filtered while nonblank edits are rejected instead of lost', () => {
  const sources = originals();
  sources[1].data.columns = [...columns, { id: 'extra', label: 'Extra', position: 2 }];
  sources[1].data.rows = [{ ...row(), cells: { ...row().cells, extra: 'Custom' } }];
  const expectedCells = { ...row().cells, extra: '' };
  const deleting = { operation: 'delete-rows', rows: [{ rowId: qualify('osnovne-sole', 'same-id'), expectedCells }] };
  assert.equal(apply(sources, allowed, deleting).changes[0].content.rows.length, 0);
  assert.throws(() => apply(sources, allowed, { operation: 'update-row', rowId: qualify('osnovne-sole', 'same-id'), expectedCells, cells: { ...expectedCells, extra: 'Must not lose' } }), InstitutionDirectoryValidationError);
});

test('missing rows and duplicate IDs retain scoped conflict/validation semantics', () => {
  assert.throws(() => apply(originals(), allowed, { operation: 'delete-rows', rows: [{ rowId: qualify('vrtci', 'missing'), expectedCells: row().cells }] }), error => {
    assert.ok(error instanceof InstitutionDirectoryConflictError);
    assert.deepEqual(error.missingRowIds, ['vrtci::missing']);
    return true;
  });
  const mutation = deleting();
  mutation.rows.push(mutation.rows[0]);
  assert.throws(() => plan(allowed, mutation), InstitutionDirectoryValidationError);
});

const serverFile = fileURLToPath(new URL('../../src/shared/server/institutionDirectoryViews.ts', import.meta.url));
function fakeServer() {
  const reads = new Map<string, SchoolDirectoryData>();
  for (const view of INSTITUTION_DIRECTORY_VIEWS) for (const id of view.directoryIds) reads.set(id, source(id, allowed.includes(id as typeof allowed[number]) ? [row()] : []).data);
  const queries: Array<{ sql: string; params?: unknown[] }> = [];
  const delegateCalls: unknown[] = [];
  const client = {
    async query(sql: string, params?: unknown[]) {
      queries.push({ sql, params });
      if (sql.startsWith('select id, label, position from school_directory_columns')) return { rows: columns, rowCount: columns.length };
      if (sql.startsWith('select id, position, cells from school_directory_rows')) return { rows: reads.get('osnovne-sole')!.rows, rowCount: 1 };
      if (sql.startsWith('select updated_at from school_directory_meta')) return { rows: [{ updated_at: new Date('2026-09-24T10:00:00Z') }], rowCount: 1 };
      if (sql.startsWith('select id, content, updated_at from institution_directories')) return { rows: (params![0] as string[]).map(id => ({ id, content: reads.get(id), updated_at: new Date('2026-09-24T10:00:00Z') })), rowCount: (params![0] as string[]).length };
      if (sql.startsWith('update ')) return { rows: [{ updated_at: new Date('2026-09-24T11:00:00Z') }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    }, release() {}
  };
  const server = loadBoundServerModule<{
    getInstitutionDirectoryView(input: unknown): Promise<SchoolDirectoryData>;
    mutateInstitutionDirectoryView(input: unknown, mutation: unknown): Promise<unknown>;
  }>(serverFile, {
    noStore() {}, INSTITUTION_DIRECTORY_VIEWS, resolveInstitutionDirectoryViewId, InstitutionDirectoryValidationError,
    applyInstitutionDirectoryViewMutation: apply, combineInstitutionDirectoryView: combine, planInstitutionDirectoryViewMutation: plan,
    async getInstitutionDirectory(id: string) { return reads.get(id)!; },
    async mutateInstitutionDirectory(id: string, mutation: unknown) { delegateCalls.push({ id, mutation }); return { updatedAt: 'now' }; },
    async getPool() { return { async connect() { return client; } }; }
  });
  return { server, queries, delegateCalls };
}

test('single-directory server views delegate existing persistence unchanged', async () => {
  const { server, delegateCalls, queries } = fakeServer();
  const mutation = { operation: 'add-row', rowId: 'plain-id' };
  await server.mutateInstitutionDirectoryView('vrtci', mutation);
  assert.equal(delegateCalls.length, 1);
  assert.equal(queries.length, 0);
  assert.equal((await server.getInstitutionDirectoryView('vrtci')).rows[0].id, 'same-id');
});

test('aggregate server commits one locked transaction and only targeted primary rows are deleted', async () => {
  const { server, queries } = fakeServer();
  const result = await server.mutateInstitutionDirectoryView('vsi-seznami', deleting()) as { deletedRowIds: string[] };
  assert.deepEqual([...result.deletedRowIds], ['osnovne-sole::same-id', 'vrtci::same-id']);
  assert.ok(queries.some(query => query.sql.includes('school-directory-structure')));
  assert.ok(queries.some(query => query.sql.endsWith('order by id for update')));
  const deleted = queries.find(query => query.sql.startsWith('delete from school_directory_rows'))!;
  assert.deepEqual(JSON.parse(JSON.stringify(deleted.params)), [['same-id']]);
  assert.equal(queries.filter(query => query.sql === 'begin').length, 1);
  assert.equal(queries.filter(query => query.sql === 'commit').length, 1);
  assert.equal(queries.filter(query => query.sql.startsWith('update institution_directories')).length, 1);
});

test('aggregate server rolls back stale cross-source batches before any data write', async () => {
  const { server, queries } = fakeServer();
  const mutation = deleting();
  mutation.rows[1] = { ...mutation.rows[1], expectedCells: { ...row().cells, naziv: 'Old' } };
  await assert.rejects(server.mutateInstitutionDirectoryView('vsi-seznami', mutation), InstitutionDirectoryConflictError);
  assert.ok(queries.some(query => query.sql === 'rollback'));
  assert.equal(queries.some(query => /^(update|delete|insert)/.test(query.sql)), false);
  assert.equal(queries.some(query => query.sql === 'commit'), false);
});
