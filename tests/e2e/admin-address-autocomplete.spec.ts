import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import pg, { type Pool as PgPool } from 'pg';
import { assertAuthenticatedAdmin } from './support/auth';

const { Pool } = pg;

type CanonicalAddress = {
  gursHouseNumberId: string;
  addressLine1: string;
  postalCode: string;
  postalName: string;
  settlementName: string;
  municipalityName: string;
};

const ADDRESS_QUERY = 'Cankarjeva ulica 27';
const FIRST_CHARACTER_QUERY = ADDRESS_QUERY.slice(0, 1);
const INITIAL_ADDRESS = {
  addressLine1: 'Testna ulica 1',
  postalCode: '1000',
  postalName: 'Ljubljana'
} as const;

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

test('admin order and quote editors suggest, save, and clear canonical addresses', async ({
  page,
  request
}) => {
  test.setTimeout(90_000);
  const token = randomUUID().slice(0, 8);
  let orderId: number | null = null;
  let quoteRequestId: number | null = null;

  const addressSearchResponse = await request.get('/api/addresses/search', {
    params: { query: FIRST_CHARACTER_QUERY }
  });
  expect(addressSearchResponse.ok()).toBe(true);
  const addressSearchPayload = await addressSearchResponse.json() as {
    results?: CanonicalAddress[];
  };
  const canonicalAddresses = addressSearchPayload.results ?? [];
  expect(canonicalAddresses.length).toBeGreaterThan(0);
  const canonicalAddress = canonicalAddresses[0];
  expect(canonicalAddress).toBeTruthy();
  if (!canonicalAddress) {
    throw new Error('The real GURS address endpoint returned no canonical address.');
  }

  try {
    const orderCreateResponse = await request.post('/api/admin/orders');
    expect(orderCreateResponse.status()).toBe(200);
    const createdOrder = await orderCreateResponse.json() as { orderId?: unknown };
    orderId = Number(createdOrder.orderId);
    expect(Number.isSafeInteger(orderId) && orderId > 0).toBe(true);

    await database.query(
      "update orders set is_draft = false, customer_type = 'company', organization_name = $2, contact_name = 'Ana Novak', email = $3, address_line1 = $4, address_line2 = null, postal_code = $5, city = $6, country_code = 'SI', gurs_house_number_id = $7 where id = $1",
      [
        orderId,
        'E2E naslov naročilo ' + token,
        'admin-address-order-' + token + '@example.test',
        INITIAL_ADDRESS.addressLine1,
        INITIAL_ADDRESS.postalCode,
        INITIAL_ADDRESS.postalName,
        null
      ]
    );

    await page.goto('/admin/orders/' + String(orderId));
    await page.waitForLoadState('networkidle');
    const orderCard = page.getByTestId('admin-order-data-card');
    await orderCard
      .getByRole('button', { name: 'Uredi podatke naročila' })
      .click();

    const orderAddress = page.getByTestId('admin-order-address-autocomplete');
    await expect(orderAddress).toHaveAttribute('role', 'combobox');
    await expect(orderAddress).toHaveAttribute('aria-autocomplete', 'list');
    await expect(orderAddress).toHaveAttribute('autocomplete', 'off');
    await expect(orderAddress).toHaveValue(INITIAL_ADDRESS.addressLine1);
    await orderAddress.fill('');
    await orderAddress.fill(FIRST_CHARACTER_QUERY);

    const orderSuggestions = page.getByRole('listbox', {
      name: 'Predlogi naslovov'
    });
    await expect(orderSuggestions).toBeVisible();
    const orderOptions = orderSuggestions.getByRole('option');
    await expect(orderOptions.first()).toBeVisible();
    expect(await orderOptions.count()).toBeLessThanOrEqual(8);
    await orderAddress.press('ArrowDown');
    await expect(orderOptions.first()).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await orderAddress.press('Enter');

    await expect(orderAddress).toHaveValue(canonicalAddress.addressLine1);
    await expect(orderCard.getByLabel('Poštna številka')).toHaveValue(
      canonicalAddress.postalCode
    );
    await expect(orderCard.getByLabel('Kraj')).toHaveValue(
      canonicalAddress.postalName
    );

    const orderSaveResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().endsWith(
          '/api/admin/orders/' + String(orderId) + '/details'
        )
    );
    await page.getByRole('button', { name: 'Shrani', exact: true }).click();
    expect((await orderSaveResponsePromise).ok()).toBe(true);

    const savedOrder = await database.query<{
      address_line1: string;
      postal_code: string;
      city: string;
      gurs_house_number_id: string | null;
    }>(
      'select address_line1, postal_code, city, gurs_house_number_id from orders where id = $1',
      [orderId]
    );
    expect(savedOrder.rows[0]).toEqual({
      address_line1: canonicalAddress.addressLine1,
      postal_code: canonicalAddress.postalCode,
      city: canonicalAddress.postalName,
      gurs_house_number_id: canonicalAddress.gursHouseNumberId
    });

    await orderCard
      .getByRole('button', { name: 'Uredi podatke naročila' })
      .click();
    const manuallyEditedOrderAddress = page.getByTestId(
      'admin-order-address-autocomplete'
    );
    await manuallyEditedOrderAddress.fill('Neobstoječa ulica ' + token);
    await expect(
      page.getByTestId('admin-order-address-autocomplete-empty')
    ).toHaveText('Ni predlogov naslovov.');
    await manuallyEditedOrderAddress.fill('Cankarjeva ulica 27b');
    const orderManualSavePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().endsWith(
          '/api/admin/orders/' + String(orderId) + '/details'
        )
    );
    await page.getByRole('button', { name: 'Shrani', exact: true }).click();
    expect((await orderManualSavePromise).ok()).toBe(true);
    const manuallyEditedOrder = await database.query<{
      gurs_house_number_id: string | null;
    }>('select gurs_house_number_id from orders where id = $1', [orderId]);
    expect(manuallyEditedOrder.rows[0]?.gurs_house_number_id).toBeNull();

    const quoteCreateResponse = await request.post('/api/admin/quote-requests', {
      data: { mode: 'draft' }
    });
    expect(quoteCreateResponse.status()).toBe(201);
    const createdQuote = await quoteCreateResponse.json() as {
      quoteRequestId?: unknown;
    };
    quoteRequestId = Number(createdQuote.quoteRequestId);
    expect(Number.isSafeInteger(quoteRequestId) && quoteRequestId > 0).toBe(true);

    await database.query(
      "update quote_requests set customer_type = 'company', organization_name = $2, contact_name = 'Ana Novak', email = $3, address_line1 = $4, address_line2 = null, postal_code = $5, city = $6, country_code = 'SI', gurs_house_number_id = $7, state_version = state_version + 1, updated_at = now() where id = $1",
      [
        quoteRequestId,
        'E2E naslov ponudba ' + token,
        'admin-address-quote-' + token + '@example.test',
        INITIAL_ADDRESS.addressLine1,
        INITIAL_ADDRESS.postalCode,
        INITIAL_ADDRESS.postalName,
        null
      ]
    );

    await page.goto('/admin/orders/quotes/' + String(quoteRequestId));
    await page.waitForLoadState('networkidle');
    const quoteCard = page.getByTestId('quote-request-details-card');
    await quoteCard
      .getByRole('button', { name: 'Uredi podatke povpraševanja' })
      .click();

    const quoteAddress = page.getByTestId('admin-quote-address-autocomplete');
    await expect(quoteAddress).toHaveAttribute('role', 'combobox');
    await expect(quoteAddress).toHaveAttribute('aria-autocomplete', 'list');
    await expect(quoteAddress).toHaveValue(INITIAL_ADDRESS.addressLine1);
    await quoteAddress.fill('');
    await quoteAddress.fill(FIRST_CHARACTER_QUERY);
    const quoteSuggestions = page.getByRole('listbox', {
      name: 'Predlogi naslovov'
    });
    await expect(quoteSuggestions).toBeVisible();
    await quoteSuggestions.getByRole('option').first().click();

    await expect(quoteAddress).toHaveValue(canonicalAddress.addressLine1);
    await expect(quoteCard.getByLabel('Poštna številka')).toHaveValue(
      canonicalAddress.postalCode
    );
    await expect(quoteCard.getByLabel('Kraj')).toHaveValue(
      canonicalAddress.postalName
    );

    const quoteSaveResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' &&
        response.url().endsWith(
          '/api/admin/quote-requests/' +
            String(quoteRequestId) +
            '/details'
        )
    );
    await page.getByRole('button', { name: 'Shrani', exact: true }).click();
    expect((await quoteSaveResponsePromise).ok()).toBe(true);

    const savedQuote = await database.query<{
      address_line1: string | null;
      postal_code: string | null;
      city: string | null;
      gurs_house_number_id: string | null;
      billing_gurs_house_number_id: string | null;
    }>(
      "select address_line1, postal_code, city, gurs_house_number_id, billing_snapshot_json ->> 'gursHouseNumberId' as billing_gurs_house_number_id from quote_requests where id = $1",
      [quoteRequestId]
    );
    expect(savedQuote.rows[0]).toEqual({
      address_line1: canonicalAddress.addressLine1,
      postal_code: canonicalAddress.postalCode,
      city: canonicalAddress.postalName,
      gurs_house_number_id: canonicalAddress.gursHouseNumberId,
      billing_gurs_house_number_id: canonicalAddress.gursHouseNumberId
    });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(
      quoteCard.getByRole('button', { name: 'Uredi podatke povpraševanja' })
    ).toBeEnabled();
    await quoteCard
      .getByRole('button', { name: 'Uredi podatke povpraševanja' })
      .click();
    await expect(quoteCard.getByLabel('Poštna številka')).toBeEnabled();
    await quoteCard.getByLabel('Poštna številka').fill('6001');
    const quoteManualSavePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' &&
        response.url().endsWith(
          '/api/admin/quote-requests/' +
            String(quoteRequestId) +
            '/details'
        )
    );
    await page.getByRole('button', { name: 'Shrani', exact: true }).click();
    expect((await quoteManualSavePromise).ok()).toBe(true);
    const manuallyEditedQuote = await database.query<{
      gurs_house_number_id: string | null;
    }>('select gurs_house_number_id from quote_requests where id = $1', [
      quoteRequestId
    ]);
    expect(manuallyEditedQuote.rows[0]?.gurs_house_number_id).toBeNull();
  } finally {
    if (quoteRequestId !== null) {
      await request.delete(
        '/api/admin/quote-requests/' + String(quoteRequestId),
        {
          data: { reason: 'E2E cleanup admin address autocomplete ' + token }
        }
      );
    }
    if (orderId !== null) {
      await database.query(
        "delete from audit_events where entity_type = 'order' and entity_id = $1",
        [String(orderId)]
      );
      await database.query('delete from orders where id = $1', [orderId]);
    }
  }
});
