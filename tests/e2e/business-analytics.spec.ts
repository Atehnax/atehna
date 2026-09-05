import { randomUUID } from 'node:crypto';
import { expect, test as base } from '@playwright/test';
import { Client } from 'pg';
import { readE2eEnvironment, verifyE2eResetTarget } from '../../scripts/e2e-database.mjs';
import { localDate } from '@/shared/domain/analytics/period';
import type { BusinessAnalyticsResponse } from '@/shared/domain/analytics/businessAnalytics';
import type { BusinessActivityResponse } from '@/shared/domain/analytics/activity';
import { assertAuthenticatedAdmin } from './support/auth';
import { assertLiveDatabaseIdentity, readLiveDatabaseIdentity } from './support/database-identity';

// Only the history drill-down case requests this fixture. Every shard owns its
// disposable database; no global seed, external reference import, or prior test is required.
const test = base.extend<{ historicalOrder: { id: string; date: string } }>({
  historicalOrder: async ({ request }, runWithFixture) => {
    const environment = readE2eEnvironment();
    const health = await request.get('/api/e2e/health');
    expect(health.status()).toBe(200);
    assertLiveDatabaseIdentity(environment.databaseIdentity, readLiveDatabaseIdentity(await health.json()));
    const database = new Client({
      connectionString: environment.databaseUrl,
      ssl: false,
      connectionTimeoutMillis: 5_000,
      options: '--statement_timeout=15000 --lock_timeout=5000'
    });
    const number = 'E2E-HEATMAP-HISTORY-' + randomUUID();
    let id: string | undefined;
    await database.connect();
    try {
      await verifyE2eResetTarget(database, environment.databaseIdentity, environment.storageNamespace, environment.resetOwnershipHash);
      // The real submission trigger captures this historical date and value.
      const inserted = await database.query<{ id: string; analytics_submitted_at: Date }>(
        `insert into orders (order_number, customer_type, contact_name, email, subtotal, tax, total, created_at)
         values ($1, 'individual', 'E2E heatmap history', 'heatmap-history@example.test', 25, 5.5, 30.5, now() - interval '45 days')
         returning id::text, analytics_submitted_at`,
        [number]
      );
      id = inserted.rows[0].id;
      await runWithFixture({ id, date: localDate(inserted.rows[0].analytics_submitted_at) });
    } finally {
      try {
        if (id) {
          const removed = await database.query('delete from orders where id = $1 and order_number = $2', [id, number]);
          expect(removed.rowCount, 'Remove only the historical order created by this test.').toBe(1);
        }
      } finally {
        await database.end();
      }
    }
  }
});

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

test('rebuilt analytics tabs and business load errors remain usable', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/admin/analitika?range=90D');
  await expect(page.getByText('Definicije, pokritost in zgodovina podatkov', { exact: true })).toBeVisible();
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

test('activity calendar uses the canonical order population for its own visible history', async ({ request }) => {
  test.setTimeout(120_000);
  for (const filters of ['', '&customerType=school', '&source=direct', '&status=cancelled']) {
    const response = await request.get('/api/admin/analytics/business/activity?weeks=104' + filters);
    expect(response.status()).toBe(200);
    expect(response.headers()['cache-control']).toContain('no-store');
    const activity = await response.json() as BusinessActivityResponse;
    expect(activity.weeks).toBe(104);
    expect(new Date(activity.from + 'T12:00:00Z').getUTCDay()).toBe(1);
    expect(activity.days.at(-1)?.date).toBe(activity.to);
    expect(activity.days.at(-1)?.partial).toBe(true);
    const query = new URLSearchParams({
      range: 'custom', from: activity.from, to: activity.to, asOf: activity.asOf,
      ...activity.filters
    });
    const canonicalResponse = await request.get('/api/admin/analytics/business?' + query);
    expect(canonicalResponse.status()).toBe(200);
    const canonical = await canonicalResponse.json() as BusinessAnalyticsResponse;
    expect(activity.days).toEqual(canonical.days.map(({ date, orderCount, activityValue, valueCount, available, partial }) => ({ date, orderCount, activityValue, valueCount, available, partial })));
    const recordsResponse = await request.get('/api/admin/analytics/business/records?' + query + '&kind=orders');
    expect(recordsResponse.status()).toBe(200);
    const count = activity.days.reduce((sum, day) => sum + day.orderCount, 0);
    expect((await recordsResponse.json()).total).toBe(count);
    const csv = await request.get('/api/admin/analytics/business/records?' + query + '&kind=orders&format=csv');
    expect(csv.status()).toBe(200);
    expect((await csv.text()).split(/\r?\n/u)).toHaveLength(count + 1);
  }
});

test('activity calendar fills available width with plain fixed colours and stays independent of report dates', async ({ page, request, historicalOrder }, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  const activityRequests: string[] = [];
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/api/admin/analytics/business/activity') activityRequests.push(request.url());
  });
  await page.goto('/admin/analitika?range=90D');
  const heatmap = page.getByTestId('order-activity-heatmap');
  const grid = heatmap.getByTestId('activity-calendar-grid');
  const calendar = heatmap.getByRole('region', { name: 'Koledar aktivnosti naročil', exact: true });
  await expect(grid).toBeVisible();
  await expect.poll(async () => Number(await grid.getAttribute('data-weeks'))).toBeGreaterThan(52);
  await expect(heatmap.getByRole('link', { name: 'Izvoz CSV', exact: true })).toBeVisible();
  for (const band of ['1–2', '3–5', '6–10', '11–14', '15+']) {
    await expect(heatmap.getByText(band, { exact: true })).toBeVisible();
  }
  const snapshot = async () => ({
    weeks: await grid.getAttribute('data-weeks'),
    exportHref: await heatmap.getByRole('link', { name: 'Izvoz CSV', exact: true }).getAttribute('href'),
    cells: await grid.locator('button[data-date]').evaluateAll(elements => elements.map(element => ({
      date: element.getAttribute('data-date'), level: element.getAttribute('data-count-level'),
      color: getComputedStyle(element).backgroundColor,
      backgroundImage: getComputedStyle(element).backgroundImage
    })))
  });
  const initial = await snapshot();
  await heatmap.screenshot({ path: testInfo.outputPath('activity-desktop.png') });
  expect(initial.cells.length).toBeGreaterThan(365);
  expect(initial.cells.every(cell => cell.backgroundImage === 'none')).toBe(true);
  const calendarBox = await calendar.boundingBox();
  const gridBox = await grid.boundingBox();
  expect(gridBox!.width).toBeGreaterThan(calendarBox!.width - 48);
  expect(gridBox!.x + gridBox!.width).toBeLessThanOrEqual(calendarBox!.x + calendarBox!.width + 1);
  expect(await calendar.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  const initialRequests = activityRequests.length;

  for (const preset of ['30D', 'Po meri']) {
    const businessResponse = page.waitForResponse(response => {
      const url = new URL(response.url());
      return url.pathname === '/api/admin/analytics/business' && url.searchParams.get('range') === (preset === 'Po meri' ? 'custom' : preset);
    });
    await page.getByRole('button', { name: preset, exact: true }).click();
    expect((await businessResponse).status()).toBe(200);
    await expect(page.getByText('Definicije, pokritost in zgodovina podatkov', { exact: true })).toBeVisible();
    expect(await snapshot()).toEqual(initial);
    expect(activityRequests).toHaveLength(initialRequests);
  }
  const customResponse = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname === '/api/admin/analytics/business' && url.searchParams.get('from') === initial.cells[0].date;
  });
  await page.getByLabel('Od', { exact: true }).fill(initial.cells[0].date!);
  await page.getByLabel('Do (vključeno)', { exact: true }).fill(initial.cells[0].date!);
  await page.getByRole('button', { name: 'Uporabi', exact: true }).click();
  expect((await customResponse).status()).toBe(200);
  await expect(page.getByText('Definicije, pokritost in zgodovina podatkov', { exact: true })).toBeVisible();
  expect(await snapshot()).toEqual(initial);
  expect(activityRequests).toHaveLength(initialRequests);

  // The heatmap's export and day drill-down keep its own dates even outside the report's 30D range.
  const exportUrl = new URL(initial.exportHref!, page.url());
  expect(exportUrl.searchParams.get('range')).toBe('custom');
  const canonicalResponse = await request.get('/api/admin/analytics/business?' + exportUrl.searchParams);
  expect(canonicalResponse.status()).toBe(200);
  const canonical = await canonicalResponse.json() as BusinessAnalyticsResponse;
  const recent = await (await request.get('/api/admin/analytics/business?range=30D&asOf=' + encodeURIComponent(canonical.asOf))).json() as BusinessAnalyticsResponse;
  const pastDay = canonical.days.find(day => day.date === historicalOrder.date);
  expect(pastDay, 'The test creates its own isolated order older than 30 days.').toBeDefined();
  expect(pastDay!.date < recent.period.from).toBe(true);
  expect(pastDay!.orderCount).toBeGreaterThan(0);
  const csv = await request.get(exportUrl.pathname + exportUrl.search);
  expect(csv.status()).toBe(200);
  expect((await csv.text()).split(/\r?\n/u)).toHaveLength(canonical.summary.orderCount + 1);
  const drillResponse = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname === '/api/admin/analytics/business/records' && url.searchParams.get('date') === pastDay!.date;
  });
  await grid.locator('button[data-date="' + pastDay!.date + '"]').click();
  const drill = await drillResponse;
  expect(drill.status()).toBe(200);
  const drillPayload = await drill.json();
  expect(drillPayload.total).toBe(pastDay!.orderCount);
  expect(drillPayload.records.map((record: { id: string }) => record.id)).toContain(historicalOrder.id);
  expect(new URL(drill.url()).searchParams.get('from')).toBe(canonical.period.from);
  expect(new URL(drill.url()).searchParams.get('asOf')).toBe(canonical.asOf);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText(pastDay!.orderCount + ' zapisov');
  const dayExport = await dialog.getByRole('link', { name: 'Izvozi vse ujemajoče zapise CSV', exact: true }).getAttribute('href');
  const dayCsv = await request.get(dayExport!);
  expect(dayCsv.status()).toBe(200);
  expect((await dayCsv.text()).split(/\r?\n/u)).toHaveLength(pastDay!.orderCount + 1);
  await dialog.getByRole('button', { name: 'Zapri', exact: true }).click();

  await page.setViewportSize({ width: 1280, height: 900 });
  await expect.poll(async () => Number(await grid.getAttribute('data-weeks'))).toBeLessThan(Number(initial.weeks));
  const medium = await snapshot();
  expect(medium.cells[0].date! > initial.cells[0].date!).toBe(true);
  expect(await calendar.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(async () => Number(await grid.getAttribute('data-weeks'))).toBeLessThan(Number(medium.weeks));
  expect(await calendar.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await heatmap.screenshot({ path: testInfo.outputPath('activity-mobile.png') });
});

test('activity calendar retains customer, source and status filters and reports its own load errors', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/admin/analitika?range=30D&customerType=school&source=direct&status=cancelled');
  const heatmap = page.getByTestId('order-activity-heatmap');
  await expect(heatmap.getByTestId('activity-calendar-grid')).toBeVisible();
  const href = await heatmap.getByRole('link', { name: 'Izvoz CSV', exact: true }).getAttribute('href');
  const query = new URL(href!, page.url()).searchParams;
  expect(query.get('customerType')).toBe('school');
  expect(query.get('source')).toBe('direct');
  expect(query.get('status')).toBe('cancelled');
  const changed = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname === '/api/admin/analytics/business/activity' && url.searchParams.get('customerType') === 'company';
  });
  await page.getByRole('combobox', { name: 'Tip naročnika', exact: true }).selectOption('company');
  expect((await changed).status()).toBe(200);
  await expect(heatmap.getByRole('link', { name: 'Izvoz CSV', exact: true })).toHaveAttribute('href', /customerType=company/u);
  await page.route('**/api/admin/analytics/business/activity?*', route => route.fulfill({
    status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Preizkus nedosegljivosti koledarja.' })
  }));
  await page.getByRole('combobox', { name: 'Tip naročnika', exact: true }).selectOption('all');
  await expect(heatmap.getByRole('alert')).toContainText('Preizkus nedosegljivosti koledarja.');
  await expect(heatmap.getByTestId('activity-calendar-grid')).toHaveCount(0);
  await page.unroute('**/api/admin/analytics/business/activity?*');
  await heatmap.getByRole('button', { name: 'Poskusi znova', exact: true }).click();
  await expect(heatmap.getByTestId('activity-calendar-grid')).toBeVisible();
});

test('activity calendar applies fixed count and euro boundaries with compact tooltips (read-only presentation fixture)', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  const counts = [0, 1, 2, 3, 5, 6, 10, 11, 14, 15, 22, 0];
  const levels = [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 0];
  const values = [0, 19.99, 20, 49.99, 50, 99.99, 100, 143.68, 249.99, 250, 500, 0];
  const valueLevels = [0, 1, 2, 2, 3, 3, 4, 4, 4, 5, 5, 0];
  const colors = ['rgb(229, 231, 235)', 'rgb(134, 239, 172)', 'rgb(45, 212, 191)', 'rgb(56, 189, 248)', 'rgb(99, 102, 241)', 'rgb(109, 40, 217)'];
  let sampleDays: BusinessActivityResponse['days'] = [];
  await page.route('**/api/admin/analytics/business/activity?*', async route => {
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    const activity = await response.json() as BusinessActivityResponse;
    sampleDays = activity.days.slice(0, counts.length).map((day, index) => ({
      ...day, orderCount: counts[index], valueCount: counts[index],
      activityValue: values[index], available: index !== counts.length - 1
    }));
    await route.fulfill({ response, json: { ...activity, days: [...sampleDays, ...activity.days.slice(counts.length)] } });
  });
  await page.goto('/admin/analitika?range=30D');
  const heatmap = page.getByTestId('order-activity-heatmap');
  const grid = heatmap.getByTestId('activity-calendar-grid');
  await expect(grid).toBeVisible();
  expect(sampleDays).toHaveLength(counts.length);
  for (const [index, day] of sampleDays.entries()) {
    const cell = grid.locator('button[data-date="' + day.date + '"]');
    await expect(cell).toHaveAttribute('data-count-level', String(levels[index]));
    await expect(cell).toHaveCSS('background-color', colors[levels[index]]);
    await expect(cell).toHaveCSS('background-image', 'none');
  }
  await expect(grid.locator('button[data-date="' + sampleDays.at(-1)!.date + '"]')).toHaveAttribute('title', /\d{2}\.\d{2}\.\d{4} \| — nar\. \| —/u);
  await heatmap.getByRole('button', { name: 'Vrednost naročil', exact: true }).click();
  for (const [index, day] of sampleDays.entries()) {
    const cell = grid.locator('button[data-date="' + day.date + '"]');
    await expect(cell).toHaveCSS('background-color', colors[valueLevels[index]]);
    if (day.available) await expect(cell).toHaveAttribute('title', day.date.split('-').reverse().join('.') + ' | ' + counts[index] + ' nar. | ' + new Intl.NumberFormat('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(values[index]) + '€');
  }
  await expect(heatmap).not.toContainText('Barvni pasovi vrednosti');
  await heatmap.screenshot({ path: testInfo.outputPath('activity-colour-fixture-desktop.png') });
});

test('new aggregates, exports, corrections and capture require admin authentication', async ({ playwright, baseURL }) => {
  const anonymous = await playwright.request.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  try {
    for (const route of ['/api/admin/analytics/business', '/api/admin/analytics/business/activity?weeks=53', '/api/admin/analytics/business/records?format=csv', '/api/admin/analytics/geography', '/api/admin/analytics/geography/audit', '/api/admin/analytics/orders/1/measurements']) {
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
