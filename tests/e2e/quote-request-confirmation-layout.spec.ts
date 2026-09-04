import { expect, test, type Locator, type Page } from '@playwright/test';
import type { QuoteRequestConfirmationSnapshot } from '@/commercial/quote/contracts';
import { SHIPPING_CALCULATION_VERSION } from '@/shared/domain/shipping/shipping';

const TEST_ACCESS_ID = '123e4567-e89b-42d3-a456-426614174001';

const confirmationSnapshot = {
  status: 'received',
  quoteReason: 'formal_offer',
  customerMessage: null,
  requestedAt: '2026-08-29T08:57:00.000Z',
  customer: {
    customerType: 'company',
    organizationName: 'Primer, d. o. o.',
    contactName: 'Maja Primer',
    email: 'maja@example.com',
    addressLine1: 'Slovenska cesta 1',
    addressLine2: '2. nadstropje',
    city: 'Ljubljana',
    postalCode: '1000'
  },
  items: [
    {
      lineNumber: 1,
      sku: 'MAT-KOV-ALU-0P3X100X100',
      productName: 'Aluminijasta plošča',
      variantName: '0,3 × 100 × 100 mm',
      quantity: 5,
      unit: 'kos',
      imageUrl: null
    }
  ],
  estimate: {
    totals: {
      net: 19.8,
      tax: 4.36,
      shipping: null,
      gross: null,
      currency: 'EUR'
    },
    shipping: {
      status: 'manual_quote',
      calculationVersion: SHIPPING_CALCULATION_VERSION,
      configurationVersion: 3,
      items: [],
      combinedWeightGrams: null,
      largestDimensionMm: null,
      triggeringItem: null,
      reason: 'Za poštnino je potreben ročni vnos.',
      issues: []
    },
    isBinding: false
  }
} satisfies QuoteRequestConfirmationSnapshot;

async function mockConfirmation(page: Page) {
  const pdfRequests: Array<{
    accessId: string | null;
    accept: string | null;
  }> = [];
  await page.addInitScript((accessId) => {
    window.sessionStorage.setItem('atehna-quote-access-id-v1', accessId);
  }, TEST_ACCESS_ID);
  await page.route(
    /\/api\/quote-requests\/confirmation\/pdf(?:\?.*)?$/,
    async (route) => {
      const headers = await route.request().allHeaders();
      pdfRequests.push({
        accessId: headers['x-quote-access-id'] ?? null,
        accept: headers.accept ?? null
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        headers: {
          'Content-Disposition':
            'attachment; filename="povprasevanje-pov-2026-000001.pdf"'
        },
        body: Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF')
      });
    }
  );
  await page.route(
    /\/api\/quote-requests\/confirmation(?:\?.*)?$/,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(confirmationSnapshot)
      });
    }
  );
  return { pdfRequests };
}

async function resolveThemeColor(scope: Locator, cssVariable: string) {
  return scope.evaluate((element, variableName) => {
    const probe = document.createElement('span');
    probe.style.color = 'var(' + variableName + ')';
    element.append(probe);
    const color = window.getComputedStyle(probe).color;
    probe.remove();
    return color;
  }, cssVariable);
}

test.describe('quote request confirmation layout', () => {
  test('uses the order-confirmation status and card visual system on desktop', async ({
    page
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const observations = await mockConfirmation(page);
    await page.goto('/quote-request/confirmation');

    const root = page.getByTestId('quote-request-confirmation-page');
    const frame = root.locator('[data-confirmation-page-frame]');
    const status = page.getByTestId('quote-request-submission-status');
    const heading = page.getByTestId('quote-request-confirmation-heading');
    const card = page.getByTestId('quote-request-confirmation-content-card');
    const primary = page.getByTestId('quote-request-confirmation-items-section');
    const secondary = page.getByTestId('quote-request-confirmation-summary');
    const customer = page.getByTestId(
      'quote-request-confirmation-customer-section'
    );
    const documents = page.getByTestId(
      'quote-request-confirmation-documents-section'
    );
    const lower = page.getByTestId(
      'quote-request-confirmation-lower-sections'
    );
    const pdfButton = page.getByTestId('quote-request-confirmation-pdf');

    await expect(status).toHaveAttribute('role', 'status');
    await expect(status).toHaveAttribute('data-confirmation-tone', 'success');
    await expect(heading).toHaveText('Povpraševanje je poslano');
    await expect(heading).toHaveCSS('font-size', '30px');
    await expect(status.locator('span[aria-hidden="true"]')).toHaveText('✓');

    const successColor = await resolveThemeColor(status, '--site-color-success');
    await expect(status).toHaveCSS('border-top-color', successColor);
    await expect(status.locator('span[aria-hidden="true"]')).toHaveCSS(
      'background-color',
      successColor
    );

    await expect(root.locator('.site-card')).toHaveCount(1);
    await expect(card.locator('.site-card')).toHaveCount(0);
    await expect(
      secondary.getByRole('heading', { name: 'Povzetek povpraševanja' })
    ).toBeVisible();
    await expect(
      secondary.getByRole('heading', { name: 'Okvirni izračun' })
    ).toBeVisible();
    await expect(
      secondary.getByText('Zaloga ni rezervirana', { exact: true })
    ).toBeVisible();
    await expect(
      secondary.locator('[data-summary-row="shipping"]')
    ).toHaveCount(1);
    await expect(
      secondary.locator('[data-summary-row="shipping"]')
    ).toContainText('Po dogovoru');
    await expect(root).not.toContainText('Skupaj za plačilo');
    await expect(
      customer.getByRole('heading', {
        name: 'Podatki o povpraševanju',
        exact: true
      })
    ).toBeVisible();
    await expect(customer.locator('dt')).toHaveText([
      'Naročnik',
      'Email',
      'Naslov'
    ]);
    await expect(customer).not.toContainText('Vrsta naročnika');
    await expect(customer).not.toContainText('Kontakt');
    await expect(customer.getByText('maja@example.com', { exact: true })).toBeVisible();
    await expect(customer.getByText('Primer, d. o. o.', { exact: true })).toBeVisible();
    await expect(customer).toContainText(
      'Slovenska cesta 1, 2. nadstropje, 1000 Ljubljana'
    );
    const detailGrid = customer.locator('dl');
    await expect(detailGrid).toHaveCSS('font-size', '16px');
    await expect(detailGrid).toHaveCSS('row-gap', '8px');
    await expect(detailGrid.locator('dd').first()).toHaveCSS(
      'font-size',
      '18px'
    );
    const detailCells = detailGrid.locator(':scope > div');
    await expect(detailCells).toHaveCount(3);
    const detailCellBoxes = await detailCells.evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width };
      })
    );
    expect(
      Math.max(...detailCellBoxes.map((box) => box.y)) -
        Math.min(...detailCellBoxes.map((box) => box.y))
    ).toBeLessThanOrEqual(1);

    await expect(
      documents.getByRole('heading', { name: 'Dokumenti', exact: true })
    ).toBeVisible();
    await expect(pdfButton).toHaveText('Potrditev povpraševanja (PDF)');
    const downloadPromise = page.waitForEvent('download');
    await pdfButton.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(
      'povprasevanje-pov-2026-000001.pdf'
    );
    await expect.poll(() => observations.pdfRequests.length).toBe(1);
    expect(observations.pdfRequests).toEqual([
      {
        accessId: TEST_ACCESS_ID,
        accept: 'application/pdf'
      }
    ]);

    const [
      rootBox,
      frameBox,
      statusBox,
      cardBox,
      primaryBox,
      secondaryBox,
      lowerBox,
      customerBox,
      documentsBox
    ] = await Promise.all([
      root.boundingBox(),
      frame.boundingBox(),
      status.boundingBox(),
      card.boundingBox(),
      primary.boundingBox(),
      secondary.boundingBox(),
      lower.boundingBox(),
      customer.boundingBox(),
      documents.boundingBox()
    ]);
    expect(rootBox).not.toBeNull();
    expect(frameBox).not.toBeNull();
    expect(statusBox).not.toBeNull();
    expect(cardBox).not.toBeNull();
    expect(primaryBox).not.toBeNull();
    expect(secondaryBox).not.toBeNull();
    expect(lowerBox).not.toBeNull();
    expect(customerBox).not.toBeNull();
    expect(documentsBox).not.toBeNull();
    const rootContentWidth = await root.evaluate((element) => {
      const style = getComputedStyle(element);
      return (
        element.getBoundingClientRect().width -
        Number.parseFloat(style.paddingLeft) -
        Number.parseFloat(style.paddingRight)
      );
    });
    expect(frameBox!.width / rootContentWidth).toBeGreaterThan(0.65);
    expect(frameBox!.width / rootContentWidth).toBeLessThan(0.68);
    expect(Math.abs(frameBox!.x - statusBox!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(frameBox!.width - statusBox!.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(statusBox!.x - cardBox!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(statusBox!.width - cardBox!.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(primaryBox!.y - secondaryBox!.y)).toBeLessThanOrEqual(1);
    expect(
      Math.abs(primaryBox!.x + primaryBox!.width - secondaryBox!.x)
    ).toBeLessThanOrEqual(1);
    expect(Math.abs(cardBox!.x - lowerBox!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(cardBox!.width - lowerBox!.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(lowerBox!.x - customerBox!.x)).toBeLessThanOrEqual(1);
    expect(
      Math.abs(customerBox!.x + customerBox!.width - documentsBox!.x)
    ).toBeLessThanOrEqual(1);
    expect(Math.abs(customerBox!.y - documentsBox!.y)).toBeLessThanOrEqual(1);
    expect(
      Math.abs(
        lowerBox!.x + lowerBox!.width -
          (documentsBox!.x + documentsBox!.width)
      )
    ).toBeLessThanOrEqual(1);
    expect(customerBox!.y).toBeGreaterThanOrEqual(
      primaryBox!.y + primaryBox!.height - 1
    );
    expect(lowerBox!.y).toBeGreaterThanOrEqual(
      secondaryBox!.y + secondaryBox!.height - 1
    );

    const desktopStyle = await card.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        display: style.display,
        gridTemplateColumns: style.gridTemplateColumns,
        overflowX: style.overflowX,
        paddingTop: style.paddingTop
      };
    });
    expect(desktopStyle.display).toBe('grid');
    expect(
      desktopStyle.gridTemplateColumns.trim().split(/\s+/u)
    ).toHaveLength(2);
    expect(desktopStyle.overflowX).toBe('hidden');
    expect(desktopStyle.paddingTop).toBe('0px');
  });

  test('keeps the shared card stacked and overflow-free on mobile', async ({
    page
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockConfirmation(page);
    await page.goto('/quote-request/confirmation');

    const heading = page.getByTestId('quote-request-confirmation-heading');
    const root = page.getByTestId('quote-request-confirmation-page');
    const frame = root.locator('[data-confirmation-page-frame]');
    const card = page.getByTestId('quote-request-confirmation-content-card');
    const primary = page.getByTestId('quote-request-confirmation-items-section');
    const secondary = page.getByTestId('quote-request-confirmation-summary');
    const customer = page.getByTestId(
      'quote-request-confirmation-customer-section'
    );
    const documents = page.getByTestId(
      'quote-request-confirmation-documents-section'
    );
    const detailCells = customer.locator('dl > div');

    await expect(heading).toHaveCSS('font-size', '24px');
    const [rootBox, frameBox, primaryBox, secondaryBox, customerBox, documentsBox] =
      await Promise.all([
        root.boundingBox(),
        frame.boundingBox(),
        primary.boundingBox(),
        secondary.boundingBox(),
        customer.boundingBox(),
        documents.boundingBox()
      ]);
    expect(rootBox).not.toBeNull();
    expect(frameBox).not.toBeNull();
    expect(primaryBox).not.toBeNull();
    expect(secondaryBox).not.toBeNull();
    expect(customerBox).not.toBeNull();
    expect(documentsBox).not.toBeNull();
    const rootContentMetrics = await root.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const paddingLeft = Number.parseFloat(style.paddingLeft);
      const paddingRight = Number.parseFloat(style.paddingRight);
      return {
        x: rect.x + paddingLeft,
        width: rect.width - paddingLeft - paddingRight
      };
    });
    expect(Math.abs(frameBox!.x - rootContentMetrics.x)).toBeLessThanOrEqual(1);
    expect(
      Math.abs(frameBox!.width - rootContentMetrics.width)
    ).toBeLessThanOrEqual(1);
    expect(secondaryBox!.y).toBeGreaterThanOrEqual(
      primaryBox!.y + primaryBox!.height - 1
    );
    expect(customerBox!.y).toBeGreaterThanOrEqual(
      secondaryBox!.y + secondaryBox!.height - 1
    );
    expect(documentsBox!.y).toBeGreaterThanOrEqual(
      customerBox!.y + customerBox!.height - 1
    );
    const mobileDetailBoxes = await detailCells.evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().y)
    );
    expect(mobileDetailBoxes[1]).toBeGreaterThan(mobileDetailBoxes[0]);
    expect(mobileDetailBoxes[2]).toBeGreaterThan(mobileDetailBoxes[1]);

    const mobileLayout = await card.evaluate((element) => {
      const style = getComputedStyle(element);
      const regions = Array.from(
        element.querySelectorAll<HTMLElement>('[data-confirmation-region]')
      );
      return {
        columns: style.gridTemplateColumns.trim().split(/\s+/u).length,
        regionsFit: regions.every(
          (region) => region.scrollWidth <= region.clientWidth + 1
        ),
        documentFits:
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth + 1
      };
    });
    expect(mobileLayout.columns).toBe(1);
    expect(mobileLayout.regionsFit).toBe(true);
    expect(mobileLayout.documentFits).toBe(true);
  });
});
