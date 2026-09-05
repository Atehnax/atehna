import { expect, test } from '@playwright/test';
import type { BusinessAnalyticsResponse } from '@/shared/domain/analytics/businessAnalytics';
import { assertAuthenticatedAdmin } from './support/auth';

test.beforeEach(async ({ request }) => { await assertAuthenticatedAdmin(request); });

test('canonical filters reconcile activity, geography, matching records and CSV', async ({ request }) => {
  test.setTimeout(120_000);
  for (const filters of [
    'range=30D', 'range=90D', 'range=180D', 'range=1Y', 'range=2Y', 'range=YTD',
    'range=90D&customerType=school', 'range=90D&customerType=company',
    'range=90D&customerType=individual', 'range=90D&customerType=unknown',
    'range=90D&source=direct', 'range=90D&source=quote', 'range=90D&status=cancelled'
  ]) {
    const response = await request.get('/api/admin/analytics/business?' + filters);
    expect(response.status()).toBe(200);
    const business = await response.json() as BusinessAnalyticsResponse;
    const frozen = filters + '&asOf=' + encodeURIComponent(business.asOf);
    expect(business.days.reduce((sum, day) => sum + day.orderCount, 0)).toBe(business.summary.orderCount);
    if (business.coverage.valueOrders === business.summary.orderCount && business.summary.orderCount > 0) {
      expect(business.days.reduce((sum, day) => sum + Math.round(day.activityValue * 100), 0)).toBe(Math.round(business.summary.activityValue! * 100));
    }
    const geoResponse = await request.get('/api/admin/analytics/geography?' + frozen);
    expect(geoResponse.status()).toBe(200);
    const geography = await geoResponse.json();
    const reconciliation = geography.reconciliation;
    expect(reconciliation.allEligibleOrders).toBe(business.summary.orderCount);
    expect(reconciliation.mappedSlovenianOrders + reconciliation.unresolvedSlovenianOrders + reconciliation.foreignOrders + reconciliation.unknownCountryOrders).toBe(business.summary.orderCount);
    expect(geography.areas.filter((area: { level: string }) => area.level === 'municipality').reduce((sum: number, area: { orderCount: number }) => sum + area.orderCount, 0)).toBe(reconciliation.mappedSlovenianOrders);
    const municipalityResolvedInRegions = geography.areas.filter((area: { level: string }) => area.level === 'region').reduce((sum: number, area: { municipalityResolvedOrders: number }) => sum + area.municipalityResolvedOrders, 0);
    expect(municipalityResolvedInRegions).toBe(reconciliation.mappedSlovenianOrders);
    const records = await request.get('/api/admin/analytics/business/records?' + frozen + '&kind=orders');
    expect(records.status()).toBe(200);
    expect((await records.json()).total).toBe(business.summary.orderCount);
    const csv = await request.get('/api/admin/analytics/business/records?' + frozen + '&kind=orders&format=csv');
    expect(csv.status()).toBe(200); expect(csv.headers()['content-type']).toContain('text/csv');
    expect((await csv.text()).split(/\r?\n/u)).toHaveLength(business.summary.orderCount + 1);
  }
});

test('real map retains shared filters and supports keyboard, touch-sized navigation and local selection', async ({ page, request }) => {
  test.setTimeout(90_000);
  const reference = await (await request.get('/api/admin/analytics/geography/boundaries')).json();
  await page.goto('/admin/analitika?view=zemljevid&range=90D&customerType=school');
  await expect(page.getByText('Definicije, pokritost in zgodovina podatkov', { exact: true })).toBeVisible();
  const polygons = page.locator('svg path[role="button"]');
  await expect(polygons).toHaveCount(reference.metadata.counts.municipalities);
  await polygons.first().focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Počisti izbor', exact: true })).toBeVisible();
  const localSelectionURL = page.url(); expect(localSelectionURL).not.toContain('area=');
  await page.getByLabel('Geografska raven', { exact: true }).selectOption('region');
  await expect(polygons).toHaveCount(reference.metadata.counts.regions);
  expect(page.url()).toContain('customerType=school');
  await page.getByLabel('Mera zemljevida', { exact: true }).selectOption('value');
  await page.getByRole('button', { name: 'Povečaj zemljevid' }).click();
  await page.getByRole('button', { name: 'Cela Slovenija', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByLabel('Poišči območje', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('calendar drilldown, long periods, errors and the existing non-business tabs remain usable', async ({ page, request }) => {
  test.setTimeout(120_000);
  await page.goto('/admin/analitika?range=2Y');
  await expect(page.getByText('Definicije, pokritost in zgodovina podatkov', { exact: true })).toBeVisible();
  const calendar = page.getByRole('region', { name: 'Koledar aktivnosti, vodoravno pomikanje za daljša obdobja' });
  expect(await calendar.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
  await page.getByRole('button', { name: '90D', exact: true }).click();
  await expect(page).toHaveURL(/range=90D/u);
  const business = await (await request.get('/api/admin/analytics/business?range=90D')).json() as BusinessAnalyticsResponse;
  const day = business.days.find(item => item.orderCount > 0);
  if (day) {
    const label = new Intl.DateTimeFormat('sl-SI', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(day.date + 'T12:00:00Z'));
    await page.locator('button[aria-label]').filter({ hasText: '' }).and(page.locator('[aria-label^="' + label + ':"]')).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog')).toContainText(day.orderCount + ' zapisov');
    await page.getByRole('button', { name: 'Zapri', exact: true }).click();
  }
  await page.getByRole('tab', { name: 'Splet', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/analitika\/splet/u, { timeout: 60000 });
  await expect(page.getByRole('tab', { name: 'Splet', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Diagnostika', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/analitika\/diagnostika/u, { timeout: 60000 });
  await expect(page.getByRole('tab', { name: 'Diagnostika', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.route('**/api/admin/analytics/business?*', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Preizkus nedosegljivosti.' }) }));
  await page.goto('/admin/analitika?range=30D');
  await expect(page.getByRole('alert').filter({ hasText: 'Preizkus nedosegljivosti.' })).toContainText('Preizkus nedosegljivosti.');
  await expect(page.getByRole('button', { name: 'Poskusi znova', exact: true })).toBeVisible();
});

test('new aggregates, exports, corrections and capture require admin authentication', async ({ playwright, baseURL }) => {
  const anonymous = await playwright.request.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  try {
    for (const route of ['/api/admin/analytics/business', '/api/admin/analytics/business/records?format=csv', '/api/admin/analytics/geography', '/api/admin/analytics/geography/audit', '/api/admin/analytics/orders/1/measurements']) {
      expect((await anonymous.get(route)).status()).toBe(401);
    }
    expect((await anonymous.patch('/api/admin/analytics/geography', { data: {} })).status()).toBe(401);
    expect((await anonymous.post('/api/admin/analytics/orders/1/measurements', { data: {} })).status()).toBe(401);
  } finally { await anonymous.dispose(); }
});

test('histogram retains its long tail without plotting variance as currency, and laboratory controls render', async ({ page, request }) => {
  test.setTimeout(120_000);
  const business = await (await request.get('/api/admin/analytics/business?range=90D&view=narocila')).json() as BusinessAnalyticsResponse;
  await page.goto('/admin/analitika?view=narocila&range=90D');
  const histogram = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Porazdelitev vrednosti oddanih naročil', exact: true }) });
  await expect(histogram).toBeVisible();
  if (business.orders.statistics.n > 0) {
    const plot = histogram.locator('.js-plotly-plot');
    await expect(plot).toBeVisible();
    await expect(plot.locator('.annotation-text')).toHaveText(['Povp.', 'Med.', 'Q1', 'Q3']);
    const range = await plot.evaluate(element => (element as HTMLElement & { _fullLayout: { xaxis: { range: number[] } } })._fullLayout.xaxis.range);
    const maximum = business.orders.statistics.max!;
    expect(range[1]).toBeGreaterThanOrEqual(maximum);
    expect(range[1]).toBeLessThan(Math.max(maximum * 2, 10));
  }
  await page.getByRole('tab', { name: 'Laboratorij', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Obremenitev pri pripravi naročil', exact: true })).toBeVisible({ timeout: 60000 });
  await page.getByLabel(/^Porazdelitev/u).selectOption('lognormal');
  await expect(page.getByRole('heading', { name: 'Normalni Q–Q na logaritemskih vrednostih', exact: true })).toBeVisible();
  await page.getByLabel('Prikaži ostanke OLS', { exact: true }).check();
  await expect(page.getByRole('heading', { name: 'Ostanki regresije', exact: true })).toBeVisible();
  await page.getByLabel('Spremenljivka porazdelitve', { exact: true }).selectOption('weight');
  await page.getByLabel('Vsaj k sprejemov', { exact: true }).fill('0');
  await page.getByLabel('Poskusov n', { exact: true }).fill('0');
  await expect(page.getByText('E[X] = np =', { exact: false })).toContainText('0');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
