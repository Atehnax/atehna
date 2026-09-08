import assert from 'node:assert/strict';
import test from 'node:test';
import { createAdminSetupPool } from '../../scripts/admin-setup-database.mjs';

test('offline admin setup uses native PostgreSQL timeout parameters without an options command string', async () => {
  const databaseUrl = 'postgresql://setup-test@127.0.0.1:5432/offline_setup_configuration_test';
  const pool = createAdminSetupPool({ DATABASE_URL: databaseUrl });
  try {
    assert.equal(pool.options.connectionString, databaseUrl);
    assert.equal(pool.options.statement_timeout, 15_000);
    assert.equal(pool.options.lock_timeout, 5_000);
    assert.equal(pool.options.options, undefined);
    assert.equal(pool.options.max, 1);
    assert.equal(pool.options.connectionTimeoutMillis, 5_000);
    assert.equal(pool.options.idleTimeoutMillis, 5_000);
    assert.equal(pool.totalCount, 0, 'Configuration must not open a database connection.');
  } finally {
    await pool.end();
  }
});

test('offline admin setup still requires an explicit PostgreSQL target', () => {
  for (const environment of [{}, { DATABASE_URL: '' }, { DATABASE_URL: 'invalid' }, { DATABASE_URL: 'https://example.test' }]) {
    assert.throws(() => createAdminSetupPool(environment));
  }
});
