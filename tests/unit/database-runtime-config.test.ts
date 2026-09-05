import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveDatabasePoolRuntimeConfig } from '@/shared/server/db';

const DATABASE_RUNTIME_DEFAULTS = {
  poolMax: 10,
  connectionTimeoutMillis: 0,
  idleTimeoutMillis: 10_000,
  statementTimeoutMillis: 0,
  lockTimeoutMillis: 0
};

test('database runtime config preserves node-postgres defaults in every environment', () => {
  for (const environment of [
    { NODE_ENV: 'development' },
    { NODE_ENV: 'production' },
    { NODE_ENV: 'production', E2E_MODE: '1' }
  ]) {
    assert.deepEqual(resolveDatabasePoolRuntimeConfig(environment), DATABASE_RUNTIME_DEFAULTS);
  }
});

test('database runtime config accepts explicit overrides and disabled timeouts', () => {
  assert.deepEqual(
    resolveDatabasePoolRuntimeConfig({
      NODE_ENV: 'production',
      ATEHNA_DB_POOL_MAX: ' 24 ',
      ATEHNA_DB_CONNECTION_TIMEOUT_MS: '15000',
      ATEHNA_DB_IDLE_TIMEOUT_MS: '60000',
      ATEHNA_DB_STATEMENT_TIMEOUT_MS: '180000',
      ATEHNA_DB_LOCK_TIMEOUT_MS: '5000'
    }),
    {
      poolMax: 24,
      connectionTimeoutMillis: 15_000,
      idleTimeoutMillis: 60_000,
      statementTimeoutMillis: 180_000,
      lockTimeoutMillis: 5_000
    }
  );

  assert.deepEqual(
    resolveDatabasePoolRuntimeConfig({
      NODE_ENV: 'production',
      ATEHNA_DB_CONNECTION_TIMEOUT_MS: '0',
      ATEHNA_DB_IDLE_TIMEOUT_MS: '0',
      ATEHNA_DB_STATEMENT_TIMEOUT_MS: '0',
      ATEHNA_DB_LOCK_TIMEOUT_MS: '0'
    }),
    {
    poolMax: 10,
    connectionTimeoutMillis: 0,
    idleTimeoutMillis: 0,
    statementTimeoutMillis: 0,
    lockTimeoutMillis: 0
    }
  );
});

test('database runtime config rejects malformed and unsafe values', () => {
  const invalidValues = [
    ['ATEHNA_DB_POOL_MAX', '0'],
    ['ATEHNA_DB_POOL_MAX', '51'],
    ['ATEHNA_DB_CONNECTION_TIMEOUT_MS', '99'],
    ['ATEHNA_DB_IDLE_TIMEOUT_MS', '999'],
    ['ATEHNA_DB_STATEMENT_TIMEOUT_MS', '1.5'],
    ['ATEHNA_DB_LOCK_TIMEOUT_MS', '120001']
  ] as const;

  for (const [key, value] of invalidValues) {
    assert.throws(() => resolveDatabasePoolRuntimeConfig({ [key]: value }), new RegExp(key));
  }
});
