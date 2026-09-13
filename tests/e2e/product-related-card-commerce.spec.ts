import {
  expect,
  type Locator
} from '@playwright/test';
import {
  chooseAppearanceEditorCompactSelectOption,
  getAppearanceEditorCompactSelect,
  readAppearanceEditorCompactSelectValue
} from './support/appearance-editor-compact-select';
import { assertAuthenticatedAdmin } from './support/auth';
import { legacyProductAppearanceTest as test } from './support/product-appearance-fixture';

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
  logicalGapAfterHeading: number;
  logicalGapBeforePrice: number;
  immediatelyFollowsTitle: boolean;
  priceImmediatelyFollowsDescription: boolean;
  purchaseImmediatelyFollowsPrice: boolean;
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
  mediaAspectRatio: number;
  logicalGapAfterImage: number;
  logicalGapBeforePurchaseRow: number;
  contentJustification: string;
  purchaseRowDisplay: string;
  purchaseRowAlignItems: string;
  purchaseRowFlexWrap: string;
  orderedPortraitContent: boolean;
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
  const category = card.locator('.storefront-product-card-category');
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
  await expect(category).toBeVisible();
  await expect(
    description,
    'related cards should show the canonical product-description excerpt'
  ).toBeVisible();
  await expect(primaryPrice).toBeVisible();
  await expect(visualPrice).toBeVisible();
  await expect(media).toBeVisible();
  await expect(
    purchaseRow,
    'related quick-add controls should have a dedicated layout row'
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
    const heading = cardRoot.querySelector<HTMLElement>('.storefront-product-card-heading');
    const categoryElement = cardRoot.querySelector<HTMLElement>('.storefront-product-card-category');
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
      !heading
      || !categoryElement
      || !content
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
    const categoryBox = categoryElement.getBoundingClientRect();
    const headingBox = heading.getBoundingClientRect();
    const descriptionContentBox = descriptionElement.getBoundingClientRect();
    const mediaBox = mediaElement.getBoundingClientRect();
    const purchaseRowBox = purchaseRowElement.getBoundingClientRect();
    const priceBox = priceElement.getBoundingClientRect();
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

    return {
      logicalHeight: rootBox.height / transformScaleY * commercialScale,
      logicalWidth: rootBox.width / transformScaleX * commercialScale,
      mediaWidthRatio: mediaBox.width / rootBox.width,
      mediaAspectRatio: mediaBox.width / mediaBox.height,
      logicalGapAfterImage:
        (categoryBox.top - mediaBox.bottom) / transformScaleY
        * commercialScale,
      logicalGapBeforePurchaseRow:
        (purchaseRowBox.top - priceBox.bottom) / transformScaleY
        * commercialScale,
      contentJustification: contentStyle.justifyContent,
      purchaseRowDisplay: purchaseRowStyle.display,
      purchaseRowAlignItems: purchaseRowStyle.alignItems,
      purchaseRowFlexWrap: purchaseRowStyle.flexWrap,
      orderedPortraitContent:
        mediaBox.bottom <= categoryBox.top + 1
        && categoryBox.bottom <= titleBox.top + 1
        && titleBox.bottom <= descriptionContentBox.top + 1
        && descriptionContentBox.bottom <= priceBox.top + 1
        && priceBox.bottom <= purchaseRowBox.top + 1,
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
        logicalGapAfterHeading:
          (descriptionContentBox.top - headingBox.bottom) / transformScaleY
          * commercialScale,
        logicalGapBeforePrice:
          (priceBox.top - descriptionContentBox.bottom) / transformScaleY
          * commercialScale,
        immediatelyFollowsTitle:
          titleChild.nextElementSibling === descriptionChild,
        priceImmediatelyFollowsDescription:
          descriptionChild.nextElementSibling === topLevelChild(priceElement),
        purchaseImmediatelyFollowsPrice:
          topLevelChild(priceElement).nextElementSibling === topLevelChild(purchaseRowElement)
      },
      typography: {
        contentFontSize: contentFontSize * commercialScale,
        titleFontSize: titleFontSize * commercialScale,
        descriptionFontSize: descriptionFontSize * commercialScale,
        priceFontSize: priceFontSize * commercialScale,
        titleToContentRatio: titleFontSize / contentFontSize,
        descriptionToContentRatio: descriptionFontSize / contentFontSize,
        priceToContentRatio: priceFontSize / contentFontSize
      }
    };
  });

  expect(geometry.descriptionStyle.immediatelyFollowsTitle,
    'the description excerpt follows the title').toBeTruthy();
  expect(geometry.descriptionStyle.priceImmediatelyFollowsDescription,
    'the price follows the description in reading order').toBeTruthy();
  expect(geometry.descriptionStyle.purchaseImmediatelyFollowsPrice,
    'purchase controls follow the price in reading order').toBeTruthy();
  expect(geometry.descriptionStyle.overflow).toBe('hidden');
  expect(geometry.descriptionStyle.lineClamp).toBe('3');
  expect(geometry.descriptionStyle.boxOrient).toBe('vertical');
  expect(geometry.descriptionStyle.logicalHeight,
    'the related excerpt shows at most three lines').toBeLessThanOrEqual(
    geometry.descriptionStyle.logicalLineHeight * 3 + 1
  );
  expect(geometry.descriptionStyle.logicalGapAfterHeading).toBeGreaterThanOrEqual(4);
  expect(geometry.descriptionStyle.logicalGapAfterHeading).toBeLessThanOrEqual(14);
  expect(geometry.descriptionStyle.logicalGapBeforePrice,
    'the price does not overlap the description').toBeGreaterThanOrEqual(-1);
  expect(geometry.logicalGapBeforePurchaseRow).toBeGreaterThanOrEqual(-1);
  expect(geometry.logicalGapBeforePurchaseRow,
    'quick-add stays close to the price').toBeLessThanOrEqual(24);

  expect(geometry.typography.titleFontSize,
    'the portrait title remains readable at storefront scale').toBeGreaterThanOrEqual(13.9);
  expect(geometry.typography.descriptionFontSize).toBeGreaterThanOrEqual(11.9);
  expect(geometry.typography.priceFontSize).toBeGreaterThanOrEqual(15.9);
  expect(geometry.typography.titleFontSize)
    .toBeGreaterThanOrEqual(geometry.typography.descriptionFontSize);
  expect(geometry.typography.priceFontSize)
    .toBeGreaterThanOrEqual(geometry.typography.titleFontSize);
  expect(geometry.typography.descriptionToContentRatio).toBeGreaterThan(0.875);
  expect(geometry.typography.priceToContentRatio).toBeGreaterThan(1.15);

  expect(geometry.purchaseRowDisplay).toBe('flex');
  expect(geometry.purchaseRowAlignItems).toBe('center');
  expect(geometry.purchaseRowFlexWrap).toBe('wrap');
  expect(geometry.orderedPortraitContent,
    'image, category, title, description, price and controls stack without overlap').toBeTruthy();
  expect(geometry.actionFollowsPrice,
    'quick add follows the price in DOM and reading order').toBeTruthy();
  expect(geometry.mediaWidthRatio,
    'the image spans the portrait card width').toBeGreaterThanOrEqual(0.95);
  expect(geometry.mediaWidthRatio).toBeLessThanOrEqual(1);
  expect(geometry.mediaAspectRatio, 'the image area is square').toBeCloseTo(1, 1);
  expect(['flex-start', 'space-between']).toContain(geometry.contentJustification);
  expect(geometry.logicalGapAfterImage).toBeGreaterThanOrEqual(0);
  expect(geometry.logicalGapAfterImage).toBeLessThanOrEqual(28);
  expect(geometry.logicalHeight,
    'the related card is portrait').toBeGreaterThan(geometry.logicalWidth);

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

async function expectSixSlotDesktopRow(grid: Locator) {
  await expect(grid).toBeVisible();
  const geometry = await grid.evaluate((element) => {
    const root = element as HTMLElement;
    const style = getComputedStyle(root);
    const rect = root.getBoundingClientRect();
    const scale = rect.width / root.offsetWidth;
    const gap = Number.parseFloat(style.columnGap);
    return {
      flow: style.gridAutoFlow,
      expectedSlotWidth: (root.clientWidth - gap * 5) / 6,
      viewportRight: rect.left + root.clientWidth * scale,
      cards: Array.from(root.children).slice(0, 6).map(child => {
        const box = child.getBoundingClientRect();
        return { top: box.top, right: box.right, logicalWidth: box.width / scale };
      })
    };
  });
  expect(geometry.flow).toBe('column');
  expect(geometry.cards.length, 'the fixture supplies related recommendations').toBeGreaterThan(0);
  for (const card of geometry.cards) {
    expect(card.top, 'all related cards share one row').toBeCloseTo(geometry.cards[0].top, 0);
    expect(card.logicalWidth).toBeCloseTo(geometry.expectedSlotWidth, 0);
    expect(card.right, 'the first six slots fit without horizontal scrolling')
      .toBeLessThanOrEqual(geometry.viewportRight + 1);
  }
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

test.describe('legacy related-product compact commerce card', () => {
  test('uses portrait cards in six desktop slots with matching public/admin price grammar', async ({
    page,
    request
  }) => {
    await assertAuthenticatedAdmin(request);
    const writes: string[] = [];
    await page.route('**/api/**', async (route) => {
      const outgoing = route.request();
      // Session activity does not persist content or unsaved editor changes.
      if (outgoing.method() === 'POST'
        && new URL(outgoing.url()).pathname === '/api/admin/session/activity') {
        await route.continue();
        return;
      }
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

    await expectSixSlotDesktopRow(page.locator('.storefront-related-product-grid'));

    await page.goto('/admin/podoba/artikli');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Artikli', exact: true })
    ).toBeVisible({ timeout: 15_000 });
    const productSelect = getAppearanceEditorCompactSelect(
      page,
      'Artikel v predogledu'
    );
    await expect(productSelect).toBeVisible();
    await chooseAppearanceEditorCompactSelectOption(
      page,
      productSelect,
      'aluminijasta-plosca'
    );
    expect(await readAppearanceEditorCompactSelectValue(productSelect))
      .toBe('aluminijasta-plosca');

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

    await expectSixSlotDesktopRow(preview.locator('.storefront-related-product-grid'));

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
      Math.abs(
        adminContract.mediaWidthRatio - publicContract.mediaWidthRatio
      ),
      'public/admin images fill the same proportion of their portrait cards'
    ).toBeLessThanOrEqual(0.005);
    expect(adminContract.contentJustification)
      .toBe(publicContract.contentJustification);
    expect(adminContract.purchaseRowDisplay)
      .toBe(publicContract.purchaseRowDisplay);
    expect(adminContract.purchaseRowAlignItems)
      .toBe(publicContract.purchaseRowAlignItems);
    expect(adminContract.orderedPortraitContent)
      .toBe(publicContract.orderedPortraitContent);
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
        adminContract.descriptionStyle.logicalGapAfterHeading
        - publicContract.descriptionStyle.logicalGapAfterHeading
      ),
      'public/admin heading-to-description spacing should match after preview scaling'
    ).toBeLessThanOrEqual(1.5);
    expect(
      Math.abs(
        adminContract.logicalGapBeforePurchaseRow
        - publicContract.logicalGapBeforePurchaseRow
      ),
      'public/admin price-to-commerce spacing should match after preview scaling'
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
      // Session activity does not persist content or unsaved editor changes.
      if (outgoing.method() === 'POST'
        && new URL(outgoing.url()).pathname === '/api/admin/session/activity') {
        await route.continue();
        return;
      }
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
    const quantity = card.locator('.storefront-related-product-quantity');
    const originalQuantity = await quantity.inputValue();
    await quantity.fill('');
    await expect(quantity).toHaveValue('');
    await quantity.fill(originalQuantity);
    await expect(quantity).toHaveValue(originalQuantity);
    await expect(card.locator('.storefront-related-product-cart-button')).toBeEnabled();

    const grid = page.locator('.storefront-related-product-grid');
    const row = await grid.evaluate((element) => {
      const root = element as HTMLElement;
      const tops = Array.from(root.children).map(child => child.getBoundingClientRect().top);
      return { tops, overflow: root.scrollWidth - root.clientWidth };
    });
    expect(row.tops.length, 'the fixture supplies multiple related cards').toBeGreaterThan(1);
    for (const top of row.tops) expect(top).toBeCloseTo(row.tops[0], 0);
    expect(row.overflow, 'mobile related cards scroll within one row').toBeGreaterThan(0);
    await grid.evaluate(element => { element.scrollLeft = element.scrollWidth; });
    await expect.poll(() => grid.evaluate(element => {
      const root = element as HTMLElement;
      const last = root.lastElementChild!.getBoundingClientRect();
      const box = root.getBoundingClientRect();
      const scale = box.width / root.offsetWidth;
      return Math.abs(last.right - box.left - root.clientWidth * scale);
    }), { message: 'the last related card is reachable by horizontal scrolling' }).toBeLessThanOrEqual(1);
    expect(writes, 'narrow layout inspection should remain read-only').toEqual([]);
  });
});
