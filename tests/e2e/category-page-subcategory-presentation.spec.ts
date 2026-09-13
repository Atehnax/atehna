import {
  expect,
  test,
  type APIRequestContext,
  type Locator,
  type Page,
} from '@playwright/test';
import {
  catalogCategoryHref,
  catalogSubcategoryHref,
} from '../../src/commercial/catalog/catalogRoutes';
import { toStorefrontPlainText } from '../../src/commercial/features/products/storefrontProduct';
import type { CatalogItemEditorHydration } from '../../src/shared/domain/catalog/catalogAdminTypes';
import {
  chooseAppearanceEditorCompactSelectOption,
  getAppearanceEditorCompactSelect,
  readAppearanceEditorCompactSelectValue,
} from './support/appearance-editor-compact-select';
import { assertAuthenticatedAdmin } from './support/auth';

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

const writeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

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
  descriptionHeadingGap: number;
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

  const [titleBox, descriptionBox, priceBox, headingBox, descriptionStyle, contentOrder] =
    await Promise.all([
      title.boundingBox(),
      description.boundingBox(),
      priceBlock.boundingBox(),
      card.locator('.storefront-product-card-heading').boundingBox(),
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
          titleElement.compareDocumentPosition(priceElement)
            & Node.DOCUMENT_POSITION_FOLLOWING,
        ) && Boolean(
          priceElement.compareDocumentPosition(descriptionElement)
            & Node.DOCUMENT_POSITION_FOLLOWING,
        );
      }),
    ]);
  expect(titleBox).not.toBeNull();
  expect(descriptionBox).not.toBeNull();
  expect(priceBox).not.toBeNull();
  expect(headingBox).not.toBeNull();
  expect(contentOrder, 'title and price should precede the description in DOM order')
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

  const descriptionHeadingGap = descriptionBox!.y
    - (headingBox!.y + headingBox!.height);
  expect(descriptionHeadingGap, 'description should follow the heading without overlap')
    .toBeGreaterThanOrEqual(-1);
  expect(descriptionHeadingGap, 'description should sit immediately below the heading')
    .toBeLessThanOrEqual(12);
  expect(
    Math.abs(priceBox!.y - titleBox!.y),
    'price should align with the top of the title',
  ).toBeLessThanOrEqual(1);
  expect(
    priceBox!.x,
    'price should sit to the right of the title without overlap',
  ).toBeGreaterThanOrEqual(titleBox!.x + titleBox!.width - 1);
  expect(
    Math.abs(priceBox!.x + priceBox!.width - headingBox!.x - headingBox!.width),
    'price should align with the far right of the heading',
  ).toBeLessThanOrEqual(1);

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
    descriptionHeadingGap,
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
  titleAndPriceShareRow: boolean;
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
    titleAndPriceShareRow: Math.abs(titleBox!.y - priceBox!.y) <= 1
      && titleBox!.x + titleBox!.width <= priceBox!.x + 1,
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

  expect(contract.titleAndPriceShareRow, 'title and price should share a row without overlap')
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

async function publicCatalogBranch(request: APIRequestContext) {
  await assertAuthenticatedAdmin(request);
  const response = await request.get('/api/admin/categories');
  expect(response.ok()).toBeTruthy();
  const catalog = await response.json() as CatalogPayload;
  const branch = catalog.categories
    .filter(category => isActive(catalog.statuses, 'cat:' + category.slug))
    .flatMap(category => category.subcategories.map(subcategory => ({ category, subcategory })))
    .find(({ category, subcategory }) =>
      isActive(catalog.statuses, 'sub:' + category.slug + ':' + subcategory.slug)
      && hasPublicProductImage(subcategory.items)
    );
  expect(branch, 'The catalog needs an active subcategory with an illustrated product.').toBeDefined();
  return { ...branch!, catalog };
}

async function waitForCatalogHydration(page: Page) {
  const search = page.getByRole('searchbox', { name: 'Poiščite izdelek, material ali oznako', exact: true });
  await expect(search).toBeVisible();
  // SSR controls can be visible before their React change handlers are attached.
  await expect.poll(() => search.evaluate(element =>
    Object.keys(element).some(key => key.startsWith('__reactProps$'))
  )).toBeTruthy();
}

function catalogResults(page: Page) {
  return page.getByRole('region', { name: 'Katalog izdelkov', exact: true });
}

function catalogPrice(row: Locator) {
  return row.locator(':scope > span[aria-label]');
}

function euroAmount(value: string) {
  const amount = value.match(/\d[\d.\s]*,\d{2}/u)?.[0];
  expect(amount, 'a visible catalogue price should contain a euro amount').toBeDefined();
  return Number(amount!.replace(/[.\s]/gu, '').replace(',', '.'));
}

async function clearCatalogFilters(page: Page) {
  await page.getByRole('button', { name: 'Počisti filtre', exact: true }).first().click();
}

test('category page shows its expanded hierarchy and supports branch navigation', async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const { category, subcategory } = await publicCatalogBranch(request);
  await page.goto(catalogCategoryHref(category.slug));
  await waitForCatalogHydration(page);
  await expect(page.getByRole('heading', { level: 1, name: category.title, exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Kategorije', exact: true })
    .locator('a[href="' + catalogCategoryHref(category.slug) + '"]')).toHaveAttribute('aria-current', 'location');
  const results = catalogResults(page);
  const rows = results.locator('[data-catalog-product]:visible');
  await expect(rows.first()).toBeVisible();
  const total = await rows.count();
  await expect(results.getByRole('status')).toHaveText('Vse kategorije so razširjene');
  const branchHeading = results.getByRole('heading', { level: 3, name: subcategory.title, exact: true });
  const branchHeader = branchHeading.locator('..');
  const branch = branchHeader.locator('button[aria-controls^="catalog-children-"]');
  const branchLink = branchHeading.getByRole('link', { name: subcategory.title, exact: true });
  await expect(branch).toHaveCount(1);
  await expect(branch).toHaveAccessibleName('Strni kategorijo ' + subcategory.title);
  await expect(branch).toHaveAttribute('aria-expanded', 'true');
  await expect(branchLink).toHaveAttribute('href', catalogSubcategoryHref(category.slug, subcategory.slug));
  await expect(branchHeader.getByRole('link')).toHaveCount(1);
  const controlledId = await branch.getAttribute('aria-controls');
  expect(controlledId).toBeTruthy();
  const branchContent = results.locator('[id="' + controlledId + '"]');
  await expect(branchContent).toBeVisible();
  await branch.click();
  await expect(branch).toHaveAttribute('aria-expanded', 'false');
  await expect(branch).toHaveAccessibleName('Razširi kategorijo ' + subcategory.title);
  await expect(branchContent).toBeHidden();
  await expect(branchLink).toBeVisible();
  await expect(page).toHaveURL(catalogCategoryHref(category.slug));
  await branch.click();
  await expect(branch).toHaveAccessibleName('Strni kategorijo ' + subcategory.title);
  await expect(branchContent).toBeVisible();
  await expect(page).toHaveURL(catalogCategoryHref(category.slug));
  await results.getByRole('button', { name: 'Strni vse', exact: true }).click();
  await expect(rows).toHaveCount(0);
  await results.getByRole('button', { name: 'Razširi vse', exact: true }).click();
  await expect(rows).toHaveCount(total);
  expect(await results.locator('button[aria-controls^="catalog-children-"]').evaluateAll(buttons =>
    buttons.every(button => button.getAttribute('aria-expanded') === 'true')
  )).toBeTruthy();
  await expect(page.locator('[data-storefront-subcategory-showcase]')).toHaveCount(0);
  const illustratedRow = branchContent.locator('[data-catalog-product]').filter({ has: page.locator('img') }).first();
  await expect(illustratedRow).toBeVisible();
  await expect(illustratedRow.getByRole('link')).toHaveCount(1);
  const productId = await illustratedRow.getAttribute('data-catalog-product');
  expect(productId).toBeTruthy();
  const retainedRow = results.locator('[data-catalog-product=' + JSON.stringify(productId) + ']');
  const retainedImage = retainedRow.locator('img').first();
  const rowHandle = await retainedRow.elementHandle();
  const imageHandle = await retainedImage.elementHandle();
  expect(rowHandle).not.toBeNull();
  expect(imageHandle).not.toBeNull();
  const expectRetainedProduct = async () => {
    await expect(retainedRow).toBeVisible();
    expect(await rowHandle!.evaluate(element => element.isConnected)).toBeTruthy();
    expect(await imageHandle!.evaluate(element => element.isConnected)).toBeTruthy();
    expect(await retainedRow.evaluate((element, original) => element === original, rowHandle!)).toBeTruthy();
    expect(await retainedImage.evaluate((element, original) => element === original, imageHandle!)).toBeTruthy();
  };
  try {
    await branchLink.click();
    await expect(page).toHaveURL(catalogSubcategoryHref(category.slug, subcategory.slug));
    await expect(page.getByRole('heading', { level: 1, name: subcategory.title, exact: true })).toBeVisible();
    const categoryBreadcrumb = page.getByRole('navigation', { name: 'Drobtinice', exact: true })
      .getByRole('link', { name: category.title, exact: true });
    await expect(categoryBreadcrumb).toHaveAttribute('href', catalogCategoryHref(category.slug));
    await expectRetainedProduct();
    await categoryBreadcrumb.click();
    await expect(page).toHaveURL(catalogCategoryHref(category.slug));
    await expect(page.getByRole('heading', { level: 1, name: category.title, exact: true })).toBeVisible();
    await expectRetainedProduct();
  } finally {
    await rowHandle?.dispose();
    await imageHandle?.dispose();
  }
});

test('category and subcategory search, stock filters, and sorting operate on product rows', async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const { category, subcategory } = await publicCatalogBranch(request);
  const product = subcategory.items.find(item => item.status !== 'inactive' && item.image?.trim())!;
  for (const route of [
    { href: catalogCategoryHref(category.slug), title: category.title },
    { href: catalogSubcategoryHref(category.slug, subcategory.slug), title: subcategory.title },
  ]) {
    await page.goto(route.href);
    await waitForCatalogHydration(page);
    await expect(page.getByRole('heading', { level: 1, name: route.title, exact: true })).toBeVisible();
    const results = catalogResults(page);
    const rows = results.locator('[data-catalog-product]:visible');
    await expect(rows.first()).toBeVisible();
    const total = await rows.count();
    const search = page.getByRole('searchbox', { name: 'Poiščite izdelek, material ali oznako', exact: true });
    const sortGroups = results.getByRole('group', { name: 'Razvrsti izdelke', exact: true }).filter({ visible: true });
    const sort = sortGroups.first();
    await expect(sort).toBeVisible();
    await expect(sort.locator('button[data-sort-key]')).toHaveCount(3);
    const nameSort = sort.locator('button[data-sort-key="name"]');
    await expect(nameSort).toHaveAttribute('data-direction', 'ascending');
    await expect(nameSort).toHaveAttribute('aria-pressed', 'true');
    await expect(nameSort).toHaveAccessibleName('Izdelek: razvrsti Z–A');
    await expect(sort.locator('button[data-direction="none"][aria-pressed="false"]')).toHaveCount(2);
    await search.fill(product.name);
    await expect(results).toHaveAttribute('aria-busy', 'false');
    await expect(rows.filter({ has: page.getByText(product.name, { exact: true }) })).toHaveCount(1);
    await expect.poll(async () => {
      const count = Number((await results.getByRole('status').innerText()).match(/^\d+/u)?.[0]);
      return await results.getAttribute('aria-busy') === 'false' && count === await rows.count();
    }).toBeTruthy();
    await search.fill('zzzz-no-catalog-product-match-827493');
    await expect(rows).toHaveCount(0);
    await expect(results.getByRole('heading', { name: 'Ni izdelkov, ki ustrezajo izbranim filtrom', exact: true })).toBeVisible();
    await clearCatalogFilters(page);
    await expect(rows).toHaveCount(total);
    const stocked = await rows.filter({ has: page.locator('[data-tone="stock"]') }).count();
    await page.getByRole('checkbox', { name: 'Na zalogi', exact: true }).check();
    await expect(rows).toHaveCount(stocked);
    await expect(rows.locator('[data-tone="order"], [data-tone="unavailable"]')).toHaveCount(0);
    await page.getByRole('checkbox', { name: 'Na zalogi', exact: true }).uncheck();
    await expect(rows).toHaveCount(total);
    await expect(results).toHaveAttribute('aria-busy', 'false');
    const readDisplayedRows = () => rows.evaluateAll(elements => elements.map(row => ({
      id: row.getAttribute('data-catalog-product') ?? '',
      parentId: row.parentElement?.id ?? '',
      name: row.querySelector('a')?.getAttribute('aria-label') ?? '',
      priceLabel: row.querySelector(':scope > span[aria-label]')?.getAttribute('aria-label') ?? '',
      availabilityTone: row.querySelector('[data-tone]')?.getAttribute('data-tone') ?? '',
    })));
    const defaultRows = await readDisplayedRows();
    const defaultProductOrder = defaultRows.map(row => row.id);
    const defaultParents = new Map(defaultRows.map(row => [row.id, row.parentId]));
    expect(defaultRows.every(row => row.parentId.startsWith('catalog-children-'))).toBeTruthy();
    const categoryHeadings = results.locator('[id^="catalog-heading-"]:visible');
    const defaultHeadingOrder = await categoryHeadings.evaluateAll(headings => headings.map(heading => heading.id));
    expect(defaultHeadingOrder.length).toBeGreaterThan(0);
    const headerHandles = await sortGroups.elementHandles();
    const retainedRow = rows.filter({ has: page.locator('img') }).first();
    const rowHandle = await retainedRow.elementHandle();
    const imageHandle = await retainedRow.locator('img').first().elementHandle();
    expect(rowHandle).not.toBeNull();
    expect(imageHandle).not.toBeNull();
    const retainedProductId = await retainedRow.getAttribute('data-catalog-product');
    expect(retainedProductId).toBeTruthy();
    const retainedProduct = results.locator('[data-catalog-product=' + JSON.stringify(retainedProductId) + ']');
    const nameCollator = new Intl.Collator('sl', { sensitivity: 'base' });
    expect(defaultRows.every((row, index) => row.name.length > 0 && (
      index === 0 || defaultRows[index - 1].parentId !== row.parentId
      || nameCollator.compare(defaultRows[index - 1].name, row.name) <= 0
    ))).toBeTruthy();
    const availabilityRanks = new Map([['stock', 0], ['order', 1], ['unavailable', 2]]);
    const sortColumns = [
      { key: 'name', title: 'Izdelek', ascending: 'razvrsti A–Z', descending: 'razvrsti Z–A' },
      { key: 'price', title: 'Cena z DDV', ascending: 'razvrsti naraščajoče', descending: 'razvrsti padajoče' },
      { key: 'availability', title: 'Dobavljivost', ascending: 'najprej na zalogi', descending: 'najprej ni na zalogi' },
    ] as const;
    try {
      for (const column of sortColumns) {
        const restoreLabel = column.title + ': povrni prvotni vrstni red';
        const steps = column.key === 'name' ? [
          { direction: 'descending', label: 'Izdelek: razvrsti Z–A', nextLabel: 'Izdelek: razvrsti A–Z' },
          { direction: 'ascending', label: 'Izdelek: razvrsti A–Z', nextLabel: 'Izdelek: razvrsti Z–A' },
          { direction: 'descending', label: 'Izdelek: razvrsti Z–A', nextLabel: 'Izdelek: razvrsti A–Z' },
          { direction: 'ascending', label: 'Izdelek: razvrsti A–Z', nextLabel: 'Izdelek: razvrsti Z–A' },
        ] as const : [
          { direction: 'ascending', label: column.title + ': ' + column.ascending, nextLabel: column.title + ': ' + column.descending },
          { direction: 'descending', label: column.title + ': ' + column.descending, nextLabel: restoreLabel },
          { direction: 'none', label: restoreLabel, nextLabel: column.title + ': ' + column.ascending },
        ] as const;
        for (const step of steps) {
          await sort.getByRole('button', { name: step.label, exact: true }).click();
          const activeSort = sort.locator('button[data-sort-key="' + column.key + '"]');
          await expect(activeSort).toHaveAccessibleName(step.nextLabel);
          await expect(activeSort).toHaveAttribute('data-direction', step.direction);
          await expect(activeSort).toHaveAttribute('aria-pressed', String(step.direction !== 'none'));
          await expect(sort.locator('button[data-direction="none"][aria-pressed="false"]')).toHaveCount(2);
          if (step.direction === 'none') {
            await expect(nameSort).toHaveAttribute('data-direction', 'ascending');
            await expect(nameSort).toHaveAttribute('aria-pressed', 'true');
            await expect(nameSort).toHaveAccessibleName('Izdelek: razvrsti Z–A');
          }
          await expect(rows).toHaveCount(total);
          await expect(results.getByRole('button', { name: 'Po kategorijah', exact: true })).toHaveCount(0);
          await expect.poll(async () => {
            const displayedRows = await readDisplayedRows();
            if (displayedRows.length !== total
              || displayedRows.some(row => defaultParents.get(row.id) !== row.parentId)) return false;
            if (step.direction === 'none') {
              return displayedRows.every((row, index) => row.id === defaultProductOrder[index]);
            }
            const siblingGroups = new Map<string, typeof displayedRows>();
            for (const row of displayedRows) {
              const siblings = siblingGroups.get(row.parentId) ?? [];
              siblings.push(row);
              siblingGroups.set(row.parentId, siblings);
            }
            if (column.key === 'price' && !displayedRows.some(row => row.priceLabel.endsWith('z DDV'))) return false;
            return [...siblingGroups.values()].every(siblings => {
              if (column.key === 'name') {
                return siblings.every((row, index) => row.name.length > 0 && (index === 0 || (
                  step.direction === 'ascending'
                    ? nameCollator.compare(siblings[index - 1].name, row.name) <= 0
                    : nameCollator.compare(siblings[index - 1].name, row.name) >= 0
                )));
              }
              if (column.key === 'availability') {
                const ranks = siblings.map(row => availabilityRanks.get(row.availabilityTone));
                return ranks.every((rank, index) => rank !== undefined && (index === 0 || (
                  step.direction === 'ascending' ? ranks[index - 1]! <= rank : ranks[index - 1]! >= rank
                )));
              }
              const prices = siblings
                .filter(row => row.priceLabel.endsWith('z DDV'))
                .map(row => euroAmount(row.priceLabel));
              return prices.every((price, index) => index === 0 || (step.direction === 'ascending'
                ? prices[index - 1] <= price : prices[index - 1] >= price));
            });
          }).toBeTruthy();
          await expect.poll(() => categoryHeadings.evaluateAll(headings => headings.map(heading => heading.id)))
            .toEqual(defaultHeadingOrder);
          await expect(sortGroups).toHaveCount(headerHandles.length);
          for (const [index, handle] of headerHandles.entries()) {
            expect(await sortGroups.nth(index).evaluate((element, original) => element === original, handle)).toBeTruthy();
          }
          await expect(retainedProduct).toBeVisible();
          expect(await retainedProduct.evaluate((element, original) => element === original, rowHandle!)).toBeTruthy();
          expect(await retainedProduct.locator('img').first().evaluate((element, original) => element === original, imageHandle!)).toBeTruthy();
        }
      }
    } finally {
      await rowHandle?.dispose();
      await imageHandle?.dispose();
      for (const handle of headerHandles) await handle.dispose();
    }
  }
});

test('compact category rows retain price filtering and product detail navigation', async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const { category, subcategory } = await publicCatalogBranch(request);
  await page.goto(catalogSubcategoryHref(category.slug, subcategory.slug));
  await waitForCatalogHydration(page);
  const results = catalogResults(page);
  const rows = results.locator('[data-catalog-product]');
  const imageRow = rows.filter({ has: page.locator('img') }).first();
  await expect(imageRow).toBeVisible();
  const image = imageRow.locator('img').first();
  const [rowBox, imageBox] = await Promise.all([imageRow.boundingBox(), image.boundingBox()]);
  expect(rowBox).not.toBeNull();
  expect(imageBox).not.toBeNull();
  expect(rowBox!.width).toBeGreaterThan(rowBox!.height * 3);
  expect(imageBox!.width).toBeLessThanOrEqual(100);
  expect(imageBox!.height).toBeLessThanOrEqual(60);
  await expect(page.locator('.storefront-product-grid')).toHaveCount(0);
  const pricedRow = rows.filter({ has: page.locator(':scope > span[aria-label$="z DDV"]') }).first();
  await expect(pricedRow).toBeVisible();
  const price = euroAmount(await catalogPrice(pricedRow).getAttribute('aria-label') ?? '');
  const min = page.getByRole('spinbutton', { name: 'Najnižja cena v evrih', exact: true });
  const max = page.getByRole('spinbutton', { name: 'Najvišja cena v evrih', exact: true });
  await min.fill(String(price));
  await max.fill(String(price));
  await expect(rows.first()).toBeVisible();
  await expect.poll(async () => {
    const filteredPrices = await rows.locator(':scope > span[aria-label]').evaluateAll(elements =>
      elements.map(element => element.getAttribute('aria-label') ?? '')
    );
    return filteredPrices.length > 0 && filteredPrices.every(label => euroAmount(label) === price);
  }).toBeTruthy();
  await min.fill(String(price + 1));
  await expect(page.getByRole('alert')).toHaveText('Najnižja cena ne sme presegati najvišje.');
  await expect(rows).toHaveCount(0);
  await clearCatalogFilters(page);
  await expect(rows.first()).toBeVisible();
  const view = rows.first().getByRole('link');
  await expect(view).toHaveCount(1);
  const label = await view.getAttribute('aria-label');
  expect(label).toBeTruthy();
  await expect(view).toHaveAttribute('href', /^\/products\/[^/]+\/items\/[^/]+$/u);
  await view.click();
  await expect(page.getByRole('heading', {
    level: 1, name: label!, exact: true,
  })).toBeVisible();
});

test('catalog rows retain product price, description, and detail navigation alongside the admin preview', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await assertAuthenticatedAdmin(request);

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
    // Session activity does not persist content or unsaved editor changes.
    if (outgoing.method() === 'POST'
      && new URL(outgoing.url()).pathname === '/api/admin/session/activity') {
      await route.continue();
      return;
    }
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
  const publicRow = catalogResults(page).locator('[data-catalog-product]').filter({
    has: page.getByText(branch.product.name, { exact: true }),
  });
  await expect(publicRow).toHaveCount(1);
  await expect(publicRow).toBeVisible();
  await expect(publicRow).toContainText(makeExpectedListingDescription(branch.sourceDescription));
  const publicMinimumPrice = euroAmount(await catalogPrice(publicRow).getAttribute('aria-label') ?? '');
  await expect(publicRow.getByRole('link')).toHaveCount(1);
  const productHref = await publicRow.getByRole('link').getAttribute('href');
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
  const productSelect = getAppearanceEditorCompactSelect(
    page,
    'Artikel v predogledu',
  );
  await expect(productSelect).toBeVisible();
  await chooseAppearanceEditorCompactSelectOption(
    page,
    productSelect,
    branch.productRecord.slug,
  );
  expect(await readAppearanceEditorCompactSelectValue(productSelect))
    .toBe(branch.productRecord.slug);

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

  expect(euroAmount(adminContract.price), 'the public row and admin preview should use the same lowest gross price')
    .toBe(publicMinimumPrice);
  expect(adminContract.description, 'the admin preview should retain canonical product description copy')
    .toBe(makeExpectedListingDescription(branch.sourceDescription));
  expect(
    writes,
    'opening the public listing and its admin preview must remain read-only',
  ).toEqual([]);
});

test('admin Seznam preview retains compact cards and editable controls without saving', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await assertAuthenticatedAdmin(request);

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
  await expect(getAppearanceEditorCompactSelect(
    page,
    'Artikel v predogledu',
  )).toBeVisible();

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
    'the repeated listing preview should expose one editable representative card',
  ).toHaveCount(1);
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
    'only the representative card should own the editable listing-card canvas wrapper',
  ).toEqual([1, ...Array.from({ length: renderedCardCount - 1 }, () => 0)]);
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
  ).toBeLessThanOrEqual(
    // The narrower editor grid wraps the representative card copy one line
    // earlier than the public grid. Keep the 1.8 design cap while allowing
    // the same bounded device-pixel quantization used by the public assertion.
    cardBox!.width * 1.8 + 6,
  );
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
  ).toBeLessThanOrEqual(
    // A single extra wrapped copy line in the editor is roughly ten rendered
    // pixels at preview scale; it must not be mistaken for an oversized card.
    cardBox!.width * 0.78 + 10,
  );
  await expectMarketplaceNoiseAbsent(cards);
  const adminMarketplaceContract = await readMarketplaceCardContract(card);
  await expect(card).toHaveClass(/\bstorefront-product-listing-card\b/);
  await expect(card).toHaveAttribute('data-product-card-layout', 'grid');
  expectAmazonInspiredListingCard(adminMarketplaceContract);
  expect(
    persistedWrites,
    'switching to the Seznam preview must not persist appearance settings',
  ).toEqual([]);
});
