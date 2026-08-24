import { expect, test, type Locator, type Page } from '@playwright/test';

type Box = NonNullable<Awaited<ReturnType<Locator['boundingBox']>>>;

async function requireBox(locator: Locator, label: string): Promise<Box> {
  const box = await locator.boundingBox();
  expect(box, `${label} should have rendered geometry`).not.toBeNull();
  return box!;
}

async function waitForPreviewIdle(page: Page, device: 'desktop' | 'tablet' | 'mobile') {
  const stage = page.getByTestId('homepage-preview-stage');
  await expect(stage).toHaveAttribute('data-preview-target-device', device);
  await expect(stage).toHaveAttribute('data-preview-render-device', device, { timeout: 15_000 });
  await expect(stage).toHaveAttribute('data-preview-transitioning', 'false', { timeout: 15_000 });
}

async function expectTransformBoxAligned(transformBox: Locator, imageFrame: Locator) {
  const [transformBounds, imageBounds] = await Promise.all([
    requireBox(transformBox, 'Category image transform perimeter'),
    requireBox(imageFrame, 'Category image frame')
  ]);
  const tolerance = 2;

  expect(Math.abs(transformBounds.x - imageBounds.x)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(transformBounds.y - imageBounds.y)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(transformBounds.width - imageBounds.width)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(transformBounds.height - imageBounds.height)).toBeLessThanOrEqual(tolerance);

  return transformBounds;
}

async function expectEightPerimeterHandles(transformBox: Locator, transformBounds: Box) {
  const handles = transformBox.locator('[data-category-image-transform-handle]');
  await expect(handles).toHaveCount(8);

  const normalizedCenters = await handles.evaluateAll((elements, bounds) => elements.map((element) => {
    const rect = element.getBoundingClientRect();
    return {
      x: (rect.left + rect.width / 2 - bounds.x) / bounds.width,
      y: (rect.top + rect.height / 2 - bounds.y) / bounds.height
    };
  }), transformBounds);

  const expectedPositions = [
    { x: 0, y: 0 },
    { x: 0.5, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 0.5 },
    { x: 1, y: 1 },
    { x: 0.5, y: 1 },
    { x: 0, y: 1 },
    { x: 0, y: 0.5 }
  ];
  const normalizedTolerance = 0.09;

  for (const expectedPosition of expectedPositions) {
    expect(
      normalizedCenters.some((center) => (
        Math.abs(center.x - expectedPosition.x) <= normalizedTolerance
        && Math.abs(center.y - expectedPosition.y) <= normalizedTolerance
      )),
      `missing transform handle near ${JSON.stringify(expectedPosition)}; received ${JSON.stringify(normalizedCenters)}`
    ).toBe(true);
  }
}

async function expectPerimeterFullyPaintable({
  transformBox,
  tile,
  previewFrame
}: {
  transformBox: Locator;
  tile: Locator;
  previewFrame: Locator;
}) {
  await expect(transformBox).toBeVisible();
  const handles = transformBox.locator('[data-category-image-transform-handle]');
  await expect(handles).toHaveCount(8);

  const [transformBounds, tileBounds, previewBounds] = await Promise.all([
    requireBox(transformBox, 'Category image transform perimeter'),
    requireBox(tile, 'Selected category tile'),
    requireBox(previewFrame, 'Homepage preview frame')
  ]);
  const containmentTolerance = 3;
  const expectContainedBy = (
    inner: Box,
    outer: Box,
    label: string,
    tolerance = containmentTolerance
  ) => {
    expect(inner.x, `${label} should not be clipped on the left`).toBeGreaterThanOrEqual(
      outer.x - tolerance
    );
    expect(inner.y, `${label} should not be clipped at the top`).toBeGreaterThanOrEqual(
      outer.y - tolerance
    );
    expect(inner.x + inner.width, `${label} should not be clipped on the right`).toBeLessThanOrEqual(
      outer.x + outer.width + tolerance
    );
    expect(inner.y + inner.height, `${label} should not be clipped at the bottom`).toBeLessThanOrEqual(
      outer.y + outer.height + tolerance
    );
  };

  expectContainedBy(transformBounds, tileBounds, 'Transform perimeter');
  expectContainedBy(transformBounds, previewBounds, 'Transform perimeter');

  const perimeterPaint = await transformBox.evaluate((element) => {
    const style = getComputedStyle(element);
    const clippingAncestors: string[] = [];
    let ancestor = element.parentElement;

    while (ancestor && ancestor !== document.body) {
      const ancestorStyle = getComputedStyle(ancestor);
      const clips = [ancestorStyle.overflow, ancestorStyle.overflowX, ancestorStyle.overflowY]
        .some((value) => ['hidden', 'clip', 'auto', 'scroll'].includes(value));
      if (clips) {
        clippingAncestors.push(
          ancestor.getAttribute('data-testid')
          ?? ancestor.getAttribute('data-category-showcase-presentation')
          ?? ancestor.tagName.toLowerCase()
        );
      }
      ancestor = ancestor.parentElement;
    }

    return {
      clippingAncestors,
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth),
      outlineColor: style.outlineColor
    };
  });

  expect(
    perimeterPaint.clippingAncestors,
    'the transform perimeter must not be nested under an overflow clip'
  ).toEqual([]);
  expect(perimeterPaint.outlineStyle).not.toBe('none');
  expect(perimeterPaint.outlineWidth).toBeGreaterThan(0);
  expect(perimeterPaint.outlineColor).not.toBe('rgba(0, 0, 0, 0)');

  for (let index = 0; index < 8; index += 1) {
    const handle = handles.nth(index);
    await expect(handle).toBeVisible();
    const handleBounds = await requireBox(handle, `Transform handle ${index + 1}`);
    const tileEdgePaintTolerance = Math.max(
      containmentTolerance,
      handleBounds.width / 2,
      handleBounds.height / 2
    );
    expectContainedBy(
      handleBounds,
      tileBounds,
      `Transform handle ${index + 1}`,
      tileEdgePaintTolerance
    );
    expectContainedBy(handleBounds, previewBounds, `Transform handle ${index + 1}`);
  }
}

async function expectTransformControls(transformBox: Locator, transformBounds: Box) {
  const centerControl = transformBox.locator('[data-category-image-transform-center]');
  const rotateControl = transformBox.locator('[data-category-image-transform-rotate]');
  await expect(centerControl).toBeVisible();
  await expect(rotateControl).toBeVisible();

  const [centerBounds, rotateBounds] = await Promise.all([
    requireBox(centerControl, 'Category image center control'),
    requireBox(rotateControl, 'Category image rotation control')
  ]);
  const centerX = centerBounds.x + centerBounds.width / 2;
  const centerY = centerBounds.y + centerBounds.height / 2;
  const rotateCenterX = rotateBounds.x + rotateBounds.width / 2;
  const rotateCenterY = rotateBounds.y + rotateBounds.height / 2;

  // The whole preview is scaled, so sub-pixel rounding can move the visual
  // center by roughly one rendered pixel without changing the logical center.
  expect(Math.abs(centerX - (transformBounds.x + transformBounds.width / 2))).toBeLessThanOrEqual(2);
  expect(Math.abs(centerY - (transformBounds.y + transformBounds.height / 2))).toBeLessThanOrEqual(2);
  const horizontalRotationTolerance = Math.max(24, transformBounds.width * 0.15);
  expect(rotateCenterX).toBeGreaterThanOrEqual(transformBounds.x - horizontalRotationTolerance);
  expect(rotateCenterX).toBeLessThanOrEqual(
    transformBounds.x + transformBounds.width + horizontalRotationTolerance
  );
  expect(rotateCenterY, 'rotation/control affordance should stay at the top of the perimeter')
    .toBeLessThanOrEqual(transformBounds.y + Math.max(12, transformBounds.height * 0.16));
}

test.describe('homepage category image transform perimeter', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('/admin/podoba/glavna-stran');
    await expect(page.getByTestId('homepage-preview-stage')).toHaveAttribute(
      'data-preview-ready',
      'true',
      { timeout: 15_000 }
    );
  });

  test('surrounds the selected category image with eight handles and focused transform controls', async ({ page }) => {
    const liveLayer = page.getByTestId('homepage-preview-live-layer');
    const categoryImages = liveLayer.locator(
      '[data-homepage-canvas-element][data-canvas-element-id^="categories:image:"]'
    );
    const firstImage = categoryImages.first();
    const firstId = await firstImage.getAttribute('data-canvas-element-id');
    expect(firstId).toBeTruthy();
    const firstSlug = firstId!.slice('categories:image:'.length);

    await firstImage.click();
    const transformBox = page.locator('[data-category-image-transform-box]');
    await expect(transformBox).toHaveCount(1);
    const transformBounds = await expectTransformBoxAligned(
      transformBox,
      firstImage.locator(`[data-homepage-category-image="${firstSlug}"]`)
    );
    await expectEightPerimeterHandles(transformBox, transformBounds);
    await expectTransformControls(transformBox, transformBounds);

    const secondImage = categoryImages.nth(1);
    const secondId = await secondImage.getAttribute('data-canvas-element-id');
    expect(secondId).toBeTruthy();
    const secondSlug = secondId!.slice('categories:image:'.length);
    const firstTransformBounds = await requireBox(transformBox, 'First category image transform perimeter');

    await secondImage.click();
    await expect(transformBox).toHaveCount(1);
    const secondTransformBounds = await expectTransformBoxAligned(
      transformBox,
      secondImage.locator(`[data-homepage-category-image="${secondSlug}"]`)
    );
    expect(Math.abs(secondTransformBounds.x - firstTransformBounds.x)).toBeGreaterThan(20);

    await liveLayer.locator('[data-canvas-element-id^="categories:title:"]').first().click();
    await expect(transformBox).toHaveCount(0);
  });

  test('keeps the selected image perimeter aligned through a responsive zoom transition', async ({ page }) => {
    const liveLayer = page.getByTestId('homepage-preview-live-layer');
    const categoryImage = liveLayer.locator(
      '[data-homepage-canvas-element][data-canvas-element-id^="categories:image:"]'
    ).first();
    const imageId = await categoryImage.getAttribute('data-canvas-element-id');
    expect(imageId).toBeTruthy();
    const categorySlug = imageId!.slice('categories:image:'.length);
    const transformBox = page.locator('[data-category-image-transform-box]');

    await categoryImage.click();
    const desktopBounds = await expectTransformBoxAligned(
      transformBox,
      categoryImage.locator(`[data-homepage-category-image="${categorySlug}"]`)
    );

    await page.getByRole('button', { name: 'Tablica', exact: true }).click();
    await waitForPreviewIdle(page, 'tablet');
    await expect(categoryImage).toHaveAttribute('data-canvas-element-selected', 'true');
    await expect(transformBox).toHaveCount(1);
    const tabletBounds = await expectTransformBoxAligned(
      transformBox,
      categoryImage.locator(`[data-homepage-category-image="${categorySlug}"]`)
    );
    await expectEightPerimeterHandles(transformBox, tabletBounds);
    await expectTransformControls(transformBox, tabletBounds);

    expect(
      Math.abs(tabletBounds.x - desktopBounds.x)
      + Math.abs(tabletBounds.width - desktopBounds.width),
      'responsive zoom should exercise and recompute the transform perimeter geometry'
    ).toBeGreaterThan(4);
  });

  test('keeps the complete sixth-tile perimeter and all handles visible at 1329 by 920', async ({ page }) => {
    await page.setViewportSize({ width: 1329, height: 920 });
    await waitForPreviewIdle(page, 'desktop');

    const previewFrame = page.getByTestId('homepage-preview-frame');
    const liveLayer = page.getByTestId('homepage-preview-live-layer');
    const categoryImages = liveLayer.locator(
      '[data-homepage-canvas-element][data-canvas-element-id^="categories:image:"]'
    );
    const sixthImage = categoryImages.nth(5);
    await sixthImage.scrollIntoViewIfNeeded();
    const imageId = await sixthImage.getAttribute('data-canvas-element-id');
    expect(imageId).toBeTruthy();
    const categorySlug = imageId!.slice('categories:image:'.length);
    const tile = liveLayer.locator('[data-testid="category-showcase-tile"]').nth(5);

    await sixthImage.click();
    const transformBox = page.locator(
      `[data-category-image-transform-box="${categorySlug}"]`
    );
    await expect(transformBox).toHaveCount(1);
    await expectTransformBoxAligned(
      transformBox,
      sixthImage.locator(`[data-homepage-category-image="${categorySlug}"]`)
    );
    await expectPerimeterFullyPaintable({ transformBox, tile, previewFrame });
  });
});
