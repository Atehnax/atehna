import { expect, test } from '@playwright/test';
import pg, { type Pool as PgPool } from 'pg';
import { ORDER_ATTENTION_STATUSES } from '../../src/shared/domain/order/orderStatus';
import { assertAuthenticatedAdmin } from './support/auth';

const { Pool } = pg;

let database: PgPool;

test.beforeAll(() => {
  const databaseUrl = process.env.E2E_DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error('[e2e-preflight] E2E_DATABASE_URL is required.');
  }
  database = new Pool({ connectionString: databaseUrl, ssl: false });
});

test.afterAll(async () => {
  if (!database) return;
  await (database as PgPool & { end: () => Promise<void> }).end();
});

test.beforeEach(async ({ request }) => {
  await assertAuthenticatedAdmin(request);
});

test('Naročila tab notification matches orders in attention statuses', async ({
  page
}) => {
  const result = await database.query<{ count: number }>(
    `
      select count(*)::int as count
      from orders
      where orders.status = any($1::text[])
        and orders.deleted_at is null
    `,
    [[...ORDER_ATTENTION_STATUSES]]
  );
  const expectedCount = Number(result.rows[0]?.count ?? 0);

  await page.goto('/admin/orders?view=quotes');
  await page.waitForLoadState('networkidle');

  const ordersTab = page.locator('#admin-orders-tab-orders');
  const badge = ordersTab.locator('[data-admin-notification-count]');
  if (expectedCount === 0) {
    await expect(badge).toHaveCount(0);
    return;
  }

  await expect(badge).toHaveAttribute(
    'data-admin-notification-count',
    String(expectedCount)
  );
  await expect(badge.locator('[aria-hidden="true"]')).toHaveText(
    expectedCount > 99 ? '99+' : String(expectedCount)
  );
});
