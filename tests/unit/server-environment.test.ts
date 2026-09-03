import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  inspectDatabaseUrlEnvironment,
  resolveDatabaseSslConfig,
  resolveDatabaseUrl,
  resolvePostgresSslMode,
  resolveQuoteFeatureFlags
} from '@/shared/server/environmentCore.mjs';

test('runtime environment access is behind the server-only wrapper', () => {
  const wrapper = readFileSync(
    resolve(process.cwd(), 'src/shared/server/serverEnvironment.ts'),
    'utf8'
  );
  assert.match(wrapper, /^import 'server-only';/u);
  assert.match(wrapper, /= process\.env/gmu);
});

test('database URL resolution preserves supported precedence and raw value', () => {
  assert.equal(resolveDatabaseUrl({}), null);
  assert.equal(
    resolveDatabaseUrl({
      DATABASE_URL: '   ',
      POSTGRES_URL: 'postgresql://postgres-url',
      POSTGRES_PRISMA_URL: 'postgresql://prisma-url',
      SUPABASE_DB_URL: 'postgresql://supabase-url'
    }),
    'postgresql://postgres-url'
  );
  assert.equal(
    resolveDatabaseUrl({
      DATABASE_URL: '  postgresql://canonical-url  ',
      POSTGRES_URL: 'postgresql://postgres-url'
    }),
    '  postgresql://canonical-url  '
  );
});

test('database URL metadata identifies aliases and conflicts without secrets', () => {
  const sharedUrl = 'postgresql://user:same-secret@database.example/app';
  assert.deepEqual(
    inspectDatabaseUrlEnvironment({
      DATABASE_URL: ' ' + sharedUrl + ' ',
      POSTGRES_URL: sharedUrl,
      POSTGRES_PRISMA_URL: ''
    }),
    {
      selectedKey: 'DATABASE_URL',
      configuredKeys: ['DATABASE_URL', 'POSTGRES_URL'],
      hasConflictingValues: false
    }
  );

  const metadata = inspectDatabaseUrlEnvironment({
    DATABASE_URL: 'postgresql://primary-user:primary-secret@primary.example/app',
    POSTGRES_URL: 'postgresql://legacy-user:legacy-secret@legacy.example/app'
  });
  assert.deepEqual(metadata, {
    selectedKey: 'DATABASE_URL',
    configuredKeys: ['DATABASE_URL', 'POSTGRES_URL'],
    hasConflictingValues: true
  });

  const serialized = JSON.stringify(metadata);
  assert.doesNotMatch(
    serialized,
    /primary-secret|legacy-secret|primary\.example|legacy\.example/u
  );
});

test('database URL resolution and metadata are evaluated on every call', () => {
  const environment: Record<string, string | undefined> = {};
  assert.equal(resolveDatabaseUrl(environment), null);
  assert.deepEqual(inspectDatabaseUrlEnvironment(environment).configuredKeys, []);

  environment.POSTGRES_PRISMA_URL = 'postgresql://late-bound-url';
  assert.equal(resolveDatabaseUrl(environment), 'postgresql://late-bound-url');
  assert.deepEqual(
    inspectDatabaseUrlEnvironment(environment).configuredKeys,
    ['POSTGRES_PRISMA_URL']
  );
});

test('PostgreSQL SSL mode preserves trimming, case normalization, and empty values', () => {
  assert.equal(resolvePostgresSslMode({}), null);
  assert.equal(
    resolvePostgresSslMode({ PGSSLMODE: ' Verify-Full ' }),
    'verify-full'
  );
  assert.equal(resolvePostgresSslMode({ PGSSLMODE: '   ' }), '');
});

test('database SSL resolution is shared by runtime and verification callers', () => {
  assert.deepEqual(
    resolveDatabaseSslConfig('postgresql://database.example/app', {}),
    { rejectUnauthorized: false }
  );
  assert.deepEqual(
    resolveDatabaseSslConfig('postgresql://database.example/app', {
      PGSSLMODE: ' VERIFY-FULL '
    }),
    { rejectUnauthorized: true }
  );
  assert.equal(
    resolveDatabaseSslConfig(
      'postgresql://database.example/app?sslmode=prefer',
      { PGSSLMODE: 'verify-full' }
    ),
    false
  );
  assert.equal(
    resolveDatabaseSslConfig('postgresql://127.0.0.1:5432/app', {}),
    false
  );
});

test('quote feature flags remain independent and default closed', () => {
  assert.deepEqual(resolveQuoteFeatureFlags({}), {
    admin: false,
    publicRequests: false,
    onlineAcceptance: false,
    emailDelivery: false
  });
  assert.deepEqual(
    resolveQuoteFeatureFlags({
      QUOTE_ADMIN_ENABLED: ' TRUE ',
      QUOTE_PUBLIC_REQUESTS_ENABLED: '1',
      QUOTE_ONLINE_ACCEPTANCE_ENABLED: 'yes',
      QUOTE_EMAIL_DELIVERY_ENABLED: '0'
    }),
    {
      admin: true,
      publicRequests: true,
      onlineAcceptance: false,
      emailDelivery: false
    }
  );
});

test('quote feature flags are evaluated on every call', () => {
  const environment: Record<string, string | undefined> = {
    QUOTE_ADMIN_ENABLED: 'false'
  };
  assert.equal(resolveQuoteFeatureFlags(environment).admin, false);

  environment.QUOTE_ADMIN_ENABLED = '1';
  assert.equal(resolveQuoteFeatureFlags(environment).admin, true);
});
