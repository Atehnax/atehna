import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SUPPLIER_DIRECTORY_COLUMNS, parseSupplierDirectoryMutation, SupplierDirectoryValidationError
} from '@/shared/domain/supplierDirectory';
import { loadBoundServerModule } from './support/loadBoundServerModule';

const empty = () => Object.fromEntries(SUPPLIER_DIRECTORY_COLUMNS.map(column => [column.id, '']));
const update = (cells: Record<string, string>) => ({ operation: 'update-row', rowId: 'row-1', cells, expectedCells: Object.fromEntries(Object.keys(cells).map(key => [key, ''])) });

test('supplier edits validate the catalog reference, contact values and fixed columns', () => {
  assert.deepEqual(parseSupplierDirectoryMutation(update({ artikel: '920001', dobavitelj: 'Dobavitelj', 'e-naslov': 'one@example.test;two@example.test', 'spletna-stran': 'example.test;https://example.test/contact' })), update({ artikel: '920001', dobavitelj: 'Dobavitelj', 'e-naslov': 'one@example.test;two@example.test', 'spletna-stran': 'example.test;https://example.test/contact' }));
  for (const invalid of [null, [], { operation: 'delete-column', columnId: 'artikel' }, update({ artikel: '-1' }), update({ artikel: 'unknown' }), update({ opombe: 'x'.repeat(4001) }), update({ unknown: 'value' }), update({ 'e-naslov': 'broken@' }), update({ 'spletna-stran': 'javascript:alert(1)' }), update({ 'spletna-stran': 'https://user:password@example.test' }), { ...update({ dobavitelj: 'x' }), expectedCells: { naslov: '' } }]) {
    assert.throws(() => parseSupplierDirectoryMutation(invalid), SupplierDirectoryValidationError);
  }
});

test('supplier batch operations require complete unique snapshots', () => {
  const valid = { operation: 'duplicate-rows', rows: [{ sourceRowId: 'row-1', newRowId: 'row-2', expectedCells: empty() }] };
  assert.deepEqual(parseSupplierDirectoryMutation(valid), valid);
  for (const invalid of [
    { operation: 'delete-rows', rows: [] },
    { operation: 'delete-rows', rows: [{ rowId: 'row-1', expectedCells: { dobavitelj: '' } }] },
    { operation: 'delete-rows', rows: [{ rowId: 'row-1', expectedCells: empty() }, { rowId: 'row-1', expectedCells: empty() }] },
    { operation: 'duplicate-rows', rows: [{ sourceRowId: 'row-1', newRowId: 'row-1', expectedCells: empty() }] }
  ]) assert.throws(() => parseSupplierDirectoryMutation(invalid), SupplierDirectoryValidationError);
});

test('supplier validation runs before persistence and a failed audit rolls the mutation back', async () => {
  const queries: string[] = [];
  let connections = 0, released = 0;
  const client = {
    query: async (sql: string, values?: unknown[]) => {
      queries.push(sql);
      if (sql.startsWith('select coalesce')) return { rows: [{ position: 0, count: 0 }], rowCount: 1 };
      if (sql.startsWith('insert into catalog_supplier_rows')) return { rows: [{ id: values?.[0], position: -1, cells: empty(), article_label: '', catalog_item_id: null }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    }, release: () => { released++; }
  };
  const api = loadBoundServerModule<{ mutateSupplierDirectory: (input: unknown, audit: unknown) => Promise<unknown> }>('src/shared/server/supplierDirectory.ts', {
    SUPPLIER_DIRECTORY_COLUMNS, SUPPLIER_DIRECTORY_MAX_ROWS: 5000, SupplierDirectoryValidationError, parseSupplierDirectoryMutation,
    getPool: async () => ({ connect: async () => { connections++; return client; } }),
    insertAuditEvent: async () => { throw new Error('audit unavailable'); }
  });
  await assert.rejects(api.mutateSupplierDirectory(update({ artikel: 'bad' }), {}), SupplierDirectoryValidationError);
  assert.equal(connections, 0);
  await assert.rejects(api.mutateSupplierDirectory({ operation: 'add-row', rowId: 'row-1' }, {}), /audit unavailable/);
  assert.equal(queries[0], 'begin');
  assert.equal(queries.at(-1), 'rollback');
  assert.equal(queries.includes('commit'), false);
  assert.equal(released, 1);
});

test('stale supplier edits never overwrite current data', async () => {
  const queries: string[] = [];
  const api = loadBoundServerModule<{ mutateSupplierDirectory: (input: unknown, audit: unknown) => Promise<unknown> }>('src/shared/server/supplierDirectory.ts', {
    SUPPLIER_DIRECTORY_COLUMNS, SUPPLIER_DIRECTORY_MAX_ROWS: 5000, SupplierDirectoryValidationError, parseSupplierDirectoryMutation,
    getPool: async () => ({ connect: async () => ({
      query: async (sql: string) => { queries.push(sql); return { rows: sql.includes('for update') ? [{ id: 'row-1', position: 0, cells: { ...empty(), dobavitelj: 'New value' }, article_label: '', catalog_item_id: null }] : [], rowCount: 1 }; },
      release: () => undefined
    }) }), insertAuditEvent: async () => assert.fail('Conflicted updates must not write an audit event')
  });
  await assert.rejects(api.mutateSupplierDirectory(update({ dobavitelj: 'Overwrite' }), {}), /med urejanjem/);
  assert.equal(queries.some(sql => sql.startsWith('update catalog_supplier_rows')), false);
  assert.equal(queries.at(-1), 'rollback');
});