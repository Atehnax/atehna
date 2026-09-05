import { expect, test } from '@playwright/test';
import { Pool } from 'pg';
import { readE2eEnvironment } from '../../scripts/e2e-database.mjs';
import { WEBSITE_TRAFFIC_SQL } from '../../src/shared/server/websiteTrafficQuery';
import { completeWebsiteTraffic, websitePeriod, type WebsiteQueryResult, type WebsiteTraffic } from '../../src/shared/domain/analytics/websiteTraffic';
import { assertAuthenticatedAdmin } from './support/auth';

let database: Pool;
test.beforeAll(() => {
  const { databaseUrl } = readE2eEnvironment();
  database = new Pool({ connectionString: databaseUrl, ssl: false });
});
test.afterAll(async () => { await database?.end(); });

test('canonical website query deduplicates sessions and visitors and uses fully observed calendar-day cohorts', async () => {
  const events = [
    ['page_view', '/old', null, 'old-a', 'a', '2026-03-20T10:00:00Z'],
    ['page_view', '/product', null, 's-b', 'b', '2026-03-27T23:30:00Z'],
    ['page_view', '/product', null, 's-b', 'b', '2026-03-28T10:00:00Z'],
    ['product_view', '/product', 'product-b', 's-b', 'b', '2026-03-28T10:00:01Z'],
    ['page_view', '/return', null, 's-a', 'a', '2026-03-29T00:30:00Z'],
    ['page_view', '/new', null, 's-c', 'c', '2026-03-30T22:30:00Z'],
    ['page_view', '/new', null, 's-d', 'd', '2026-03-31T22:30:00Z'],
    ['page_view', '', null, '', '', '2026-03-30T10:00:00Z'],
    ['product_view', '/orphan', null, 'product-only', 'product-only', '2026-03-30T11:00:00Z'],
    ['page_view', '/return', null, 'later-c', 'c', '2026-04-06T22:30:00Z'],
    ['page_view', '/return', null, 'later-d', 'd', '2026-04-07T22:30:00Z']
  ];
  const now = new Date('2026-04-08T10:00:00Z');
  const { period } = websitePeriod(new URLSearchParams('range=custom&from=2026-03-28&to=2026-04-01'), now);
  // Inline fixture shadows the relation inside a read-only statement. It does not
  // insert, update, delete or truncate the application's tracking history.
  const fixture = `website_events as (select event_type, path, product_id, session_id, visitor_id, created_at::timestamptz from jsonb_to_recordset($5::jsonb) as e(event_type text, path text, product_id text, session_id text, visitor_id text, created_at text)), `;
  const rows = events.map(([event_type, path, product_id, session_id, visitor_id, created_at]) => ({ event_type, path, product_id, session_id, visitor_id, created_at }));
  const result = await database.query<{ result: WebsiteQueryResult }>(WEBSITE_TRAFFIC_SQL.replace('with scoped', 'with ' + fixture + 'scoped'), [period.start, period.endExclusive, now.toISOString(), '2026-04-08', JSON.stringify(rows)]);
  const data = completeWebsiteTraffic(result.rows[0].result, period, now);
  expect(data.summary).toEqual({ pageViews: 6, productViews: 2, visits: 4, visitors: 4, returningVisitors: 1, firstObservedVisitors: 3 });
  expect(data.retention).toEqual({ eligibleVisitors: 2, returnedD7: 1, immatureVisitors: 1, rateD7: .5 });
  expect(data.pages.reduce((sum, row) => sum + row.views, 0)).toBe(6);
  expect(data.products.reduce((sum, row) => sum + row.views, 0)).toBe(2);
  expect(data.days.find(day => day.date === '2026-03-28')?.visitors).toBe(1);
  expect(data.days.find(day => day.date === '2026-03-28')?.returningVisitors).toBe(0);
  expect(data.days.find(day => day.date === '2026-03-29')?.returningVisitors).toBe(1);
  expect(data.coverage.missingVisitorPageViews).toBe(1);
  expect(data.cohorts.find(row => row.date === '2026-04-01')?.rateD7).toBeNull();
});

test('fresh product visit reaches storage with shared IDs and appears in the protected report and CSV', async ({ browser, request, baseURL }) => {
  test.setTimeout(90_000);
  await assertAuthenticatedAdmin(request);
  const beforeResponse = await request.get('/api/admin/analytics/website?range=30D');
  expect(beforeResponse.status()).toBe(200);
  const before = await beforeResponse.json() as WebsiteTraffic;
  const catalog = await (await request.get('/api/admin/categories')).json() as { categories: Array<{ slug: string; items: Array<{ slug: string }>; subcategories: Array<{ items: Array<{ slug: string }> }> }> };
  const category = catalog.categories.find(row => row.items.length || row.subcategories.some(sub => sub.items.length));
  expect(category).toBeDefined();
  const product = category!.items[0] ?? category!.subcategories.flatMap(sub => sub.items)[0];
  const path = `/products/${category!.slug}/items/${product.slug}`;
  const anonymous = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  try {
    expect((await anonymous.request.get('/api/admin/analytics/website')).status()).toBe(401);
    const page = await anonymous.newPage();
    const productRecorded = page.waitForResponse(response => response.url().endsWith('/api/analytics/event') && response.request().postDataJSON()?.eventType === 'product_view');
    await page.goto(path);
    expect((await productRecorded).status()).toBe(200);
    const cookies = await anonymous.cookies();
    const visitor = cookies.find(cookie => cookie.name === 'ath_vid')?.value;
    const session = cookies.find(cookie => cookie.name === 'ath_sid')?.value;
    expect(visitor).toBeTruthy(); expect(session).toBeTruthy();
    const stored = await database.query('select event_type, visitor_id, session_id from website_events where visitor_id = $1 and path = $2 order by id', [visitor, path]);
    expect(stored.rows.map(row => row.event_type)).toEqual(['page_view', 'product_view']);
    expect(stored.rows.every(row => row.session_id === session)).toBe(true);
    const afterResponse = await request.get('/api/admin/analytics/website?range=30D');
    const after = await afterResponse.json() as WebsiteTraffic;
    expect(after.summary.pageViews).toBe(before.summary.pageViews + 1);
    expect(after.summary.productViews).toBe(before.summary.productViews + 1);
    expect(after.summary.visits).toBe(before.summary.visits + 1);
    expect(after.summary.visitors).toBe(before.summary.visitors + 1);
    expect(after.pages.find(row => row.key === path)?.views).toBe((before.pages.find(row => row.key === path)?.views ?? 0) + 1);
    const csv = await request.get('/api/admin/analytics/website?range=30D&export=pages&asOf=' + encodeURIComponent(after.asOf));
    expect(csv.status()).toBe(200); expect(csv.headers()['content-type']).toContain('text/csv'); expect(await csv.text()).toContain(path);
  } finally { await anonymous.close(); }
});

test('Splet supports URL periods, keyboard tables, full CSV and explicit failures at desktop and mobile widths', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/admin/analitika/splet?range=30D');
  await expect(page.getByRole('heading', { name: 'Dnevni obisk' })).toBeVisible({ timeout: 30_000 });
  await page.locator('.js-plotly-plot').first().waitFor({ state: 'visible' });
  await page.screenshot({ path: testInfo.outputPath('website-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: 'Tabela', exact: true }).first().click();
  await expect(page.getByRole('columnheader', { name: 'Ogledi strani', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '1Y', exact: true }).click();
  await expect(page).toHaveURL(/range=1Y/);
  await expect(page.getByRole('heading', { name: 'Ogledi po straneh' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.locator('.js-plotly-plot').first().evaluate(element => { const svg = element.querySelector('.main-svg'); const article = element.closest('article'); return Boolean(svg && article && svg.getBoundingClientRect().width <= article.getBoundingClientRect().width); })).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('website-mobile.png'), fullPage: true });
  await page.route('**/api/admin/analytics/website?**', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Preverjena napaka branja.' }) }));
  await page.getByRole('button', { name: 'Osveži', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Preverjena napaka branja.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Obiski (seje)', exact: true })).toHaveCount(0);
});
