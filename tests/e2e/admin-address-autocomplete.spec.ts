import { randomUUID } from 'node:crypto';
import { expect, test, type Route } from '@playwright/test';
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
const REFINED_ADDRESS_QUERY = ADDRESS_QUERY.slice(0, 2);
const INITIAL_ADDRESS = {
  addressLine1: 'Testna ulica 1',
  postalCode: '1000',
  postalName: 'Ljubljana'
} as const;
const POSTAL_LOCATIONS = {
  codeLookup: {
    postalCode: '8340',
    postalName: 'Črnomelj'
  },
  townLookup: {
    postalCode: '1000',
    postalName: 'Ljubljana'
  },
  staleCodeLookup: {
    postalCode: '2000',
    postalName: 'Maribor'
  },
  latestTownLookup: {
    postalCode: '6000',
    postalName: 'Koper - Capodistria'
  }
} as const;
const MOCK_SOURCE_UPDATED_AT = '2026-07-01T00:00:00.000Z';

type AdminAddressEditor = 'order' | 'quote';

function createGate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

async function fulfillLookup(
  route: Route,
  results: readonly unknown[]
) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ results, sourceUpdatedAt: MOCK_SOURCE_UPDATED_AT })
  });
}

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

  let activeEditor: AdminAddressEditor | null = null;
  const addressRefinementGates = {
    order: createGate(),
    quote: createGate()
  };
  const postalCodeGates = {
    order: createGate(),
    quote: createGate()
  };
  const stalePostalCodeGates = {
    order: createGate(),
    quote: createGate()
  };
  const latestPostalTownGates = {
    order: createGate(),
    quote: createGate()
  };
  const stalePostalCodeResponsesSettled: Record<
    AdminAddressEditor,
    boolean
  > = {
    order: false,
    quote: false
  };
  const addressSearchRequests: Record<AdminAddressEditor, string[]> = {
    order: [],
    quote: []
  };
  const postalLookupRequests: Record<AdminAddressEditor, string[]> = {
    order: [],
    quote: []
  };

  await page.route(/\/api\/addresses\/search(?:\?.*)?$/u, async (route) => {
    const query = new URL(route.request().url()).searchParams.get('query') ?? '';
    const editor = activeEditor;
    if (editor) addressSearchRequests[editor].push(query);
    if (editor && query === REFINED_ADDRESS_QUERY.toLowerCase()) {
      await addressRefinementGates[editor].promise;
    }
    await fulfillLookup(
      route,
      query === FIRST_CHARACTER_QUERY.toLowerCase() ||
        query === REFINED_ADDRESS_QUERY.toLowerCase()
        ? [canonicalAddress]
        : []
    );
  });

  await page.route(
    /\/api\/addresses\/postal-lookup(?:\?.*)?$/u,
    async (route) => {
      const searchParams = new URL(route.request().url()).searchParams;
      const field = searchParams.get('field') ?? '';
      const query = searchParams.get('query') ?? '';
      const editor = activeEditor;
      if (editor) postalLookupRequests[editor].push(`${field}:${query}`);
      const isStaleCodeRace =
        field === 'postalCode' &&
        query === POSTAL_LOCATIONS.staleCodeLookup.postalCode;
      const isLatestTownRace =
        field === 'postalName' &&
        query === POSTAL_LOCATIONS.latestTownLookup.postalName;
      if (
        editor &&
        field === 'postalCode' &&
        query === POSTAL_LOCATIONS.codeLookup.postalCode
      ) {
        await postalCodeGates[editor].promise;
      }
      if (editor && isStaleCodeRace) {
        await stalePostalCodeGates[editor].promise;
      }
      if (editor && isLatestTownRace) {
        await latestPostalTownGates[editor].promise;
      }
      const results =
        field === 'postalCode' &&
        query === POSTAL_LOCATIONS.codeLookup.postalCode
          ? [POSTAL_LOCATIONS.codeLookup]
          : isStaleCodeRace
            ? [POSTAL_LOCATIONS.staleCodeLookup]
            : isLatestTownRace
              ? [POSTAL_LOCATIONS.latestTownLookup]
          : field === 'postalName' &&
              query === POSTAL_LOCATIONS.townLookup.postalName
            ? [POSTAL_LOCATIONS.townLookup]
            : [];
      try {
        await fulfillLookup(route, results);
      } catch (error) {
        if (!isStaleCodeRace && !isLatestTownRace) throw error;
      } finally {
        if (editor && isStaleCodeRace) {
          stalePostalCodeResponsesSettled[editor] = true;
        }
      }
    }
  );

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
    activeEditor = 'order';

    const orderAddress = page.getByTestId('admin-order-address-autocomplete');
    const orderPostalCode = page.getByTestId(
      'admin-order-postal-code-autocomplete'
    );
    const orderPostalTown = page.getByTestId(
      'admin-order-city-autocomplete'
    );
    await expect(orderAddress).toHaveAttribute('role', 'combobox');
    await expect(orderAddress).toHaveAttribute('aria-autocomplete', 'list');
    await expect(orderAddress).toHaveAttribute('autocomplete', 'off');
    await expect(orderAddress).toHaveValue(INITIAL_ADDRESS.addressLine1);
    await expect(orderPostalCode).toHaveAttribute('role', 'combobox');
    await expect(orderPostalTown).toHaveAttribute('role', 'combobox');

    await orderPostalTown.fill('');
    await orderPostalCode.fill(POSTAL_LOCATIONS.codeLookup.postalCode);
    await orderPostalCode.press('Tab');
    await expect(orderPostalTown).toBeFocused();
    await expect
      .poll(() => postalLookupRequests.order.join('|'))
      .toBe(`postalCode:${POSTAL_LOCATIONS.codeLookup.postalCode}`);
    await expect(orderPostalCode).toHaveAttribute('aria-busy', 'true');
    await expect(orderPostalTown).toHaveValue('');
    postalCodeGates.order.release();
    await expect(orderPostalTown).toHaveValue(
      POSTAL_LOCATIONS.codeLookup.postalName
    );
    await expect(orderPostalCode).toHaveAttribute('aria-busy', 'false');
    await page.waitForTimeout(150);
    expect(postalLookupRequests.order).toEqual([
      `postalCode:${POSTAL_LOCATIONS.codeLookup.postalCode}`
    ]);

    await orderPostalCode.fill('');
    await orderPostalTown.fill(POSTAL_LOCATIONS.townLookup.postalName);
    await expect
      .poll(() => postalLookupRequests.order.join('|'))
      .toBe(
        `postalCode:${POSTAL_LOCATIONS.codeLookup.postalCode}|` +
          `postalName:${POSTAL_LOCATIONS.townLookup.postalName}`
      );
    await expect(orderPostalCode).toHaveValue(
      POSTAL_LOCATIONS.townLookup.postalCode
    );
    await page.waitForTimeout(150);
    expect(postalLookupRequests.order).toEqual([
      `postalCode:${POSTAL_LOCATIONS.codeLookup.postalCode}`,
      `postalName:${POSTAL_LOCATIONS.townLookup.postalName}`
    ]);

    const orderRaceRequestStart = postalLookupRequests.order.length;
    await orderPostalTown.fill('');
    await orderPostalCode.fill(
      POSTAL_LOCATIONS.staleCodeLookup.postalCode
    );
    await expect
      .poll(() =>
        postalLookupRequests.order.slice(orderRaceRequestStart).join('|')
      )
      .toBe(`postalCode:${POSTAL_LOCATIONS.staleCodeLookup.postalCode}`);
    await orderPostalTown.fill(
      POSTAL_LOCATIONS.latestTownLookup.postalName
    );
    await expect
      .poll(() =>
        postalLookupRequests.order.slice(orderRaceRequestStart).join('|')
      )
      .toBe(
        `postalCode:${POSTAL_LOCATIONS.staleCodeLookup.postalCode}|` +
          `postalName:${POSTAL_LOCATIONS.latestTownLookup.postalName}`
      );
    stalePostalCodeGates.order.release();
    await expect
      .poll(() => stalePostalCodeResponsesSettled.order)
      .toBe(true);
    await page.waitForTimeout(100);
    await expect(orderPostalTown).toHaveValue(
      POSTAL_LOCATIONS.latestTownLookup.postalName
    );
    latestPostalTownGates.order.release();
    await expect(orderPostalCode).toHaveValue(
      POSTAL_LOCATIONS.latestTownLookup.postalCode
    );
    await expect(orderPostalTown).toHaveValue(
      POSTAL_LOCATIONS.latestTownLookup.postalName
    );
    await page.waitForTimeout(150);
    expect(
      postalLookupRequests.order.slice(orderRaceRequestStart)
    ).toEqual([
      `postalCode:${POSTAL_LOCATIONS.staleCodeLookup.postalCode}`,
      `postalName:${POSTAL_LOCATIONS.latestTownLookup.postalName}`
    ]);

    await orderAddress.fill('');
    await orderAddress.fill(FIRST_CHARACTER_QUERY);

    const orderSuggestions = page.getByRole('listbox', {
      name: 'Predlogi naslovov'
    });
    await expect(orderSuggestions).toBeVisible();
    const orderOptions = orderSuggestions.getByRole('option');
    await expect(orderOptions.first()).toBeVisible();
    expect(await orderOptions.count()).toBeLessThanOrEqual(8);
    await orderAddress.fill(REFINED_ADDRESS_QUERY);
    await expect
      .poll(() => addressSearchRequests.order.join('|'))
      .toBe(
        `${FIRST_CHARACTER_QUERY.toLowerCase()}|` +
          REFINED_ADDRESS_QUERY.toLowerCase()
      );
    await expect(orderAddress).toHaveAttribute('aria-busy', 'true');
    await expect(orderAddress).toHaveAttribute('aria-expanded', 'true');
    await expect(orderSuggestions).toBeVisible();
    await expect(orderOptions.first()).toContainText(
      canonicalAddress.addressLine1
    );
    addressRefinementGates.order.release();
    await expect(orderAddress).toHaveAttribute('aria-busy', 'false');
    await expect(orderSuggestions).toBeVisible();
    await expect(orderOptions.first()).toContainText(
      canonicalAddress.addressLine1
    );
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
    activeEditor = 'quote';

    const quoteAddress = page.getByTestId('admin-quote-address-autocomplete');
    const quotePostalCode = page.getByTestId(
      'admin-quote-postal-code-autocomplete'
    );
    const quotePostalTown = page.getByTestId(
      'admin-quote-city-autocomplete'
    );
    await expect(quoteAddress).toHaveAttribute('role', 'combobox');
    await expect(quoteAddress).toHaveAttribute('aria-autocomplete', 'list');
    await expect(quoteAddress).toHaveValue(INITIAL_ADDRESS.addressLine1);
    await expect(quotePostalCode).toHaveAttribute('role', 'combobox');
    await expect(quotePostalTown).toHaveAttribute('role', 'combobox');

    await quotePostalTown.fill('');
    await quotePostalCode.fill(POSTAL_LOCATIONS.codeLookup.postalCode);
    await quotePostalCode.press('Tab');
    await expect(quotePostalTown).toBeFocused();
    await expect
      .poll(() => postalLookupRequests.quote.join('|'))
      .toBe(`postalCode:${POSTAL_LOCATIONS.codeLookup.postalCode}`);
    await expect(quotePostalCode).toHaveAttribute('aria-busy', 'true');
    await expect(quotePostalTown).toHaveValue('');
    postalCodeGates.quote.release();
    await expect(quotePostalTown).toHaveValue(
      POSTAL_LOCATIONS.codeLookup.postalName
    );
    await expect(quotePostalCode).toHaveAttribute('aria-busy', 'false');
    await page.waitForTimeout(150);
    expect(postalLookupRequests.quote).toEqual([
      `postalCode:${POSTAL_LOCATIONS.codeLookup.postalCode}`
    ]);

    await quotePostalCode.fill('');
    await quotePostalTown.fill(POSTAL_LOCATIONS.townLookup.postalName);
    await expect
      .poll(() => postalLookupRequests.quote.join('|'))
      .toBe(
        `postalCode:${POSTAL_LOCATIONS.codeLookup.postalCode}|` +
          `postalName:${POSTAL_LOCATIONS.townLookup.postalName}`
      );
    await expect(quotePostalCode).toHaveValue(
      POSTAL_LOCATIONS.townLookup.postalCode
    );
    await page.waitForTimeout(150);
    expect(postalLookupRequests.quote).toEqual([
      `postalCode:${POSTAL_LOCATIONS.codeLookup.postalCode}`,
      `postalName:${POSTAL_LOCATIONS.townLookup.postalName}`
    ]);

    const quoteRaceRequestStart = postalLookupRequests.quote.length;
    await quotePostalTown.fill('');
    await quotePostalCode.fill(
      POSTAL_LOCATIONS.staleCodeLookup.postalCode
    );
    await expect
      .poll(() =>
        postalLookupRequests.quote.slice(quoteRaceRequestStart).join('|')
      )
      .toBe(`postalCode:${POSTAL_LOCATIONS.staleCodeLookup.postalCode}`);
    await quotePostalTown.fill(
      POSTAL_LOCATIONS.latestTownLookup.postalName
    );
    await expect
      .poll(() =>
        postalLookupRequests.quote.slice(quoteRaceRequestStart).join('|')
      )
      .toBe(
        `postalCode:${POSTAL_LOCATIONS.staleCodeLookup.postalCode}|` +
          `postalName:${POSTAL_LOCATIONS.latestTownLookup.postalName}`
      );
    stalePostalCodeGates.quote.release();
    await expect
      .poll(() => stalePostalCodeResponsesSettled.quote)
      .toBe(true);
    await page.waitForTimeout(100);
    await expect(quotePostalTown).toHaveValue(
      POSTAL_LOCATIONS.latestTownLookup.postalName
    );
    latestPostalTownGates.quote.release();
    await expect(quotePostalCode).toHaveValue(
      POSTAL_LOCATIONS.latestTownLookup.postalCode
    );
    await expect(quotePostalTown).toHaveValue(
      POSTAL_LOCATIONS.latestTownLookup.postalName
    );
    await page.waitForTimeout(150);
    expect(
      postalLookupRequests.quote.slice(quoteRaceRequestStart)
    ).toEqual([
      `postalCode:${POSTAL_LOCATIONS.staleCodeLookup.postalCode}`,
      `postalName:${POSTAL_LOCATIONS.latestTownLookup.postalName}`
    ]);

    await quoteAddress.fill('');
    await quoteAddress.fill(FIRST_CHARACTER_QUERY);
    const quoteSuggestions = page.getByRole('listbox', {
      name: 'Predlogi naslovov'
    });
    await expect(quoteSuggestions).toBeVisible();
    const quoteOptions = quoteSuggestions.getByRole('option');
    await expect(quoteOptions.first()).toBeVisible();
    await quoteAddress.fill(REFINED_ADDRESS_QUERY);
    await expect
      .poll(() => addressSearchRequests.quote.join('|'))
      .toBe(
        `${FIRST_CHARACTER_QUERY.toLowerCase()}|` +
          REFINED_ADDRESS_QUERY.toLowerCase()
      );
    await expect(quoteAddress).toHaveAttribute('aria-busy', 'true');
    await expect(quoteAddress).toHaveAttribute('aria-expanded', 'true');
    await expect(quoteSuggestions).toBeVisible();
    await expect(quoteOptions.first()).toContainText(
      canonicalAddress.addressLine1
    );
    addressRefinementGates.quote.release();
    await expect(quoteAddress).toHaveAttribute('aria-busy', 'false');
    await expect(quoteSuggestions).toBeVisible();
    await quoteOptions.first().click();

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
    addressRefinementGates.order.release();
    addressRefinementGates.quote.release();
    postalCodeGates.order.release();
    postalCodeGates.quote.release();
    stalePostalCodeGates.order.release();
    stalePostalCodeGates.quote.release();
    latestPostalTownGates.order.release();
    latestPostalTownGates.quote.release();
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
