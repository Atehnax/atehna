import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext, type APIResponse } from '@playwright/test';
import pg, { type Pool as PgPool } from 'pg';

const { Pool } = pg;
const INVENTORY_POLICY_KEY = 'default';
const VARIANT_ID = 920001;

type Estimate = {
  quoteFingerprint: string;
  shippingConfigurationVersion: number;
};

type InventoryPolicyBackup = {
  configJson: unknown;
  updatedAt: Date;
  auditIds: string[];
};

type CatalogBackup = {
  inventory: number;
  updatedAt: Date;
};

async function json<T>(response: APIResponse): Promise<T> {
  return await response.json() as T;
}

async function backUpInventoryPolicy(
  database: PgPool
): Promise<InventoryPolicyBackup> {
  const [settings, audits] = await Promise.all([
    database.query<{ config_json: unknown; updated_at: Date }>(
      'select config_json, updated_at from inventory_policy_settings where key = $1',
      [INVENTORY_POLICY_KEY]
    ),
    database.query<{ id: string }>(
      "select id from audit_events where entity_type = 'system' and entity_id = 'inventory-policy'"
    )
  ]);
  const row = settings.rows[0];
  if (!row) {
    throw new Error('The deterministic inventory-policy row is missing.');
  }
  return {
    configJson: row.config_json,
    updatedAt: row.updated_at,
    auditIds: audits.rows.map((entry) => entry.id)
  };
}

async function restoreInventoryPolicy(
  database: PgPool,
  backup: InventoryPolicyBackup
) {
  const client = await database.connect();
  try {
    await client.query('begin');
    await client.query(
      `update inventory_policy_settings
          set config_json = $2::jsonb,
              updated_at = $3
        where key = $1`,
      [
        INVENTORY_POLICY_KEY,
        JSON.stringify(backup.configJson),
        backup.updatedAt
      ]
    );
    await client.query(
      `delete from audit_events
        where entity_type = 'system'
          and entity_id = 'inventory-policy'
          and not (id = any($1::uuid[]))`,
      [backup.auditIds]
    );
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

async function backUpCatalog(database: PgPool): Promise<CatalogBackup> {
  const result = await database.query<{
    inventory: number;
    updated_at: Date;
  }>(
    'select inventory, updated_at from catalog_item_variants where id = $1',
    [VARIANT_ID]
  );
  const row = result.rows[0];
  if (!row) throw new Error('The deterministic catalogue variant is missing.');
  return {
    inventory: Number(row.inventory),
    updatedAt: row.updated_at
  };
}

async function restoreCatalog(database: PgPool, backup: CatalogBackup) {
  await database.query(
    `update catalog_item_variants
        set inventory = $2,
            updated_at = $3
      where id = $1`,
    [VARIANT_ID, backup.inventory, backup.updatedAt]
  );
}

async function expectInsufficientStock(response: APIResponse) {
  expect(response.status()).toBe(409);
  await expect(json<{
    code?: string;
    issues?: Array<{
      code?: string;
      variantId?: number;
      availableStock?: number;
    }>;
  }>(response)).resolves.toMatchObject({
    code: 'ORDER_ITEMS_UNAVAILABLE',
    issues: [
      {
        code: 'INSUFFICIENT_STOCK',
        variantId: VARIANT_ID,
        availableStock: 0
      }
    ]
  });
}

function estimatePayload() {
  return {
    customerName: 'E2E preverjanje politike zaloge',
    items: [{ variantId: VARIANT_ID, quantity: 1 }]
  };
}

function orderPayload(email: string, estimate: Estimate) {
  return {
    customerType: 'individual',
    customerName: 'E2E preverjanje politike zaloge',
    organizationName: '',
    contactName: 'E2E preverjanje politike zaloge',
    email,
    addressLine1: 'Testna ulica 1',
    city: 'Ljubljana',
    postalCode: '1000',
    countryCode: 'SI',
    reference: 'E2E-ZALOGA',
    notes: '',
    shippingConfigurationVersion: estimate.shippingConfigurationVersion,
    quoteFingerprint: estimate.quoteFingerprint,
    items: [{ variantId: VARIANT_ID, quantity: 1 }]
  };
}

async function readPolicy(request: APIRequestContext) {
  const response = await request.get('/api/admin/inventory-policy');
  expect(response.status()).toBe(200);
  return await json<{
    config: { stockEnforcementEnabled: boolean };
  }>(response);
}

test.describe.serial('global inventory policy ordering behavior', () => {
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

  test('admin can disable enforcement, allowing an out-of-stock order without a hold, and re-enable it', async ({
    page,
    request
  }) => {
    test.setTimeout(60_000);
    const policyBackup = await backUpInventoryPolicy(database);
    const catalogBackup = await backUpCatalog(database);
    const allowedEmail = `inventory-policy-allowed-${randomUUID()}@example.test`;
    const blockedEmail = `inventory-policy-blocked-${randomUUID()}@example.test`;
    let allowedOrderId: number | null = null;

    try {
      expect(await readPolicy(request)).toMatchObject({
        config: { stockEnforcementEnabled: true }
      });
      await database.query(
        'update catalog_item_variants set inventory = 0, updated_at = now() where id = $1',
        [VARIANT_ID]
      );

      const initiallyBlockedEstimate = await request.post(
        '/api/orders/estimate',
        { data: estimatePayload() }
      );
      await expectInsufficientStock(initiallyBlockedEstimate);

      await page.goto('/admin/artikli');
      const policyControl = page.getByTestId('admin-inventory-policy-control');
      await expect(policyControl).toBeVisible();
      const disableSwitch = policyControl.getByRole('switch', {
        name: 'Izklopi omejevanje naročil glede na zalogo'
      });
      await expect(disableSwitch).toHaveAttribute('aria-checked', 'true');
      const disableResponsePromise = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === '/api/admin/inventory-policy'
          && response.request().method() === 'PUT'
      );
      await disableSwitch.click();
      const disableResponse = await disableResponsePromise;
      expect(disableResponse.status()).toBe(200);
      await expect(disableResponse.json()).resolves.toMatchObject({
        config: { stockEnforcementEnabled: false }
      });
      const enableSwitch = policyControl.getByRole('switch', {
        name: 'Vključi omejevanje naročil glede na zalogo'
      });
      await expect(enableSwitch).toHaveAttribute('aria-checked', 'false');
      expect(await readPolicy(request)).toMatchObject({
        config: { stockEnforcementEnabled: false }
      });

      const allowedEstimateResponse = await request.post(
        '/api/orders/estimate',
        { data: estimatePayload() }
      );
      expect(allowedEstimateResponse.status()).toBe(200);
      const allowedEstimate = await json<Estimate>(allowedEstimateResponse);
      expect(allowedEstimate.quoteFingerprint).toMatch(
        /^order-(?:estimate|quote)-v1:[a-f0-9]{64}$/u
      );

      const allowedOrderResponse = await request.post('/api/orders', {
        headers: { 'Idempotency-Key': `inventory-disabled-${randomUUID()}` },
        data: orderPayload(allowedEmail, allowedEstimate)
      });
      expect(allowedOrderResponse.status()).toBe(201);
      const storedAllowedOrder = await database.query<{
        id: string | number;
        contract_status: string;
        commitment_status: string;
        stock_enforcement_applied: boolean;
      }>(
        `select id, contract_status, commitment_status,
                stock_enforcement_applied
           from orders
          where email = $1`,
        [allowedEmail]
      );
      expect(storedAllowedOrder.rowCount).toBe(1);
      allowedOrderId = Number(storedAllowedOrder.rows[0].id);
      expect(storedAllowedOrder.rows[0]).toMatchObject({
        contract_status: 'accepted',
        commitment_status: 'binding',
        stock_enforcement_applied: false
      });
      const disabledOrderHolds = await database.query<{ count: string }>(
        'select count(*)::text as count from order_stock_holds where order_id = $1',
        [allowedOrderId]
      );
      expect(Number(disabledOrderHolds.rows[0]?.count)).toBe(0);
      const inventoryAfterAllowedOrder = await database.query<{
        inventory: number;
      }>('select inventory from catalog_item_variants where id = $1', [VARIANT_ID]);
      expect(Number(inventoryAfterAllowedOrder.rows[0]?.inventory)).toBe(0);

      const enableResponsePromise = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === '/api/admin/inventory-policy'
          && response.request().method() === 'PUT'
      );
      await enableSwitch.click();
      const enableResponse = await enableResponsePromise;
      expect(enableResponse.status()).toBe(200);
      await expect(enableResponse.json()).resolves.toMatchObject({
        config: { stockEnforcementEnabled: true }
      });
      await expect(policyControl.getByRole('switch', {
        name: 'Izklopi omejevanje naročil glede na zalogo'
      })).toHaveAttribute('aria-checked', 'true');
      expect(await readPolicy(request)).toMatchObject({
        config: { stockEnforcementEnabled: true }
      });

      const blockedOrderResponse = await request.post('/api/orders', {
        headers: { 'Idempotency-Key': `inventory-reenabled-${randomUUID()}` },
        data: orderPayload(blockedEmail, allowedEstimate)
      });
      await expectInsufficientStock(blockedOrderResponse);
      const blockedOrderCount = await database.query<{ count: string }>(
        'select count(*)::text as count from orders where email = $1',
        [blockedEmail]
      );
      expect(Number(blockedOrderCount.rows[0]?.count)).toBe(0);

      const reenabledEstimate = await request.post('/api/orders/estimate', {
        data: estimatePayload()
      });
      await expectInsufficientStock(reenabledEstimate);
    } finally {
      if (allowedOrderId !== null) {
        await database.query('delete from orders where id = $1', [allowedOrderId]);
      }
      await restoreCatalog(database, catalogBackup);
      await restoreInventoryPolicy(database, policyBackup);
    }
  });
});
