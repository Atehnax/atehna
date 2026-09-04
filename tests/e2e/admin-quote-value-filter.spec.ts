import { randomUUID } from 'node:crypto';
import {
  expect,
  test,
  type APIRequestContext,
  type Browser
} from '@playwright/test';
import {
  E2E_BASE_URL,
  assertAuthenticatedAdmin
} from './support/auth';

const CATALOG_VARIANT_ID = 920001;

test.beforeEach(async ({ request }) => {
  await assertAuthenticatedAdmin(request);
});

const parseEuroAmount = (value: string) => {
  const normalized = value
    .replace(/\s/gu, '')
    .replace('€', '')
    .replace(',', '.');
  if (!/\d/u.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
};

async function requireOk(
  response: {
    ok(): boolean;
    status(): number;
    text(): Promise<string>;
  },
  label: string
) {
  if (response.ok()) return;
  throw new Error(
    `${label} failed with ${response.status()}: ${await response.text()}`
  );
}

async function createPricedQuoteFixture(browser: Browser) {
  const context = await browser.newContext({
    baseURL: E2E_BASE_URL,
    storageState: { cookies: [], origins: [] }
  });
  const token = randomUUID();
  const email = `quote-value-filter-${token}@example.com`;
  const networkSeed = token.replaceAll('-', '');
  const networkSubject = [
    '2001',
    'db8',
    ...Array.from({ length: 6 }, (_, index) =>
      networkSeed.slice(index * 4, (index + 1) * 4)
    )
  ].join(':');

  try {
    const estimateResponse = await context.request.post('/api/orders/estimate', {
      data: {
        customerName: 'E2E vrednost ponudbe',
        customerLabels: ['E2E vrednost ponudbe'],
        items: [{ variantId: CATALOG_VARIANT_ID, quantity: 1 }]
      }
    });
    await requireOk(estimateResponse, 'quote value-filter estimate');
    const estimate = await estimateResponse.json() as {
      quoteFingerprint: string;
      shippingConfigurationVersion: number;
    };

    const createResponse = await context.request.post('/api/quote-requests', {
      headers: {
        Origin: E2E_BASE_URL,
        'X-Forwarded-For': networkSubject,
        'Idempotency-Key': `quote-value-filter-${token}`
      },
      data: {
        customerType: 'individual',
        customerName: 'E2E vrednost ponudbe',
        organizationName: '',
        contactName: 'E2E vrednost ponudbe',
        email,
        addressLine1: 'Testna ulica 1',
        city: 'Ljubljana',
        postalCode: '1000',
        countryCode: 'SI',
        reference: `E2E-VALUE-${token.slice(0, 8)}`,
        quoteReason: 'formal_offer',
        quoteMessage: 'Samostojen E2E preizkus filtra vrednosti.',
        shippingConfigurationVersion: estimate.shippingConfigurationVersion,
        estimateFingerprint: estimate.quoteFingerprint,
        items: [{ variantId: CATALOG_VARIANT_ID, quantity: 1 }]
      }
    });
    await requireOk(createResponse, 'quote value-filter request');
    expect(createResponse.status()).toBe(201);
    return email;
  } finally {
    await context.close();
  }
}

async function removeQuoteFixture(
  request: APIRequestContext,
  quoteRequestId: number
) {
  const response = await request.delete(
    `/api/admin/quote-requests/${quoteRequestId}`,
    { data: { reason: 'Čiščenje E2E preizkusa filtra vrednosti.' } }
  );
  await requireOk(response, 'quote value-filter cleanup');
}

test('quote value range filters the server-backed list and survives reload', async ({
  browser,
  page,
  request
}) => {
  const fixtureEmail = await createPricedQuoteFixture(browser);
  let quoteRequestId: number | null = null;

  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(
      `/admin/orders?view=quotes&q=${encodeURIComponent(fixtureEmail)}`
    );
    await page.waitForLoadState('networkidle');

    const fixtureRow = page.locator('[data-testid^="quote-table-row-"]');
    await expect(fixtureRow).toHaveCount(1);
    const fixtureTestId = await fixtureRow.getAttribute('data-testid');
    const fixtureIdMatch = /^quote-table-row-(\d+)$/u.exec(fixtureTestId ?? '');
    const parsedQuoteRequestId = Number(fixtureIdMatch?.[1]);
    expect(
      Number.isSafeInteger(parsedQuoteRequestId) && parsedQuoteRequestId > 0
    ).toBe(true);
    quoteRequestId = parsedQuoteRequestId;

    await page.goto('/admin/orders?view=quotes');
    await page.waitForLoadState('networkidle');

    const filterButton = page.getByRole('button', {
      name: 'Filtriraj Skupaj'
    });
    await expect(filterButton).toBeVisible();

    const headings = (await page.locator('thead th').allTextContents()).map(
      (heading) => heading.trim()
    );
    const valueColumnIndex = headings.indexOf('Skupaj');
    expect(valueColumnIndex).toBeGreaterThan(0);

    const valueCells = () =>
      page.locator(`tbody tr td:nth-child(${valueColumnIndex + 1})`);
    const baselineRowCount = await valueCells().count();
    expect(baselineRowCount).toBeGreaterThan(0);
    const fixtureAmountText = await page
      .getByTestId(`quote-table-row-${parsedQuoteRequestId}`)
      .locator(`td:nth-child(${valueColumnIndex + 1})`)
      .innerText();
    const targetAmount = parseEuroAmount(fixtureAmountText);
    expect(targetAmount).not.toBeNull();
    if (targetAmount === null) {
      throw new Error('The priced quote fixture has no displayed amount.');
    }

    await filterButton.click();
    await page.getByLabel('Od', { exact: true }).fill(String(targetAmount));
    await page.getByLabel('Do', { exact: true }).fill(String(targetAmount));
    await page.getByRole('button', { name: 'Potrdi', exact: true }).click();

    await expect(page).toHaveURL(
      new RegExp(
        `quoteMinTotal=${encodeURIComponent(String(targetAmount))}.*quoteMaxTotal=${encodeURIComponent(String(targetAmount))}`,
        'u'
      )
    );
    await page.waitForLoadState('networkidle');

    const clearFilter = page.getByRole('button', {
      name: /Odstrani filter Skupaj/u
    });
    await expect(clearFilter).toBeVisible();
    const filteredValues = await valueCells().allTextContents();
    const filteredAmounts = filteredValues
      .map(parseEuroAmount)
      .filter((amount): amount is number => amount !== null);
    expect(filteredAmounts.length).toBeGreaterThan(0);
    expect(filteredAmounts).toHaveLength(filteredValues.length);
    expect(filteredAmounts.every((amount) => amount === targetAmount)).toBe(true);

    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(clearFilter).toBeVisible();

    await clearFilter.click();
    await expect(page).not.toHaveURL(/quote(?:Min|Max)Total=/u);
    await page.waitForLoadState('networkidle');
    await expect(valueCells()).toHaveCount(baselineRowCount);
  } finally {
    if (quoteRequestId !== null) {
      await removeQuoteFixture(request, quoteRequestId);
    }
  }
});
