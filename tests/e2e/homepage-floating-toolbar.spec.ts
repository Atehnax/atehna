import { expect, test, type Locator, type Page } from '@playwright/test';

type Box = NonNullable<Awaited<ReturnType<Locator['boundingBox']>>>;

type RgbaColor = {
  red: number;
  green: number;
  blue: number;
  alpha: number;
};

function parseCssColor(value: string): RgbaColor {
  const channels = value.match(/[\d.]+/g)?.map(Number) ?? [];
  expect(channels.length, `expected an rgb/rgba color, received ${value}`).toBeGreaterThanOrEqual(3);
  return {
    red: channels[0]!,
    green: channels[1]!,
    blue: channels[2]!,
    alpha: channels[3] ?? 1
  };
}

function compositeColor(foreground: RgbaColor, background: RgbaColor): RgbaColor {
  const alpha = foreground.alpha + background.alpha * (1 - foreground.alpha);
  const channel = (foregroundChannel: number, backgroundChannel: number) => (
    (foregroundChannel * foreground.alpha
      + backgroundChannel * background.alpha * (1 - foreground.alpha)) / alpha
  );

  return {
    red: channel(foreground.red, background.red),
    green: channel(foreground.green, background.green),
    blue: channel(foreground.blue, background.blue),
    alpha
  };
}

function relativeLuminance(color: RgbaColor) {
  const linearChannel = (channel: number) => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linearChannel(color.red)
    + 0.7152 * linearChannel(color.green)
    + 0.0722 * linearChannel(color.blue);
}

function contrastRatio(first: RgbaColor, second: RgbaColor) {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  return (Math.max(firstLuminance, secondLuminance) + 0.05)
    / (Math.min(firstLuminance, secondLuminance) + 0.05);
}

const opaqueWhite: RgbaColor = { red: 255, green: 255, blue: 255, alpha: 1 };

function expectBlackGlassSurface(surface: RgbaColor, label: string) {
  expect(Math.max(surface.red, surface.green, surface.blue), `${label} should use the original black surface`)
    .toBeLessThanOrEqual(30);
  expect(surface.alpha, `${label} should remain nearly opaque`).toBeGreaterThanOrEqual(0.88);
  expect(surface.alpha, `${label} should retain a slight glass transparency`).toBeLessThanOrEqual(0.92);
}

function homepageToolbar(page: Page, mode: 'inline' | 'floating') {
  return page.locator(`[role="toolbar"][data-toolbar-mode="${mode}"]`);
}

async function readToolbarPalette(toolbar: Locator) {
  return toolbar.evaluate((element) => {
    const label = element.querySelector<HTMLElement>('[data-homepage-toolbar-label]');
    const action = element.querySelector<HTMLElement>(
      '[data-testid="homepage-toolbar-add"], [data-testid="homepage-page-toolbar-add"]'
    );
    const icon = action?.querySelector<SVGElement>('svg');
    const controlRow = element.firstElementChild;
    if (!label || !action || !icon || !controlRow) throw new Error('Toolbar palette markers are missing.');

    return {
      surface: getComputedStyle(element).backgroundColor,
      labelSurface: getComputedStyle(label).backgroundColor,
      labelText: getComputedStyle(label).color,
      actionText: getComputedStyle(action).color,
      iconText: getComputedStyle(icon).color,
      controls: Array.from(controlRow.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')).map((button) => ({
        label: button.getAttribute('aria-label') ?? 'unnamed toolbar action',
        surface: getComputedStyle(button).backgroundColor,
        text: getComputedStyle(button).color,
        icon: button.querySelector<SVGElement>('svg')
          ? getComputedStyle(button.querySelector<SVGElement>('svg')!).color
          : null,
        opacity: Number(getComputedStyle(button).opacity)
      }))
    };
  });
}

async function expectDarkSelectedToolbar(toolbar: Locator, anchorId: string) {
  await expect(toolbar).toBeVisible();
  await expect(toolbar).toHaveAttribute('data-toolbar-mode', 'floating');
  await expect(toolbar).toHaveAttribute('data-homepage-toolbar-anchor-id', anchorId);
  await expect(toolbar).toHaveAttribute('data-toolbar-ready', 'true');

  const palette = await readToolbarPalette(toolbar);
  const surface = parseCssColor(palette.surface);
  expectBlackGlassSurface(surface, 'selected toolbar surface');

  const compositedSurface = compositeColor(surface, opaqueWhite);
  const compositedLabelSurface = compositeColor(parseCssColor(palette.labelSurface), compositedSurface);
  for (const [label, value, background] of [
    ['selected-element label', palette.labelText, compositedLabelSurface],
    ['toolbar action', palette.actionText, compositedSurface],
    ['toolbar icon', palette.iconText, compositedSurface]
  ] as const) {
    const foreground = parseCssColor(value);
    expect(Math.min(foreground.red, foreground.green, foreground.blue), `${label} should use a light foreground`).toBeGreaterThanOrEqual(235);
    expect(foreground.alpha, `${label} should remain clearly visible`).toBeGreaterThanOrEqual(0.75);
    expect(
      contrastRatio(compositeColor(foreground, background), background),
      `${label} should remain readable against the dark toolbar`
    ).toBeGreaterThanOrEqual(4.5);
  }

  for (const control of palette.controls) {
    const controlSurface = compositeColor(parseCssColor(control.surface), compositedSurface);
    expect(control.opacity, `${control.label} should not be visually faded`).toBeGreaterThanOrEqual(0.75);
    for (const [kind, value] of [['button', control.text], ['icon', control.icon]] as const) {
      if (!value) continue;
      const foreground = compositeColor(parseCssColor(value), controlSurface);
      expect(relativeLuminance(foreground), `${control.label} ${kind} should be lighter than the toolbar`)
        .toBeGreaterThan(relativeLuminance(controlSurface));
      expect(contrastRatio(foreground, controlSurface), `${control.label} ${kind} should remain readable`)
        .toBeGreaterThanOrEqual(4.5);
    }
  }
}

async function expectTransparentInlineToolbar(toolbar: Locator) {
  await expect(toolbar).toHaveAttribute('data-toolbar-mode', 'inline');
  const [palette, decoration] = await Promise.all([
    readToolbarPalette(toolbar),
    toolbar.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        borderWidths: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth],
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        boxShadow: style.boxShadow
      };
    })
  ]);
  const surface = parseCssColor(palette.surface);
  expect(surface.alpha, 'persistent inline toolbar should not paint a background').toBeLessThanOrEqual(0.05);
  expect(decoration.borderWidths, 'persistent inline toolbar should not draw an outline border')
    .toEqual(['0px', '0px', '0px', '0px']);
  expect(decoration.outlineStyle).toBe('none');
  const shadowColors = decoration.boxShadow.match(/rgba?\([^)]*\)/g) ?? [];
  expect(
    decoration.boxShadow === 'none'
      || (shadowColors.length > 0 && shadowColors.every((color) => parseCssColor(color).alpha <= 0.05)),
    'persistent inline toolbar should not have a visible elevated outline or shadow'
  ).toBe(true);

  const compositedSurface = compositeColor(surface, opaqueWhite);
  const action = parseCssColor(palette.actionText);
  expect(contrastRatio(compositeColor(action, compositedSurface), compositedSurface), 'transparent inline toolbar actions should remain readable')
    .toBeGreaterThanOrEqual(4.5);
}

async function expectToolbarPopoverMatchesFloatingToolbar(dialog: Locator, toolbar: Locator) {
  const [popoverPalette, toolbarPalette] = await Promise.all([
    dialog.evaluate((element) => {
      const title = element.querySelector<HTMLElement>('h2');
      const description = element.querySelector<HTMLElement>('h2 + p');
      const close = element.querySelector<HTMLElement>('button[aria-label="Zapri"]');
      if (!title) throw new Error('Toolbar popover title is missing.');
      return {
        surface: getComputedStyle(element).backgroundColor,
        border: getComputedStyle(element).borderColor,
        blur: getComputedStyle(element).backdropFilter,
        shadow: getComputedStyle(element).boxShadow,
        title: getComputedStyle(title).color,
        description: description ? getComputedStyle(description).color : null,
        close: close ? getComputedStyle(close).color : null
      };
    }),
    toolbar.evaluate((element) => ({
      surface: getComputedStyle(element).backgroundColor,
      border: getComputedStyle(element).borderColor,
      blur: getComputedStyle(element).backdropFilter,
      shadow: getComputedStyle(element).boxShadow
    }))
  ]);

  expect(popoverPalette.surface, 'settings popover should use the floating toolbar surface')
    .toBe(toolbarPalette.surface);
  expect(popoverPalette.border, 'settings popover should use the floating toolbar border').toBe(toolbarPalette.border);
  expect(popoverPalette.blur, 'settings popover should use the floating toolbar blur').toBe(toolbarPalette.blur);
  expect(popoverPalette.shadow, 'settings popover should use the floating toolbar shadow').toBe(toolbarPalette.shadow);

  const surface = parseCssColor(popoverPalette.surface);
  expectBlackGlassSurface(surface, 'toolbar popover surface');
  expectBlackGlassSurface(parseCssColor(toolbarPalette.surface), 'selected toolbar surface');

  const compositedSurface = compositeColor(surface, opaqueWhite);
  const title = parseCssColor(popoverPalette.title);
  expect(contrastRatio(compositeColor(title, compositedSurface), compositedSurface), 'popover text should remain readable')
    .toBeGreaterThanOrEqual(4.5);
  for (const [label, color] of [['description', popoverPalette.description], ['close button', popoverPalette.close]] as const) {
    expect(color, `${label} color should be available`).not.toBeNull();
    const parsed = parseCssColor(color!);
    expect(contrastRatio(compositeColor(parsed, compositedSurface), compositedSurface), `${label} should remain readable`)
      .toBeGreaterThanOrEqual(4.5);
  }
}

async function expectDarkPopoverFields(dialog: Locator) {
  const dialogSurface = compositeColor(
    parseCssColor(await dialog.evaluate((element) => getComputedStyle(element).backgroundColor)),
    opaqueWhite
  );
  const controls = dialog.locator('input[type="text"], input:not([type]), textarea, select');
  const count = await controls.count();
  expect(count, 'popover should expose text-entry controls').toBeGreaterThan(0);

  for (let index = 0; index < count; index += 1) {
    const control = controls.nth(index);
    for (const state of ['idle', 'focused'] as const) {
      if (state === 'focused') await control.focus();
      const palette = await control.evaluate((element) => {
        const style = getComputedStyle(element);
        return { background: style.backgroundColor, text: style.color };
      });
      const background = compositeColor(parseCssColor(palette.background), dialogSurface);
      const text = compositeColor(parseCssColor(palette.text), background);
      expect(relativeLuminance(background), `${state} field ${index + 1} should use a dark fill`)
        .toBeLessThanOrEqual(0.15);
      expect(contrastRatio(text, background), `${state} field ${index + 1} text should remain readable`)
        .toBeGreaterThanOrEqual(4.5);
    }
  }
}

async function expectCompactToolbarPopover(dialog: Locator, size: 'standard' | 'wide') {
  await expect(dialog).toHaveAttribute('data-homepage-toolbar-popover-size', size);
  const geometry = await dialog.evaluate((element) => {
    const header = element.querySelector<HTMLElement>('[data-testid="homepage-toolbar-popover-header"]');
    const body = element.querySelector<HTMLElement>('[data-testid="homepage-toolbar-popover-body"]');
    if (!header || !body) throw new Error('Toolbar popover chrome is incomplete.');
    const rect = element.getBoundingClientRect();
    const headerRect = header.getBoundingClientRect();
    const bodyStyle = getComputedStyle(body);
    const controls = Array.from(body.querySelectorAll<HTMLElement>('input:not([type="hidden"]), select, textarea')).map((control) => ({
      tag: control.tagName.toLowerCase(),
      height: control.getBoundingClientRect().height
    }));
    return {
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom },
      viewport: { width: window.innerWidth, height: window.innerHeight },
      headerHeight: headerRect.height,
      body: {
        paddingLeft: Number.parseFloat(bodyStyle.paddingLeft),
        paddingRight: Number.parseFloat(bodyStyle.paddingRight),
        paddingTop: Number.parseFloat(bodyStyle.paddingTop),
        paddingBottom: Number.parseFloat(bodyStyle.paddingBottom),
        overflowY: bodyStyle.overflowY,
        clientWidth: body.clientWidth,
        scrollWidth: body.scrollWidth
      },
      controls
    };
  });

  expect(geometry.rect.width).toBeLessThanOrEqual(size === 'wide' ? 441 : 361);
  expect(geometry.rect.height).toBeLessThanOrEqual(541);
  expect(geometry.headerHeight).toBeLessThanOrEqual(50);
  expect(geometry.body.paddingLeft).toBeLessThanOrEqual(12);
  expect(geometry.body.paddingRight).toBeLessThanOrEqual(12);
  expect(geometry.body.paddingTop).toBeLessThanOrEqual(8);
  expect(geometry.body.paddingBottom).toBeLessThanOrEqual(8);
  expect(geometry.body.overflowY).toBe('auto');
  expect(geometry.body.scrollWidth).toBeLessThanOrEqual(geometry.body.clientWidth + 1);
  expect(geometry.rect.x).toBeGreaterThanOrEqual(-1);
  expect(geometry.rect.y).toBeGreaterThanOrEqual(-1);
  expect(geometry.rect.right).toBeLessThanOrEqual(geometry.viewport.width + 1);
  expect(geometry.rect.bottom).toBeLessThanOrEqual(geometry.viewport.height + 1);

  for (const control of geometry.controls) {
    expect(control.height, `${control.tag} should use compact vertical density`)
      .toBeLessThanOrEqual(control.tag === 'textarea' ? 64 : 32);
  }
}

async function requireBox(locator: Locator, label: string): Promise<Box> {
  const box = await locator.boundingBox();
  expect(box, `${label} should have rendered geometry`).not.toBeNull();
  return box!;
}

async function expectToolbarInsidePreview(toolbar: Locator, frame: Locator) {
  const [toolbarBox, frameBox] = await Promise.all([
    requireBox(toolbar, 'Floating toolbar'),
    requireBox(frame, 'Preview frame')
  ]);
  const tolerance = 2;

  expect(toolbarBox.x, 'toolbar left edge escaped the preview').toBeGreaterThanOrEqual(frameBox.x - tolerance);
  expect(toolbarBox.x + toolbarBox.width, 'toolbar right edge escaped the preview')
    .toBeLessThanOrEqual(frameBox.x + frameBox.width + tolerance);
}

async function expectToolbarBesideAnchor(toolbar: Locator, anchor: Locator) {
  const [toolbarBox, anchorBox, placement] = await Promise.all([
    requireBox(toolbar, 'Floating toolbar'),
    requireBox(anchor, 'Selected canvas element'),
    toolbar.getAttribute('data-toolbar-placement')
  ]);
  const tolerance = 3;

  expect(['top', 'bottom'], 'toolbar should publish its resolved placement').toContain(placement);
  if (placement === 'top') {
    expect(toolbarBox.y + toolbarBox.height, 'top toolbar should finish above its selected element')
      .toBeLessThanOrEqual(anchorBox.y + tolerance);
  } else {
    expect(toolbarBox.y, 'bottom toolbar should begin below its selected element')
      .toBeGreaterThanOrEqual(anchorBox.y + anchorBox.height - tolerance);
  }
}

async function expectToolbarInlineAfterDeviceControls(toolbar: Locator, deviceControls: Locator) {
  await expect(toolbar).toHaveCount(1);
  await expect(toolbar).toBeVisible();
  await expect(toolbar).toHaveAttribute('data-toolbar-mode', 'inline');
  await expect(toolbar).toHaveAttribute('data-toolbar-placement', 'inline');
  await expect(toolbar).toHaveAttribute('data-toolbar-ready', 'true');
  await expect(toolbar).toHaveAttribute('data-homepage-toolbar-anchor-id', 'preview-controls');

  const [toolbarBox, controlsBox, toolbarPosition, portalMounted, immediatelyAfterControls] = await Promise.all([
    requireBox(toolbar, 'Inline toolbar'),
    requireBox(deviceControls, 'Device controls'),
    toolbar.evaluate((element) => getComputedStyle(element).position),
    toolbar.evaluate((element) => element.parentElement === document.body),
    toolbar.evaluate((element) => element.previousElementSibling?.hasAttribute('data-homepage-preview-controls') ?? false)
  ]);
  const tolerance = 3;

  expect(['static', 'relative'], 'inline toolbar should participate in the controls row').toContain(toolbarPosition);
  expect(portalMounted, 'inline toolbar should not be mounted in the floating body portal').toBe(false);
  expect(immediatelyAfterControls, 'inline toolbar should remain immediately after the device controls').toBe(true);
  expect(toolbarBox.x, 'inline toolbar should begin after the device controls')
    .toBeGreaterThanOrEqual(controlsBox.x + controlsBox.width - tolerance);
  expect(
    Math.abs(
      (toolbarBox.y + toolbarBox.height / 2)
      - (controlsBox.y + controlsBox.height / 2)
    ),
    'inline toolbar should remain vertically aligned with the device controls'
  ).toBeLessThanOrEqual(tolerance);
}

async function movePreviewAnchor(anchor: Locator, mode: 'center' | 'near-top') {
  await anchor.evaluate((element, requestedMode) => {
    const scroller = element.closest<HTMLElement>('[data-testid="homepage-preview-scroll-region"]');
    if (!scroller) throw new Error('Selected canvas element is not inside the homepage preview scroll region.');

    const scrollerBox = scroller.getBoundingClientRect();
    const elementBox = element.getBoundingClientRect();
    const requestedTop = requestedMode === 'center'
      ? scrollerBox.top + Math.max(56, (scrollerBox.height - elementBox.height) / 2)
      : scrollerBox.top + 6;
    scroller.scrollTop += elementBox.top - requestedTop;
  }, mode);
}

async function waitForPreviewIdle(page: Page, device: 'desktop' | 'tablet' | 'mobile') {
  const stage = page.getByTestId('homepage-preview-stage');
  await expect(stage).toHaveAttribute('data-preview-target-device', device);
  await expect(stage).toHaveAttribute('data-preview-render-device', device, { timeout: 15_000 });
  await expect(stage).toHaveAttribute('data-preview-transitioning', 'false', { timeout: 15_000 });
}

test.describe('homepage contextual floating toolbar', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('/admin/podoba/glavna-stran');
    await expect(page.getByTestId('homepage-preview-stage')).toHaveAttribute(
      'data-preview-ready',
      'true',
      { timeout: 15_000 }
    );
  });

  test('floats by the selected element, follows selection, clamps horizontally, and flips below near the top edge', async ({ page }) => {
    const toolbar = homepageToolbar(page, 'floating');
    const frame = page.getByTestId('homepage-preview-frame');
    const fixedDeviceControls = page.locator('[data-homepage-preview-controls]');
    const categoryImage = page.locator(
      '[data-testid="homepage-preview-live-layer"] [data-homepage-canvas-element][data-canvas-element-id^="categories:image:"]'
    ).first();
    const categoryImageId = await categoryImage.getAttribute('data-canvas-element-id');
    expect(categoryImageId).toBeTruthy();

    await movePreviewAnchor(categoryImage, 'center');
    await categoryImage.click();
    await expect(toolbar).toBeVisible();
    await expect(toolbar).toHaveAttribute('data-homepage-toolbar-anchor-id', categoryImageId!);
    await expect(toolbar).toHaveAttribute('data-toolbar-placement', 'top');

    const toolbarPosition = await toolbar.evaluate((element) => getComputedStyle(element).position);
    expect(['absolute', 'fixed'], 'context toolbar should no longer participate in the fixed top row').toContain(toolbarPosition);
    const [toolbarBox, fixedControlsBox] = await Promise.all([
      requireBox(toolbar, 'Floating toolbar'),
      requireBox(fixedDeviceControls, 'Fixed device controls')
    ]);
    expect(toolbarBox.y, 'floating toolbar should not overlap the fixed top controls row')
      .toBeGreaterThan(fixedControlsBox.y + fixedControlsBox.height + 4);
    await expectToolbarInsidePreview(toolbar, frame);
    await expectToolbarBesideAnchor(toolbar, categoryImage);

    const categoryToolbarY = toolbarBox.y;
    const heroTitle = page.locator(
      '[data-testid="homepage-preview-live-layer"] [data-homepage-canvas-element][data-canvas-element-id="hero:title"]'
    );
    const scrollRegion = page.getByTestId('homepage-preview-scroll-region');
    await scrollRegion.evaluate((element) => { element.scrollTop = 0; });
    await heroTitle.click();
    await expect(toolbar).toHaveAttribute('data-homepage-toolbar-anchor-id', 'hero:title');
    await expectToolbarBesideAnchor(toolbar, heroTitle);
    const heroToolbarBox = await requireBox(toolbar, 'Hero title toolbar');
    expect(Math.abs(heroToolbarBox.y - categoryToolbarY), 'toolbar did not follow the new selected element')
      .toBeGreaterThan(12);

    await movePreviewAnchor(heroTitle, 'near-top');
    await expect(toolbar).toHaveAttribute('data-toolbar-placement', 'bottom');
    await expectToolbarInsidePreview(toolbar, frame);
    await expectToolbarBesideAnchor(toolbar, heroTitle);

    await toolbar.getByRole('button', { name: 'Slog besedila', exact: true }).click();
    await expect(page.getByRole('dialog', { name: /^Besedilo/ })).toBeVisible();
    await page.getByRole('dialog', { name: /^Besedilo/ })
      .getByRole('button', { name: 'Zapri', exact: true })
      .click();
  });

  test('remains anchored and usable while preview scroll and responsive zoom change', async ({ page }) => {
    const toolbar = homepageToolbar(page, 'floating');
    const frame = page.getByTestId('homepage-preview-frame');
    const stage = page.getByTestId('homepage-preview-stage');
    const scrollRegion = page.getByTestId('homepage-preview-scroll-region');
    const heroTitle = page.locator(
      '[data-testid="homepage-preview-live-layer"] [data-homepage-canvas-element][data-canvas-element-id="hero:title"]'
    );

    await heroTitle.click();
    await expect(toolbar).toHaveAttribute('data-homepage-toolbar-anchor-id', 'hero:title');
    const desktopScale = Number(await stage.getAttribute('data-preview-scale'));
    expect(desktopScale).toBeGreaterThan(0);
    const desktopToolbarBox = await requireBox(toolbar, 'Desktop toolbar');

    await page.getByRole('button', { name: 'Mobilno', exact: true }).click();
    await waitForPreviewIdle(page, 'mobile');
    await expect(toolbar).toBeVisible();
    await expect(toolbar).toHaveAttribute('data-homepage-toolbar-anchor-id', 'hero:title');
    const mobileScale = Number(await stage.getAttribute('data-preview-scale'));
    expect(mobileScale).toBeGreaterThan(0);
    expect(Math.abs(mobileScale - desktopScale), 'responsive switch should exercise a different preview zoom')
      .toBeGreaterThan(0.05);
    await expectToolbarInsidePreview(toolbar, frame);
    await expectToolbarBesideAnchor(toolbar, heroTitle);

    await scrollRegion.evaluate((element) => { element.scrollTop += 48; });
    await expect(toolbar).toBeVisible();
    await expect(toolbar).toHaveAttribute('data-homepage-toolbar-anchor-id', 'hero:title');
    await expectToolbarInsidePreview(toolbar, frame);
    await expectToolbarBesideAnchor(toolbar, heroTitle);
    const scrolledToolbarBox = await requireBox(toolbar, 'Scrolled mobile toolbar');
    expect(Math.abs(scrolledToolbarBox.y - desktopToolbarBox.y), 'toolbar position should be recomputed after zoom and scroll')
      .toBeGreaterThan(8);

    const windowScrollBefore = await page.evaluate(() => window.scrollY);
    await page.evaluate(() => window.scrollBy(0, 120));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(windowScrollBefore);
    await expect(toolbar).toBeVisible();
    await expect(toolbar).toHaveAttribute('data-homepage-toolbar-anchor-id', 'hero:title');
    await expectToolbarInsidePreview(toolbar, frame);
    await expectToolbarBesideAnchor(toolbar, heroTitle);

    await toolbar.getByRole('button', { name: 'Slog besedila', exact: true }).click();
    await expect(page.getByRole('dialog', { name: /^Besedilo/ })).toBeVisible();
    await page.getByRole('dialog', { name: /^Besedilo/ }).getByRole('button', { name: 'Zapri', exact: true }).click();

    await page.getByRole('button', { name: 'Tablica', exact: true }).click();
    await waitForPreviewIdle(page, 'tablet');
    await expect(toolbar).toBeVisible();
    await expect(toolbar).toHaveAttribute('data-homepage-toolbar-anchor-id', 'hero:title');
    await expectToolbarInsidePreview(toolbar, frame);
    await expectToolbarBesideAnchor(toolbar, heroTitle);
  });
});

test.describe('homepage floating toolbar at the reported browser viewport', () => {
  test.use({ viewport: { width: 1329, height: 920 } });

  test('keeps a transparent page toolbar inline while selected-element controls float', async ({ page }) => {
    await page.goto('/admin/podoba/glavna-stran');

    const stage = page.getByTestId('homepage-preview-stage');
    const frame = page.getByTestId('homepage-preview-frame');
    const inlineToolbar = homepageToolbar(page, 'inline');
    const floatingToolbar = homepageToolbar(page, 'floating');
    const toolbar = floatingToolbar;
    const deviceControls = page.locator('[data-homepage-preview-controls]');
    const heroTitle = page.locator(
      '[data-testid="homepage-preview-live-layer"] [data-homepage-canvas-element][data-canvas-element-id="hero:title"]'
    );

    await expect(stage).toHaveAttribute('data-preview-ready', 'true', { timeout: 15_000 });
    await expect(stage).toHaveAttribute('data-selected-element-id', '');
    await expectToolbarInlineAfterDeviceControls(inlineToolbar, deviceControls);
    await expectTransparentInlineToolbar(inlineToolbar);
    await expect(inlineToolbar).toContainText('Stran');
    await expect(floatingToolbar).toHaveCount(0);

    await heroTitle.click();
    await expect(stage).toHaveAttribute('data-selected-element-id', 'hero:title');
    await expectToolbarInlineAfterDeviceControls(inlineToolbar, deviceControls);
    await expectTransparentInlineToolbar(inlineToolbar);
    await expect(inlineToolbar).toContainText('Stran');
    await expectDarkSelectedToolbar(floatingToolbar, 'hero:title');
    expect(
      await floatingToolbar.evaluate((element) => element.parentElement === document.body),
      'selected-element toolbar should use the floating body portal'
    ).toBe(true);
    await expectToolbarInsidePreview(floatingToolbar, frame);
    await expectToolbarBesideAnchor(floatingToolbar, heroTitle);

    await toolbar.getByRole('button', { name: 'Počisti izbor', exact: true }).click();
    await expect(stage).toHaveAttribute('data-selected-element-id', '');
    await expect(floatingToolbar).toHaveCount(0);
    await expectToolbarInlineAfterDeviceControls(inlineToolbar, deviceControls);
    await expectTransparentInlineToolbar(inlineToolbar);

    const categoryImage = page.locator(
      '[data-testid="homepage-preview-live-layer"] [data-homepage-canvas-element][data-canvas-element-id^="categories:image:"]'
    ).first();
    const categoryImageId = await categoryImage.getAttribute('data-canvas-element-id');
    expect(categoryImageId).toBeTruthy();

    await movePreviewAnchor(categoryImage, 'center');
    await categoryImage.click();
    await expect(stage).toHaveAttribute('data-selected-element-id', categoryImageId!);
    await expectToolbarInlineAfterDeviceControls(inlineToolbar, deviceControls);
    await expectTransparentInlineToolbar(inlineToolbar);
    await expectDarkSelectedToolbar(floatingToolbar, categoryImageId!);
    await expectToolbarInsidePreview(floatingToolbar, frame);
    await expectToolbarBesideAnchor(floatingToolbar, categoryImage);

    await toolbar.getByRole('button', { name: 'Počisti izbor', exact: true }).click();
    await expect(stage).toHaveAttribute('data-selected-element-id', '');
    await expect(floatingToolbar).toHaveCount(0);
    await expectToolbarInlineAfterDeviceControls(inlineToolbar, deviceControls);
    await expectTransparentInlineToolbar(inlineToolbar);
  });

  test('appears beside hero and category selections after the editor page is scrolled', async ({ page }) => {
    await page.goto('/admin/podoba/glavna-stran');

    const stage = page.getByTestId('homepage-preview-stage');
    const frame = page.getByTestId('homepage-preview-frame');
    const toolbar = homepageToolbar(page, 'floating');
    const heroTitle = page.locator(
      '[data-testid="homepage-preview-live-layer"] [data-homepage-canvas-element][data-canvas-element-id="hero:title"]'
    );

    await expect(stage).toHaveAttribute('data-preview-ready', 'true', { timeout: 15_000 });
    await heroTitle.click();
    await expect(stage).toHaveAttribute('data-selected-element-id', 'hero:title');
    await expect(toolbar).toBeVisible({ timeout: 15_000 });
    await expect(toolbar).toHaveAttribute('data-toolbar-ready', 'true');
    await expect(toolbar).toHaveAttribute('data-homepage-toolbar-anchor-id', 'hero:title');
    await expect(toolbar.getByRole('button', { name: 'Slog besedila', exact: true })).toBeVisible();
    const heroToolbarBox = await requireBox(toolbar, 'Visible hero toolbar palette');
    expect(heroToolbarBox.width).toBeGreaterThan(180);
    expect(heroToolbarBox.height).toBeGreaterThanOrEqual(32);
    await expectToolbarInsidePreview(toolbar, frame);
    await expectToolbarBesideAnchor(toolbar, heroTitle);

    await page.evaluate(() => window.scrollBy(0, 160));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await expect(toolbar).toBeVisible();
    await expect(toolbar).toHaveAttribute('data-toolbar-ready', 'true');
    await expectToolbarInsidePreview(toolbar, frame);
    await expectToolbarBesideAnchor(toolbar, heroTitle);

    const categoryImage = page.locator(
      '[data-testid="homepage-preview-live-layer"] [data-homepage-canvas-element][data-canvas-element-id^="categories:image:"]'
    ).first();
    const categoryImageId = await categoryImage.getAttribute('data-canvas-element-id');
    expect(categoryImageId).toBeTruthy();

    await movePreviewAnchor(categoryImage, 'center');
    await categoryImage.click();
    await expect(stage).toHaveAttribute('data-selected-element-id', categoryImageId!);
    await expect(toolbar).toBeVisible();
    await expect(toolbar).toHaveAttribute('data-toolbar-ready', 'true');
    await expect(toolbar).toHaveAttribute('data-homepage-toolbar-anchor-id', categoryImageId!);
    await expect(toolbar.getByRole('button', { name: 'Uredi videz kategorije', exact: true })).toBeVisible();
    await expectToolbarInsidePreview(toolbar, frame);
    await expectToolbarBesideAnchor(toolbar, categoryImage);

    const categorySlug = categoryImageId!.slice('categories:image:'.length);
    const categoryCardId = `categories:card:${categorySlug}`;
    const categoryCard = page.locator(
      `[data-testid="homepage-preview-live-layer"] [data-homepage-canvas-element][data-canvas-element-id="${categoryCardId}"]`
    );
    await categoryCard.click({ position: { x: 4, y: 4 } });
    await expect(stage).toHaveAttribute('data-selected-element-id', categoryCardId);
    await expect(toolbar).toBeVisible();
    await expect(toolbar).toHaveAttribute('data-toolbar-ready', 'true');
    await expect(toolbar).toHaveAttribute('data-homepage-toolbar-anchor-id', categoryCardId);
    await expect(toolbar.getByRole('button', { name: 'Mere in poravnava', exact: true })).toBeVisible();
    await expectToolbarInsidePreview(toolbar, frame);
    await expectToolbarBesideAnchor(toolbar, categoryCard);
  });

  test('uses the same black glass surface for selected-element toolbars and settings popovers', async ({ page }) => {
    await page.goto('/admin/podoba/glavna-stran');

    const stage = page.getByTestId('homepage-preview-stage');
    const inlineToolbar = homepageToolbar(page, 'inline');
    const toolbar = homepageToolbar(page, 'floating');
    const deviceControls = page.locator('[data-homepage-preview-controls]');
    const liveLayer = page.getByTestId('homepage-preview-live-layer');
    const heroTitle = liveLayer.locator('[data-homepage-canvas-element][data-canvas-element-id="hero:title"]');

    await expect(stage).toHaveAttribute('data-preview-ready', 'true', { timeout: 15_000 });
    await expect(stage).toHaveAttribute('data-selected-element-id', '');
    await expectToolbarInlineAfterDeviceControls(inlineToolbar, deviceControls);
    await expectTransparentInlineToolbar(inlineToolbar);
    await expect(toolbar).toHaveCount(0);

    await heroTitle.click();
    await expect(stage).toHaveAttribute('data-selected-element-id', 'hero:title');
    await expectToolbarInlineAfterDeviceControls(inlineToolbar, deviceControls);
    await expectTransparentInlineToolbar(inlineToolbar);
    await expectDarkSelectedToolbar(toolbar, 'hero:title');

    await toolbar.getByRole('button', { name: 'Slog besedila', exact: true }).click();
    const textPopover = page.getByRole('dialog', { name: /^Besedilo/ });
    await expect(textPopover).toBeVisible();
    await expectToolbarPopoverMatchesFloatingToolbar(textPopover, toolbar);
    await expectCompactToolbarPopover(textPopover, 'standard');
    await textPopover.getByRole('button', { name: 'Zapri', exact: true }).click();

    const categoryImage = liveLayer.locator(
      '[data-homepage-canvas-element][data-canvas-element-id^="categories:image:"]'
    ).first();
    const categoryImageId = await categoryImage.getAttribute('data-canvas-element-id');
    expect(categoryImageId).toBeTruthy();
    await movePreviewAnchor(categoryImage, 'center');
    await categoryImage.click();
    await expect(stage).toHaveAttribute('data-selected-element-id', categoryImageId!);
    await expectDarkSelectedToolbar(toolbar, categoryImageId!);

    await toolbar.getByRole('button', { name: 'Uredi videz kategorije', exact: true }).click();
    const categoryPopover = page.getByRole('dialog', { name: 'Uredi videz kategorije', exact: true });
    await expect(categoryPopover).toBeVisible();
    await expectToolbarPopoverMatchesFloatingToolbar(categoryPopover, toolbar);
    await expectCompactToolbarPopover(categoryPopover, 'standard');
    const categoryControls = categoryPopover.locator('[data-category-media-controls]');
    await expect(categoryControls).toHaveAttribute('data-category-media-controls-tone', 'dark');
    expect(parseCssColor(await categoryControls.evaluate((element) => getComputedStyle(element).backgroundColor)).alpha)
      .toBeLessThanOrEqual(0.05);
    await categoryPopover.getByRole('button', { name: 'Zapri', exact: true }).click();

    const categorySlug = categoryImageId!.slice('categories:image:'.length);
    const categoryCardId = `categories:card:${categorySlug}`;
    const categoryCard = liveLayer.locator(
      `[data-homepage-canvas-element][data-canvas-element-id="${categoryCardId}"]`
    );
    await categoryCard.click({ position: { x: 4, y: 4 } });
    await expect(stage).toHaveAttribute('data-selected-element-id', categoryCardId);
    await expectDarkSelectedToolbar(toolbar, categoryCardId);

    const categoriesSection = liveLayer.locator('[data-homepage-section="categories"]');
    const categoriesBox = await requireBox(categoriesSection, 'Categories section');
    await categoriesSection.click({ position: { x: categoriesBox.width - 2, y: 2 } });
    await expect(stage).toHaveAttribute('data-selected-element-id', 'section:categories');
    await expectDarkSelectedToolbar(toolbar, 'section:categories');

    await toolbar.locator('button[aria-label$="isti izbor"]').click();
    await expect(stage).toHaveAttribute('data-selected-element-id', '');
    await expect(toolbar).toHaveCount(0);
    await expectToolbarInlineAfterDeviceControls(inlineToolbar, deviceControls);
    await expectTransparentInlineToolbar(inlineToolbar);
  });

  test('keeps Hero and carousel settings focused and compact', async ({ page }) => {
    await page.goto('/admin/podoba/glavna-stran');

    const stage = page.getByTestId('homepage-preview-stage');
    const liveLayer = page.getByTestId('homepage-preview-live-layer');
    const heroSection = liveLayer.locator('[data-homepage-section="hero"]');
    const toolbar = homepageToolbar(page, 'floating');

    await expect(stage).toHaveAttribute('data-preview-ready', 'true', { timeout: 15_000 });
    await heroSection.click({ position: { x: 4, y: 4 } });
    await expect(stage).toHaveAttribute('data-selected-element-id', 'section:hero');
    await expectDarkSelectedToolbar(toolbar, 'section:hero');

    await toolbar.getByRole('button', { name: 'Nastavitve sekcije', exact: true }).click();
    const heroPopover = page.getByRole('dialog', { name: 'Nastavitve · Hero', exact: true });
    await expect(heroPopover).toBeVisible();
    await expectToolbarPopoverMatchesFloatingToolbar(heroPopover, toolbar);
    await expectCompactToolbarPopover(heroPopover, 'wide');
    await expectDarkPopoverFields(heroPopover);
    await expect(heroPopover.getByRole('button', { name: 'Tekst in gumbi', exact: true })).toHaveAttribute('aria-expanded', 'true');
    await expect(heroPopover.getByRole('button', { name: 'Postavitev in ozadje', exact: true })).toHaveAttribute('aria-expanded', 'false');
    await expect(heroPopover.getByRole('button', { name: 'Slike in vrtiljak', exact: true })).toHaveCount(0);

    await heroPopover.getByRole('button', { name: 'Zapri', exact: true }).click();
    await toolbar.getByRole('button', { name: 'Slike in vrtiljak', exact: true }).click();
    const carouselPopover = page.getByRole('dialog', { name: 'Slike in vrtiljak', exact: true });
    await expect(carouselPopover).toBeVisible();
    await expectToolbarPopoverMatchesFloatingToolbar(carouselPopover, toolbar);
    await expectCompactToolbarPopover(carouselPopover, 'wide');
    await expect(carouselPopover.getByTestId('homepage-hero-carousel-settings')).toBeVisible();
  });
});

test.describe('homepage toolbar short-viewport dismissal and overflow', () => {
  test.use({ viewport: { width: 1024, height: 640 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/podoba/glavna-stran');
    await expect(page.getByTestId('homepage-preview-stage')).toHaveAttribute(
      'data-preview-ready',
      'true',
      { timeout: 15_000 }
    );
  });

  test('bounds a tall panel away from its selected anchor and scrolls only its body', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 440 });
    const stage = page.getByTestId('homepage-preview-stage');
    const toolbar = homepageToolbar(page, 'floating');
    const heroTitle = page.locator(
      '[data-testid="homepage-preview-live-layer"] [data-homepage-canvas-element][data-canvas-element-id="hero:title"]'
    );

    await heroTitle.click();
    await expect(stage).toHaveAttribute('data-selected-element-id', 'hero:title');
    await expect(toolbar).toHaveAttribute('data-toolbar-ready', 'true');
    await toolbar.getByRole('button', { name: 'Notranji in zunanji razmiki', exact: true }).click();

    const dialog = page.getByRole('dialog', { name: /^Razmiki/ });
    const body = dialog.getByTestId('homepage-toolbar-popover-body');
    await expect(dialog).toBeVisible();
    await expect(body).toHaveAttribute('data-settings-scroll', 'internal');

    const [dialogBox, toolbarBox, anchorBox, panelSide, toolbarPlacement, metrics] = await Promise.all([
      requireBox(dialog, 'Short-viewport settings popover'),
      requireBox(toolbar, 'Short-viewport floating toolbar'),
      requireBox(heroTitle, 'Selected hero title'),
      dialog.getAttribute('data-homepage-toolbar-popover-placement'),
      toolbar.getAttribute('data-toolbar-placement'),
      body.evaluate((element) => {
        const panel = element.parentElement;
        if (!panel) throw new Error('Popover body has no panel.');
        const panelStyle = getComputedStyle(panel);
        return {
          bodyClientHeight: element.clientHeight,
          bodyScrollHeight: element.scrollHeight,
          bodyOverflowY: getComputedStyle(element).overflowY,
          panelMaxHeight: Number.parseFloat(panelStyle.maxHeight)
        };
      })
    ]);

    expect(panelSide).toBe(toolbarPlacement === 'top' ? 'above' : 'below');
    expect(dialogBox.y).toBeGreaterThanOrEqual(7);
    expect(dialogBox.y + dialogBox.height).toBeLessThanOrEqual(441);
    expect(dialogBox.height).toBeLessThanOrEqual(metrics.panelMaxHeight + 1);
    expect(metrics.bodyOverflowY).toBe('auto');
    expect(metrics.bodyScrollHeight).toBeGreaterThan(metrics.bodyClientHeight);

    if (panelSide === 'above') {
      expect(dialogBox.y + dialogBox.height).toBeLessThanOrEqual(toolbarBox.y + 2);
      expect(dialogBox.y + dialogBox.height).toBeLessThanOrEqual(anchorBox.y + 2);
    } else {
      expect(dialogBox.y).toBeGreaterThanOrEqual(toolbarBox.y + toolbarBox.height - 2);
      expect(dialogBox.y).toBeGreaterThanOrEqual(anchorBox.y + anchorBox.height - 2);
    }

    await body.locator('input').last().scrollIntoViewIfNeeded();
    expect(await body.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  });

  test('keeps nested select and color portals selected, then clears selection outside', async ({ page }) => {
    const stage = page.getByTestId('homepage-preview-stage');
    const toolbar = homepageToolbar(page, 'floating');
    const heroTitle = page.locator(
      '[data-testid="homepage-preview-live-layer"] [data-homepage-canvas-element][data-canvas-element-id="hero:title"]'
    );

    await heroTitle.click();
    await expect(stage).toHaveAttribute('data-selected-element-id', 'hero:title');
    await toolbar.getByRole('button', { name: 'Slog besedila', exact: true }).click();

    const dialog = page.getByRole('dialog', { name: /^Besedilo/ });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Pisava', exact: true }).click();
    const listbox = page.getByRole('listbox', { name: 'Pisava', exact: true });
    await expect(listbox).toBeVisible();
    await listbox.getByRole('option').nth(1).click();
    await expect(stage).toHaveAttribute('data-selected-element-id', 'hero:title');
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: 'Odpri barvno paleto: Barva', exact: true }).click();
    const palette = page.getByRole('dialog', { name: 'Barva', exact: true });
    await expect(palette).toBeVisible();
    await palette.getByRole('button', { name: 'Zapri barvno paleto', exact: true }).click();
    await expect(stage).toHaveAttribute('data-selected-element-id', 'hero:title');
    await expect(dialog).toBeVisible();

    await page.getByRole('heading', { name: 'Glavna stran', exact: true }).first().click();
    await expect(stage).toHaveAttribute('data-selected-element-id', '');
    await expect(toolbar).toHaveCount(0);
  });
});
