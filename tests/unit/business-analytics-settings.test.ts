import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { BusinessSettingsInputError, parseQuoteGoLiveDate } from '@/shared/domain/analytics/businessSettings';

function loadModule(path: string, bindings: Record<string, unknown>) {
  const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
  const code = source.statements.filter(statement => !ts.isImportDeclaration(statement)).map(statement => statement.getText(source)).join('\n');
  const exports = {};
  runInNewContext(ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, ...bindings });
  return exports as Record<string, (...args: unknown[]) => Promise<unknown>>;
}
function settingsHarness(auditFails = false) {
  const operations: string[] = [];
  const audits: unknown[] = [];
  let stored = { quote_go_live_date: null as string | null, revision: '0', updated_at: '2026-09-01T10:00:00.000Z' };
  let pending = { ...stored };
  const client = {
    async query(sql: string, args?: unknown[]) {
      operations.push(sql);
      if (sql === 'begin') pending = { ...stored };
      if (sql.startsWith('update business_analytics_settings')) pending = { ...pending, quote_go_live_date: args?.[0] as string | null, revision: String(BigInt(pending.revision) + 1n) };
      if (sql === 'commit') stored = { ...pending };
      return { rows: sql.startsWith('select quote_go_live_date') ? [{ ...pending }] : [] };
    },
    release() { operations.push('release'); }
  };
  const service = loadModule('src/shared/server/businessAnalyticsSettings.ts', {
    parseQuoteGoLiveDate, BusinessSettingsInputError,
    getPool: async () => ({ connect: async () => client }),
    insertAuditEventForRequest: async (_request: unknown, audit: unknown) => { if (auditFails) throw new Error('audit unavailable'); audits.push(audit); }
  });
  return { service, operations, audits, stored: () => stored };
}

test('go-live setting uses a locked revision, saves date and audit atomically, and no-op saves do not create history', async () => {
  const harness = settingsHarness();
  const saved = await harness.service.saveBusinessAnalyticsSettings({ quoteGoLiveDate: '2026-08-01', expectedRevision: '0' }, {}) as { quoteGoLiveDate: string; revision: string };
  assert.equal(saved.quoteGoLiveDate, '2026-08-01');
  assert.equal(saved.revision, '1');
  assert.equal(harness.stored().quote_go_live_date, '2026-08-01');
  assert.equal(harness.audits.length, 1);
  assert.ok(harness.operations.indexOf('begin') < harness.operations.findIndex(sql => sql.includes('for update')));
  assert.equal(harness.operations.at(-2), 'commit');
  await harness.service.saveBusinessAnalyticsSettings({ quoteGoLiveDate: '2026-08-01', expectedRevision: '1' }, {});
  assert.equal(harness.audits.length, 1);
  assert.equal(harness.stored().revision, '1');
});

test('stale revision or failed audit rolls back and preserves the original go-live date', async () => {
  const stale = settingsHarness();
  await assert.rejects(stale.service.saveBusinessAnalyticsSettings({ quoteGoLiveDate: '2026-08-01', expectedRevision: '2' }, {}), /medtem spremenil/);
  assert.equal(stale.stored().quote_go_live_date, null);
  assert.equal(stale.operations.some(sql => sql.startsWith('update ')), false);
  assert.equal(stale.operations.at(-2), 'rollback');
  const failure = settingsHarness(true);
  await assert.rejects(failure.service.saveBusinessAnalyticsSettings({ quoteGoLiveDate: '2026-08-01', expectedRevision: '0' }, {}), /audit unavailable/);
  assert.equal(failure.stored().quote_go_live_date, null);
  assert.equal(failure.stored().revision, '0');
  assert.equal(failure.operations.at(-2), 'rollback');
});

test('invalid or missing date and revision fail before accessing persistence', async () => {
  for (const input of [{ expectedRevision: '0' }, { quoteGoLiveDate: '2026-02-30', expectedRevision: '0' }, { quoteGoLiveDate: null }, { quoteGoLiveDate: '2026-08-01', expectedRevision: '9223372036854775807' }]) {
    const harness = settingsHarness();
    await assert.rejects(harness.service.saveBusinessAnalyticsSettings(input, {}));
    assert.equal(harness.operations.length, 0);
  }
});

test('settings HTTP boundary rejects unauthenticated and cross-origin writes before loading or mutating data', async () => {
  let reads = 0; let writes = 0;
  const api = loadModule('src/admin/api/analytics/business/settings/route.ts', {
    Response, BusinessSettingsInputError, BusinessSettingsConflictError: class extends Error {},
    hasValidAdminSession: (request: Request) => request.headers.get('x-test-session') === 'valid',
    requestOriginMatchesHost: (request: Request) => request.headers.get('origin') === 'https://example.test',
    instrumentAdminRouteRender: (_path: string, run: () => unknown) => run(),
    readRequiredJsonRecord: async (request: Request) => ({ ok: true, body: await request.json() }),
    fetchBusinessAnalyticsSettings: async () => { reads += 1; return { quoteGoLiveDate: null, revision: '0', updatedAt: null }; },
    saveBusinessAnalyticsSettings: async () => { writes += 1; return { quoteGoLiveDate: '2026-08-01', revision: '1', updatedAt: null }; }
  });
  const unauthenticated = await api.GET(new Request('https://example.test/api/admin/analytics/business/settings')) as Response;
  assert.equal(unauthenticated.status, 401);
  assert.match(unauthenticated.headers.get('cache-control') ?? '', /no-store/);
  const crossOrigin = await api.PUT(new Request('https://example.test/api/admin/analytics/business/settings', { method: 'PUT', headers: { 'x-test-session': 'valid', origin: 'https://elsewhere.test' } })) as Response;
  assert.equal(crossOrigin.status, 403);
  assert.equal(reads, 0); assert.equal(writes, 0);
  const authorized = await api.GET(new Request('https://example.test/api/admin/analytics/business/settings', { headers: { 'x-test-session': 'valid' } })) as Response;
  assert.equal(authorized.status, 200);
  assert.match(authorized.headers.get('cache-control') ?? '', /no-store/);
  assert.equal(reads, 1); assert.equal(writes, 0);
});
