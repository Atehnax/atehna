import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import nextEnv from '@next/env';
import { catalogCategoryHref, catalogSubcategoryHref } from '../../src/commercial/catalog/catalogRoutes';
import {
  getHomepagePreviewDeviceForViewport,
  resolveHomepageCategoryCardHeight,
  resolveHomepageSharedCategoryTitleCanvasSettings,
  type HomepageCanvasSettings,
  type HomepageCategoriesSettings
} from '../../src/shared/domain/landing/landingPage';
import {
  deriveCategoryShowcaseBackgroundHoverColor,
  normalizeCategoryShowcaseMediaSettings,
  type CategoryShowcaseMediaSettings
} from '../../src/shared/features/category-showcase/categoryShowcaseSchema';

type CategoryShowcaseGeometry = {
  slug: string;
  tileWidth: number;
  tileHeight: number;
  gap: number;
  radius: number;
  titleFontSize: number;
  titleLineHeight: number;
  titleInsetX: number;
  titleInsetY: number;
  titleHeight: number;
  titleColor: string;
  titleFontWeight: string;
  mediaLeftRatio: number;
  mediaWidthRatio: number;
  surface: string;
  hoverSurface: string;
  titleToken: string;
  titleHoverToken: string;
  ordinalToken: string;
  ordinalHoverToken: string;
  presentationTransform: string;
  presentationTransformOrigin: string;
  cropLeft: string;
  cropTop: string;
  cropWidth: string;
  cropHeight: string;
  objectFit: string;
  objectPosition: string;
  imageSource: string;
  imageSizes: string;
  ordinalFontSize: number;
  ordinalColor: string;
  ordinalInsetX: number;
  ordinalInsetY: number;
  ordinalWidth: number;
  ordinalHeight: number;
};

type SharedCategoryVisual = Pick<
  CategoryShowcaseGeometry,
  | 'surface'
  | 'hoverSurface'
  | 'titleToken'
  | 'titleHoverToken'
  | 'ordinalToken'
  | 'ordinalHoverToken'
  | 'presentationTransform'
  | 'presentationTransformOrigin'
  | 'cropLeft'
  | 'cropTop'
  | 'cropWidth'
  | 'cropHeight'
  | 'objectFit'
  | 'objectPosition'
  | 'imageSource'
  | 'ordinalFontSize'
  | 'ordinalColor'
  | 'ordinalWidth'
  | 'ordinalHeight'
>;

type CatalogPreviewSubcategory = {
  id: string;
  slug: string;
  title: string;
  description: string;
  image: string;
  presentation: CategoryShowcaseMediaSettings;
  subcategories: CatalogPreviewSubcategory[];
};

type CatalogPreviewCategory = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  image: string;
  presentation: CategoryShowcaseMediaSettings;
  subcategories: CatalogPreviewSubcategory[];
};

type CatalogPreviewPayload = {
  categories: CatalogPreviewCategory[];
  statuses: Record<string, 'active' | 'inactive'>;
};

type ShowcaseStructure = {
  tileHeight: number;
  inlineTileHeight: string;
  radius: number;
  mediaLeftRatio: number;
  mediaWidthRatio: number;
  ordinalInsetX: number;
  ordinalInsetY: number;
  titleFontSize: number;
  titleLineHeight: number;
  titleFontWeight: string;
  gap: number;
  desktopColumns: string;
  tabletColumns: string;
  mobileColumns: string;
  hasDirectionIndicator: boolean;
};

const { loadEnvConfig } = nextEnv;

async function ensureAdminSession(request: APIRequestContext) {
  const probe = await request.get('/api/admin/landing-page');
  if (probe.status() !== 401) {
    expect(probe.ok()).toBeTruthy();
    return;
  }

  loadEnvConfig(process.cwd(), true);
  const username = process.env.ADMIN_USERNAME?.trim() || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin';
  const login = await request.post('/api/admin/login', {
    data: { username, password }
  });
  if (!login.ok()) {
    throw new Error(`Admin test login failed with status ${login.status()}.`);
  }
}

async function ensurePageAdminSession(page: Page, request: APIRequestContext) {
  await ensureAdminSession(request);
  await page.context().addCookies((await request.storageState()).cookies);
}

async function readCatalogPreviewPayload(request: APIRequestContext): Promise<CatalogPreviewPayload> {
  const response = await request.get('/api/admin/categories');
  expect(response.ok()).toBeTruthy();
  return await response.json() as CatalogPreviewPayload;
}

async function readLandingCategorySettings(request: APIRequestContext): Promise<{
  categories: HomepageCategoriesSettings;
  canvas: HomepageCanvasSettings;
}> {
  const response = await request.get('/api/admin/landing-page');
  expect(response.ok()).toBeTruthy();
  const payload = await response.json() as {
    config: {
      categories: HomepageCategoriesSettings;
      canvas: HomepageCanvasSettings;
    };
  };
  return payload.config;
}

function isActive(statuses: CatalogPreviewPayload['statuses'], key: string) {
  return statuses[key] !== 'inactive';
}

function findPublicCategoryWithSubcategories(payload: CatalogPreviewPayload) {
  for (const category of payload.categories) {
    if (!isActive(payload.statuses, `cat:${category.slug}`)) continue;
    const publicSubcategories = category.subcategories.filter((subcategory) => (
      isActive(payload.statuses, `sub:${category.slug}:${subcategory.slug}`)
    ));
    if (publicSubcategories.length > 0) return { category, publicSubcategories };
  }
  return null;
}

async function readShowcaseStructure(
  page: Page,
  scopeSelector: string,
  tileSelector: string,
  categorySlug?: string
): Promise<ShowcaseStructure> {
  return page.evaluate(
    ({ scopeSelector: scopeQuery, tileSelector: tileQuery, categorySlug: requestedSlug }) => {
      const scope = document.querySelector(scopeQuery);
      const tiles = Array.from(scope?.querySelectorAll<HTMLElement>(tileQuery) ?? []);
      const tile = requestedSlug
        ? tiles.find((candidate) => candidate.dataset.categorySlug === requestedSlug)
        : tiles[0];
      const grid = tile?.closest<HTMLElement>('[data-testid="category-showcase-grid"]');
      const media = tile?.querySelector<HTMLElement>('[data-testid="category-showcase-media"]');
      const ordinal = tile?.querySelector<HTMLElement>('[data-category-showcase-ordinal-indicator]');
      const title = tile?.querySelector<HTMLElement>('[data-testid="category-showcase-title"] h3');
      if (!tile || !grid || !media || !ordinal) {
        throw new Error(`Shared category showcase structure is missing for ${requestedSlug ?? 'the first tile'}.`);
      }

      const tileRect = tile.getBoundingClientRect();
      const mediaRect = media.getBoundingClientRect();
      const ordinalRect = ordinal.getBoundingClientRect();
      const tileStyle = getComputedStyle(tile);
      const gridStyle = getComputedStyle(grid);
      const titleStyle = title ? getComputedStyle(title) : null;

      return {
        tileHeight: tileRect.height,
        inlineTileHeight: tile.style.height,
        radius: Number.parseFloat(tileStyle.borderRadius),
        mediaLeftRatio: (mediaRect.left - tileRect.left) / tileRect.width,
        mediaWidthRatio: mediaRect.width / tileRect.width,
        ordinalInsetX: ordinalRect.left - tileRect.left,
        ordinalInsetY: ordinalRect.top - tileRect.top,
        titleFontSize: titleStyle ? Number.parseFloat(titleStyle.fontSize) : 0,
        titleLineHeight: titleStyle ? Number.parseFloat(titleStyle.lineHeight) : 0,
        titleFontWeight: titleStyle?.fontWeight ?? '',
        gap: Number.parseFloat(gridStyle.columnGap),
        desktopColumns: grid.style.getPropertyValue('--category-showcase-columns-desktop').trim(),
        tabletColumns: grid.style.getPropertyValue('--category-showcase-columns-tablet').trim(),
        mobileColumns: grid.style.getPropertyValue('--category-showcase-columns-mobile').trim(),
        hasDirectionIndicator: Boolean(tile.querySelector('[data-category-showcase-ordinal-arrow]'))
      };
    },
    { scopeSelector, tileSelector, categorySlug }
  );
}

function expectSharedShowcaseStructure(
  actual: ShowcaseStructure,
  expected: ShowcaseStructure,
  options: { compareHeight?: boolean; compareTypography?: boolean } = {}
) {
  if (options.compareHeight !== false) {
    expect(actual.tileHeight).toBeCloseTo(expected.tileHeight, 1);
  }
  expect(actual.radius).toBeCloseTo(expected.radius, 1);
  expect(actual.mediaLeftRatio).toBeCloseTo(expected.mediaLeftRatio, 3);
  expect(actual.mediaWidthRatio).toBeCloseTo(expected.mediaWidthRatio, 3);
  expect(actual.ordinalInsetX).toBeCloseTo(expected.ordinalInsetX, 1);
  expect(actual.ordinalInsetY).toBeCloseTo(expected.ordinalInsetY, 1);
  expect(actual.gap).toBeCloseTo(expected.gap, 1);
  expect(actual.desktopColumns).toBe(expected.desktopColumns);
  expect(actual.tabletColumns).toBe(expected.tabletColumns);
  expect(actual.mobileColumns).toBe(expected.mobileColumns);
  expect(actual.hasDirectionIndicator).toBe(expected.hasDirectionIndicator);
  if (options.compareTypography !== false) {
    expect(actual.titleFontSize).toBeCloseTo(expected.titleFontSize, 1);
    expect(actual.titleLineHeight).toBeCloseTo(expected.titleLineHeight, 1);
    expect(actual.titleFontWeight).toBe(expected.titleFontWeight);
  }
}

function expectVisualToUsePresentation(
  actual: SharedCategoryVisual,
  rawPresentation: CategoryShowcaseMediaSettings
) {
  const presentation = normalizeCategoryShowcaseMediaSettings(rawPresentation);
  expect(actual.surface).toBe(presentation.backgroundColor);
  expect(actual.hoverSurface).toBe(presentation.backgroundHoverColor);
  expect(actual.titleToken).toBe(presentation.titleColor);
  expect(actual.titleHoverToken).toBe(presentation.titleHoverColor);
  expect(actual.ordinalToken).toBe(presentation.ordinalColor);
  expect(actual.ordinalHoverToken).toBe(presentation.ordinalHoverColor);
  expect(actual.ordinalFontSize).toBeCloseTo(presentation.ordinalFontSizePx, 2);
  expect(actual.ordinalWidth).toBeCloseTo(
    Math.max(32, Math.ceil(presentation.ordinalFontSizePx * 2.2)),
    2
  );
  expect(actual.ordinalHeight).toBeCloseTo(
    Math.max(16, Math.ceil(presentation.ordinalFontSizePx * 1.35)),
    2
  );

  const transformMatch = /^translate3d\(\s*(-?\d+(?:\.\d+)?)%,\s*(-?\d+(?:\.\d+)?)%,\s*0(?:px)?\s*\)\s*scale\(\s*(-?\d+(?:\.\d+)?)\s*\)$/.exec(
    actual.presentationTransform
  );
  expect(transformMatch, actual.presentationTransform).not.toBeNull();
  if (!transformMatch) throw new Error(`Unexpected presentation transform: ${actual.presentationTransform}`);
  expect(Number(transformMatch[1])).toBeCloseTo(presentation.offsetOriginX + presentation.offsetX, 3);
  expect(Number(transformMatch[2])).toBeCloseTo(presentation.offsetOriginY + presentation.offsetY, 3);
  expect(Number(transformMatch[3])).toBeCloseTo(presentation.scale, 3);

  const originValues = actual.presentationTransformOrigin.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  expect(originValues[0]).toBeCloseTo(presentation.focalPoint.x * 100, 3);
  expect(originValues[1]).toBeCloseTo(presentation.focalPoint.y * 100, 3);
  expect(Number.parseFloat(actual.cropLeft)).toBeCloseTo(-(presentation.crop.x / presentation.crop.width) * 100, 3);
  expect(Number.parseFloat(actual.cropTop)).toBeCloseTo(-(presentation.crop.y / presentation.crop.height) * 100, 3);
  expect(Number.parseFloat(actual.cropWidth)).toBeCloseTo((1 / presentation.crop.width) * 100, 3);
  expect(Number.parseFloat(actual.cropHeight)).toBeCloseTo((1 / presentation.crop.height) * 100, 3);
}

function presentationVisual(actual: SharedCategoryVisual) {
  return {
    surface: actual.surface,
    hoverSurface: actual.hoverSurface,
    titleToken: actual.titleToken,
    titleHoverToken: actual.titleHoverToken,
    ordinalToken: actual.ordinalToken,
    ordinalHoverToken: actual.ordinalHoverToken,
    presentationTransform: actual.presentationTransform,
    presentationTransformOrigin: actual.presentationTransformOrigin,
    cropLeft: actual.cropLeft,
    cropTop: actual.cropTop,
    cropWidth: actual.cropWidth,
    cropHeight: actual.cropHeight,
    ordinalFontSize: actual.ordinalFontSize,
    ordinalWidth: actual.ordinalWidth,
    ordinalHeight: actual.ordinalHeight
  };
}

async function readSharedCategoryVisuals(
  page: Page,
  scopeSelector: string,
  tileSelector: string
): Promise<Record<string, SharedCategoryVisual>> {
  return page.evaluate(
    ({ scopeSelector: scopeQuery, tileSelector: tileQuery }) => {
      const scope = document.querySelector(scopeQuery);
      return Object.fromEntries(Array.from(scope?.querySelectorAll<HTMLElement>(tileQuery) ?? []).flatMap((tile) => {
        const slug = tile.dataset.categorySlug;
        const presentation = tile.querySelector<HTMLElement>('[data-category-showcase-presentation]');
        const crop = presentation?.firstElementChild as HTMLElement | null;
        const image = crop?.querySelector<HTMLImageElement>('img') ?? null;
        const ordinalNumber = tile.querySelector<HTMLElement>('[data-category-showcase-ordinal-number]');
        const ordinalIndicator = tile.querySelector<HTMLElement>('[data-category-showcase-ordinal-indicator]');
        if (!slug || !presentation || !crop || !ordinalNumber || !ordinalIndicator) return [];
        const imageStyle = image ? getComputedStyle(image) : null;
        const imageUrl = image ? new URL(image.getAttribute('src') ?? '', window.location.href) : null;
        const imageSource = imageUrl?.pathname === '/_next/image'
          ? imageUrl.searchParams.get('url') ?? imageUrl.pathname
          : imageUrl?.pathname ?? '';
        const ordinalNumberStyle = getComputedStyle(ordinalNumber);
        const ordinalIndicatorStyle = getComputedStyle(ordinalIndicator);
        const tileStyle = getComputedStyle(tile);
        return [[slug, {
          surface: tileStyle.getPropertyValue('--category-showcase-surface').trim(),
          hoverSurface: tileStyle.getPropertyValue('--category-showcase-hover-surface').trim(),
          titleToken: tileStyle.getPropertyValue('--category-showcase-title').trim(),
          titleHoverToken: tileStyle.getPropertyValue('--category-showcase-title-hover').trim(),
          ordinalToken: tileStyle.getPropertyValue('--category-showcase-ordinal').trim(),
          ordinalHoverToken: tileStyle.getPropertyValue('--category-showcase-ordinal-hover').trim(),
          presentationTransform: presentation.style.transform,
          presentationTransformOrigin: presentation.style.transformOrigin,
          cropLeft: crop.style.left,
          cropTop: crop.style.top,
          cropWidth: crop.style.width,
          cropHeight: crop.style.height,
          objectFit: imageStyle?.objectFit ?? '',
          objectPosition: imageStyle?.objectPosition ?? '',
          imageSource,
          ordinalFontSize: Number.parseFloat(ordinalNumberStyle.fontSize),
          ordinalColor: ordinalIndicatorStyle.color,
          ordinalWidth: Number.parseFloat(ordinalIndicatorStyle.width),
          ordinalHeight: Number.parseFloat(ordinalIndicatorStyle.height)
        }]];
      }));
    },
    { scopeSelector, tileSelector }
  );
}

async function readCategoryShowcaseGeometry(
  page: Page,
  scopeSelector: string,
  tileSelector: string,
  scaleSelector?: string,
  categorySlug?: string
): Promise<CategoryShowcaseGeometry> {
  return page.evaluate(
    ({ scopeSelector: scope, tileSelector: tileQuery, scaleSelector: scaleQuery, categorySlug: requestedSlug }) => {
      const scopeElement = document.querySelector(scope);
      const tiles = Array.from(scopeElement?.querySelectorAll<HTMLElement>(tileQuery) ?? []);
      const firstTile = requestedSlug
        ? tiles.find((tile) => tile.dataset.categorySlug === requestedSlug)
        : tiles[0];
      const firstRect = firstTile?.getBoundingClientRect();
      const secondTile = firstRect
        ? tiles.find((tile) => {
          if (tile === firstTile) return false;
          return Math.abs(tile.getBoundingClientRect().top - firstRect.top) < 2;
        })
        : undefined;
      const grid = firstTile?.closest<HTMLElement>('[data-testid="category-showcase-grid"]');
      const title = firstTile?.querySelector<HTMLElement>('[data-testid="category-showcase-title"] h3');
      const media = firstTile?.querySelector<HTMLElement>('[data-testid="category-showcase-media"]');
      const presentation = firstTile?.querySelector<HTMLElement>('[data-category-showcase-presentation]');
      const crop = presentation?.firstElementChild as HTMLElement | null;
      const image = crop?.querySelector<HTMLImageElement>('img');
      const ordinalNumber = firstTile?.querySelector<HTMLElement>('[data-category-showcase-ordinal-number]');
      const ordinalIndicator = firstTile?.querySelector<HTMLElement>('[data-category-showcase-ordinal-indicator]');
      const scaleElement = scaleQuery ? document.querySelector<HTMLElement>(scaleQuery) : null;
      const scale = Number(scaleElement?.dataset.previewScale) || 1;

      if (!firstTile || !firstRect || !secondTile || !grid || !title || !media || !presentation || !crop || !image || !ordinalNumber || !ordinalIndicator) {
        throw new Error('Category showcase geometry is not available.');
      }

      const secondRect = secondTile.getBoundingClientRect();
      const titleRect = title.getBoundingClientRect();
      const mediaRect = media.getBoundingClientRect();
      const tileStyle = getComputedStyle(firstTile);
      const titleStyle = getComputedStyle(title);
      const ordinalNumberStyle = getComputedStyle(ordinalNumber);
      const ordinalIndicatorStyle = getComputedStyle(ordinalIndicator);
      const imageStyle = getComputedStyle(image);
      const imageUrl = new URL(image.getAttribute('src') ?? '', window.location.href);
      const imageSource = imageUrl.pathname === '/_next/image'
        ? imageUrl.searchParams.get('url') ?? imageUrl.pathname
        : imageUrl.pathname;
      const horizontalGap = secondRect.left > firstRect.left
        ? secondRect.left - firstRect.right
        : firstRect.left - secondRect.right;

      return {
        slug: firstTile.dataset.categorySlug ?? '',
        tileWidth: firstRect.width / scale,
        tileHeight: firstRect.height / scale,
        gap: horizontalGap / scale,
        radius: Number.parseFloat(tileStyle.borderRadius),
        titleFontSize: Number.parseFloat(titleStyle.fontSize),
        titleLineHeight: Number.parseFloat(titleStyle.lineHeight),
        titleInsetX: (titleRect.left - firstRect.left) / scale,
        titleInsetY: (titleRect.top - firstRect.top) / scale,
        titleHeight: titleRect.height / scale,
        titleColor: titleStyle.color,
        titleFontWeight: titleStyle.fontWeight,
        mediaLeftRatio: (mediaRect.left - firstRect.left) / firstRect.width,
        mediaWidthRatio: mediaRect.width / firstRect.width,
        surface: tileStyle.getPropertyValue('--category-showcase-surface').trim(),
        hoverSurface: tileStyle.getPropertyValue('--category-showcase-hover-surface').trim(),
        titleToken: tileStyle.getPropertyValue('--category-showcase-title').trim(),
        titleHoverToken: tileStyle.getPropertyValue('--category-showcase-title-hover').trim(),
        ordinalToken: tileStyle.getPropertyValue('--category-showcase-ordinal').trim(),
        ordinalHoverToken: tileStyle.getPropertyValue('--category-showcase-ordinal-hover').trim(),
        presentationTransform: presentation.style.transform,
        presentationTransformOrigin: presentation.style.transformOrigin,
        cropLeft: crop.style.left,
        cropTop: crop.style.top,
        cropWidth: crop.style.width,
        cropHeight: crop.style.height,
        objectFit: imageStyle.objectFit,
        objectPosition: imageStyle.objectPosition,
        imageSource,
        imageSizes: image.getAttribute('sizes') ?? '',
        ordinalFontSize: Number.parseFloat(ordinalNumberStyle.fontSize),
        ordinalColor: ordinalIndicatorStyle.color,
        ordinalInsetX: (ordinalIndicator.getBoundingClientRect().left - firstRect.left) / scale,
        ordinalInsetY: (ordinalIndicator.getBoundingClientRect().top - firstRect.top) / scale,
        ordinalWidth: Number.parseFloat(ordinalIndicatorStyle.width),
        ordinalHeight: Number.parseFloat(ordinalIndicatorStyle.height)
      };
    },
    { scopeSelector, tileSelector, scaleSelector, categorySlug }
  );
}

function expectCategoryShowcaseGeometryToMatch(
  actual: CategoryShowcaseGeometry,
  expected: CategoryShowcaseGeometry
) {
  expect(actual.tileHeight).toBeCloseTo(expected.tileHeight, 1);
  expect(actual.gap).toBeCloseTo(expected.gap, 1);
  expect(actual.radius).toBeCloseTo(expected.radius, 1);
  expect(actual.titleFontSize).toBeCloseTo(expected.titleFontSize, 1);
  expect(actual.titleLineHeight).toBeCloseTo(expected.titleLineHeight, 1);
  expect(actual.titleInsetX).toBeCloseTo(expected.titleInsetX, 1);
  expect(actual.titleInsetY).toBeCloseTo(expected.titleInsetY, 1);
  expect(actual.titleHeight).toBeCloseTo(expected.titleHeight, 1);
  expect(actual.titleColor).toBe(expected.titleColor);
  expect(actual.titleFontWeight).toBe(expected.titleFontWeight);
  expect(actual.mediaLeftRatio).toBeCloseTo(expected.mediaLeftRatio, 2);
  expect(actual.mediaWidthRatio).toBeCloseTo(expected.mediaWidthRatio, 2);
  expect(actual.surface).toBe(expected.surface);
  expect(actual.hoverSurface).toBe(expected.hoverSurface);
  expect(actual.titleToken).toBe(expected.titleToken);
  expect(actual.titleHoverToken).toBe(expected.titleHoverToken);
  expect(actual.ordinalToken).toBe(expected.ordinalToken);
  expect(actual.ordinalHoverToken).toBe(expected.ordinalHoverToken);
  expect(actual.presentationTransform).toBe(expected.presentationTransform);
  expect(actual.presentationTransformOrigin).toBe(expected.presentationTransformOrigin);
  expect(actual.cropLeft).toBe(expected.cropLeft);
  expect(actual.cropTop).toBe(expected.cropTop);
  expect(actual.cropWidth).toBe(expected.cropWidth);
  expect(actual.cropHeight).toBe(expected.cropHeight);
  expect(actual.objectFit).toBe(expected.objectFit);
  expect(actual.objectPosition).toBe(expected.objectPosition);
  expect(actual.imageSource).toBe(expected.imageSource);
  expect(actual.ordinalFontSize).toBeCloseTo(expected.ordinalFontSize, 2);
  expect(actual.ordinalColor).toBe(expected.ordinalColor);
  expect(actual.ordinalInsetX).toBeCloseTo(expected.ordinalInsetX, 1);
  expect(actual.ordinalInsetY).toBeCloseTo(expected.ordinalInsetY, 1);
  expect(actual.ordinalWidth).toBeCloseTo(expected.ordinalWidth, 2);
  expect(actual.ordinalHeight).toBeCloseTo(expected.ordinalHeight, 2);
  const actualAspectRatio = actual.tileWidth / actual.tileHeight;
  const expectedAspectRatio = expected.tileWidth / expected.tileHeight;
  // Admin and storefront previews occupy independent responsive lanes, so
  // compare their card proportions rather than requiring identical widths.
  expect(Math.abs(actualAspectRatio / expectedAspectRatio - 1)).toBeLessThan(0.1);
}

test('legacy category colours receive compatible hover defaults', () => {
  const legacy = normalizeCategoryShowcaseMediaSettings({
    backgroundColor: '#102030',
    ordinalColor: '#405060',
    titleColor: '#708090'
  });

  expect(legacy.titleHoverColor).toBe('#708090');
  expect(legacy.ordinalHoverColor).toBe('#405060');
  expect(legacy.backgroundHoverColor).toBe(deriveCategoryShowcaseBackgroundHoverColor('#102030'));

  const explicit = normalizeCategoryShowcaseMediaSettings({
    titleColor: '#abcdef',
    titleHoverColor: '#fedcba',
    ordinalColor: '#123abc',
    ordinalHoverColor: '#321cba',
    backgroundColor: '#a1b2c3',
    backgroundHoverColor: '#c3b2a1'
  });

  expect(explicit.titleColor).toBe('#ABCDEF');
  expect(explicit.titleHoverColor).toBe('#FEDCBA');
  expect(explicit.ordinalColor).toBe('#123ABC');
  expect(explicit.ordinalHoverColor).toBe('#321CBA');
  expect(explicit.backgroundColor).toBe('#A1B2C3');
  expect(explicit.backgroundHoverColor).toBe('#C3B2A1');
});

async function expectOrdinalsToIgnoreTitleLength(
  page: Page,
  scopeSelector: string,
  tileSelector: string
) {
  const metrics = await page.evaluate(
    async ({ scopeSelector: scopeQuery, tileSelector: tileQuery }) => {
      const scope = document.querySelector(scopeQuery);
      const tiles = Array.from(scope?.querySelectorAll<HTMLElement>(tileQuery) ?? []);
      const firstTop = tiles[0]?.getBoundingClientRect().top;
      const row = firstTop === undefined
        ? []
        : tiles.filter((tile) => Math.abs(tile.getBoundingClientRect().top - firstTop) < 2).slice(0, 2);
      const titles = row.map((tile) => tile.querySelector<HTMLElement>('[data-testid="category-showcase-title"] h3'));
      if (row.length !== 2 || titles.some((title) => !title)) {
        throw new Error('Two category titles in the same row are required.');
      }

      titles[0]!.textContent = 'A';
      titles[1]!.textContent = 'Zelo dolg naslov kategorije, ki se zagotovo prelomi v več vrstic';
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });

      return row.map((tile, index) => {
        const tileRect = tile.getBoundingClientRect();
        const ordinal = tile.querySelector<HTMLElement>('[data-category-showcase-ordinal-indicator]');
        const title = titles[index];
        if (!ordinal || !title) throw new Error('Category ordinal geometry is not available.');
        const ordinalRect = ordinal.getBoundingClientRect();
        return {
          titleHeight: title.getBoundingClientRect().height,
          ordinalInsetX: ordinalRect.left - tileRect.left,
          ordinalInsetY: ordinalRect.top - tileRect.top
        };
      });
    },
    { scopeSelector, tileSelector }
  );

  expect(Math.abs(metrics[0].titleHeight - metrics[1].titleHeight)).toBeGreaterThan(5);
  expect(Math.abs(metrics[0].ordinalInsetX - metrics[1].ordinalInsetX)).toBeLessThanOrEqual(1);
  expect(Math.abs(metrics[0].ordinalInsetY - metrics[1].ordinalInsetY)).toBeLessThanOrEqual(1);
}

test('category showcase geometry stays aligned across public and admin previews', async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await ensurePageAdminSession(page, request);

  await page.goto('/');
  const publicTiles = page.locator('[data-homepage-category-card]');
  await expect(publicTiles.first()).toBeVisible({ timeout: 15_000 });
  expect(await publicTiles.count()).toBeGreaterThanOrEqual(2);
  const publicGeometry = await readCategoryShowcaseGeometry(
    page,
    'main',
    '[data-homepage-category-card]'
  );
  const publicVisuals = await readSharedCategoryVisuals(
    page,
    'main',
    '[data-homepage-category-card]'
  );
  await expectOrdinalsToIgnoreTitleLength(page, 'main', '[data-homepage-category-card]');

  await page.goto('/admin/podoba/glavna-stran');
  const previewStage = page.getByTestId('homepage-preview-stage');
  await expect(previewStage).toHaveAttribute('data-preview-ready', 'true', { timeout: 15_000 });
  await expect(previewStage).toHaveAttribute('data-preview-transitioning', 'false');
  const homepagePreviewTiles = page
    .getByTestId('homepage-preview-viewport')
    .locator('[data-homepage-category-card]');
  await expect(homepagePreviewTiles.first()).toBeVisible({ timeout: 15_000 });
  expect(await homepagePreviewTiles.count()).toBeGreaterThanOrEqual(2);
  const homepagePreviewGeometry = await readCategoryShowcaseGeometry(
    page,
    '[data-testid="homepage-preview-viewport"]',
    '[data-homepage-category-card]',
    '[data-testid="homepage-preview-stage"]',
    publicGeometry.slug
  );
  const homepagePreviewVisuals = await readSharedCategoryVisuals(
    page,
    '[data-testid="homepage-preview-viewport"]',
    '[data-homepage-category-card]'
  );
  await expectOrdinalsToIgnoreTitleLength(
    page,
    '[data-testid="homepage-preview-viewport"]',
    '[data-homepage-category-card]'
  );

  await page.goto('/admin/kategorije/predogled');
  const categoryPreviewTiles = page.getByTestId('category-showcase-tile');
  await expect(categoryPreviewTiles.first()).toBeVisible({ timeout: 15_000 });
  expect(await categoryPreviewTiles.count()).toBeGreaterThanOrEqual(2);
  const categoryPreviewGeometry = await readCategoryShowcaseGeometry(
    page,
    '[data-category-showcase-editor="category-preview"]',
    '[data-testid="category-showcase-tile"]',
    undefined,
    publicGeometry.slug
  );
  const categoryPreviewVisuals = await readSharedCategoryVisuals(
    page,
    '[data-category-showcase-editor="category-preview"]',
    '[data-testid="category-showcase-tile"]'
  );
  await expectOrdinalsToIgnoreTitleLength(
    page,
    '[data-category-showcase-editor="category-preview"]',
    '[data-testid="category-showcase-tile"]'
  );

  expectCategoryShowcaseGeometryToMatch(publicGeometry, homepagePreviewGeometry);
  expectCategoryShowcaseGeometryToMatch(categoryPreviewGeometry, homepagePreviewGeometry);

  const sharedSlugs = Object.keys(publicVisuals).filter(
    (slug) => homepagePreviewVisuals[slug] && categoryPreviewVisuals[slug]
  );
  expect(sharedSlugs.length).toBeGreaterThanOrEqual(2);
  for (const slug of sharedSlugs) {
    expect(homepagePreviewVisuals[slug]).toEqual(publicVisuals[slug]);
    expect(categoryPreviewVisuals[slug]).toEqual(publicVisuals[slug]);
  }
});

test('nested category showcases keep admin editor and storefront landing-card parity', async ({ page, request }) => {
  test.setTimeout(60_000);
  const viewportWidth = 1440;
  await page.setViewportSize({ width: viewportWidth, height: 1000 });
  await ensurePageAdminSession(page, request);

  const [catalog, landingSettings] = await Promise.all([
    readCatalogPreviewPayload(request),
    readLandingCategorySettings(request)
  ]);
  const landingCategorySettings = landingSettings.categories;
  const publicBranch = findPublicCategoryWithSubcategories(catalog);
  if (!publicBranch) {
    throw new Error('An active root category with at least one active direct subcategory is required.');
  }
  const { category, publicSubcategories } = publicBranch;
  const subcategory = publicSubcategories[0];
  const normalizedPresentation = normalizeCategoryShowcaseMediaSettings(subcategory.presentation);
  const device = getHomepagePreviewDeviceForViewport(viewportWidth);
  const effectiveLandingSettings = {
    ...landingCategorySettings,
    ...landingCategorySettings.responsive[device]
  };
  const sharedTitleSettings = resolveHomepageSharedCategoryTitleCanvasSettings(
    landingSettings.canvas,
    device
  );

  await page.goto('/');
  const landingTiles = page.locator('[data-homepage-category-card]');
  await expect(landingTiles.first()).toBeVisible({ timeout: 15_000 });
  const landingStructure = await readShowcaseStructure(
    page,
    'main',
    '[data-homepage-category-card]'
  );

  await page.goto('/admin/kategorije/predogled');
  const adminEditorSelector = '[data-category-showcase-editor="category-preview"]';
  const adminEditor = page.locator(adminEditorSelector);
  const rootTile = adminEditor.locator(
    `[data-testid="category-showcase-tile"][data-category-slug=${JSON.stringify(category.slug)}]`
  );
  await expect(rootTile).toBeVisible({ timeout: 15_000 });
  const rootCapabilities = await adminEditor.getAttribute('data-category-showcase-capabilities');
  expect(rootCapabilities).toBeTruthy();
  const rootStructure = await readShowcaseStructure(
    page,
    adminEditorSelector,
    '[data-testid="category-showcase-tile"]',
    category.slug
  );

  await rootTile.evaluate((tile) => (tile as HTMLElement).click());
  const nestedTiles = adminEditor.getByTestId('category-showcase-tile');
  const adminSubcategoryTile = adminEditor.locator(
    `[data-testid="category-showcase-tile"][data-category-slug=${JSON.stringify(subcategory.slug)}]`
  );
  await expect(adminSubcategoryTile).toBeVisible({ timeout: 15_000 });
  await expect(adminEditor).toHaveAttribute(
    'data-category-showcase-capabilities',
    rootCapabilities!
  );
  expect(await nestedTiles.evaluateAll((tiles) => tiles.map((tile) => (
    (tile as HTMLElement).dataset.categorySlug
  )))).toEqual(category.subcategories.map((entry) => entry.slug));

  const nestedAdminStructure = await readShowcaseStructure(
    page,
    adminEditorSelector,
    '[data-testid="category-showcase-tile"]',
    subcategory.slug
  );
  expectSharedShowcaseStructure(nestedAdminStructure, rootStructure);

  const nestedAdminVisuals = await readSharedCategoryVisuals(
    page,
    adminEditorSelector,
    '[data-testid="category-showcase-tile"]'
  );
  const nestedAdminVisual = nestedAdminVisuals[subcategory.slug];
  expect(nestedAdminVisual).toBeDefined();
  expectVisualToUsePresentation(nestedAdminVisual, subcategory.presentation);

  await adminSubcategoryTile.hover();
  await adminSubcategoryTile
    .getByRole('button', { name: 'Uredi videz kategorije', exact: true })
    .click();
  const nestedControls = page.locator(
    `[data-category-media-controls=${JSON.stringify(subcategory.slug)}]`
  );
  await expect(nestedControls).toBeVisible();
  await expect(
    nestedControls.locator('[data-category-media-field="title-color"]')
  ).toHaveValue(normalizedPresentation.titleColor);

  await page.goto(catalogCategoryHref(category.slug));
  const storefrontScopeSelector =
    `[data-storefront-subcategory-showcase=${JSON.stringify(category.slug)}]`;
  const storefrontScope = page.locator(storefrontScopeSelector);
  const storefrontTiles = storefrontScope.locator('[data-storefront-subcategory-card]');
  await expect(storefrontTiles.first()).toBeVisible({ timeout: 15_000 });
  await expect(storefrontTiles).toHaveCount(publicSubcategories.length);
  expect(await storefrontTiles.evaluateAll((tiles) => tiles.map((tile) => (
    (tile as HTMLElement).dataset.categorySlug
  )))).toEqual(publicSubcategories.map((entry) => entry.slug));

  const storefrontStructure = await readShowcaseStructure(
    page,
    storefrontScopeSelector,
    '[data-storefront-subcategory-card]',
    subcategory.slug
  );
  const expectedCardHeight = resolveHomepageCategoryCardHeight(
    effectiveLandingSettings,
    publicSubcategories
  );
  expect(storefrontStructure.inlineTileHeight).toBe(`${expectedCardHeight}px`);
  expect(storefrontStructure.desktopColumns).toBe(String(effectiveLandingSettings.columns));
  expect(storefrontStructure.tabletColumns).toBe(String(Math.min(2, effectiveLandingSettings.columns)));
  expect(storefrontStructure.mobileColumns).toBe('1');
  expect(storefrontStructure.gap).toBeCloseTo(effectiveLandingSettings.gap, 1);
  expect(storefrontStructure.hasDirectionIndicator).toBe(effectiveLandingSettings.showCardArrow);
  expectSharedShowcaseStructure(storefrontStructure, landingStructure, {
    compareHeight: false,
    compareTypography: false
  });

  const sharedStorefrontTitles = storefrontScope.locator(
    '[data-storefront-shared-category-title]'
  );
  if (!sharedTitleSettings.visible) {
    await expect(sharedStorefrontTitles).toHaveCount(0);
  } else {
    await expect(sharedStorefrontTitles).toHaveCount(publicSubcategories.length);
    const titleLayout = await sharedStorefrontTitles.first().evaluate((element) => {
      const wrapper = element as HTMLElement;
      const heading = wrapper.querySelector<HTMLElement>('h3');
      if (!heading) throw new Error('The shared storefront category title is missing its heading.');
      const headingStyle = getComputedStyle(heading);
      const letterSpacing = Number.parseFloat(headingStyle.letterSpacing);
      return {
        fontSize: Number.parseFloat(headingStyle.fontSize),
        lineHeight: Number.parseFloat(headingStyle.lineHeight),
        fontWeight: headingStyle.fontWeight,
        fontStyle: headingStyle.fontStyle,
        letterSpacing: Number.isFinite(letterSpacing) ? letterSpacing : 0,
        textAlign: headingStyle.textAlign,
        textDecorationLine: headingStyle.textDecorationLine,
        color: wrapper.style.color,
        headingColor: heading.style.color,
        left: wrapper.style.left,
        transform: wrapper.style.transform,
        width: wrapper.style.width,
        maxWidth: wrapper.style.maxWidth,
        height: wrapper.style.height,
        overflow: wrapper.style.overflow,
        padding: [
          wrapper.style.paddingTop,
          wrapper.style.paddingRight,
          wrapper.style.paddingBottom,
          wrapper.style.paddingLeft
        ],
        margin: [
          wrapper.style.marginTop,
          wrapper.style.marginRight,
          wrapper.style.marginBottom,
          wrapper.style.marginLeft
        ]
      };
    });
    const expectedHorizontalTranslate = sharedTitleSettings.horizontalAlign === 'center'
      ? `calc(-50% + ${sharedTitleSettings.offsetXPx}px)`
      : sharedTitleSettings.horizontalAlign === 'right'
        ? `calc(-100% + ${sharedTitleSettings.offsetXPx}px)`
        : `${sharedTitleSettings.offsetXPx}px`;
    expect(titleLayout.fontSize).toBeCloseTo(sharedTitleSettings.fontSizePx, 2);
    expect(titleLayout.lineHeight).toBeCloseTo(
      sharedTitleSettings.fontSizePx * sharedTitleSettings.lineHeight,
      2
    );
    expect(titleLayout.fontWeight).toBe(String(sharedTitleSettings.fontWeight));
    expect(titleLayout.fontStyle).toBe(sharedTitleSettings.italic ? 'italic' : 'normal');
    expect(titleLayout.letterSpacing).toBeCloseTo(sharedTitleSettings.letterSpacingPx, 2);
    expect(titleLayout.textAlign).toBe(sharedTitleSettings.textAlign);
    expect(titleLayout.textDecorationLine).toBe(
      sharedTitleSettings.underline ? 'underline' : 'none'
    );
    expect(titleLayout.color).toBe('inherit');
    expect(titleLayout.headingColor).toBe('inherit');
    expect(titleLayout.left).toBe(
      sharedTitleSettings.horizontalAlign === 'left'
        ? '0px'
        : sharedTitleSettings.horizontalAlign === 'center'
          ? '50%'
          : '100%'
    );
    expect(titleLayout.transform).toContain('translate3d(');
    if (sharedTitleSettings.horizontalAlign === 'left') {
      expect(titleLayout.transform).toContain(`translate3d(${expectedHorizontalTranslate}`);
    } else if (sharedTitleSettings.offsetXPx !== 0) {
      expect(titleLayout.transform).toContain(`${sharedTitleSettings.offsetXPx}px`);
    }
    expect(titleLayout.transform).toContain(`${sharedTitleSettings.offsetYPx}px`);
    expect(titleLayout.width).toBe(
      sharedTitleSettings.widthPx > 0 ? `${sharedTitleSettings.widthPx}px` : 'fit-content'
    );
    expect(titleLayout.maxWidth).toBe(sharedTitleSettings.widthPx === 0 ? '20rem' : '');
    expect(titleLayout.height).toBe(
      sharedTitleSettings.heightPx > 0 ? `${sharedTitleSettings.heightPx}px` : ''
    );
    expect(titleLayout.overflow).toBe(
      sharedTitleSettings.widthPx > 0 || sharedTitleSettings.heightPx > 0 ? 'hidden' : ''
    );
    expect(titleLayout.padding).toEqual([
      `${sharedTitleSettings.paddingTopPx}px`,
      `${sharedTitleSettings.paddingRightPx}px`,
      `${sharedTitleSettings.paddingBottomPx}px`,
      `${sharedTitleSettings.paddingLeftPx}px`
    ]);
    expect(titleLayout.margin).toEqual([
      `${sharedTitleSettings.marginTopPx}px`,
      `${sharedTitleSettings.marginRightPx}px`,
      `${sharedTitleSettings.marginBottomPx}px`,
      `${sharedTitleSettings.marginLeftPx}px`
    ]);
  }

  const storefrontVisuals = await readSharedCategoryVisuals(
    page,
    storefrontScopeSelector,
    '[data-storefront-subcategory-card]'
  );
  const storefrontVisual = storefrontVisuals[subcategory.slug];
  expect(storefrontVisual).toBeDefined();
  expectVisualToUsePresentation(storefrontVisual, subcategory.presentation);
  expect(presentationVisual(storefrontVisual)).toEqual(
    presentationVisual(nestedAdminVisual)
  );
  if (effectiveLandingSettings.cardStyle === 'title-only') {
    expect(storefrontVisual.imageSource).toBe('');
  } else {
    expect(storefrontVisual.objectFit).toBe(nestedAdminVisual.objectFit);
    expect(storefrontVisual.objectPosition).toBe(nestedAdminVisual.objectPosition);
    expect(storefrontVisual.imageSource).toBe(nestedAdminVisual.imageSource);
  }

  await expect(
    storefrontScope.locator(
      `[data-storefront-subcategory-card=${JSON.stringify(subcategory.slug)}]`
    ).getByRole('link', { name: subcategory.title, exact: true })
  ).toHaveAttribute('href', catalogSubcategoryHref(category.slug, subcategory.slug));
});
