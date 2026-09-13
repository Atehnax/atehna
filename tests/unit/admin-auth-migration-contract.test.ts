import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadManifest } from '../../scripts/check-database-schema.mjs';
import { previousAuthContract, resolveAdminAuthMigrationContract } from '../../scripts/migrate-admin-auth.mjs';

test('auth upgrade reconstructs the validated intermediate contract from the supplier release', async () => {
  const current = await loadManifest();
  const auth = resolveAdminAuthMigrationContract(current);
  assert.equal(auth.contractId, '20260908.admin-auth-v1');
  assert.equal(auth.contractSha256, 'aaa39829b4667551c9736c21a786f809421f91f58435ff6e5ba981236edbf026');
  assert.equal(previousAuthContract(auth).contractId, '20260907.historical-orders-v6');
  assert.equal(resolveAdminAuthMigrationContract(auth), auth);
  assert.ok(Array.isArray(auth.requirements.tables));
  assert.ok(Array.isArray(current.requirements.tables));
  assert.ok(!auth.requirements.tables.includes('catalog_supplier_rows'));
  assert.ok(current.requirements.tables.includes('catalog_supplier_rows'));
});

test('auth upgrade refuses unknown releases and a modified intermediate schema', async () => {
  const current = await loadManifest();
  assert.throws(() => resolveAdminAuthMigrationContract({ ...current, contractId: 'future-release' }), /requires the admin-auth-v1/);
  const modified = structuredClone(current);
  assert.ok(Array.isArray(modified.requirements.tables));
  modified.requirements.tables.push('unexpected_table');
  assert.throws(() => resolveAdminAuthMigrationContract(modified), /previous schema contract does not match/);
});
