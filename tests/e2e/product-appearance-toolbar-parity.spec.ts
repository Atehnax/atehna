import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveProductDescriptionFontSize } from '@/admin/features/podoba/components/ProductDescriptionRichTextEditor';
import { clampAppearanceEditorNumberInput } from '@/admin/features/podoba/components/AppearanceEditorToolbarPrimitives';

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

function expectBlackGlassSurface(surface: RgbaColor, label: string) {
  expect(
    Math.max(surface.red, surface.green, surface.blue),
    `${label} should use the same near-black surface as the homepage toolbar`
  ).toBeLessThanOrEqual(30);
  expect(surface.alpha, `${label} should remain nearly opaque`).toBeGreaterThanOrEqual(0.88);
  expect(surface.alpha, `${label} should retain slight glass transparency`).toBeLessThanOrEqual(0.92);
}

async function requireBox(locator: Locator, label: string): Promise<Box> {
  const box = await locator.boundingBox();
  expect(box, `${label} should have rendered geometry`).not.toBeNull();
  return box!;
}

function productToolbar(page: Page, mode: 'inline' | 'floating') {
  return page.locator(`[role="toolbar"][data-toolbar-mode="${mode}"]`);
}

async function expectToolbarBesideAnchor(toolbar: Locator, anchor: Locator) {
  const [toolbarBox, anchorBox, placement] = await Promise.all([
    requireBox(toolbar, 'Floating product toolbar'),
    requireBox(anchor, 'Selected product canvas element'),
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

test.describe('product appearance toolbar parity contracts', () => {
  test('description typography reports the selected or inherited font size', () => {
    expect(resolveProductDescriptionFontSize('18px', 16)).toBe('18');
    expect(resolveProductDescriptionFontSize('13.5px', 16)).toBe('13.5');
    expect(resolveProductDescriptionFontSize(null, 22)).toBe('22');
    expect(resolveProductDescriptionFontSize(undefined, 0)).toBe('16');
  });

  test('appearance number drafts clamp only the committed numeric value', () => {
    expect(clampAppearanceEditorNumberInput(44, 8, 64)).toBe(44);
    expect(clampAppearanceEditorNumberInput(4, 8, 64)).toBe(8);
    expect(clampAppearanceEditorNumberInput(120, 72, 180)).toBe(120);
    expect(clampAppearanceEditorNumberInput(220, 72, 180)).toBe(180);
  });

  test('source exposes semantic device controls and inline/floating toolbar markers', () => {
    const editorSource = readFileSync(
      resolve(
        process.cwd(),
        'src/admin/features/podoba/components/AdminProductAppearancePageClient.tsx'
      ),
      'utf8'
    );
    const toolbarSource = readFileSync(
      resolve(
        process.cwd(),
        'src/admin/features/podoba/components/ProductAppearanceContextToolbar.tsx'
      ),
      'utf8'
    );
    const toolbarPrimitivesSource = readFileSync(
      resolve(
        process.cwd(),
        'src/admin/features/podoba/components/AppearanceEditorToolbarPrimitives.tsx'
      ),
      'utf8'
    );
    const descriptionEditorSource = readFileSync(
      resolve(
        process.cwd(),
        'src/admin/features/podoba/components/ProductDescriptionRichTextEditor.tsx'
      ),
      'utf8'
    );
    const globalStylesSource = readFileSync(
      resolve(process.cwd(), 'src/shared/styles/globals.css'),
      'utf8'
    );
    const sharedPopoverClassUses = (
      `${editorSource}\n${toolbarSource}`.match(
        /appearanceEditorToolbarPopoverSurfaceClassName/g
      ) ?? []
    ).length;

    expect(editorSource).toContain('aria-label="Stran predogleda"');
    expect(editorSource).toContain('aria-label="Odzivni predogled"');
    expect(editorSource).toContain('data-product-preview-controls');
    expect(editorSource).toContain('<PreviewDeviceIcon');
    expect(editorSource).toContain("page === 'listing'");
    expect(editorSource).toContain('? List');
    expect(editorSource).toContain('? Package');
    expect(editorSource).toContain(': ShoppingCart');
    expect(editorSource).toContain('data-toolbar-mode="inline"');
    expect(editorSource).toContain('data-toolbar-placement="inline"');
    expect(editorSource).toContain('data-toolbar-ready="true"');

    expect(editorSource).toContain('FloatingAppearanceEditorContextToolbar');
    expect(toolbarSource).toContain('AppearanceEditorToolbarToneProvider');
    expect(toolbarPrimitivesSource).toContain("import { createPortal } from 'react-dom'");
    expect(toolbarPrimitivesSource).toContain('data-product-toolbar-anchor-id=');
    expect(toolbarPrimitivesSource).toContain('data-toolbar-mode="floating"');
    expect(toolbarPrimitivesSource).toContain('data-toolbar-placement=');
    expect(toolbarPrimitivesSource).toContain('data-toolbar-ready=');
    expect(toolbarPrimitivesSource).toContain('bg-black/90');
    expect(toolbarPrimitivesSource).toContain(
      'export const appearanceEditorToolbarPopoverSurfaceClassName'
    );
    expect(editorSource).toContain(
      '${appearanceEditorToolbarPopoverSurfaceClassName}'
    );
    expect(toolbarSource).toContain(
      '${appearanceEditorToolbarPopoverSurfaceClassName}'
    );
    expect(
      sharedPopoverClassUses,
      'inline and floating toolbar menus should consume the shared black-glass surface'
    ).toBeGreaterThanOrEqual(5);
    expect(toolbarSource).toContain('data-product-toolbar-dark-controls');
    expect(toolbarSource).toContain(
      "const preferredSide = toolbarPlacement === 'top' ? 'above' : 'below';"
    );
    expect(toolbarSource).toContain(
      'data-product-toolbar-popover-side={panelLayout.side}'
    );
    expect(toolbarSource).toContain(
      'data-testid="product-variant-select-size-controls"'
    );
    expect(toolbarSource).toContain(
      'data-testid="product-variant-chip-size-controls"'
    );
    expect(toolbarSource).toContain(
      'data-testid={`product-variant-chip-${key}`}'
    );
    expect(toolbarSource).toContain(
      'data-testid={`product-variant-select-${key}`}'
    );
    expect(toolbarSource).toContain('onVariantsChange({');
    expect(editorSource).toContain('variants={config.variants}');
    expect(editorSource).toContain(
      "onVariantsChange={(updates) => updateSection('variants', updates)}"
    );
    expect(toolbarSource).toContain('<ProductDescriptionRichTextEditor');
    expect(toolbarSource).not.toMatch(
      /selectedElementId === 'product-description'[\s\S]{0,1800}<textarea/
    );
    expect(descriptionEditorSource).toContain(
      'data-testid="product-description-rich-text-editor"'
    );
    expect(descriptionEditorSource).toContain('StarterKit.configure');
    expect(descriptionEditorSource).toContain('toggleBold');
    expect(descriptionEditorSource).toContain('toggleBulletList');
    expect(descriptionEditorSource).toContain('setTextAlign');
    expect(descriptionEditorSource).toContain("fontSize: `${parsed}px`");
    expect(descriptionEditorSource).toContain(
      "?.getAttributes('textStyle')"
    );
    expect(toolbarSource).toContain(
      'defaultFontSizePx={settings?.fontSizePx ?? 0}'
    );
    expect(globalStylesSource).toMatch(
      /\[data-product-toolbar-dark-controls\]\s*\{[^}]*color-scheme:\s*dark;[^}]*\}/s
    );
    expect(globalStylesSource).toMatch(
      /\[data-product-toolbar-dark-controls\]\s+select\s*\{[^}]*color-scheme:\s*dark;[^}]*background-color:[^}]*color:[^}]*\}/s
    );
    expect(globalStylesSource).toMatch(
      /\[data-product-toolbar-dark-controls\]\s+select\s+option\s*\{[^}]*background-color:[^}]*color:[^}]*\}/s
    );
    expect(globalStylesSource).toMatch(
      /\[data-product-toolbar-dark-controls\]\s+select\s+option:checked\s*\{[^}]*background-color:[^}]*color:[^}]*\}/s
    );
    expect(globalStylesSource).toMatch(
      /\[data-product-toolbar-dark-controls\]\s+select\s+option:disabled\s*\{[^}]*color:[^}]*\}/s
    );
  });

  test.describe('browser behavior', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 1329, height: 920 });
      await page.goto('/admin/podoba/artikli');
      await expect(
        page.getByRole('heading', { level: 1, name: 'Artikli', exact: true })
      ).toBeVisible({ timeout: 15_000 });
    });

    test('uses semantic icon device controls and a light inline toolbar', async ({ page }) => {
      const pageControls = page.getByRole('group', { name: 'Stran predogleda' });
      await expect(pageControls.getByRole('button')).toHaveCount(3);
      await expect(pageControls.getByRole('button', { name: 'Seznam', exact: true })).toBeVisible();
      await expect(pageControls.getByRole('button', { name: 'Artikel', exact: true }))
        .toHaveAttribute('aria-pressed', 'true');
      await expect(pageControls.getByRole('button', { name: 'Košarica', exact: true })).toBeVisible();

      const deviceControls = page.locator('[data-product-preview-controls]');
      await expect(deviceControls).toHaveAttribute('role', 'group');
      await expect(deviceControls).toHaveAttribute('aria-label', 'Odzivni predogled');
      await expect(deviceControls.getByRole('button')).toHaveCount(3);

      for (const label of ['Desktop', 'Tablica', 'Mobilno']) {
        const button = deviceControls.getByRole('button', { name: label, exact: true });
        await expect(button).toBeVisible();
        await expect(button).toHaveAttribute('aria-pressed', label === 'Desktop' ? 'true' : 'false');
        const icon = button.locator('svg');
        await expect(icon).toHaveCount(1);
        await expect(icon).toHaveAttribute('aria-hidden', 'true');
        const [buttonBox, iconBox] = await Promise.all([
          requireBox(button, `${label} button`),
          requireBox(icon, `${label} icon`)
        ]);
        expect(buttonBox.height, `${label} should use the homepage's compact control height`)
          .toBeCloseTo(32, 0);
        expect(iconBox.width, `${label} icon width`).toBeCloseTo(16, 0);
        expect(iconBox.height, `${label} icon height`).toBeCloseTo(16, 0);
      }

      for (const label of ['Seznam', 'Artikel', 'Košarica']) {
        const button = pageControls.getByRole('button', { name: label, exact: true });
        const icon = button.locator('svg');
        await expect(icon).toHaveCount(1);
        await expect(icon).toHaveAttribute('aria-hidden', 'true');
      }

      await deviceControls.getByRole('button', { name: 'Tablica', exact: true }).click();
      await expect(deviceControls.getByRole('button', { name: 'Tablica', exact: true }))
        .toHaveAttribute('aria-pressed', 'true');
      await expect(deviceControls.getByRole('button', { name: 'Desktop', exact: true }))
        .toHaveAttribute('aria-pressed', 'false');

      const inlineToolbar = productToolbar(page, 'inline');
      await expect(inlineToolbar).toHaveCount(1);
      await expect(inlineToolbar).toBeVisible();
      await expect(inlineToolbar).toHaveAttribute('data-toolbar-placement', 'inline');
      await expect(inlineToolbar).toHaveAttribute('data-toolbar-ready', 'true');

      const chrome = await inlineToolbar.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          background: style.backgroundColor,
          borderWidths: [
            style.borderTopWidth,
            style.borderRightWidth,
            style.borderBottomWidth,
            style.borderLeftWidth
          ],
          boxShadow: style.boxShadow,
          position: style.position,
          portalMounted: element.parentElement === document.body
        };
      });
      expect(parseCssColor(chrome.background).alpha, 'inline toolbar should not paint a surface')
        .toBeLessThanOrEqual(0.05);
      expect(chrome.borderWidths, 'inline toolbar should remain borderless')
        .toEqual(['0px', '0px', '0px', '0px']);
      expect(chrome.boxShadow, 'inline toolbar should remain flat').toBe('none');
      expect(['static', 'relative']).toContain(chrome.position);
      expect(chrome.portalMounted, 'inline toolbar should remain in the controls row').toBe(false);

      const [deviceBox, toolbarBox, pageBox, controlsRowRight] = await Promise.all([
        requireBox(deviceControls, 'Product device controls'),
        requireBox(inlineToolbar, 'Inline product toolbar'),
        requireBox(pageControls, 'Product page controls'),
        pageControls.evaluate((element) => (
          element.parentElement?.parentElement?.getBoundingClientRect().right ?? 0
        ))
      ]);
      expect(
        Math.abs(
          (deviceBox.y + deviceBox.height / 2)
          - (toolbarBox.y + toolbarBox.height / 2)
        ),
        'inline toolbar should align vertically with the responsive controls'
      ).toBeLessThanOrEqual(4);
      expect(deviceBox.x + deviceBox.width, 'device controls should precede the toolbar')
        .toBeLessThanOrEqual(toolbarBox.x);
      expect(toolbarBox.x + toolbarBox.width, 'page controls should follow the toolbar')
        .toBeLessThanOrEqual(pageBox.x);
      expect(
        Math.abs(pageBox.x + pageBox.width - controlsRowRight),
        'page controls should align to the far right of the controls row'
      ).toBeLessThanOrEqual(2);
    });

    test('portals black-glass tools beside the selected listing element and reanchors them', async ({ page }) => {
      const pageControls = page.getByRole('group', { name: 'Stran predogleda' });
      await pageControls.getByRole('button', { name: 'Seznam', exact: true }).click();

      const listingHeader = page.locator('[data-product-canvas-element="listing-header"]');
      await expect(listingHeader).toBeVisible();
      await listingHeader.click({ position: { x: 4, y: 4 } });
      await expect(listingHeader).toHaveAttribute('data-product-canvas-selected', 'true');

      const floatingToolbar = productToolbar(page, 'floating');
      await expect(floatingToolbar).toHaveCount(1);
      await expect(floatingToolbar).toBeVisible();
      await expect(floatingToolbar).toHaveAttribute(
        'data-product-toolbar-anchor-id',
        'listing-header'
      );
      await expect(floatingToolbar).toHaveAttribute('data-toolbar-ready', 'true');

      const toolbarChrome = await floatingToolbar.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          background: style.backgroundColor,
          position: style.position,
          portalMounted: element.parentElement === document.body
        };
      });
      expectBlackGlassSurface(
        parseCssColor(toolbarChrome.background),
        'floating product toolbar'
      );
      expect(['absolute', 'fixed']).toContain(toolbarChrome.position);
      expect(toolbarChrome.portalMounted, 'floating toolbar should use the body portal').toBe(true);
      await expectToolbarBesideAnchor(floatingToolbar, listingHeader);

      const previewFrame = page.locator('.admin-product-canvas-surface').first();
      const [toolbarBox, frameBox] = await Promise.all([
        requireBox(floatingToolbar, 'Floating product toolbar'),
        requireBox(previewFrame, 'Product preview frame')
      ]);
      expect(toolbarBox.x, 'toolbar left edge should stay inside the preview')
        .toBeGreaterThanOrEqual(frameBox.x - 2);
      expect(toolbarBox.x + toolbarBox.width, 'toolbar right edge should stay inside the preview')
        .toBeLessThanOrEqual(frameBox.x + frameBox.width + 2);

      const cardTitle = page.locator('[data-product-canvas-element="card-title"]').first();
      await expect(cardTitle).toBeVisible();
      await cardTitle.click();
      await expect(cardTitle).toHaveAttribute('data-product-canvas-selected', 'true');
      await expect(floatingToolbar).toHaveAttribute(
        'data-product-toolbar-anchor-id',
        'card-title'
      );
      await expect(floatingToolbar).toHaveAttribute('data-toolbar-ready', 'true');
      await expectToolbarBesideAnchor(floatingToolbar, cardTitle);
    });

    test('opens the floating inspector away from the selected product element', async ({ page }) => {
      const productTitle = page.locator('[data-product-canvas-element="product-title"]');
      await expect(productTitle).toBeVisible();
      await productTitle.click();

      const floatingToolbar = productToolbar(page, 'floating');
      await expect(floatingToolbar).toBeVisible();
      await expect(floatingToolbar).toHaveAttribute('data-toolbar-ready', 'true');

      await floatingToolbar.getByRole('button', { name: 'Vsebina', exact: true }).click();
      const panel = floatingToolbar.locator('[data-product-toolbar-popover]');
      await expect(panel).toBeVisible();

      const [toolbarPlacement, panelSide, panelBox, titleBox] = await Promise.all([
        floatingToolbar.getAttribute('data-toolbar-placement'),
        panel.getAttribute('data-product-toolbar-popover-side'),
        requireBox(panel, 'Product toolbar inspector'),
        requireBox(productTitle, 'Selected product title')
      ]);
      expect(panelSide).toBe(toolbarPlacement === 'top' ? 'above' : 'below');

      const overlapsSelectedElement = !(
        panelBox.x + panelBox.width <= titleBox.x
        || panelBox.x >= titleBox.x + titleBox.width
        || panelBox.y + panelBox.height <= titleBox.y
        || panelBox.y >= titleBox.y + titleBox.height
      );
      expect(overlapsSelectedElement, 'open inspector should leave its selected element visible')
        .toBe(false);
    });

    test('keeps multi-digit appearance values stable while typing', async ({ page }) => {
      const variants = page.locator('[data-product-canvas-element="product-variants"]');
      await expect(variants).toBeVisible();
      await variants.click();

      const floatingToolbar = productToolbar(page, 'floating');
      await expect(floatingToolbar).toBeVisible();
      await floatingToolbar.getByRole('button', { name: 'Vsebina', exact: true }).click();

      const widthInput = floatingToolbar.getByTestId('product-variant-chip-chipWidthPx');
      await expect(widthInput).toBeVisible();
      await widthInput.press('Control+A');
      await widthInput.press('1');
      await expect(widthInput).toHaveValue('1');
      await widthInput.press('2');
      await expect(widthInput).toHaveValue('12');
      await widthInput.press('0');
      await expect(widthInput).toHaveValue('120');
      await widthInput.press('Enter');
      await expect(widthInput).toHaveValue('120');
    });

  });
});
