import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';
import ts from 'typescript';
import { isAuthorizedAdminCron } from '@/shared/auth/adminCron';
import { rejectAdminCrossOrigin } from '@/shared/auth/adminCsrf';
import { loadBoundServerModule } from './support/loadBoundServerModule';

type Handler = (request: Request, context?: unknown) => Promise<Response>;
type Guard = (handler: Handler, options?: { allowCron?: boolean }) => Handler;
const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true })
  .flatMap(entry => entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]);
const methods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

function guardWith(verify: (request: Request) => Promise<unknown>) {
  return loadBoundServerModule<{ withAdminRoute: Guard }>('src/shared/auth/adminRoute.ts', {
    getAdminSession: verify, isAuthorizedAdminCron, rejectAdminCrossOrigin
  }).withAdminRoute;
}

test('every existing admin API method rejects an anonymous request before executing its operation', async () => {
  let operationCalls = 0;
  let verifications = 0;
  const withAdminRoute = guardWith(async () => { verifications++; return null; });
  const operation: Handler = async () => { operationCalls++; return Response.json({ private: true }); };
  const bindings = Object.fromEntries([...methods].map(method => ['handleAdmin' + method, operation]));
  let checked = 0;
  for (const file of walk('src/app/api/admin').filter(path => path.endsWith('route.ts'))) {
    const path = relative('src/app/api/admin', file).replaceAll('\\', '/').replace(/\/route\.ts$/, '');
    // Authentication endpoints have independent strict guards and dedicated integration tests.
    if (/^(login|logout|session|skrbniki)(\/|$)/.test(path)) continue;
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const declared = source.statements.flatMap(statement =>
      ts.isVariableStatement(statement)
        ? statement.declarationList.declarations.map(declaration => declaration.name.getText(source)).filter(name => methods.has(name))
        : []);
    assert.ok(declared.length > 0, file + ' must explicitly wrap its exported HTTP methods');
    const api = loadBoundServerModule<Record<string, Handler>>(file, { ...bindings, withAdminRoute });
    for (const method of declared) {
      const before = verifications;
      const response = await api[method](new Request('https://atehna.test/api/admin/' + path.replace(/\[[^/]+\]/g, '1'), {
        method, headers: { origin: 'https://atehna.test', cookie: 'atehna_admin_session=forged' }
      }), { params: Promise.resolve({ orderId: '1', quoteRequestId: '1', documentId: '1' }) });
      assert.equal(response.status, 401, file + ' ' + method);
      assert.match(response.headers.get('cache-control') ?? '', /no-store/, file);
      assert.equal(verifications, before + 1, file + ' must await session verification');
      checked++;
    }
  }
  assert.ok(checked >= 138);
  assert.equal(operationCalls, 0);
});

test('guard fails closed on verification errors, rejects forged writes, and preserves authorized route context', async () => {
  let operations = 0;
  const context = { params: Promise.resolve({ orderId: '42' }) };
  const request = new Request('https://atehna.test/api/admin/orders/42/status', {
    method: 'POST', headers: { origin: 'https://atehna.test' }
  });
  const operation: Handler = async (received, receivedContext) => {
    operations++;
    assert.equal(received, request);
    assert.equal(receivedContext, context);
    return Response.json({ ok: true });
  };
  const unavailable = guardWith(async () => { throw new Error('private database details'); })(operation);
  const denied = await unavailable(request, context);
  assert.equal(denied.status, 503);
  assert.doesNotMatch(await denied.text(), /database details/);
  assert.equal(operations, 0);
  const authorized = guardWith(async () => ({ username: 'fixture' }))(operation);
  const forged = await authorized(new Request(request.url, {
    method: 'POST', headers: { origin: 'https://attacker.test', 'sec-fetch-site': 'cross-site' }
  }), context);
  assert.equal(forged.status, 403);
  assert.equal(operations, 0);
  const accepted = await authorized(request, context);
  assert.equal(accepted.status, 200);
  assert.equal(accepted.headers.get('cache-control'), 'private, no-store');
  assert.equal(operations, 1);
});

test('cron authentication is limited to configured GET paths and cannot bypass unrelated admin operations', async () => {
  const previous = process.env.CRON_SECRET;
  process.env.CRON_SECRET = 'isolated-cron-test-secret';
  try {
    const headers = { authorization: 'Bearer ' + process.env.CRON_SECRET };
    const url = 'https://atehna.test/api/admin/quote-workflow/process';
    assert.equal(isAuthorizedAdminCron(new Request(url, { headers })), true);
    for (const request of [
      new Request(url, { method: 'POST', headers }),
      new Request(url, { headers: { authorization: 'Bearer wrong-secret' } }),
      new Request('https://atehna.test/api/admin/orders', { headers }),
      new Request(url)
    ]) assert.equal(isAuthorizedAdminCron(request), false);
    const withAdminRoute = guardWith(async () => null);
    const operation = async () => Response.json({ ok: true });
    assert.equal((await withAdminRoute(operation, { allowCron: true })(new Request(url, { headers }))).status, 200);
    assert.equal((await withAdminRoute(operation)(new Request(url, { headers }))).status, 401);
    assert.equal((await withAdminRoute(operation, { allowCron: true })(new Request('https://atehna.test/api/admin/orders', { headers }))).status, 401);
    delete process.env.CRON_SECRET;
    assert.equal(isAuthorizedAdminCron(new Request(url, { headers })), false);
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
});

test('every protected admin page verifies its session before rendering private server components', async () => {
  const denied = new Error('redirect to login');
  let renders = 0;
  const { withAdminPage } = loadBoundServerModule<{
    withAdminPage: (page: () => null) => () => Promise<unknown>
  }>('src/shared/auth/adminPage.tsx', {
    cache: (fn: unknown) => fn,
    getAdminPageSession: async () => null,
    redirect: () => { throw denied; }
  });
  let checked = 0;
  for (const file of walk('src/app/admin').filter(path => path.endsWith('page.tsx'))) {
    if (relative('src/app/admin', file) === 'page.tsx') continue;
    const page = loadBoundServerModule<{ default: () => Promise<unknown> }>(file, {
      withAdminPage,
      AdminPage: () => { renders++; return null; },
      AdminAccountSettingsPage: () => { renders++; return null; }
    });
    await assert.rejects(page.default(), error => error === denied, file);
    checked++;
  }
  assert.ok(checked >= 31);
  assert.equal(renders, 0);
});

