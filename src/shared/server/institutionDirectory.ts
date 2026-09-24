import 'server-only';

import { unstable_noStore as noStore } from 'next/cache';
import type { PoolClient } from 'pg';
import institutionSeed from '@/shared/data/schools-and-institutions-seed.json';
import type { SchoolDirectoryData, SchoolDirectoryMutation } from '@/shared/domain/schoolDirectory';
import {
  applyInstitutionDirectoryMutation, assertInstitutionDirectoryId,
  type InstitutionDirectoryContent, type InstitutionDirectoryId
} from '@/shared/domain/institutionDirectory';
import { getSchoolDirectory, mutateSchoolDirectory } from '@/shared/server/schoolDirectory';
import { getPool, isDatabaseUnavailableError } from '@/shared/server/db';

type StoredDirectory = { content: InstitutionDirectoryContent; updated_at: string | Date };
function seedContent(directoryId: InstitutionDirectoryId): InstitutionDirectoryContent {
  const seed = institutionSeed.directories.find(directory => directory.id === directoryId);
  if (!seed) throw new Error('Institution directory seed is missing.');
  return {
    columns: seed.columns.map((column, position) => ({ ...column, position })),
    rows: seed.rows.map((row, position) => ({ id: row.id, position, cells: { ...row.cells } }))
  };
}
const publicData = (stored: StoredDirectory): SchoolDirectoryData => ({
  ...stored.content, updatedAt: new Date(stored.updated_at).toISOString(), persistenceAvailable: true
});
async function seedDirectory(client: PoolClient, directoryId: InstitutionDirectoryId) {
  // A directory is initialized only once; deletion of every row does not reseed it.
  await client.query(
    `insert into institution_directories (id, seed_version, content) values ($1, $2, $3::jsonb)
     on conflict (id) do nothing`,
    [directoryId, institutionSeed.version, JSON.stringify(seedContent(directoryId))]
  );
}

export async function getInstitutionDirectory(input: unknown = 'osnovne-sole'): Promise<SchoolDirectoryData> {
  const directoryId = assertInstitutionDirectoryId(input);
  if (directoryId === 'osnovne-sole') return getSchoolDirectory();
  noStore();
  try {
    const pool = await getPool();
    const client = await pool.connect();
    try {
      await seedDirectory(client, directoryId);
      const result = await client.query<StoredDirectory>(
        'select content, updated_at from institution_directories where id = $1', [directoryId]
      );
      if (!result.rowCount) throw new Error('Institution directory was not initialized.');
      return publicData(result.rows[0]);
    } finally { client.release(); }
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) console.error('Failed to load institution directory', error);
    return { ...seedContent(directoryId), updatedAt: null, persistenceAvailable: false };
  }
}

export async function mutateInstitutionDirectory(input: unknown, mutation: unknown) {
  const directoryId = assertInstitutionDirectoryId(input);
  if (directoryId === 'osnovne-sole') return mutateSchoolDirectory(mutation as SchoolDirectoryMutation);
  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query('begin');
    await seedDirectory(client, directoryId);
    // Lock the selected document through commit. Concurrent edits serialize and compare
    // their expected cell snapshots against the latest data, never another tab's rows.
    const stored = await client.query<StoredDirectory>(
      'select content, updated_at from institution_directories where id = $1 for update', [directoryId]
    );
    if (!stored.rowCount) throw new Error('Institution directory was not initialized.');
    const { content, result } = applyInstitutionDirectoryMutation(stored.rows[0].content, mutation);
    const saved = await client.query<{ updated_at: Date }>(
      'update institution_directories set content = $2::jsonb, updated_at = clock_timestamp() where id = $1 returning updated_at',
      [directoryId, JSON.stringify(content)]
    );
    if (!saved.rowCount) throw new Error('Institution directory was not saved.');
    await client.query('commit');
    return { ...result, updatedAt: new Date(saved.rows[0].updated_at).toISOString() };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally { client.release(); }
}
