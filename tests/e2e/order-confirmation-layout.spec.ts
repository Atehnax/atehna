import { expect, test, type Locator, type Page } from '@playwright/test';
import type { OrderConfirmationSnapshot } from '@/commercial/order/contracts';

const TEST_BOOTSTRAP_TOKEN = `ath_order_${'A'.repeat(43)}`;
const TEST_ACCESS_ID = '123e4567-e89b-42d3-a456-426614174000';
const TEST_ACCESS_COOKIE = `ath_order_access_${TEST_ACCESS_ID.replaceAll('-', '')}`;

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
  test('uses one compact card with the reference zero-discount summary and aligned desktop columns', async ({
    page
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await mockConfirmation(page);
    await page.goto(`/order/confirmation#token=${TEST_BOOTSTRAP_TOKEN}`);

    const confirmationHeading = page.getByTestId('order-confirmation-heading');
    await expect(confirmationHeading).toHaveJSProperty('tagName', 'H1');
    await expect(confirmationHeading).toHaveText('Naročilo je sprejeto');
    await expect(confirmationHeading).toHaveCSS('font-size', '30px');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(confirmationHeading).toHaveCSS('font-size', '24px');
    await page.setViewportSize({ width: 1440, height: 1000 });

    const pageContent = page.getByTestId('order-confirmation-page');
    const card = page.getByTestId('order-confirmation-content-card');
    const orderSection = card.getByTestId('confirmation-order-section');
    const summary = card.getByTestId('confirmation-summary');
    const customer = card.getByTestId('confirmation-customer-section');
    const documents = card.getByTestId('confirmation-documents-section');

    await expect(card).toBeVisible();
    await expect(pageContent.locator('.site-card')).toHaveCount(1);
    await expect(card.locator('.site-card')).toHaveCount(0);
    await expect(summary.getByRole('heading', { name: 'Povzetek naročila' })).toBeVisible();
    await expect(summary.locator('[data-summary-section="calculation"]')).toBeVisible();
    await expect(summary.getByRole('heading', { name: 'Izračun' })).toBeVisible();
    await expect(summary.locator('[data-summary-section="details"]')).toHaveCount(0);
    await expect(summary.getByRole('heading', { name: /Podrobnosti artikla/ })).toHaveCount(0);

    const summaryItem = summary.locator('[data-summary-item="41001"]');
    const itemBase = summaryItem.locator('[data-summary-row="item-base"]');
    const itemTitle = summaryItem.locator('[data-summary-item-title]');
    const itemMeta = summaryItem.locator('[data-summary-item-meta]');
    const itemExpression = itemBase.locator('[data-summary-item-expression]');
    const itemLineGross = itemBase.locator('[data-summary-item-line-gross]');
    await expect(summaryItem).toBeVisible();
    await expect(itemTitle).toHaveJSProperty('tagName', 'H5');
    await expect(itemTitle).toHaveText('Aluminijasta plošča 0,3 × 100 × 100 mm');
    await expect(itemMeta).toHaveText('SKU: MAT-KOV-ALU-0P3X100X100');
    await expect(itemExpression).toHaveText('5 kosov × 4,83 €');
    await expect(itemLineGross).toHaveText('24,16 €');
    await expect(summaryItem.locator('[data-summary-item-rounding-note]')).toHaveText('DDV je zaokrožen na ravni postavke.');
    await expect(summaryItem.locator('[data-summary-row="item-discount"]')).toHaveCount(0);
    await expect(summary.locator('[data-summary-row="net"]')).toContainText('Vmesna vsota brez DDV');
    await expect(summary.locator('[data-summary-row="net"]')).toContainText('19,80 €');
    await expect(summary.locator('[data-summary-row="tax"]')).toHaveCount(1);
    await expect(summary.locator('[data-summary-row="tax"]')).toHaveAttribute('data-summary-tax-rate', '0.22');
    await expect(summary.locator('[data-summary-row="tax"]')).toContainText('DDV (22 %)');
    await expect(summary.locator('[data-summary-row="tax"]')).toContainText('4,36 €');
    await expect(summary.locator('[data-summary-row="gross"]')).toContainText('Skupaj za plačilo');
    await expect(summary.locator('[data-summary-row="gross"]')).toContainText('24,16 €');

    const expressionStyle = await itemExpression.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        tagName: element.tagName,
        backgroundColor: style.backgroundColor,
        paddingLeft: style.paddingLeft,
        paddingRight: style.paddingRight,
        borderRadius: style.borderRadius
      };
    });
    expect(expressionStyle).toEqual({
      tagName: 'DT',
      backgroundColor: 'rgba(0, 0, 0, 0)',
      paddingLeft: '0px',
      paddingRight: '0px',
      borderRadius: '0px'
    });

    const netRow = summary.locator('[data-summary-row="net"]');
    const grossRow = summary.locator('[data-summary-row="gross"]');
    const [netLabelStyle, netValueStyle, grossLabelStyle, grossValueStyle, primaryColor] =
      await Promise.all([
        netRow.locator('dt').evaluate((element) => ({
          fontSize: getComputedStyle(element).fontSize,
          fontWeight: getComputedStyle(element).fontWeight
        })),
        netRow.locator('dd').evaluate((element) => ({
          fontSize: getComputedStyle(element).fontSize,
          fontWeight: getComputedStyle(element).fontWeight
        })),
        grossRow.locator('dt').evaluate((element) => ({
          color: getComputedStyle(element).color,
          fontSize: getComputedStyle(element).fontSize,
          fontWeight: getComputedStyle(element).fontWeight
        })),
        grossRow.locator('dd').evaluate((element) => ({
          color: getComputedStyle(element).color,
          fontSize: getComputedStyle(element).fontSize,
          fontWeight: getComputedStyle(element).fontWeight
        })),
        resolveThemeColor(grossRow, '--site-color-primary')
      ]);
    expect(Number.parseInt(netLabelStyle.fontWeight, 10)).toBeGreaterThanOrEqual(700);
    expect(Number.parseInt(netValueStyle.fontWeight, 10)).toBeGreaterThanOrEqual(700);
    expect(Number.parseFloat(grossLabelStyle.fontSize)).toBeGreaterThan(Number.parseFloat(netLabelStyle.fontSize));
    expect(Number.parseFloat(grossValueStyle.fontSize)).toBeGreaterThan(Number.parseFloat(grossLabelStyle.fontSize));
    expect(Number.parseInt(grossLabelStyle.fontWeight, 10)).toBeGreaterThanOrEqual(600);
    expect(Number.parseInt(grossValueStyle.fontWeight, 10)).toBeGreaterThanOrEqual(600);
    expect(grossLabelStyle.color).toBe(primaryColor);
    expect(grossValueStyle.color).toBe(primaryColor);

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

    const [itemBaseBox, itemExpressionBox, itemLineGrossBox] = await Promise.all([
      itemBase.boundingBox(),
      itemExpression.boundingBox(),
      itemLineGross.boundingBox()
    ]);
    expect(itemBaseBox).not.toBeNull();
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
      itemBaseBox!.x + itemBaseBox!.width + 1
    );
    await expect(
      documents.getByRole('link', { name: /^Potrditev naročila \(PDF\) / })
    ).toBeVisible();
    await expect(pageContent).not.toContainText('Številka naročila');
    await expect(pageContent).not.toContainText('#42');
    await expect(documents.locator('a[href^="/api/orders/documents/"]')).toHaveAttribute(
      'href',
      '/api/orders/documents/123e4567-e89b-42d3-a456-426614174010'
    );

    const [orderSectionBox, summaryBox, customerBox, documentsBox] = await Promise.all([
      orderSection.boundingBox(),
      summary.boundingBox(),
      customer.boundingBox(),
      documents.boundingBox()
    ]);
    expect(orderSectionBox).not.toBeNull();
    expect(summaryBox).not.toBeNull();
    expect(customerBox).not.toBeNull();
    expect(documentsBox).not.toBeNull();

    const orderSectionRight = orderSectionBox!.x + orderSectionBox!.width;
    const customerRight = customerBox!.x + customerBox!.width;
    const documentsRight = documentsBox!.x + documentsBox!.width;
    const orderSectionBottom = orderSectionBox!.y + orderSectionBox!.height;
    const customerBottom = customerBox!.y + customerBox!.height;
    const documentsBottom = documentsBox!.y + documentsBox!.height;
    const summaryBottom = summaryBox!.y + summaryBox!.height;
    const lowerRowBottom = Math.max(customerBottom, documentsBottom);

    expect(
      Math.abs(orderSectionBox!.x - customerBox!.x),
      'the item section and lower detail row should share their left edge'
    ).toBeLessThanOrEqual(5);
    expect(
      Math.abs(orderSectionRight - documentsRight),
      'customer and documents together should equal the item section width'
    ).toBeLessThanOrEqual(5);
    expect(
      Math.abs(customerBox!.y - documentsBox!.y),
      'customer and documents should start on the same lower row'
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(customerBottom - documentsBottom),
      'customer and documents should stretch to the same lower-row height'
    ).toBeLessThanOrEqual(1);
    expect(documentsBox!.x).toBeGreaterThanOrEqual(customerRight - 1);
    expect(customerBox!.y).toBeGreaterThanOrEqual(orderSectionBottom - 1);

    expect(summaryBox!.x).toBeGreaterThanOrEqual(orderSectionRight - 1);
    expect(summaryBox!.x).toBeGreaterThan(orderSectionBox!.x);
    expect(
      Math.abs(summaryBox!.y - orderSectionBox!.y),
      'the summary should start beside the item section'
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(summaryBottom - lowerRowBottom),
      'the summary should span the item and lower detail rows'
    ).toBeLessThanOrEqual(5);
    expect(
      summaryBox!.height,
      'the spanning summary should be taller than the top-left item section'
    ).toBeGreaterThan(orderSectionBox!.height);
    expect(
      Math.abs(summaryBox!.x - orderSectionRight),
      'the desktop columns should meet without an unintended gap'
    ).toBeLessThanOrEqual(5);
  });

  test('keeps distinct products and their discounts associated in a responsive multi-item calculation', async ({
    page
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await mockConfirmation(page, () => multiItemConfirmationSnapshot);
    await page.goto(`/order/confirmation#token=${TEST_BOOTSTRAP_TOKEN}`);

    const summary = page.getByTestId('confirmation-summary');
    const summaryItems = summary.locator('[data-summary-item]');
    const summaryItemList = summary.locator('[data-summary-items]');
    const summaryTotals = summary.locator('[data-summary-totals]');
    const aluminium = summary.locator('[data-summary-item="41001"]');
    const steel = summary.locator('[data-summary-item="52001"]');
    const aluminiumBase = aluminium.locator('[data-summary-row="item-base"]');
    const steelBase = steel.locator('[data-summary-row="item-base"]');
    const steelDiscount = steel.locator('[data-summary-row="item-discount"]');

    await expect(summaryItemList).toHaveJSProperty('tagName', 'UL');
    await expect(summaryItemList.locator(':scope > li[data-summary-item]')).toHaveCount(2);
    await expect(summaryItemList.locator(':scope > li > dl')).toHaveCount(2);
    await expect(summaryTotals).toHaveJSProperty('tagName', 'DL');
    await expect(summaryTotals.locator('[data-summary-row="net"]')).toHaveCount(1);
    await expect(summaryTotals.locator('[data-summary-row="gross"]')).toHaveCount(1);
    await expect(summaryTotals.locator('[data-summary-item]')).toHaveCount(0);

    await expect(summaryItems).toHaveCount(2);
    await expect(summaryItems.nth(0)).toHaveAttribute('data-summary-item', '41001');
    await expect(summaryItems.nth(1)).toHaveAttribute('data-summary-item', '52001');

    await expect(aluminium.locator('[data-summary-item-title]')).toHaveText(
      'Aluminijasta plošča 0,3 × 100 × 100 mm'
    );
    await expect(aluminium.locator('[data-summary-item-meta]')).toHaveText(
      'SKU: MAT-KOV-ALU-0P3X100X100'
    );
    await expect(aluminiumBase.locator('[data-summary-item-expression]')).toHaveText(
      '5 kosov × 4,83 €'
    );
    await expect(aluminiumBase.locator('[data-summary-item-line-gross]')).toHaveText('24,16 €');
    await expect(aluminium.locator('[data-summary-item-rounding-note]')).toHaveText(
      'DDV je zaokrožen na ravni postavke.'
    );
    await expect(aluminium.locator('[data-summary-row="item-discount"]')).toHaveCount(0);
    await expect(aluminium).not.toContainText('10,95 €');

    await expect(steel.locator('[data-summary-item-title]')).toHaveText(
      'Jeklena cev 20 × 2 mm'
    );
    await expect(steel.locator('[data-summary-item-meta]')).toHaveText(
      'SKU: CEV-JEK-20X2'
    );
    await expect(steelBase.locator('[data-summary-item-expression]')).toHaveText(
      '10 kosov × 10,95 €'
    );
    await expect(steelBase.locator('[data-summary-item-line-gross]')).toHaveText('109,50 €');
    await expect(steel.locator('[data-summary-item-rounding-note]')).toHaveCount(0);
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
      return summaryItems.evaluateAll((elements) =>
        elements.map((element) => {
          const base = element.querySelector<HTMLElement>('[data-summary-row="item-base"]');
          const expression = element.querySelector<HTMLElement>('[data-summary-item-expression]');
          const lineGross = element.querySelector<HTMLElement>('[data-summary-item-line-gross]');
          if (!base || !expression || !lineGross) throw new Error('Summary item alignment hooks are missing.');
          const itemRect = element.getBoundingClientRect();
          const baseRect = base.getBoundingClientRect();
          const expressionRect = expression.getBoundingClientRect();
          const lineGrossRect = lineGross.getBoundingClientRect();
          return {
            itemLeft: itemRect.left,
            itemRight: itemRect.right,
            itemWidth: itemRect.width,
            itemClientWidth: element.clientWidth,
            itemScrollWidth: element.scrollWidth,
            baseLeft: baseRect.left,
            baseRight: baseRect.right,
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
      const [summaryBox, alignment] = await Promise.all([
        summary.boundingBox(),
        readItemAlignment()
      ]);
      expect(summaryBox).not.toBeNull();
      expect(alignment).toHaveLength(2);
      expect(
        Math.abs(alignment[0].baseLeft - alignment[1].baseLeft),
        `${viewport.label} item lines should share a left edge`
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(alignment[0].baseRight - alignment[1].baseRight),
        `${viewport.label} item lines should share a right edge`
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(alignment[0].lineGrossRight - alignment[1].lineGrossRight),
        `${viewport.label} gross line amounts should be right aligned`
      ).toBeLessThanOrEqual(1);
      for (const item of alignment) {
        expect(
          Math.abs(item.expressionCenter - item.lineGrossCenter),
          `${viewport.label} gross amount should be vertically centered against its quantity calculation`
        ).toBeLessThanOrEqual(1);
        expect(item.lineGrossLeft).toBeGreaterThan(item.baseLeft);
        expect(item.itemLeft).toBeGreaterThanOrEqual(summaryBox!.x - 1);
        expect(item.itemRight).toBeLessThanOrEqual(summaryBox!.x + summaryBox!.width + 1);
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

    const summary = page.getByTestId('confirmation-summary');
    const aluminium = summary.locator('[data-summary-item="41001"]');
    const copper = summary.locator('[data-summary-item="53001"]');
    const aluminiumTitle = aluminium.locator('[data-summary-item-title]');
    const copperTitle = copper.locator('[data-summary-item-title]');

    await expect(aluminiumTitle).toHaveText('Aluminijasta plošča');
    await expect(aluminium.locator('[data-summary-item-expression]')).toHaveText(
      '5 kosov × 4,83 €'
    );
    await expect(copperTitle).toHaveText('Bakrena pločevina');
    await expect(copper.locator('[data-summary-item-expression]')).toHaveText('2 kosa × 6,10 €');
    await expect(aluminium.locator('[data-summary-item-meta]')).toHaveCount(0);
    await expect(copper.locator('[data-summary-item-meta]')).toHaveCount(0);
    await expect(summary).not.toContainText('Brez naziva različice');
    expect((await aluminiumTitle.textContent())?.match(/Aluminijasta plošča/gu)).toHaveLength(1);
    expect((await copperTitle.textContent())?.match(/Bakrena pločevina/gu)).toHaveLength(1);
  });

  test('keeps each item row to one combined title, its SKU, and a full-bleed image', async ({
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

    for (const removedText of [
      'Material:',
      'Debelina:',
      'Širina:',
      'Dolžina:',
      '24,16 €',
      '19,80 € brez DDV',
      'DDV 22 %',
      '5 kos'
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
    const summaryItem = summary.locator('[data-summary-item="41001"]');
    const itemBase = summaryItem.locator('[data-summary-row="item-base"]');
    const discountRow = summaryItem.locator('[data-summary-row="item-discount"]');
    const netRow = summary.locator('[data-summary-row="net"]');
    const taxRow = summary.locator('[data-summary-row="tax"]');
    const grossRow = summary.locator('[data-summary-row="gross"]');

    await expect(summaryItem.locator('[data-summary-item-title]')).toHaveText(
      'Aluminijasta plošča 0,3 × 100 × 100 mm'
    );
    await expect(itemBase.locator('[data-summary-item-expression]')).toHaveText(
      '30 kosov × 4,88 €'
    );
    await expect(itemBase.locator('[data-summary-item-line-gross]')).toHaveText('146,40 €');
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
      const successProbe = document.createElement('span');
      const primaryProbe = document.createElement('span');
      successProbe.style.color = 'var(--site-color-success)';
      primaryProbe.style.color = 'var(--site-color-primary)';
      element.append(successProbe, primaryProbe);
      const result = {
        success: window.getComputedStyle(successProbe).color,
        primary: window.getComputedStyle(primaryProbe).color
      };
      successProbe.remove();
      primaryProbe.remove();
      return result;
    });
    await expect(discountRow.locator('dd')).toHaveCSS('color', colors.success);
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

    const summary = page.getByTestId('confirmation-summary');
    const discountRow = summary.locator('[data-summary-item="41001"] [data-summary-row="item-discount"]');
    await expect(discountRow).toContainText('Popust');
    await expect(discountRow).toContainText('5 %');
    await expect(discountRow).toContainText('-7,32 €');
    await expect(summary).not.toContainText('Količinski popust');
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

    const summary = page.getByTestId('confirmation-summary');
    await expect(summary.locator('[data-summary-row="item-discount"]')).toHaveCount(0);
    await expect(summary).not.toContainText('Količinski popust');
    await expect(summary).not.toContainText('Popust');
  });

  test('uses informational styling and order wording while confirmation is pending', async ({ page }) => {
    await mockConfirmation(page, () => ({
      ...confirmationSnapshot,
      commitmentStatus: 'pending_confirmation'
    }));
    await page.goto(`/order/confirmation#token=${TEST_BOOTSTRAP_TOKEN}`);

    const status = page.getByTestId('order-submission-status');
    await expect(status.getByRole('heading', { level: 1, name: 'Naročilo je prejeto' })).toBeVisible();
    await expect(status).toContainText(
      'Vaše naročilo bomo pregledali in vam poslali ponudbo oziroma navodila za naročilnico.'
    );

    const infoColor = await resolveThemeColor(status, '--site-color-info');
    await expect(status).toHaveCSS('border-top-color', infoColor);
    await expect(status.locator('span[aria-hidden="true"]')).toHaveCSS('background-color', infoColor);
  });

  test('stacks the same card sections without horizontal overflow on mobile', async ({
    page
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockConfirmation(page);
    await page.goto(`/order/confirmation#token=${TEST_BOOTSTRAP_TOKEN}`);

    const card = page.getByTestId('order-confirmation-content-card');
    const orderSection = card.getByTestId('confirmation-order-section');
    const customer = card.getByTestId('confirmation-customer-section');
    const documents = card.getByTestId('confirmation-documents-section');
    const itemMedia = card.getByTestId('confirmation-item-media');
    const summary = card.getByTestId('confirmation-summary');
    await expect(card).toBeVisible();
    await expect(summary).toBeVisible();

    const [
      cardBox,
      orderSectionBox,
      summaryBox,
      customerBox,
      documentsBox,
      itemMediaBox
    ] = await Promise.all([
      card.boundingBox(),
      orderSection.boundingBox(),
      summary.boundingBox(),
      customer.boundingBox(),
      documents.boundingBox(),
      itemMedia.boundingBox()
    ]);
    expect(cardBox).not.toBeNull();
    expect(orderSectionBox).not.toBeNull();
    expect(summaryBox).not.toBeNull();
    expect(customerBox).not.toBeNull();
    expect(documentsBox).not.toBeNull();
    expect(itemMediaBox).not.toBeNull();
    expect(itemMediaBox!.width).toBeLessThanOrEqual(80);
    expect(Math.abs(itemMediaBox!.width - itemMediaBox!.height)).toBeLessThanOrEqual(1);

    const stackedSections = [orderSectionBox!, summaryBox!, customerBox!, documentsBox!];
    for (const sectionBox of stackedSections) {
      expect(sectionBox.x).toBeGreaterThanOrEqual(cardBox!.x - 1);
      expect(sectionBox.x + sectionBox.width).toBeLessThanOrEqual(
        cardBox!.x + cardBox!.width + 1
      );
    }
    expect(summaryBox!.y).toBeGreaterThanOrEqual(
      orderSectionBox!.y + orderSectionBox!.height - 1
    );
    expect(customerBox!.y).toBeGreaterThanOrEqual(
      summaryBox!.y + summaryBox!.height - 1
    );
    expect(documentsBox!.y).toBeGreaterThanOrEqual(
      customerBox!.y + customerBox!.height - 1
    );

    const accessibleSectionOrder = await card
      .locator(
        '[data-testid="confirmation-order-section"], [data-testid="confirmation-summary"], [data-testid="confirmation-customer-section"], [data-testid="confirmation-documents-section"]'
      )
      .evaluateAll((sections) =>
        sections.map((section) => section.getAttribute('data-testid'))
      );
    expect(accessibleSectionOrder).toEqual([
      'confirmation-order-section',
      'confirmation-summary',
      'confirmation-customer-section',
      'confirmation-documents-section'
    ]);

    const localOverflow = await card
      .locator(
        '[data-testid="confirmation-order-section"], [data-testid="confirmation-summary"], [data-testid="confirmation-customer-section"], [data-testid="confirmation-documents-section"]'
      )
      .evaluateAll((sections) =>
        sections.map((section) => ({
          testId: section.getAttribute('data-testid'),
          width: section.clientWidth,
          scrollWidth: section.scrollWidth
        }))
      );
    for (const section of localOverflow) {
      expect(
        section.scrollWidth,
        `${section.testId ?? 'confirmation section'} should not overflow locally`
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

  test('silently adds a document while keeping the confirmation visible', async ({
    page
  }) => {
    const requests = await mockConfirmation(page, (requestNumber) => ({
      ...confirmationSnapshot,
      documents:
        requestNumber === 1
          ? [
              {
                type: 'purchase_order',
                url: '/api/orders/documents/123e4567-e89b-42d3-a456-426614174012'
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
    ).toHaveCount(0);
    await expect(
      documents.getByRole('button', { name: 'Preveri zdaj' })
    ).toHaveCount(0);

    await expect(
      documents.getByRole('link', { name: /^Potrditev naročila \(PDF\) / })
    ).toBeVisible({ timeout: 4_000 });
    await expect(successHeading).toBeVisible();
    expect(requests.requestCount()).toBeGreaterThanOrEqual(2);
  });
});
