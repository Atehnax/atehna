import { expect, test, type Locator, type Page } from '@playwright/test';
import type { OrderConfirmationSnapshot } from '@/commercial/order/contracts';
import { SHIPPING_CALCULATION_VERSION } from '@/shared/domain/shipping/shipping';

const TEST_BOOTSTRAP_TOKEN = `ath_order_${'A'.repeat(43)}`;
const TEST_ACCESS_ID = '123e4567-e89b-42d3-a456-426614174000';
const TEST_ACCESS_COOKIE = `ath_order_access_${TEST_ACCESS_ID.replaceAll('-', '')}`;

const zeroOverrideShipping: OrderConfirmationSnapshot['shipping'] = {
  status: 'calculated',
  source: 'manual_override',
  calculationVersion: SHIPPING_CALCULATION_VERSION,
  configurationVersion: 3,
  items: [
    {
      productId: '410',
      variantId: '41001',
      sku: 'MAT-KOV-ALU-0P3X100X100',
      name: 'Aluminijasta plošča',
      quantity: 5,
      weightGrams: 14,
      lengthMm: 100,
      widthMm: 100,
      heightMm: 1
    }
  ],
  combinedWeightGrams: 70,
  largestDimensionMm: 100,
  triggeringItem: {
    variantId: '41001',
    sku: 'MAT-KOV-ALU-0P3X100X100',
    name: 'Aluminijasta plošča',
    largestDimensionMm: 100
  },
  basePriceCents: 300,
  surchargeAmountCents: 0,
  merchandiseSubtotalCents: 2_416,
  parcelCount: 1,
  singleParcelAmountCents: 300,
  parcelCountGrossAmountCents: 300,
  multiPieceDiscountAmountCents: 0,
  afterMultiPieceAmountCents: 300,
  orderValueDiscountAmountCents: 0,
  automaticAmountCents: 300,
  finalAmountCents: 0,
  matchedWeightBand: {
    id: 'under-5kg',
    name: 'Do 5 kg',
    minWeightGrams: 1,
    maxWeightGrams: 4_999,
    priceCents: 300,
    enabled: true,
    position: 0
  },
  matchedDimensionalRule: null,
  matchedMultiPieceDiscountRule: null,
  matchedOrderValueDiscountRule: null,
  configurationSnapshot: {
    version: 3,
    manualQuoteFallbackEnabled: true,
    weightBands: [
      {
        id: 'under-5kg',
        name: 'Do 5 kg',
        minWeightGrams: 1,
        maxWeightGrams: 4_999,
        priceCents: 300,
        enabled: true,
        position: 0
      }
    ],
    dimensionalRules: [],
    orderValueDiscountRules: [],
    multiPieceDiscountRules: []
  },
  manualOverride: {
    reason: 'Dogovorjen osebni prevzem',
    automaticAmountCents: 300,
    originalAmountCents: 300,
    overrideAmountCents: 0,
    actorId: 'admin-1',
    actorName: 'Skrbnik',
    appliedAt: '2026-08-17T08:55:00.000Z'
  }
};

async function resolveThemeColor(scope: Locator, cssVariable: string) {
  return scope.evaluate((element, variableName) => {
    const probe = document.createElement('span');
    probe.style.color = `var(${variableName})`;
    element.append(probe);
    const color = window.getComputedStyle(probe).color;
    probe.remove();
    return color;
  }, cssVariable);
}

const confirmationSnapshot = {
  createdAt: '2026-08-17T08:57:00.000Z',
  status: 'received',
  paymentStatus: 'unpaid',
  commitmentStatus: 'binding',
  contractStatus: 'accepted',
  parcelCount: 1,
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
      imageUrl: '/images/technical-preview/sheet.webp',
      attributes: {
        material: 'Aluminij',
        thickness: 0.3,
        width: 100,
        length: 100
      },
      baseUnitNet: 3.96,
      discountPct: 0,
      discountKind: null,
      quantityDiscountPct: null,
      unitNet: 3.96,
      lineListNet: 19.8,
      lineDiscountNet: 0,
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
  shipping: zeroOverrideShipping,
  documents: [
    {
      type: 'order_summary',
      url: '/api/orders/documents/123e4567-e89b-42d3-a456-426614174010'
    }
  ]
} satisfies OrderConfirmationSnapshot;

const discountedConfirmationSnapshot: OrderConfirmationSnapshot = {
  ...confirmationSnapshot,
  items: [
    {
      ...confirmationSnapshot.items[0],
      quantity: 30,
      availableStock: 45,
      baseUnitNet: 4,
      discountPct: 5,
      discountKind: 'quantity',
      quantityDiscountPct: 5,
      unitNet: 3.8,
      lineListNet: 120,
      lineDiscountNet: 6,
      lineNet: 114,
      lineTax: 25.08,
      lineGross: 139.08
    }
  ],
  totals: {
    ...confirmationSnapshot.totals,
    net: 114,
    tax: 25.08,
    gross: 139.08
  }
};

const multiItemConfirmationSnapshot: OrderConfirmationSnapshot = {
  ...confirmationSnapshot,
  items: [
    confirmationSnapshot.items[0],
    {
      ...confirmationSnapshot.items[0],
      variantId: 52001,
      productId: 520,
      productSlug: 'jeklena-cev',
      productName: 'Jeklena cev',
      variantName: '20 × 2 mm',
      sku: 'CEV-JEK-20X2',
      quantity: 10,
      availableStock: 80,
      attributes: {
        material: 'Jeklo',
        diameter: 20,
        thickness: 2
      },
      baseUnitNet: 10,
      discountPct: 10,
      discountKind: 'quantity',
      quantityDiscountPct: 10,
      unitNet: 9,
      lineListNet: 100,
      lineDiscountNet: 10,
      lineNet: 90,
      lineTax: 8.55,
      lineGross: 98.55,
      taxRate: 0.095
    }
  ],
  totals: {
    ...confirmationSnapshot.totals,
    net: 109.8,
    tax: 12.91,
    gross: 122.71
  }
};

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
  test('uses aligned details and summary cards with the reference zero-discount totals', async ({
    page
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await mockConfirmation(page);
    await page.goto(`/order/confirmation#token=${TEST_BOOTSTRAP_TOKEN}`);

    const confirmationHeading = page.getByTestId('order-confirmation-heading');
    await expect(confirmationHeading).toHaveJSProperty('tagName', 'H1');
    await expect(confirmationHeading).toHaveText('Vaše naročilo je potrjeno');
    await expect(confirmationHeading).toHaveCSS('font-size', '30px');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(confirmationHeading).toHaveCSS('font-size', '24px');
    await page.setViewportSize({ width: 1440, height: 1000 });

    const pageContent = page.getByTestId('order-confirmation-page');
    const pageFrame = pageContent.locator('[data-confirmation-page-frame]');
    const status = pageFrame.getByTestId('order-submission-status');
    const contentGrid = pageFrame.getByTestId('confirmation-content-grid');
    const panels = contentGrid.locator(':scope > .site-card');
    const detailsPanel = pageFrame.getByTestId('confirmation-order-section');
    const summaryPanel = pageFrame.getByTestId('confirmation-summary');
    const orderSection = detailsPanel;
    const summary = summaryPanel;
    const customer = detailsPanel.getByTestId('confirmation-customer-section');
    const documents = summaryPanel.getByTestId('confirmation-documents-section');

    await expect(panels).toHaveCount(2);
    await expect(
      detailsPanel.getByRole('heading', {
        name: 'Podrobnosti naročila',
        exact: true
      })
    ).toBeVisible();
    await expect(
      orderSection.getByRole('heading', { name: 'Izdelki', exact: true })
    ).toBeVisible();

    const [desktopFrameBox, desktopStatusBox, desktopGridBox] =
      await Promise.all([
        pageFrame.boundingBox(),
        status.boundingBox(),
        contentGrid.boundingBox()
      ]);
    expect(desktopFrameBox).not.toBeNull();
    expect(desktopStatusBox).not.toBeNull();
    expect(desktopGridBox).not.toBeNull();
    const desktopFrameWidths = await pageContent.evaluate((element) => {
      const frame = element.querySelector<HTMLElement>(
        '[data-confirmation-page-frame]'
      );
      if (!frame) throw new Error('Missing order confirmation page frame');
      const style = getComputedStyle(element);
      return {
        availableWidth:
          element.clientWidth -
          Number.parseFloat(style.paddingLeft) -
          Number.parseFloat(style.paddingRight),
        frameWidth: frame.offsetWidth
      };
    });
    expect(
      desktopFrameWidths.frameWidth / desktopFrameWidths.availableWidth,
      'the confirmation frame should use two thirds of the available desktop lane'
    ).toBeCloseTo(2 / 3, 2);
    expect(Math.abs(desktopStatusBox!.x - desktopFrameBox!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(desktopGridBox!.x - desktopFrameBox!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(desktopStatusBox!.width - desktopFrameBox!.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(desktopGridBox!.width - desktopFrameBox!.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(desktopStatusBox!.width - desktopGridBox!.width)).toBeLessThanOrEqual(1);
    await expect(status).not.toContainText('Atehna je naročilo sprejela');
    await expect(status).toContainText(
      'Za nadaljnje usklajevanje bomo uporabili navedeni e-poštni naslov.'
    );
    await expect(
      customer.getByRole('heading', {
        name: 'Podatki o naročilu',
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
    await expect(customer).not.toContainText('Naslov za dostavo');
    await expect(customer).not.toContainText('Referenca');
    await expect(customer.getByText('Maja Primer', { exact: true })).toBeVisible();
    const emailLink = customer.getByRole('link', { name: 'maja@example.com' });
    await expect(emailLink).toHaveAttribute('href', 'mailto:maja@example.com');
    await expect(customer).toContainText(
      'Cankarjeva ulica 27b, 1000 Ljubljana'
    );
    const customerDetails = customer.locator('dl');
    const customerDetailCells = customerDetails.locator(':scope > div');
    await expect(customerDetailCells).toHaveCount(3);
    const customerDetailCellBoxes = await customerDetailCells.evaluateAll(
      (elements) =>
        elements.map((element) => {
          const rect = element.getBoundingClientRect();
          return { x: rect.x, y: rect.y, width: rect.width };
        })
    );
    expect(
      Math.max(...customerDetailCellBoxes.map((box) => box.y)) -
        Math.min(...customerDetailCellBoxes.map((box) => box.y))
    ).toBeLessThanOrEqual(1);
    await expect(summary.getByRole('heading', { name: 'Povzetek naročila' })).toBeVisible();
    await expect(summary.locator('[data-summary-section="calculation"]')).toBeVisible();
    await expect(summary.locator('[data-summary-section="details"]')).toHaveCount(0);
    await expect(summary.getByRole('heading', { name: /Podrobnosti artikla/ })).toHaveCount(0);

    const itemRow = orderSection.getByTestId('confirmation-item-row');
    const itemTitle = itemRow.getByTestId('confirmation-item-title');
    const itemExpression = itemRow.locator('[data-confirmation-item-expression]');
    const itemLineGross = itemRow.locator('[data-confirmation-item-line-gross]');
    await expect(itemRow).toBeVisible();
    await expect(itemTitle).toHaveText('Aluminijasta plošča 0,3 × 100 × 100 mm');
    await expect(itemRow).toContainText('SKU: MAT-KOV-ALU-0P3X100X100');
    await expect(itemExpression).toHaveText('5 kosov × 4,83 €');
    await expect(itemLineGross).toHaveText('24,16 €');
    await expect(itemRow.locator('[data-confirmation-item-discount]')).toHaveCount(0);
    await expect(summary.locator('[data-summary-item]')).toHaveCount(0);
    await expect(summary.locator('[data-summary-row="net"]')).toContainText('Vmesna vsota brez DDV');
    await expect(summary.locator('[data-summary-row="net"]')).toContainText('19,80 €');
    await expect(summary.locator('[data-summary-row="tax"]')).toHaveCount(1);
    await expect(summary.locator('[data-summary-row="tax"]')).toHaveAttribute('data-summary-tax-rate', '0.22');
    await expect(summary.locator('[data-summary-row="tax"]')).toContainText('DDV (22 %)');
    await expect(summary.locator('[data-summary-row="tax"]')).toContainText('4,36 €');
    const shippingRows = summary.locator('[data-summary-row="shipping"]');
    await expect(shippingRows).toHaveCount(1);
    await expect(shippingRows.getByText('Poštnina', { exact: true })).toBeVisible();
    await expect(shippingRows).toContainText('0,00 €');
    await expect(summary.locator('[data-shipping-row]')).toHaveCount(0);
    await expect(summary).not.toContainText('Dogovorjen osebni prevzem');
    await expect(summary.locator('[data-summary-row="gross"]')).toContainText('Skupaj za plačilo');
    await expect(summary.locator('[data-summary-row="gross"]')).toContainText('24,16 €');

    const grossRow = summary.locator('[data-summary-row="gross"]');
    const primaryColor = await resolveThemeColor(grossRow, '--site-color-primary');
    await expect(grossRow.locator('dt')).toHaveCSS('color', primaryColor);
    await expect(grossRow.locator('dd')).toHaveCSS('color', primaryColor);
    await expect(emailLink).toHaveCSS('color', primaryColor);

    await expect(summary).not.toContainText('Cena brez DDV:');
    await expect(summary).not.toContainText('Skupaj brez DDV');
    await expect(summary).not.toContainText('Skupaj z DDV');
    await expect(summary).not.toContainText(
      '5 kosov × Aluminijasta plošča 0,3 × 100 × 100 mm'
    );
    await expect(summary).not.toContainText('Količinski popust');
    await expect(summary).not.toContainText('Popust');
    await expect(summary).not.toContainText('Nova zaloga');

    for (const removedRow of ['variant', 'price', 'unit-net', 'quantity', 'base', 'discount']) {
      await expect(summary.locator(`[data-summary-row="${removedRow}"]`)).toHaveCount(0);
    }

    const [itemRowBox, itemExpressionBox, itemLineGrossBox] = await Promise.all([
      itemRow.boundingBox(),
      itemExpression.boundingBox(),
      itemLineGross.boundingBox()
    ]);
    expect(itemRowBox).not.toBeNull();
    expect(itemExpressionBox).not.toBeNull();
    expect(itemLineGrossBox).not.toBeNull();
    expect(
      Math.abs(
        itemExpressionBox!.y + itemExpressionBox!.height / 2 -
          (itemLineGrossBox!.y + itemLineGrossBox!.height / 2)
      ),
      'the gross line amount should be vertically centered against the quantity calculation'
    ).toBeLessThanOrEqual(1);
    expect(itemLineGrossBox!.x).toBeGreaterThan(itemExpressionBox!.x);
    expect(itemLineGrossBox!.x + itemLineGrossBox!.width).toBeLessThanOrEqual(
      itemRowBox!.x + itemRowBox!.width + 1
    );
    const pdfAction = documents.getByTestId('order-confirmation-pdf');
    const catalogAction = summaryPanel.getByRole('link', {
      name: 'Nazaj v katalog',
      exact: true
    });
    await expect(pdfAction).toBeVisible();
    await expect(pdfAction).toContainText('PDF');
    await expect(pdfAction).toHaveClass(/site-button--primary/u);
    await expect(pdfAction).toHaveAttribute('download', '');
    await expect(pdfAction).not.toHaveAttribute('target', '_blank');
    await expect(catalogAction).toHaveClass(/site-button--secondary/u);
    await expect(pageContent).not.toContainText('Številka naročila');
    await expect(pageContent).not.toContainText('#42');
    await expect(documents.locator('a[href^="/api/orders/documents/"]')).toHaveAttribute(
      'href',
      '/api/orders/documents/123e4567-e89b-42d3-a456-426614174010'
    );

    const [detailsBox, summaryBox] = await Promise.all([
      detailsPanel.boundingBox(),
      summaryPanel.boundingBox()
    ]);
    expect(detailsBox).not.toBeNull();
    expect(summaryBox).not.toBeNull();
    expect(
      Math.abs(detailsBox!.y - summaryBox!.y),
      'the detail and summary cards should start on the same row'
    ).toBeLessThanOrEqual(1);
    expect(detailsBox!.x + detailsBox!.width).toBeLessThan(summaryBox!.x);
    expect(Math.abs(detailsBox!.x - desktopGridBox!.x)).toBeLessThanOrEqual(1);
    expect(
      Math.abs(
        summaryBox!.x + summaryBox!.width -
          (desktopGridBox!.x + desktopGridBox!.width)
      )
    ).toBeLessThanOrEqual(1);
  });

  test('keeps distinct products and their discounts associated in a responsive multi-item calculation', async ({
    page
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await mockConfirmation(page, () => multiItemConfirmationSnapshot);
    await page.goto(`/order/confirmation#token=${TEST_BOOTSTRAP_TOKEN}`);

    const detailsPanel = page
      .getByTestId('confirmation-content-grid')
      .locator(':scope > .site-card')
      .first();
    const itemRows = detailsPanel.getByTestId('confirmation-item-row');
    const summary = page.getByTestId('confirmation-summary');
    const summaryTotals = summary.locator('[data-summary-totals]');
    const aluminium = itemRows.nth(0);
    const steel = itemRows.nth(1);
    const steelDiscount = steel.locator('[data-confirmation-item-discount]');

    await expect(itemRows).toHaveCount(2);
    await expect(summaryTotals).toHaveJSProperty('tagName', 'DL');
    await expect(summaryTotals.locator('[data-summary-row="net"]')).toHaveCount(1);
    await expect(summaryTotals.locator('[data-summary-row="gross"]')).toHaveCount(1);
    await expect(summaryTotals.locator('[data-summary-item]')).toHaveCount(0);
    await expect(summary.locator('[data-summary-item]')).toHaveCount(0);

    await expect(aluminium.getByTestId('confirmation-item-title')).toHaveText(
      'Aluminijasta plošča 0,3 × 100 × 100 mm'
    );
    await expect(aluminium).toContainText('SKU: MAT-KOV-ALU-0P3X100X100');
    await expect(aluminium.locator('[data-confirmation-item-expression]')).toHaveText(
      '5 kosov × 4,83 €'
    );
    await expect(aluminium.locator('[data-confirmation-item-line-gross]')).toHaveText('24,16 €');
    await expect(aluminium.locator('[data-confirmation-item-discount]')).toHaveCount(0);
    await expect(aluminium).not.toContainText('10,95 €');

    await expect(steel.getByTestId('confirmation-item-title')).toHaveText(
      'Jeklena cev 20 × 2 mm'
    );
    await expect(steel).toContainText('SKU: CEV-JEK-20X2');
    await expect(steel.locator('[data-confirmation-item-expression]')).toHaveText(
      '10 kosov × 10,95 €'
    );
    await expect(steel.locator('[data-confirmation-item-line-gross]')).toHaveText('109,50 €');
    await expect(steelDiscount).toContainText('Količinski popust');
    await expect(steelDiscount).toContainText('10 %');
    await expect(steelDiscount).toContainText('-10,95 €');
    await expect(steel).not.toContainText('24,16 €');

    const netRow = summary.locator('[data-summary-row="net"]');
    const taxRows = summary.locator('[data-summary-row="tax"]');
    const grossRow = summary.locator('[data-summary-row="gross"]');
    await expect(netRow).toContainText('Vmesna vsota brez DDV');
    await expect(netRow).toContainText('109,80 €');
    await expect(taxRows).toHaveCount(2);
    await expect(taxRows.nth(0)).toHaveAttribute('data-summary-tax-rate', '0.22');
    await expect(taxRows.nth(0)).toContainText('DDV (22 %)');
    await expect(taxRows.nth(0)).toContainText('4,36 €');
    await expect(taxRows.nth(1)).toHaveAttribute('data-summary-tax-rate', '0.095');
    await expect(taxRows.nth(1)).toContainText('DDV (9,5 %)');
    await expect(taxRows.nth(1)).toContainText('8,55 €');
    await expect(grossRow).toContainText('Skupaj za plačilo');
    await expect(grossRow).toContainText('122,71 €');
    expect(2_416 + 10_950 - 1_095).toBe(12_271);
    expect(10_980 + 436 + 855).toBe(12_271);
    await expect(summary.locator('[data-summary-section="details"]')).toHaveCount(0);
    for (const removedRow of ['variant', 'price', 'unit-net', 'quantity', 'base', 'discount']) {
      await expect(summary.locator(`[data-summary-row="${removedRow}"]`)).toHaveCount(0);
    }

    async function readItemAlignment() {
      return itemRows.evaluateAll((elements) =>
        elements.map((element) => {
          const expression = element.querySelector<HTMLElement>('[data-confirmation-item-expression]');
          const lineGross = element.querySelector<HTMLElement>('[data-confirmation-item-line-gross]');
          if (!expression || !lineGross) throw new Error('Confirmation item alignment hooks are missing.');
          const itemRect = element.getBoundingClientRect();
          const expressionRect = expression.getBoundingClientRect();
          const lineGrossRect = lineGross.getBoundingClientRect();
          return {
            itemLeft: itemRect.left,
            itemRight: itemRect.right,
            itemWidth: itemRect.width,
            itemClientWidth: element.clientWidth,
            itemScrollWidth: element.scrollWidth,
            expressionCenter: expressionRect.top + expressionRect.height / 2,
            lineGrossCenter: lineGrossRect.top + lineGrossRect.height / 2,
            lineGrossLeft: lineGrossRect.left,
            lineGrossRight: lineGrossRect.right
          };
        })
      );
    }

    for (const viewport of [
      { width: 1440, height: 1000, label: 'desktop' },
      { width: 390, height: 844, label: 'mobile' }
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const [detailsBox, alignment] = await Promise.all([
        detailsPanel.boundingBox(),
        readItemAlignment()
      ]);
      expect(detailsBox).not.toBeNull();
      expect(alignment).toHaveLength(2);
      expect(
        Math.abs(alignment[0].lineGrossRight - alignment[1].lineGrossRight),
        `${viewport.label} gross line amounts should be right aligned`
      ).toBeLessThanOrEqual(1);
      for (const item of alignment) {
        expect(
          Math.abs(item.expressionCenter - item.lineGrossCenter),
          `${viewport.label} gross amount should be vertically centered against its quantity calculation`
        ).toBeLessThanOrEqual(1);
        expect(item.lineGrossLeft).toBeGreaterThan(item.itemLeft);
        expect(item.itemLeft).toBeGreaterThanOrEqual(detailsBox!.x - 1);
        expect(item.itemRight).toBeLessThanOrEqual(detailsBox!.x + detailsBox!.width + 1);
        expect(item.itemScrollWidth).toBeLessThanOrEqual(item.itemClientWidth + 1);
      }
    }
  });

  test('uses authoritative aggregate VAT when mixed-rate item taxes do not reconcile', async ({ page }) => {
    await mockConfirmation(page, () => ({
      ...multiItemConfirmationSnapshot,
      totals: {
        ...multiItemConfirmationSnapshot.totals,
        tax: 12.92,
        gross: 122.72
      }
    }));
    await page.goto(`/order/confirmation#token=${TEST_BOOTSTRAP_TOKEN}`);

    const summary = page.getByTestId('confirmation-summary');
    const taxRows = summary.locator('[data-summary-row="tax"]');
    await expect(taxRows).toHaveCount(1);
    await expect(taxRows).toHaveAttribute('data-summary-tax-rate', 'aggregate');
    await expect(taxRows).toContainText('DDV');
    await expect(taxRows).toContainText('12,92 €');
    await expect(taxRows).not.toContainText('22 %');
    await expect(taxRows).not.toContainText('9,5 %');
    await expect(summary.locator('[data-summary-row="net"]')).toContainText('109,80 €');
    await expect(summary.locator('[data-summary-row="gross"]')).toContainText('122,72 €');
  });



  test('omits empty or product-duplicate variant metadata instead of inventing fallback copy', async ({ page }) => {
    await mockConfirmation(page, () => ({
      ...confirmationSnapshot,
      items: [
        {
          ...confirmationSnapshot.items[0],
          variantName: 'Aluminijasta plošča',
          sku: ''
        },
        {
          ...confirmationSnapshot.items[0],
          variantId: 53001,
          productId: 530,
          productSlug: 'bakrena-plocevina',
          productName: 'Bakrena pločevina',
          variantName: '',
          sku: '',
          quantity: 2,
          baseUnitNet: 5,
          unitNet: 5,
          lineListNet: 10,
          lineDiscountNet: 0,
          lineNet: 10,
          lineTax: 2.2,
          lineGross: 12.2
        }
      ],
      totals: {
        ...confirmationSnapshot.totals,
        net: 29.8,
        tax: 6.56,
        gross: 36.36
      }
    }));
    await page.goto(`/order/confirmation#token=${TEST_BOOTSTRAP_TOKEN}`);

    const itemRows = page.getByTestId('confirmation-item-row');
    const aluminium = itemRows.nth(0);
    const copper = itemRows.nth(1);
    const aluminiumTitle = aluminium.getByTestId('confirmation-item-title');
    const copperTitle = copper.getByTestId('confirmation-item-title');

    await expect(aluminiumTitle).toHaveText('Aluminijasta plošča');
    await expect(aluminium.locator('[data-confirmation-item-expression]')).toHaveText(
      '5 kosov × 4,83 €'
    );
    await expect(copperTitle).toHaveText('Bakrena pločevina');
    await expect(copper.locator('[data-confirmation-item-expression]')).toHaveText('2 kosa × 6,10 €');
    await expect(aluminium.getByText(/^SKU:/u)).toHaveCount(0);
    await expect(copper.getByText(/^SKU:/u)).toHaveCount(0);
    await expect(page.getByTestId('confirmation-content-grid')).not.toContainText('Brez naziva različice');
    expect((await aluminiumTitle.textContent())?.match(/Aluminijasta plošča/gu)).toHaveLength(1);
    expect((await copperTitle.textContent())?.match(/Bakrena pločevina/gu)).toHaveLength(1);
  });

  test('keeps each item row to one combined title, price expression, total, and full-bleed image', async ({
    page
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await mockConfirmation(page);
    await page.goto(`/order/confirmation#token=${TEST_BOOTSTRAP_TOKEN}`);

    const itemRow = page.getByTestId('confirmation-item-row');
    const itemTitle = itemRow.getByTestId('confirmation-item-title');
    const itemMedia = itemRow.getByTestId('confirmation-item-media');
    const itemImage = itemMedia.locator('img');
    const combinedTitle = 'Aluminijasta plošča 0,3 × 100 × 100 mm';
    const sku = 'SKU: MAT-KOV-ALU-0P3X100X100';

    await expect(itemRow).toBeVisible();
    await expect(itemTitle).toHaveText(combinedTitle);
    await expect(itemRow.getByText(sku, { exact: true })).toBeVisible();
    await expect(
      itemRow.getByRole('heading', { name: 'Aluminijasta plošča', exact: true })
    ).toHaveCount(0);
    await expect(
      itemRow.getByText('0,3 × 100 × 100 mm', { exact: true })
    ).toHaveCount(0);
    await expect(
      itemRow.locator('[data-confirmation-item-expression]')
    ).toHaveText('5 kosov × 4,83 €');
    await expect(
      itemRow.locator('[data-confirmation-item-line-gross]')
    ).toHaveText('24,16 €');

    for (const removedText of [
      'Material:',
      'Debelina:',
      'Širina:',
      'Dolžina:',
      '19,80 € brez DDV',
      'DDV 22 %'
    ]) {
      await expect(itemRow).not.toContainText(removedText);
    }

    await expect(itemImage).toBeVisible();
    await expect(itemImage).toHaveCSS('object-fit', 'cover');
    const [mediaBox, imageBox, imageStyle] = await Promise.all([
      itemMedia.boundingBox(),
      itemImage.boundingBox(),
      itemImage.evaluate((image) => {
        const style = window.getComputedStyle(image);
        return {
          paddingTop: style.paddingTop,
          paddingRight: style.paddingRight,
          paddingBottom: style.paddingBottom,
          paddingLeft: style.paddingLeft
        };
      })
    ]);
    expect(mediaBox).not.toBeNull();
    expect(imageBox).not.toBeNull();
    expect(Math.abs(mediaBox!.width - mediaBox!.height)).toBeLessThanOrEqual(1);
    expect(Math.abs(imageBox!.x - mediaBox!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(imageBox!.y - mediaBox!.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(imageBox!.width - mediaBox!.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(imageBox!.height - mediaBox!.height)).toBeLessThanOrEqual(1);
    expect(imageStyle).toEqual({
      paddingTop: '0px',
      paddingRight: '0px',
      paddingBottom: '0px',
      paddingLeft: '0px'
    });
  });

  test('shows an applied quantity discount while keeping customer-facing calculations gross', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await mockConfirmation(page, () => discountedConfirmationSnapshot);
    await page.goto(`/order/confirmation#token=${TEST_BOOTSTRAP_TOKEN}`);

    const summary = page.getByTestId('confirmation-summary');
    const itemRow = page.getByTestId('confirmation-item-row');
    const discountRow = itemRow.locator('[data-confirmation-item-discount]');
    const netRow = summary.locator('[data-summary-row="net"]');
    const taxRow = summary.locator('[data-summary-row="tax"]');
    const grossRow = summary.locator('[data-summary-row="gross"]');

    await expect(itemRow.getByTestId('confirmation-item-title')).toHaveText(
      'Aluminijasta plošča 0,3 × 100 × 100 mm'
    );
    await expect(itemRow.locator('[data-confirmation-item-expression]')).toHaveText(
      '30 kosov × 4,88 €'
    );
    await expect(itemRow.locator('[data-confirmation-item-line-gross]')).toHaveText('146,40 €');
    await expect(discountRow).toContainText('Količinski popust');
    await expect(discountRow).toContainText('5 %');
    await expect(discountRow).toContainText('-7,32 €');
    await expect(netRow).toContainText('Vmesna vsota brez DDV');
    await expect(netRow).toContainText('114,00 €');
    await expect(taxRow).toHaveAttribute('data-summary-tax-rate', '0.22');
    await expect(taxRow).toContainText('DDV (22 %)');
    await expect(taxRow).toContainText('25,08 €');
    await expect(grossRow).toContainText('Skupaj za plačilo');
    await expect(grossRow).toContainText('139,08 €');
    expect(14_640 - 732).toBe(13_908);
    expect(11_400 + 2_508).toBe(13_908);
    await expect(summary).not.toContainText('Nova zaloga');

    const colors = await summary.evaluate((element) => {
      const primaryProbe = document.createElement('span');
      primaryProbe.style.color = 'var(--site-color-primary)';
      element.append(primaryProbe);
      const result = {
        primary: window.getComputedStyle(primaryProbe).color
      };
      primaryProbe.remove();
      return result;
    });
    await expect(grossRow.getByText('Skupaj za plačilo', { exact: true })).toHaveCSS('color', colors.primary);
    await expect(grossRow.getByText('139,08 €', { exact: true })).toHaveCSS('color', colors.primary);
  });

  test('labels a general variant discount as Popust, not Količinski popust', async ({ page }) => {
    await mockConfirmation(page, () => ({
      ...discountedConfirmationSnapshot,
      items: [
        {
          ...discountedConfirmationSnapshot.items[0],
          discountKind: 'variant',
          quantityDiscountPct: null
        }
      ]
    }));
    await page.goto(`/order/confirmation#token=${TEST_BOOTSTRAP_TOKEN}`);

    const itemRow = page.getByTestId('confirmation-item-row');
    const discountRow = itemRow.locator('[data-confirmation-item-discount]');
    await expect(discountRow).toContainText('Popust');
    await expect(discountRow).toContainText('5 %');
    await expect(discountRow).toContainText('-7,32 €');
    await expect(itemRow).not.toContainText('Količinski popust');
  });

  test('does not claim a quantity discount when discount metadata is inconsistent', async ({ page }) => {
    await mockConfirmation(page, () => ({
      ...confirmationSnapshot,
      items: [
        {
          ...confirmationSnapshot.items[0],
          discountPct: 5,
          lineDiscountNet: 0
        }
      ]
    }));
    await page.goto(`/order/confirmation#token=${TEST_BOOTSTRAP_TOKEN}`);

    const itemRow = page.getByTestId('confirmation-item-row');
    await expect(itemRow.locator('[data-confirmation-item-discount]')).toHaveCount(0);
    await expect(itemRow).not.toContainText('Količinski popust');
    await expect(itemRow).not.toContainText('Popust');
  });

  test('uses the success status semantics for a received order awaiting seller review', async ({ page }) => {
    await mockConfirmation(page, () => ({
      ...confirmationSnapshot,
      contractStatus: 'pending_seller_acceptance'
    }));
    await page.goto(`/order/confirmation#token=${TEST_BOOTSTRAP_TOKEN}`);

    const status = page.getByTestId('order-submission-status');
    await expect(status).toHaveAttribute('data-confirmation-tone', 'success');
    await expect(status).toHaveAttribute('role', 'status');
    await expect(status.getByText('Prejeto', { exact: true })).toBeVisible();
    await expect(
      status.getByRole('heading', { level: 1, name: 'Prejeli smo vaše naročilo' })
    ).toBeVisible();
  });

  test('uses informational styling and order wording while confirmation is pending', async ({ page }) => {
    await mockConfirmation(page, () => ({
      ...confirmationSnapshot,
      commitmentStatus: 'pending_confirmation'
    }));
    await page.goto(`/order/confirmation#token=${TEST_BOOTSTRAP_TOKEN}`);

    const status = page.getByTestId('order-submission-status');
    await expect(status).toHaveAttribute('data-confirmation-tone', 'info');
    await expect(status).toHaveAttribute('role', 'status');
    await expect(status.getByRole('heading', { level: 1, name: 'Naročilo je prejeto' })).toBeVisible();
    await expect(status).toContainText(
      'Po e-pošti boste prejeli varno povezavo za nalaganje naročilnice. Naročilo začnemo obdelovati šele po prejemu in pregledu naročilnice. Zaloga do potrditve še ni rezervirana.'
    );
  });

  test('stacks the details and summary cards without horizontal overflow on mobile', async ({
    page
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockConfirmation(page);
    await page.goto(`/order/confirmation#token=${TEST_BOOTSTRAP_TOKEN}`);

    const pageContent = page.getByTestId('order-confirmation-page');
    const pageFrame = pageContent.locator('[data-confirmation-page-frame]');
    const status = pageFrame.getByTestId('order-submission-status');
    const contentGrid = pageFrame.getByTestId('confirmation-content-grid');
    const panels = contentGrid.locator(':scope > .site-card');
    const detailsPanel = panels.nth(0);
    const summaryPanel = panels.nth(1);
    const orderSection = detailsPanel;
    const customer = detailsPanel.getByTestId('confirmation-customer-section');
    const documents = summaryPanel.getByTestId('confirmation-documents-section');
    const itemMedia = detailsPanel.getByTestId('confirmation-item-media');
    const summary = summaryPanel;
    await expect(panels).toHaveCount(2);
    await expect(summary).toBeVisible();

    const mobileFrameWidths = await pageContent.evaluate((element) => {
      const frame = element.querySelector<HTMLElement>(
        '[data-confirmation-page-frame]'
      );
      if (!frame) throw new Error('Missing order confirmation page frame');

      const style = getComputedStyle(element);
      const availableWidth =
        element.clientWidth -
        Number.parseFloat(style.paddingLeft) -
        Number.parseFloat(style.paddingRight);

      return {
        availableWidth,
        frameWidth: frame.offsetWidth
      };
    });
    expect(
      Math.abs(
        mobileFrameWidths.frameWidth - mobileFrameWidths.availableWidth
      ),
      'the confirmation frame should keep the full available mobile lane'
    ).toBeLessThanOrEqual(1);

    const [mobileFrameBox, mobileStatusBox] = await Promise.all([
      pageFrame.boundingBox(),
      status.boundingBox()
    ]);
    expect(mobileFrameBox).not.toBeNull();
    expect(mobileStatusBox).not.toBeNull();
    expect(Math.abs(mobileStatusBox!.x - mobileFrameBox!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(mobileStatusBox!.width - mobileFrameBox!.width)).toBeLessThanOrEqual(1);

    const [gridBox, detailsBox, summaryBox, itemMediaBox] = await Promise.all([
      contentGrid.boundingBox(),
      detailsPanel.boundingBox(),
      summaryPanel.boundingBox(),
      itemMedia.boundingBox()
    ]);
    expect(gridBox).not.toBeNull();
    expect(detailsBox).not.toBeNull();
    expect(summaryBox).not.toBeNull();
    expect(itemMediaBox).not.toBeNull();
    expect(Math.abs(gridBox!.x - mobileFrameBox!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(gridBox!.width - mobileFrameBox!.width)).toBeLessThanOrEqual(1);
    expect(itemMediaBox!.width).toBeLessThanOrEqual(80);
    expect(Math.abs(itemMediaBox!.width - itemMediaBox!.height)).toBeLessThanOrEqual(1);

    expect(detailsBox!.x).toBeGreaterThanOrEqual(gridBox!.x - 1);
    expect(summaryBox!.x).toBeGreaterThanOrEqual(gridBox!.x - 1);
    expect(summaryBox!.y).toBeGreaterThanOrEqual(
      detailsBox!.y + detailsBox!.height - 1
    );
    await expect(orderSection).toBeVisible();
    await expect(customer).toBeVisible();
    await expect(documents).toBeVisible();

    const accessibleSectionOrder = await contentGrid
      .locator('[data-testid]')
      .evaluateAll((sections) =>
        sections
          .map((section) => section.getAttribute('data-testid'))
          .filter((testId) =>
            [
              'confirmation-order-section',
              'confirmation-customer-section',
              'confirmation-summary',
              'confirmation-documents-section'
            ].includes(testId ?? '')
          )
      );
    expect(accessibleSectionOrder).toEqual([
      'confirmation-order-section',
      'confirmation-customer-section',
      'confirmation-summary',
      'confirmation-documents-section'
    ]);

    const localOverflow = await panels.evaluateAll((panelElements) =>
      panelElements.map((panel) => ({
          width: panel.clientWidth,
          scrollWidth: panel.scrollWidth
        }))
    );
    for (const section of localOverflow) {
      expect(
        section.scrollWidth,
        'confirmation panel should not overflow locally'
      ).toBeLessThanOrEqual(section.width + 1);
    }

    const globalOverflow = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth
    }));
    expect(globalOverflow.documentWidth).toBeLessThanOrEqual(
      globalOverflow.viewportWidth + 1
    );
  });

  test('keeps the PDF action stable while its document becomes ready', async ({
    page
  }) => {
    let documentReady = false;
    const purchaseOrderDocument: OrderConfirmationSnapshot['documents'][number] = {
      type: 'purchase_order',
      url: '/api/orders/documents/123e4567-e89b-42d3-a456-426614174012'
    };
    const requests = await mockConfirmation(page, () => ({
      ...confirmationSnapshot,
      documents: documentReady
        ? [...confirmationSnapshot.documents, purchaseOrderDocument]
        : [purchaseOrderDocument]
    }));
    await page.goto(`/order/confirmation#token=${TEST_BOOTSTRAP_TOKEN}`);

    const successHeading = page.getByRole('heading', {
      level: 1,
      name: 'Vaše naročilo je potrjeno'
    });
    const documents = page.getByTestId('confirmation-documents-section');
    const pdfAction = page.getByTestId('order-confirmation-pdf');
    const preparingStatus = documents.getByText('Pripravljamo …', {
      exact: true
    });
    await expect(successHeading).toBeVisible();
    await expect(
      documents.getByRole('link', { name: /^Naročilnica / })
    ).toBeVisible();
    await expect(pdfAction).toHaveJSProperty('tagName', 'BUTTON');
    await expect(pdfAction).toBeDisabled();
    await expect(pdfAction).toContainText('PDF');
    await expect(pdfAction).toHaveClass(/site-button--primary/u);
    await expect(preparingStatus).toBeVisible();
    await expect(
      documents.getByRole('button', { name: 'Preveri zdaj' })
    ).toHaveCount(0);
    const initialDocumentsBox = await documents.boundingBox();
    expect(initialDocumentsBox).not.toBeNull();

    documentReady = true;
    await expect(pdfAction).toBeVisible({ timeout: 4_000 });
    await expect(pdfAction).toHaveJSProperty('tagName', 'A');
    await expect(pdfAction).toHaveClass(/site-button--primary/u);
    await expect(preparingStatus).toBeHidden();
    await expect(successHeading).toBeVisible();
    await expect(
      documents.getByRole('link', { name: /^Naročilnica / })
    ).toBeVisible();
    const readyDocumentsBox = await documents.boundingBox();
    expect(readyDocumentsBox).not.toBeNull();
    expect(Math.abs(readyDocumentsBox!.x - initialDocumentsBox!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(readyDocumentsBox!.y - initialDocumentsBox!.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(readyDocumentsBox!.width - initialDocumentsBox!.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(readyDocumentsBox!.height - initialDocumentsBox!.height)).toBeLessThanOrEqual(1);
    expect(requests.requestCount()).toBeGreaterThanOrEqual(2);
  });
});
