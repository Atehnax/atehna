import assert from 'node:assert/strict';
import { test } from 'node:test';
import { completeWebsiteTraffic, websitePeriod, websiteCsv, type WebsiteQueryResult } from '@/shared/domain/analytics/websiteTraffic';
import { resolveBusinessPeriod } from '@/shared/domain/analytics/period';
import { createWebsiteEventQueue, productIdFromPath } from '@/commercial/lib/websiteEventQueue';

const now = new Date('2026-04-08T10:00:00Z');
const empty: WebsiteQueryResult = {
  summary: { pageViews: 0, productViews: 0, visits: 0, visitors: 0, returningVisitors: 0, firstObservedVisitors: 0 },
  days: [], pages: [], products: [], cohorts: [],
  coverage: { historyFrom: null, latestEventAt: null, missingVisitorPageViews: 0, missingSessionPageViews: 0, missingProductViews: 0, missingPathPageViews: 0 }
};

test('website periods use the exact shared Ljubljana presets, custom bounds and DST day lengths', () => {
  for (const range of ['30D', '90D', '180D', '1Y', '2Y', 'YTD']) {
    assert.deepEqual(websitePeriod(new URLSearchParams({ range }), now).period, resolveBusinessPeriod({ range }, now));
  }
  const { period } = websitePeriod(new URLSearchParams('range=custom&from=2026-03-29&to=2026-03-29'), now);
  assert.equal(period.start, '2026-03-28T23:00:00.000Z');
  assert.equal(period.endExclusive, '2026-03-29T22:00:00.000Z');
  assert.equal(websitePeriod(new URLSearchParams('from=2026-03-29&to=2026-03-29'), now).period.range, 'custom');
  assert.throws(() => websitePeriod(new URLSearchParams('range=custom&from=2026-02-30&to=2026-03-01'), now));
  assert.throws(() => websitePeriod(new URLSearchParams('range=999D'), now));
  assert.throws(() => websitePeriod(new URLSearchParams('asOf=2099-01-01'), now));
});

test('unobserved history and immature D7 cohorts remain missing rather than fabricated zero retention', () => {
  const period = resolveBusinessPeriod({ range: 'custom', from: '2026-04-01', to: '2026-04-08' }, now);
  const noEvents = completeWebsiteTraffic(empty, period, now);
  assert.equal(noEvents.days.length, 8);
  assert.equal(noEvents.days.every(day => day.pageViews === null), true);
  assert.equal(noEvents.retention.rateD7, null);
  const result = completeWebsiteTraffic({ ...empty,
    coverage: { ...empty.coverage, historyFrom: '2026-04-03T08:00:00Z' },
    days: [{ date: '2026-04-03', pageViews: 3, visits: 1, visitors: 1, returningVisitors: 0 }],
    cohorts: [{ date: '2026-03-31', visitors: 4, eligible: true, returnedD7: 1 }, { date: '2026-04-01', visitors: 9, eligible: false, returnedD7: null }]
  }, period, now);
  assert.equal(result.days[0].available, false);
  assert.equal(result.days[2].pageViews, 3);
  assert.equal(result.days[3].pageViews, 0);
  assert.equal(result.days[7].partial, true);
  assert.deepEqual(result.retention, { eligibleVisitors: 4, returnedD7: 1, immatureVisitors: 9, rateD7: .25 });
  assert.equal(result.cohorts[1].rateD7, null);
});

test('CSV contains the complete breakdown, represents missing cells and neutralizes formula-like paths', () => {
  const period = resolveBusinessPeriod({ range: '30D' }, now);
  const data = completeWebsiteTraffic({ ...empty, pages: Array.from({ length: 25 }, (_, index) => ({ key: index === 0 ? '=HYPERLINK("x")' : '/page/' + index, views: index, visits: 1, visitors: 1 })) }, period, now);
  const csv = websiteCsv(data, 'pages');
  assert.equal(csv.split('\r\n').length, 26);
  assert.match(csv, /'=HYPERLINK\(""x""\)/);
  assert.match(csv, /\/page\/24/);
  assert.match(websiteCsv(data, 'days'), /"";"";"";"";"Pred začetkom zgodovine"/);
});

test('first product navigation establishes cookies before its product event and later navigation', async () => {
  const calls: Array<Record<string, string>> = [];
  let finishFirst: (() => void) | undefined;
  const firstResponse = new Promise<void>(resolve => { finishFirst = resolve; });
  const enqueue = createWebsiteEventQueue(async (_url, init) => {
    calls.push(JSON.parse(String(init.body)));
    if (calls.length === 1) await firstResponse;
    return { ok: true, json: async () => ({ ok: true }) };
  });
  const product = enqueue('/products/materiali/items/aluminijasta-plosca');
  const next = enqueue('/resources');
  await Promise.resolve();
  assert.equal(calls.length, 1);
  finishFirst!();
  await Promise.all([product, next]);
  assert.deepEqual(calls.map(call => [call.eventType, call.path]), [
    ['page_view', '/products/materiali/items/aluminijasta-plosca'],
    ['product_view', '/products/materiali/items/aluminijasta-plosca'],
    ['page_view', '/resources']
  ]);
  assert.equal(calls[1].productId, 'aluminijasta-plosca');
});

test('a failed page event skips its orphan product event and does not block later collection', async () => {
  const calls: string[] = [];
  const enqueue = createWebsiteEventQueue(async (_url, init) => {
    const event = JSON.parse(String(init.body)); calls.push(event.eventType);
    return { ok: true, json: async () => ({ ok: calls.length !== 1 }) };
  });
  await enqueue('/products/materiali/items/item');
  await enqueue('/');
  await enqueue('/admin/analitika');
  await enqueue('/api/analytics/event');
  assert.deepEqual(calls, ['page_view', 'page_view']);
  assert.equal(productIdFromPath('/products/materiali'), null);
  assert.equal(productIdFromPath('/products/materiali/items/a/extra'), null);
});


test('website API enforces real admin authentication, validates periods and exposes read failure as 503', async () => {
  const { handleWebsiteTrafficRequest } = await import('@/shared/server/websiteTrafficRequest');
  const { createAdminSessionToken, getAdminAuthConfig, ADMIN_SESSION_COOKIE } = await import('@/shared/auth/adminSession');
  let reads = 0;
  const load = async (params: URLSearchParams) => {
    reads++;
    const { period, asOf } = websitePeriod(params);
    return completeWebsiteTraffic(empty, period, asOf);
  };
  const forbidden = await handleWebsiteTrafficRequest(new Request('http://localhost/api/admin/analytics/website'), load);
  assert.equal(forbidden.status, 401); assert.equal(reads, 0);
  const cookie = ADMIN_SESSION_COOKIE + '=' + createAdminSessionToken(getAdminAuthConfig()!).token;
  const authorized = (query: string) => new Request('http://localhost/api/admin/analytics/website?' + query, { headers: { cookie } });
  const invalid = await handleWebsiteTrafficRequest(authorized('range=custom&from=2026-02-30&to=2026-03-01'), load);
  assert.equal(invalid.status, 400); assert.equal(reads, 0);
  const invalidExport = await handleWebsiteTrafficRequest(authorized('export=raw-visitors'), load);
  assert.equal(invalidExport.status, 400); assert.equal(reads, 0);
  const success = await handleWebsiteTrafficRequest(authorized('range=30D&asOf=2026-04-08T10%3A00%3A00Z'), load);
  assert.equal(success.status, 200); assert.equal(reads, 1);
  assert.equal(success.headers.get('cache-control'), 'private, no-store');
  assert.equal((await success.json()).asOf, '2026-04-08T10:00:00.000Z');
  const csv = await handleWebsiteTrafficRequest(authorized('range=30D&export=days'), load);
  assert.match(csv.headers.get('content-type')!, /text\/csv/);
  const previous = console.error;
  console.error = () => undefined;
  try {
    const failed = await handleWebsiteTrafficRequest(authorized('range=30D'), async () => { throw new Error('fixture read failure'); });
    assert.equal(failed.status, 503);
    const payload = await failed.json();
    assert.equal('summary' in payload, false);
    assert.match(payload.message, /ni na voljo/);
  } finally { console.error = previous; }
});
