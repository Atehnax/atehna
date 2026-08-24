import { expect, test, type Page } from '@playwright/test';
import type { OrderConfirmationSnapshot } from '@/commercial/order/contracts';

const FRAGMENT_BOOTSTRAP_TOKEN = `ath_order_${'B'.repeat(43)}`;
const REJECTED_QUERY_TOKEN = `ath_order_${'C'.repeat(43)}`;
const ACCESS_ID = '123e4567-e89b-42d3-a456-426614174001';
const ACCESS_COOKIE_NAME = `ath_order_access_${ACCESS_ID.replaceAll('-', '')}`;

const confirmationSnapshot = {
  createdAt: '2026-08-17T08:57:00.000Z',
  commitmentStatus: 'binding',
  customer: {
    customerType: 'individual',
    customerName: 'Maja Primer',
    contactName: 'Maja Primer',
    email: 'maja@example.com',
    addressLine1: 'Cankarjeva ulica 27b',
    postalCode: '1000',
    city: 'Ljubljana'
  },
  items: [],
  totals: {
    net: 19.8,
    tax: 4.36,
    shipping: 0,
    gross: 24.16,
    currency: 'EUR'
  },
  documents: [
    {
      type: 'order_summary',
      url: '/api/orders/documents/123e4567-e89b-42d3-a456-426614174011'
    }
  ]
} satisfies OrderConfirmationSnapshot;

type AccessFlowObservations = {
  exchangedTokens: string[];
  confirmationRequests: Array<{
    url: string;
    accessId?: string;
  }>;
  analyticsRequests: Array<{
    url: string;
    referer?: string;
    body: string | null;
  }>;
};

async function mockOrderAccessFlow(
  page: Page,
  snapshot: OrderConfirmationSnapshot = confirmationSnapshot
): Promise<AccessFlowObservations> {
  const observations: AccessFlowObservations = {
    exchangedTokens: [],
    confirmationRequests: [],
    analyticsRequests: []
  };

  await page.route('**/api/analytics/event', async (route) => {
    const request = route.request();
    observations.analyticsRequests.push({
      url: request.url(),
      referer: request.headers().referer,
      body: request.postData()
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true })
    });
  });
  await page.route('**/api/orders/access-session', async (route) => {
    const payload = route.request().postDataJSON() as { token?: string };
    const token = payload.token ?? '';
    observations.exchangedTokens.push(token);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'Set-Cookie': `${ACCESS_COOKIE_NAME}=${token}; Path=/api/orders; HttpOnly; SameSite=Strict`
      },
      body: JSON.stringify({
        accessId: ACCESS_ID,
        expiresAt: '2027-01-01T00:00:00.000Z'
      })
    });
  });
  await page.route(
    /\/api\/orders\/confirmation(?:\?.*)?$/,
    async (route) => {
      const request = route.request();
      observations.confirmationRequests.push({
        url: request.url(),
        accessId: request.headers()['x-order-access-id']
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(snapshot)
      });
    }
  );

  return observations;
}

function expectCleanAccessUrl(value: string, expectedSearch = '') {
  const url = new URL(value);
  expect(url.pathname).toBe('/order/confirmation');
  expect(url.search).toBe(expectedSearch);
  expect(url.searchParams.has('access')).toBe(false);
  expect(url.searchParams.has('token')).toBe(false);
  expect(url.hash).toBe('');
  expect(value).not.toContain(ACCESS_ID);
  expect(value).not.toContain(FRAGMENT_BOOTSTRAP_TOKEN);
  expect(value).not.toContain(REJECTED_QUERY_TOKEN);
}

async function verifyHistoryDoesNotRestoreSecret(
  page: Page,
  expectedSearch = ''
) {
  await page.evaluate(() => {
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('history-check', 'safe');
    window.history.pushState(window.history.state, '', currentUrl);
    window.history.back();
  });
  await expect
    .poll(() => new URL(page.url()).searchParams.has('history-check'))
    .toBe(false);
  expectCleanAccessUrl(page.url(), expectedSearch);
}

test.describe('order access URL security', () => {
  test('exchanges a fragment secret for an HttpOnly session and keeps requests, HTML and history clean', async ({
    page
  }) => {
    const observations = await mockOrderAccessFlow(page);
    const requestedUrls: string[] = [];
    page.on('request', (request) => requestedUrls.push(request.url()));

    const documentResponse = await page.goto(
      `/order/confirmation#token=${FRAGMENT_BOOTSTRAP_TOKEN}`
    );
    const initialHtml = await documentResponse!.text();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Naročilo je sprejeto' })
    ).toBeVisible();

    expect(observations.exchangedTokens).toEqual([FRAGMENT_BOOTSTRAP_TOKEN]);
    expect(observations.confirmationRequests).toEqual([
      {
        url: expect.stringMatching(/\/api\/orders\/confirmation$/),
        accessId: ACCESS_ID
      }
    ]);
    expect(
      observations.confirmationRequests.every(
        (request) => new URL(request.url).search === ''
      )
    ).toBe(true);
    expect(requestedUrls.every((url) => !url.includes(FRAGMENT_BOOTSTRAP_TOKEN))).toBe(
      true
    );
    expect(initialHtml).not.toContain(FRAGMENT_BOOTSTRAP_TOKEN);
    expect(await page.content()).not.toContain(FRAGMENT_BOOTSTRAP_TOKEN);
    expectCleanAccessUrl(page.url());

    const storedAccessId = await page.evaluate(() =>
      window.sessionStorage.getItem('atehna-order-access-id-v1')
    );
    expect(storedAccessId).toBe(ACCESS_ID);
    const sessionCookie = (await page.context().cookies()).find(
      (cookie) => cookie.name === ACCESS_COOKIE_NAME
    );
    expect(sessionCookie).toMatchObject({
      value: FRAGMENT_BOOTSTRAP_TOKEN,
      httpOnly: true,
      sameSite: 'Strict',
      path: '/api/orders'
    });
    for (const request of observations.analyticsRequests) {
      expect(request.url).not.toContain(FRAGMENT_BOOTSTRAP_TOKEN);
      expect(request.url).not.toContain(ACCESS_ID);
      expect(request.referer ?? '').not.toContain(FRAGMENT_BOOTSTRAP_TOKEN);
      expect(request.referer ?? '').not.toContain(ACCESS_ID);
      expect(request.body ?? '').not.toContain(FRAGMENT_BOOTSTRAP_TOKEN);
      expect(request.body ?? '').not.toContain(ACCESS_ID);
    }

    await verifyHistoryDoesNotRestoreSecret(page);

    await page.reload();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Naročilo je sprejeto' })
    ).toBeVisible();
    expect(observations.exchangedTokens).toEqual([FRAGMENT_BOOTSTRAP_TOKEN]);
    expect(observations.confirmationRequests).toHaveLength(2);
    expect(observations.confirmationRequests[1]).toEqual({
      url: expect.stringMatching(/\/api\/orders\/confirmation$/),
      accessId: ACCESS_ID
    });
    expectCleanAccessUrl(page.url());
  });

  test('rejects and scrubs query credentials without exchanging or restoring them', async ({
    page,
    request
  }) => {
    const observations = await mockOrderAccessFlow(page);
    const rejectedCredentials = [
      { name: 'token', value: REJECTED_QUERY_TOKEN },
      { name: 'access', value: ACCESS_ID }
    ] as const;

    for (const credential of rejectedCredentials) {
      const expectedSearch = `?campaign=${credential.name}`;
      const credentialPath =
        `/order/confirmation${expectedSearch}&${credential.name}=` +
        encodeURIComponent(credential.value);
      const redirectResponse = await request.get(credentialPath, {
        maxRedirects: 0
      });
      expect(redirectResponse.status()).toBe(307);
      expect(redirectResponse.headers()['cache-control']).toBe('private, no-store');
      expect(redirectResponse.headers()['referrer-policy']).toBe('no-referrer');
      expect(redirectResponse.headers()['x-robots-tag']).toBe(
        'noindex, nofollow, noarchive'
      );
      const redirectLocation = redirectResponse.headers().location;
      expect(redirectLocation).toBe(`/order/confirmation${expectedSearch}`);
      expect(redirectLocation).not.toContain(credential.value);

      const renderedResponse = await request.get(redirectLocation);
      expect(await renderedResponse.text()).not.toContain(credential.value);
      const documentResponse = await page.goto(credentialPath);
      const finalHtml = await documentResponse!.text();
      await expect(
        page.getByRole('heading', {
          level: 1,
          name: 'Potrditve ni mogoče prikazati'
        })
      ).toBeVisible();
      expect(finalHtml).not.toContain(credential.value);
      expect(await page.content()).not.toContain(credential.value);
      expectCleanAccessUrl(page.url(), expectedSearch);
      await verifyHistoryDoesNotRestoreSecret(page, expectedSearch);
    }

    expect(observations.exchangedTokens).toEqual([]);
    expect(observations.confirmationRequests).toEqual([]);
    expect(
      await page.evaluate(() =>
        window.sessionStorage.getItem('atehna-order-access-id-v1')
      )
    ).toBeNull();
  });

  test('keeps purchase-order navigation and its back link free of the bearer token', async ({
    page
  }) => {
    const observations = await mockOrderAccessFlow(page, {
      ...confirmationSnapshot,
      commitmentStatus: 'pending_confirmation'
    });
    const requestedUrls: string[] = [];
    page.on('request', (request) => requestedUrls.push(request.url()));
    await page.goto(`/order/confirmation#token=${FRAGMENT_BOOTSTRAP_TOKEN}`);

    const purchaseOrderLink = page.getByRole('link', {
      name: 'Naloži naročilnico'
    });
    await expect(purchaseOrderLink).toBeVisible();
    const purchaseOrderHref = await purchaseOrderLink.getAttribute('href');
    expect(purchaseOrderHref).not.toBeNull();
    const purchaseOrderUrl = new URL(purchaseOrderHref!, 'https://storefront.test');
    expect(purchaseOrderUrl.pathname).toBe('/order/narocilnica');
    expect(purchaseOrderUrl.searchParams.has('access')).toBe(false);
    expect(purchaseOrderUrl.searchParams.has('token')).toBe(false);
    expect(purchaseOrderUrl.hash).toBe('');
    await purchaseOrderLink.click();
    await expect(page.getByRole('heading', { name: 'Naloži naročilnico' })).toBeVisible();

    const uploadUrl = new URL(page.url());
    expect(uploadUrl.pathname).toBe('/order/narocilnica');
    expect(uploadUrl.searchParams.has('access')).toBe(false);
    expect(uploadUrl.searchParams.has('token')).toBe(false);
    expect(uploadUrl.hash).toBe('');
    expect(page.url()).not.toContain(FRAGMENT_BOOTSTRAP_TOKEN);
    expect(await page.content()).not.toContain(FRAGMENT_BOOTSTRAP_TOKEN);
    expect(requestedUrls.every((url) => !url.includes(FRAGMENT_BOOTSTRAP_TOKEN))).toBe(
      true
    );
    expect(observations.exchangedTokens).toEqual([FRAGMENT_BOOTSTRAP_TOKEN]);

    const confirmationBackLink = page.getByRole('link', {
      name: 'Nazaj na potrditev'
    });
    const confirmationBackHref = await confirmationBackLink.getAttribute('href');
    expect(confirmationBackHref).not.toBeNull();
    const confirmationBackUrl = new URL(
      confirmationBackHref!,
      'https://storefront.test'
    );
    expect(confirmationBackUrl.pathname).toBe('/order/confirmation');
    expect(confirmationBackUrl.searchParams.has('token')).toBe(false);
    expect(confirmationBackUrl.hash).toBe('');
    await expect(page.getByRole('button', { name: 'Naloži naročilnico' })).toBeEnabled();
  });

  test('serves privacy response headers on both customer order pages', async ({
    request
  }) => {
    for (const pathname of ['/order/confirmation', '/order/narocilnica']) {
      const response = await request.get(pathname);
      const headers = response.headers();
      expect(response.ok()).toBe(true);
      expect(headers['cache-control']).toContain('private');
      expect(headers['cache-control']).toContain('no-store');
      expect(headers['referrer-policy']).toBe('no-referrer');
      expect(headers['x-robots-tag']).toBe('noindex, nofollow, noarchive');
    }
  });
});
