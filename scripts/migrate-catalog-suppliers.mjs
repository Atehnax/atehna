import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { AdminAccountSetupError } from './admin-account-core.mjs';
import { createAdminSetupPool } from './admin-setup-database.mjs';
import { loadManifest, requirementsSha256, verifyDatabaseContract } from './check-database-schema.mjs';

const previousContractId = '20260908.admin-auth-v1';
const previousContractSha256 = 'aaa39829b4667551c9736c21a786f809421f91f58435ff6e5ba981236edbf026';
export function previousSuppliersContract(manifest) {
  if (manifest.contractId !== '20260908.catalog-suppliers-v1') throw new AdminAccountSetupError('This migration is only for the catalog-suppliers-v1 release.');
  const requirements = structuredClone(manifest.requirements);
  requirements.tables = requirements.tables.filter(table => table !== 'catalog_supplier_rows');
  for (const key of ['columns', 'constraints', 'indexes', 'requiredRows']) {
    requirements[key] = requirements[key].filter(entry => entry.table !== 'catalog_supplier_rows');
  }
  if (requirementsSha256(requirements) !== previousContractSha256) throw new AdminAccountSetupError('The previous schema contract does not match this migration.');
  return { contractId: previousContractId, contractSha256: previousContractSha256, requirements };
}
export async function migrateCatalogSuppliers(pool) {
  const manifest = await loadManifest();
  const baseline = previousSuppliersContract(manifest);
  const sql = await readFile(new URL('../database/migrations/20260908.catalog-suppliers-v1.sql', import.meta.url), 'utf8');
  const client = await pool.connect();
  let transactionStarted = false;
  try {
    await client.query('begin');
    transactionStarted = true;
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
    transactionStarted = false;
  } finally {
    if (transactionStarted) await client.query('rollback').catch(() => undefined);
    client.release();
  }
}
async function main() {
  if (process.argv.length !== 2) throw new AdminAccountSetupError('Usage: node scripts/migrate-catalog-suppliers.mjs. Select the database explicitly with DATABASE_URL.');
  const pool = createAdminSetupPool();
  try {
    await migrateCatalogSuppliers(pool);
    console.info('Supplier schema verified and installed. Existing data and authentication configuration were preserved.');
  } finally { await pool.end(); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error instanceof AdminAccountSetupError ? error.message : 'Supplier migration failed and was rolled back. Verify the explicit database target and previous schema contract.');
    process.exitCode = 1;
  });
}