import {
  expect,
  test,
  type APIRequestContext,
  type Locator,
  type Page
} from '@playwright/test';
import { catalogCategoryItemHref } from '../../src/commercial/catalog/catalogRoutes';
import type { CatalogItemEditorHydration } from '../../src/shared/domain/catalog/catalogAdminTypes';
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

type DimensionalProductFixture = {
  href: string;
  product: CatalogItemEditorHydration;
};

type VariantSpacingMetrics = {
  cssGap: number;
  thicknessGap: number;
  dimensionsGap: number;
  dimensionsBorderTopWidth: number;
  dimensionsPaddingTop: number;
};

const writeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const isActive = (
  statuses: CatalogPayload['statuses'],
  key: string
) => statuses[key] !== 'inactive';

async function findDimensionalProduct(
  request: APIRequestContext
): Promise<DimensionalProductFixture | undefined> {
  const response = await request.get('/api/admin/categories');
  expect(response.ok()).toBeTruthy();
  const catalog = await response.json() as CatalogPayload;

  for (const category of catalog.categories) {
    if (!isActive(catalog.statuses, `cat:${category.slug}`)) continue;
    const products = [
      ...category.items,
      ...category.subcategories.flatMap((subcategory) => (
        isActive(catalog.statuses, `sub:${category.slug}:${subcategory.slug}`)
          ? subcategory.items
          : []
      ))
    ];

    for (const summary of products) {
      if (summary.status === 'inactive') continue;
      const productResponse = await request.get(
        `/api/admin/artikli/${encodeURIComponent(summary.slug)}`
      );
      if (!productResponse.ok()) continue;
      const product = await productResponse.json() as CatalogItemEditorHydration;
      const hasDimensionalVariant = product.variants.some((variant) => (
        variant.status === 'active'
        && typeof variant.thickness === 'number'
        && typeof variant.length === 'number'
        && typeof variant.width === 'number'
      ));
      if (
        product.status === 'active'
        && product.productType === 'dimensions'
        && hasDimensionalVariant
      ) {
        return {
          href: catalogCategoryItemHref(category.slug, product.slug),
          product
        };
      }
    }
  }

  return undefined;
}

async function readVariantSpacing(
  selector: Locator
): Promise<VariantSpacingMetrics> {
  await expect(selector).toBeVisible();
  return selector.evaluate((root) => {
    const fieldsets = Array.from(root.querySelectorAll('fieldset'));
    const findFieldset = (label: string) => fieldsets.find((fieldset) => (
      fieldset.querySelector('legend')?.textContent?.trim().startsWith(label)
    ));
    const thickness = findFieldset('Debelina');
    const dimensions = findFieldset('Dimenzije');
    const thicknessLabel = thickness?.querySelector('legend');
    const dimensionsLabel = dimensions?.querySelector('legend');
    const thicknessControl = thickness?.querySelector<HTMLElement>(
      '.storefront-variant-chip'
    );
    const dimensionsControl = dimensions?.querySelector<HTMLElement>(
      '.storefront-variant-select'
    );
    if (
      !thickness
      || !dimensions
      || !thicknessLabel
      || !dimensionsLabel
      || !thicknessControl
      || !dimensionsControl
    ) {
      throw new Error('Dimensional selector is missing a label or control.');
    }

    const scale = Number.parseFloat(
      getComputedStyle(root).getPropertyValue('--commercial-storefront-scale')
    ) || 1;
    const dimensionsStyle = getComputedStyle(dimensions);
    const rootStyle = getComputedStyle(root);
    const thicknessLabelStyle = getComputedStyle(thicknessLabel);
    const dimensionsLabelStyle = getComputedStyle(dimensionsLabel);

    return {
      cssGap: (
        Number.parseFloat(
          rootStyle.getPropertyValue('--product-variant-label-control-gap')
        ) || 0
      ) * scale,
      thicknessGap:
        Number.parseFloat(thicknessLabelStyle.marginBottom) * scale,
      dimensionsGap:
        Number.parseFloat(dimensionsLabelStyle.marginBottom) * scale,
      dimensionsBorderTopWidth:
        Number.parseFloat(dimensionsStyle.borderTopWidth) * scale,
      dimensionsPaddingTop:
        Number.parseFloat(dimensionsStyle.paddingTop) * scale
    };
  });
}

function expectSharedVariantGap(
  metrics: VariantSpacingMetrics,
  expectedGap: number
) {
  expect(metrics.cssGap, 'the rendered shared gap token').toBeCloseTo(
    expectedGap,
    1
  );
  expect(metrics.thicknessGap, 'Debelina label-to-control spacing').toBeCloseTo(
    expectedGap,
    0
  );
  expect(metrics.dimensionsGap, 'Dimenzije label-to-control spacing').toBeCloseTo(
    expectedGap,
    0
  );
  expect(
    Math.abs(metrics.thicknessGap - metrics.dimensionsGap),
    'Debelina and Dimenzije should use the same spacing contract'
  ).toBeLessThanOrEqual(1);
  expect(
    metrics.dimensionsBorderTopWidth,
    'Dimenzije should not render a horizontal divider'
  ).toBe(0);
  expect(
    metrics.dimensionsPaddingTop,
    'removing the divider should also remove its compensating top padding'
  ).toBe(0);
}

async function openVariantContentPanel(
  page: Page,
  preview: Locator,
  elementId: string
) {
  const element = preview.locator(
    `[data-product-canvas-element="${elementId}"]`
  );
  await expect(element).toBeVisible();
  await element.evaluate((node) => (node as HTMLElement).click());
  await expect(element).toHaveAttribute('data-product-canvas-selected', 'true');

  const toolbar = page.locator(
    '[role="toolbar"][data-toolbar-mode="floating"]'
  );
  await expect(toolbar).toHaveAttribute(
    'data-product-toolbar-anchor-id',
    elementId
  );
  await toolbar.getByRole('button', { name: 'Vsebina', exact: true }).click();
  const panel = page.getByRole('dialog', { name: 'Vsebina artikla' });
  await expect(panel).toBeVisible();
  return panel;
}

test.describe('product variant label-to-control spacing', () => {
  test('keeps the divider removed and the shared gap in public and responsive admin previews', async ({
    page,
    request
  }) => {
    await assertAuthenticatedAdmin(request);
    const fixture = await findDimensionalProduct(request);
    expect(
      fixture,
      'The catalogue needs an active dimensional product for variant-spacing coverage.'
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

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(fixture.href);
    await expect(page.getByRole('heading', {
      level: 1,
      name: fixture.product.itemName,
      exact: true
    })).toBeVisible({ timeout: 15_000 });
    const publicSelector = page.locator(
      '.storefront-dimensional-variant-selector'
    );
    const publicMetrics = await readVariantSpacing(publicSelector);
    expectSharedVariantGap(publicMetrics, 6);

    await page.goto('/admin/podoba/artikli');
    await expect(page.getByRole('heading', {
      level: 1,
      name: 'Artikli',
      exact: true
    })).toBeVisible({ timeout: 15_000 });
    const productSelect = page.getByLabel('Artikel v predogledu');
    await productSelect.selectOption(fixture.product.slug);
    await expect(productSelect).toHaveValue(fixture.product.slug);
    const pageControls = page.getByRole('group', { name: 'Stran predogleda' });
    const productPageButton = pageControls.getByRole('button', {
      name: 'Artikel',
      exact: true
    });
    if (await productPageButton.getAttribute('aria-pressed') !== 'true') {
      await productPageButton.click();
    }
    await expect(productPageButton).toHaveAttribute('aria-pressed', 'true');

    const preview = page.locator(
      '[data-product-preview-frame] [data-admin-product-live-preview="true"]:visible'
    ).first();
    await expect(preview).toBeVisible({ timeout: 15_000 });
    await expect(preview.locator('.storefront-product-title')).toContainText(
      fixture.product.itemName
    );
    const adminSelector = preview.locator(
      '.storefront-dimensional-variant-selector'
    );
    const adminMetrics = await readVariantSpacing(adminSelector);
    expectSharedVariantGap(adminMetrics, 6);
    expect(adminMetrics.thicknessGap).toBeCloseTo(
      publicMetrics.thicknessGap,
      0
    );
    expect(adminMetrics.dimensionsGap).toBeCloseTo(
      publicMetrics.dimensionsGap,
      0
    );

    const panel = await openVariantContentPanel(
      page,
      preview,
      'product-variants'
    );
    const gapInput = panel.getByTestId('product-variant-label-control-gap');
    await expect(gapInput).toHaveValue('6');
    await gapInput.fill('17');
    await gapInput.press('Enter');
    await expect(gapInput).toHaveValue('17');
    await panel.getByRole('button', { name: 'Zapri', exact: true }).click();
    await expect.poll(async () => readVariantSpacing(adminSelector)).toMatchObject({
      cssGap: expect.closeTo(17, 1),
      thicknessGap: expect.closeTo(17, 0),
      dimensionsGap: expect.closeTo(17, 0),
      dimensionsBorderTopWidth: 0,
      dimensionsPaddingTop: 0
    });

    const responsiveControls = page.getByRole('group', {
      name: 'Odzivni predogled'
    });
    for (const device of ['Tablica', 'Mobilno', 'Desktop']) {
      const button = responsiveControls.getByRole('button', {
        name: device,
        exact: true
      });
      await button.click();
      await expect(button).toHaveAttribute('aria-pressed', 'true');
      expectSharedVariantGap(await readVariantSpacing(adminSelector), 17);
    }

    const childPanel = await openVariantContentPanel(
      page,
      preview,
      'product-variant-dimensions-control'
    );
    await expect(
      childPanel.getByTestId('product-variant-label-control-gap')
    ).toHaveValue('17');
    await childPanel.getByRole('button', { name: 'Zapri', exact: true }).click();

    expect(
      blockedWrites,
      'variant-spacing inspection and unsaved responsive preview edits should remain read-only'
    ).toEqual([]);
  });
});
