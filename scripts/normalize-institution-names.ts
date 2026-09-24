import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool } from 'pg';
import { createAdminSetupPool } from './admin-setup-database.mjs';
import { normalizeInstitutionName } from '../src/shared/domain/institutionName';

type StoredRow = { id: string; cells: Record<string, string>; position: number };
type StoredDocument = { id: string; content: { rows: StoredRow[]; columns: unknown[] } };
type NameChange = { directoryId: string; rowId: string; before: string; after: string };

/** Local-only, explicit data maintenance. Never touch contacts, row identity, order or category. */
export async function normalizeStoredInstitutionNames(pool: Pool, outputDirectory: string, apply = false) {
  const client = await pool.connect();
  let transaction = false;
  try {
    await client.query('begin');
    transaction = true;
    await client.query('set local search_path = public, pg_temp');
    if (apply) await client.query('lock table school_directory_rows, school_directory_meta, institution_directories in exclusive mode');
    else await client.query('set transaction isolation level repeatable read read only');
    const databaseName = (await client.query('select current_database() as name')).rows[0].name as string;
    if (!databaseName.startsWith('atehna_e2e_')) throw new Error('Institution name maintenance requires the isolated local atehna_e2e database.');
    const primaryRows = (await client.query<StoredRow>('select * from school_directory_rows order by position, id')).rows;
    const primaryMeta = (await client.query("select * from school_directory_meta where key = 'schools'")).rows;
    const documents = (await client.query<StoredDocument>('select * from institution_directories order by id')).rows;
    const changes: NameChange[] = [];
    const normalizeRows = (directoryId: string, rows: StoredRow[]) => rows.map(row => {
      const before = row.cells.naziv ?? '';
      const after = normalizeInstitutionName(before);
      if (before === after) return row;
      changes.push({ directoryId, rowId: row.id, before, after });
      return { ...row, cells: { ...row.cells, naziv: after } };
    });
    const nextPrimary = normalizeRows('osnovne-sole', primaryRows);
    const nextDocuments = documents.map(document => ({ ...document, content: { ...document.content, rows: normalizeRows(document.id, document.content.rows) } }));
    const plan = { changes, changedNames: changes.length, directories: ['osnovne-sole', ...documents.map(document => document.id)].map(directoryId => ({ directoryId, changedNames: changes.filter(change => change.directoryId === directoryId).length })) };
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(resolve(outputDirectory, 'before.json'), JSON.stringify({ capturedAt: new Date().toISOString(), primaryRows, primaryMeta, documents }, null, 2) + '\n', { flag: 'wx' });
    await writeFile(resolve(outputDirectory, 'plan.json'), JSON.stringify(plan, null, 2) + '\n', { flag: 'wx' });
    if (apply && changes.length) {
      const primaryChanges = changes.filter(change => change.directoryId === 'osnovne-sole');
      for (const change of primaryChanges) {
        const result = await client.query("update school_directory_rows set cells = jsonb_set(cells, '{naziv}', to_jsonb($2::text)), updated_at = clock_timestamp() where id = $1 and cells->>'naziv' = $3", [change.rowId, change.after, change.before]);
        assert.equal(result.rowCount, 1);
      }
      if (primaryChanges.length) await client.query("update school_directory_meta set updated_at = clock_timestamp() where key = 'schools'");
      for (const document of nextDocuments) {
        if (!changes.some(change => change.directoryId === document.id)) continue;
        const saved = await client.query('update institution_directories set content = $2::jsonb, updated_at = clock_timestamp() where id = $1', [document.id, JSON.stringify(document.content)]);
        assert.equal(saved.rowCount, 1);
      }
      const savedPrimary = (await client.query<StoredRow>('select id, cells, position from school_directory_rows order by position, id')).rows;
      assert.deepEqual(savedPrimary, nextPrimary.map(({ id, cells, position }) => ({ id, cells, position })));
      const savedDocuments = (await client.query<StoredDocument>('select id, content from institution_directories order by id')).rows;
      assert.deepEqual(savedDocuments, nextDocuments.map(({ id, content }) => ({ id, content })));
    }
    await client.query('commit');
    transaction = false;
    const receipt = { completedAt: new Date().toISOString(), applied: apply, changed: changes.length > 0, ...plan };
    await writeFile(resolve(outputDirectory, 'result.json'), JSON.stringify(receipt, null, 2) + '\n');
    return receipt;
  } finally {
    if (transaction) await client.query('rollback').catch(() => undefined);
    client.release();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const outputIndex = args.indexOf('--output');
  const output = outputIndex >= 0 ? args[outputIndex + 1] : undefined;
  const apply = args.includes('--apply');
  const allowed = output ? ['--output', output, ...(apply ? ['--apply'] : [])] : [];
  if (!output || args.length !== allowed.length || args.some(value => !allowed.includes(value))) throw new Error('Usage: tsx scripts/normalize-institution-names.ts --output <new-backup-directory> [--apply]. Select the local DATABASE_URL explicitly.');
  const target = new URL(process.env.DATABASE_URL ?? '');
  if (!['localhost', '127.0.0.1'].includes(target.hostname) || target.port !== '55434' || !target.pathname.startsWith('/atehna_e2e_')) throw new Error('Expected the isolated local database on port 55434.');
  const pool = createAdminSetupPool();
  try {
    const result = await normalizeStoredInstitutionNames(pool, resolve(output), apply);
    console.log(JSON.stringify({ applied: result.applied, changed: result.changed, changedNames: result.changedNames, directories: result.directories }));
  } finally { await pool.end(); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error instanceof Error ? error.message : 'Institution name normalization failed.'); process.exitCode = 1; });
}
