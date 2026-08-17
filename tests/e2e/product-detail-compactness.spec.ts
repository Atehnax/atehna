import {
  expect,
  test,
  type APIRequestContext,
  type Locator,
  type Page
} from '@playwright/test';
import type {
  CatalogItemEditorHydration
} from '@/shared/domain/catalog/catalogAdminTypes';
import { assertAuthenticatedAdmin } from './support/auth';

type RectSize = {
  width: number;
  height: number;
};

const writeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

async function requireSize(locator: Locator, label: string): Promise<RectSize> {
  const box = await locator.boundingBox();
  expect(box, `${label} should have rendered geometry`).not.toBeNull();
  return { width: box!.width, height: box!.height };
}

async function selectDimensionalPreviewProduct(
  page: Page,
  request: APIRequestContext
) {
  const productSelect = page.getByLabel('Artikel v predogledu');
  const slugs = await productSelect.locator('option').evaluateAll((options) =>
    options
      .map((option) => (option as HTMLOptionElement).value)
      .filter(Boolean)
  );
  let candidate: CatalogItemEditorHydration | null = null;
  for (const slug of slugs) {
    const response = await request.get(
      `/api/admin/artikli/${encodeURIComponent(slug)}`
    );
    if (!response.ok()) continue;
    const product = await response.json() as CatalogItemEditorHydration;
    if (
      product.status === 'active'
      && product.productType === 'dimensions'
      && product.variants.some((variant) => (
        variant.status === 'active'
        && typeof variant.thickness === 'number'
        && typeof variant.length === 'number'
        && typeof variant.width === 'number'
      ))
    ) {
      candidate = product;
      break;
    }
  }
  expect(
    candidate,
    'catalogue should provide an active dimensional product for compact-control coverage'
  ).toBeDefined();
  if (!candidate) return;
  if (await productSelect.inputValue() !== candidate.slug) {
    await productSelect.selectOption(candidate.slug);
    await expect(productSelect).toHaveValue(candidate.slug);
  }
  await expect(
    page
      .locator('[data-admin-product-live-preview="true"]')
      .locator('.storefront-product-title')
  ).toContainText(candidate.itemName);
}

function expectSameSize(actual: RectSize, expected: RectSize, label: string) {
  expect(actual.width, `${label} width should not change`).toBeCloseTo(expected.width, 0);
  expect(actual.height, `${label} height should not change`).toBeCloseTo(expected.height, 0);
}

async function openProductStylePanel(page: Page, canvasElement: Locator) {
  await canvasElement.click({ position: { x: 3, y: 3 } });
  await expect(canvasElement).toHaveAttribute('data-product-canvas-selected', 'true');

  const toolbar = page.locator(
    '[role="toolbar"][data-toolbar-mode="floating"]'
  );
  await expect(toolbar).toBeVisible();
  await expect(toolbar).toHaveAttribute(
    'data-product-toolbar-anchor-id',
    'product-primary-action'
  );

  const unlock = toolbar.getByRole('button', {
    name: 'Odkleni element',
    exact: true
  });
  if (await unlock.count()) await unlock.click();

  const unlockRatio = toolbar.getByRole('button', {
    name: 'Odkleni razmerje stranic',
    exact: true
  });
  if (await unlockRatio.count()) await unlockRatio.click();

  await toolbar.getByRole('button', {
    name: 'Slog · vsi artikli',
    exact: true
  }).click();
  const panel = page.getByRole('dialog', { name: 'Slog elementa' });
  await expect(panel).toBeVisible();
  return panel;
}

async function applyCompactVariantSettings(page: Page, preview: Locator) {
  const variants = preview.locator(
    '[data-product-canvas-element="product-variants"]'
  );
  await variants.evaluate((element) => (element as HTMLElement).click());

  const toolbar = page.locator(
    '[role="toolbar"][data-toolbar-mode="floating"]'
  );
  await expect(toolbar).toHaveAttribute(
    'data-product-toolbar-anchor-id',
    'product-variants'
  );
  await toolbar.getByRole('button', { name: 'Vsebina', exact: true }).click();
  const panel = page.getByRole('dialog', { name: 'Vsebina artikla' });
  await expect(panel).toBeVisible();

  const settings = [
    ['product-variant-select-selectHeightPx', '44'],
    ['product-variant-chip-chipHeightPx', '40'],
    ['product-variant-chip-chipFontSizePx', '14'],
    ['product-variant-chip-labelFontSizePx', '14']
  ] as const;
  for (const [testId, value] of settings) {
    const input = panel.getByTestId(testId);
    await input.fill(value);
    await expect(input).toHaveValue(value);
  }
  await panel.getByTestId(settings.at(-1)![0]).press('Enter');
  await panel.getByRole('button', { name: 'Zapri', exact: true }).click();
}

test.describe('compact product-detail appearance', () => {
  test('renders compact controls and lets a fixed CTA fill its canvas size without collateral resizing', async ({
    page,
    request
  }) => {
    await assertAuthenticatedAdmin(request);
    const blockedWrites: string[] = [];
    await page.route('**/api/admin/**', async (route) => {
      if (writeMethods.has(route.request().method())) {
        blockedWrites.push(
          `${route.request().method()} ${route.request().url()}`
        );
        await route.abort('blockedbyclient');
        return;
      }
      await route.continue();
    });

    await page.setViewportSize({ width: 1329, height: 920 });
    await page.goto('/admin/podoba/artikli');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Artikli', exact: true })
    ).toBeVisible({ timeout: 15_000 });
    await selectDimensionalPreviewProduct(page, request);

    const preview = page.locator('[data-admin-product-live-preview="true"]');
    await expect(preview).toBeVisible();
    await expect(preview.locator('.storefront-product-title')).toBeVisible();
    await expect(preview.locator('#related-products-title')).toBeVisible();
    await applyCompactVariantSettings(page, preview);

    const metrics = await preview.evaluate((root) => {
      const rootStyle = getComputedStyle(root);
      const scale = Number.parseFloat(
        rootStyle.getPropertyValue('--commercial-storefront-scale')
      ) || 1;
      const px = (value: string) => Number.parseFloat(value) || 0;
      const token = (name: string) => px(rootStyle.getPropertyValue(name));
      const physicalMetrics = (selector: string) =>
        Array.from(root.querySelectorAll<HTMLElement>(selector)).map((element) => {
          const style = getComputedStyle(element);
          return {
            height: px(style.height) * scale,
            fontSize: px(style.fontSize) * scale
          };
        });
      const productTitle = root.querySelector<HTMLElement>(
        '.storefront-product-title'
      );
      const relatedTitle = root.querySelector<HTMLElement>(
        '#related-products-title'
      );

      return {
        targets: {
          selectHeight: token('--product-variant-select-height') * scale,
          chipHeight: token('--product-variant-chip-height') * scale,
          chipFontSize: token('--product-variant-chip-font-size') * scale,
          labelFontSize: token('--product-variant-label-font-size') * scale
        },
        heading: {
          product: px(getComputedStyle(productTitle!).fontSize),
          related: px(getComputedStyle(relatedTitle!).fontSize),
          h1: token('--site-font-size-h1'),
          h2: token('--site-font-size-h2'),
          h3: token('--site-font-size-h3')
        },
        selects: physicalMetrics('.storefront-variant-select'),
        chips: physicalMetrics('.storefront-variant-chip'),
        labels: physicalMetrics(
          '.storefront-dimensional-variant-selector legend, .storefront-product-variant-selector legend'
        ),
        quantityButtons: physicalMetrics(
          '.storefront-product-quantity-button'
        ),
        quantityInputs: physicalMetrics('.storefront-product-quantity-input'),
        primaryActions: physicalMetrics('.storefront-product-primary-action')
      };
    });

    expect(metrics.heading.product).toBeCloseTo(metrics.heading.h2, 1);
    expect(metrics.heading.product).toBeLessThan(metrics.heading.h1);
    expect(metrics.heading.related).toBeCloseTo(metrics.heading.h3, 1);
    expect(metrics.heading.related).toBeLessThan(metrics.heading.h2);

    expect(metrics.selects.length, 'preview should exercise a variant select')
      .toBeGreaterThan(0);
    expect(metrics.chips.length, 'preview should exercise variant chips')
      .toBeGreaterThan(0);
    expect(metrics.labels.length, 'preview should exercise variant labels')
      .toBeGreaterThan(0);
    expect(metrics.quantityButtons.length, 'preview should exercise quantity buttons')
      .toBeGreaterThan(0);
    expect(metrics.quantityInputs.length, 'preview should exercise a quantity input')
      .toBeGreaterThan(0);
    expect(metrics.primaryActions.length, 'preview should exercise the primary CTA')
      .toBeGreaterThan(0);

    for (const metric of metrics.selects) {
      expect(metric.height, 'variant select should honor its configured height')
        .toBeCloseTo(metrics.targets.selectHeight, 0);
    }
    for (const metric of metrics.chips) {
      expect(metric.height, 'variant chip should honor its configured height')
        .toBeCloseTo(metrics.targets.chipHeight, 0);
      expect(metric.fontSize, 'variant chip should honor its configured font size')
        .toBeCloseTo(metrics.targets.chipFontSize, 0);
    }
    for (const metric of metrics.labels) {
      expect(metric.fontSize, 'variant label should honor its configured font size')
        .toBeCloseTo(metrics.targets.labelFontSize, 0);
    }
    expect(metrics.targets.selectHeight, 'variant select compact threshold')
      .toBeCloseTo(44, 1);
    expect(metrics.targets.chipHeight, 'variant chip compact threshold')
      .toBeCloseTo(40, 1);
    expect(metrics.targets.chipFontSize, 'variant chip text compact threshold')
      .toBeCloseTo(14, 1);
    expect(metrics.targets.labelFontSize, 'variant label compact threshold')
      .toBeCloseTo(14, 1);
    for (const metric of [
      ...metrics.quantityButtons,
      ...metrics.quantityInputs
    ]) {
      expect(metric.height, 'quantity control height').toBeCloseTo(40, 0);
    }
    for (const metric of metrics.primaryActions) {
      expect(metric.height, 'primary CTA height').toBeCloseTo(44, 0);
    }

    const gallery = preview.locator(
      '[data-product-canvas-element="product-gallery"]'
    ).first();
    const descriptionPanel = preview.locator(
      '#product-detail-desktop-description-panel'
    );
    const relatedCard = preview.locator(
      '.storefront-related-product-card'
    ).first();
    await expect(gallery).toBeVisible();
    const hasDescriptionPanel = await descriptionPanel.count() > 0
      && await descriptionPanel.isVisible();
    const hasRelatedCard = await relatedCard.count() > 0
      && await relatedCard.isVisible();

    const referenceGeometry = {
      gallery: await requireSize(gallery, 'Product gallery'),
      description: hasDescriptionPanel
        ? await requireSize(descriptionPanel, 'Description panel')
        : null,
      relatedCard: hasRelatedCard
        ? await requireSize(relatedCard, 'Related-product card')
        : null
    };

    const primaryActionCanvas = preview.locator(
      '[data-product-canvas-element="product-primary-action"]'
    );
    const stylePanel = await openProductStylePanel(page, primaryActionCanvas);
    const widthInput = stylePanel.getByTestId('product-canvas-width');
    const heightInput = stylePanel.getByTestId('product-canvas-height');
    await expect(widthInput).toHaveAttribute('min', '160');
    await expect(heightInput).toHaveAttribute('min', '40');
    await widthInput.fill('320');
    await heightInput.fill('72');
    await heightInput.press('Enter');
    await expect(widthInput).toHaveValue('320');
    await expect(heightInput).toHaveValue('72');
    await expect(primaryActionCanvas).toHaveAttribute(
      'data-product-canvas-fixed-width',
      'true'
    );
    await expect(primaryActionCanvas).toHaveAttribute(
      'data-product-canvas-fixed-height',
      'true'
    );

    const fillGeometry = await primaryActionCanvas.evaluate((wrapper) => {
      const button = wrapper.querySelector<HTMLElement>(
        '.storefront-product-primary-action'
      );
      const content = wrapper.querySelector<HTMLElement>(
        ':scope > .product-canvas-element-content'
      );
      const wrapperRect = wrapper.getBoundingClientRect();
      const buttonRect = button!.getBoundingClientRect();
      return {
        edgeDelta: {
          left: Math.abs(buttonRect.left - wrapperRect.left),
          top: Math.abs(buttonRect.top - wrapperRect.top),
          right: Math.abs(buttonRect.right - wrapperRect.right),
          bottom: Math.abs(buttonRect.bottom - wrapperRect.bottom)
        },
        overflow: {
          horizontal: (content?.scrollWidth ?? wrapper.scrollWidth) -
            (content?.clientWidth ?? wrapper.clientWidth),
          vertical: (content?.scrollHeight ?? wrapper.scrollHeight) -
            (content?.clientHeight ?? wrapper.clientHeight)
        }
      };
    });

    for (const [edge, delta] of Object.entries(fillGeometry.edgeDelta)) {
      expect(delta, `CTA ${edge} edge should fill its canvas wrapper`)
        .toBeLessThanOrEqual(1);
    }
    expect(fillGeometry.overflow.horizontal, 'CTA should not overflow horizontally')
      .toBeLessThanOrEqual(1);
    expect(fillGeometry.overflow.vertical, 'CTA should not overflow vertically')
      .toBeLessThanOrEqual(1);

    expectSameSize(
      await requireSize(gallery, 'Product gallery after CTA resize'),
      referenceGeometry.gallery,
      'Product gallery'
    );
    if (referenceGeometry.description) {
      expectSameSize(
        await requireSize(descriptionPanel, 'Description panel after CTA resize'),
        referenceGeometry.description,
        'Description panel'
      );
    }
    if (referenceGeometry.relatedCard) {
      expectSameSize(
        await requireSize(relatedCard, 'Related-product card after CTA resize'),
        referenceGeometry.relatedCard,
        'Related-product card'
      );
    }
    expect(blockedWrites, 'appearance edits should remain an unsaved preview')
      .toEqual([]);
  });
});

test.describe('storefront product-detail panel alignment', () => {
  for (const viewportWidth of [1440, 1600]) {
    test(`right-aligns the purchase card with the description panel at ${viewportWidth}px`, async ({
      page
    }) => {
      await page.route('**/api/**', async (route) => {
        if (writeMethods.has(route.request().method())) {
          await route.abort('blockedbyclient');
          return;
        }
        await route.continue();
      });

      await page.setViewportSize({ width: viewportWidth, height: 920 });
      await page.goto('/products/materiali/items/aluminijasta-plosca');

      const purchasePanel = page.getByRole('complementary', {
        name: 'Nakup izdelka',
        exact: true
      });
      const descriptionPanel = page.locator(
        '#product-detail-desktop-description-panel'
      );
      await expect(purchasePanel).toBeVisible();
      await expect(descriptionPanel).toBeVisible();

      const purchaseRect = await purchasePanel.boundingBox();
      const descriptionRect = await descriptionPanel.boundingBox();
      expect(
        purchaseRect,
        'purchase panel should have rendered geometry'
      ).not.toBeNull();
      expect(
        descriptionRect,
        'description panel should have rendered geometry'
      ).not.toBeNull();

      const purchaseRight = purchaseRect!.x + purchaseRect!.width;
      const descriptionRight = descriptionRect!.x + descriptionRect!.width;
      expect(
        Math.abs(purchaseRight - descriptionRight),
        'purchase and description panels should share their right edge'
      ).toBeLessThanOrEqual(1.5);
    });
  }
});
