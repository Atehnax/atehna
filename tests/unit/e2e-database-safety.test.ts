import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
  readE2eEnvironment,
  verifyE2eResetTarget
} from '../../scripts/e2e-database.mjs';

const controlledEnvironmentKeys = [
  'E2E_MODE',
  'E2E_DATABASE_URL',
  'DATABASE_URL',
  'E2E_STORAGE_NAMESPACE',
  'ADMIN_USERNAME',
  'ADMIN_PASSWORD',
  'ADMIN_SESSION_SECRET'
] as const;
const originalEnvironment = Object.fromEntries(
  controlledEnvironmentKeys.map((key) => [key, process.env[key]])
);

function configureEnvironment(databaseName: string, namespace: string) {
  process.env.E2E_MODE = '1';
  process.env.E2E_DATABASE_URL = `postgresql://e2e-user@127.0.0.1:55432/${databaseName}`;
  process.env.DATABASE_URL = process.env.E2E_DATABASE_URL;
  process.env.E2E_STORAGE_NAMESPACE = namespace;
  process.env.ADMIN_USERNAME = 'e2e-admin';
  process.env.ADMIN_PASSWORD = 'e2e-password';
  process.env.ADMIN_SESSION_SECRET = 'unit-test-session-secret-at-least-32-characters';
}

afterEach(() => {
  for (const key of controlledEnvironmentKeys) {
    const originalValue = originalEnvironment[key];
    if (originalValue === undefined) delete process.env[key];
    else process.env[key] = originalValue;
  }
});

test('database reset accepts only the per-run database derived from its namespace', () => {
  configureEnvironment('atehna_e2e_local_a1b2c3d4', 'local-a1b2c3d4');

  const environment = readE2eEnvironment();

  assert.equal(environment.databaseName, 'atehna_e2e_local_a1b2c3d4');
});

test('database reset refuses a generic shared test database', () => {
  configureEnvironment('atehna_e2e', 'local-a1b2c3d4');

  assert.throws(
    () => readE2eEnvironment(),
    /database name must exactly match the isolated E2E storage namespace/u
  );
});

test('database reset refuses a database derived from a different run namespace', () => {
  configureEnvironment('atehna_e2e_local_deadbeef', 'local-a1b2c3d4');

  assert.throws(
    () => readE2eEnvironment(),
    /database name must exactly match the isolated E2E storage namespace/u
  );
});

test('database reset refuses non-canonical namespaces that could alias another run', () => {
  configureEnvironment('atehna_e2e_run_abc_def_01', 'RUN-abc.def-01');

  assert.throws(
    () => readE2eEnvironment(),
    /must be 12-52 lowercase letters, digits, or hyphens/u
  );
});

test('database reset verifies live identity and ownership before destructive SQL', async () => {
  configureEnvironment('atehna_e2e_local_a1b2c3d4', 'local-a1b2c3d4');
  const environment = readE2eEnvironment();
  const queries: string[] = [];
  const ownedPool = {
    async query(text: string, values?: readonly unknown[]) {
      queries.push(text);
      if (text.includes('current_database()')) {
        return {
          rows: [{
            database: environment.databaseIdentity.database,
            effective_user: environment.databaseIdentity.effectiveUser
          }]
        };
      }
      if (text.includes('object_count')) return { rows: [{ object_count: 1 }] };
      if (text.includes("to_regclass('public.e2e_reset_ownership')")) {
        return { rows: [{ has_ownership_table: true }] };
      }
      if (text.includes('from public.e2e_reset_ownership')) {
        assert.deepEqual(values, [
          environment.storageNamespace,
          environment.databaseIdentity.database,
          environment.databaseIdentity.effectiveUser,
          environment.resetOwnershipHash
        ]);
        return { rows: [{ owned: true }] };
      }
      throw new Error(`Unexpected query: ${text}`);
    }
  };

  await verifyE2eResetTarget(
    ownedPool,
    environment.databaseIdentity,
    environment.storageNamespace,
    environment.resetOwnershipHash
  );
  assert.equal(queries.some((query) => /drop\s+schema/iu.test(query)), false);

  const wrongIdentityPool = {
    async query() {
      return { rows: [{ database: 'postgres', effective_user: 'e2e-user' }] };
    }
  };
  await assert.rejects(
    verifyE2eResetTarget(
      wrongIdentityPool,
      environment.databaseIdentity,
      environment.storageNamespace,
      environment.resetOwnershipHash
    ),
    /live PostgreSQL database\/user identity does not match/u
  );

  const unownedPool = {
    async query(text: string) {
      if (text.includes('current_database()')) {
        return {
          rows: [{
            database: environment.databaseIdentity.database,
            effective_user: environment.databaseIdentity.effectiveUser
          }]
        };
      }
      if (text.includes('object_count')) return { rows: [{ object_count: 1 }] };
      return { rows: [{ has_ownership_table: false }] };
    }
  };
  await assert.rejects(
    verifyE2eResetTarget(
      unownedPool,
      environment.databaseIdentity,
      environment.storageNamespace,
      environment.resetOwnershipHash
    ),
    /has no E2E reset-ownership marker/u
  );
});
