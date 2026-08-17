import {
  expect,
  test,
  type Locator
} from '@playwright/test';
import { assertAuthenticatedAdmin } from './support/auth';

const writeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

type PriceStyleContract = {
  visualDisplay: string;
  numberDisplay: string;
  numberAlignItems: string;
  fractionToPrimaryRatio: number;
  currencyToPrimaryRatio: number;
  fractionMarginTopToPrimaryRatio: number;
  currencyMarginTopToPrimaryRatio: number;
  currencyMarginLeftToPrimaryRatio: number;
};

type DescriptionStyleContract = {
  overflow: string;
  lineClamp: string;
  boxOrient: string;
  fontSize: number;
  titleFontSize: number;
  logicalHeight: number;
  logicalLineHeight: number;
  logicalGapAfterTitle: number;
  logicalGapBeforePrice: number;
  immediatelyFollowsTitle: boolean;
  priceImmediatelyFollowsDescription: boolean;
};

type TypographyContract = {
  contentFontSize: number;
  titleFontSize: number;
  descriptionFontSize: number;
  priceFontSize: number;
  titleToContentRatio: number;
  descriptionToContentRatio: number;
  priceToContentRatio: number;
};

type RelatedCardContract = {
  descriptionText: string;
  priceText: string;
  priceAccessibleName: string | null;
  logicalHeight: number;
  logicalWidth: number;
  mediaWidthRatio: number;
  logicalInlineActionGap: number;
  logicalGapBeforePurchaseRow: number;
  contentJustification: string;
  purchaseRowDisplay: string;
  purchaseRowAlignItems: string;
  purchaseRowFlexWrap: string;
  priceAndActionShareRow: boolean;
  actionFollowsPrice: boolean;
  descriptionStyle: DescriptionStyleContract;
  typography: TypographyContract;
  priceStyle: PriceStyleContract;
};

const normalizeText = (value: string | null | undefined) =>
  (value ?? '').replace(/\s+/gu, ' ').trim();

async function readPriceStyle(price: Locator): Promise<PriceStyleContract> {
  return price.evaluate((root) => {
    const primary = root.querySelector<HTMLElement>('.storefront-price-primary');
    const visual = root.querySelector<HTMLElement>(
      '.storefront-listing-price-visual'
    );
    const number = root.querySelector<HTMLElement>(
      '.storefront-listing-price-number'
    );
    const fraction = root.querySelector<HTMLElement>(
      '.storefront-listing-price-fraction'
    );
    const currency = root.querySelector<HTMLElement>(
      '.storefront-listing-price-currency'
    );
    if (!primary || !visual || !number || !fraction || !currency) {
      throw new Error('Listing-style price anatomy is incomplete.');
    }

    const primaryStyle = getComputedStyle(primary);
    const fractionStyle = getComputedStyle(fraction);
    const currencyStyle = getComputedStyle(currency);
    const primaryFontSize = Number.parseFloat(primaryStyle.fontSize);

    return {
      visualDisplay: getComputedStyle(visual).display,
      numberDisplay: getComputedStyle(number).display,
      numberAlignItems: getComputedStyle(number).alignItems,
      fractionToPrimaryRatio:
        Number.parseFloat(fractionStyle.fontSize) / primaryFontSize,
      currencyToPrimaryRatio:
        Number.parseFloat(currencyStyle.fontSize) / primaryFontSize,
      fractionMarginTopToPrimaryRatio:
        Number.parseFloat(fractionStyle.marginTop) / primaryFontSize,
      currencyMarginTopToPrimaryRatio:
        Number.parseFloat(currencyStyle.marginTop) / primaryFontSize,
      currencyMarginLeftToPrimaryRatio:
        Number.parseFloat(currencyStyle.marginLeft) / primaryFontSize
    };
  });
}

function expectCompactListingPriceStyle(style: PriceStyleContract) {
  expect(style.visualDisplay).toBe('inline-flex');
  // A nested inline-flex becomes a blockified flex item inside the visual row.
  expect(style.numberDisplay).toBe('flex');
  expect(style.numberAlignItems).toBe('flex-start');
  expect(style.fractionToPrimaryRatio).toBeGreaterThanOrEqual(0.54);
  expect(style.fractionToPrimaryRatio).toBeLessThanOrEqual(0.62);
  expect(style.currencyToPrimaryRatio).toBeCloseTo(
    style.fractionToPrimaryRatio,
    2
  );
  expect(style.fractionMarginTopToPrimaryRatio).toBeGreaterThan(0);
  expect(style.currencyMarginTopToPrimaryRatio)
    .toBeCloseTo(style.fractionMarginTopToPrimaryRatio, 2);
  expect(style.currencyMarginLeftToPrimaryRatio).toBeGreaterThan(0);
}

async function expectRelatedCardContract(
  card: Locator
): Promise<RelatedCardContract> {
  await expect(card).toBeVisible({ timeout: 15_000 });

  const price = card.locator('.storefront-product-card-price');
  const title = card.locator('.storefront-product-card-title');
  const description = card.locator('.storefront-product-card-description');
  const primaryPrice = price.locator('.storefront-price-primary');
  const visualPrice = primaryPrice.locator('.storefront-listing-price-visual');
  const currency = visualPrice.locator('.storefront-listing-price-currency');
  const media = card.locator('.storefront-product-card-media');
  const purchaseRow = card.locator(
    '.storefront-related-product-purchase-row'
  );
  const action = card.locator('.storefront-product-card-action');
  const quickAdd = card.locator('.storefront-related-product-quick-add');
  const quantity = card.locator('.storefront-related-product-quantity');
  const cartButton = card.locator('.storefront-related-product-cart-button');

  await expect(price).toBeVisible();
  await expect(title).toBeVisible();
  await expect(
    description,
    'related cards should show the canonical product-description excerpt'
  ).toBeVisible();
  await expect(primaryPrice).toBeVisible();
  await expect(visualPrice).toBeVisible();
  await expect(media).toBeVisible();
  await expect(
    purchaseRow,
    'related price and quick-add controls should share a dedicated layout row'
  ).toBeVisible();
  await expect(action).toBeVisible();
  await expect(quickAdd).toBeVisible();
  await expect(quantity).toBeVisible();
  await expect(cartButton).toBeVisible();
  await expect(currency).toHaveText('€');
  await expect(
    card.locator('.storefront-product-card-availability'),
    'related cards should not render a stock/availability row'
  ).toHaveCount(0);
  await expect(
    card.locator('[data-product-canvas-element="product-related-card-stock"]'),
    'the admin canvas should not retain an empty related-stock wrapper'
  ).toHaveCount(0);
  await expect(
    card.locator('.storefront-price-tax'),
    'related cards should not render the net/DDV breakdown'
  ).toHaveCount(0);
  await expect(
    card.locator('[data-product-canvas-element="product-related-card-tax"]'),
    'the admin canvas should not retain an empty related-tax wrapper'
  ).toHaveCount(0);

  const cardText = normalizeText(await card.textContent());
  const descriptionText = normalizeText(await description.textContent());
  const priceText = normalizeText(await price.textContent());
  expect(
    descriptionText,
    'the related description preview should contain real catalogue copy'
  ).not.toBe('');
  expect(cardText).not.toMatch(/\bNa\s+zalogi\b/iu);
  expect(priceText).not.toMatch(/\bz\s+DDV\b/iu);
  expect(priceText).not.toMatch(/\bbrez\s+DDV\b/iu);
  expect(priceText).not.toMatch(/\bDDV\s*\d+(?:[.,]\d+)?\s*%/iu);
  expect(priceText, 'the related card should show a gross price and unit only')
    .toMatch(/^\d+(?:\s*[–-]\s*\d+)?\s*€(?:\s*\/\s*\p{L}+)?$/u);
  expect(
    await visualPrice.evaluate((element) => (
      element.lastElementChild?.classList.contains(
        'storefront-listing-price-currency'
      ) ?? false
    )),
    'the small euro sign should follow the final single/range price number'
  ).toBeTruthy();

  const priceAccessibleName = await primaryPrice.getAttribute('aria-label');
  expect(priceAccessibleName, 'the visually split price should retain a readable label')
    .toMatch(/^\d+,\d{2}(?:\s*[–-]\s*\d+,\d{2})?\s*€$/u);

  const geometry = await card.evaluate((root) => {
    const cardRoot = root as HTMLElement;
    const content = cardRoot.querySelector<HTMLElement>(
      '.storefront-product-card-content'
    );
    const priceElement = cardRoot.querySelector<HTMLElement>(
      '.storefront-product-card-price'
    );
    const primaryPriceElement = cardRoot.querySelector<HTMLElement>(
      '.storefront-product-card-price .storefront-price-primary'
    );
    const titleElement = cardRoot.querySelector<HTMLElement>(
      '.storefront-product-card-title'
    );
    const descriptionElement = cardRoot.querySelector<HTMLElement>(
      '.storefront-product-card-description'
    );
    const mediaElement = cardRoot.querySelector<HTMLElement>(
      '.storefront-product-card-media'
    );
    const purchaseRowElement = cardRoot.querySelector<HTMLElement>(
      '.storefront-related-product-purchase-row'
    );
    const actionElement = cardRoot.querySelector<HTMLElement>(
      '.storefront-product-card-action'
    );
    const quickAddElement = cardRoot.querySelector<HTMLElement>(
      '.storefront-related-product-quick-add'
    );
    if (
      !content
      || !titleElement
      || !descriptionElement
      || !mediaElement
      || !purchaseRowElement
      || !priceElement
      || !primaryPriceElement
      || !actionElement
      || !quickAddElement
    ) {
      throw new Error('Related-card content geometry is incomplete.');
    }

    const topLevelChild = (element: HTMLElement) => {
      let current = element;
      while (current.parentElement && current.parentElement !== content) {
        current = current.parentElement;
      }
      return current;
    };
    const titleChild = topLevelChild(titleElement);
    const descriptionChild = topLevelChild(descriptionElement);
    const rootBox = cardRoot.getBoundingClientRect();
    const titleBox = titleElement.getBoundingClientRect();
    const descriptionContentBox = descriptionElement.getBoundingClientRect();
    const mediaBox = mediaElement.getBoundingClientRect();
    const purchaseRowBox = purchaseRowElement.getBoundingClientRect();
    const priceBox = priceElement.getBoundingClientRect();
    const quickAddBox = quickAddElement.getBoundingClientRect();
    const transformScaleX = cardRoot.offsetWidth > 0
      ? rootBox.width / cardRoot.offsetWidth
      : 1;
    const transformScaleY = cardRoot.offsetHeight > 0
      ? rootBox.height / cardRoot.offsetHeight
      : transformScaleX;
    const themeHost = cardRoot.closest<HTMLElement>('[data-storefront-theme]');
    const commercialScale = Number.parseFloat(
      getComputedStyle(themeHost ?? cardRoot)
        .getPropertyValue('--commercial-storefront-scale')
    ) || 1;
    const descriptionStyle = getComputedStyle(descriptionElement);
    const titleStyle = getComputedStyle(titleElement);
    const contentStyle = getComputedStyle(content);
    const primaryPriceStyle = getComputedStyle(primaryPriceElement);
    const purchaseRowStyle = getComputedStyle(purchaseRowElement);
    const contentFontSize = Number.parseFloat(contentStyle.fontSize);
    const titleFontSize = Number.parseFloat(titleStyle.fontSize);
    const descriptionFontSize = Number.parseFloat(descriptionStyle.fontSize);
    const priceFontSize = Number.parseFloat(primaryPriceStyle.fontSize);
    const priceActionOverlapY = Math.min(priceBox.bottom, quickAddBox.bottom)
      - Math.max(priceBox.top, quickAddBox.top);

    return {
      logicalHeight: rootBox.height / transformScaleY * commercialScale,
      logicalWidth: rootBox.width / transformScaleX * commercialScale,
      mediaWidthRatio: mediaBox.width / rootBox.width,
      logicalInlineActionGap:
        (quickAddBox.left - priceBox.right) / transformScaleX
        * commercialScale,
      logicalGapBeforePurchaseRow:
        (purchaseRowBox.top - descriptionContentBox.bottom) / transformScaleY
        * commercialScale,
      contentJustification: contentStyle.justifyContent,
      purchaseRowDisplay: purchaseRowStyle.display,
      purchaseRowAlignItems: purchaseRowStyle.alignItems,
      purchaseRowFlexWrap: purchaseRowStyle.flexWrap,
      priceAndActionShareRow:
        priceActionOverlapY > 0
        && quickAddBox.left >= priceBox.right - 1,
      actionFollowsPrice: Boolean(
        priceElement.compareDocumentPosition(actionElement)
        & Node.DOCUMENT_POSITION_FOLLOWING
      ),
      descriptionStyle: {
        overflow: descriptionStyle.overflow,
        lineClamp: descriptionStyle.getPropertyValue('-webkit-line-clamp'),
        boxOrient: descriptionStyle.getPropertyValue('-webkit-box-orient'),
        fontSize: Number.parseFloat(descriptionStyle.fontSize),
        titleFontSize: Number.parseFloat(titleStyle.fontSize),
        logicalHeight:
          descriptionContentBox.height / transformScaleY * commercialScale,
        logicalLineHeight:
          Number.parseFloat(descriptionStyle.lineHeight) * commercialScale,
        logicalGapAfterTitle:
          (descriptionContentBox.top - titleBox.bottom) / transformScaleY
          * commercialScale,
        logicalGapBeforePrice:
          (priceBox.top - descriptionContentBox.bottom) / transformScaleY
          * commercialScale,
        immediatelyFollowsTitle:
          titleChild.nextElementSibling === descriptionChild,
        priceImmediatelyFollowsDescription:
          descriptionChild.nextElementSibling
          === topLevelChild(purchaseRowElement)
      },
      typography: {
        contentFontSize,
        titleFontSize,
        descriptionFontSize,
        priceFontSize,
        titleToContentRatio: titleFontSize / contentFontSize,
        descriptionToContentRatio: descriptionFontSize / contentFontSize,
        priceToContentRatio: priceFontSize / contentFontSize
      }
    };
  });

  expect(
    geometry.descriptionStyle.immediatelyFollowsTitle,
    'the description excerpt should be placed directly after the product title'
  ).toBeTruthy();
  expect(
    geometry.descriptionStyle.priceImmediatelyFollowsDescription,
    'the price should be placed directly after the description excerpt'
  ).toBeTruthy();
  expect(geometry.descriptionStyle.overflow).toBe('hidden');
  expect(geometry.descriptionStyle.lineClamp).toBe('1');
  expect(geometry.descriptionStyle.boxOrient).toBe('vertical');
  expect(
    geometry.descriptionStyle.fontSize,
    'description copy should remain subordinate to the card title'
  ).toBeLessThan(geometry.descriptionStyle.titleFontSize);
  expect(
    geometry.descriptionStyle.logicalHeight,
    'the related description excerpt should stay to one compact line'
  ).toBeLessThanOrEqual(
    geometry.descriptionStyle.logicalLineHeight + 1
  );
  expect(
    geometry.descriptionStyle.logicalGapAfterTitle,
    'the enlarged description should have a deliberate gap beneath the title'
  ).toBeGreaterThanOrEqual(4);
  expect(geometry.descriptionStyle.logicalGapAfterTitle).toBeLessThanOrEqual(14);
  expect(
    geometry.descriptionStyle.logicalGapBeforePrice,
    'the bottom-aligned purchase row should follow, not overlap, the description'
  ).toBeGreaterThanOrEqual(0);
  expect(
    geometry.logicalGapBeforePurchaseRow,
    'commerce should sit materially closer to the description instead of being pushed to the card bottom'
  ).toBeLessThanOrEqual(24);

  expect(
    geometry.typography.titleFontSize,
    'the related title should be at least one pixel larger than the former 18px treatment'
  ).toBeGreaterThanOrEqual(19);
  expect(
    geometry.typography.descriptionFontSize,
    'the related description should be at least one pixel larger than the former 14px treatment'
  ).toBeGreaterThanOrEqual(15);
  expect(
    geometry.typography.priceFontSize,
    'the related price should be at least two pixels larger than the former 20px treatment'
  ).toBeGreaterThanOrEqual(22);
  expect(geometry.typography.titleToContentRatio).toBeGreaterThan(1.125);
  expect(geometry.typography.descriptionToContentRatio).toBeGreaterThan(0.875);
  expect(geometry.typography.priceToContentRatio).toBeGreaterThan(1.25);
  expect(
    geometry.typography.titleFontSize,
    'the related title should be more prominent than its description'
  ).toBeGreaterThan(geometry.typography.descriptionFontSize);
  expect(
    geometry.typography.priceFontSize,
    'the related price should be at least as prominent as its title'
  ).toBeGreaterThanOrEqual(geometry.typography.titleFontSize);

  expect(geometry.purchaseRowDisplay).toBe('flex');
  expect(geometry.purchaseRowAlignItems).toBe('center');
  expect(geometry.purchaseRowFlexWrap).toBe('wrap');
  expect(
    geometry.priceAndActionShareRow,
    'price, quantity, and cart action should share one row when the card has room'
  ).toBeTruthy();
  expect(
    geometry.actionFollowsPrice,
    'quick add should follow the price in DOM and reading order'
  ).toBeTruthy();
  expect(
    geometry.mediaWidthRatio,
    'the related image column should be slightly narrower than its former 40%'
  ).toBeGreaterThanOrEqual(0.33);
  expect(geometry.mediaWidthRatio).toBeLessThan(0.4);
  expect(
    ['flex-start', 'space-between'],
    'related-card content should use an intentional compact flex alignment'
  ).toContain(geometry.contentJustification);
  expect(
    geometry.logicalInlineActionGap,
    'quick add should not overlap the price'
  ).toBeGreaterThanOrEqual(0);
  expect(
    geometry.logicalInlineActionGap,
    'price and quick add should retain a compact inline gap'
  ).toBeLessThanOrEqual(28);
  expect(
    geometry.logicalHeight,
    'the reduced related-image baseline should keep the card near 144px tall'
  ).toBeLessThanOrEqual(150);

  const priceStyle = await readPriceStyle(price);
  expectCompactListingPriceStyle(priceStyle);

  return {
    descriptionText,
    priceText,
    priceAccessibleName,
    ...geometry,
    priceStyle
  };
}

function expectPriceStyleParity(
  actual: PriceStyleContract,
  expected: PriceStyleContract
) {
  expect(actual.visualDisplay).toBe(expected.visualDisplay);
  expect(actual.numberDisplay).toBe(expected.numberDisplay);
  expect(actual.numberAlignItems).toBe(expected.numberAlignItems);
  expect(actual.fractionToPrimaryRatio)
    .toBeCloseTo(expected.fractionToPrimaryRatio, 2);
  expect(actual.currencyToPrimaryRatio)
    .toBeCloseTo(expected.currencyToPrimaryRatio, 2);
  expect(actual.fractionMarginTopToPrimaryRatio)
    .toBeCloseTo(expected.fractionMarginTopToPrimaryRatio, 2);
  expect(actual.currencyMarginTopToPrimaryRatio)
    .toBeCloseTo(expected.currencyMarginTopToPrimaryRatio, 2);
  expect(actual.currencyMarginLeftToPrimaryRatio)
    .toBeCloseTo(expected.currencyMarginLeftToPrimaryRatio, 2);
}

test.describe('related-product compact commerce card', () => {
  test('uses listing price grammar, omits stock/tax, shrinks, and matches the admin preview', async ({
    page,
    request
  }) => {
    await assertAuthenticatedAdmin(request);
    const writes: string[] = [];
    await page.route('**/api/**', async (route) => {
      const outgoing = route.request();
      const pathname = new URL(outgoing.url()).pathname;
      if (
        writeMethods.has(outgoing.method())
        && pathname === '/api/analytics/event'
      ) {
        await route.abort('blockedbyclient');
        return;
      }
      if (
        writeMethods.has(outgoing.method())
        && pathname.startsWith('/api/admin/')
      ) {
        writes.push(`${outgoing.method()} ${pathname}`);
        await route.abort('blockedbyclient');
        return;
      }
      await route.continue();
    });

    await page.setViewportSize({ width: 1467, height: 1040 });
    await page.goto('/products/materiali/kovine');
    const listingCard = page.locator('.storefront-product-listing-card').first();
    await expect(listingCard).toBeVisible({ timeout: 15_000 });
    const listingPriceStyle = await readPriceStyle(
      listingCard.locator('.storefront-product-card-price')
    );
    expectCompactListingPriceStyle(listingPriceStyle);

    await page.goto('/products/materiali/items/aluminijasta-plosca');
    const purchaseArea = page.locator('.storefront-product-purchase-area');
    await expect(
      purchaseArea.locator('.storefront-price-tax'),
      'the main product purchase panel should retain its tax breakdown'
    ).toBeVisible();
    await expect(purchaseArea).toContainText(/brez\s+DDV/iu);
    const publicContract = await expectRelatedCardContract(
      page.locator('.storefront-related-product-card').first()
    );
    expectPriceStyleParity(publicContract.priceStyle, listingPriceStyle);

    await page.goto('/admin/podoba/artikli');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Artikli', exact: true })
    ).toBeVisible({ timeout: 15_000 });
    const productSelect = page.getByLabel('Artikel v predogledu');
    await expect(productSelect).toBeVisible();
    await productSelect.selectOption('aluminijasta-plosca');
    await expect(productSelect).toHaveValue('aluminijasta-plosca');

    const articleButton = page.getByRole('group', {
      name: 'Stran predogleda'
    }).getByRole('button', {
      name: 'Artikel',
      exact: true
    });
    await articleButton.click();
    await expect(articleButton).toHaveAttribute('aria-pressed', 'true');

    const preview = page.locator(
      '[data-product-preview-frame] [data-admin-product-live-preview="true"]:visible'
    ).first();
    await expect(preview).toBeVisible({ timeout: 15_000 });
    await expect(
      preview.locator('.storefront-product-purchase-area .storefront-price-tax'),
      'the main purchase panel in the admin preview should stay unchanged'
    ).toBeVisible();
    const adminContract = await expectRelatedCardContract(
      preview.locator('.storefront-related-product-card').first()
    );

    expect(adminContract.priceText).toBe(publicContract.priceText);
    expect(
      adminContract.descriptionText,
      'admin preview should use the same canonical description excerpt as public'
    ).toBe(publicContract.descriptionText);
    expect(adminContract.priceAccessibleName)
      .toBe(publicContract.priceAccessibleName);
    expect(adminContract.logicalWidth).toBeGreaterThan(0);
    expect(publicContract.logicalWidth).toBeGreaterThan(0);
    expect(
      Math.abs(adminContract.logicalHeight - publicContract.logicalHeight),
      'public/admin related-card heights should match after preview scaling'
    ).toBeLessThanOrEqual(1.5);
    expect(
      Math.abs(
        adminContract.mediaWidthRatio - publicContract.mediaWidthRatio
      ),
      'public/admin related image-column ratios should match'
    ).toBeLessThanOrEqual(0.005);
    expect(adminContract.contentJustification)
      .toBe(publicContract.contentJustification);
    expect(adminContract.purchaseRowDisplay)
      .toBe(publicContract.purchaseRowDisplay);
    expect(adminContract.purchaseRowAlignItems)
      .toBe(publicContract.purchaseRowAlignItems);
    expect(adminContract.priceAndActionShareRow)
      .toBe(publicContract.priceAndActionShareRow);
    expect(adminContract.typography.titleToContentRatio)
      .toBeCloseTo(publicContract.typography.titleToContentRatio, 3);
    expect(adminContract.typography.descriptionToContentRatio)
      .toBeCloseTo(publicContract.typography.descriptionToContentRatio, 3);
    expect(adminContract.typography.priceToContentRatio)
      .toBeCloseTo(publicContract.typography.priceToContentRatio, 3);
    expect(adminContract.typography.titleFontSize)
      .toBeCloseTo(publicContract.typography.titleFontSize, 3);
    expect(adminContract.typography.descriptionFontSize)
      .toBeCloseTo(publicContract.typography.descriptionFontSize, 3);
    expect(adminContract.typography.priceFontSize)
      .toBeCloseTo(publicContract.typography.priceFontSize, 3);
    expect(adminContract.descriptionStyle.lineClamp)
      .toBe(publicContract.descriptionStyle.lineClamp);
    expect(adminContract.descriptionStyle.boxOrient)
      .toBe(publicContract.descriptionStyle.boxOrient);
    expect(
      Math.abs(
        adminContract.descriptionStyle.logicalHeight
        - publicContract.descriptionStyle.logicalHeight
      ),
      'public/admin description heights should match after preview scaling'
    ).toBeLessThanOrEqual(1.5);
    expect(
      Math.abs(
        adminContract.descriptionStyle.logicalGapAfterTitle
        - publicContract.descriptionStyle.logicalGapAfterTitle
      ),
      'public/admin title-to-description spacing should match after preview scaling'
    ).toBeLessThanOrEqual(1.5);
    expect(
      Math.abs(
        adminContract.logicalGapBeforePurchaseRow
        - publicContract.logicalGapBeforePurchaseRow
      ),
      'public/admin description-to-commerce spacing should match after preview scaling'
    ).toBeLessThanOrEqual(1.5);
    expectPriceStyleParity(adminContract.priceStyle, publicContract.priceStyle);
    expect(
      writes,
      'public/admin product-preview inspection should remain read-only'
    ).toEqual([]);
  });

  test('keeps quantity and cart controls usable without horizontal overflow on a narrow screen', async ({
    page
  }) => {
    const writes: string[] = [];
    await page.route('**/api/**', async (route) => {
      const outgoing = route.request();
      const pathname = new URL(outgoing.url()).pathname;
      if (
        writeMethods.has(outgoing.method())
        && pathname === '/api/analytics/event'
      ) {
        await route.abort('blockedbyclient');
        return;
      }
      if (writeMethods.has(outgoing.method())) {
        writes.push(`${outgoing.method()} ${pathname}`);
        await route.abort('blockedbyclient');
        return;
      }
      await route.continue();
    });

    await page.setViewportSize({ width: 320, height: 844 });
    await page.goto('/products/materiali/items/aluminijasta-plosca');
    const card = page.locator('.storefront-related-product-card').first();
    await expect(card).toBeVisible({ timeout: 15_000 });

    const geometry = await card.evaluate((root) => {
      const cardRoot = root as HTMLElement;
      const row = cardRoot.querySelector<HTMLElement>(
        '.storefront-related-product-purchase-row'
      );
      const price = cardRoot.querySelector<HTMLElement>(
        '.storefront-product-card-price'
      );
      const quickAdd = cardRoot.querySelector<HTMLElement>(
        '.storefront-related-product-quick-add'
      );
      const quantity = cardRoot.querySelector<HTMLElement>(
        '.storefront-related-product-quantity'
      );
      const cart = cardRoot.querySelector<HTMLElement>(
        '.storefront-related-product-cart-button'
      );
      if (!row || !price || !quickAdd || !quantity || !cart) {
        throw new Error('Narrow related-card purchase controls are incomplete.');
      }

      const cardBox = cardRoot.getBoundingClientRect();
      const rowBox = row.getBoundingClientRect();
      const priceBox = price.getBoundingClientRect();
      const quickAddBox = quickAdd.getBoundingClientRect();
      const quantityBox = quantity.getBoundingClientRect();
      const cartBox = cart.getBoundingClientRect();
      const overlapY = Math.min(priceBox.bottom, quickAddBox.bottom)
        - Math.max(priceBox.top, quickAddBox.top);
      const sameRow = overlapY > 0;
      const rowStyle = getComputedStyle(row);

      return {
        cardOverflow: cardRoot.scrollWidth - cardRoot.clientWidth,
        rowOverflow: row.scrollWidth - row.clientWidth,
        documentOverflow:
          document.documentElement.scrollWidth
          - document.documentElement.clientWidth,
        rowFlexWrap: rowStyle.getPropertyValue('flex-wrap'),
        rowWithinCard:
          rowBox.left >= cardBox.left - 1
          && rowBox.right <= cardBox.right + 1,
        controlsWithinCard:
          quantityBox.left >= cardBox.left - 1
          && cartBox.right <= cardBox.right + 1
          && quantityBox.top >= cardBox.top - 1
          && cartBox.bottom <= cardBox.bottom + 1,
        controlsDoNotOverlap: quantityBox.right <= cartBox.left + 1,
        priceBeforeAction:
          sameRow
            ? priceBox.right <= quickAddBox.left + 1
            : priceBox.bottom <= quickAddBox.top + 1,
        quantityWidth: quantityBox.width,
        quantityHeight: quantityBox.height,
        cartWidth: cartBox.width,
        cartHeight: cartBox.height
      };
    });

    expect(geometry.cardOverflow).toBeLessThanOrEqual(1);
    expect(geometry.rowOverflow).toBeLessThanOrEqual(1);
    expect(geometry.documentOverflow).toBeLessThanOrEqual(1);
    expect(
      geometry.rowFlexWrap,
      'the narrow card should be allowed to wrap its commerce controls safely'
    ).toBe('wrap');
    expect(geometry.rowWithinCard).toBeTruthy();
    expect(geometry.controlsWithinCard).toBeTruthy();
    expect(geometry.controlsDoNotOverlap).toBeTruthy();
    expect(geometry.priceBeforeAction).toBeTruthy();
    expect(geometry.quantityWidth).toBeGreaterThanOrEqual(44);
    expect(geometry.quantityHeight).toBeGreaterThanOrEqual(28);
    expect(geometry.cartWidth).toBeGreaterThanOrEqual(28);
    expect(geometry.cartHeight).toBeGreaterThanOrEqual(28);
    expect(writes, 'narrow layout inspection should remain read-only').toEqual([]);
  });
});
