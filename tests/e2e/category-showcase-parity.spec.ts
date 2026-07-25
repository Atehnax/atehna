import { expect, test, type Page } from '@playwright/test';
import {
  deriveCategoryShowcaseBackgroundHoverColor,
  normalizeCategoryShowcaseMediaSettings
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
  expect(Math.abs(actual.tileWidth / actual.tileHeight - expected.tileWidth / expected.tileHeight))
    .toBeLessThan(0.08);
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

test('category showcase geometry stays aligned across public and admin previews', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });

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
