import 'server-only';

import type { PoolClient } from 'pg';
import { INSTITUTION_DIRECTORY_VIEWS, resolveInstitutionDirectoryViewId, InstitutionDirectoryValidationError, type InstitutionDirectoryContent, type InstitutionDirectoryId } from '@/shared/domain/institutionDirectory';
import { applyInstitutionDirectoryViewMutation, combineInstitutionDirectoryView, planInstitutionDirectoryViewMutation, type InstitutionDirectoryViewSource } from '@/shared/domain/institutionDirectoryView';
import type { SchoolDirectoryColumn, SchoolDirectoryData, SchoolDirectoryRow } from '@/shared/domain/schoolDirectory';
import { getInstitutionDirectory, mutateInstitutionDirectory } from '@/shared/server/institutionDirectory';
import { getPool } from '@/shared/server/db';

function selectedView(input: unknown) {
  const id = resolveInstitutionDirectoryViewId(input);
  const view = INSTITUTION_DIRECTORY_VIEWS.find(view => view.id === id);
  if (!view) throw new InstitutionDirectoryValidationError('Neveljaven seznam šol in zavodov.');
  return view;
}
export async function getInstitutionDirectoryView(input: unknown = 'vsi-seznami'): Promise<SchoolDirectoryData> {
  const view = selectedView(input);
  if (view.directoryIds.length === 1) return getInstitutionDirectory(view.directoryIds[0]);
  const sources = await Promise.all(view.directoryIds.map(async directoryId => ({ directoryId, data: await getInstitutionDirectory(directoryId) })));
  return combineInstitutionDirectoryView(sources);
}

async function readLockedSources(client: PoolClient, ids: readonly InstitutionDirectoryId[]) {
  const sources: InstitutionDirectoryViewSource[] = [];
  if (ids.includes('osnovne-sole')) {
    // Match the existing primary editor's structure -> columns -> rows lock order.
    await client.query("select pg_advisory_xact_lock(hashtext('school-directory-structure'))");
    const columns = (await client.query<SchoolDirectoryColumn>('select id, label, position from school_directory_columns order by position, id for share')).rows;
    const rows = (await client.query<SchoolDirectoryRow>('select id, position, cells from school_directory_rows order by id for update')).rows;
    const meta = (await client.query<{ updated_at: Date }>("select updated_at from school_directory_meta where key = 'schools'")).rows[0];
    if (!meta) throw new Error('Primary-school directory was not initialized.');
    sources.push({ directoryId: 'osnovne-sole', data: { columns, rows, updatedAt: new Date(meta.updated_at).toISOString(), persistenceAvailable: true } });
  }
  const documentIds = ids.filter(id => id !== 'osnovne-sole');
  const documents = await client.query<{ id: InstitutionDirectoryId; content: InstitutionDirectoryContent; updated_at: Date }>(
    'select id, content, updated_at from institution_directories where id = any($1::text[]) order by id for update', [documentIds]
  );
  if (documents.rows.length !== documentIds.length) throw new Error('Institution directories were not initialized.');
  for (const document of documents.rows) sources.push({ directoryId: document.id, data: { ...document.content, updatedAt: new Date(document.updated_at).toISOString(), persistenceAvailable: true } });
  return ids.map(id => sources.find(source => source.directoryId === id)!);
}

async function savePrimaryRows(client: PoolClient, before: SchoolDirectoryData, after: InstitutionDirectoryContent) {
  const previous = new Map(before.rows.map(row => [row.id, row]));
  const current = new Set(after.rows.map(row => row.id));
  const deleted = before.rows.filter(row => !current.has(row.id)).map(row => row.id);
  // Write only rows changed by this operation; other primary records remain untouched.
  const changed = after.rows.filter(row => {
    const old = previous.get(row.id);
    return !old || old.position !== row.position || Object.entries(row.cells).some(([key, value]) => old.cells[key] !== value)
      || Object.keys(old.cells).some(key => !Object.hasOwn(row.cells, key));
  });
  if (changed.length) await client.query(
    'insert into school_directory_rows (id, position, cells) '
    + 'select entry.id, entry.position, entry.cells from jsonb_to_recordset($1::jsonb) as entry(id text, position integer, cells jsonb) '
    + 'on conflict (id) do update set position = excluded.position, cells = excluded.cells, updated_at = clock_timestamp()',
    [JSON.stringify(changed)]
  );
  if (deleted.length) await client.query('delete from school_directory_rows where id = any($1::text[])', [deleted]);
  const result = await client.query<{ updated_at: Date }>("update school_directory_meta set updated_at = clock_timestamp() where key = 'schools' returning updated_at");
  if (!result.rowCount) throw new Error('Primary-school directory was not saved.');
  return new Date(result.rows[0].updated_at).toISOString();
}

export async function mutateInstitutionDirectoryView(input: unknown, mutation: unknown) {
  const view = selectedView(input);
  if (view.directoryIds.length === 1) return mutateInstitutionDirectory(view.directoryIds[0], mutation);
  planInstitutionDirectoryViewMutation(view.directoryIds, mutation);
  // Use the existing one-time initializers before the aggregate transaction starts.
  const initialized = await Promise.all(view.directoryIds.map(id => getInstitutionDirectory(id)));
  if (initialized.some(directory => !directory.persistenceAvailable)) throw new Error('Seznama trenutno ni mogoče shraniti. Osvežite stran in poskusite znova.');
  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query('begin');
    const sources = await readLockedSources(client, view.directoryIds);
    const { changes, result } = applyInstitutionDirectoryViewMutation(sources, view.directoryIds, mutation);
    let updatedAt = '';
    for (const change of changes) {
      if (change.directoryId === 'osnovne-sole') {
        updatedAt = await savePrimaryRows(client, sources.find(source => source.directoryId === 'osnovne-sole')!.data, change.content);
      } else {
        const saved = await client.query<{ updated_at: Date }>(
          'update institution_directories set content = $2::jsonb, updated_at = clock_timestamp() where id = $1 returning updated_at',
          [change.directoryId, JSON.stringify(change.content)]
        );
        if (!saved.rowCount) throw new Error('Institution directory was not saved.');
        updatedAt = new Date(saved.rows[0].updated_at).toISOString();
      }
    }
    await client.query('commit');
    return { ...result, updatedAt };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally { client.release(); }
}
