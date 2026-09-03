import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, test } from 'node:test';
import {
  readE2eEnvironment,
  verifyCanonicalE2eSchemaState,
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
const schemaContract = JSON.parse(
  readFileSync(
    resolve(process.cwd(), 'database', 'schema-contract.json'),
    'utf8'
  )
) as {
  contractId: string;
  contractSha256: string;
};
const verifyCanonicalE2eSchemaStateWithContract =
  verifyCanonicalE2eSchemaState as unknown as (
    pool: Parameters<typeof verifyCanonicalE2eSchemaState>[0],
    expectedSchemaSha256: string,
    verifyContract: (
      client: unknown,
      manifest: typeof schemaContract
    ) => Promise<void>
  ) => Promise<void>;

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

  const schemaSha256 = 'a'.repeat(64);
  const completeSchemaProbe = {
    has_catalog_items: true,
    has_catalog_item_variants: true,
    has_catalog_media: true,
    has_product_appearance: true,
    has_gurs_addresses: true,
    has_default_variant: true,
    has_variant_content: true
  };
  const exactSchemaPool = {
    async query(text: string, values?: readonly unknown[]) {
      if (text.includes('from e2e_schema_state')) {
        assert.deepEqual(values, ['canonical-schema']);
        return { rows: [{ sha256: schemaSha256 }] };
      }
      if (text.includes("to_regclass('public.catalog_items')")) {
        return { rows: [completeSchemaProbe] };
      }
      throw new Error(`Unexpected query: ${text}`);
    }
  };
  let contractVerificationCount = 0;
  await verifyCanonicalE2eSchemaStateWithContract(
    exactSchemaPool,
    schemaSha256,
    async (client: unknown, manifest: typeof schemaContract) => {
      contractVerificationCount += 1;
      assert.equal(client, exactSchemaPool);
      assert.equal(manifest.contractId, schemaContract.contractId);
      assert.equal(manifest.contractSha256, schemaContract.contractSha256);
    }
  );
  assert.equal(contractVerificationCount, 1);

  const staleSchemaPool = {
    async query() {
      return { rows: [{ sha256: 'b'.repeat(64) }] };
    }
  };
  await assert.rejects(
    verifyCanonicalE2eSchemaState(staleSchemaPool, schemaSha256),
    /canonical-schema fingerprint is missing or stale/u
  );

  for (const missingSchemaCheck of Object.keys(completeSchemaProbe)) {
    let contractVerifierCalled = false;
    const incompleteSchemaPool = {
      async query(text: string) {
        if (text.includes('from e2e_schema_state')) {
          return { rows: [{ sha256: schemaSha256 }] };
        }
        if (text.includes("to_regclass('public.catalog_items')")) {
          return {
            rows: [{
              ...completeSchemaProbe,
              [missingSchemaCheck]: false
            }]
          };
        }
        throw new Error(`Unexpected query: ${text}`);
      }
    };
    await assert.rejects(
      verifyCanonicalE2eSchemaStateWithContract(
        incompleteSchemaPool,
        schemaSha256,
        async () => {
          contractVerifierCalled = true;
        }
      ),
      new RegExp(missingSchemaCheck, 'u')
    );
    assert.equal(contractVerifierCalled, false);
  }

  await assert.rejects(
    verifyCanonicalE2eSchemaStateWithContract(
      exactSchemaPool,
      schemaSha256,
      async (_client: unknown, manifest: typeof schemaContract) => {
        assert.equal(manifest.contractId, schemaContract.contractId);
        assert.equal(manifest.contractSha256, schemaContract.contractSha256);
        throw new Error('[schema-contract] Missing tables: quote_requests.');
      }
    ),
    /\[schema-contract\] Missing tables: quote_requests\./u
  );
});

test('E2E server clears live email credentials after inheriting the environment', () => {
  const serverSource = readFileSync(
    resolve(process.cwd(), 'scripts', 'e2e-server.mjs'),
    'utf8'
  );
  const inheritedEnvironmentIndex = serverSource.indexOf('...process.env');
  const clearedResendKeyIndex = serverSource.indexOf(
    "RESEND_API_KEY: ''",
    inheritedEnvironmentIndex
  );
  const e2eModeIndex = serverSource.indexOf(
    "E2E_MODE: '1'",
    clearedResendKeyIndex
  );

  assert.ok(inheritedEnvironmentIndex >= 0);
  assert.ok(clearedResendKeyIndex > inheritedEnvironmentIndex);
  assert.ok(e2eModeIndex > clearedResendKeyIndex);
});

test('terminal schema contract rehearsal is explicit and guarded by E2E ownership', () => {
  const setupSource = readFileSync(
    resolve(process.cwd(), 'scripts', 'e2e-database.mjs'),
    'utf8'
  );
  const rehearsalStart = setupSource.indexOf(
    'export async function rehearseE2eSchemaContract()'
  );
  const targetGuard = setupSource.indexOf(
    'await verifyE2eResetTarget(',
    rehearsalStart
  );
  const preflight = setupSource.indexOf(
    'await verifyDatabase(pool, schemaSha256, seedChecksum);',
    targetGuard
  );
  const ledgerDrop = setupSource.indexOf(
    "await pool.query('drop table public.app_schema_contracts');",
    preflight
  );
  const secondVerification = setupSource.indexOf(
    'await verifyDatabase(pool, schemaSha256, seedChecksum);',
    ledgerDrop
  );

  assert.ok(rehearsalStart >= 0);
  assert.ok(targetGuard > rehearsalStart);
  assert.ok(preflight > targetGuard);
  assert.ok(ledgerDrop > preflight);
  assert.ok(secondVerification > ledgerDrop);
  assert.match(
    setupSource.slice(rehearsalStart),
    /for \(let attempt = 0; attempt < 2; attempt \+= 1\)[\s\S]*pool\.query\(terminalContractSql\)/u
  );
  assert.match(
    setupSource.slice(rehearsalStart),
    /installed_via !== 'existing_database'/u
  );
  assert.match(
    setupSource.slice(rehearsalStart),
    /stockEnforcementEnabled[\s\S]*'false'::jsonb[\s\S]*drop table public\.app_schema_contracts/u
  );
  assert.match(
    setupSource.slice(rehearsalStart),
    /installed_via !== 'existing_database'[\s\S]*stockEnforcementEnabled[\s\S]*'true'::jsonb/u
  );
});
