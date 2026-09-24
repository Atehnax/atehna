import assert from 'node:assert/strict';
import test from 'node:test';
import {
  INSTITUTION_DIRECTORIES, isInstitutionDirectoryId, resolveInstitutionDirectoryId, assertInstitutionDirectoryId,
  INSTITUTION_DIRECTORY_VIEWS, isInstitutionDirectoryViewId, resolveInstitutionDirectoryViewId,
  applyInstitutionDirectoryMutation, InstitutionDirectoryValidationError, InstitutionDirectoryConflictError,
  type InstitutionDirectoryContent
} from '@/shared/domain/institutionDirectory';
import { loadBoundServerModule } from './support/loadBoundServerModule';

const initial = (): InstitutionDirectoryContent => ({
  columns: [{ id: 'naziv', label: 'Naziv', position: 0 }, { id: 'naslov', label: 'Naslov', position: 1 }],
  rows: [{ id: 'institution-vrtci-one', position: 0, cells: { naziv: 'Vrtec', naslov: 'Ulica 1' } }]
});
const edit = (value: string, expected = 'Vrtec') => ({ operation: 'update-row', rowId: 'institution-vrtci-one', cells: { naziv: value }, expectedCells: { naziv: expected } });

test('only the nine declared directories are accepted; arbitrary IDs cannot reach storage', () => {
  assert.equal(INSTITUTION_DIRECTORIES.length, 9);
  assert.equal(new Set(INSTITUTION_DIRECTORIES.map(directory => directory.id)).size, 9);
  for (const directory of INSTITUTION_DIRECTORIES) assert.equal(isInstitutionDirectoryId(directory.id), true);
  for (const invalid of ['', null, 'schools', 'vrtci/../schools', 'unknown', 'vrtci-z-enotami', 'vsi-seznami', 'posebne-potrebe', ['vrtci']]) {
    assert.equal(isInstitutionDirectoryId(invalid), false);
    assert.throws(() => assertInstitutionDirectoryId(invalid), InstitutionDirectoryValidationError);
  }
});

test('directory views group stored lists, shorten labels, and resolve old tab links', () => {
  assert.equal(resolveInstitutionDirectoryId('vrtci-z-enotami'), 'vrtci');
  for (const directory of INSTITUTION_DIRECTORIES) assert.equal(resolveInstitutionDirectoryId(directory.id), directory.id);
  for (const invalid of ['', null, 'unknown', ['vrtci-z-enotami']]) assert.equal(resolveInstitutionDirectoryId(invalid), undefined);
  assert.deepEqual(INSTITUTION_DIRECTORIES.slice(1, 4), [
    { id: 'dijaski-domovi', label: 'Dijaški domovi' },
    { id: 'glasbene-sole', label: 'Glasbene šole' },
    { id: 'vrtci', label: 'Vrtci' }
  ]);
  assert.equal(INSTITUTION_DIRECTORY_VIEWS.length, 9);
  assert.equal(INSTITUTION_DIRECTORY_VIEWS[0].id, 'vsi-seznami');
  assert.deepEqual(INSTITUTION_DIRECTORY_VIEWS[0].directoryIds, INSTITUTION_DIRECTORIES.map(directory => directory.id));
  assert.deepEqual(INSTITUTION_DIRECTORY_VIEWS.slice(1).flatMap(view => [...view.directoryIds]), INSTITUTION_DIRECTORIES.map(directory => directory.id));
  for (const view of INSTITUTION_DIRECTORY_VIEWS) {
    assert.equal(isInstitutionDirectoryViewId(view.id), true);
    assert.equal(resolveInstitutionDirectoryViewId(view.id), view.id);
  }
  for (const oldId of ['osnovne-sole-posebne-potrebe', 'zavodi-posebne-potrebe']) {
    assert.equal(isInstitutionDirectoryViewId(oldId), false);
    assert.equal(resolveInstitutionDirectoryViewId(oldId), 'posebne-potrebe');
  }
  assert.equal(resolveInstitutionDirectoryViewId('vrtci-z-enotami'), 'vrtci');
  for (const invalid of ['', null, 'unknown', ['posebne-potrebe']]) assert.equal(resolveInstitutionDirectoryViewId(invalid), undefined);
  const adults = INSTITUTION_DIRECTORY_VIEWS.find(view => view.id === 'izobrazevanje-odraslih')!;
  assert.equal(adults.label, 'Izobraževanje odraslih');
  assert.deepEqual(adults.fullTitles, ['Organizacije za izobraževanje odraslih']);
  const special = INSTITUTION_DIRECTORY_VIEWS.find(view => view.id === 'posebne-potrebe')!;
  assert.equal(special.label, 'Posebne potrebe');
  assert.deepEqual(special.fullTitles, ['Osnovne šole za otroke s posebnimi potrebami', 'Zavodi za otroke in mladostnike s posebnimi potrebami']);
});

test('cell and row edits preserve unrelated fields and do not mutate the input snapshot', () => {
  const original = initial();
  const updated = applyInstitutionDirectoryMutation(original, edit('Nov vrtec'));
  assert.equal(updated.content.rows[0].cells.naziv, 'Nov vrtec');
  assert.equal(updated.content.rows[0].cells.naslov, 'Ulica 1');
  assert.equal(original.rows[0].cells.naziv, 'Vrtec');
  const cell = applyInstitutionDirectoryMutation(updated.content, { operation: 'update-cell', rowId: original.rows[0].id, columnId: 'naslov', value: 'Ulica 2', expectedValue: 'Ulica 1' });
  assert.equal(cell.result.row?.cells.naslov, 'Ulica 2');
});

test('stale edits report current values without overwriting data; foreign-tab row IDs cannot match', () => {
  const current = applyInstitutionDirectoryMutation(initial(), edit('Novejši naziv')).content;
  assert.throws(() => applyInstitutionDirectoryMutation(current, edit('Stara sprememba')), error => {
    assert.ok(error instanceof InstitutionDirectoryConflictError);
    assert.equal(error.row?.cells.naziv, 'Novejši naziv');
    return true;
  });
  assert.throws(() => applyInstitutionDirectoryMutation(current, { ...edit('Wrong'), rowId: 'institution-dijaski-domovi-one' }), error => {
    assert.ok(error instanceof InstitutionDirectoryConflictError);
    assert.deepEqual(error.missingRowIds, ['institution-dijaski-domovi-one']);
    return true;
  });
  assert.equal(current.rows[0].cells.naziv, 'Novejši naziv');
});

test('add and duplicate preserve ordering, copy fields, and require unique unused IDs', () => {
  const original = initial();
  const added = applyInstitutionDirectoryMutation(original, { operation: 'add-row', rowId: 'new-row' });
  assert.equal(added.content.rows[0].id, 'new-row');
  assert.deepEqual(added.result.row?.cells, { naziv: '', naslov: '' });
  const copied = applyInstitutionDirectoryMutation(added.content, { operation: 'duplicate-rows', rows: [{ sourceRowId: original.rows[0].id, newRowId: 'copy-row', expectedCells: original.rows[0].cells }] });
  assert.deepEqual(copied.result.rows?.[0].cells, { naziv: 'Vrtec kopija', naslov: 'Ulica 1' });
  assert.deepEqual(copied.content.rows.map(row => row.id), ['copy-row', 'new-row', original.rows[0].id]);
  assert.throws(() => applyInstitutionDirectoryMutation(copied.content, { operation: 'add-row', rowId: 'new-row' }), InstitutionDirectoryValidationError);
  assert.throws(() => applyInstitutionDirectoryMutation(copied.content, { operation: 'duplicate-rows', rows: [{ sourceRowId: original.rows[0].id, newRowId: 'new-row', expectedCells: original.rows[0].cells }] }), InstitutionDirectoryValidationError);
});

test('batch deletion is atomic and checks complete snapshots, including unedited cells', () => {
  const original = initial();
  const second = { id: 'second', position: 1, cells: { naziv: 'Drugi vrtec', naslov: 'Ulica 2' } };
  original.rows.push(second);
  const request = { operation: 'delete-rows', rows: original.rows.map(row => ({ rowId: row.id, expectedCells: { ...row.cells } })) };
  request.rows[1].expectedCells.naslov = 'Obsolete';
  assert.throws(() => applyInstitutionDirectoryMutation(original, request), InstitutionDirectoryConflictError);
  assert.equal(original.rows.length, 2);
  assert.throws(() => applyInstitutionDirectoryMutation(original, { operation: 'delete-rows', rows: [{ rowId: second.id, expectedCells: { naziv: second.cells.naziv } }] }), InstitutionDirectoryValidationError);
  const deleted = applyInstitutionDirectoryMutation(original, { operation: 'delete-rows', rows: original.rows.map(row => ({ rowId: row.id, expectedCells: row.cells })) });
  assert.equal(deleted.content.rows.length, 0);
  assert.deepEqual(deleted.result.deletedRowIds, original.rows.map(row => row.id));
});

test('column controls apply only to the selected document and initialize/remove matching cells', () => {
  const original = initial();
  const added = applyInstitutionDirectoryMutation(original, { operation: 'add-column', columnId: 'note', label: 'Opomba' });
  assert.equal(added.content.rows[0].cells.note, '');
  assert.equal(original.columns.length, 2);
  const renamed = applyInstitutionDirectoryMutation(added.content, { operation: 'rename-column', columnId: 'note', label: 'Opombe' });
  assert.equal(renamed.result.column?.label, 'Opombe');
  const deleted = applyInstitutionDirectoryMutation(renamed.content, { operation: 'delete-column', columnId: 'note' });
  assert.equal(Object.hasOwn(deleted.content.rows[0].cells, 'note'), false);
  assert.throws(() => applyInstitutionDirectoryMutation(original, { operation: 'add-column', columnId: 'another', label: ' NAZIV ' }), InstitutionDirectoryValidationError);
});

test('invalid payloads never change current data', () => {
  const original = initial();
  for (const request of [null, [], { operation: 'unsupported' }, edit('x'.repeat(4001)), { ...edit('x'), cells: { unknown: 'x' }, expectedCells: { unknown: 'y' } }, { ...edit('x'), expectedCells: { naslov: 'Ulica 1' } }, { operation: 'delete-rows', rows: [] }, { operation: 'delete-row', rowId: original.rows[0].id }]) {
    assert.throws(() => applyInstitutionDirectoryMutation(original, request), InstitutionDirectoryValidationError);
  }
  assert.deepEqual(original, initial());
});

type ServerApi = {
  getInstitutionDirectory: (id?: unknown) => Promise<unknown>;
  mutateInstitutionDirectory: (id: unknown, mutation: unknown) => Promise<unknown>;
};
function serverHarness() {
  const queries: Array<{ sql: string; values?: unknown[] }> = [];
  const documents = new Map<string, InstitutionDirectoryContent>();
  const seed = { version: 1, directories: ['vrtci', 'dijaski-domovi'].map(id => ({ id, columns: initial().columns, rows: initial().rows })) };
  let schoolReads = 0, schoolWrites = 0, connections = 0;
  const client = {
    query: async (sql: string, values?: unknown[]) => {
      queries.push({ sql, values });
      const key = String(values?.[0]);
      if (sql.startsWith('insert into institution_directories')) {
        if (!documents.has(key)) documents.set(key, JSON.parse(String(values?.[2])));
        return { rows: [], rowCount: 1 };
      }
      if (sql.startsWith('select content')) return { rows: [{ content: documents.get(key), updated_at: '2026-09-24T08:00:00.000Z' }], rowCount: 1 };
      if (sql.startsWith('update institution_directories')) {
        documents.set(key, JSON.parse(String(values?.[1])));
        return { rows: [{ updated_at: '2026-09-24T09:00:00.000Z' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }, release: () => undefined
  };
  const api = loadBoundServerModule<ServerApi>('src/shared/server/institutionDirectory.ts', {
    noStore: () => undefined, institutionSeed: seed, assertInstitutionDirectoryId, applyInstitutionDirectoryMutation,
    getSchoolDirectory: async () => { schoolReads++; return { primary: true }; },
    mutateSchoolDirectory: async () => { schoolWrites++; return { primary: true }; },
    getPool: async () => ({ connect: async () => { connections++; return client; } }), isDatabaseUnavailableError: () => false
  });
  return { api, queries, documents, counts: () => ({ schoolReads, schoolWrites, connections }) };
}

test('primary directory operations delegate unchanged without touching new storage', async () => {
  const harness = serverHarness();
  await harness.api.getInstitutionDirectory();
  await harness.api.mutateInstitutionDirectory('osnovne-sole', edit('Primary'));
  assert.deepEqual(harness.counts(), { schoolReads: 1, schoolWrites: 1, connections: 0 });
  await assert.rejects(harness.api.getInstitutionDirectory('unknown'), InstitutionDirectoryValidationError);
  await assert.rejects(harness.api.mutateInstitutionDirectory('unknown', edit('No')), InstitutionDirectoryValidationError);
  assert.equal(harness.counts().connections, 0);
});

test('durable edits use one selected-directory lock and preserve a different tab even with identical row IDs', async () => {
  const harness = serverHarness();
  await harness.api.getInstitutionDirectory('dijaski-domovi');
  await harness.api.mutateInstitutionDirectory('vrtci', edit('Sprememba'));
  assert.equal(harness.documents.get('vrtci')?.rows[0].cells.naziv, 'Sprememba');
  assert.equal(harness.documents.get('dijaski-domovi')?.rows[0].cells.naziv, 'Vrtec');
  const locked = harness.queries.find(query => query.sql.includes('for update'));
  assert.equal(locked?.values?.[0], 'vrtci');
  assert.equal(harness.queries.at(-1)?.sql, 'commit');
  const saved = await harness.api.getInstitutionDirectory('vrtci') as { rows: Array<{ cells: Record<string, string> }> };
  assert.equal(saved.rows[0].cells.naziv, 'Sprememba');
});

test('a conflict rolls back without issuing an update; an empty saved directory never reseeds', async () => {
  const harness = serverHarness();
  await harness.api.getInstitutionDirectory('vrtci');
  await assert.rejects(harness.api.mutateInstitutionDirectory('vrtci', edit('Overwrite', 'stale')), InstitutionDirectoryConflictError);
  assert.equal(harness.queries.at(-1)?.sql, 'rollback');
  assert.equal(harness.queries.some(query => query.sql.startsWith('update institution_directories')), false);
  await harness.api.mutateInstitutionDirectory('vrtci', { operation: 'delete-rows', rows: [{ rowId: initial().rows[0].id, expectedCells: initial().rows[0].cells }] });
  const reread = await harness.api.getInstitutionDirectory('vrtci') as { rows: unknown[] };
  assert.equal(reread.rows.length, 0);
});

test('API dispatches GET and PATCH to the explicit directory and rejects invalid IDs before mutation', async () => {
  const calls: Array<{ directory: string; mutation?: unknown }> = [];
  const route = loadBoundServerModule<{ GET: (request: Request) => Promise<Response>; PATCH: (request: Request) => Promise<Response> }>('src/admin/api/schools/route.ts', {
    NextResponse: Response, assertInstitutionDirectoryId, resolveInstitutionDirectoryId, InstitutionDirectoryValidationError, InstitutionDirectoryConflictError,
    SchoolDirectoryValidationError: class extends Error {}, SchoolDirectoryConflictError: class extends Error {},
    isDatabaseUnavailableError: () => false,
    getInstitutionDirectory: async (directory: string) => { calls.push({ directory }); return initial(); },
    mutateInstitutionDirectory: async (directory: string, mutation: unknown) => { calls.push({ directory, mutation }); return { updatedAt: '2026-09-24' }; },
    readRequiredJsonRecord: async (request: Request) => ({ ok: true, body: await request.json() })
  });
  assert.equal((await route.GET(new Request('http://localhost/api/admin/schools'))).status, 200);
  assert.equal((await route.GET(new Request('http://localhost/api/admin/schools?directory=vrtci'))).status, 200);
  const patch = (directory: string) => route.PATCH(new Request(`http://localhost/api/admin/schools?directory=${directory}`, { method: 'PATCH', body: JSON.stringify(edit('Updated')) }));
  assert.equal((await patch('glasbene-sole')).status, 200);
  assert.equal((await patch('vrtci-z-enotami')).status, 200);
  assert.equal((await route.GET(new Request('http://localhost/api/admin/schools?directory=vrtci-z-enotami'))).status, 200);
  assert.deepEqual(calls.map(call => call.directory), ['osnovne-sole', 'vrtci', 'glasbene-sole', 'vrtci', 'vrtci']);
  assert.equal((await patch('not-a-directory')).status, 400);
  assert.equal((await route.GET(new Request('http://localhost/api/admin/schools?directory='))).status, 400);
  assert.equal(calls.length, 5);
});

test('API reports stale edits as409 with current rows; never returns a successful persistence response', async () => {
  const route = loadBoundServerModule<{ PATCH: (request: Request) => Promise<Response> }>('src/admin/api/schools/route.ts', {
    NextResponse: Response, assertInstitutionDirectoryId, resolveInstitutionDirectoryId, InstitutionDirectoryValidationError, InstitutionDirectoryConflictError,
    SchoolDirectoryValidationError: class extends Error {}, SchoolDirectoryConflictError: class extends Error {},
    isDatabaseUnavailableError: () => false,
    mutateInstitutionDirectory: async () => { throw new InstitutionDirectoryConflictError('Changed', initial().rows, ['missing']); },
    readRequiredJsonRecord: async (request: Request) => ({ ok: true, body: await request.json() })
  });
  const response = await route.PATCH(new Request('http://localhost/api/admin/schools?directory=vrtci', { method: 'PATCH', body: JSON.stringify(edit('Updated')) }));
  assert.equal(response.status, 409);
  const body = await response.json();
  assert.equal(body.ok, undefined);
  assert.equal(body.row.id, initial().rows[0].id);
  assert.deepEqual(body.missingRowIds, ['missing']);
});

test('API routes combined views separately while legacy storage IDs remain available', async () => {
  const calls: string[] = [];
  const route = loadBoundServerModule<{ GET: (request: Request) => Promise<Response>; PATCH: (request: Request) => Promise<Response> }>('src/admin/api/schools/route.ts', {
    NextResponse: Response, assertInstitutionDirectoryId, resolveInstitutionDirectoryId, InstitutionDirectoryValidationError, InstitutionDirectoryConflictError,
    SchoolDirectoryValidationError: class extends Error {}, SchoolDirectoryConflictError: class extends Error {},
    isDatabaseUnavailableError: () => false,
    getInstitutionDirectory: async (id: string) => { calls.push('source:' + id); return initial(); },
    getInstitutionDirectoryView: async (id: string) => { calls.push('view:' + id); return initial(); },
    mutateInstitutionDirectoryView: async (id: string) => { calls.push('write-view:' + id); return { updatedAt: '2026-09-24' }; },
    readRequiredJsonRecord: async (request: Request) => ({ ok: true, body: await request.json() })
  });
  assert.equal((await route.GET(new Request('http://localhost/api/admin/schools?directory=vsi-seznami'))).status, 200);
  assert.equal((await route.GET(new Request('http://localhost/api/admin/schools?directory=posebne-potrebe'))).status, 200);
  assert.equal((await route.GET(new Request('http://localhost/api/admin/schools?directory=osnovne-sole-posebne-potrebe'))).status, 200);
  assert.equal((await route.PATCH(new Request('http://localhost/api/admin/schools?directory=vsi-seznami', { method: 'PATCH', body: JSON.stringify(edit('Updated')) }))).status, 200);
  assert.deepEqual(calls, ['view:vsi-seznami', 'view:posebne-potrebe', 'source:osnovne-sole-posebne-potrebe', 'write-view:vsi-seznami']);
});
