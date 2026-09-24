import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { AdminAccountSetupError } from './admin-account-core.mjs';
import { createAdminSetupPool } from './admin-setup-database.mjs';
import { loadManifest, requirementsSha256, verifyDatabaseContract } from './check-database-schema.mjs';

export function previousInstitutionsContract(manifest) {
  if (manifest.contractId !== '20260924.institution-directories-v1') throw new AdminAccountSetupError('This migration requires the institution-directories-v1 release.');
  const requirements = structuredClone(manifest.requirements);
  requirements.tables = requirements.tables.filter(table => table !== 'institution_directories');
  for (const key of ['columns', 'constraints', 'indexes', 'requiredRows']) {
    requirements[key] = requirements[key].filter(entry => entry.table !== 'institution_directories');
  }
  const contractSha256 = 'd36a4541b84a9b3da8fe4dea4abf7d088ea370deee89da2274ddb64c6b58414e';
  if (requirementsSha256(requirements) !== contractSha256) throw new AdminAccountSetupError('The previous schema contract does not match this migration.');
  return { contractId: '20260908.catalog-suppliers-v1', contractSha256, requirements };
}
export async function migrateInstitutionDirectories(pool) {
  const manifest = await loadManifest();
  const baseline = previousInstitutionsContract(manifest);
  const sql = await readFile(new URL('../database/migrations/20260924.institution-directories-v1.sql', import.meta.url), 'utf8');
  const client = await pool.connect();
  let started = false;
  try {
    await client.query('begin');
    started = true;
    await client.query('set local search_path = public, pg_temp');
    await client.query('lock table public.app_schema_contracts in exclusive mode');
    const installed = await client.query('select 1 from public.app_schema_contracts where contract_id = $1 and contract_sha256 = $2', [manifest.contractId, manifest.contractSha256]);
    if (!installed.rows.length) {
      await verifyDatabaseContract(client, baseline);
      await client.query(sql);
      await client.query("insert into public.app_schema_contracts (contract_id, contract_sha256, installed_via) values ($1, $2, 'existing_database')", [manifest.contractId, manifest.contractSha256]);
    }
    await verifyDatabaseContract(client, manifest);
    await client.query('commit');
    started = false;
  } finally {
    if (started) await client.query('rollback').catch(() => undefined);
    client.release();
  }
}
async function main() {
  if (process.argv.length !== 2) throw new AdminAccountSetupError('Usage: node scripts/migrate-institution-directories.mjs. Select the database explicitly with DATABASE_URL.');
  const pool = createAdminSetupPool();
  try {
    await migrateInstitutionDirectories(pool);
    console.info('Institution directory schema installed and verified. Primary schools and customers preserved.');
  } finally { await pool.end(); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error instanceof AdminAccountSetupError ? error.message : 'Institution migration failed and was rolled back. Verify the explicit database target and previous schema contract.');
    process.exitCode = 1;
  });
}
