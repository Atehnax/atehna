import {
  expect,
  request as playwrightRequest,
  test,
  type Page,
  type Route
} from '@playwright/test';
import { E2E_BASE_URL } from './support/auth';

const CART_STORAGE_KEY = 'atehna-cart-v3';

type SubmissionHandoffSnapshot = {
  textContent: string;
  role: string | null;
  ariaLive: string | null;
  ariaAtomic: string | null;
  ariaBusy: string | null;
  hasSpinner: boolean;
};

function createGate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

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
  quoteFingerprint: `order-quote-v1:${'2'.repeat(64)}`,
  shippingConfigurationVersion: 1,
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
    shipping: 3,
    gross: 15.2,
    currency: 'EUR'
  },
  shipping: {
    status: 'calculated',
    source: 'automatic',
    calculationVersion: 'shipping-v2',
    configurationVersion: 1,
    items: [
      {
        productId: '420',
        variantId: '42001',
        sku: 'GURS-ADDRESS-001',
        name: 'Preizkusni artikel',
        quantity: 1,
        weightGrams: 1_000,
        lengthMm: 100,
        widthMm: 100,
        heightMm: 10
      }
    ],
    combinedWeightGrams: 1_000,
    largestDimensionMm: 100,
    triggeringItem: null,
    basePriceCents: 300,
    surchargeAmountCents: 0,
    automaticAmountCents: 300,
    finalAmountCents: 300,
    matchedWeightBand: {
      id: 'under-5000',
      name: 'Do 5 kg',
      minWeightGrams: 1,
      maxWeightGrams: 4_999,
      priceCents: 300,
      enabled: true,
      position: 0
    },
    matchedDimensionalRule: null,
    manualOverride: null
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
  await page.route('**/api/orders/estimate', async (route) => {
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
        version: 0
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

  test('returns canonical matches for an eligible query from the local index', async () => {
    const anonymousRequest = await playwrightRequest.newContext({
      baseURL: E2E_BASE_URL,
      storageState: { cookies: [], origins: [] }
    });
    try {
      const response = await anonymousRequest.get('/api/addresses/search', {
        params: { query: 'Cankarjeva ulica 27a' }
      });

      expect(response.status()).toBe(200);
      const payload = (await response.json()) as {
        results: Array<typeof cankarjeva>;
        sourceUpdatedAt: string | null;
      };
      expect(payload.results.length).toBeGreaterThan(0);
      const canonicalResult = payload.results.find(
        (result) => result.addressLine1 === cankarjeva.addressLine1
      );
      expect(canonicalResult).toBeTruthy();
      expect(canonicalResult?.postalCode).toMatch(/^\d{4}$/u);
      expect(canonicalResult?.postalName).not.toHaveLength(0);
      expect(canonicalResult?.gursHouseNumberId).toMatch(/^\d+$/u);
      expect(payload.sourceUpdatedAt).not.toBeNull();
      expect(Number.isNaN(Date.parse(payload.sourceUpdatedAt ?? ''))).toBe(false);
      expect(response.headers()['cache-control']).toBe(
        'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400'
      );
    } finally {
      await anonymousRequest.dispose();
    }
  });
});

test.describe('checkout GURS address autocomplete', () => {
  test.beforeEach(async ({ page }) => {
    await seedCheckout(page);
  });

  test('starts promptly after three characters and supports accessible keyboard selection', async ({
    page
  }) => {
    const requestedQueries: string[] = [];
    let submittedBody: Record<string, unknown> | null = null;
    await page.route(/\/api\/addresses\/search(?:\?.*)?$/, async (route) => {
      const url = new URL(route.request().url());
      requestedQueries.push(url.searchParams.get('query') ?? '');
      await fulfillAddressSearch(route);
    });
    await page.route('**/api/orders', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      submittedBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Test-only response.' })
      });
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
    await expect
      .poll(() => requestedQueries, {
        timeout: 500,
        intervals: [10, 20, 50]
      })
      .toEqual(['can']);

    const listbox = page.getByRole('listbox');
    await expect(listbox).toBeVisible({ timeout: 500 });
    await expect(address).toHaveAttribute('aria-expanded', 'true');
    const controlsId = await address.getAttribute('aria-controls');
    expect(controlsId, 'the combobox should identify its suggestion list').toBeTruthy();
    await expect(listbox).toHaveAttribute('id', controlsId!);

    const options = listbox.getByRole('option');
    await expect(options).toHaveCount(2);
    await expect(options.first()).toContainText('Cankarjeva ulica 27a');
    await expect(options.first()).toContainText('6000 Koper - Capodistria');
    await expect(
      page.getByText(/Vir: Geodetska uprava Republike Slovenije/u)
    ).toHaveCount(0);

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
    await page.getByLabel('Naziv naročnika *', { exact: true }).fill('Primer d.o.o.');
    await page.getByLabel('Kontaktna oseba *', { exact: true }).fill('Ana Novak');
    await page
      .getByTestId('order-summary-column')
      .getByRole('button', { name: 'Pošlji naročilo v potrditev' })
      .click();

    await expect.poll(() => submittedBody).not.toBeNull();
    const capturedBody = submittedBody as Record<string, unknown> | null;
    expect(capturedBody).toMatchObject({
      addressLine1: cankarjeva.addressLine1,
      addressLine2: '2. nadstropje, vhod B',
      city: cankarjeva.postalName,
      postalCode: cankarjeva.postalCode,
      gursHouseNumberId: cankarjeva.gursHouseNumberId,
      countryCode: 'SI'
    });
    expect(capturedBody).not.toHaveProperty('deliveryAddress');
    await expect(page.getByTestId('order-page').getByRole('alert')).toContainText('Test-only response.');
    await expect(page.getByTestId('order-submission-handoff')).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: 'Košarica je prazna' })
    ).toHaveCount(0);
    await expect(
      page.getByTestId('order-summary-column')
    ).toContainText('Preizkusni artikel');
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
    const postalTown = page.getByLabel('Poštni kraj *', { exact: true });
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
    await expect(address).toHaveValue(cankarjeva.addressLine1);
    await expect(postalCode).toHaveValue(cankarjeva.postalCode);
    await expect(postalTown).toHaveValue(cankarjeva.postalName);
    await expect(gursId).toHaveValue('9223372036854775808');
    await postalCode.fill('6001');
    await expect(gursId).toHaveValue('');
  });

  test('keeps manual entry submit-capable when address search fails', async ({
    page
  }) => {
    const accessId = '123e4567-e89b-42d3-a456-426614174021';
    const orderResponseGate = createGate();
    const confirmationNavigationGate = createGate();
    const confirmationApiGate = createGate();
    let confirmationNavigationUrl: string | null = null;
    let confirmationApiStarted = false;

    await page.route('**/order/confirmation', async (route) => {
      confirmationNavigationUrl = route.request().url();
      await confirmationNavigationGate.promise;
      await route.continue();
    });
    await page.route('**/api/orders/confirmation', async (route) => {
      confirmationApiStarted = true;
      await confirmationApiGate.promise;
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Test-only confirmation response.' })
      });
    });
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
      await orderResponseGate.promise;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ accessId })
      });
    });

    await enableCheckout(page);

    const address = page.getByRole('combobox', {
      name: 'Ulica ali naselje in hišna številka',
      exact: true
    });
    await page.getByLabel('Naziv naročnika *', { exact: true }).fill('Primer d.o.o.');
    await page
      .getByLabel('Kontaktna oseba *', { exact: true })
      .fill('Ana Novak');
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
      .getByRole('button', { name: 'Pošlji naročilo v potrditev' })
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
    expect(capturedBody).not.toHaveProperty('deliveryAddress');

    const submissionHandoff = page.getByTestId('order-submission-handoff');
    await expect(submissionHandoff).toBeVisible();
    await expect(submissionHandoff).toHaveAttribute('role', 'status');
    await expect(submissionHandoff).toHaveAttribute('aria-live', 'polite');
    await expect(submissionHandoff).toHaveAttribute('aria-atomic', 'true');
    await expect(submissionHandoff).toHaveAttribute('aria-busy', 'true');
    await expect(page.getByTestId('order-submission-spinner')).toBeVisible();
    await expect(
      submissionHandoff.getByRole('heading', { name: 'Oddajamo naročilo' })
    ).toBeVisible();
    await expect(submissionHandoff).toContainText('ne zapirajte strani');
    await expect(
      page.getByRole('heading', { name: 'Košarica je prazna' })
    ).toHaveCount(0);

    let openingHandoffSnapshot: SubmissionHandoffSnapshot | null = null;
    const readOpeningHandoffSnapshot = (): SubmissionHandoffSnapshot | null =>
      openingHandoffSnapshot;
    await page.exposeFunction(
      '__atehnaCaptureOrderSubmissionHandoff',
      (snapshot: SubmissionHandoffSnapshot) => {
        openingHandoffSnapshot = snapshot;
      }
    );
    await page.evaluate(() => {
      const reportOpeningHandoff = () => {
        const handoff = document.querySelector<HTMLElement>(
          '[data-testid="order-submission-handoff"]'
        );
        const textContent = handoff?.textContent ?? '';
        if (
          !handoff
          || !textContent.includes('Odpiramo potrditev naročila')
          || !textContent.includes('Naročilo je oddano.')
        ) {
          return false;
        }

        const report = (
          window as typeof window & {
            __atehnaCaptureOrderSubmissionHandoff: (
              snapshot: SubmissionHandoffSnapshot
            ) => Promise<void>;
          }
        ).__atehnaCaptureOrderSubmissionHandoff;
        void report({
          textContent,
          role: handoff.getAttribute('role'),
          ariaLive: handoff.getAttribute('aria-live'),
          ariaAtomic: handoff.getAttribute('aria-atomic'),
          ariaBusy: handoff.getAttribute('aria-busy'),
          hasSpinner: Boolean(
            handoff.querySelector('[data-testid="order-submission-spinner"]')
          )
        });
        return true;
      };

      const observer = new MutationObserver(() => {
        if (reportOpeningHandoff()) observer.disconnect();
      });
      observer.observe(document.body, {
        attributes: true,
        characterData: true,
        childList: true,
        subtree: true
      });
      if (reportOpeningHandoff()) observer.disconnect();
    });

    orderResponseGate.release();
    await expect.poll(readOpeningHandoffSnapshot).toMatchObject({
      role: 'status',
      ariaLive: 'polite',
      ariaAtomic: 'true',
      ariaBusy: 'true',
      hasSpinner: true
    });
    expect(readOpeningHandoffSnapshot()?.textContent).toMatch(
      /Odpiramo potrditev naročila[\s\S]*Naročilo je oddano\./u
    );
    await expect.poll(() => confirmationNavigationUrl).not.toBeNull();
    const navigationUrl = new URL(confirmationNavigationUrl!);
    expect(navigationUrl.pathname).toBe('/order/confirmation');
    expect(navigationUrl.search).toBe('');

    confirmationNavigationGate.release();
    await expect(page).toHaveURL(/\/order\/confirmation$/u);
    const destinationLoader = page.getByTestId('order-confirmation-loading');
    await expect(destinationLoader).toBeVisible();
    await expect(destinationLoader).toHaveAttribute('role', 'status');
    await expect(destinationLoader).toHaveAttribute('aria-busy', 'true');
    await expect(destinationLoader).toContainText(
      'Nalagamo potrditev naročila'
    );
    await expect(
      page.getByRole('heading', { name: 'Košarica je prazna' })
    ).toHaveCount(0);
    await expect.poll(() => confirmationApiStarted).toBe(true);
    confirmationApiGate.release();
  });
});

type PostalLocation = {
  postalCode: string;
  postalName: string;
};

const ljubljana = {
  postalCode: '1000',
  postalName: 'Ljubljana'
} as const satisfies PostalLocation;

const crnomelj = {
  postalCode: '8340',
  postalName: 'Črnomelj'
} as const satisfies PostalLocation;

async function fulfillPostalLookup(
  route: Route,
  results: readonly PostalLocation[]
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

test.describe('checkout postal code and postal-town completion', () => {
  test.beforeEach(async ({ page }) => {
    await seedCheckout(page);
  });

  test('places postal code first and completes the town with one debounced lookup', async ({
    page
  }) => {
    const requestedLookups: string[] = [];
    await page.route(/\/api\/addresses\/search(?:\?.*)?$/, (route) =>
      fulfillAddressSearch(route)
    );
    await page.route(/\/api\/addresses\/postal-lookup(?:\?.*)?$/, async (route) => {
      const url = new URL(route.request().url());
      const field = url.searchParams.get('field') ?? '';
      const query = url.searchParams.get('query') ?? '';
      requestedLookups.push(`${field}:${query}`);
      await fulfillPostalLookup(
        route,
        field === 'postalCode' && query === ljubljana.postalCode
          ? [ljubljana]
          : []
      );
    });

    await enableCheckout(page);

    const address = page.getByRole('combobox', {
      name: 'Ulica ali naselje in hišna številka',
      exact: true
    });
    const postalCode = page.getByRole('combobox', {
      name: 'Poštna številka *',
      exact: true
    });
    const postalTown = page.getByRole('combobox', {
      name: 'Poštni kraj *',
      exact: true
    });
    const gursId = page.locator('input[type="hidden"][name="gursHouseNumberId"]');

    expect(
      await page.locator('#postalCode, #city').evaluateAll((fields) =>
        fields.map((field) => field.id)
      )
    ).toEqual(['postalCode', 'city']);
    const [postalCodeBox, postalTownBox] = await Promise.all([
      postalCode.boundingBox(),
      postalTown.boundingBox()
    ]);
    expect(postalCodeBox).not.toBeNull();
    expect(postalTownBox).not.toBeNull();
    expect(postalCodeBox!.x).toBeLessThan(postalTownBox!.x);
    expect(postalTownBox!.width).toBeGreaterThan(postalCodeBox!.width);

    await address.fill('Cankar');
    await expect(page.getByRole('listbox', { name: 'Predlogi naslovov' })).toBeVisible();
    await page.getByRole('option').first().click();
    await expect(gursId).toHaveValue(cankarjeva.gursHouseNumberId);
    expect(requestedLookups).toEqual([]);

    await postalCode.fill('1');
    await expect(gursId).toHaveValue('');
    await page.waitForTimeout(350);
    expect(requestedLookups).toEqual([]);

    await postalCode.fill('10');
    await page.waitForTimeout(80);
    await postalCode.fill('100');
    await page.waitForTimeout(80);
    await postalCode.fill('1000');
    expect(
      requestedLookups,
      'postal lookups should be debounced rather than sent for each edit'
    ).toEqual([]);
    await expect.poll(() => requestedLookups).toEqual(['postalCode:1000']);
    await expect(postalTown).toHaveValue(ljubljana.postalName);
    await page.waitForTimeout(350);
    expect(
      requestedLookups,
      'programmatic town completion must not start a reverse lookup loop'
    ).toEqual(['postalCode:1000']);
  });

  test('matches a postal town without diacritics and completes its code', async ({
    page
  }) => {
    const requestedLookups: string[] = [];
    await page.route(/\/api\/addresses\/postal-lookup(?:\?.*)?$/, async (route) => {
      const url = new URL(route.request().url());
      const field = url.searchParams.get('field') ?? '';
      const query = url.searchParams.get('query') ?? '';
      requestedLookups.push(`${field}:${query}`);
      await fulfillPostalLookup(
        route,
        field === 'postalName' && query === 'Crnomelj' ? [crnomelj] : []
      );
    });

    await enableCheckout(page);
    const postalCode = page.getByRole('combobox', {
      name: 'Poštna številka *',
      exact: true
    });
    const postalTown = page.getByRole('combobox', {
      name: 'Poštni kraj *',
      exact: true
    });

    await postalTown.fill('C');
    await page.waitForTimeout(350);
    expect(requestedLookups).toEqual([]);
    await postalTown.fill('Cr');
    await page.waitForTimeout(80);
    await postalTown.fill('Crnomelj');
    await expect.poll(() => requestedLookups).toEqual([
      'postalName:Crnomelj'
    ]);
    await expect(postalCode).toHaveValue(crnomelj.postalCode);
    await page.waitForTimeout(350);
    expect(
      requestedLookups,
      'programmatic code completion must not start a reverse lookup loop'
    ).toEqual(['postalName:Crnomelj']);
  });

  test('requires a choice for ambiguous towns and preserves manual values on no match', async ({
    page
  }) => {
    const requestedLookups: string[] = [];
    const ambiguousNovaVas = [
      { postalCode: '1385', postalName: 'Nova vas' },
      { postalCode: '8273', postalName: 'Nova vas' }
    ] as const satisfies readonly PostalLocation[];
    await page.route(/\/api\/addresses\/postal-lookup(?:\?.*)?$/, async (route) => {
      const url = new URL(route.request().url());
      const field = url.searchParams.get('field') ?? '';
      const query = url.searchParams.get('query') ?? '';
      requestedLookups.push(`${field}:${query}`);
      await fulfillPostalLookup(
        route,
        field === 'postalName' && query === 'Nova vas'
          ? ambiguousNovaVas
          : []
      );
    });

    await enableCheckout(page);
    const postalCode = page.getByRole('combobox', {
      name: 'Poštna številka *',
      exact: true
    });
    const postalTown = page.getByRole('combobox', {
      name: 'Poštni kraj *',
      exact: true
    });

    await postalCode.fill('1234');
    await expect.poll(() => requestedLookups).toContain('postalCode:1234');
    await expect(postalTown).toHaveValue('');

    await postalTown.fill('Nova vas');
    await expect.poll(() => requestedLookups).toContain('postalName:Nova vas');
    await expect(postalCode).toHaveValue('1234');
    const townListboxId = await postalTown.getAttribute('aria-controls');
    expect(townListboxId).toBeTruthy();
    const townListbox = page.locator(`[id="${townListboxId}"]`);
    await expect(townListbox).toBeVisible();
    await expect(townListbox.getByRole('option')).toHaveCount(2);
    await townListbox.getByRole('option').filter({ hasText: '1385' }).click();
    await expect(postalCode).toHaveValue('1385');

    await postalTown.fill('Ročno vnesen kraj');
    await expect.poll(() => requestedLookups).toContain(
      'postalName:Ročno vnesen kraj'
    );
    const townDescriptionIds = (
      (await postalTown.getAttribute('aria-describedby')) ?? ''
    ).split(/\s+/u);
    const townStatusId = townDescriptionIds.find(Boolean);
    expect(townStatusId).toBeTruthy();
    await expect(page.locator(`[id="${townStatusId}"]`)).toContainText(
      'Poštne podatke lahko vnesete tudi ročno.'
    );
    await expect(townListbox).toBeHidden();
    await expect(postalTown).toHaveValue('Ročno vnesen kraj');
    await expect(
      postalCode,
      'a no-match response must not erase the customer\'s manual counterpart value'
    ).toHaveValue('1385');
  });

  test('ignores an older postal response after a newer value has resolved', async ({
    page
  }) => {
    const firstRequestGate = createGate();
    let firstRequestStarted = false;
    const requestedLookups: string[] = [];
    await page.route(/\/api\/addresses\/postal-lookup(?:\?.*)?$/, async (route) => {
      const url = new URL(route.request().url());
      const query = url.searchParams.get('query') ?? '';
      requestedLookups.push(query);
      if (query === '10') {
        firstRequestStarted = true;
        await firstRequestGate.promise;
        try {
          await fulfillPostalLookup(route, [
            { postalCode: '2000', postalName: 'Maribor' }
          ]);
        } catch {
          // The browser may close an aborted mocked request before fulfillment.
        }
        return;
      }
      await fulfillPostalLookup(
        route,
        query === ljubljana.postalCode ? [ljubljana] : []
      );
    });

    await enableCheckout(page);
    const postalCode = page.getByRole('combobox', {
      name: 'Poštna številka *',
      exact: true
    });
    const postalTown = page.getByRole('combobox', {
      name: 'Poštni kraj *',
      exact: true
    });

    await postalCode.fill('10');
    await expect.poll(() => firstRequestStarted).toBe(true);
    await postalCode.fill(ljubljana.postalCode);
    await expect(postalTown).toHaveValue(ljubljana.postalName);
    firstRequestGate.release();
    await page.waitForTimeout(350);
    await expect(postalTown).toHaveValue(ljubljana.postalName);
    expect(requestedLookups).toEqual(['10', '1000']);
  });
});
