import { expect, request as playwrightRequest, test, type APIRequestContext } from '@playwright/test';
import pg from 'pg';
import { hashPassword } from 'better-auth/crypto';
import { checkE2eDatabase, readE2eEnvironment } from '../../scripts/e2e-database.mjs';
import { ADMIN_STORAGE_STATE_PATH, E2E_BASE_URL } from './support/auth';

const baseURL = E2E_BASE_URL;
const username = process.env.E2E_ADMIN_USERNAME!;
const password = process.env.E2E_ADMIN_PASSWORD!;
const originHeaders = { Origin: baseURL };
let db: pg.Pool;
let initialHash: string;
const contexts: APIRequestContext[] = [];

async function client() {
  const context = await playwrightRequest.newContext({ baseURL, extraHTTPHeaders: originHeaders, storageState: { cookies: [], origins: [] } });
  contexts.push(context);
  return context;
}
async function login(value = password) {
  const context = await client();
  const result = await context.post('/api/admin/login', { data: { username, password: value } });
  expect(result.status()).toBe(200);
  expect((await result.json()).token).toBeUndefined();
  const { rows } = await db.query('select id from admin_auth_session order by "createdAt" desc limit 1');
  return { context, id: rows[0].id as string };
}
async function policy(context: APIRequestContext, maxLifetimeDays: number, idleTimeoutMinutes: number, currentPassword = password) {
  return context.post('/api/admin/skrbniki/session-settings', { data: { currentPassword, maxLifetimeDays, idleTimeoutMinutes } });
}

test.describe('persistent administrator authentication', () => {
  test.describe.configure({ mode: 'serial' });
  test.beforeAll(async () => {
    const environment = readE2eEnvironment();
    await checkE2eDatabase();
    db = new pg.Pool({ connectionString: environment.databaseUrl, ssl: false, max: 2 });
    initialHash = await hashPassword(password);
  });
  test.afterEach(async () => {
    await Promise.all(contexts.splice(0).map((context) => context.dispose()));
    await db.query('update admin_auth_account set password = $1 where "providerId" = $2', [initialHash, 'credential']);
    await db.query('update admin_auth_user set "credentialVersion" = "credentialVersion" + 1');
    await db.query('delete from admin_auth_session');
    await db.query('delete from admin_login_attempt');
    await db.query('update admin_session_policy set max_lifetime_days = 30, idle_timeout_minutes = 30 where id = 1');
  });
  test.afterAll(async () => {
    // Restore a real login for subsequent suites; no application authentication bypass.
    const { context } = await login();
    await context.storageState({ path: ADMIN_STORAGE_STATE_PATH });
    await Promise.all(contexts.splice(0).map((value) => value.dispose()));
    await db.end();
  });

  test('login errors are generic and concurrent failures share a database limit', async () => {
    const context = await client();
    const bad = await context.post('/api/admin/login', { data: { username: 'nonexistent-admin', password: 'invalid-password' } });
    expect(bad.status()).toBe(401);
    expect((await bad.json()).error).toBe('Napačno uporabniško ime ali geslo.');
    const failures = await Promise.all(Array.from({ length: 12 }, () =>
      context.post('/api/admin/login', { data: { username, password: 'invalid-password' } })));
    expect(failures.filter((response) => response.status() === 401)).toHaveLength(9);
    expect(failures.filter((response) => response.status() === 429)).toHaveLength(3);
    const counters = await db.query('select max(attempts)::int as maximum from admin_login_attempt');
    expect(counters.rows[0].maximum).toBe(10);
  });

  test('login issues private cookies; logout revokes the copied session server-side', async () => {
    const { context } = await login();
    const state = await context.storageState();
    const cookie = state.cookies.find((value) => value.name.endsWith('atehna_admin_session'))!;
    expect(Boolean(cookie)).toBe(true);
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.secure).toBe(true);
    expect(cookie.sameSite).toBe('Lax');
    const copied = await playwrightRequest.newContext({ baseURL, extraHTTPHeaders: originHeaders, storageState: state });
    contexts.push(copied);
    expect((await context.get('/api/admin/skrbniki/session-settings')).status()).toBe(200);
    expect((await context.post('/api/admin/logout')).status()).toBe(200);
    expect((await copied.get('/api/admin/skrbniki/session-settings')).status()).toBe(401);
  });

  test('anonymous and invalid-cookie calls cannot reach representative private operations', async () => {
    const anonymous = await client();
    for (const url of ['/api/admin/categories', '/api/admin/skrbniki/session-settings', '/api/admin/orders/1/documents', '/api/admin/audit-events']) {
      expect((await anonymous.get(url)).status()).toBe(401);
    }
    expect((await anonymous.post('/api/admin/skrbniki/password', { data: {} })).status()).toBe(401);
    const forgedCookie = await anonymous.get('/api/admin/categories', { headers: { Cookie: '__Secure-atehna_admin_session=invalid.signature' } });
    expect(forgedCookie.status()).toBe(401);
    const setup = await anonymous.post('/api/admin/auth/sign-up/email', { data: {} });
    expect([401,404,405]).toContain(setup.status());
  });

  test('current password and same-origin requests are required for both mutations', async () => {
    const { context } = await login();
    const forged = await context.post('/api/admin/skrbniki/session-settings', {
      headers: { Origin: 'https://attacker.invalid' }, data: { currentPassword: password, maxLifetimeDays: 1, idleTimeoutMinutes: 1 }
    });
    expect(forged.status()).toBe(403);
    expect((await policy(context, 1, 1, 'wrong-password')).status()).toBe(400);
    expect((await policy(context, 0, 30)).status()).toBe(400);
    expect((await policy(context, 30, 1.5)).status()).toBe(400);
    expect((await policy(context, 91, 30)).status()).toBe(400);
    expect((await context.post('/api/admin/skrbniki/password', { data: {
      currentPassword: 'wrong-password', newPassword: 'new-long-secret-password', confirmPassword: 'new-long-secret-password'
    } })).status()).toBe(400);
    expect((await context.post('/api/admin/login', { headers: { Origin: 'https://attacker.invalid' }, data: { username, password } })).status()).toBe(403);
    expect((await context.post('/api/admin/session/activity', { data: {} })).status()).toBe(403);
  });

  test('password change invalidates all sessions, changes login and records no secrets', async () => {
    const first = await login();
    const second = await login();
    const nextPassword = 'replacement-password-for-e2e';
    await db.query("update audit_settings set is_enabled = false where key = 'global'");
    try {
      const change = await first.context.post('/api/admin/skrbniki/password', {
        data: { currentPassword: password, newPassword: nextPassword, confirmPassword: nextPassword }
      });
      expect(change.status()).toBe(200);
      expect((await first.context.get('/api/admin/session')).status()).toBe(401);
      expect((await second.context.get('/api/admin/session')).status()).toBe(401);
      expect((await second.context.post('/api/admin/login', { data: { username, password } })).status()).toBe(401);
      await login(nextPassword);
      const audit = await db.query("select summary, diff_json, metadata_json from audit_events where entity_id = 'admin-auth' order by occurred_at desc limit 1");
      expect(audit.rows[0].summary).toBe('Spremenjeno geslo skrbnika');
      const safe = JSON.stringify(audit.rows);
      expect(safe.includes(password)).toBe(false);
      expect(safe.includes(nextPassword)).toBe(false);
      expect(safe.includes('token')).toBe(false);
      const stored = await db.query('select password from admin_auth_account where "providerId" = $1', ['credential']);
      expect(stored.rows[0].password === nextPassword).toBe(false);
    } finally { await db.query("update audit_settings set is_enabled = true where key = 'global'"); }
  });

  test('absolute lifetime expires despite recent activity and forbids mutations', async () => {
    const { context, id } = await login();
    await db.query('update admin_auth_session set "createdAt" = clock_timestamp() - interval \'31 days\', "lastActivityAt" = clock_timestamp(), "expiresAt" = clock_timestamp() + interval \'1 day\' where id = $1', [id]);
    expect((await policy(context, 90, 1440)).status()).toBe(401);
    expect((await context.get('/api/admin/session')).status()).toBe(401);
  });

  test('polling does not renew inactivity, genuine activity is throttled and cannot revive expiry', async () => {
    const { context, id } = await login();
    await db.query('update admin_auth_session set "lastActivityAt" = clock_timestamp() - interval \'2 minutes\' where id = $1', [id]);
    const before = await db.query('select "lastActivityAt", "expiresAt", "createdAt" from admin_auth_session where id = $1', [id]);
    expect((await context.get('/api/admin/session')).status()).toBe(200);
    expect((await context.get('/api/admin/categories?view=preview')).status()).toBe(200);
    const polled = await db.query('select "lastActivityAt" from admin_auth_session where id = $1', [id]);
    expect(polled.rows[0].lastActivityAt.getTime()).toBe(before.rows[0].lastActivityAt.getTime());
    const activity = () => context.post('/api/admin/session/activity', { headers: { 'X-Admin-Activity': '1' }, data: {} });
    expect((await activity()).status()).toBe(200);
    const active = await db.query('select "lastActivityAt", "expiresAt", "createdAt" from admin_auth_session where id = $1', [id]);
    expect(active.rows[0].lastActivityAt.getTime()).toBeGreaterThan(before.rows[0].lastActivityAt.getTime());
    expect(active.rows[0].expiresAt.getTime()).toBe(before.rows[0].expiresAt.getTime());
    expect(active.rows[0].createdAt.getTime()).toBe(before.rows[0].createdAt.getTime());
    expect((await activity()).status()).toBe(200);
    const throttled = await db.query('select "lastActivityAt" from admin_auth_session where id = $1', [id]);
    expect(throttled.rows[0].lastActivityAt.getTime()).toBe(active.rows[0].lastActivityAt.getTime());
    await db.query('update admin_auth_session set "lastActivityAt" = clock_timestamp() - interval \'31 minutes\' where id = $1', [id]);
    expect((await activity()).status()).toBe(401);
  });

  test('shortened limits affect existing sessions and increases never revive expired sessions', async () => {
    const old = await login();
    const controller = await login();
    await db.query('update admin_auth_session set "createdAt" = clock_timestamp() - interval \'2 days\' where id = $1', [old.id]);
    expect((await policy(controller.context, 1, 30)).status()).toBe(200);
    expect((await policy(controller.context, 90, 1440)).status()).toBe(200);
    expect((await old.context.get('/api/admin/session')).status()).toBe(401);
    const idle = await login();
    await db.query('update admin_auth_session set "lastActivityAt" = clock_timestamp() - interval \'2 minutes\' where id = $1', [idle.id]);
    expect((await policy(controller.context, 30, 1)).status()).toBe(200);
    expect((await policy(controller.context, 30, 30)).status()).toBe(200);
    expect((await idle.context.get('/api/admin/session')).status()).toBe(401);
    const unobserved = await login();
    await db.query('update admin_auth_session set "lastActivityAt" = clock_timestamp() - interval \'31 minutes\' where id = $1', [unobserved.id]);
    expect((await policy(controller.context, 90, 1440)).status()).toBe(200);
    expect((await unobserved.context.get('/api/admin/session')).status()).toBe(401);
    const audit = await db.query("select diff_json from audit_events where entity_id = 'admin-auth' and summary = 'Spremenjene nastavitve sej skrbnika' order by occurred_at desc limit 1");
    expect(audit.rows[0].diff_json.idleTimeoutMinutes.after).toBe('1440');
  });

  test('Skrbniki matches the compact admin shell on desktop and mobile', async ({ browser }, testInfo) => {
    const { context } = await login();
    const browserContext = await browser.newContext({ baseURL, storageState: await context.storageState() });
    try {
      const page = await browserContext.newPage();
      await page.goto('/admin/skrbniki');
      await expect(page.getByRole('heading', { name: 'Sprememba gesla', exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Nastavitve sej', exact: true })).toBeVisible();
      await expect(page.getByLabel('Trenutno geslo', { exact: true })).toHaveCount(2);
      await expect(page.getByLabel('Najdaljše trajanje seje', { exact: true })).toHaveValue('30');
      await page.screenshot({ path: testInfo.outputPath('skrbniki-desktop.png'), fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.getByRole('heading', { name: 'Nastavitve sej', exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath('skrbniki-mobile.png'), fullPage: true });
      await page.setViewportSize({ width: 1280, height: 900 });
      const settingsForm = page.getByRole('form', { name: 'Nastavitve sej', exact: true });
      await settingsForm.getByLabel('Najdaljše trajanje seje', { exact: true }).fill('31');
      await settingsForm.getByLabel('Trenutno geslo', { exact: true }).fill(password);
      await settingsForm.getByRole('button', { name: 'Shrani nastavitve', exact: true }).click();
      await expect(settingsForm.getByRole('status')).toHaveText('Nastavitve sej so shranjene.');
      const passwordForm = page.getByRole('form', { name: 'Sprememba gesla', exact: true });
      const replacement = 'browser-replacement-password';
      await passwordForm.getByLabel('Trenutno geslo', { exact: true }).fill(password);
      await passwordForm.getByLabel('Novo geslo', { exact: true }).fill(replacement);
      await passwordForm.getByLabel('Potrditev novega gesla', { exact: true }).fill(replacement);
      await passwordForm.getByRole('button', { name: 'Spremeni geslo', exact: true }).click();
      await expect(page).toHaveURL(/\/admin\?passwordChanged=1$/);
      await expect(page.getByRole('status')).toHaveText('Geslo je spremenjeno. Prijavite se z novim geslom.');
      await page.getByLabel('Uporabniško ime', { exact: true }).fill(username);
      await page.getByLabel('Geslo', { exact: true }).fill(replacement);
      await page.getByRole('button', { name: 'Prijava', exact: true }).click();
      await expect(page).toHaveURL(/\/admin\/orders$/);
      await page.getByRole('button', { name: 'Odjava', exact: true }).click();
      await expect(page).toHaveURL(/\/admin$/);

    } finally { await browserContext.close(); }
  });
});
