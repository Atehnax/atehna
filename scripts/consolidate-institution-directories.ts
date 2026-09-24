import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool } from 'pg';
import { createAdminSetupPool } from './admin-setup-database.mjs';
import { consolidateInstitutionDirectories, type ConsolidationDirectory } from '../src/shared/domain/institutionEmailConsolidation';
import { INSTITUTION_DIRECTORIES } from '../src/shared/domain/institutionDirectory';

const VERSION = 3;
// Match archived source order so identical starting data yields the same canonical IDs as fresh seeds.
const sourceOrder: string[] = INSTITUTION_DIRECTORIES.flatMap(directory =>
  directory.id === 'vrtci' ? ['vrtci-z-enotami', 'vrtci'] : [directory.id]
);
type StoredDocument = { id: string; seed_version: number; content: Omit<ConsolidationDirectory, 'id' | 'label'> };
const contentOf = (directory: ConsolidationDirectory) => ({ columns: directory.columns, rows: directory.rows });

/** Explicit one-time data migration; dry-run by default, with complete backups before writes. */
export async function consolidateStoredInstitutions(pool: Pool, outputDirectory: string, apply = false) {
  const client = await pool.connect();
  let transaction = false;
  try {
    await client.query('begin');
    transaction = true;
    await client.query('set local search_path = public, pg_temp');
    if (apply) {
      // Serialize with inline row/structure edits while allowing ordinary SELECT readers.
      await client.query('lock table school_directory_columns, school_directory_rows, school_directory_meta, institution_directories, orders in exclusive mode');
    } else {
      await client.query('set transaction isolation level repeatable read read only');
    }
    const columns = (await client.query('select id, label, position from school_directory_columns order by position, id')).rows;
    const primaryRows = (await client.query('select * from school_directory_rows order by position, id')).rows;
    const meta = (await client.query("select * from school_directory_meta where key = 'schools'")).rows;
    const documents = (await client.query<StoredDocument>('select * from institution_directories order by id')).rows;
    if (!columns.length || !meta.length) throw new Error('Initialize the school directory before consolidation.');
    const input: ConsolidationDirectory[] = [
      { id: 'osnovne-sole', label: 'Osnovne šole', columns, rows: primaryRows.map(({ id, position, cells }) => ({ id, position, cells })) },
      ...documents.toSorted((a, b) => sourceOrder.indexOf(a.id) - sourceOrder.indexOf(b.id)).map(document => ({
        id: document.id,
        label: INSTITUTION_DIRECTORIES.find(directory => directory.id === document.id)?.label ?? document.id,
        ...document.content
      }))
    ];
    for (const definition of INSTITUTION_DIRECTORIES.slice(1)) {
      if (!input.some(directory => directory.id === definition.id)) throw new Error('Initialize every institution directory before consolidation.');
    }
    const result = consolidateInstitutionDirectories(input);
    assert.equal(result.mappings.length, result.summary.inputRows);
    assert.deepEqual(consolidateInstitutionDirectories(result.directories).directories, result.directories, 'Consolidation must be idempotent.');
    const primary = result.directories.find(directory => directory.id === 'osnovne-sole')!;
    assert.deepEqual(primary.columns, columns, 'Primary column changes require a separate schema review.');
    const remaps = result.mappings.filter(mapping =>
      mapping.sourceDirectoryId === 'osnovne-sole' && mapping.sourceRowId !== mapping.canonicalRowId
    );
    assert.ok(remaps.every(mapping => mapping.targetDirectoryId === 'osnovne-sole'));
    const affectedOrders = (await client.query(
      'select id, school_directory_row_id from orders where school_directory_row_id = any($1::text[]) order by id',
      [remaps.map(mapping => mapping.sourceRowId)]
    )).rows;
    const changed = meta[0].seed_version !== VERSION
      || documents.some(document => document.id === 'vrtci-z-enotami' || document.seed_version !== VERSION)
      || !isDeepStrictEqual(input.map(directory => [directory.id, contentOf(directory)]).sort(),
         result.directories.map(directory => [directory.id, contentOf(directory)]).sort());
    const backup = { capturedAt: new Date().toISOString(), primaryColumns: columns, primaryRows, primaryMeta: meta, documents, affectedOrders };
    await mkdir(outputDirectory, { recursive: true });
    // Exclusive creation prevents reruns from overwriting the original backup.
    await writeFile(resolve(outputDirectory, 'before.json'), JSON.stringify(backup, null, 2) + '\n', { flag: 'wx' });
    await writeFile(resolve(outputDirectory, 'plan.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
    if (apply && changed) {
      for (const mapping of remaps) {
        await client.query('update orders set school_directory_row_id = $2 where school_directory_row_id = $1',
          [mapping.sourceRowId, mapping.canonicalRowId]);
      }
      await client.query(
        'insert into school_directory_rows (id, position, cells) '
        + 'select entry.id, entry.position, entry.cells from jsonb_to_recordset($1::jsonb) as entry(id text, position integer, cells jsonb) '
        + 'on conflict (id) do update set position = excluded.position, cells = excluded.cells, updated_at = clock_timestamp() '
        + 'where school_directory_rows.position is distinct from excluded.position or school_directory_rows.cells is distinct from excluded.cells',
        [JSON.stringify(primary.rows)]
      );
      await client.query('delete from school_directory_rows where not (id = any($1::text[]))', [primary.rows.map(row => row.id)]);
      await client.query("update school_directory_meta set seed_version = $1, updated_at = clock_timestamp() where key = 'schools'", [VERSION]);
      for (const directory of result.directories.filter(directory => directory.id !== 'osnovne-sole')) {
        await client.query(
          'insert into institution_directories (id, seed_version, content) values ($1, $2, $3::jsonb) '
          + 'on conflict (id) do update set seed_version = excluded.seed_version, content = excluded.content, updated_at = clock_timestamp() '
          + 'where institution_directories.content is distinct from excluded.content or institution_directories.seed_version is distinct from excluded.seed_version',
          [directory.id, VERSION, JSON.stringify(contentOf(directory))]
        );
      }
      await client.query("delete from institution_directories where id = 'vrtci-z-enotami'");
      const savedPrimary = (await client.query('select id, position, cells from school_directory_rows order by position, id')).rows;
      assert.deepEqual(savedPrimary, primary.rows);
      const savedDocuments = (await client.query<StoredDocument>('select id, content from institution_directories order by id')).rows;
      assert.equal(savedDocuments.length, result.directories.length - 1);
      for (const directory of result.directories.filter(directory => directory.id !== 'osnovne-sole')) {
        assert.deepEqual(savedDocuments.find(document => document.id === directory.id)?.content, contentOf(directory));
      }
      const staleReferences = (await client.query(
        'select count(*)::integer as count from orders where school_directory_row_id = any($1::text[])',
        [remaps.map(mapping => mapping.sourceRowId)]
      )).rows[0].count;
      assert.equal(staleReferences, 0);
    }
    await client.query('commit');
    transaction = false;
    const receipt = { completedAt: new Date().toISOString(), applied: apply, changed, remappedOrders: apply ? affectedOrders.length : 0, ...result.summary };
    await writeFile(resolve(outputDirectory, 'result.json'), JSON.stringify(receipt, null, 2) + '\n');
    return receipt;
  } finally {
    if (transaction) await client.query('rollback').catch(() => undefined);
    client.release();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const outputIndex = args.indexOf('--output');
  const output = outputIndex >= 0 ? args[outputIndex + 1] : undefined;
  const allowed = output ? ['--output', output, ...(apply ? ['--apply'] : [])] : [];
  if (!output || args.length !== allowed.length || args.some(value => !allowed.includes(value))) {
    throw new Error('Usage: tsx scripts/consolidate-institution-directories.ts --output <new-backup-directory> [--apply]. Select DATABASE_URL explicitly.');
  }
  const pool = createAdminSetupPool();
  try { console.info(JSON.stringify(await consolidateStoredInstitutions(pool, resolve(output), apply))); }
  finally { await pool.end(); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : 'Institution consolidation failed.');
    process.exitCode = 1;
  });
}
