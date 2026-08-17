import { expect, test } from '@playwright/test';
import { DEFAULT_HOMEPAGE_SETTINGS } from '@/shared/domain/landing/landingPage';

test('home page loads', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: DEFAULT_HOMEPAGE_SETTINGS.hero.title
    })
  ).toBeVisible();
});

test('order page loads', async ({ page }) => {
  await page.goto('/order');

  await expect(page.getByTestId('order-page')).toBeVisible({ timeout: 15000 });
});

test('catalogue and empty cart states load', async ({ page }) => {
  await page.goto('/products');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Izdelki in program' })
  ).toBeVisible({ timeout: 15000 });

  await page.goto('/cart');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Košarica je prazna' })
  ).toBeVisible();
});

test('confirmation page rejects a missing access token', async ({ page }) => {
  await page.goto('/order/confirmation');
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Potrditve ni mogoče prikazati'
    })
  ).toBeVisible();
});

async function expectAdminRouteLoaded(page: import('@playwright/test').Page, path: string) {
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
  expect(response).not.toBeNull();
  const expectedPath = path.replace(/\/$/, '');
  await page.waitForURL((url) => url.pathname.replace(/\/$/, '') === expectedPath, {
    timeout: 15000
  });
  const finalPath = new URL(page.url()).pathname.replace(/\/$/, '');
  expect(finalPath).toBe(expectedPath);
}

test('authenticated admin orders route loads', async ({ page }) => {
  await expectAdminRouteLoaded(page, '/admin/orders');
});

test('authenticated admin artikli route loads', async ({ page }) => {
  await expectAdminRouteLoaded(page, '/admin/artikli');
});

test('authenticated admin podoba entry defaults to landing appearance', async ({ page }) => {
  await page.goto('/admin/podoba');
  await expect.poll(() => {
    const pathname = new URL(page.url()).pathname.replace(/\/$/, '');
    return pathname === '/admin/podoba/glavna-stran';
  }, { timeout: 15000 }).toBeTruthy();
});

test('authenticated admin landing appearance route loads', async ({ page }) => {
  await expectAdminRouteLoaded(page, '/admin/podoba/glavna-stran');
});

test('authenticated admin logo route loads', async ({ page }) => {
  await expectAdminRouteLoaded(page, '/admin/podoba/logotip');
});

test('authenticated admin global parameters route loads', async ({ page }) => {
  await expectAdminRouteLoaded(page, '/admin/podoba/globalni-parametri');
});

test('authenticated admin product appearance route loads', async ({ page }) => {
  await expectAdminRouteLoaded(page, '/admin/podoba/artikli');
});

test('admin podoba tabs put landing before navigation', async ({ page }) => {
  await expectAdminRouteLoaded(page, '/admin/podoba/glavna-stran');
  await expect(page.locator('nav a[href="/admin/podoba/glavna-stran"]')).toHaveCount(1);
  await expect(page.getByRole('tab').nth(0)).toHaveText('Glavna stran');
  await expect(page.getByRole('tab').nth(1)).toHaveText('Navigacija');
});

test('authenticated admin podoba archive route loads', async ({ page }) => {
  await expectAdminRouteLoaded(page, '/admin/arhiv/podoba');
});
