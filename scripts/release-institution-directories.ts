import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import type { Pool } from 'pg';
import { createAdminSetupPool } from './admin-setup-database.mjs';
import { consolidateInstitutionDirectories, type ConsolidationDirectory } from '../src/shared/domain/institutionEmailConsolidation';
import { normalizeInstitutionName } from '../src/shared/domain/institutionName';
import { INSTITUTION_DIRECTORIES } from '../src/shared/domain/institutionDirectory';

const VERSION = 3;
const RAW_ARCHIVE_PATH = 'src/shared/data/institutions-seed.json';
type StoredRow = { id: string; position: number; cells: Record<string, string> };
type StoredDocument = { id: string; seed_version: number; content: { columns: ConsolidationDirectory['columns']; rows: StoredRow[] } };
export type InstitutionReleaseTarget = { host: string; port: string; database: string };
export type InstitutionReleaseSnapshot = {
  primaryColumns: ConsolidationDirectory['columns']; primaryRows: StoredRow[];
  primaryMeta: Array<{ key: string; seed_version: number }>;
  documents: StoredDocument[]; orderLinks: Array<{ id: number; school_directory_row_id: string }>;
};
export type InstitutionReleaseArchive = { version: number; directories: ConsolidationDirectory[] };
const contentOf = (directory: ConsolidationDirectory) => ({ columns: directory.columns, rows: directory.rows });
function stableValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b, 'en')).map(([key, child]) => [key, stableValue(child)]));
  return value;
}
export const institutionReleaseFingerprint = (value: unknown) => createHash('sha256').update(JSON.stringify(stableValue(value))).digest('hex');

export function validateInstitutionReleaseTarget(connectionString: string | undefined, expectedHost: string, expectedDatabase: string): InstitutionReleaseTarget {
  if (!connectionString) throw new Error('An explicit DATABASE_URL is required; this runner does not load environment files.');
  let url: URL;
  try { url = new URL(connectionString); } catch { throw new Error('DATABASE_URL is invalid.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('DATABASE_URL must use PostgreSQL.');
  const database = decodeURIComponent(url.pathname.slice(1));
  if (!expectedHost || !expectedDatabase || url.hostname !== expectedHost || database !== expectedDatabase) throw new Error('DATABASE_URL does not match the explicitly expected host/database.');
  return { host: url.hostname, port: url.port || '5432', database };
}

/** Plan against current edited records; archived rows only initialize absent source documents. */
export function buildInstitutionReleasePlan(snapshot: InstitutionReleaseSnapshot, archive: InstitutionReleaseArchive, target: InstitutionReleaseTarget) {
  if (!snapshot.primaryColumns.length || snapshot.primaryMeta.length !== 1) throw new Error('Initialize the existing primary-school directory before this release.');
  const rawById = new Map(archive.directories.map(directory => [directory.id, directory]));
  const knownIds = new Set(archive.directories.map(directory => directory.id));
  if (archive.directories.length !== 9 || knownIds.size !== 9) throw new Error('Expected the original nine-directory archive.');
  const documents = new Map(snapshot.documents.map(document => [document.id, document]));
  if (documents.size !== snapshot.documents.length || snapshot.documents.some(document => !knownIds.has(document.id))) throw new Error('Unknown or repeated stored institution directory.');
  const initializedDirectories: string[] = [];
  const input: ConsolidationDirectory[] = [{ id: 'osnovne-sole', label: 'Osnovne šole', columns: snapshot.primaryColumns, rows: snapshot.primaryRows.map(({ id, position, cells }) => ({ id, position, cells })) }];
  // Same deterministic source order as the raw seed builder, independent of SQL row order.
  for (const raw of archive.directories) {
    const stored = documents.get(raw.id);
    // A consolidated Vrtci document is the durable marker that the old units list is retired.
    // In particular, an intentionally emptied Vrtci document must never be repopulated.
    if (!stored && raw.id === 'vrtci-z-enotami' && (documents.get('vrtci')?.seed_version ?? 0) >= VERSION) continue;
    if (stored) input.push({ id: raw.id, label: raw.label, ...stored.content });
    else {
      initializedDirectories.push(raw.id);
      input.push(structuredClone(rawById.get(raw.id)!));
    }
  }
  const consolidated = consolidateInstitutionDirectories(input);
  const nameChanges: Array<{ directoryId: string; rowId: string; before: string; after: string }> = [];
  const directories = consolidated.directories.map(directory => ({ ...directory, rows: directory.rows.map(row => {
    const before = row.cells.naziv ?? '';
    const after = normalizeInstitutionName(before);
    if (before === after) return row;
    nameChanges.push({ directoryId: directory.id, rowId: row.id, before, after });
    return { ...row, cells: { ...row.cells, naziv: after } };
  }) }));
  const primary = directories.find(directory => directory.id === 'osnovne-sole')!;
  assert.deepEqual(primary.columns, snapshot.primaryColumns, 'The live primary-column schema differs from the import; review its metadata before release.');
  assert.deepEqual(consolidateInstitutionDirectories(directories).directories, directories, 'Release output must be idempotent.');
  const primaryRemaps = consolidated.mappings.filter(mapping => mapping.sourceDirectoryId === 'osnovne-sole' && mapping.sourceRowId !== mapping.canonicalRowId);
  assert.ok(primaryRemaps.every(mapping => mapping.targetDirectoryId === 'osnovne-sole'));
  const orderRemaps = primaryRemaps.map(mapping => ({ sourceRowId: mapping.sourceRowId, canonicalRowId: mapping.canonicalRowId, orderIds: snapshot.orderLinks.filter(order => order.school_directory_row_id === mapping.sourceRowId).map(order => order.id) }));
  const changed = snapshot.primaryMeta[0].seed_version !== VERSION
    || !isDeepStrictEqual(snapshot.primaryRows.map(({ id, position, cells }) => ({ id, position, cells })), primary.rows)
    || snapshot.documents.length !== directories.length - 1
    || directories.filter(directory => directory.id !== 'osnovne-sole').some(directory => {
      const stored = documents.get(directory.id);
      return !stored || stored.seed_version !== VERSION || !isDeepStrictEqual(stored.content, contentOf(directory));
    });
  const plan = {
    version: 1, target, sourceArchive: { path: RAW_ARCHIVE_PATH, version: archive.version, fingerprint: institutionReleaseFingerprint(archive) },
    beforeFingerprint: institutionReleaseFingerprint(snapshot), changed, initializedDirectories,
    summary: { ...consolidated.summary, initializedDirectories: initializedDirectories.length, abbreviatedNames: nameChanges.length, remappedOrders: orderRemaps.reduce((count, remap) => count + remap.orderIds.length, 0) },
    directories, mappings: consolidated.mappings, groups: consolidated.audit, nameChanges, orderRemaps
  };
  return { ...plan, planSha256: institutionReleaseFingerprint(plan) };
}

export async function releaseInstitutionDirectories(pool: Pool, options: { target: InstitutionReleaseTarget; outputDirectory: string; apply?: boolean; expectedPlanSha256?: string; archive?: InstitutionReleaseArchive }) {
  const apply = options.apply === true;
  if (apply && !/^[a-f0-9]{64}$/.test(options.expectedPlanSha256 ?? '')) throw new Error('Applying requires --plan-sha256 from a reviewed dry run.');
  const archive = options.archive ?? JSON.parse(await readFile(new URL('../src/shared/data/institutions-seed.json', import.meta.url), 'utf8')) as InstitutionReleaseArchive;
  const client = await pool.connect();
  let transaction = false;
  try {
    await client.query('begin'); transaction = true;
    await client.query('set local search_path = public, pg_temp');
    if (apply) await client.query('lock table school_directory_columns, school_directory_rows, school_directory_meta, institution_directories, orders in exclusive mode');
    else await client.query('set transaction isolation level repeatable read read only');
    const databaseName = (await client.query('select current_database() as name')).rows[0].name;
    if (databaseName !== options.target.database) throw new Error('Connected database does not match the expected release target.');
    // SELECT-only until the complete snapshot, plan, fingerprint, and backups are ready.
    // A missing additive schema deliberately fails here instead of implicitly changing schema.
    const snapshot: InstitutionReleaseSnapshot = {
      primaryColumns: (await client.query('select id, label, position from school_directory_columns order by position, id')).rows,
      primaryRows: (await client.query('select * from school_directory_rows order by position, id')).rows,
      primaryMeta: (await client.query("select * from school_directory_meta where key = 'schools'")).rows,
      documents: (await client.query('select * from institution_directories order by id')).rows,
      orderLinks: (await client.query('select id, school_directory_row_id from orders where school_directory_row_id is not null order by id')).rows
    };
    const plan = buildInstitutionReleasePlan(snapshot, archive, options.target);
    if (apply && plan.planSha256 !== options.expectedPlanSha256) throw new Error(`Release plan changed; no data was written. Run a new dry run and review its fingerprint (${plan.planSha256}).`);
    await mkdir(options.outputDirectory, { recursive: true });
    await writeFile(resolve(options.outputDirectory, 'before.json'), JSON.stringify({ capturedAt: new Date().toISOString(), target: options.target, snapshot }, null, 2) + '\n', { flag: 'wx' });
    await writeFile(resolve(options.outputDirectory, 'plan.json'), JSON.stringify(plan, null, 2) + '\n', { flag: 'wx' });
    if (apply && plan.changed) {
      for (const remap of plan.orderRemaps) if (remap.orderIds.length) {
        const saved = await client.query('update orders set school_directory_row_id = $2 where id = any($3::bigint[]) and school_directory_row_id = $1', [remap.sourceRowId, remap.canonicalRowId, remap.orderIds]);
        assert.equal(saved.rowCount, remap.orderIds.length);
      }
      const primary = plan.directories.find(directory => directory.id === 'osnovne-sole')!;
      await client.query('insert into school_directory_rows (id, position, cells) select entry.id, entry.position, entry.cells from jsonb_to_recordset($1::jsonb) as entry(id text, position integer, cells jsonb) on conflict (id) do update set position = excluded.position, cells = excluded.cells, updated_at = clock_timestamp() where school_directory_rows.position is distinct from excluded.position or school_directory_rows.cells is distinct from excluded.cells', [JSON.stringify(primary.rows)]);
      await client.query('delete from school_directory_rows where not (id = any($1::text[]))', [primary.rows.map(row => row.id)]);
      await client.query("update school_directory_meta set seed_version = $1, updated_at = clock_timestamp() where key = 'schools'", [VERSION]);
      for (const directory of plan.directories.filter(directory => directory.id !== 'osnovne-sole')) await client.query('insert into institution_directories (id, seed_version, content) values ($1, $2, $3::jsonb) on conflict (id) do update set seed_version = excluded.seed_version, content = excluded.content, updated_at = clock_timestamp() where institution_directories.content is distinct from excluded.content or institution_directories.seed_version is distinct from excluded.seed_version', [directory.id, VERSION, JSON.stringify(contentOf(directory))]);
      await client.query("delete from institution_directories where id = 'vrtci-z-enotami'");
      assert.deepEqual((await client.query('select id, position, cells from school_directory_rows order by position, id')).rows, primary.rows);
      const savedDocuments = (await client.query<{ id: string; seed_version: number; content: StoredDocument['content'] }>('select id, seed_version, content from institution_directories order by id')).rows;
      assert.equal(savedDocuments.length, plan.directories.length - 1);
      for (const directory of plan.directories.filter(directory => directory.id !== 'osnovne-sole')) {
        const stored = savedDocuments.find(document => document.id === directory.id);
        assert.equal(stored?.seed_version, VERSION);
        assert.deepEqual(stored?.content, contentOf(directory));
      }
      const expectedLinks = snapshot.orderLinks.map(order => ({ ...order, school_directory_row_id: plan.orderRemaps.find(remap => remap.sourceRowId === order.school_directory_row_id)?.canonicalRowId ?? order.school_directory_row_id }));
      assert.deepEqual((await client.query('select id, school_directory_row_id from orders where school_directory_row_id is not null order by id')).rows, expectedLinks);
    }
    await client.query('commit'); transaction = false;
    const receipt = { completedAt: new Date().toISOString(), target: options.target, applied: apply, changed: plan.changed, planSha256: plan.planSha256, ...plan.summary };
    await writeFile(resolve(options.outputDirectory, 'result.json'), JSON.stringify(receipt, null, 2) + '\n');
    return receipt;
  } finally {
    if (transaction) await client.query('rollback').catch(() => undefined);
    client.release();
  }
}

async function main() {
  const args = process.argv.slice(2), values = new Map<string, string>(); let apply = false;
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    if (key === '--apply' && !apply) { apply = true; continue; }
    if (!['--output', '--expected-host', '--expected-database', '--plan-sha256'].includes(key) || values.has(key) || !args[index + 1] || args[index + 1].startsWith('--')) throw new Error('Usage: tsx scripts/release-institution-directories.ts --expected-host <host> --expected-database <database> --output <new-backup-directory> [--apply --plan-sha256 <reviewed-hash>]');
    values.set(key, args[++index]);
  }
  const outputDirectory = values.get('--output');
  if (!outputDirectory) throw new Error('--output must name a new backup directory.');
  if (!apply && values.has('--plan-sha256')) throw new Error('--plan-sha256 is only used with --apply.');
  const target = validateInstitutionReleaseTarget(process.env.DATABASE_URL, values.get('--expected-host') ?? '', values.get('--expected-database') ?? '');
  const pool = createAdminSetupPool();
  try { console.info(JSON.stringify(await releaseInstitutionDirectories(pool, { target, outputDirectory: resolve(outputDirectory), apply, expectedPlanSha256: values.get('--plan-sha256') }))); }
  finally { await pool.end(); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error instanceof Error ? error.message : 'Institution release failed.'); process.exitCode = 1; });
