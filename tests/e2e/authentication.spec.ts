import { expect, request as playwrightRequest, test } from '@playwright/test';
import { E2E_BASE_URL } from './support/auth';

const baseURL = E2E_BASE_URL;

test('unauthenticated admin navigation redirects to login with a safe return path', async ({ browser }) => {
  const context = await browser.newContext({
    baseURL,
    storageState: { cookies: [], origins: [] }
  });
  try {
    const page = await context.newPage();
    await page.goto('/admin/orders');
    await expect(page).toHaveURL((url) => (
      url.pathname === '/admin'
      && url.searchParams.get('next') === '/admin/orders'
    ));
    await expect(page.getByRole('heading', { name: /prijava/i })).toBeVisible();
  } finally {
    await context.close();
  }
});

test('unauthenticated admin API is rejected before payload validation', async () => {
  const anonymousRequest = await playwrightRequest.newContext({
    baseURL,
    storageState: { cookies: [], origins: [] }
  });
  try {
    const response = await anonymousRequest.put('/api/admin/landing-page', {
      data: { config: { elements: [{ type: 'invalid' }] } }
    });
    expect(response.status()).toBe(401);
  } finally {
    await anonymousRequest.dispose();
  }
});

test('configured admin credentials create a session that reaches protected database data', async () => {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;
  expect(username).toBeTruthy();
  expect(password).toBeTruthy();

  const loginRequest = await playwrightRequest.newContext({ baseURL });
  try {
    const login = await loginRequest.post('/api/admin/login', {
      data: { username, password }
    });
    expect(login.status()).toBe(200);
    const protectedResponse = await loginRequest.get('/api/admin/categories?view=preview');
    expect(protectedResponse.status()).toBe(200);
    const payload = await protectedResponse.json() as { categories?: unknown[] };
    expect(payload.categories?.length).toBeGreaterThan(0);
  } finally {
    await loginRequest.dispose();
  }
});
