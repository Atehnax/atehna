import {
  expect,
  test,
  type APIRequestContext,
  type Locator,
  type Page,
} from '@playwright/test';
import nextEnv from '@next/env';
import {
  catalogCategoryHref,
  catalogSubcategoryHref,
} from '../../src/commercial/catalog/catalogRoutes';
import { toStorefrontPlainText } from '../../src/commercial/features/products/storefrontProduct';
import type { CatalogItemEditorHydration } from '../../src/shared/domain/catalog/catalogAdminTypes';

type CatalogProduct = {
  slug: string;
  name: string;
  image?: string | null;
  status?: string;
};

type CatalogSubcategory = {
  slug: string;
  title: string;
  items: CatalogProduct[];
};

type CatalogCategory = {
  slug: string;
  title: string;
  image: string;
  items: CatalogProduct[];
  subcategories: CatalogSubcategory[];
};

type CatalogPayload = {
  categories: CatalogCategory[];
  statuses: Record<string, 'active' | 'inactive'>;
};

const { loadEnvConfig } = nextEnv;
const writeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

async function ensureAdminSession(request: APIRequestContext) {
  const probe = await request.get('/api/admin/categories?view=preview');
  if (probe.status() !== 401) {
    expect(probe.ok()).toBeTruthy();
    return;
  }

  loadEnvConfig(process.cwd(), true);
  const username = process.env.ADMIN_USERNAME?.trim() || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin';
  const login = await request.post('/api/admin/login', {
    data: { username, password },
  });
  if (!login.ok()) {
    throw new Error(`Admin test login failed with status ${login.status()}.`);
  }
}

async function ensurePageAdminSession(
  page: Page,
  request: APIRequestContext,
) {
  await ensureAdminSession(request);
  await page.context().addCookies((await request.storageState()).cookies);
}

function isActive(statuses: CatalogPayload['statuses'], key: string) {
  return statuses[key] !== 'inactive';
}

function hasPublicProductImage(items: CatalogProduct[]) {
  return items.some((item) => (
    item.status !== 'inactive' && Boolean(item.image?.trim())
  ));
}

type PublicVariantListingBranch = {
  category: CatalogCategory;
  subcategory: CatalogSubcategory;
  product: CatalogProduct;
  productRecord: CatalogItemEditorHydration;
  sourceDescription: string;
};

async function findPublicVariantListingBranch(
  request: APIRequestContext,
  catalog: CatalogPayload,
): Promise<PublicVariantListingBranch | undefined> {
  for (const category of catalog.categories) {
    if (!isActive(catalog.statuses, `cat:${category.slug}`)) continue;

    for (const subcategory of category.subcategories) {
      if (!isActive(
        catalog.statuses,
        `sub:${category.slug}:${subcategory.slug}`,
      )) continue;

      for (const product of subcategory.items) {
        if (product.status === 'inactive' || !product.image?.trim()) continue;

        const response = await request.get(
          `/api/admin/artikli/${encodeURIComponent(product.slug)}`,
        );
        if (!response.ok()) continue;

        const productRecord = await response.json() as CatalogItemEditorHydration;
        const sourceDescription = toStorefrontPlainText(
          productRecord.description,
        ).replace(/\s+/gu, ' ').trim();
        const hasPurchasableVariant = productRecord.variants.some((variant) => (
          typeof variant.id === 'number'
          && variant.status !== 'inactive'
          && (
            typeof variant.inventory !== 'number'
            || variant.inventory >= Math.max(1, variant.minOrder ?? 1)
          )
        ));
        if (
          productRecord.status === 'active'
          && productRecord.variants.length > 1
          && hasPurchasableVariant
          && sourceDescription.length > 0
          && sourceDescription.toLocaleLowerCase('sl')
            !== productRecord.itemName.trim().toLocaleLowerCase('sl')
        ) {
          return {
            category,
            subcategory,
            product,
            productRecord,
            sourceDescription,
          };
        }
      }
    }
  }

  return undefined;
}

async function readTypography(locator: Locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    const scaleHost = element.closest('.commercial-storefront-scale');
    const scale = Number.parseFloat(
      getComputedStyle(scaleHost ?? document.documentElement)
        .getPropertyValue('--commercial-storefront-scale'),
    ) || 1;
    return {
      fontFamily: style.fontFamily,
      fontSize: Number.parseFloat(style.fontSize) * scale,
      fontWeight: style.fontWeight,
      letterSpacing: style.letterSpacing,
      lineHeight: Number.parseFloat(style.lineHeight) * scale,
    };
  });
}

const getPublicProducts = (items: CatalogProduct[]) => (
  items.filter((item) => item.status !== 'inactive')
);

const getProductCountLabel = (count: number) => (
  `${count} ${count === 1 ? 'izdelek' : 'izdelkov'}`
);

type SortControlMetrics = {
  width: number;
  height: number;
  fontSize: number;
  paddingLeft: number;
  paddingRight: number;
  borderRadius: number;
};

async function readSortControlMetrics(
  sortSelect: Locator,
  outerScale: { x: number; y: number } = { x: 1, y: 1 },
): Promise<SortControlMetrics> {
  const [box, style] = await Promise.all([
    sortSelect.boundingBox(),
    sortSelect.evaluate((element) => {
      const computed = getComputedStyle(element);
      const storefrontScale = Number.parseFloat(
        computed.getPropertyValue('--commercial-storefront-scale'),
      ) || 1;
      return {
        storefrontScale,
        fontSize: Number.parseFloat(computed.fontSize),
        paddingLeft: Number.parseFloat(computed.paddingLeft),
        paddingRight: Number.parseFloat(computed.paddingRight),
        borderRadius: Number.parseFloat(computed.borderRadius),
      };
    }),
  ]);
  expect(box, 'sort control should have rendered geometry').not.toBeNull();

  return {
    width: box!.width / outerScale.x,
    height: box!.height / outerScale.y,
    fontSize: style.fontSize * style.storefrontScale,
    paddingLeft: style.paddingLeft * style.storefrontScale,
    paddingRight: style.paddingRight * style.storefrontScale,
    borderRadius: style.borderRadius * style.storefrontScale,
  };
}

function expectContentSizedSortControl(metrics: SortControlMetrics) {
  expect(metrics.width, 'sort control should be content-sized')
    .toBeGreaterThanOrEqual(168);
  expect(metrics.width, 'sort control should remain compact')
    .toBeLessThanOrEqual(184);
  expect(metrics.height, 'sort control should use the compact reference height')
    .toBeGreaterThanOrEqual(28);
  expect(metrics.height, 'sort control should use the compact reference height')
    .toBeLessThanOrEqual(32);
  expect(metrics.fontSize, 'sort control should use compact readable text')
    .toBeGreaterThanOrEqual(11);
  expect(metrics.fontSize, 'sort control should use compact readable text')
    .toBeLessThanOrEqual(13);
  expect(metrics.paddingLeft, 'sort control left padding should hug its content')
    .toBeGreaterThanOrEqual(7);
  expect(metrics.paddingLeft, 'sort control left padding should hug its content')
    .toBeLessThanOrEqual(9);
  expect(metrics.paddingRight, 'sort control right padding should hug its content')
    .toBeGreaterThanOrEqual(7);
  expect(metrics.paddingRight, 'sort control right padding should hug its content')
    .toBeLessThanOrEqual(9);
  expect(metrics.borderRadius, 'sort control radius should match the compact reference')
    .toBeGreaterThanOrEqual(6);
  expect(metrics.borderRadius, 'sort control radius should match the compact reference')
    .toBeLessThanOrEqual(8);
}

function expectSortControlParity(
  publicMetrics: SortControlMetrics,
  adminMetrics: SortControlMetrics,
) {
  for (const key of Object.keys(publicMetrics) as Array<keyof SortControlMetrics>) {
    expect(
      Math.abs(publicMetrics[key] - adminMetrics[key]),
      `public/admin sort ${key} should match after preview scaling`,
    ).toBeLessThanOrEqual(1);
  }
}

async function expectIntegratedListingHeader({
  page,
  pageTitle,
  productCount,
}: {
  page: Page;
  pageTitle: string;
  productCount: number;
}) {
  const pageHeading = page.getByRole('heading', {
    level: 1,
    name: pageTitle,
    exact: true,
  });
  await expect(pageHeading).toBeVisible({ timeout: 15_000 });

  const pageHeader = page.locator('main header').filter({ has: pageHeading });
  await expect(pageHeader).toHaveCount(1);

  const productCountLabel = getProductCountLabel(productCount);
  const count = pageHeader.getByText(productCountLabel, { exact: true });
  const sortSelect = pageHeader.getByRole('combobox', {
    name: /^Razvrsti(?: po)?$/,
  });
  const productGrid = page.locator('.storefront-product-grid').first();

  await expect(count).toBeVisible();
  await expect(sortSelect).toBeVisible();
  await expect(sortSelect).toHaveValue('recommended');
  await expect(sortSelect.locator('option:checked')).toHaveText(
    'Razvrsti po: Priporočeno',
  );
  await expect(
    pageHeader.getByText('Razvrsti', { exact: true }),
    'the sort prefix belongs inside the compact control, not in a separate visible label',
  ).toHaveCount(0);
  await expect(productGrid).toBeVisible();
  expectContentSizedSortControl(await readSortControlMetrics(sortSelect));

  expect(
    await pageHeading.evaluate((heading, countElement) => (
      Boolean(
        countElement
        && heading.compareDocumentPosition(countElement) & Node.DOCUMENT_POSITION_FOLLOWING
      )
    ), await count.elementHandle()),
    'the item count should follow the page title in document order',
  ).toBeTruthy();

  const [headerBox, headingBox, countBox, sortBox, gridBox, headerBorder] = await Promise.all([
    pageHeader.boundingBox(),
    pageHeading.boundingBox(),
    count.boundingBox(),
    sortSelect.boundingBox(),
    productGrid.boundingBox(),
    pageHeader.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        width: Number.parseFloat(style.borderBottomWidth),
        style: style.borderBottomStyle,
      };
    }),
  ]);

  expect(headerBox).not.toBeNull();
  expect(headingBox).not.toBeNull();
  expect(countBox).not.toBeNull();
  expect(sortBox).not.toBeNull();
  expect(gridBox).not.toBeNull();
  expect(headerBorder.width, 'the page header should own the single horizontal divider')
    .toBeGreaterThan(0);
  expect(headerBorder.style).not.toBe('none');

  expect(
    countBox!.y,
    'the product count should sit directly below the title',
  ).toBeGreaterThanOrEqual(headingBox!.y + headingBox!.height - 1);
  expect(
    countBox!.y + countBox!.height,
    'the product count should remain above the header divider',
  ).toBeLessThan(headerBox!.y + headerBox!.height);
  expect(
    sortBox!.y + sortBox!.height,
    'the sort control should remain above the header divider',
  ).toBeLessThan(headerBox!.y + headerBox!.height);
  expect(
    Math.abs(
      (sortBox!.x + sortBox!.width) - (headerBox!.x + headerBox!.width),
    ),
    'the compact sort control should align to the right edge of the page header',
  ).toBeLessThanOrEqual(2);

  const interveningDividers = await page.evaluate((bounds) => {
    const minimumWidth = bounds.headerWidth * 0.75;
    const dividers: Array<{ edge: 'top' | 'bottom'; y: number }> = [];

    for (const element of document.querySelectorAll('main *')) {
      const box = element.getBoundingClientRect();
      if (box.width < minimumWidth || box.height <= 0) continue;

      const style = getComputedStyle(element);
      const borders = [
        {
          edge: 'top' as const,
          width: Number.parseFloat(style.borderTopWidth),
          style: style.borderTopStyle,
          y: box.top,
        },
        {
          edge: 'bottom' as const,
          width: Number.parseFloat(style.borderBottomWidth),
          style: style.borderBottomStyle,
          y: box.bottom,
        },
      ];

      for (const border of borders) {
        if (
          border.width > 0
          && border.style !== 'none'
          && border.y > bounds.headerBottom + 2
          && border.y < bounds.gridTop - 2
        ) {
          dividers.push({ edge: border.edge, y: Math.round(border.y) });
        }
      }
    }

    return dividers;
  }, {
    headerBottom: headerBox!.y + headerBox!.height,
    headerWidth: headerBox!.width,
    gridTop: gridBox!.y,
  });

  expect(
    interveningDividers,
    'there should be no second toolbar divider between the page header and product cards',
  ).toEqual([]);
}

async function readListingMetrics(page: Page, pageTitle: string) {
  const pageHeading = page.getByRole('heading', {
    level: 1,
    name: pageTitle,
    exact: true,
  });
  await expect(pageHeading).toBeVisible({ timeout: 15_000 });

  const listing = page.locator('.storefront-product-grid').first().locator('xpath=ancestor::section[1]');
  await expect(listing).toBeVisible({ timeout: 15_000 });
  await expect(listing.locator('#product-listing-title')).toBeHidden();
  await expect(
    listing.getByText(
      'Izberite izdelek za ogled različic, zaloge in tehničnih podatkov.',
      { exact: true },
    ),
  ).toBeHidden();

  const grid = listing.locator('.storefront-product-grid');
  await expect(grid).toBeVisible();

  const pageHeader = page.locator('main header').filter({ has: pageHeading });
  const sortSelect = pageHeader.getByRole('combobox', {
    name: /^Razvrsti(?: po)?$/,
  });
  await expect(sortSelect).toBeVisible();
  await expect(sortSelect).toHaveValue('recommended');

  const imageCard = grid.locator(
    '.storefront-product-card:has(.storefront-product-card-image)',
  ).first();
  await expect(imageCard).toBeVisible();
  const media = imageCard.locator('.storefront-product-card-media');
  const image = imageCard.locator('.storefront-product-card-image');
  const content = imageCard.locator('.storefront-product-card-content');
  const cardTitle = imageCard.locator('.storefront-product-card-title');
  const productLink = cardTitle.locator('xpath=ancestor::a[1]');
  await expect(media).toBeVisible();
  await expect(image).toBeVisible();
  await expect(cardTitle).toBeVisible();
  await expect(productLink).toHaveAttribute('href', /\/products\/[^/]+\/items\/[^/]+$/);

  const [gridBox, cardBox, mediaBox, imageBox, contentBox, sortBox] = await Promise.all([
    grid.boundingBox(),
    imageCard.boundingBox(),
    media.boundingBox(),
    image.boundingBox(),
    content.boundingBox(),
    sortSelect.boundingBox(),
  ]);
  expect(gridBox).not.toBeNull();
  expect(cardBox).not.toBeNull();
  expect(mediaBox).not.toBeNull();
  expect(imageBox).not.toBeNull();
  expect(contentBox).not.toBeNull();
  expect(sortBox).not.toBeNull();

  const [gridStyle, cardStyle, mediaStyle, imageStyle, contentStyle, sortStyle] = await Promise.all([
    grid.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        columns: style.gridTemplateColumns
          .trim()
          .split(/\s+/)
          .map((track) => Number.parseFloat(track)),
        columnGap: Number.parseFloat(style.columnGap),
        rowGap: Number.parseFloat(style.rowGap),
      };
    }),
    imageCard.evaluate((element) => ({
      borderRadius: getComputedStyle(element).borderRadius,
    })),
    media.evaluate((element) => ({
      aspectRatio: getComputedStyle(element).aspectRatio,
    })),
    image.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        objectFit: style.objectFit,
        padding: [
          style.paddingTop,
          style.paddingRight,
          style.paddingBottom,
          style.paddingLeft,
        ],
      };
    }),
    content.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        padding: [
          style.paddingTop,
          style.paddingRight,
          style.paddingBottom,
          style.paddingLeft,
        ],
      };
    }),
    readSortControlMetrics(sortSelect),
  ]);

  return {
    pageTitle: await readTypography(pageHeading),
    cardTitle: await readTypography(cardTitle),
    grid: {
      ...gridStyle,
      width: gridBox!.width,
    },
    card: {
      ...cardStyle,
      width: cardBox!.width,
      height: cardBox!.height,
    },
    media: {
      ...mediaStyle,
      width: mediaBox!.width,
      height: mediaBox!.height,
    },
    image: {
      ...imageStyle,
      width: imageBox!.width,
      height: imageBox!.height,
    },
    content: {
      ...contentStyle,
      height: contentBox!.height,
    },
    sort: {
      ...sortStyle,
      width: sortBox!.width,
      height: sortBox!.height,
    },
  };
}

async function expectMarketplaceNoiseAbsent(scope: Locator) {
  const visibleCopy = (await scope.allTextContents()).join(' ');
  expect(
    visibleCopy,
    'listing cards should not introduce marketplace ratings or star copy',
  ).not.toMatch(/(?:\b(?:rating|stars?)\b|\bocen(?:a|e|jeno)?\b|zvezdic|[★☆])/iu);
  expect(
    visibleCopy,
    'listing cards should not introduce marketplace purchase-volume copy',
  ).not.toMatch(/(?:bought\s+in\s+the\s+past\s+month|kupljen\w*\s+v\s+(?:preteklem|zadnjem)\s+mesecu)/iu);
  expect(
    visibleCopy,
    'listing cards should not introduce destination-specific delivery copy',
  ).not.toMatch(/(?:delivers?\s+to\s+slovenia|dostav(?:a|imo|lja\w*)\s+(?:v|po)\s+slovenij[io])/iu);

  const accessibleLabels = await scope.locator('[aria-label]').evaluateAll(
    (elements) => elements.map((element) => element.getAttribute('aria-label') ?? '')
      .join(' '),
  );
  expect(
    accessibleLabels,
    'ratings should not be hidden behind an icon-only accessible label',
  ).not.toMatch(/(?:rating|stars?|ocen(?:a|e|jeno)?|zvezdic)/iu);
}

type ListingCardCommerceContract = {
  price: string;
  description: string;
  descriptionFontSize: number;
  descriptionLineHeight: number;
  descriptionHeight: number;
  descriptionTitleGap: number;
  mediaAspectRatio: number;
  imageWidthRatio: number;
  imageHeightRatio: number;
};

const listingPriceAmountPattern = String.raw`\d+(?:[.\s]\d{3})*,\d{2}`;
const listingPricePattern = new RegExp(
  `^(?:${listingPriceAmountPattern}\\s*€|${listingPriceAmountPattern}\\s*[–-]\\s*${listingPriceAmountPattern}\\s*€)$`,
  'u',
);

function makeExpectedListingDescription(sourceDescription: string) {
  const normalized = sourceDescription.replace(/\s+/gu, ' ').trim();
  if (normalized.length <= 180) return normalized;
  const clipped = normalized.slice(0, 181);
  const lastSpace = clipped.lastIndexOf(' ');
  return `${clipped.slice(0, Math.max(lastSpace, 156)).trim()}…`;
}

async function expectVariantListingCardCommerceContract(
  card: Locator,
  sourceDescription: string,
): Promise<ListingCardCommerceContract> {
  const media = card.locator('.storefront-product-card-media');
  const image = card.locator('.storefront-product-card-image');
  const title = card.locator('.storefront-product-card-title');
  const description = card.locator('.storefront-product-card-description');
  const primaryPrice = card.locator(
    '.storefront-product-card-price .storefront-price-primary',
  );
  const priceBlock = card.locator('.storefront-product-card-price');
  const visualPrice = primaryPrice.locator('.storefront-listing-price-visual');
  const visualCurrency = visualPrice.locator(
    '.storefront-listing-price-currency',
  );
  const variantAction = card.locator(
    '.storefront-product-card-action .site-button',
    { hasText: 'Izberi različico' },
  );

  await expect(card).toBeVisible({ timeout: 15_000 });
  await expect(media).toBeVisible();
  await expect(image).toBeVisible();
  await expect(title).toBeVisible();
  await expect(description).toBeVisible();
  await expect(primaryPrice).toBeVisible();
  await expect(visualPrice).toBeVisible();
  await expect(visualCurrency).toHaveCount(1);
  await expect(visualCurrency).toHaveText('€');
  await expect(variantAction).toHaveCount(1);
  await expect(variantAction).toBeVisible();
  await expect(variantAction).toHaveText('Izberi različico');

  const price = (await primaryPrice.getAttribute('aria-label') ?? '')
    .replace(/\s+/gu, ' ')
    .trim();
  expect(
    price,
    'a single listing price or the final amount in a range should end with €',
  ).toMatch(listingPricePattern);
  expect(price, 'the last numeric price should be followed by €')
    .toMatch(/\d,\d{2}\s*€$/u);
  expect(
    await visualPrice.evaluate((element) => (
      element.lastElementChild?.classList.contains(
        'storefront-listing-price-currency',
      ) ?? false
    )),
    'the visible euro sign should follow the final single/range price number',
  ).toBeTruthy();

  const descriptionCopy = (await description.textContent() ?? '')
    .replace(/\s+/gu, ' ')
    .trim();
  expect(
    descriptionCopy,
    'the card description preview should come from the catalog item description',
  ).toBe(makeExpectedListingDescription(sourceDescription));

  const [titleBox, descriptionBox, priceBox, descriptionStyle, contentOrder] =
    await Promise.all([
      title.boundingBox(),
      description.boundingBox(),
      priceBlock.boundingBox(),
      description.evaluate((element) => {
        const computed = getComputedStyle(element);
        const storefrontScale = Number.parseFloat(
          computed.getPropertyValue('--commercial-storefront-scale'),
        ) || 1;
        return {
          overflow: computed.overflow,
          lineClamp: computed.webkitLineClamp,
          boxOrient: computed.webkitBoxOrient,
          fontSize: Number.parseFloat(computed.fontSize) * storefrontScale,
          lineHeight: Number.parseFloat(computed.lineHeight) * storefrontScale,
          unscaledLineHeight: Number.parseFloat(computed.lineHeight),
          clientHeight: (element as HTMLElement).clientHeight,
        };
      }),
      card.evaluate((element) => {
        const titleElement = element.querySelector(
          '.storefront-product-card-title',
        );
        const descriptionElement = element.querySelector(
          '.storefront-product-card-description',
        );
        const priceElement = element.querySelector(
          '.storefront-product-card-price',
        );
        if (!titleElement || !descriptionElement || !priceElement) return false;
        return Boolean(
          titleElement.compareDocumentPosition(descriptionElement)
            & Node.DOCUMENT_POSITION_FOLLOWING,
        ) && Boolean(
          descriptionElement.compareDocumentPosition(priceElement)
            & Node.DOCUMENT_POSITION_FOLLOWING,
        );
      }),
    ]);
  expect(titleBox).not.toBeNull();
  expect(descriptionBox).not.toBeNull();
  expect(priceBox).not.toBeNull();
  expect(contentOrder, 'description should sit between title and price in DOM order')
    .toBeTruthy();
  expect(descriptionStyle.overflow, 'description overflow should stay clipped')
    .toBe('hidden');
  expect(descriptionStyle.lineClamp, 'description should be clamped to two lines')
    .toBe('2');
  expect(descriptionStyle.boxOrient, 'description clamp should run vertically')
    .toBe('vertical');
  expect(
    descriptionStyle.clientHeight,
    'description should never exceed two rendered line-heights',
  ).toBeLessThanOrEqual(descriptionStyle.unscaledLineHeight * 2 + 1);
  expect(descriptionStyle.fontSize, 'description preview should stay compact')
    .toBeGreaterThanOrEqual(11);
  expect(descriptionStyle.fontSize, 'description preview should stay compact')
    .toBeLessThanOrEqual(14);
  expect(descriptionStyle.lineHeight, 'description line-height should stay compact')
    .toBeGreaterThanOrEqual(15);
  expect(descriptionStyle.lineHeight, 'description line-height should stay compact')
    .toBeLessThanOrEqual(20);

  const descriptionTitleGap = descriptionBox!.y
    - (titleBox!.y + titleBox!.height);
  expect(descriptionTitleGap, 'description should follow the title without overlap')
    .toBeGreaterThanOrEqual(-1);
  expect(descriptionTitleGap, 'description should sit immediately below the title')
    .toBeLessThanOrEqual(12);
  expect(
    priceBox!.y,
    'price content should remain below the compact description preview',
  ).toBeGreaterThanOrEqual(descriptionBox!.y + descriptionBox!.height - 1);

  const visibleCopy = (await card.textContent() ?? '').replace(/\s+/gu, ' ').trim();
  expect(
    visibleCopy,
    'listing cards should not append the gross-price label after the amount',
  ).not.toMatch(/\bz\s+DDV\b/iu);
  expect(
    visibleCopy,
    'listing cards should not show the net-price tax breakdown',
  ).not.toMatch(/\bbrez\s+DDV\b/iu);
  expect(
    visibleCopy,
    'listing cards should not show a DDV percentage breakdown',
  ).not.toMatch(/\bDDV\s*\d+(?:[.,]\d+)?\s*%/iu);
  await expect(
    card.locator('.storefront-price-tax'),
    'the detailed tax row belongs on the product page, not its listing card',
  ).toHaveCount(0);
  await expect(
    card.getByText('Izberite različico', { exact: true }),
    'the CTA is sufficient; a separate variant-selection prompt is redundant',
  ).toHaveCount(0);

  const warningMarkerCount = await card.evaluate((element) => {
    const probe = document.createElement('span');
    probe.style.position = 'absolute';
    probe.style.backgroundColor = 'var(--site-color-warning)';
    element.append(probe);
    const warningColor = getComputedStyle(probe).backgroundColor;
    probe.remove();

    return Array.from(element.querySelectorAll<HTMLElement>(
      '.storefront-product-card-availability [aria-hidden="true"]',
    )).filter((marker) => (
      marker.getClientRects().length > 0
      && getComputedStyle(marker).backgroundColor === warningColor
    )).length;
  });
  expect(
    warningMarkerCount,
    'a multi-variant listing card should not retain the brown selection marker',
  ).toBe(0);

  const [mediaBox, imageBox, imageStyle] = await Promise.all([
    media.boundingBox(),
    image.boundingBox(),
    image.evaluate((element) => ({
      objectFit: getComputedStyle(element).objectFit,
    })),
  ]);
  expect(mediaBox).not.toBeNull();
  expect(imageBox).not.toBeNull();

  const mediaAspectRatio = mediaBox!.height / mediaBox!.width;
  const imageWidthRatio = imageBox!.width / mediaBox!.width;
  const imageHeightRatio = imageBox!.height / mediaBox!.height;
  expect(mediaAspectRatio, 'listing-card media should be square')
    .toBeGreaterThanOrEqual(0.98);
  expect(mediaAspectRatio, 'listing-card media should be square')
    .toBeLessThanOrEqual(1.02);
  expect(imageWidthRatio, 'the fill image box should span the square media width')
    .toBeCloseTo(1, 2);
  expect(imageHeightRatio, 'the fill image box should span the square media height')
    .toBeCloseTo(1, 2);
  expect(imageStyle.objectFit, 'the product should remain uncropped inside its square')
    .toBe('contain');

  return {
    price,
    description: descriptionCopy,
    descriptionFontSize: descriptionStyle.fontSize,
    descriptionLineHeight: descriptionStyle.lineHeight,
    descriptionHeight: descriptionBox!.height,
    descriptionTitleGap,
    mediaAspectRatio,
    imageWidthRatio,
    imageHeightRatio,
  };
}

type MarketplaceCardContract = {
  aspectRatio: string;
  borderWidth: number;
  boxShadow: string;
  cardBackground: string;
  mediaBackground: string;
  titleColor: string;
  priceColor: string;
  actionBackground: string;
  actionColor: string;
  themeCardBackground: string;
  themeMutedBackground: string;
  themeTextColor: string;
  themeButtonBackground: string;
  themeButtonColor: string;
  objectFit: string;
  imagePadding: number;
  mediaWidthRatio: number;
  mediaAspectRatio: number;
  mediaHeightRatio: number;
  priceFontRatio: number;
  actionWidthRatio: number;
  actionBottomGap: number;
  titleBeforePrice: boolean;
  priceBeforeAction: boolean;
};

async function readMarketplaceCardContract(card: Locator): Promise<MarketplaceCardContract> {
  const media = card.locator('.storefront-product-card-media');
  const image = card.locator('.storefront-product-card-image');
  const content = card.locator('.storefront-product-card-content');
  const title = card.locator('.storefront-product-card-title');
  const price = card.locator(
    '.storefront-product-card-price .storefront-price-primary',
  );
  const action = card.locator('.storefront-product-card-action');
  const actionControl = action.locator('.site-button').first();

  await expect(card).toBeVisible({ timeout: 15_000 });
  await expect(media).toBeVisible();
  await expect(image).toBeVisible();
  await expect(content).toBeVisible();
  await expect(title).toBeVisible();
  await expect(price).toBeVisible();
  await expect(action).toBeVisible();
  await expect(actionControl).toBeVisible();

  const [
    cardBox,
    mediaBox,
    contentBox,
    titleBox,
    priceBox,
    actionBox,
    actionControlBox,
    titleTypography,
    priceTypography,
    styles,
  ] = await Promise.all([
    card.boundingBox(),
    media.boundingBox(),
    content.boundingBox(),
    title.boundingBox(),
    price.boundingBox(),
    action.boundingBox(),
    actionControl.boundingBox(),
    readTypography(title),
    readTypography(price),
    card.evaluate((element) => {
      const cardStyle = getComputedStyle(element);
      const mediaElement = element.querySelector<HTMLElement>(
        '.storefront-product-card-media',
      );
      const imageElement = element.querySelector<HTMLElement>(
        '.storefront-product-card-image',
      );
      const contentElement = element.querySelector<HTMLElement>(
        '.storefront-product-card-content',
      );
      const titleElement = element.querySelector<HTMLElement>(
        '.storefront-product-card-title',
      );
      const priceElement = element.querySelector<HTMLElement>(
        '.storefront-product-card-price .storefront-price-primary',
      );
      const actionElement = element.querySelector<HTMLElement>(
        '.storefront-product-card-action .site-button',
      );
      if (
        !mediaElement
        || !imageElement
        || !contentElement
        || !titleElement
        || !priceElement
        || !actionElement
      ) {
        throw new Error('The listing card is missing a required visual element.');
      }

      const resolveColor = (variable: string) => {
        const probe = document.createElement('span');
        probe.style.position = 'absolute';
        probe.style.color = `var(${variable})`;
        element.append(probe);
        const resolved = getComputedStyle(probe).color;
        probe.remove();
        return resolved;
      };
      const mediaStyle = getComputedStyle(mediaElement);
      const imageStyle = getComputedStyle(imageElement);
      const contentStyle = getComputedStyle(contentElement);
      const titleStyle = getComputedStyle(titleElement);
      const priceStyle = getComputedStyle(priceElement);
      const actionStyle = getComputedStyle(actionElement);
      const scaleHost = element.closest('.commercial-storefront-scale');
      const storefrontScale = Number.parseFloat(
        getComputedStyle(scaleHost ?? document.documentElement)
          .getPropertyValue('--commercial-storefront-scale'),
      ) || 1;

      return {
        aspectRatio: mediaStyle.aspectRatio,
        borderWidth: Number.parseFloat(cardStyle.borderTopWidth) * storefrontScale,
        boxShadow: cardStyle.boxShadow,
        cardBackground: cardStyle.backgroundColor,
        mediaBackground: mediaStyle.backgroundColor,
        titleColor: titleStyle.color,
        priceColor: priceStyle.color,
        actionBackground: actionStyle.backgroundColor,
        actionColor: actionStyle.color,
        themeCardBackground: resolveColor('--site-card-bg'),
        themeMutedBackground: resolveColor('--site-color-surface-muted'),
        themeTextColor: resolveColor('--site-color-text'),
        themeButtonBackground: resolveColor('--site-button-bg'),
        themeButtonColor: resolveColor('--site-button-text'),
        objectFit: imageStyle.objectFit,
        imagePadding: Number.parseFloat(imageStyle.paddingTop),
        contentPaddingLeft: Number.parseFloat(contentStyle.paddingLeft),
        contentPaddingRight: Number.parseFloat(contentStyle.paddingRight),
        contentPaddingBottom: Number.parseFloat(contentStyle.paddingBottom),
      };
    }),
  ]);

  expect(cardBox).not.toBeNull();
  expect(mediaBox).not.toBeNull();
  expect(contentBox).not.toBeNull();
  expect(titleBox).not.toBeNull();
  expect(priceBox).not.toBeNull();
  expect(actionBox).not.toBeNull();
  expect(actionControlBox).not.toBeNull();

  const contentInnerWidth = Math.max(
    1,
    contentBox!.width - styles.contentPaddingLeft - styles.contentPaddingRight,
  );

  return {
    aspectRatio: styles.aspectRatio,
    borderWidth: styles.borderWidth,
    boxShadow: styles.boxShadow,
    cardBackground: styles.cardBackground,
    mediaBackground: styles.mediaBackground,
    titleColor: styles.titleColor,
    priceColor: styles.priceColor,
    actionBackground: styles.actionBackground,
    actionColor: styles.actionColor,
    themeCardBackground: styles.themeCardBackground,
    themeMutedBackground: styles.themeMutedBackground,
    themeTextColor: styles.themeTextColor,
    themeButtonBackground: styles.themeButtonBackground,
    themeButtonColor: styles.themeButtonColor,
    objectFit: styles.objectFit,
    imagePadding: styles.imagePadding,
    mediaWidthRatio: mediaBox!.width / cardBox!.width,
    mediaAspectRatio: mediaBox!.height / mediaBox!.width,
    mediaHeightRatio: mediaBox!.height / cardBox!.height,
    priceFontRatio: priceTypography.fontSize / titleTypography.fontSize,
    actionWidthRatio: actionControlBox!.width / contentInnerWidth,
    actionBottomGap: cardBox!.y + cardBox!.height
      - (actionControlBox!.y + actionControlBox!.height),
    titleBeforePrice: titleBox!.y + titleBox!.height <= priceBox!.y + 1,
    priceBeforeAction: priceBox!.y + priceBox!.height <= actionBox!.y + 1,
  };
}

function expectAmazonInspiredListingCard(contract: MarketplaceCardContract) {
  expect(contract.boxShadow, 'listing card shell should remain visually flat')
    .toBe('none');
  expect(contract.borderWidth, 'listing card border should remain minimal')
    .toBeLessThanOrEqual(1);
  expect(contract.cardBackground, 'card should use the configured card surface')
    .toBe(contract.themeCardBackground);
  expect(contract.mediaBackground, 'media should use the configured muted surface')
    .toBe(contract.themeMutedBackground);
  expect(contract.titleColor, 'title should use the configured text colour')
    .toBe(contract.themeTextColor);
  expect(contract.priceColor, 'price should use the configured text colour')
    .toBe(contract.themeTextColor);
  expect(contract.actionBackground, 'action should use the configured button colour')
    .toBe(contract.themeButtonBackground);
  expect(contract.actionColor, 'action copy should use the configured button foreground')
    .toBe(contract.themeButtonColor);

  expect(contract.objectFit, 'product imagery should remain clean and uncropped')
    .toBe('contain');
  expect(contract.imagePadding, 'listing imagery should fill its square image box')
    .toBe(0);
  expect(contract.mediaWidthRatio, 'media should span nearly the full card width')
    .toBeGreaterThanOrEqual(0.96);
  expect(contract.mediaAspectRatio, 'listing media should use a square product area')
    .toBeGreaterThanOrEqual(0.98);
  expect(contract.mediaAspectRatio, 'listing media should use a square product area')
    .toBeLessThanOrEqual(1.02);
  expect(contract.mediaHeightRatio, 'media should remain the dominant upper card area')
    .toBeGreaterThanOrEqual(0.42);

  expect(contract.titleBeforePrice, 'title should precede price visually')
    .toBeTruthy();
  expect(contract.priceBeforeAction, 'price should precede the purchase action visually')
    .toBeTruthy();
  expect(contract.priceFontRatio, 'price should be visibly emphasized over the title')
    .toBeGreaterThanOrEqual(1.1);
  expect(contract.actionWidthRatio, 'purchase action should span the card content width')
    .toBeGreaterThanOrEqual(0.98);
  expect(contract.actionBottomGap, 'purchase action should stay near the card bottom')
    .toBeLessThanOrEqual(20);
}

test('category page omits hero media and visible subcategory label while retaining cards', async ({
  page,
  request,
}) => {
  await ensureAdminSession(request);
  const response = await request.get('/api/admin/categories');
  expect(response.ok()).toBeTruthy();
  const payload = await response.json() as CatalogPayload;

  const publicBranch = payload.categories
    .filter((category) => (
      category.image.trim().length > 0 &&
      isActive(payload.statuses, `cat:${category.slug}`)
    ))
    .map((category) => ({
      category,
      subcategories: category.subcategories.filter((subcategory) => (
        isActive(payload.statuses, `sub:${category.slug}:${subcategory.slug}`)
      )),
    }))
    .find(({ subcategories }) => subcategories.length > 0);

  expect(
    publicBranch,
    'The catalog needs an active category with a configured image and active subcategories.',
  ).toBeDefined();
  const { category, subcategories } = publicBranch!;

  await page.goto(catalogCategoryHref(category.slug));

  const categoryHeading = page.getByRole('heading', {
    level: 1,
    name: category.title,
    exact: true,
  });
  await expect(categoryHeading).toBeVisible({ timeout: 15_000 });
  const categoryHeader = page.locator('main header').filter({ has: categoryHeading });
  await expect(categoryHeader).toHaveCount(1);
  await expect(categoryHeader.locator('img')).toHaveCount(0);

  await expect(page.getByRole('heading', { name: 'Podkategorije', exact: true })).toHaveCount(0);
  await expect(page.getByText('Podkategorije', { exact: true })).toHaveCount(0);

  const showcase = page.locator(
    `[data-storefront-subcategory-showcase=${JSON.stringify(category.slug)}]`,
  );
  const cards = showcase.locator('[data-storefront-subcategory-card]');
  await expect(cards.first()).toBeVisible({ timeout: 15_000 });
  await expect(cards).toHaveCount(subcategories.length);
  expect(await cards.evaluateAll((elements) => elements.map((element) => (
    (element as HTMLElement).dataset.storefrontSubcategoryCard
  )))).toEqual(subcategories.map((subcategory) => subcategory.slug));

  const firstSubcategory = subcategories[0];
  await expect(
    showcase.locator(
      `[data-storefront-subcategory-card=${JSON.stringify(firstSubcategory.slug)}]`,
    ).getByRole('link', { name: firstSubcategory.title, exact: true }),
  ).toHaveAttribute(
    'href',
    catalogSubcategoryHref(category.slug, firstSubcategory.slug),
  );
});

test('category and subcategory listings integrate count and compact sort into the title header', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await ensureAdminSession(request);
  const response = await request.get('/api/admin/categories');
  expect(response.ok()).toBeTruthy();
  const payload = await response.json() as CatalogPayload;

  const category = payload.categories.find((candidate) => (
    isActive(payload.statuses, `cat:${candidate.slug}`)
    && getPublicProducts(candidate.items).length > 0
  ));
  expect(
    category,
    'The catalog needs an active top-level category with a public product.',
  ).toBeDefined();

  const subcategoryBranch = payload.categories
    .filter((candidate) => isActive(payload.statuses, `cat:${candidate.slug}`))
    .flatMap((candidate) => candidate.subcategories.map((subcategory) => ({
      category: candidate,
      subcategory,
    })))
    .find(({ category: candidate, subcategory }) => (
      isActive(
        payload.statuses,
        `sub:${candidate.slug}:${subcategory.slug}`,
      )
      && getPublicProducts(subcategory.items).length > 0
    ));
  expect(
    subcategoryBranch,
    'The catalog needs an active subcategory with a public product.',
  ).toBeDefined();

  const routes = [
    {
      href: catalogCategoryHref(category!.slug),
      title: category!.title,
      productCount: getPublicProducts(category!.items).length,
    },
    {
      href: catalogSubcategoryHref(
        subcategoryBranch!.category.slug,
        subcategoryBranch!.subcategory.slug,
      ),
      title: subcategoryBranch!.subcategory.title,
      productCount: getPublicProducts(
        subcategoryBranch!.subcategory.items,
      ).length,
    },
  ];

  for (const route of routes) {
    await page.goto(route.href);
    await expectIntegratedListingHeader({
      page,
      pageTitle: route.title,
      productCount: route.productCount,
    });
  }
});

test('subcategory product listing is materially compact without losing product navigation', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await ensureAdminSession(request);
  const response = await request.get('/api/admin/categories');
  expect(response.ok()).toBeTruthy();
  const payload = await response.json() as CatalogPayload;

  const subcategoryBranch = payload.categories
    .filter((category) => isActive(payload.statuses, `cat:${category.slug}`))
    .flatMap((category) => category.subcategories.map((subcategory) => ({
      category,
      subcategory,
    })))
    .find(({ category, subcategory }) => (
      isActive(payload.statuses, `sub:${category.slug}:${subcategory.slug}`) &&
      hasPublicProductImage(subcategory.items)
    ));

  expect(
    subcategoryBranch,
    'The catalog needs an active subcategory with a public product image.',
  ).toBeDefined();

  const { category, subcategory } = subcategoryBranch!;
  await page.goto(catalogSubcategoryHref(category.slug, subcategory.slug));
  const subcategoryMetrics = await readListingMetrics(page, subcategory.title);
  const listingCards = page.locator(
    '.storefront-product-grid .storefront-product-card',
  );
  const marketplaceCard = listingCards.filter({
    has: page.locator('.storefront-product-card-image'),
  }).first();
  const marketplaceContract = await readMarketplaceCardContract(marketplaceCard);

  await expect(marketplaceCard).toHaveClass(/\bstorefront-product-listing-card\b/);
  await expect(marketplaceCard).toHaveAttribute('data-product-card-layout', 'grid');
  await expectMarketplaceNoiseAbsent(listingCards);
  expectAmazonInspiredListingCard(marketplaceContract);

  expect(subcategoryMetrics.grid.columns.length, 'desktop product columns').toBeGreaterThanOrEqual(3);
  expect(
    subcategoryMetrics.card.height,
    'product card height should stay proportionate to its square media and compact details',
  ).toBeLessThanOrEqual(subcategoryMetrics.card.width * 1.65);
  expect(
    subcategoryMetrics.media.height,
    'product media should fill a square card-width area',
  ).toBeGreaterThanOrEqual(subcategoryMetrics.card.width * 0.98);
  expect(
    subcategoryMetrics.media.height,
    'product media should not exceed its square card-width area',
  ).toBeLessThanOrEqual(subcategoryMetrics.card.width * 1.02);
  expect(
    subcategoryMetrics.content.height,
    'product details should not recreate an oversized lower half',
  ).toBeLessThanOrEqual(subcategoryMetrics.card.width * 0.78);

  expectContentSizedSortControl(subcategoryMetrics.sort);
  expect(
    subcategoryMetrics.sort.height / subcategoryMetrics.sort.fontSize,
    'sort control height should be proportionate to its text',
  ).toBeLessThanOrEqual(3.1);

  expect(subcategoryMetrics.pageTitle.fontSize, 'subcategory title').toBeLessThanOrEqual(32);
  expect(subcategoryMetrics.cardTitle.fontSize, 'product-card title').toBeLessThanOrEqual(18);
});

test('variant listing card keeps price, square media, and CTA parity in the admin preview', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await ensurePageAdminSession(page, request);

  const catalogResponse = await request.get('/api/admin/categories');
  expect(catalogResponse.ok()).toBeTruthy();
  const catalog = await catalogResponse.json() as CatalogPayload;
  const branch = await findPublicVariantListingBranch(request, catalog);
  expect(
    branch,
    'The catalog needs an active multi-variant product with a public image.',
  ).toBeDefined();
  if (!branch) return;

  const writes: string[] = [];
  await page.route('**/api/admin/**', async (route) => {
    const outgoing = route.request();
    if (writeMethods.has(outgoing.method())) {
      writes.push(`${outgoing.method()} ${new URL(outgoing.url()).pathname}`);
      await route.abort();
      return;
    }
    await route.continue();
  });

  await page.goto(catalogSubcategoryHref(
    branch.category.slug,
    branch.subcategory.slug,
  ));
  const publicCard = page.locator(
    '.storefront-product-grid .storefront-product-card',
  ).filter({ hasText: branch.product.name }).first();
  await expect(publicCard.locator('.storefront-product-card-title'))
    .toHaveText(branch.product.name);
  const publicContract = await expectVariantListingCardCommerceContract(
    publicCard,
    branch.sourceDescription,
  );
  const productHref = await publicCard
    .locator('.storefront-product-card-title')
    .locator('xpath=ancestor::a[1]')
    .getAttribute('href');
  expect(productHref, 'the listing card should link to its product detail')
    .toMatch(/^\/products\/[^/]+\/items\/[^/]+$/);

  await page.goto(productHref!);
  await expect(page.getByRole('heading', {
    level: 1,
    name: branch.productRecord.itemName,
    exact: true,
  })).toBeVisible({ timeout: 15_000 });
  const detailTaxBreakdown = page.locator(
    '.storefront-product-purchase-area .storefront-price-tax',
  );
  await expect(
    detailTaxBreakdown,
    'the linked product detail should retain its tax breakdown',
  ).toBeVisible();
  const detailTaxCopy = (await detailTaxBreakdown.textContent() ?? '')
    .replace(/\s+/gu, ' ')
    .trim();
  expect(detailTaxCopy, 'product detail should expose the net-price label')
    .toMatch(/\bbrez\s+DDV\b/iu);
  expect(detailTaxCopy, 'product detail should expose its DDV percentage')
    .toMatch(/\bDDV\s*\d+(?:[.,]\d+)?\s*%/iu);

  await page.goto('/admin/podoba/artikli');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Artikli', exact: true }),
  ).toBeVisible({ timeout: 15_000 });
  const productSelect = page.getByLabel('Artikel v predogledu');
  await expect(productSelect).toBeVisible();
  await productSelect.selectOption(branch.productRecord.slug);
  await expect(productSelect).toHaveValue(branch.productRecord.slug);

  const listingButton = page.getByRole('group', {
    name: 'Stran predogleda',
  }).getByRole('button', {
    name: 'Seznam',
    exact: true,
  });
  await listingButton.click();
  await expect(listingButton).toHaveAttribute('aria-pressed', 'true');

  const preview = page.locator(
    '[data-product-preview-frame] [data-admin-product-live-preview="true"]:visible',
  ).first();
  await expect(preview).toBeVisible({ timeout: 15_000 });
  const adminCard = preview.locator('.storefront-product-card').first();
  await expect(adminCard.locator('.storefront-product-card-title'))
    .toHaveText(branch.productRecord.itemName);
  const adminContract = await expectVariantListingCardCommerceContract(
    adminCard,
    branch.sourceDescription,
  );

  expect(
    adminContract.price,
    'the admin listing preview should render the selected product price verbatim',
  ).toBe(publicContract.price);
  expect(
    adminContract.description,
    'the admin listing preview should reuse the public catalog description excerpt',
  ).toBe(publicContract.description);
  expect(adminContract.descriptionFontSize)
    .toBeCloseTo(publicContract.descriptionFontSize, 1);
  expect(adminContract.descriptionLineHeight)
    .toBeCloseTo(publicContract.descriptionLineHeight, 1);
  expect(adminContract.descriptionHeight)
    .toBeCloseTo(publicContract.descriptionHeight, 0);
  expect(adminContract.descriptionTitleGap)
    .toBeCloseTo(publicContract.descriptionTitleGap, 0);
  expect(
    adminContract.mediaAspectRatio,
    'public and admin listing cards should share the same square media geometry',
  ).toBeCloseTo(publicContract.mediaAspectRatio, 2);
  expect(adminContract.imageWidthRatio)
    .toBeCloseTo(publicContract.imageWidthRatio, 2);
  expect(adminContract.imageHeightRatio)
    .toBeCloseTo(publicContract.imageHeightRatio, 2);
  expect(
    writes,
    'opening the public listing and its admin preview must remain read-only',
  ).toEqual([]);
});

test('admin Seznam preview uses the same compact listing card and toolbar without saving', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await ensurePageAdminSession(page, request);

  const catalogResponse = await request.get('/api/admin/categories');
  expect(catalogResponse.ok()).toBeTruthy();
  const catalog = await catalogResponse.json() as CatalogPayload;
  const publicBranch = catalog.categories
    .filter((category) => isActive(catalog.statuses, `cat:${category.slug}`))
    .flatMap((category) => category.subcategories.map((subcategory) => ({
      category,
      subcategory,
    })))
    .find(({ category, subcategory }) => (
      isActive(catalog.statuses, `sub:${category.slug}:${subcategory.slug}`)
      && hasPublicProductImage(subcategory.items)
    ));
  expect(
    publicBranch,
    'The catalog needs an active subcategory with a public product image.',
  ).toBeDefined();

  await page.goto(catalogSubcategoryHref(
    publicBranch!.category.slug,
    publicBranch!.subcategory.slug,
  ));
  const publicCards = page.locator(
    '.storefront-product-grid .storefront-product-card',
  );
  const publicHeading = page.getByRole('heading', {
    level: 1,
    name: publicBranch!.subcategory.title,
    exact: true,
  });
  const publicSortSelect = page.locator('main header')
    .filter({ has: publicHeading })
    .getByRole('combobox', { name: /^Razvrsti(?: po)?$/ });
  await expect(publicSortSelect).toHaveAccessibleName(/^Razvrsti(?: po)?$/);
  await expect(publicSortSelect.locator('option:checked')).toHaveText(
    'Razvrsti po: Priporočeno',
  );
  const publicSortMetrics = await readSortControlMetrics(publicSortSelect);
  expectContentSizedSortControl(publicSortMetrics);
  const publicCard = publicCards.filter({
    has: page.locator('.storefront-product-card-image'),
  }).first();
  const publicMarketplaceContract = await readMarketplaceCardContract(publicCard);
  await expect(publicCard).toHaveClass(/\bstorefront-product-listing-card\b/);
  await expect(publicCard).toHaveAttribute('data-product-card-layout', 'grid');
  await expectMarketplaceNoiseAbsent(publicCards);
  expectAmazonInspiredListingCard(publicMarketplaceContract);

  const persistedWrites: string[] = [];
  page.on('request', (outgoing) => {
    if (
      writeMethods.has(outgoing.method())
      && outgoing.url().includes('/api/admin/product-appearance')
    ) {
      persistedWrites.push(`${outgoing.method()} ${outgoing.url()}`);
    }
  });

  await page.goto('/admin/podoba/artikli');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Artikli', exact: true }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByLabel('Artikel v predogledu')).toBeVisible();

  const pageControls = page.getByRole('group', {
    name: 'Stran predogleda',
  });
  const listingButton = pageControls.getByRole('button', {
    name: 'Seznam',
    exact: true,
  });
  await listingButton.click();
  await expect(listingButton).toHaveAttribute('aria-pressed', 'true');

  const preview = page.locator(
    '[data-product-preview-frame] [data-admin-product-live-preview="true"]:visible',
  ).first();
  await expect(preview).toBeVisible({ timeout: 15_000 });

  const cards = preview.locator('.storefront-product-card');
  const card = cards.first();
  const listingCardCanvasWrappers = preview.locator(
    '[data-product-canvas-element="listing-card"]',
  );
  const media = card.locator('.storefront-product-card-media');
  const content = card.locator('.storefront-product-card-content');
  const cardTitle = card.locator('.storefront-product-card-title');
  const productLink = cardTitle.locator('xpath=ancestor::a[1]');
  const listingPageHeader = preview.locator(
    'header:has([data-product-canvas-element="listing-header"])',
  );
  const listingHeaderCanvas = listingPageHeader.locator(
    '[data-product-canvas-element="listing-header"]',
  );
  const sortSelect = listingHeaderCanvas.locator(
    '.storefront-product-listing-sort-select',
  );
  const listingTitle = listingPageHeader.getByRole('heading', { level: 1 });
  const listingCount = listingPageHeader.getByText('1 izdelek', {
    exact: true,
  });
  const listingGrid = preview.locator('.storefront-product-grid').first();

  await expect(card).toBeVisible({ timeout: 15_000 });
  await expect(media).toBeVisible();
  await expect(content).toBeVisible();
  await expect(cardTitle).toBeVisible();
  await expect(productLink).toHaveAttribute(
    'href',
    /\/products\/[^/]+\/items\/[^/]+$/,
  );
  await expect(listingPageHeader).toHaveCount(1);
  await expect(listingPageHeader).toBeVisible();
  await expect(listingHeaderCanvas).toHaveCount(1);
  await expect(listingHeaderCanvas).toBeVisible();
  await expect(
    listingHeaderCanvas.locator('header'),
    'the semantic page header must remain outside the editable canvas wrapper',
  ).toHaveCount(0);
  await expect(listingTitle).toBeVisible();
  await expect(listingGrid).toBeVisible();
  await expect(listingCount).toBeVisible();
  await expect(sortSelect).toBeVisible();
  await expect(sortSelect).toHaveValue('recommended');
  await expect(sortSelect).toHaveAccessibleName(/^Razvrsti(?: po)?$/);
  await expect(sortSelect.locator('option:checked')).toHaveText(
    'Razvrsti po: Priporočeno',
  );
  await expect(
    listingHeaderCanvas.getByText('Razvrsti', { exact: true }),
    'admin preview should not restore a separate sort label',
  ).toHaveCount(0);

  const renderedCardCount = await cards.count();
  expect(renderedCardCount, 'admin preview should render listing cards')
    .toBeGreaterThan(0);
  await expect(
    listingCardCanvasWrappers,
    'each rendered ProductCard should own one listing-card canvas wrapper',
  ).toHaveCount(renderedCardCount);
  expect(
    await cards.evaluateAll((elements) => elements.map((element) => {
      let ancestor = element.parentElement;
      let count = 0;
      while (ancestor) {
        if (ancestor.getAttribute('data-product-canvas-element') === 'listing-card') {
          count += 1;
        }
        ancestor = ancestor.parentElement;
      }
      return count;
    })),
    'every rendered card should have exactly one listing-card canvas ancestor',
  ).toEqual(Array.from({ length: renderedCardCount }, () => 1));
  await expect(
    listingCardCanvasWrappers.locator(
      '[data-product-canvas-element="listing-card"]',
    ),
    'listing-card canvas wrappers must not be nested',
  ).toHaveCount(0);

  await expect(
    preview.getByRole('heading', {
      name: 'Izdelki',
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    preview.getByText(
      'Izberite izdelek za ogled različic, zaloge in tehničnih podatkov.',
      { exact: true },
    ),
  ).toBeHidden();

  const [
    cardBox,
    mediaBox,
    contentBox,
    sortBox,
    listingHeaderBox,
    listingTitleBox,
    listingCountBox,
    listingGridBox,
    previewScale,
  ] = await Promise.all([
    card.boundingBox(),
    media.boundingBox(),
    content.boundingBox(),
    sortSelect.boundingBox(),
    listingPageHeader.boundingBox(),
    listingTitle.boundingBox(),
    listingCount.boundingBox(),
    listingGrid.boundingBox(),
    preview.evaluate((element) => {
      const node = element as HTMLElement;
      const box = node.getBoundingClientRect();
      return {
        x: node.offsetWidth > 0 ? box.width / node.offsetWidth : 1,
        y: node.offsetHeight > 0 ? box.height / node.offsetHeight : 1,
      };
    }),
  ]);
  expect(cardBox).not.toBeNull();
  expect(mediaBox).not.toBeNull();
  expect(contentBox).not.toBeNull();
  expect(sortBox).not.toBeNull();
  expect(listingHeaderBox).not.toBeNull();
  expect(listingTitleBox).not.toBeNull();
  expect(listingCountBox).not.toBeNull();
  expect(listingGridBox).not.toBeNull();
  const adminSortMetrics = await readSortControlMetrics(
    sortSelect,
    previewScale,
  );
  expectContentSizedSortControl(adminSortMetrics);
  expectSortControlParity(publicSortMetrics, adminSortMetrics);

  expect(
    listingCountBox!.y,
    'the Seznam preview count should sit directly below its page title',
  ).toBeGreaterThanOrEqual(
    listingTitleBox!.y + listingTitleBox!.height - 1,
  );
  expect(
    listingCountBox!.y + listingCountBox!.height,
    'the Seznam preview count should remain above the header divider',
  ).toBeLessThan(listingHeaderBox!.y + listingHeaderBox!.height);
  expect(
    sortBox!.y + sortBox!.height,
    'the Seznam preview sort control should remain above the header divider',
  ).toBeLessThan(listingHeaderBox!.y + listingHeaderBox!.height);
  expect(
    Math.abs(
      (sortBox!.x + sortBox!.width)
      - (listingHeaderBox!.x + listingHeaderBox!.width)
    ),
    'the Seznam preview sort control should align to the header right edge',
  ).toBeLessThanOrEqual(2);

  const adminInterveningDividers = await preview.evaluate((element, bounds) => {
    const dividers: Array<{ edge: 'top' | 'bottom'; y: number }> = [];
    for (const candidate of element.querySelectorAll('*')) {
      const box = candidate.getBoundingClientRect();
      if (box.width < bounds.minimumWidth || box.height <= 0) continue;
      const style = getComputedStyle(candidate);
      const borders = [
        {
          edge: 'top' as const,
          width: Number.parseFloat(style.borderTopWidth),
          style: style.borderTopStyle,
          y: box.top,
        },
        {
          edge: 'bottom' as const,
          width: Number.parseFloat(style.borderBottomWidth),
          style: style.borderBottomStyle,
          y: box.bottom,
        },
      ];
      for (const border of borders) {
        if (
          border.width > 0
          && border.style !== 'none'
          && border.y > bounds.headerBottom + 2
          && border.y < bounds.gridTop - 2
        ) {
          dividers.push({ edge: border.edge, y: Math.round(border.y) });
        }
      }
    }
    return dividers;
  }, {
    headerBottom: listingHeaderBox!.y + listingHeaderBox!.height,
    gridTop: listingGridBox!.y,
    minimumWidth: listingHeaderBox!.width * 0.75,
  });
  expect(
    adminInterveningDividers,
    'the Seznam preview should not show a second divider before its product cards',
  ).toEqual([]);

  expect(
    cardBox!.height,
    'admin preview card should remain compact even in its narrower four-column canvas',
  ).toBeLessThanOrEqual(cardBox!.width * 1.8);
  expect(
    mediaBox!.height,
    'admin preview should retain the square storefront media area',
  ).toBeGreaterThanOrEqual(cardBox!.width * 0.98);
  expect(
    mediaBox!.height,
    'admin preview media should not exceed its square card-width area',
  ).toBeLessThanOrEqual(cardBox!.width * 1.02);
  expect(
    contentBox!.height,
    'admin preview card details should retain the compact storefront proportion',
  ).toBeLessThanOrEqual(cardBox!.width * 0.78);
  await expectMarketplaceNoiseAbsent(cards);
  const adminMarketplaceContract = await readMarketplaceCardContract(card);
  await expect(card).toHaveClass(/\bstorefront-product-listing-card\b/);
  await expect(card).toHaveAttribute('data-product-card-layout', 'grid');
  expectAmazonInspiredListingCard(adminMarketplaceContract);
  expect(
    adminMarketplaceContract.aspectRatio,
    'admin and public listing cards should use the same media aspect ratio',
  ).toBe(publicMarketplaceContract.aspectRatio);
  expect(
    adminMarketplaceContract.boxShadow,
    'admin and public listing cards should use the same flat shell',
  ).toBe(publicMarketplaceContract.boxShadow);
  expect(
    adminMarketplaceContract.cardBackground,
    'admin and public cards should use the same configured surface',
  ).toBe(publicMarketplaceContract.cardBackground);
  expect(
    adminMarketplaceContract.mediaBackground,
    'admin and public media should use the same configured surface',
  ).toBe(publicMarketplaceContract.mediaBackground);
  expect(
    adminMarketplaceContract.actionBackground,
    'admin and public actions should use the same configured colour',
  ).toBe(publicMarketplaceContract.actionBackground);
  expect(
    adminMarketplaceContract.mediaWidthRatio,
    'admin and public cards should share the same edge-to-edge media treatment',
  ).toBeCloseTo(publicMarketplaceContract.mediaWidthRatio, 2);
  expect(
    adminMarketplaceContract.priceFontRatio,
    'admin and public cards should share the same title/price hierarchy',
  ).toBeCloseTo(publicMarketplaceContract.priceFontRatio, 1);
  expect(
    adminMarketplaceContract.actionWidthRatio,
    'admin and public cards should share the same full-width action treatment',
  ).toBeCloseTo(publicMarketplaceContract.actionWidthRatio, 1);

  expect(
    persistedWrites,
    'switching to the Seznam preview must not persist appearance settings',
  ).toEqual([]);
});
