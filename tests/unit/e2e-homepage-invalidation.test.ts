import assert from 'node:assert/strict';
import test from 'node:test';
import { loadBoundServerModule } from './support/loadBoundServerModule';

type Handler = (request: Request) => Promise<Response>;
type FixtureOptions = {
  env?: Record<string, string | undefined>;
  databaseUrl?: string;
  authenticated?: boolean;
  hasReferenceProduct?: boolean;
  beforeRead?: () => Promise<void>;
};

function fixture(options: FixtureOptions = {}) {
  const observed = { authenticationCalls: 0, databaseQueries: 0, invalidatedPaths: [] as string[] };
  const { rejectAdminCrossOrigin } = loadBoundServerModule<{ rejectAdminCrossOrigin: (request: Request) => Response | null }>(
    'src/shared/auth/adminCsrf.ts', { NextResponse: Response }
  );
  const { withAdminRoute } = loadBoundServerModule<{ withAdminRoute: (handler: Handler) => Handler }>(
    'src/shared/auth/adminRoute.ts', {
      getAdminSession: async () => {
        observed.authenticationCalls += 1;
        return options.authenticated === false ? null : { user: { id: 'e2e-admin' } };
      },
      isAuthorizedAdminCron: () => false,
      rejectAdminCrossOrigin
    }
  );
  const env = {
    E2E_MODE: '1', E2E_LOCAL_PRIVATE_BLOB: '1', VERCEL: undefined,
    ADMIN_SESSION_SECRET: 'e2e-test-secret-with-at-least-32-characters',
    E2E_SCHEMA_SHA256: 'a'.repeat(64), ...options.env
  };
  const route = loadBoundServerModule<{ POST: Handler }>('src/app/api/e2e/health/route.ts', {
    NextResponse: Response, withAdminRoute, process: { env },
    schemaContract: { contractId: 'test-contract', contractSha256: 'b'.repeat(64) },
    getDatabaseUrl: () => options.databaseUrl ?? 'postgresql://localhost:5432/atehna_e2e_test',
    getPool: async () => ({
      query: async () => {
        observed.databaseQueries += 1;
        if (observed.databaseQueries === 1) {
          await options.beforeRead?.();
          return { rows: [{ database_name: 'atehna_e2e_test', effective_user: 'test-admin',
            schema_sha256: 'a'.repeat(64), has_schema_contract_table: true, has_seed: true,
            has_reference_product: options.hasReferenceProduct !== false, has_admin_account: true }] };
        }
        return { rows: [{ installed: true }] };
      }
    }),
    revalidatePath: (path: string) => observed.invalidatedPaths.push(path)
  });
  return { ...route, observed };
}
function post(url = 'http://localhost:3108/api/e2e/health', origin = new URL(url).origin) {
  return new Request(url, { method: 'POST', headers: { Origin: origin } });
}

test('homepage invalidation is unavailable outside local E2E storage, including Vercel with both E2E flags', async () => {
  for (const options of [
    { env: { E2E_MODE: undefined } },
    { env: { E2E_LOCAL_PRIVATE_BLOB: undefined } },
    { env: { VERCEL: '1' } },
    { databaseUrl: 'postgresql://database.example:5432/atehna_e2e_test' }
  ]) {
    const route = fixture(options);
    assert.equal((await route.POST(post())).status, 404);
    assert.equal(route.observed.authenticationCalls, 0);
    assert.equal(route.observed.databaseQueries, 0);
    assert.deepEqual(route.observed.invalidatedPaths, []);
  }
  for (const url of ['https://localhost/api/e2e/health', 'http://example.com/api/e2e/health']) {
    const route = fixture();
    assert.equal((await route.POST(post(url))).status, 404);
    assert.equal(route.observed.authenticationCalls, 0);
    assert.equal(route.observed.databaseQueries, 0);
    assert.deepEqual(route.observed.invalidatedPaths, []);
  }
});

test('homepage invalidation requires the live admin session before reading readiness', async () => {
  const route = fixture({ authenticated: false });
  const response = await route.POST(post());
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(route.observed.authenticationCalls, 1);
  assert.equal(route.observed.databaseQueries, 0);
  assert.deepEqual(route.observed.invalidatedPaths, []);
});

test('homepage invalidation retains the shared admin cross-origin rejection', async () => {
  const route = fixture();
  const response = await route.POST(post(undefined, 'https://untrusted.example'));
  assert.equal(response.status, 403);
  assert.equal(route.observed.databaseQueries, 0);
  assert.deepEqual(route.observed.invalidatedPaths, []);
});

test('an unprepared isolated database cannot invalidate the homepage', async () => {
  const route = fixture({ hasReferenceProduct: false });
  const response = await route.POST(post());
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(route.observed.databaseQueries, 2);
  assert.deepEqual(route.observed.invalidatedPaths, []);
  assert.deepEqual(await response.json(), { ok: false, reason: 'database-not-prepared' });
});

test('homepage invalidation awaits readiness and only expires the literal homepage', async () => {
  let release!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  let entered!: () => void;
  const reading = new Promise<void>(resolve => { entered = resolve; });
  const route = fixture({ beforeRead: () => { entered(); return wait; } });
  const pending = route.POST(post());
  await reading;
  assert.equal(route.observed.authenticationCalls, 1);
  assert.deepEqual(route.observed.invalidatedPaths, []);
  release();
  const response = await pending;
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(route.observed.databaseQueries, 2);
  assert.deepEqual(route.observed.invalidatedPaths, ['/']);
  assert.deepEqual(await response.json(), { ok: true, revalidated: '/' });
});
