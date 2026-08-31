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
    email: 'maja@example.com'
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
  await page.addInitScript((accessId) => {
    window.sessionStorage.setItem('atehna-quote-access-id-v1', accessId);
  }, TEST_ACCESS_ID);
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
    await mockConfirmation(page);
    await page.goto('/quote-request/confirmation');

    const root = page.getByTestId('quote-request-confirmation-page');
    const status = page.getByTestId('quote-request-submission-status');
    const heading = page.getByTestId('quote-request-confirmation-heading');
    const card = page.getByTestId('quote-request-confirmation-content-card');
    const primary = page.getByTestId('quote-request-confirmation-items-section');
    const secondary = page.getByTestId('quote-request-confirmation-summary');

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

    const [statusBox, cardBox, primaryBox, secondaryBox] = await Promise.all([
      status.boundingBox(),
      card.boundingBox(),
      primary.boundingBox(),
      secondary.boundingBox()
    ]);
    expect(statusBox).not.toBeNull();
    expect(cardBox).not.toBeNull();
    expect(primaryBox).not.toBeNull();
    expect(secondaryBox).not.toBeNull();
    expect(Math.abs(statusBox!.x - cardBox!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(statusBox!.width - cardBox!.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(primaryBox!.y - secondaryBox!.y)).toBeLessThanOrEqual(1);
    expect(
      Math.abs(primaryBox!.x + primaryBox!.width - secondaryBox!.x)
    ).toBeLessThanOrEqual(1);

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
    const card = page.getByTestId('quote-request-confirmation-content-card');
    const primary = page.getByTestId('quote-request-confirmation-items-section');
    const secondary = page.getByTestId('quote-request-confirmation-summary');

    await expect(heading).toHaveCSS('font-size', '24px');
    const [primaryBox, secondaryBox] = await Promise.all([
      primary.boundingBox(),
      secondary.boundingBox()
    ]);
    expect(primaryBox).not.toBeNull();
    expect(secondaryBox).not.toBeNull();
    expect(secondaryBox!.y).toBeGreaterThanOrEqual(
      primaryBox!.y + primaryBox!.height - 1
    );

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
