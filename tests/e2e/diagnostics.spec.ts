import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import type { DiagnosticsResponse } from '@/shared/domain/analytics/diagnostics';
import { assertAuthenticatedAdmin } from './support/auth';

const API = '/api/admin/analytics/diagnostics';
const BUSINESS = '/api/admin/analytics/business';
const businessFilters = () => new URLSearchParams({ window: '5m', context: BUSINESS, kind: 'route' });
const invalidBusinessRange = BUSINESS + '?range=custom&from=invalid&to=invalid';

async function readDiagnostics(request: APIRequestContext, params = businessFilters()) {
  const response = await request.get(API + '?' + params);
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toContain('no-store');
  return await response.json() as DiagnosticsResponse;
}

async function changeAndRead(page: Page, change: () => Promise<unknown>, matches: (query: URLSearchParams) => boolean) {
  const received = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname === API && !url.searchParams.has('traceId') && matches(url.searchParams);
  }, { timeout: 15_000 });
  await change();
  const response = await received;
  expect(response.status()).toBe(200);
  return await response.json() as DiagnosticsResponse;
}

test.beforeEach(async ({ request }) => { await assertAuthenticatedAdmin(request); });

test('real business requests persist diagnostics that reconcile with database, trace, buckets and CSV', async ({ request }) => {
  test.setTimeout(90_000);
  const before = await readDiagnostics(request);
  const previousIds = new Set(before.recent.map(event => event.id));
  const privateProbe = 'diagnostics-e2e-' + randomUUID();
  const success = await request.get(BUSINESS + '?range=30D&view=pregled&probe=' + privateProbe);
  expect(success.status()).toBe(200);
  expect((await success.json()).timezone).toBe('Europe/Ljubljana');
  expect((await request.get(invalidBusinessRange)).status()).toBe(400);

  let data: DiagnosticsResponse = before;
  await expect.poll(async () => {
    data = await readDiagnostics(request);
    const fresh = data.recent.filter(event => !previousIds.has(event.id));
    return fresh.some(event => !event.error) && fresh.some(event => event.errorCode === 'HTTP_400');
  }, { timeout: 15_000 }).toBe(true);
  const fresh = data.recent.filter(event => !previousIds.has(event.id));
  const successEvent = fresh.find(event => !event.error)!;
  const errorEvent = fresh.find(event => event.errorCode === 'HTTP_400')!;
  expect(successEvent.traceId).not.toBe(errorEvent.traceId);
  expect(successEvent.payloadBytes).toBeGreaterThan(0);
  expect(successEvent.phases.db).toBeGreaterThanOrEqual(0);
  expect(successEvent.phases.transform).toBeGreaterThanOrEqual(0);
  expect(data.summary.observations).toBeGreaterThanOrEqual(2);
  expect(data.summary.errors).toBeGreaterThanOrEqual(1);
  expect(data.summary.routes).toBe(data.summary.observations);
  expect(data.summary.errorRate).toBeCloseTo(data.summary.errors / data.summary.observations, 12);
  expect(data.summary.meanMs).not.toBeNull();
  expect(data.summary.p95Ms).not.toBeNull();
  expect(data.groups.reduce((sum, group) => sum + group.count, 0)).toBe(data.summary.observations);
  expect(data.series.reduce((sum, point) => sum + (point.observations ?? 0), 0)).toBe(data.summary.observations);
  expect(data.series.reduce((sum, point) => sum + (point.errors ?? 0), 0)).toBe(data.summary.errors);
  expect(data.coverage.firstRecordedAt).not.toBeNull();
  expect(data.coverage.totalStored).toBeGreaterThanOrEqual(data.summary.observations);
  expect(data.coverage.retentionDays).toBe(7);
  expect(data.recent.length).toBeLessThanOrEqual(50);
  for (const event of [successEvent, errorEvent]) {
    expect(event.context).toBe(BUSINESS);
    expect(event.operation).toBe('request');
    expect(event.durationMs).toBeGreaterThanOrEqual(0);
    expect(event.details).toHaveProperty('droppedSpans');
  }
  expect(JSON.stringify(data.recent)).not.toContain(privateProbe);

  const databaseUrl = process.env.E2E_DATABASE_URL || process.env.DATABASE_URL;
  expect(databaseUrl, 'A configured integration database is required for persisted trace verification.').toBeTruthy();
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query('begin read only');
    const stored = await client.query(
      'select id, trace_id, context, kind, error, error_code from diagnostics_events where id = any($1::uuid[])',
      [[successEvent.id, errorEvent.id]]
    );
    expect(stored.rows).toHaveLength(2);
    for (const event of [successEvent, errorEvent]) {
      expect(stored.rows.find(row => row.id === event.id)).toEqual({
        id: event.id, trace_id: event.traceId, context: BUSINESS, kind: 'route', error: event.error, error_code: event.errorCode
      });
    }
  } finally {
    await client.query('rollback');
    await client.end();
  }

  const frozen = businessFilters();
  frozen.set('asOf', data.asOf);
  const traceParams = new URLSearchParams({ window: '5m', asOf: data.asOf, traceId: errorEvent.traceId });
  const trace = await readDiagnostics(request, traceParams);
  expect(trace.recent.length).toBeGreaterThanOrEqual(1);
  expect(trace.recent.every(event => event.traceId === errorEvent.traceId)).toBe(true);
  expect(trace.recent.find(event => event.id === errorEvent.id)?.errorCode).toBe('HTTP_400');

  frozen.set('format', 'csv');
  const csvResponse = await request.get(API + '?' + frozen);
  expect(csvResponse.status()).toBe(200);
  expect(csvResponse.headers()['content-type']).toContain('text/csv');
  expect(csvResponse.headers()['content-disposition']).toContain('atehna-diagnostika.csv');
  const csvRows = (await csvResponse.text()).replace(/^\ufeff/u, '').split(/\r?\n/u);
  expect(csvRows).toHaveLength(data.groups.length + 1);
  expect(csvRows[0]).toContain('"Kontekst";"Operacija";"Vrsta";"Meritve";"Napake"');
  const columns = csvRows[1].split(';').map(value => value.slice(1, -1));
  expect(columns.slice(0, 3)).toEqual([BUSINESS, 'request', 'route']);
  expect(Number(columns[3])).toBe(data.summary.observations);
  expect(Number(columns[4])).toBe(data.summary.errors);

  const errorsOnly = businessFilters();
  errorsOnly.set('asOf', data.asOf);
  errorsOnly.set('errors', 'true');
  const errors = await readDiagnostics(request, errorsOnly);
  expect(errors.summary.observations).toBe(data.summary.errors);
  expect(errors.recent.every(event => event.error)).toBe(true);
  for (const query of ['window=unsupported', 'kind=unsupported', 'traceId=invalid', 'traceId=']) {
    expect((await request.get(API + '?' + query)).status()).toBe(400);
  }
});

test('diagnostics windows, context, errors, trace and mobile layout use the same live population', async ({ page, request }, testInfo) => {
  test.setTimeout(120_000);
  expect((await request.get(invalidBusinessRange)).status()).toBe(400);
  await page.goto('/admin/analitika/diagnostika?window=5m');
  await expect(page.getByRole('tab', { name: 'Diagnostika', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'Zadnje meritve in sled zahtev', exact: true })).toBeVisible();
  await expect(page.getByText(/Zbiranje uporablja trajne zapise v bazi/u)).toBeVisible();
  await expect(page.getByRole('button', { name: '5 min', exact: true })).toHaveAttribute('aria-pressed', 'true');
  for (const [window, label, minutes] of [
    ['15m', '15 min', 15], ['60m', '1 ura', 60], ['6h', '6 ur', 360],
    ['24h', '24 ur', 1440], ['7d', '7 dni', 10080], ['5m', '5 min', 5]
  ] as const) {
    const result = await changeAndRead(page, () => page.getByRole('button', { name: label, exact: true }).click(), query => query.get('window') === window);
    expect(result.filters.minutes).toBe(minutes);
    expect(Date.parse(result.asOf) - Date.parse(result.filters.start)).toBe(minutes * 60000);
    await expect(page.getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-pressed', 'true');
  }
  await changeAndRead(page, () => page.getByRole('combobox', { name: 'Vrsta meritve', exact: true }).selectOption('route'), query => query.get('kind') === 'route');
  await page.getByRole('combobox', { name: 'Kontekst', exact: true }).fill(BUSINESS);
  await changeAndRead(page, () => page.getByRole('button', { name: 'Uporabi kontekst', exact: true }).click(), query => query.get('context') === BUSINESS);
  const errors = await changeAndRead(page, () => page.getByRole('checkbox', { name: 'Samo napake', exact: true }).click(), query => query.get('errors') === 'true');
  await expect(page.getByRole('checkbox', { name: 'Samo napake', exact: true })).toBeChecked();
  expect(errors.summary.observations).toBeGreaterThanOrEqual(1);
  expect(errors.recent.every(event => event.context === BUSINESS && event.error)).toBe(true);
  const recent = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Zadnje meritve in sled zahtev', exact: true }) });
  await expect(recent.getByRole('row').filter({ hasText: 'HTTP_400' }).first()).toBeVisible();
  const traceResponse = page.waitForResponse(response => new URL(response.url()).pathname === API && new URL(response.url()).searchParams.has('traceId'));
  await recent.getByRole('button', { name: 'Odpri sled', exact: true }).first().click();
  const trace = await (await traceResponse).json() as DiagnosticsResponse;
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Sled merjene zahteve' })).toBeVisible();
  await expect(dialog).toContainText(trace.filters.traceId!);
  await expect(dialog).toContainText('HTTP_400');
  await expect(dialog).toContainText('Faze (ms):');
  await dialog.getByRole('button', { name: 'Zapri', exact: true }).click();
  await expect(dialog).not.toBeVisible();

  const exportHref = await page.getByRole('link', { name: 'Izvoz CSV', exact: true }).getAttribute('href');
  const exportQuery = new URL(exportHref!, 'https://example.test').searchParams;
  expect(exportQuery.get('asOf')).toBe(errors.asOf);
  expect(exportQuery.get('context')).toBe(BUSINESS);
  expect(exportQuery.get('kind')).toBe('route');
  expect(exportQuery.get('errors')).toBe('true');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('combobox', { name: 'Kontekst', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('diagnostics-mobile.png'), fullPage: true });
});

test('diagnostics unavailable state clears stale metrics and retries without a fabricated chart', async ({ page }) => {
  await page.goto('/admin/analitika/diagnostika?window=5m');
  await expect(page.getByText('Izbrane meritve', { exact: true })).toBeVisible();
  let unavailable = true;
  await page.route('**/api/admin/analytics/diagnostics?*', async route => {
    if (unavailable) await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Preizkus nedosegljive diagnostike.' }) });
    else await route.continue();
  });
  await page.getByRole('button', { name: 'Osveži meritve', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Preizkus nedosegljive diagnostike.' })).toContainText('Preizkus nedosegljive diagnostike.');
  await expect(page.getByText('Izbrane meritve', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Meritve in napake skozi čas', exact: true })).toHaveCount(0);
  unavailable = false;
  await page.getByRole('button', { name: 'Poskusi znova', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Preizkus nedosegljive diagnostike.' })).toHaveCount(0);
  await expect(page.getByText('Izbrane meritve', { exact: true })).toBeVisible();
});

test('retired analytics routes return authenticated 404s and new diagnostics remain private', async ({ request, playwright, baseURL }) => {
  for (const path of [
    '/api/admin/analytics/orders', '/api/admin/analytics/quotes',
    '/api/admin/analytics/charts', '/api/admin/analytics/charts/appearance',
    '/api/admin/analytics/charts/reorder', '/api/admin/analytics/charts/123',
    '/admin/analitika/ponudbe', '/admin/analitika/ponudbe?range=max&focus=ponudbe-requests'
  ]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(404);
    expect(response.headers().location, path + ' must not keep a compatibility redirect').toBeUndefined();
  }
  const anonymous = await playwright.request.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  try {
    for (const path of [API, API + '?format=csv', API + '?traceId=' + randomUUID()]) {
      expect((await anonymous.get(path)).status()).toBe(401);
    }
  } finally { await anonymous.dispose(); }
});
