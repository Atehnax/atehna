import { expect, test } from '@playwright/test';

test('home page loads', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: /Zanesljiva dobava materialov in opreme po Sloveniji/i
    })
  ).toBeVisible();
});

test('order page loads', async ({ page }) => {
  await page.goto('/order');

  await expect(page.getByTestId('order-page')).toBeVisible({ timeout: 15000 });
});

async function expectAdminRouteProtectedOrLoaded(page: import('@playwright/test').Page, path: string) {
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
  expect(response).not.toBeNull();

  const status = response!.status();

  if (status === 401 || status === 403) {
    return;
  }

  const expectedPath = path.replace(/\/$/, '');
  const loginPath = '/admin';

  await page.waitForURL(
    (url) => {
      const normalizedPath = url.pathname.replace(/\/$/, '');
      return normalizedPath === expectedPath || normalizedPath === loginPath;
    },
    { timeout: 15000 }
  );

  const finalPath = new URL(page.url()).pathname.replace(/\/$/, '');
  expect([expectedPath, loginPath]).toContain(finalPath);
}

test('admin orders route is accessible or protected', async ({ page }) => {
  await expectAdminRouteProtectedOrLoaded(page, '/admin/orders');
});

test('admin artikli route is accessible or protected', async ({ page }) => {
  await expectAdminRouteProtectedOrLoaded(page, '/admin/artikli');
});
