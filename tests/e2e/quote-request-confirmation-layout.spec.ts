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
    customerType: 'individual',
    customerName: 'Ari Gato',
    organizationName: null,
    contactName: 'Ari Gato',
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
  test('uses the shared status, details, and summary card system on desktop', async ({
    page
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const observations = await mockConfirmation(page);
    await page.goto('/quote-request/confirmation');

    const root = page.getByTestId('quote-request-confirmation-page');
    const frame = root.locator('[data-confirmation-page-frame]');
    const status = page.getByTestId('quote-request-submission-status');
    const heading = page.getByTestId('quote-request-confirmation-heading');
    const contentGrid = page.getByTestId(
      'quote-request-confirmation-content-grid'
    );
    const panels = contentGrid.locator(':scope > .site-card');
    const detailsPanel = page.getByTestId(
      'quote-request-confirmation-items-section'
    );
    const summaryPanel = page.getByTestId(
      'quote-request-confirmation-summary'
    );
    const items = detailsPanel;
    const summary = summaryPanel;
    const customer = detailsPanel.getByTestId(
      'quote-request-confirmation-customer-section'
    );
    const documents = summaryPanel.getByTestId(
      'quote-request-confirmation-documents-section'
    );
    const pdfButton = page.getByTestId('quote-request-confirmation-pdf');
    const catalogButton = summaryPanel.getByRole('link', {
      name: 'Nazaj v katalog',
      exact: true
    });

    await expect(status).toHaveAttribute('role', 'status');
    await expect(status).toHaveAttribute('data-confirmation-tone', 'success');
    await expect(heading).toHaveText('Povpraševanje je poslano');
    await expect(heading).toHaveCSS('font-size', '30px');
    await expect(status.locator('span[aria-hidden="true"]')).toHaveText('✓');
    await expect(panels).toHaveCount(2);
    await expect(
      detailsPanel.getByRole('heading', {
        name: 'Podrobnosti povpraševanja',
        exact: true
      })
    ).toBeVisible();
    await expect(
      items.getByRole('heading', { name: 'Izdelki', exact: true })
    ).toBeVisible();
    await expect(
      summary.getByRole('heading', { name: 'Povzetek povpraševanja' })
    ).toBeVisible();
    await expect(
      summary.getByRole('heading', { name: 'Okvirni izračun' })
    ).toBeVisible();
    await expect(
      summary.getByText('Zaloga ni rezervirana', { exact: true })
    ).toBeVisible();
    await expect(
      summary.locator('[data-summary-row="shipping"]')
    ).toHaveCount(1);
    await expect(
      summary.locator('[data-summary-row="shipping"]')
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
    await expect(
      customer.getByText('Ari Gato', { exact: true })
    ).toBeVisible();
    await expect(customer.getByText('Ari', { exact: true })).toHaveCount(0);
    const emailLink = customer.getByRole('link', {
      name: 'maja@example.com',
      exact: true
    });
    await expect(emailLink).toHaveAttribute('href', 'mailto:maja@example.com');
    await expect(customer).toContainText(
      'Slovenska cesta 1, 2. nadstropje, 1000 Ljubljana'
    );
    const detailCells = customer.locator('dl > div');
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

    await expect(pdfButton).toContainText('PDF');
    await expect(documents).toBeVisible();
    await expect(pdfButton).toHaveClass(/site-button--primary/u);
    await expect(catalogButton).toHaveClass(/site-button--secondary/u);
    const primaryColor = await resolveThemeColor(
      summaryPanel,
      '--site-color-primary'
    );
    await expect(emailLink).toHaveCSS('color', primaryColor);
    const grossRow = summary.locator('[data-summary-row="gross"]');
    await expect(grossRow.locator('dt')).toHaveCSS('color', primaryColor);
    await expect(grossRow.locator('dd')).toHaveCSS('color', primaryColor);

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
      contentGridBox,
      detailsBox,
      summaryBox
    ] = await Promise.all([
      root.boundingBox(),
      frame.boundingBox(),
      status.boundingBox(),
      contentGrid.boundingBox(),
      detailsPanel.boundingBox(),
      summaryPanel.boundingBox()
    ]);
    expect(rootBox).not.toBeNull();
    expect(frameBox).not.toBeNull();
    expect(statusBox).not.toBeNull();
    expect(contentGridBox).not.toBeNull();
    expect(detailsBox).not.toBeNull();
    expect(summaryBox).not.toBeNull();
    const rootContentWidth = await root.evaluate((element) => {
      const style = getComputedStyle(element);
      return (
        element.getBoundingClientRect().width -
        Number.parseFloat(style.paddingLeft) -
        Number.parseFloat(style.paddingRight)
      );
    });
    expect(frameBox!.width / rootContentWidth).toBeCloseTo(2 / 3, 2);
    expect(Math.abs(frameBox!.x - statusBox!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(frameBox!.width - statusBox!.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(statusBox!.x - contentGridBox!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(statusBox!.width - contentGridBox!.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(detailsBox!.y - summaryBox!.y)).toBeLessThanOrEqual(1);
    expect(detailsBox!.x + detailsBox!.width).toBeLessThan(summaryBox!.x);
    expect(Math.abs(detailsBox!.x - contentGridBox!.x)).toBeLessThanOrEqual(1);
    expect(
      Math.abs(
        summaryBox!.x + summaryBox!.width -
          (contentGridBox!.x + contentGridBox!.width)
      )
    ).toBeLessThanOrEqual(1);

    const desktopStyle = await contentGrid.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        display: style.display,
        gridTemplateColumns: style.gridTemplateColumns,
        overflowX: style.overflowX
      };
    });
    expect(desktopStyle.display).toBe('grid');
    expect(
      desktopStyle.gridTemplateColumns.trim().split(/\s+/u)
    ).toHaveLength(2);
    expect(desktopStyle.overflowX).not.toBe('scroll');
  });

  test('keeps the shared cards stacked and overflow-free on mobile', async ({
    page
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockConfirmation(page);
    await page.goto('/quote-request/confirmation');

    const heading = page.getByTestId('quote-request-confirmation-heading');
    const root = page.getByTestId('quote-request-confirmation-page');
    const frame = root.locator('[data-confirmation-page-frame]');
    const contentGrid = page.getByTestId(
      'quote-request-confirmation-content-grid'
    );
    const panels = contentGrid.locator(':scope > .site-card');
    const detailsPanel = panels.nth(0);
    const summaryPanel = panels.nth(1);
    const customer = detailsPanel.getByTestId(
      'quote-request-confirmation-customer-section'
    );
    const documents = summaryPanel.getByTestId(
      'quote-request-confirmation-documents-section'
    );
    const detailCells = customer.locator('dl > div');

    await expect(heading).toHaveCSS('font-size', '24px');
    await expect(panels).toHaveCount(2);
    const [rootBox, frameBox, gridBox, detailsBox, summaryBox] =
      await Promise.all([
        root.boundingBox(),
        frame.boundingBox(),
        contentGrid.boundingBox(),
        detailsPanel.boundingBox(),
        summaryPanel.boundingBox()
      ]);
    expect(rootBox).not.toBeNull();
    expect(frameBox).not.toBeNull();
    expect(gridBox).not.toBeNull();
    expect(detailsBox).not.toBeNull();
    expect(summaryBox).not.toBeNull();
    const rootContentMetrics = await root.evaluate((element) => {
      const frameElement = element.querySelector<HTMLElement>(
        '[data-confirmation-page-frame]'
      );
      if (!frameElement) throw new Error('Missing quote confirmation page frame');
      const style = getComputedStyle(element);
      const paddingLeft = Number.parseFloat(style.paddingLeft);
      const paddingRight = Number.parseFloat(style.paddingRight);
      return {
        availableWidth: element.clientWidth - paddingLeft - paddingRight,
        frameWidth: frameElement.offsetWidth
      };
    });
    expect(
      Math.abs(
        rootContentMetrics.frameWidth - rootContentMetrics.availableWidth
      )
    ).toBeLessThanOrEqual(1);
    const frameLeftInset = frameBox!.x - rootBox!.x;
    const frameRightInset =
      rootBox!.x + rootBox!.width - (frameBox!.x + frameBox!.width);
    expect(frameLeftInset).toBeGreaterThanOrEqual(-1);
    expect(Math.abs(frameLeftInset - frameRightInset)).toBeLessThanOrEqual(1);
    expect(Math.abs(gridBox!.x - frameBox!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(gridBox!.width - frameBox!.width)).toBeLessThanOrEqual(1);
    expect(summaryBox!.y).toBeGreaterThanOrEqual(
      detailsBox!.y + detailsBox!.height - 1
    );
    await expect(customer).toBeVisible();
    await expect(documents).toBeVisible();
    const mobileDetailBoxes = await detailCells.evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().y)
    );
    expect(mobileDetailBoxes[1]).toBeGreaterThan(mobileDetailBoxes[0]);
    expect(mobileDetailBoxes[2]).toBeGreaterThan(mobileDetailBoxes[1]);

    const mobileLayout = await contentGrid.evaluate((element) => {
      const style = getComputedStyle(element);
      const panels = Array.from(element.children) as HTMLElement[];
      return {
        columns: style.gridTemplateColumns.trim().split(/\s+/u).length,
        panelsFit: panels.every(
          (panel) => panel.scrollWidth <= panel.clientWidth + 1
        ),
        documentFits:
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth + 1
      };
    });
    expect(mobileLayout.columns).toBe(1);
    expect(mobileLayout.panelsFit).toBe(true);
    expect(mobileLayout.documentFits).toBe(true);
  });
});
