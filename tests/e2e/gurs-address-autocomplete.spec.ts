import {
  expect,
  request as playwrightRequest,
  test,
  type Page,
  type Route
} from '@playwright/test';
import { E2E_BASE_URL } from './support/auth';

const CART_STORAGE_KEY = 'atehna-cart';

const cartItem = {
  lineId: 'gurs-address-product::42001::',
  sku: 'GURS-ADDRESS-001',
  name: 'Preizkusni artikel',
  productId: 'gurs-address-product',
  productSlug: 'preizkusni-artikel',
  productHref: '/products/preizkus/items/preizkusni-artikel',
  imageUrl: null,
  imageAlt: 'Preizkusni artikel',
  variant: {
    id: 42001,
    name: 'Standardna različica',
    sku: 'GURS-ADDRESS-001',
    options: []
  },
  unit: 'kos',
  unitPrice: 10,
  pricing: {
    currency: 'EUR',
    taxRate: 0.22,
    baseUnitNet: 10,
    discountPct: 0,
    unitNet: 10,
    estimatedUnitGross: 12.2,
    quotedUnitGross: 12.2
  },
  quantity: 1,
  reconciliation: {
    status: 'valid'
  }
} as const;

const quote = {
  items: [
    {
      variantId: 42001,
      productId: 420,
      productSlug: 'preizkusni-artikel',
      productName: 'Preizkusni artikel',
      variantName: 'Standardna različica',
      sku: 'GURS-ADDRESS-001',
      unit: 'kos',
      quantity: 1,
      minOrder: 1,
      availableStock: 25,
      imageUrl: null,
      attributes: {},
      baseUnitNet: 10,
      discountPct: 0,
      unitNet: 10,
      lineNet: 10,
      lineTax: 2.2,
      lineGross: 12.2,
      taxRate: 0.22
    }
  ],
  totals: {
    net: 10,
    tax: 2.2,
    shipping: 0,
    gross: 12.2,
    currency: 'EUR'
  }
} as const;

const cankarjeva = {
  gursHouseNumberId: '9223372036854775808',
  addressLine1: 'Cankarjeva ulica 27a',
  postalCode: '6000',
  postalName: 'Koper - Capodistria',
  settlementName: 'Koper',
  municipalityName: 'Mestna občina Koper'
} as const;

const cankarjevaAlternate = {
  gursHouseNumberId: '9223372036854775809',
  addressLine1: 'Cankarjeva ulica 29',
  postalCode: '6000',
  postalName: 'Koper - Capodistria',
  settlementName: 'Koper',
  municipalityName: 'Mestna občina Koper'
} as const;

async function seedCheckout(page: Page) {
  await page.route('**/api/orders/quote', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(quote)
    });
  });

  await page.addInitScript(
    ({ storageKey, persistedCart }) => {
      window.localStorage.setItem(storageKey, persistedCart);
      window.sessionStorage.removeItem('atehna-order-form-v3');
    },
    {
      storageKey: CART_STORAGE_KEY,
      persistedCart: JSON.stringify({
        state: { items: [cartItem] },
        version: 2
      })
    }
  );
}

async function enableCheckout(page: Page) {
  await page.goto('/order');
  await expect(page.getByTestId('order-form-column')).toBeVisible({
    timeout: 15_000
  });
  await page.getByRole('radio', { name: 'Šola / javni zavod' }).click();
  await page
    .getByLabel('E-poštni naslov *', { exact: true })
    .fill('kupec@example.com');
}

async function fulfillAddressSearch(
  route: Route,
  results = [cankarjeva, cankarjevaAlternate]
) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: {
      'Cache-Control': 'private, max-age=60'
    },
    body: JSON.stringify({
      results,
      sourceUpdatedAt: '2026-07-01T00:00:00.000Z'
    })
  });
}

test.describe('GURS address search endpoint', () => {
  test('returns no matches for fewer than three normalized characters', async () => {
    const anonymousRequest = await playwrightRequest.newContext({
      baseURL: E2E_BASE_URL,
      storageState: { cookies: [], origins: [] }
    });
    try {
      const response = await anonymousRequest.get('/api/addresses/search', {
        params: { query: ' ž! ' }
      });

      expect(response.status()).toBe(200);
      const payload = (await response.json()) as {
        results: unknown[];
        sourceUpdatedAt: string | null;
      };
      expect(payload.results).toEqual([]);
      expect(payload).toHaveProperty('sourceUpdatedAt');
    } finally {
      await anonymousRequest.dispose();
    }
  });
});

test.describe('checkout GURS address autocomplete', () => {
  test.beforeEach(async ({ page }) => {
    await seedCheckout(page);
  });

  test('waits for three characters and supports accessible keyboard selection', async ({
    page
  }) => {
    const requestedQueries: string[] = [];
    await page.route(/\/api\/addresses\/search(?:\?.*)?$/, async (route) => {
      const url = new URL(route.request().url());
      requestedQueries.push(url.searchParams.get('query') ?? '');
      await fulfillAddressSearch(route);
    });

    await enableCheckout(page);

    const address = page.getByRole('combobox', {
      name: 'Ulica ali naselje in hišna številka',
      exact: true
    });
    const postalCode = page.getByLabel('Poštna številka *', { exact: true });
    const postalTown = page.getByLabel('Poštni kraj *', { exact: true });
    const gursId = page.locator('input[type="hidden"][name="gursHouseNumberId"]');

    await expect(address).toHaveAttribute('aria-autocomplete', 'list');
    await expect(address).toHaveAttribute('autocomplete', 'off');
    await expect(address).toHaveAttribute('aria-expanded', 'false');
    await expect(gursId).toHaveValue('');

    await address.fill('ca');
    await page.waitForTimeout(350);
    expect(requestedQueries).toEqual([]);

    await address.fill('can');
    await page.waitForTimeout(100);
    expect(
      requestedQueries,
      'the request should be debounced rather than sent on every keystroke'
    ).toEqual([]);
    await expect.poll(() => requestedQueries).toEqual(['can']);

    const listbox = page.getByRole('listbox');
    await expect(listbox).toBeVisible();
    await expect(address).toHaveAttribute('aria-expanded', 'true');
    const controlsId = await address.getAttribute('aria-controls');
    expect(controlsId, 'the combobox should identify its suggestion list').toBeTruthy();
    await expect(listbox).toHaveAttribute('id', controlsId!);

    const options = listbox.getByRole('option');
    await expect(options).toHaveCount(2);
    await expect(options.first()).toContainText('Cankarjeva ulica 27a');
    await expect(options.first()).toContainText('6000 Koper - Capodistria');
    await expect(
      page.getByText(
        /Vir: Geodetska uprava Republike Slovenije, Register naslovov, stanje 1\. 7\. 2026\./
      )
    ).toBeVisible();

    await address.press('ArrowDown');
    const activeOptionId = await address.getAttribute('aria-activedescendant');
    expect(activeOptionId, 'ArrowDown should expose the active option').toBeTruthy();
    await expect(options.first()).toHaveAttribute('id', activeOptionId!);
    await expect(options.first()).toHaveAttribute('aria-selected', 'true');
    await address.press('Enter');

    await expect(address).toHaveValue('Cankarjeva ulica 27a');
    await expect(postalCode).toHaveValue('6000');
    await expect(postalTown).toHaveValue('Koper - Capodistria');
    await expect(postalTown).not.toHaveValue('Mestna občina Koper');
    await expect(gursId).toHaveValue('9223372036854775808');
    await expect(listbox).toBeHidden();

    const apartmentDetails = page.getByLabel(
      'Stanovanje, nadstropje, vhod ali navodila za dostavo (neobvezno)',
      { exact: true }
    );
    await expect(apartmentDetails).toBeVisible();
    await apartmentDetails.fill('2. nadstropje, vhod B');
  });

  test('does not select on blur and clears the official ID after edits', async ({
    page
  }) => {
    await page.route(/\/api\/addresses\/search(?:\?.*)?$/, (route) =>
      fulfillAddressSearch(route)
    );
    await enableCheckout(page);

    const address = page.getByRole('combobox', {
      name: 'Ulica ali naselje in hišna številka',
      exact: true
    });
    const postalCode = page.getByLabel('Poštna številka *', { exact: true });
    const gursId = page.locator('input[type="hidden"][name="gursHouseNumberId"]');

    await address.fill('Cankar');
    await expect(page.getByRole('listbox')).toBeVisible();
    await page.getByLabel('Naziv naročnika *', { exact: true }).focus();
    await expect(address).toHaveValue('Cankar');
    await expect(gursId).toHaveValue('');

    await address.focus();
    await expect(page.getByRole('listbox')).toBeVisible();
    await address.press('ArrowDown');
    await address.press('Enter');
    await expect(gursId).toHaveValue('9223372036854775808');

    await address.fill('Cankarjeva ulica 27b');
    await expect(gursId).toHaveValue('');

    await address.fill('Cankar');
    await expect(page.getByRole('listbox')).toBeVisible();
    await page.getByRole('option').first().click();
    await expect(gursId).toHaveValue('9223372036854775808');
    await postalCode.fill('6001');
    await expect(gursId).toHaveValue('');
  });

  test('keeps manual entry submit-capable when address search fails', async ({
    page
  }) => {
    await page.route(/\/api\/addresses\/search(?:\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Address search unavailable' })
      });
    });

    let submittedBody: Record<string, unknown> | null = null;
    await page.route('**/api/orders', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      submittedBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          orderId: 123,
          confirmationToken: 'manual-address-token',
          confirmationUrl: '/order/confirmation?token=manual-address-token'
        })
      });
    });

    await enableCheckout(page);

    const address = page.getByRole('combobox', {
      name: 'Ulica ali naselje in hišna številka',
      exact: true
    });
    await page.getByLabel('Naziv naročnika *', { exact: true }).fill('Primer d.o.o.');
    await address.fill('Moj ročno vnesen naslov 7');
    await page.waitForTimeout(400);
    await expect(address).toBeEditable();
    await expect(page.getByRole('listbox')).toBeHidden();
    await page.getByLabel('Poštni kraj *', { exact: true }).fill('Ljubljana');
    await page.getByLabel('Poštna številka *', { exact: true }).fill('1000');
    await page
      .getByLabel(
        'Stanovanje, nadstropje, vhod ali navodila za dostavo (neobvezno)',
        { exact: true }
      )
      .fill('Pozvonite pri Novak');
    await expect(
      page.locator('input[type="hidden"][name="gursHouseNumberId"]')
    ).toHaveValue('');

    await page
      .getByTestId('order-summary-column')
      .getByRole('button', { name: 'Oddaj naročilo' })
      .click();

    await expect.poll(() => submittedBody).not.toBeNull();
    const capturedBody = submittedBody as Record<string, unknown> | null;
    expect(capturedBody).toMatchObject({
      addressLine1: 'Moj ročno vnesen naslov 7',
      city: 'Ljubljana',
      postalCode: '1000',
      addressLine2: 'Pozvonite pri Novak'
    });
    expect(capturedBody?.gursHouseNumberId ?? '').toBe('');
  });
});
