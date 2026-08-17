import { expect, test, type Page } from '@playwright/test';
import type { OrderConfirmationSnapshot } from '@/commercial/order/contracts';

const TEST_BOOTSTRAP_TOKEN = `ath_order_${'A'.repeat(43)}`;
const TEST_ACCESS_ID = '123e4567-e89b-42d3-a456-426614174000';
const TEST_ACCESS_COOKIE = `ath_order_access_${TEST_ACCESS_ID.replaceAll('-', '')}`;

const confirmationSnapshot = {
  orderId: 42,
  orderNumber: '#42',
  createdAt: '2026-08-17T08:57:00.000Z',
  status: 'received',
  paymentStatus: 'unpaid',
  commitmentStatus: 'binding',
  customer: {
    customerType: 'individual',
    customerName: 'Maja Primer',
    contactName: 'Maja Primer',
    email: 'maja@example.com',
    addressLine1: 'Cankarjeva ulica 27b',
    addressLine2: null,
    postalCode: '1000',
    city: 'Ljubljana',
    countryCode: 'SI'
  },
  items: [
    {
      variantId: 41001,
      productId: 410,
      productSlug: 'aluminijasta-plosca',
      productName: 'Aluminijasta plošča',
      variantName: '0,3 × 100 × 100 mm',
      sku: 'MAT-KOV-ALU-0P3X100X100',
      unit: 'kos',
      quantity: 5,
      minOrder: 1,
      availableStock: 25,
      imageUrl: null,
      attributes: {
        material: 'Aluminij',
        thickness: 0.3,
        width: 100,
        length: 100
      },
      baseUnitNet: 3.96,
      discountPct: 0,
      unitNet: 3.96,
      lineNet: 19.8,
      lineTax: 4.36,
      lineGross: 24.16,
      taxRate: 0.22
    }
  ],
  totals: {
    net: 19.8,
    tax: 4.36,
    shipping: 0,
    gross: 24.16,
    currency: 'EUR'
  },
  documents: [
    {
      id: 9,
      type: 'order_summary',
      filename: 'order-summary-42-random-id.pdf',
      url: 'https://example.test/order-summary-42.pdf'
    }
  ]
} satisfies OrderConfirmationSnapshot;

async function mockConfirmation(
  page: Page,
  resolveSnapshot: (
    requestNumber: number
  ) => OrderConfirmationSnapshot = () => confirmationSnapshot
) {
  let requestNumber = 0;
  const exchangedTokens: string[] = [];
  const confirmationRequests: Array<{ url: string; accessId?: string }> = [];
  await page.route('**/api/analytics/**', (route) => route.abort());
  await page.route('**/api/orders/access-session', async (route) => {
    const payload = route.request().postDataJSON() as { token?: string };
    const token = payload.token ?? '';
    exchangedTokens.push(token);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'Set-Cookie': `${TEST_ACCESS_COOKIE}=${token}; Path=/api/orders; HttpOnly; SameSite=Strict`
      },
      body: JSON.stringify({
        accessId: TEST_ACCESS_ID,
        expiresAt: '2026-11-15T08:57:00.000Z'
      })
    });
  });
  await page.route(
    /\/api\/orders\/confirmation(?:\?.*)?$/,
    async (route) => {
      requestNumber += 1;
      confirmationRequests.push({
        url: route.request().url(),
        accessId: route.request().headers()['x-order-access-id']
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(resolveSnapshot(requestNumber))
      });
    }
  );
  return {
    requestCount: () => requestNumber,
    exchangedTokens,
    confirmationRequests
  };
}

test.describe('order confirmation layout', () => {
  test('uses one compact card with the summary and desktop detail columns integrated', async ({
    page
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await mockConfirmation(page);
    await page.goto(`/order/confirmation#token=${TEST_BOOTSTRAP_TOKEN}`);

    await expect(
      page.getByRole('heading', { level: 1, name: 'Naročilo je sprejeto' })
    ).toBeVisible();

    const pageContent = page.getByTestId('order-confirmation-page');
    const card = page.getByTestId('order-confirmation-content-card');
    const orderSection = card.getByTestId('confirmation-order-section');
    const summary = orderSection.getByTestId('confirmation-summary');
    const customer = card.getByTestId('confirmation-customer-section');
    const documents = card.getByTestId('confirmation-documents-section');

    await expect(card).toBeVisible();
    await expect(pageContent.locator('.site-card')).toHaveCount(1);
    await expect(card.locator('.site-card')).toHaveCount(0);
    await expect(summary.getByRole('heading', { name: 'Povzetek' })).toBeVisible();
    await expect(summary).toContainText('24,16 €');
    await expect(
      documents.getByRole('link', { name: /^Potrditev naročila / })
    ).toBeVisible();
    await expect(documents).not.toContainText('order-summary-42-random-id.pdf');

    const [customerBox, documentsBox] = await Promise.all([
      customer.boundingBox(),
      documents.boundingBox()
    ]);
    expect(customerBox).not.toBeNull();
    expect(documentsBox).not.toBeNull();
    expect(Math.abs(customerBox!.y - documentsBox!.y)).toBeLessThanOrEqual(1);
    expect(documentsBox!.x).toBeGreaterThanOrEqual(
      customerBox!.x + customerBox!.width - 1
    );
  });

  test('stacks the same card sections without horizontal overflow on mobile', async ({
    page
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockConfirmation(page);
    await page.goto(`/order/confirmation#token=${TEST_BOOTSTRAP_TOKEN}`);

    const card = page.getByTestId('order-confirmation-content-card');
    const customer = card.getByTestId('confirmation-customer-section');
    const documents = card.getByTestId('confirmation-documents-section');
    const itemMedia = card.getByTestId('confirmation-item-media');
    await expect(card).toBeVisible();
    await expect(card.getByTestId('confirmation-summary')).toBeVisible();

    const [customerBox, documentsBox, itemMediaBox] = await Promise.all([
      customer.boundingBox(),
      documents.boundingBox(),
      itemMedia.boundingBox()
    ]);
    expect(customerBox).not.toBeNull();
    expect(documentsBox).not.toBeNull();
    expect(itemMediaBox).not.toBeNull();
    expect(itemMediaBox!.width).toBeLessThanOrEqual(80);
    expect(Math.abs(itemMediaBox!.width - itemMediaBox!.height)).toBeLessThanOrEqual(1);
    expect(documentsBox!.y).toBeGreaterThanOrEqual(
      customerBox!.y + customerBox!.height - 1
    );

    const overflow = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth
    }));
    expect(overflow.documentWidth).toBeLessThanOrEqual(
      overflow.viewportWidth + 1
    );
  });

  test('keeps the success state visible while a missing document is prepared', async ({
    page
  }) => {
    const requests = await mockConfirmation(page, (requestNumber) => ({
      ...confirmationSnapshot,
      documents:
        requestNumber === 1
          ? [
              {
                id: 8,
                type: 'purchase_order',
                filename: 'narocilnica.pdf',
                url: 'https://example.test/narocilnica.pdf'
              }
            ]
          : confirmationSnapshot.documents
    }));
    await page.goto(`/order/confirmation#token=${TEST_BOOTSTRAP_TOKEN}`);

    const successHeading = page.getByRole('heading', {
      level: 1,
      name: 'Naročilo je sprejeto'
    });
    const documents = page.getByTestId('confirmation-documents-section');
    await expect(successHeading).toBeVisible();
    await expect(
      documents.getByRole('link', { name: /^Naročilnica / })
    ).toBeVisible();
    await expect(
      documents.getByText('Potrditev naročila pripravljamo …')
    ).toBeVisible();
    await expect(
      documents.getByRole('button', { name: 'Preveri zdaj' })
    ).toBeVisible();

    await expect(
      documents.getByRole('link', { name: /^Potrditev naročila / })
    ).toBeVisible({ timeout: 4_000 });
    await expect(successHeading).toBeVisible();
    expect(requests.requestCount()).toBeGreaterThanOrEqual(2);
  });
});
