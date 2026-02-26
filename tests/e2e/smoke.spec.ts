import { expect, test } from '@playwright/test';

const AUTH_REDIRECT_HINTS = ['/login', '/auth', '/signin'];

function isAuthRedirect(url: string) {
  return AUTH_REDIRECT_HINTS.some((hint) => url.includes(hint));
}

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
  const response = await page.goto(path);
  expect(response).not.toBeNull();

  const status = response!.status();
  const currentUrl = page.url();

  if (status === 200) {
    await expect(page).toHaveURL(new RegExp(`${path.replace('/', '\\/')}$`));
    return;
  }

  if (status === 401) {
    expect(await page.textContent('body')).toContain('Authentication required');
    return;
  }

  if (status >= 300 && status < 400) {
    expect(isAuthRedirect(currentUrl)).toBeTruthy();
    return;
  }

  throw new Error(`Unexpected admin route outcome for ${path}: status=${status}, url=${currentUrl}`);
}

test('admin orders route is accessible or protected', async ({ page }) => {
  await expectAdminRouteProtectedOrLoaded(page, '/admin/orders');
});

test('admin artikli route is accessible or protected', async ({ page }) => {
  await expectAdminRouteProtectedOrLoaded(page, '/admin/artikli');
});
