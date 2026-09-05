import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
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

test('database URL resolution requires DATABASE_URL and preserves its configured value', () => {
  assert.equal(resolveDatabaseUrl({}), null);
  assert.equal(resolveDatabaseUrl({ DATABASE_URL: '' }), null);
  assert.equal(resolveDatabaseUrl({ DATABASE_URL: '   ' }), null);
  assert.equal(
    resolveDatabaseUrl({
      DATABASE_URL: '   ',
      POSTGRES_URL: 'postgresql://postgres-url',
      POSTGRES_PRISMA_URL: 'postgresql://prisma-url',
      SUPABASE_DB_URL: 'postgresql://supabase-url'
    }),
    null
  );
  assert.equal(
    resolveDatabaseUrl({
      DATABASE_URL: '  postgresql://canonical-url  ',
      POSTGRES_URL: 'postgresql://postgres-url'
    }),
    '  postgresql://canonical-url  '
  );
});

test('obsolete database URL aliases cannot select an application database', () => {
  for (const key of ['POSTGRES_URL', 'POSTGRES_PRISMA_URL', 'SUPABASE_DB_URL']) {
    assert.equal(resolveDatabaseUrl({ [key]: 'postgresql://unselected.example/app' }), null);
    assert.equal(
      resolveDatabaseUrl({ DATABASE_URL: '', [key]: 'postgresql://unselected.example/app' }),
      null
    );
  }
});

test('database URL resolution is evaluated on every call', () => {
  const environment: Record<string, string | undefined> = {};
  assert.equal(resolveDatabaseUrl(environment), null);

  environment.DATABASE_URL = 'postgresql://late-bound-url';
  assert.equal(resolveDatabaseUrl(environment), 'postgresql://late-bound-url');
  environment.DATABASE_URL = undefined;
  assert.equal(resolveDatabaseUrl(environment), null);
});

test('localhost launchers keep explicit E2E isolation without database aliases', () => {
  const e2eServer = readFileSync(resolve(process.cwd(), 'scripts/e2e-server.mjs'), 'utf8');
  const localhost = readFileSync(resolve(process.cwd(), 'scripts/start-localhost.ps1'), 'utf8');
  const environmentCore = readFileSync(resolve(process.cwd(), 'src/shared/server/environmentCore.mjs'), 'utf8');

  assert.doesNotMatch(
    [e2eServer, localhost, environmentCore].join('\n'),
    /POSTGRES_URL|POSTGRES_PRISMA_URL|SUPABASE_DB_URL|DATABASE_URL_ENV_KEYS|inspectDatabaseUrlEnvironment/u
  );
  assert.match(e2eServer, /const \{ databaseUrl \} = readE2eEnvironment\(\)/u);
  assert.match(e2eServer, /DATABASE_URL: databaseUrl/u);
  assert.match(localhost, /-Name 'E2E_DATABASE_URL'/u);
  assert.match(localhost, /if \(\$e2eDatabaseUrl -ne \$databaseUrl\)/u);
  assert.match(localhost, /Refusing to start localhost with a non-loopback database/u);
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
    onlineAcceptance: false
  });
  assert.deepEqual(
    resolveQuoteFeatureFlags({
      QUOTE_ADMIN_ENABLED: ' TRUE ',
      QUOTE_PUBLIC_REQUESTS_ENABLED: '1',
      QUOTE_ONLINE_ACCEPTANCE_ENABLED: 'yes'
    }),
    {
      admin: true,
      publicRequests: true,
      onlineAcceptance: false
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
