import assert from 'node:assert/strict';
import test from 'node:test';
import { createDiagnosticsInstrumentation, normalizedDiagnosticContext } from '../../src/shared/server/diagnostics/instrumentationCore';
import { resolveDiagnosticFilters, diagnosticsCsv, type DiagnosticEvent, type DiagnosticsResponse } from '../../src/shared/domain/analytics/diagnostics';

test('concurrent requests keep independent traces and measure nested phases once per request', async () => {
  const batches: DiagnosticEvent[][] = [];
  const metrics = createDiagnosticsInstrumentation(async events => { batches.push(events); });
  await Promise.all(['/admin/orders/12', '/admin/orders/13'].map(context => metrics.instrumentAdminRouteRender(context, async () => {
    await metrics.profileRoutePhase('db', 'read', async () => metrics.instrumentCatalogLoader('orders', context, async () => ({ total: 4 })));
    metrics.profilePayloadEstimate('summary', { total: 4 });
    return Response.json({ ok: true });
  })));
  assert.equal(batches.length, 2);
  assert.notEqual(batches[0][0].traceId, batches[1][0].traceId);
  for (const batch of batches) {
    assert.equal(new Set(batch.map(event => event.traceId)).size, 1);
    assert.deepEqual(batch.map(event => event.kind), ['loader', 'route']);
    assert.ok(batch[1].phases.db >= 0);
    assert.ok(batch[1].payloadBytes! > 0);
    assert.equal(batch[1].context, '/admin/orders/[id]');
  }
});
test('handled API failures and thrown failures are recorded without storing sensitive error messages', async () => {
  const events: DiagnosticEvent[] = [];
  const metrics = createDiagnosticsInstrumentation(async batch => { events.push(...batch); });
  const response = await metrics.instrumentAdminRouteRender('/api/admin/example?token=secret', async () => Response.json({}, { status: 503 }));
  assert.equal(response.status, 503); assert.equal(events[0].errorCode, 'HTTP_503');
  await assert.rejects(metrics.instrumentCatalogLoader('query', '/admin/orders', async () => { throw Object.assign(new Error('private customer details'), { code: 'ECONNREFUSED' }); }));
  assert.equal(events[1].errorCode, 'ECONNREFUSED');
  assert.equal(JSON.stringify(events).includes('secret'), false); assert.equal(JSON.stringify(events).includes('private customer'), false);
});
test('collector failure preserves business success and the original business exception', async () => {
  const metrics = createDiagnosticsInstrumentation(async () => { throw new Error('unavailable store'); });
  assert.equal(await metrics.instrumentAdminRouteRender('/admin', async () => 42), 42);
  const expected = new Error('business failure');
  await assert.rejects(metrics.instrumentAdminRouteRender('/admin', async () => { throw expected; }), error => error === expected);
});
test('cache execution and invalidation remain explicit events; missing payloads are not invented', async () => {
  const events: DiagnosticEvent[] = [];
  const metrics = createDiagnosticsInstrumentation(async batch => { events.push(...batch); });
  await metrics.instrumentAdminRouteRender('/admin', async () => {
    await metrics.instrumentCatalogCacheMiss('cached-query', '/admin', async () => undefined);
    metrics.recordCatalogInvalidation({ context: '/admin', tags: ['catalog', 'catalog'], revalidatedPaths: 2 });
    return new Response();
  });
  assert.deepEqual(events.map(event => event.kind), ['cache_miss', 'invalidation', 'route']);
  assert.equal(events[0].payloadBytes, null); assert.equal(events[2].payloadBytes, null);
  assert.deepEqual(events[1].details.tags, ['catalog']);
});
test('bounded request traces disclose omitted child spans while retaining the enclosing request', async () => {
  const events: DiagnosticEvent[] = [];
  const metrics = createDiagnosticsInstrumentation(async batch => { events.push(...batch); });
  await metrics.instrumentAdminRouteRender('/admin', async () => { for (let index = 0; index < 510; index++) await metrics.instrumentCatalogLoader('operation', '/admin', async () => index); });
  assert.equal(events.length, 500); assert.equal(events.at(-1)?.kind, 'route'); assert.equal(events.at(-1)?.details.droppedSpans, 11);
});
test('diagnostic filters reject invalid windows, future snapshots and trace IDs', () => {
  const now = new Date('2026-09-05T12:00:00Z');
  assert.equal(resolveDiagnosticFilters(new URLSearchParams('window=24h'), now).start, '2026-09-04T12:00:00.000Z');
  for (const query of ['window=toString', 'window=30d', 'kind=wrong', 'asOf=2027-01-01', 'traceId=1', 'traceId=']) assert.throws(() => resolveDiagnosticFilters(new URLSearchParams(query), now));
  assert.equal(normalizedDiagnosticContext('/admin/orders/123?email=private'), '/admin/orders/[id]');
});
test('CSV preserves numeric measurements and neutralizes spreadsheet formula names', () => {
  const csv = diagnosticsCsv({ groups: [{ context: '=malicious()', operation: 'read', kind: 'loader', count: 1, errors: 0, meanMs: 0, p95Ms: 0, maxMs: 0, payloadBytes: 0, payloadMeasured: 1, lastSeen: '2026-09-05' }] } as DiagnosticsResponse);
  assert.ok(csv.includes("\"'=malicious()\"")); assert.ok(csv.includes('"0"'));
});
test('standalone invalidation waits for the host lifecycle scheduler', async () => {
  const events: DiagnosticEvent[] = [], tasks: Array<() => Promise<void>> = [];
  const metrics = createDiagnosticsInstrumentation(async batch => { events.push(...batch); }, task => { tasks.push(task); });
  metrics.recordCatalogInvalidation({ context: '/admin/orders', tags: ['orders'] });
  assert.equal(events.length, 0); assert.equal(tasks.length, 1);
  await tasks[0]();
  assert.equal(events[0].kind, 'invalidation');
  assert.deepEqual(events[0].details.tags, ['orders']);
});