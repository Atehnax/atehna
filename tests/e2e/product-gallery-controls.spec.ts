import {
  expect,
  test,
  type APIRequestContext,
  type Locator,
  type Page,
} from '@playwright/test';
import { catalogCategoryItemHref } from '../../src/commercial/catalog/catalogRoutes';
import type { CatalogItemEditorHydration } from '../../src/shared/domain/catalog/catalogAdminTypes';
import {
  chooseAppearanceEditorCompactSelectOption,
  getAppearanceEditorCompactSelect,
  readAppearanceEditorCompactSelectValue,
} from './support/appearance-editor-compact-select';
import { assertAuthenticatedAdmin } from './support/auth';

type CatalogProduct = {
  slug: string;
  status?: string;
};

type CatalogSubcategory = {
  slug: string;
  items: CatalogProduct[];
};

type CatalogCategory = {
  slug: string;
  items: CatalogProduct[];
  subcategories: CatalogSubcategory[];
};

type CatalogPayload = {
  categories: CatalogCategory[];
  statuses: Record<string, 'active' | 'inactive'>;
};

type GalleryFixture = {
  href: string;
  product: CatalogItemEditorHydration;
};

type ControlMetric = {
  kind: 'previous' | 'next' | 'zoom-indicator';
  hitWidth: number;
  hitHeight: number;
  visualWidth: number;
  visualHeight: number;
  iconWidth: number;
  iconHeight: number;
  visualCenterDelta: number;
  iconCenterDelta: number;
  visualRadius: number;
  hitBackground: string;
  visualBackground: string;
  iconColor: string;
};

const writeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const controlKinds = [
  'previous',
  'next',
  'zoom-indicator',
] as const;

const isActive = (statuses: CatalogPayload['statuses'], key: string) => (
  statuses[key] !== 'inactive'
);

async function findGalleryFixture(
  request: APIRequestContext,
): Promise<GalleryFixture | undefined> {
  const response = await request.get('/api/admin/categories');
  expect(response.ok()).toBeTruthy();
  const catalog = await response.json() as CatalogPayload;

  for (const category of catalog.categories) {
    if (!isActive(catalog.statuses, `cat:${category.slug}`)) continue;
    const products = [
      ...category.items,
      ...category.subcategories.flatMap((subcategory) => (
        isActive(
          catalog.statuses,
          `sub:${category.slug}:${subcategory.slug}`,
        )
          ? subcategory.items
          : []
      )),
    ];

    for (const summary of products) {
      if (summary.status === 'inactive') continue;
      const productResponse = await request.get(
        `/api/admin/artikli/${encodeURIComponent(summary.slug)}`,
      );
      if (!productResponse.ok()) continue;
      const product = await productResponse.json() as CatalogItemEditorHydration;
      const galleryImageCount = product.media.filter((entry) => (
        entry.mediaKind === 'image'
        && entry.role === 'gallery'
        && entry.hidden !== true
        && Boolean(entry.blobUrl || entry.externalUrl)
      )).length;
      if (product.status === 'active' && galleryImageCount >= 2) {
        return {
          href: catalogCategoryItemHref(category.slug, product.slug),
          product,
        };
      }
    }
  }

  return undefined;
}

function parseCssColor(value: string) {
  const channels = value.match(/[\d.]+/gu)?.map(Number) ?? [];
  return {
    red: channels[0] ?? 0,
    green: channels[1] ?? 0,
    blue: channels[2] ?? 0,
    alpha: channels[3] ?? 1,
  };
}

async function readGalleryControlMetrics(
  gallery: Locator,
): Promise<ControlMetric[]> {
  const metrics: ControlMetric[] = [];
  for (const kind of controlKinds) {
    const hit = gallery.locator(`[data-gallery-control="${kind}"]`);
    const visual = hit.locator('.storefront-gallery-control-visual');
    const icon = visual.locator('.storefront-gallery-control-icon');
    await expect(hit).toBeVisible();
    await expect(visual).toBeVisible();
    await expect(icon).toBeVisible();

    const [hitBox, visualBox, iconBox, styles] = await Promise.all([
      hit.boundingBox(),
      visual.boundingBox(),
      icon.boundingBox(),
      hit.evaluate((element) => {
        const visualElement = element.querySelector<HTMLElement>(
          '.storefront-gallery-control-visual',
        );
        const iconElement = element.querySelector<HTMLElement>(
          '.storefront-gallery-control-icon',
        );
        if (!visualElement || !iconElement) {
          throw new Error('Gallery control is missing its visual disc or icon.');
        }
        const hitStyle = getComputedStyle(element);
        const visualStyle = getComputedStyle(visualElement);
        const iconStyle = getComputedStyle(iconElement);
        const storefrontScale = Number.parseFloat(
          hitStyle.getPropertyValue('--commercial-storefront-scale'),
        ) || 1;
        return {
          hitWidth: Number.parseFloat(hitStyle.width) * storefrontScale,
          hitHeight: Number.parseFloat(hitStyle.height) * storefrontScale,
          visualWidth: Number.parseFloat(visualStyle.width) * storefrontScale,
          visualHeight: Number.parseFloat(visualStyle.height) * storefrontScale,
          iconWidth: Number.parseFloat(iconStyle.width) * storefrontScale,
          iconHeight: Number.parseFloat(iconStyle.height) * storefrontScale,
          hitBackground: hitStyle.backgroundColor,
          visualBackground: visualStyle.backgroundColor,
          visualRadius: Number.parseFloat(visualStyle.borderRadius)
            * storefrontScale,
          iconColor: iconStyle.color,
        };
      }),
    ]);
    expect(hitBox).not.toBeNull();
    expect(visualBox).not.toBeNull();
    expect(iconBox).not.toBeNull();

    const centerDelta = (
      outer: NonNullable<typeof hitBox>,
      inner: NonNullable<typeof visualBox>,
      scaleX: number,
      scaleY: number,
    ) => Math.max(
      Math.abs(
        (outer.x + outer.width / 2) - (inner.x + inner.width / 2),
      ) / scaleX,
      Math.abs(
        (outer.y + outer.height / 2) - (inner.y + inner.height / 2),
      ) / scaleY,
    );
    const renderedScaleX = hitBox!.width / styles.hitWidth;
    const renderedScaleY = hitBox!.height / styles.hitHeight;

    metrics.push({
      kind,
      hitWidth: styles.hitWidth,
      hitHeight: styles.hitHeight,
      visualWidth: styles.visualWidth,
      visualHeight: styles.visualHeight,
      iconWidth: styles.iconWidth,
      iconHeight: styles.iconHeight,
      visualCenterDelta: centerDelta(
        hitBox!,
        visualBox!,
        renderedScaleX,
        renderedScaleY,
      ),
      iconCenterDelta: centerDelta(
        visualBox!,
        iconBox!,
        renderedScaleX,
        renderedScaleY,
      ),
      visualRadius: styles.visualRadius,
      hitBackground: styles.hitBackground,
      visualBackground: styles.visualBackground,
      iconColor: styles.iconColor,
    });
  }
  return metrics;
}

function expectCompactGalleryControls(metrics: ControlMetric[]) {
  expect(metrics).toHaveLength(controlKinds.length);
  const reference = metrics[0];
  for (const metric of metrics) {
    expect(metric.hitWidth, `${metric.kind} should keep a 44px hit width`)
      .toBeGreaterThanOrEqual(43);
    expect(metric.hitWidth, `${metric.kind} should keep a 44px hit width`)
      .toBeLessThanOrEqual(45);
    expect(metric.hitHeight, `${metric.kind} should keep a 44px hit height`)
      .toBeGreaterThanOrEqual(43);
    expect(metric.hitHeight, `${metric.kind} should keep a 44px hit height`)
      .toBeLessThanOrEqual(45);
    expect(metric.visualWidth, `${metric.kind} should use a compact visual disc`)
      .toBeGreaterThanOrEqual(20);
    expect(metric.visualWidth, `${metric.kind} should use a compact visual disc`)
      .toBeLessThanOrEqual(24);
    expect(metric.visualHeight, `${metric.kind} visual should remain circular`)
      .toBeCloseTo(metric.visualWidth, 1);
    expect(metric.iconWidth, `${metric.kind} icon should remain compact`)
      .toBeGreaterThanOrEqual(10);
    expect(metric.iconWidth, `${metric.kind} icon should remain compact`)
      .toBeLessThanOrEqual(14);
    expect(metric.iconHeight, `${metric.kind} icon should remain square`)
      .toBeCloseTo(metric.iconWidth, 1);
    expect(metric.visualCenterDelta, `${metric.kind} disc should be centered`)
      .toBeLessThanOrEqual(0.75);
    expect(metric.iconCenterDelta, `${metric.kind} icon should be centered`)
      .toBeLessThanOrEqual(0.75);
    expect(metric.visualRadius, `${metric.kind} visual should remain circular`)
      .toBeGreaterThanOrEqual(metric.visualWidth * 0.45);

    const hitColor = parseCssColor(metric.hitBackground);
    expect(hitColor.alpha, `${metric.kind} outer target should be transparent`)
      .toBe(0);
    const discColor = parseCssColor(metric.visualBackground);
    expect(discColor.red).toBeLessThanOrEqual(30);
    expect(discColor.green).toBeLessThanOrEqual(40);
    expect(discColor.blue).toBeLessThanOrEqual(55);
    expect(discColor.alpha, `${metric.kind} disc should be translucent`)
      .toBeGreaterThanOrEqual(0.6);
    expect(discColor.alpha, `${metric.kind} disc should be translucent`)
      .toBeLessThanOrEqual(0.75);
    const iconColor = parseCssColor(metric.iconColor);
    expect(iconColor.red, `${metric.kind} icon should remain light`)
      .toBeGreaterThanOrEqual(235);
    expect(iconColor.green, `${metric.kind} icon should remain light`)
      .toBeGreaterThanOrEqual(235);
    expect(iconColor.blue, `${metric.kind} icon should remain light`)
      .toBeGreaterThanOrEqual(235);
    expect(iconColor.alpha, `${metric.kind} icon should retain contrast`)
      .toBeGreaterThanOrEqual(0.9);

    expect(metric.hitWidth).toBeCloseTo(reference.hitWidth, 1);
    expect(metric.hitHeight).toBeCloseTo(reference.hitHeight, 1);
    expect(metric.visualWidth).toBeCloseTo(reference.visualWidth, 1);
    expect(metric.visualHeight).toBeCloseTo(reference.visualHeight, 1);
    expect(metric.iconWidth).toBeCloseTo(reference.iconWidth, 1);
    expect(metric.iconHeight).toBeCloseTo(reference.iconHeight, 1);
  }
}

function expectGalleryControlParity(
  publicMetrics: ControlMetric[],
  adminMetrics: ControlMetric[],
) {
  for (const kind of controlKinds) {
    const publicMetric = publicMetrics.find((metric) => metric.kind === kind)!;
    const adminMetric = adminMetrics.find((metric) => metric.kind === kind)!;
    for (const key of [
      'hitWidth',
      'hitHeight',
      'visualWidth',
      'visualHeight',
      'iconWidth',
      'iconHeight',
      'visualCenterDelta',
      'iconCenterDelta',
    ] as const) {
      expect(
        Math.abs(publicMetric[key] - adminMetric[key]),
        `${kind} ${key} should match in public and admin previews`,
      ).toBeLessThanOrEqual(1);
    }
    expect(adminMetric.hitBackground).toBe(publicMetric.hitBackground);
    expect(adminMetric.visualBackground).toBe(publicMetric.visualBackground);
    expect(adminMetric.iconColor).toBe(publicMetric.iconColor);
  }
}

async function exerciseGalleryControls(
  page: Page,
  gallery: Locator,
) {
  const previous = gallery.getByRole('button', {
    name: 'Prejšnja slika',
    exact: true,
  });
  const next = gallery.getByRole('button', {
    name: 'Naslednja slika',
    exact: true,
  });
  const zoom = gallery.getByRole('button', {
    name: 'Povečaj sliko',
    exact: true,
  });
  const zoomIndicator = gallery.locator(
    '[data-gallery-control="zoom-indicator"]',
  );
  await expect(previous).toBeVisible();
  await expect(next).toBeVisible();
  await expect(zoom).toBeVisible();
  await expect(zoomIndicator).toHaveAttribute('aria-hidden', 'true');

  const zoomBox = await zoom.boundingBox();
  expect(zoomBox, 'zoom trigger should have rendered geometry').not.toBeNull();
  expect(zoomBox!.width, 'full-image zoom trigger should exceed 44px')
    .toBeGreaterThanOrEqual(44);
  expect(zoomBox!.height, 'full-image zoom trigger should exceed 44px')
    .toBeGreaterThanOrEqual(44);

  const selectedThumbnail = gallery.locator(
    '.storefront-gallery-thumbnail[aria-pressed="true"]',
  ).first();
  await expect(selectedThumbnail).toBeVisible();
  const initialSelection = await selectedThumbnail.getAttribute('aria-label');
  expect(initialSelection).toBeTruthy();

  await next.click();
  await expect.poll(async () => (
    gallery.locator(
      '.storefront-gallery-thumbnail[aria-pressed="true"]',
    ).first().getAttribute('aria-label')
  )).not.toBe(initialSelection);

  await previous.focus();
  await expect(previous).toBeFocused();
  await previous.press('Enter');
  await expect.poll(async () => (
    gallery.locator(
      '.storefront-gallery-thumbnail[aria-pressed="true"]',
    ).first().getAttribute('aria-label')
  )).toBe(initialSelection);

  await zoom.click();
  const dialog = page.getByRole('dialog', { name: /^Povečana slika:/ });
  await expect(dialog).toBeVisible();
  const close = dialog.getByRole('button', {
    name: 'Zapri povečano sliko',
    exact: true,
  });
  await expect(close).toBeFocused();
  const [closeBox, closeBackground] = await Promise.all([
    close.boundingBox(),
    close.evaluate((element) => getComputedStyle(element).backgroundColor),
  ]);
  expect(closeBox, 'lightbox close control should remain visible').not.toBeNull();
  expect(closeBox!.width, 'lightbox close control should keep its hit width')
    .toBeGreaterThanOrEqual(43);
  expect(closeBox!.width, 'lightbox close control should keep its hit width')
    .toBeLessThanOrEqual(45);
  expect(closeBox!.height, 'lightbox close control should keep its hit height')
    .toBeGreaterThanOrEqual(43);
  expect(closeBox!.height, 'lightbox close control should keep its hit height')
    .toBeLessThanOrEqual(45);
  expect(
    parseCssColor(closeBackground).alpha,
    'lightbox close control should retain a visible surface',
  ).toBeGreaterThanOrEqual(0.9);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden({ timeout: 2_000 });
  await expect(zoom).toBeFocused();
}

test('gallery controls stay visually compact and functionally accessible in public and admin previews', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await assertAuthenticatedAdmin(request);
  const fixture = await findGalleryFixture(request);
  expect(
    fixture,
    'The catalog needs an active product with at least two public gallery images.',
  ).toBeDefined();
  if (!fixture) return;

  const blockedWrites: string[] = [];
  await page.route('**/api/**', async (route) => {
    const outgoing = route.request();
    if (writeMethods.has(outgoing.method())) {
      const pathname = new URL(outgoing.url()).pathname;
      if (!pathname.startsWith('/api/analytics/')) {
        blockedWrites.push(`${outgoing.method()} ${pathname}`);
      }
      await route.abort('blockedbyclient');
      return;
    }
    await route.continue();
  });

  await page.goto(fixture.href);
  await expect(page.getByRole('heading', {
    level: 1,
    name: fixture.product.itemName,
    exact: true,
  })).toBeVisible({ timeout: 15_000 });
  const publicGallery = page.getByRole('region', {
    name: `Galerija: ${fixture.product.itemName}`,
    exact: true,
  });
  await expect(publicGallery).toBeVisible();
  const publicMetrics = await readGalleryControlMetrics(publicGallery);
  expectCompactGalleryControls(publicMetrics);
  await exerciseGalleryControls(page, publicGallery);

  await page.goto('/admin/podoba/artikli');
  await expect(page.getByRole('heading', {
    level: 1,
    name: 'Artikli',
    exact: true,
  })).toBeVisible({ timeout: 15_000 });
  const productSelect = getAppearanceEditorCompactSelect(
    page,
    'Artikel v predogledu',
  );
  await chooseAppearanceEditorCompactSelectOption(
    page,
    productSelect,
    fixture.product.slug,
  );
  expect(await readAppearanceEditorCompactSelectValue(productSelect))
    .toBe(fixture.product.slug);
  const productPageButton = page.getByRole('group', {
    name: 'Stran predogleda',
  }).getByRole('button', {
    name: 'Artikel',
    exact: true,
  });
  if (await productPageButton.getAttribute('aria-pressed') !== 'true') {
    await productPageButton.click();
  }
  await expect(productPageButton).toHaveAttribute('aria-pressed', 'true');

  const preview = page.locator(
    '[data-product-preview-frame] [data-admin-product-live-preview="true"]:visible',
  ).first();
  await expect(preview).toBeVisible({ timeout: 15_000 });
  const adminGallery = preview.getByRole('region', {
    name: `Galerija: ${fixture.product.itemName}`,
    exact: true,
  });
  await expect(adminGallery).toBeVisible();
  const adminMetrics = await readGalleryControlMetrics(adminGallery);
  expectCompactGalleryControls(adminMetrics);
  expectGalleryControlParity(publicMetrics, adminMetrics);
  await exerciseGalleryControls(page, adminGallery);

  expect(
    blockedWrites,
    'gallery inspection and interaction should remain read-only',
  ).toEqual([]);
});
