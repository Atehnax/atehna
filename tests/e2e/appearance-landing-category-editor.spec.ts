import { expect, test } from '@playwright/test';
import {
  getAppearanceEditorCompactSelect,
  readAppearanceEditorCompactSelectOptions
} from './support/appearance-editor-compact-select';

function hexToRgbCss(color: string) {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(color.trim());
  if (!match) throw new Error(`Expected a six-digit HEX colour, received ${color}.`);
  return `rgb(${Number.parseInt(match[1], 16)}, ${Number.parseInt(match[2], 16)}, ${Number.parseInt(match[3], 16)})`;
}

test.describe('admin podoba redesign', () => {
  test('landing editor is preview-focused and updates the toolbar for a selected hero element', async ({ page }) => {
    await page.goto('/admin/podoba/glavna-stran');

    const toolbar = page.getByTestId('homepage-context-toolbar');
    await expect(toolbar).toBeVisible({ timeout: 15_000 });

    await expect(page.getByRole('tab', { name: 'Sekcije', exact: true })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Nastavitve strani', exact: true })).toHaveCount(0);

    await expect(toolbar.getByRole('button', { name: 'Dodaj besedilo, gumb ali sekcijo' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Podvoji', exact: true })).toHaveCount(0);

    const categoriesSection = page.locator('[data-homepage-section="categories"]');
    const categoryImages = categoriesSection.locator('[data-homepage-category-image]');
    await expect(categoriesSection).toBeVisible();
    await expect(categoryImages.first()).toHaveCSS('filter', 'none');
    await expect(categoryImages.nth(1)).toHaveCSS('filter', 'none');

    const categoriesSectionBox = await categoriesSection.boundingBox();
    expect(categoriesSectionBox).not.toBeNull();
    await categoriesSection.click({ position: { x: (categoriesSectionBox?.width ?? 4) - 2, y: 2 } });
    await page.mouse.move(0, 0);
    await expect(categoriesSection).toHaveAttribute('data-admin-editor-selection-frame', 'true');
    for (const image of await categoryImages.all()) {
      await expect(image).toHaveCSS('filter', 'none');
    }
    const sectionOutline = await categoriesSection.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        outlineOffset: style.outlineOffset,
        radii: [
          style.borderTopLeftRadius,
          style.borderTopRightRadius,
          style.borderBottomRightRadius,
          style.borderBottomLeftRadius
        ]
      };
    });
    expect(sectionOutline.outlineStyle).toBe('solid');
    expect(sectionOutline.outlineWidth).toBe('2px');
    expect(sectionOutline.outlineOffset).toBe('-2px');
    expect(new Set(sectionOutline.radii).size).toBe(1);
    expect(parseFloat(sectionOutline.radii[0] ?? '0')).toBeGreaterThan(0);

    const firstCategoryCard = categoriesSection.locator('[data-homepage-category-card]').first();
    const firstCategoryImageCanvas = firstCategoryCard.locator(
      '[data-homepage-canvas-element][data-canvas-element-id^="categories:image:"]'
    );
    await firstCategoryImageCanvas.click();
    const categoryActionStack = firstCategoryCard.getByTestId('homepage-category-action-stack');
    const categoryActions = categoryActionStack.locator('button[data-canvas-action][aria-label]');
    await expect(categoryActions).toHaveCount(6);
    await expect(categoryActions.nth(0)).toHaveAttribute('aria-label', /^Odstrani sliko/);
    await expect(categoryActions.nth(1)).toHaveAttribute('aria-label', /^Dodaj ali zamenjaj sliko/);
    await expect(categoryActions.nth(2)).toHaveAttribute('aria-label', /^Uredi videz kategorije/);
    await expect(categoryActions.nth(3)).toHaveAttribute('aria-label', /^Uredi slog kategorije/);
    await expect(categoryActions.nth(4)).toHaveAttribute('aria-label', /^Skrij kategorijo/);
    await expect(categoryActions.nth(5)).toHaveAttribute('aria-label', /^Premakni kategorijo/);
    const categoryActionRail = await categoryActions.evaluateAll((actions) => {
      const stack = actions[0]?.parentElement as HTMLElement;
      const tile = actions[0]?.closest('[data-testid="category-showcase-tile"]') as HTMLElement;
      const tileRect = tile.getBoundingClientRect();
      const buttonRects = actions.map((action) => action.getBoundingClientRect());
      return {
        direction: getComputedStyle(stack).flexDirection,
        gap: getComputedStyle(stack).gap,
        outsideMedia: actions[0]?.closest('[data-testid="category-showcase-media"]') === null,
        xPositions: buttonRects.map((rect) => Math.round(rect.x * 10) / 10),
        yPositions: buttonRects.map((rect) => rect.y),
        topInset: buttonRects[0].top - tileRect.top,
        rightInset: tileRect.right - Math.max(...buttonRects.map((rect) => rect.right)),
        bottomInset: tileRect.bottom - buttonRects.at(-1)!.bottom
      };
    });
    expect(categoryActionRail.direction).toBe('column');
    expect(categoryActionRail.gap).toBe('3px');
    expect(categoryActionRail.outsideMedia).toBe(true);
    expect(new Set(categoryActionRail.xPositions).size).toBe(1);
    expect(categoryActionRail.yPositions).toEqual([...categoryActionRail.yPositions].sort((first, second) => first - second));
    expect(Math.abs(categoryActionRail.topInset - categoryActionRail.bottomInset)).toBeLessThanOrEqual(1);
    expect(categoryActionRail.topInset).toBeGreaterThanOrEqual(10);
    expect(categoryActionRail.bottomInset).toBeGreaterThanOrEqual(10);
    expect(categoryActionRail.rightInset).toBeGreaterThanOrEqual(8);

    const firstCategoryTitle = categoriesSection.locator('[data-canvas-element-id^="categories:title:"]').first();
    await expect(firstCategoryTitle.locator('h3')).not.toHaveAttribute('contenteditable', 'true');
    await categoryActions.nth(3).click();
    await expect(toolbar.getByRole('button', { name: 'Slog besedila', exact: true })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Podvoji', exact: true })).toBeDisabled();

    const heroTitle = page.locator(
      '[data-homepage-canvas-element][data-canvas-element-id="hero:title"]'
    );
    await expect(heroTitle).toBeVisible();
    await heroTitle.click();

    await expect(toolbar.getByRole('button', { name: 'Podvoji', exact: true })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Slog besedila', exact: true })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Skrij', exact: true })).toBeVisible();

    await toolbar.getByRole('button', { name: 'Slog besedila', exact: true }).click();
    const fontSelect = getAppearanceEditorCompactSelect(page, 'Pisava');
    await expect(fontSelect).toBeVisible();
    await expect.poll(() => readAppearanceEditorCompactSelectOptions(page, fontSelect)).toEqual(
      expect.arrayContaining(['IBM Plex Sans', 'Source Sans 3', 'Space Grotesk'])
    );
    await expect(categoryImages.first()).toHaveCSS('filter', 'none');
  });

  test('grid, rulers and guides follow the selected homepage section', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    let saveRequests = 0;
    page.on('request', (request) => {
      if (
        request.method() !== 'GET'
        && ['/api/admin/landing-page', '/api/admin/site-navigation'].some((path) => request.url().endsWith(path))
      ) {
        saveRequests += 1;
      }
    });
    await page.goto('/admin/podoba/glavna-stran');

    const stage = page.getByTestId('homepage-preview-stage');
    const toolbar = page.getByTestId('homepage-context-toolbar');
    const categoriesSection = page.locator('[data-homepage-section="categories"]');
    const heroSection = page.locator('[data-homepage-section="hero"]');
    await expect(stage).toHaveAttribute('data-preview-ready', 'true', { timeout: 15_000 });
    await expect(categoriesSection).toBeVisible();

    const categoriesBoxBefore = await categoriesSection.boundingBox();
    expect(categoriesBoxBefore).not.toBeNull();
    await categoriesSection.click({ position: { x: (categoriesBoxBefore?.width ?? 4) - 2, y: 2 } });
    await expect(stage).toHaveAttribute('data-selected-section-id', 'categories');

    await toolbar.getByRole('button', { name: 'Mreža, pripenjanje in vodila' }).click();
    const categoriesDialog = page.getByRole('dialog', { name: 'Mreža in vodila · Kategorije · Desktop' });
    await expect(categoriesDialog).toBeVisible();
    await categoriesDialog.locator('label').filter({ hasText: 'Mreža' }).click();
    await categoriesDialog.locator('label').filter({ hasText: 'Ravnila' }).click();

    const grids = page.locator('[data-homepage-editor-aid="grid"]');
    const rulers = page.locator('[data-homepage-editor-aid="rulers"]');
    await expect(grids).toHaveCount(1);
    await expect(rulers).toHaveCount(1);
    await expect(categoriesSection.locator('[data-homepage-editor-aid="grid"]')).toHaveCount(1);
    await expect(categoriesSection.locator('[data-homepage-editor-aid="rulers"]')).toHaveCount(1);
    await expect(heroSection.locator('[data-homepage-editor-aid="grid"]')).toHaveCount(0);
    await expect(grids).toHaveAttribute('data-editor-section', 'categories');
    await expect(grids).toHaveCSS('pointer-events', 'none');
    await expect(grids).toHaveCSS('position', 'absolute');

    const categoriesBoxAfter = await categoriesSection.boundingBox();
    expect(categoriesBoxAfter).not.toBeNull();
    expect(Math.abs((categoriesBoxAfter?.width ?? 0) - (categoriesBoxBefore?.width ?? 0))).toBeLessThanOrEqual(0.5);
    expect(Math.abs((categoriesBoxAfter?.height ?? 0) - (categoriesBoxBefore?.height ?? 0))).toBeLessThanOrEqual(0.5);

    const firstCategoryTitle = categoriesSection.locator('[data-canvas-element-id^="categories:title:"]').first();
    await firstCategoryTitle.click();
    await expect(stage).toHaveAttribute('data-selected-section-id', 'categories');
    await expect(categoriesSection.locator('[data-homepage-editor-aid="grid"]')).toHaveCount(1);
    await expect(categoriesSection.locator('[data-homepage-editor-aid="guides"]')).toHaveCount(1);
    await expect(categoriesSection.locator('[data-homepage-editor-aid="measurements"]')).toHaveCount(1);

    const heroTitle = heroSection.locator('[data-canvas-element-id="hero:title"]');
    await heroTitle.click();
    await expect(stage).toHaveAttribute('data-selected-section-id', 'hero');
    await expect(grids).toHaveCount(1);
    await expect(heroSection.locator('[data-homepage-editor-aid="grid"]')).toHaveCount(1);
    await expect(heroSection.locator('[data-homepage-editor-aid="rulers"]')).toHaveCount(1);
    await expect(categoriesSection.locator('[data-homepage-editor-aid="grid"]')).toHaveCount(0);
    await expect(categoriesSection.locator('[data-homepage-editor-aid="rulers"]')).toHaveCount(0);

    await toolbar.getByRole('button', { name: 'Mreža, pripenjanje in vodila' }).click();
    await expect(page.getByRole('dialog', { name: 'Mreža in vodila · Hero · Desktop' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Shrani spremembe' })).toBeDisabled();
    expect(saveRequests).toBe(0);

    await page.goto('/');
    await expect(page.locator('[data-homepage-editor-aid]')).toHaveCount(0);
  });

  test('category title edit scope keeps canonical labels read-only and responsive overrides independent', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('/admin/podoba/glavna-stran');

    const stage = page.getByTestId('homepage-preview-stage');
    const toolbar = page.getByTestId('homepage-context-toolbar');
    const categoryTitles = page.locator(
      '[data-homepage-canvas-element][data-canvas-element-id^="categories:title:"]'
    );
    await expect(stage).toHaveAttribute('data-preview-ready', 'true', { timeout: 15_000 });
    await expect(categoryTitles.first()).toBeVisible({ timeout: 15_000 });

    const titleIdentity = await categoryTitles.evaluateAll((elements) => elements.map((element) => {
      const id = element.getAttribute('data-canvas-element-id') ?? '';
      return {
        id,
        slug: id.slice('categories:title:'.length),
        labelSlug: element.getAttribute('data-homepage-category-label') ?? '',
        text: element.querySelector('h3')?.textContent?.trim() ?? ''
      };
    }));
    expect(titleIdentity.length).toBeGreaterThan(1);
    expect(new Set(titleIdentity.map(({ id }) => id)).size).toBe(titleIdentity.length);
    for (const title of titleIdentity) {
      expect(title.id).toBe(`categories:title:${title.slug}`);
      expect(title.slug).not.toBe('');
      expect(title.labelSlug).toBe(title.slug);
      expect(title.text).not.toBe('');
    }

    const firstTitle = page.locator(
      `[data-homepage-canvas-element][data-canvas-element-id="${titleIdentity[0].id}"]`
    );
    const canonicalTitle = titleIdentity[0].text;
    await firstTitle.click();
    await firstTitle.locator('h3').dblclick();
    await expect(firstTitle.locator('h3')).not.toHaveAttribute('contenteditable', 'true');
    await expect(firstTitle.locator('[contenteditable="true"]')).toHaveCount(0);
    await expect(firstTitle.locator('h3')).toHaveText(canonicalTitle);

    const readMetrics = () => categoryTitles.evaluateAll((elements) => elements.map((element) => {
      const wrapperStyle = getComputedStyle(element);
      const label = element.querySelector('h3') ?? element;
      const labelStyle = getComputedStyle(label);
      const matrix = wrapperStyle.transform === 'none'
        ? new DOMMatrixReadOnly()
        : new DOMMatrixReadOnly(wrapperStyle.transform);
      return {
        id: element.getAttribute('data-canvas-element-id') ?? '',
        fontSize: Math.round(Number.parseFloat(labelStyle.fontSize) * 100) / 100,
        x: Math.round(matrix.m41 * 100) / 100
      };
    }));
    const expectMetrics = async (fontSizes: number[], xPositions?: number[]) => {
      await expect.poll(async () => (await readMetrics()).map(({ fontSize }) => fontSize)).toEqual(fontSizes);
      if (xPositions) {
        await expect.poll(async () => (await readMetrics()).map(({ x }) => x)).toEqual(xPositions);
      }
    };

    const titleCount = titleIdentity.length;
    const desktopAllFontSize = 22;
    const desktopSelectedFontSize = 29;
    const desktopAllX = 11;
    const desktopSelectedX = 27;
    const tabletSelectedFontSize = 18;
    const tabletSelectedX = -13;

    await toolbar.getByRole('button', { name: 'Slog besedila', exact: true }).click();
    let dialog = page.getByRole('dialog');
    await dialog.getByTestId('homepage-category-title-scope-all').click();
    await dialog.getByRole('spinbutton', { name: 'Velikost px', exact: true }).fill(String(desktopAllFontSize));
    await expectMetrics(Array(titleCount).fill(desktopAllFontSize));
    await dialog.getByRole('button', { name: 'Zapri', exact: true }).click();

    await toolbar.getByRole('button', { name: 'Mere in poravnava', exact: true }).click();
    dialog = page.getByRole('dialog');
    await dialog.getByTestId('homepage-category-title-scope-all').click();
    await dialog.getByRole('spinbutton', { name: 'X px', exact: true }).fill(String(desktopAllX));
    await expectMetrics(
      Array(titleCount).fill(desktopAllFontSize),
      Array(titleCount).fill(desktopAllX)
    );
    await dialog.getByRole('button', { name: 'Zapri', exact: true }).click();

    await toolbar.getByRole('button', { name: 'Slog besedila', exact: true }).click();
    dialog = page.getByRole('dialog');
    await dialog.getByTestId('homepage-category-title-scope-selected').click();
    await dialog.getByRole('spinbutton', { name: 'Velikost px', exact: true }).fill(String(desktopSelectedFontSize));
    await expectMetrics([
      desktopSelectedFontSize,
      ...Array(titleCount - 1).fill(desktopAllFontSize)
    ]);
    await dialog.getByRole('button', { name: 'Zapri', exact: true }).click();

    await toolbar.getByRole('button', { name: 'Mere in poravnava', exact: true }).click();
    dialog = page.getByRole('dialog');
    await dialog.getByTestId('homepage-category-title-scope-selected').click();
    await dialog.getByRole('spinbutton', { name: 'X px', exact: true }).fill(String(desktopSelectedX));
    await expectMetrics(
      [desktopSelectedFontSize, ...Array(titleCount - 1).fill(desktopAllFontSize)],
      [desktopSelectedX, ...Array(titleCount - 1).fill(desktopAllX)]
    );
    await dialog.getByRole('button', { name: 'Zapri', exact: true }).click();

    await page.getByRole('button', { name: 'Tablica', exact: true }).click();
    await expect(stage).toHaveAttribute('data-preview-target-device', 'tablet');
    await expect(stage).toHaveAttribute('data-preview-transitioning', 'false', { timeout: 2_000 });
    await expect(toolbar.getByText(canonicalTitle, { exact: true })).toBeVisible();
    const tabletBaseline = await readMetrics();

    await toolbar.getByRole('button', { name: 'Slog besedila', exact: true }).click();
    dialog = page.getByRole('dialog');
    await dialog.getByTestId('homepage-category-title-scope-selected').click();
    await dialog.getByRole('spinbutton', { name: 'Velikost px', exact: true }).fill(String(tabletSelectedFontSize));
    await dialog.getByRole('button', { name: 'Zapri', exact: true }).click();
    await toolbar.getByRole('button', { name: 'Mere in poravnava', exact: true }).click();
    dialog = page.getByRole('dialog');
    await dialog.getByTestId('homepage-category-title-scope-selected').click();
    await dialog.getByRole('spinbutton', { name: 'X px', exact: true }).fill(String(tabletSelectedX));
    await expectMetrics(
      [tabletSelectedFontSize, ...tabletBaseline.slice(1).map(({ fontSize }) => fontSize)],
      [tabletSelectedX, ...tabletBaseline.slice(1).map(({ x }) => x)]
    );
    await dialog.getByRole('button', { name: 'Zapri', exact: true }).click();

    await page.getByRole('button', { name: 'Desktop', exact: true }).click();
    await expect(stage).toHaveAttribute('data-preview-target-device', 'desktop');
    await expect(stage).toHaveAttribute('data-preview-transitioning', 'false', { timeout: 2_000 });
    await expectMetrics(
      [desktopSelectedFontSize, ...Array(titleCount - 1).fill(desktopAllFontSize)],
      [desktopSelectedX, ...Array(titleCount - 1).fill(desktopAllX)]
    );
    await expect(firstTitle.locator('h3')).toHaveText(canonicalTitle);

    const groupHeading = page.locator(
      '[data-homepage-canvas-element][data-canvas-element-id="categories:heading"]'
    );
    const readGroupHeadingX = () => groupHeading.evaluate((element) => {
      const transform = getComputedStyle(element).transform;
      return Math.round((transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m41) * 100) / 100;
    });
    await expect(groupHeading).toBeVisible();
    await groupHeading.click();
    await toolbar.getByRole('button', { name: 'Mere in poravnava', exact: true }).click();
    dialog = page.getByRole('dialog');
    await dialog.getByRole('spinbutton', { name: 'X px', exact: true }).fill('17');
    await expect.poll(readGroupHeadingX).toBe(17);
    await dialog.getByRole('button', { name: 'Zapri', exact: true }).click();

    await page.getByRole('button', { name: 'Tablica', exact: true }).click();
    await expect(stage).toHaveAttribute('data-preview-transitioning', 'false', { timeout: 2_000 });
    await groupHeading.click();
    await toolbar.getByRole('button', { name: 'Mere in poravnava', exact: true }).click();
    dialog = page.getByRole('dialog');
    await dialog.getByRole('spinbutton', { name: 'X px', exact: true }).fill('-9');
    await expect.poll(readGroupHeadingX).toBe(-9);
    await dialog.getByRole('button', { name: 'Zapri', exact: true }).click();

    await page.getByRole('button', { name: 'Desktop', exact: true }).click();
    await expect(stage).toHaveAttribute('data-preview-transitioning', 'false', { timeout: 2_000 });
    await expect.poll(readGroupHeadingX).toBe(17);
  });

  test('footer logo and description are independent responsive canvas elements', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('/admin/podoba/glavna-stran');

    const toolbar = page.getByTestId('homepage-context-toolbar');
    const logo = page.locator('[data-canvas-element-id="footer:logo"]');
    const description = page.locator('[data-canvas-element-id="footer:description"]');
    await expect(page.getByTestId('homepage-preview-stage')).toHaveAttribute('data-preview-ready', 'true', { timeout: 15_000 });
    await page.getByTestId('homepage-preview-scroll-region').evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect(logo).toBeVisible({ timeout: 15_000 });
    await expect(description).toBeVisible();
    await expect(logo).toHaveCount(1);
    await expect(description).toHaveCount(1);

    await description.click();
    await expect(toolbar.getByText('Opis noge', { exact: true })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Podvoji', exact: true })).toBeDisabled();
    await toolbar.getByRole('button', { name: 'Slog besedila', exact: true }).click();
    await page.getByRole('button', { name: 'Ležeče', exact: true }).click();
    await page.getByRole('button', { name: 'Podčrtano', exact: true }).click();
    await expect(description.locator('p')).toHaveCSS('font-style', 'italic');
    await expect(description).toHaveCSS('text-decoration-line', 'underline');
    await expect(page.getByRole('spinbutton', { name: 'Višina vrstice', exact: true })).toBeVisible();
    await expect(page.getByRole('spinbutton', { name: 'Razmik črk px', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Zapri', exact: true }).click();
    await toolbar.getByRole('button', { name: 'Mere in poravnava', exact: true }).click();
    await expect(page.getByRole('spinbutton', { name: 'X px', exact: true })).toBeVisible();
    await expect(page.getByRole('spinbutton', { name: 'Y px', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Zapri', exact: true }).click();
    await logo.click();
    await expect(toolbar.getByText('Logotip noge', { exact: true })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Slog besedila', exact: true })).toHaveCount(0);
    await expect(toolbar.getByRole('button', { name: 'Podvoji', exact: true })).toBeDisabled();
    await toolbar.getByRole('button', { name: 'Mere in poravnava', exact: true }).click();
    await page.getByRole('spinbutton', { name: 'Višina px', exact: true }).fill('56');

    const resizedLogo = await logo.evaluate((element) => {
      return {
        elementHeight: (element as HTMLElement).offsetHeight,
        logoSurfaceHeight: element.querySelector<HTMLElement>(
          '[data-site-logo-purpose], [data-site-logo-fallback="shared"]'
        )?.getBoundingClientRect().height ?? 0,
        elementRenderedHeight: element.getBoundingClientRect().height
      };
    });
    expect(resizedLogo.elementHeight).toBe(56);
    expect(resizedLogo.logoSurfaceHeight).toBeGreaterThan(0);
    expect(Math.abs(resizedLogo.logoSurfaceHeight - resizedLogo.elementRenderedHeight)).toBeLessThan(1.5);

    await page.getByRole('button', { name: 'Zapri', exact: true }).click();
    const logoTransformBeforeDrag = await logo.evaluate((element) => getComputedStyle(element).transform);
    const logoBox = await logo.boundingBox();
    expect(logoBox).not.toBeNull();
    await page.mouse.move(logoBox!.x + logoBox!.width / 2, logoBox!.y + logoBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(logoBox!.x + logoBox!.width / 2 + 24, logoBox!.y + logoBox!.height / 2 + 16);
    await page.mouse.up();
    await expect.poll(() => logo.evaluate((element) => getComputedStyle(element).transform)).not.toBe(logoTransformBeforeDrag);

    await page.getByRole('button', { name: 'Tablica', exact: true }).click();
    await expect(page.getByTestId('homepage-preview-stage')).toHaveAttribute('data-preview-transitioning', 'false', { timeout: 2_000 });
    expect(await logo.evaluate((element) => (element as HTMLElement).offsetHeight)).not.toBe(56);
  });

  test('inline footer description edits save through the canonical navigation footer patch', async ({ page }) => {
    let navigationPatch: { footer: { description: string } } | undefined;
    let landingSaveCount = 0;

    await page.route('**/api/admin/site-navigation', async (route) => {
      if (route.request().method() !== 'PATCH') {
        await route.continue();
        return;
      }
      navigationPatch = route.request().postDataJSON() as { footer: { description: string } };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ config: { footer: navigationPatch.footer } })
      });
    });
    await page.route('**/api/admin/landing-page', async (route) => {
      if (route.request().method() !== 'PUT') {
        await route.continue();
        return;
      }
      landingSaveCount += 1;
      const requestBody = route.request().postDataJSON() as { config: Record<string, unknown> };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ config: requestBody.config })
      });
    });

    await page.goto('/admin/podoba/glavna-stran');
    const description = page.locator('[data-canvas-element-id="footer:description"]');
    const editableText = description.locator('p');
    const nextDescription = 'Posodobljen opis podjetja za vse javne strani.';
    await expect(page.getByTestId('homepage-preview-stage')).toHaveAttribute('data-preview-ready', 'true', { timeout: 15_000 });
    await page.getByTestId('homepage-preview-scroll-region').evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await description.click();
    await expect(editableText).toHaveAttribute('contenteditable', 'true');
    await editableText.fill(nextDescription);
    await page.getByTestId('homepage-page-toolbar-add').click();

    const saveButton = page.getByRole('button', { name: 'Shrani spremembe', exact: true });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();
    await expect.poll(() => navigationPatch?.footer.description).toBe(nextDescription);
    expect(landingSaveCount).toBe(0);
    await expect(page.getByText('Objavljeno', { exact: true })).toBeVisible();
    await expect(saveButton).toBeDisabled();
  });

  test('public category showcase stays coloured and animates only the editorial object', async ({ page }) => {
    await page.goto('/');

    const categoryCards = page.locator('[data-homepage-category-card]');
    const categoryImages = page.locator('[data-homepage-category-image]');
    await expect(categoryCards.first()).toBeVisible({ timeout: 15_000 });
    await expect(categoryCards).toHaveCount(8);
    await expect(categoryImages.first()).toHaveCSS('filter', 'none');
    await expect(categoryImages.nth(1)).toHaveCSS('filter', 'none');

    const firstFourBoxes = await Promise.all(
      [0, 1, 2, 3].map((index) => categoryCards.nth(index).boundingBox())
    );
    const fifthBox = await categoryCards.nth(4).boundingBox();
    firstFourBoxes.forEach((box) => expect(box).not.toBeNull());
    expect(fifthBox).not.toBeNull();
    expect(Math.max(...firstFourBoxes.map((box) => box?.y ?? 0)) - Math.min(...firstFourBoxes.map((box) => box?.y ?? 0))).toBeLessThanOrEqual(1);
    expect(Math.abs((fifthBox?.x ?? 0) - (firstFourBoxes[0]?.x ?? 0))).toBeLessThanOrEqual(1);
    expect((fifthBox?.y ?? 0)).toBeGreaterThan((firstFourBoxes[0]?.y ?? 0) + (firstFourBoxes[0]?.height ?? 0));

    const firstCard = categoryCards.first();
    const firstCardBoxBeforeHover = await firstCard.boundingBox();
    const firstCardBackgroundBeforeHover = await firstCard.evaluate(
      (element) => getComputedStyle(element).backgroundColor
    );
    const mediaMotionLayer = firstCard.locator('[data-testid="category-showcase-media"] > div');
    const mediaSurface = firstCard.locator('[data-testid="category-showcase-media"]');
    const presentationSurface = firstCard.locator('[data-category-showcase-presentation]');
    const categoryTitle = firstCard.locator('[data-testid="category-showcase-title"] h3');
    const categoryOrdinal = firstCard.locator('[data-category-showcase-ordinal-number]');
    const categoryColorTokens = await firstCard.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        surface: style.getPropertyValue('--category-showcase-surface').trim(),
        hoverSurface: style.getPropertyValue('--category-showcase-hover-surface').trim(),
        title: style.getPropertyValue('--category-showcase-title').trim(),
        titleHover: style.getPropertyValue('--category-showcase-title-hover').trim(),
        ordinal: style.getPropertyValue('--category-showcase-ordinal').trim(),
        ordinalHover: style.getPropertyValue('--category-showcase-ordinal-hover').trim()
      };
    });
    await expect(firstCard).toHaveCSS('background-color', hexToRgbCss(categoryColorTokens.surface));
    await expect(mediaSurface).toHaveCSS('background-color', hexToRgbCss(categoryColorTokens.surface));
    await expect(presentationSurface).toHaveCSS('background-color', hexToRgbCss(categoryColorTokens.surface));
    await expect(categoryTitle).toHaveCSS('color', hexToRgbCss(categoryColorTokens.title));
    await expect(categoryOrdinal).toHaveCSS('color', hexToRgbCss(categoryColorTokens.ordinal));
    const mediaTransformBeforeHover = await mediaMotionLayer.evaluate(
      (element) => getComputedStyle(element).transform
    );
    const rule = firstCard.locator(':scope > div:nth-child(2) > span[aria-hidden="true"]').nth(1);
    const ruleWidthBeforeHover = await rule.evaluate((element) => element.getBoundingClientRect().width);

    await firstCard.hover();
    await expect.poll(() => mediaMotionLayer.evaluate(
      (element) => getComputedStyle(element).transform
    )).not.toBe(mediaTransformBeforeHover);
    await expect.poll(() => firstCard.evaluate(
      (element) => getComputedStyle(element).backgroundColor
    )).toBe(hexToRgbCss(categoryColorTokens.hoverSurface));
    await expect(mediaSurface).toHaveCSS('background-color', hexToRgbCss(categoryColorTokens.hoverSurface));
    await expect(presentationSurface).toHaveCSS('background-color', hexToRgbCss(categoryColorTokens.hoverSurface));
    await expect(categoryTitle).toHaveCSS('color', hexToRgbCss(categoryColorTokens.titleHover));
    await expect(categoryOrdinal).toHaveCSS('color', hexToRgbCss(categoryColorTokens.ordinalHover));
    expect(hexToRgbCss(categoryColorTokens.hoverSurface)).not.toBe(firstCardBackgroundBeforeHover);
    await expect.poll(() => rule.evaluate(
      (element) => element.getBoundingClientRect().width
    )).toBeGreaterThan(ruleWidthBeforeHover);
    await expect(categoryImages.first()).toHaveCSS('filter', 'none');
    await expect(categoryImages.nth(1)).toHaveCSS('filter', 'none');

    const firstCardBoxAfterHover = await firstCard.boundingBox();
    expect(firstCardBoxBeforeHover).not.toBeNull();
    expect(firstCardBoxAfterHover).not.toBeNull();
    expect(Math.abs((firstCardBoxAfterHover?.x ?? 0) - (firstCardBoxBeforeHover?.x ?? 0))).toBeLessThanOrEqual(0.5);
    expect(Math.abs((firstCardBoxAfterHover?.y ?? 0) - (firstCardBoxBeforeHover?.y ?? 0))).toBeLessThanOrEqual(0.5);
    expect(Math.abs((firstCardBoxAfterHover?.width ?? 0) - (firstCardBoxBeforeHover?.width ?? 0))).toBeLessThanOrEqual(0.5);
    expect(Math.abs((firstCardBoxAfterHover?.height ?? 0) - (firstCardBoxBeforeHover?.height ?? 0))).toBeLessThanOrEqual(0.5);

    await page.mouse.move(0, 0);
    await expect.poll(() => mediaMotionLayer.evaluate(
      (element) => getComputedStyle(element).transform
    )).toBe(mediaTransformBeforeHover);
    await expect(firstCard).toHaveCSS('background-color', hexToRgbCss(categoryColorTokens.surface));
    await expect(mediaSurface).toHaveCSS('background-color', hexToRgbCss(categoryColorTokens.surface));
    await expect(presentationSurface).toHaveCSS('background-color', hexToRgbCss(categoryColorTokens.surface));
    await expect(categoryTitle).toHaveCSS('color', hexToRgbCss(categoryColorTokens.title));
    await expect(categoryOrdinal).toHaveCSS('color', hexToRgbCss(categoryColorTokens.ordinal));
    await expect(categoryImages.first()).toHaveCSS('filter', 'none');

    await page.setViewportSize({ width: 900, height: 1000 });
    const tabletBoxes = await Promise.all(
      [0, 1, 2].map((index) => categoryCards.nth(index).boundingBox())
    );
    tabletBoxes.forEach((box) => expect(box).not.toBeNull());
    expect(Math.abs((tabletBoxes[0]?.y ?? 0) - (tabletBoxes[1]?.y ?? 0))).toBeLessThanOrEqual(1);
    expect((tabletBoxes[2]?.y ?? 0)).toBeGreaterThan((tabletBoxes[0]?.y ?? 0) + (tabletBoxes[0]?.height ?? 0));

    await page.setViewportSize({ width: 430, height: 1000 });
    await expect.poll(async () => {
      const [firstBox, secondBox] = await Promise.all([
        categoryCards.first().boundingBox(),
        categoryCards.nth(1).boundingBox()
      ]);
      return Boolean(
        firstBox
        && secondBox
        && secondBox.y > firstBox.y + firstBox.height
      );
    }, {
      message: 'the mobile category showcase should finish reflowing to one column'
    }).toBe(true);
    const mobileFirstBox = await categoryCards.first().boundingBox();
    const mobileSecondBox = await categoryCards.nth(1).boundingBox();
    expect(mobileFirstBox).not.toBeNull();
    expect(mobileSecondBox).not.toBeNull();
    expect(Math.abs((mobileFirstBox?.x ?? 0) - (mobileSecondBox?.x ?? 0))).toBeLessThanOrEqual(1);
    expect((mobileSecondBox?.y ?? 0)).toBeGreaterThan((mobileFirstBox?.y ?? 0) + (mobileFirstBox?.height ?? 0));
  });

  test('public category showcase has a visible focus state and respects reduced motion', async ({ page }) => {
    await page.goto('/');

    const firstCard = page.locator('[data-homepage-category-card]').first();
    const firstCardLink = firstCard.getByRole('link');
    await expect(firstCardLink).toBeVisible({ timeout: 15_000 });
    await firstCardLink.focus();
    await expect(firstCardLink).toBeFocused();
    await expect.poll(() => firstCardLink.evaluate(
      (element) => getComputedStyle(element).boxShadow
    )).not.toBe('none');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    const reducedMotionCard = page.locator('[data-homepage-category-card]').first();
    const reducedMotionLayer = reducedMotionCard.locator('[data-testid="category-showcase-media"] > div');
    await expect(reducedMotionCard).toBeVisible({ timeout: 15_000 });
    await reducedMotionCard.hover();
    await expect(reducedMotionLayer).toHaveCSS('transform', 'none');
    await expect(reducedMotionLayer).toHaveCSS('transition-property', 'none');
  });

  test('both category editors expose the shared media controls and persist the same presentation shape', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    type CategoryPresentationPatch = {
      updates: Array<{
        categoryId?: string;
        categorySlug: string;
        image?: string | null;
        presentation: {
          titleColor: string;
          titleHoverColor: string;
          backgroundColor: string;
          backgroundHoverColor: string;
          crop: { x: number; y: number; width: number; height: number };
          fit: string;
          focalPoint: { x: number; y: number };
          offsetOriginX: number;
          offsetOriginY: number;
          offsetX: number;
          offsetY: number;
          scale: number;
          ordinalFontSizePx: number;
          ordinalColor: string;
          ordinalHoverColor: string;
        };
      }>;
    };

    const presentationPatches: CategoryPresentationPatch[] = [];
    const categorySettingsWrites: string[] = [];
    const unscopedCategoryReads: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      const method = request.method();
      if (['PATCH', 'POST', 'PUT', 'DELETE'].includes(method)) {
        categorySettingsWrites.push(`${method} ${url.pathname}`);
      }
      if (method === 'GET' && url.pathname === '/api/admin/categories' && !url.search) {
        unscopedCategoryReads.push(request.url());
      }
    });
    await page.route('**/api/admin/categories/images', async (route) => {
      if (route.request().method() !== 'PATCH') {
        await route.continue();
        return;
      }

      const payload = route.request().postDataJSON() as CategoryPresentationPatch;
      presentationPatches.push(payload);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, updates: payload.updates })
      });
    });
    await page.route('**/api/admin/categories', async (route) => {
      if (route.request().method() !== 'PATCH') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true })
      });
    });

    await page.goto('/admin/podoba/glavna-stran');
    const homepageToolbar = page.getByTestId('homepage-context-toolbar');
    const homepageCategoryImage = page.locator(
      '[data-homepage-canvas-element][data-canvas-element-id^="categories:image:"]'
    ).first();
    await expect(homepageCategoryImage).toHaveCount(1);
    const homepageCategoryElementId = await homepageCategoryImage.getAttribute('data-canvas-element-id');
    const sharedCategorySlug = homepageCategoryElementId?.slice('categories:image:'.length);
    expect(sharedCategorySlug).toBeTruthy();
    await homepageCategoryImage.evaluate((element) => (element as HTMLElement).click());
    await homepageToolbar.getByRole('button', {
      name: 'Uredi videz kategorije',
      exact: true
    }).click();

    const homepageMediaControls = page.locator('[data-category-media-controls]');
    await expect(homepageMediaControls).toBeVisible();
    const homepageEditorCapabilities = (await page
      .locator('[data-category-showcase-editor="homepage"]')
      .getAttribute('data-category-showcase-capabilities'))?.split(' ') ?? [];
    const sharedCapabilities = [
      'media',
      'crop',
      'focalPoint',
      'scale',
      'offsets',
      'fit',
      'title',
      'background',
      'ordinal'
    ].sort();
    expect(homepageEditorCapabilities.sort()).toEqual(sharedCapabilities);
    const homepageMediaControlLabels = await homepageMediaControls.locator('input[aria-label]').evaluateAll(
      (inputs) => inputs.map((input) => input.getAttribute('aria-label')).filter(Boolean).sort()
    );
    const homepageSharedFields = await homepageMediaControls.locator('[data-category-media-field]').evaluateAll(
      (inputs) => Object.fromEntries(inputs.map((input) => [
        input.getAttribute('data-category-media-field'),
        {
          value: (input as HTMLInputElement).value,
          min: input.getAttribute('min'),
          max: input.getAttribute('max')
        }
      ]))
    );
    expect(Object.keys(homepageSharedFields).sort()).toEqual([
      'background',
      'background-hover',
      'crop-height',
      'crop-width',
      'crop-x',
      'crop-y',
      'focal-x',
      'focal-y',
      'offset-x',
      'offset-y',
      'ordinal-color',
      'ordinal-font-size',
      'ordinal-hover-color',
      'scale',
      'title-color',
      'title-hover-color'
    ]);
    expect(await homepageMediaControls.locator('[data-category-media-section="colors"] [data-category-media-field]').evaluateAll(
      (inputs) => inputs.map((input) => input.getAttribute('data-category-media-field'))
    )).toEqual([
      'title-color',
      'title-hover-color',
      'ordinal-color',
      'ordinal-hover-color',
      'background',
      'background-hover'
    ]);
    expect(await homepageMediaControls.locator('[data-category-media-fit]').evaluateAll(
      (buttons) => buttons.map((button) => button.getAttribute('data-category-media-fit')).sort()
    )).toEqual(['contain', 'cover', 'fill']);
    expect(homepageSharedFields.scale).toMatchObject({ min: '0.25', max: '4' });
    const homepageOrdinalSizeControl = homepageMediaControls.locator('[data-category-media-field="ordinal-font-size"]');
    const homepageCategoryTile = page.locator(`[data-category-slug="${sharedCategorySlug}"]`).first();
    await homepageOrdinalSizeControl.fill('8');
    const smallOrdinalHeight = await homepageCategoryTile.evaluate(
      (element) => Number.parseFloat((element as HTMLElement).style.height)
    );
    await homepageOrdinalSizeControl.fill('32');
    await expect.poll(() => homepageCategoryTile.evaluate(
      (element) => Number.parseFloat((element as HTMLElement).style.height)
    )).toBeGreaterThanOrEqual(smallOrdinalHeight);
    expect(await homepageCategoryTile.evaluate((element) => {
      const tileRect = element.getBoundingClientRect();
      const titleRect = element.querySelector('[data-testid="category-showcase-title"]')?.getBoundingClientRect();
      return Boolean(titleRect && titleRect.bottom <= tileRect.bottom);
    })).toBeTruthy();
    await homepageMediaControls.locator('input[aria-label^="Odmik X"]').fill('19');
    await homepageOrdinalSizeControl.fill('14');
    await homepageMediaControls.locator('[data-category-media-field="title-color"]').fill('#123456');
    await homepageMediaControls.locator('[data-category-media-field="title-hover-color"]').fill('#654321');
    await homepageMediaControls.locator('[data-category-media-field="ordinal-color"]').fill('#1F6FEB');
    await homepageMediaControls.locator('[data-category-media-field="ordinal-hover-color"]').fill('#E11D48');
    await homepageMediaControls.locator('[data-category-media-field="background"]').fill('#E2E8F0');
    await homepageMediaControls.locator('[data-category-media-field="background-hover"]').fill('#CBD5E1');
    const homepageSave = page.getByRole('button', { name: 'Shrani spremembe', exact: true });
    await expect(homepageSave).toBeEnabled();
    await homepageSave.click();
    await expect.poll(() => presentationPatches.length).toBe(1);
    expect(categorySettingsWrites).toEqual(['PATCH /api/admin/categories/images']);
    expect(unscopedCategoryReads).toHaveLength(0);
    expect(presentationPatches[0]?.updates).toHaveLength(1);
    expect(presentationPatches[0]?.updates[0]).not.toHaveProperty('image');

    await page.goto('/admin/kategorije/predogled');
    const categoryPreviewTile = page.locator(`[data-category-slug="${sharedCategorySlug}"]`).first();
    await expect(categoryPreviewTile).toBeVisible({ timeout: 15_000 });
    await categoryPreviewTile.hover();
    await categoryPreviewTile.getByRole('button', { name: 'Uredi videz kategorije', exact: true }).click();

    const categoryPreviewMediaControls = page.locator('[data-category-media-controls]');
    await expect(categoryPreviewMediaControls).toBeVisible();
    const categoryPreviewEditorCapabilities = (await page
      .locator('[data-category-showcase-editor="category-preview"]')
      .getAttribute('data-category-showcase-capabilities'))?.split(' ') ?? [];
    expect(categoryPreviewEditorCapabilities.sort()).toEqual(sharedCapabilities);
    const categoryPreviewMediaControlLabels = await categoryPreviewMediaControls.locator('input[aria-label]').evaluateAll(
      (inputs) => inputs.map((input) => input.getAttribute('aria-label')).filter(Boolean).sort()
    );
    expect(categoryPreviewMediaControlLabels).toEqual(homepageMediaControlLabels);
    const categoryPreviewSharedFields = await categoryPreviewMediaControls.locator('[data-category-media-field]').evaluateAll(
      (inputs) => Object.fromEntries(inputs.map((input) => [
        input.getAttribute('data-category-media-field'),
        {
          value: (input as HTMLInputElement).value,
          min: input.getAttribute('min'),
          max: input.getAttribute('max')
        }
      ]))
    );
    expect(categoryPreviewSharedFields).toEqual(homepageSharedFields);
    expect(await categoryPreviewMediaControls.locator('[data-category-media-section="colors"] [data-category-media-field]').evaluateAll(
      (inputs) => inputs.map((input) => input.getAttribute('data-category-media-field'))
    )).toEqual([
      'title-color',
      'title-hover-color',
      'ordinal-color',
      'ordinal-hover-color',
      'background',
      'background-hover'
    ]);
    expect(await categoryPreviewMediaControls.locator('[data-category-media-fit]').evaluateAll(
      (buttons) => buttons.map((button) => button.getAttribute('data-category-media-fit')).sort()
    )).toEqual(['contain', 'cover', 'fill']);
    await categoryPreviewMediaControls.locator('input[aria-label^="Odmik X"]').fill('23');
    await categoryPreviewMediaControls.locator('[data-category-media-field="ordinal-font-size"]').fill('13');
    await categoryPreviewMediaControls.locator('[data-category-media-field="title-color"]').fill('#0F172A');
    await categoryPreviewMediaControls.locator('[data-category-media-field="title-hover-color"]').fill('#7C3AED');
    await categoryPreviewMediaControls.locator('[data-category-media-field="ordinal-color"]').fill('#8A2BE2');
    await categoryPreviewMediaControls.locator('[data-category-media-field="ordinal-hover-color"]').fill('#EA580C');
    await categoryPreviewMediaControls.locator('[data-category-media-field="background"]').fill('#F1F5F9');
    await categoryPreviewMediaControls.locator('[data-category-media-field="background-hover"]').fill('#DBEAFE');

    const categoryPreviewSave = page.getByRole('button', { name: 'Shrani', exact: true }).first();
    await expect(categoryPreviewSave).toBeEnabled();
    await categoryPreviewSave.click();
    const saveDialog = page.getByRole('dialog');
    await expect(saveDialog.getByText('Videz kategorij', { exact: true })).toBeVisible();
    await saveDialog.getByRole('button', { name: 'Shrani', exact: true }).click();
    await expect.poll(() => presentationPatches.length).toBe(2);

    const homepageUpdate = presentationPatches[0]?.updates[0];
    const categoryPreviewUpdate = presentationPatches[1]?.updates[0];
    expect(homepageUpdate).toBeDefined();
    expect(categoryPreviewUpdate).toBeDefined();
    expect(categoryPreviewUpdate?.categorySlug).toBe(homepageUpdate?.categorySlug);
    expect(homepageUpdate?.presentation.offsetX).toBe(19);
    expect(categoryPreviewUpdate?.presentation.offsetX).toBe(23);
    expect(homepageUpdate?.presentation.ordinalFontSizePx).toBe(14);
    expect(homepageUpdate?.presentation.titleColor).toBe('#123456');
    expect(homepageUpdate?.presentation.titleHoverColor).toBe('#654321');
    expect(homepageUpdate?.presentation.ordinalColor).toBe('#1F6FEB');
    expect(homepageUpdate?.presentation.ordinalHoverColor).toBe('#E11D48');
    expect(homepageUpdate?.presentation.backgroundColor).toBe('#E2E8F0');
    expect(homepageUpdate?.presentation.backgroundHoverColor).toBe('#CBD5E1');
    expect(categoryPreviewUpdate?.presentation.ordinalFontSizePx).toBe(13);
    expect(categoryPreviewUpdate?.presentation.titleColor).toBe('#0F172A');
    expect(categoryPreviewUpdate?.presentation.titleHoverColor).toBe('#7C3AED');
    expect(categoryPreviewUpdate?.presentation.ordinalColor).toBe('#8A2BE2');
    expect(categoryPreviewUpdate?.presentation.ordinalHoverColor).toBe('#EA580C');
    expect(categoryPreviewUpdate?.presentation.backgroundColor).toBe('#F1F5F9');
    expect(categoryPreviewUpdate?.presentation.backgroundHoverColor).toBe('#DBEAFE');
    expect(Object.keys(categoryPreviewUpdate?.presentation ?? {}).sort()).toEqual(
      Object.keys(homepageUpdate?.presentation ?? {}).sort()
    );
    expect(Object.keys(homepageUpdate?.presentation.crop ?? {}).sort()).toEqual(['height', 'width', 'x', 'y']);
    expect(Object.keys(homepageUpdate?.presentation.focalPoint ?? {}).sort()).toEqual(['x', 'y']);
    expect(homepageUpdate?.presentation).not.toHaveProperty('categoryTitlePosition');
    expect(homepageUpdate?.presentation).not.toHaveProperty('categoryTitleTypography');
    expect(homepageUpdate?.presentation).not.toHaveProperty('groupTitlePosition');
  });

  test('a saved category presentation reloads from the same record in both admin routes', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    type PersistedCategoryPresentation = {
      crop: { x: number; y: number; width: number; height: number };
      focalPoint: { x: number; y: number };
      scale: number;
      offsetOriginX: number;
      offsetOriginY: number;
      offsetX: number;
      offsetY: number;
      fit: 'contain' | 'cover' | 'fill';
      titleColor?: string;
      titleHoverColor?: string;
      backgroundColor: string;
      backgroundHoverColor?: string;
      ordinalFontSizePx?: number;
      ordinalColor?: string;
      ordinalHoverColor?: string;
    };

    await page.goto('/admin/podoba/glavna-stran');
    const homepageCategoryImage = page.locator(
      '[data-homepage-canvas-element][data-canvas-element-id^="categories:image:"]'
    ).first();
    await expect(homepageCategoryImage).toHaveCount(1);
    const imageElementId = await homepageCategoryImage.getAttribute('data-canvas-element-id');
    const categorySlug = imageElementId?.slice('categories:image:'.length);
    expect(categorySlug).toBeTruthy();
    const previewResponse = await page.request.get('/api/admin/categories?view=preview');
    expect(previewResponse.ok()).toBeTruthy();
    const previewPayload = await previewResponse.json() as {
      categories: Array<{ slug: string; presentation: PersistedCategoryPresentation; revision?: string }>;
    };
    const originalRecord = previewPayload.categories.find(
      (category) => category.slug === categorySlug
    );
    const originalPresentation = originalRecord?.presentation;
    expect(originalPresentation).toBeDefined();

    await homepageCategoryImage.evaluate((element) => (element as HTMLElement).click());
    await page.getByTestId('homepage-context-toolbar').getByRole('button', {
      name: 'Uredi videz kategorije',
      exact: true
    }).click();
    const homepageControls = page.locator('[data-category-media-controls]');
    await expect(homepageControls).toBeVisible();
    const originalOffsetOriginX = originalPresentation!.offsetOriginX ?? 0;
    let persistedChange = false;

    try {
      const homepageOffsetX = homepageControls.locator('[data-category-media-field="offset-x"]');
      const homepageOrdinalSize = homepageControls.locator('[data-category-media-field="ordinal-font-size"]');
      const homepageTitleColor = homepageControls.locator('[data-category-media-field="title-color"]');
      const homepageTitleHoverColor = homepageControls.locator('[data-category-media-field="title-hover-color"]');
      const homepageOrdinalColor = homepageControls.locator('[data-category-media-field="ordinal-color"]');
      const homepageOrdinalHoverColor = homepageControls.locator('[data-category-media-field="ordinal-hover-color"]');
      const homepageBackgroundColor = homepageControls.locator('[data-category-media-field="background"]');
      const homepageBackgroundHoverColor = homepageControls.locator('[data-category-media-field="background-hover"]');
      const displayedOffsetX = Number(await homepageOffsetX.inputValue());
      const displayedOffsetXMax = Number(await homepageOffsetX.getAttribute('max'));
      const changedOffsetX = displayedOffsetX >= displayedOffsetXMax
        ? displayedOffsetX - 1
        : displayedOffsetX + 1;
      const displayedOrdinalSize = Number(await homepageOrdinalSize.inputValue());
      const displayedOrdinalSizeMax = Number(await homepageOrdinalSize.getAttribute('max'));
      const changedOrdinalSize = displayedOrdinalSize >= displayedOrdinalSizeMax
        ? displayedOrdinalSize - 1
        : displayedOrdinalSize + 1;
      const displayedOrdinalColor = (await homepageOrdinalColor.inputValue()).toUpperCase();
      const changedOrdinalColor = displayedOrdinalColor === '#C2410C' ? '#1F6FEB' : '#C2410C';
      const alternateColor = (displayed: string, primary: string, fallback: string) =>
        displayed.toUpperCase() === primary ? fallback : primary;
      const changedTitleColor = alternateColor(await homepageTitleColor.inputValue(), '#123456', '#0F172A');
      const changedTitleHoverColor = alternateColor(await homepageTitleHoverColor.inputValue(), '#7C3AED', '#C2410C');
      const changedOrdinalHoverColor = alternateColor(await homepageOrdinalHoverColor.inputValue(), '#E11D48', '#15803D');
      const changedBackgroundColor = alternateColor(await homepageBackgroundColor.inputValue(), '#E2E8F0', '#FEF3C7');
      const changedBackgroundHoverColor = alternateColor(await homepageBackgroundHoverColor.inputValue(), '#BFDBFE', '#FED7AA');
      await homepageOffsetX.fill(String(changedOffsetX));
      await homepageOrdinalSize.fill(String(changedOrdinalSize));
      await homepageTitleColor.fill(changedTitleColor);
      await homepageTitleHoverColor.fill(changedTitleHoverColor);
      await homepageOrdinalColor.fill(changedOrdinalColor);
      await homepageOrdinalHoverColor.fill(changedOrdinalHoverColor);
      await homepageBackgroundColor.fill(changedBackgroundColor);
      await homepageBackgroundHoverColor.fill(changedBackgroundHoverColor);
      await page.mouse.move(0, 0);
      const homepageCategoryTile = page.locator(`[data-category-slug="${categorySlug}"]`).first();
      const homepageCategoryTitle = homepageCategoryTile.locator('[data-testid="category-showcase-title"] h3');
      const homepageOrdinalNumber = page.locator(
        `[data-category-slug="${categorySlug}"] [data-category-showcase-ordinal-number]`
      ).first();
      const homepageOrdinalIndicator = page.locator(
        `[data-category-slug="${categorySlug}"] [data-category-showcase-ordinal-indicator]`
      ).first();
      const homepageMediaSurface = homepageCategoryTile.locator('[data-testid="category-showcase-media"]');
      const homepagePresentationSurface = homepageCategoryTile.locator('[data-category-showcase-presentation]');
      await expect(homepageOrdinalNumber).toHaveCSS('font-size', `${changedOrdinalSize}px`);
      await expect(homepageCategoryTitle).toHaveCSS('color', hexToRgbCss(changedTitleColor));
      await expect(homepageOrdinalIndicator).toHaveCSS('color', hexToRgbCss(changedOrdinalColor));
      await expect(homepageCategoryTile).toHaveCSS('background-color', hexToRgbCss(changedBackgroundColor));
      await expect(homepageMediaSurface).toHaveCSS('background-color', hexToRgbCss(changedBackgroundColor));
      await expect(homepagePresentationSurface).toHaveCSS('background-color', hexToRgbCss(changedBackgroundColor));
      await homepageCategoryTile.hover();
      await expect(homepageCategoryTitle).toHaveCSS('color', hexToRgbCss(changedTitleHoverColor));
      await expect(homepageOrdinalIndicator).toHaveCSS('color', hexToRgbCss(changedOrdinalHoverColor));
      await expect(homepageCategoryTile).toHaveCSS('background-color', hexToRgbCss(changedBackgroundHoverColor));
      await expect(homepageMediaSurface).toHaveCSS('background-color', hexToRgbCss(changedBackgroundHoverColor));
      await expect(homepagePresentationSurface).toHaveCSS('background-color', hexToRgbCss(changedBackgroundHoverColor));
      const saveResponsePromise = page.waitForResponse((response) =>
        response.url().includes('/api/admin/categories/images')
        && response.request().method() === 'PATCH'
      );
      await page.getByRole('button', { name: 'Shrani spremembe', exact: true }).click();
      const saveResponse = await saveResponsePromise;
      const saveFailureBody = saveResponse.ok() ? '' : await saveResponse.text();
      const submittedSave = saveResponse.request().postDataJSON() as {
        updates?: Array<{ expectedRevision?: string }>;
      };
      expect(
        saveResponse.ok(),
        `Category presentation save failed (${saveResponse.status()}), submitted revision ${submittedSave.updates?.[0]?.expectedRevision}, current revision ${originalRecord?.revision}: ${saveFailureBody}`
      ).toBeTruthy();
      persistedChange = true;

      await page.goto('/admin/kategorije/predogled');
      const categoryTile = page.locator(`[data-category-slug="${categorySlug}"]`).first();
      await expect(categoryTile).toBeVisible({ timeout: 15_000 });
      await categoryTile.hover();
      await categoryTile.getByRole('button', { name: 'Uredi videz kategorije', exact: true }).click();
      const categoryPreviewControls = page.locator('[data-category-media-controls]');
      await expect(categoryPreviewControls).toBeVisible();
      await expect(categoryPreviewControls.locator('[data-category-media-field="offset-x"]')).toHaveValue(String(changedOffsetX));
      await expect(categoryPreviewControls.locator('[data-category-media-field="ordinal-font-size"]')).toHaveValue(String(changedOrdinalSize));
      await expect(categoryPreviewControls.locator('[data-category-media-field="title-color"]')).toHaveValue(changedTitleColor);
      await expect(categoryPreviewControls.locator('[data-category-media-field="title-hover-color"]')).toHaveValue(changedTitleHoverColor);
      await expect(categoryPreviewControls.locator('[data-category-media-field="ordinal-color"]')).toHaveValue(changedOrdinalColor);
      await expect(categoryPreviewControls.locator('[data-category-media-field="ordinal-hover-color"]')).toHaveValue(changedOrdinalHoverColor);
      await expect(categoryPreviewControls.locator('[data-category-media-field="background"]')).toHaveValue(changedBackgroundColor);
      await expect(categoryPreviewControls.locator('[data-category-media-field="background-hover"]')).toHaveValue(changedBackgroundHoverColor);
      await page.mouse.move(0, 0);
      const categoryPreviewTitle = categoryTile.locator('[data-testid="category-showcase-title"] h3');
      const categoryPreviewOrdinal = categoryTile.locator('[data-category-showcase-ordinal-indicator]');
      const categoryPreviewMediaSurface = categoryTile.locator('[data-testid="category-showcase-media"]');
      const categoryPreviewPresentationSurface = categoryTile.locator('[data-category-showcase-presentation]');
      await expect(categoryTile.locator('[data-category-showcase-ordinal-number]')).toHaveCSS('font-size', `${changedOrdinalSize}px`);
      await expect(categoryPreviewTitle).toHaveCSS('color', hexToRgbCss(changedTitleColor));
      await expect(categoryPreviewOrdinal).toHaveCSS('color', hexToRgbCss(changedOrdinalColor));
      await expect(categoryTile).toHaveCSS('background-color', hexToRgbCss(changedBackgroundColor));
      await expect(categoryPreviewMediaSurface).toHaveCSS('background-color', hexToRgbCss(changedBackgroundColor));
      await expect(categoryPreviewPresentationSurface).toHaveCSS('background-color', hexToRgbCss(changedBackgroundColor));
      await categoryTile.hover();
      await expect(categoryPreviewTitle).toHaveCSS('color', hexToRgbCss(changedTitleHoverColor));
      await expect(categoryPreviewOrdinal).toHaveCSS('color', hexToRgbCss(changedOrdinalHoverColor));
      await expect(categoryTile).toHaveCSS('background-color', hexToRgbCss(changedBackgroundHoverColor));
      await expect(categoryPreviewMediaSurface).toHaveCSS('background-color', hexToRgbCss(changedBackgroundHoverColor));
      await expect(categoryPreviewPresentationSurface).toHaveCSS('background-color', hexToRgbCss(changedBackgroundHoverColor));

      await page.goto('/');
      const publicCategoryTile = page.locator(`[data-category-slug="${categorySlug}"]`).first();
      await expect(publicCategoryTile).toBeVisible({ timeout: 15_000 });
      const publicPresentationLayer = publicCategoryTile.locator(
        '[data-testid="category-showcase-media"] > div > div'
      );
      await expect.poll(() => publicPresentationLayer.evaluate(
        (element) => (element as HTMLElement).style.transform
      )).toContain(`translate3d(${originalOffsetOriginX + changedOffsetX}%,`);
      await expect(publicCategoryTile.locator('[data-category-showcase-ordinal-number]')).toHaveCSS('font-size', `${changedOrdinalSize}px`);
      const publicCategoryTitle = publicCategoryTile.locator('[data-testid="category-showcase-title"] h3');
      const publicCategoryOrdinal = publicCategoryTile.locator('[data-category-showcase-ordinal-indicator]');
      const publicMediaSurface = publicCategoryTile.locator('[data-testid="category-showcase-media"]');
      await expect(publicCategoryTitle).toHaveCSS('color', hexToRgbCss(changedTitleColor));
      await expect(publicCategoryOrdinal).toHaveCSS('color', hexToRgbCss(changedOrdinalColor));
      await expect(publicCategoryTile).toHaveCSS('background-color', hexToRgbCss(changedBackgroundColor));
      await expect(publicMediaSurface).toHaveCSS('background-color', hexToRgbCss(changedBackgroundColor));
      await expect(publicPresentationLayer).toHaveCSS('background-color', hexToRgbCss(changedBackgroundColor));
      await publicCategoryTile.hover();
      await expect(publicCategoryTitle).toHaveCSS('color', hexToRgbCss(changedTitleHoverColor));
      await expect(publicCategoryOrdinal).toHaveCSS('color', hexToRgbCss(changedOrdinalHoverColor));
      await expect(publicCategoryTile).toHaveCSS('background-color', hexToRgbCss(changedBackgroundHoverColor));
      await expect(publicMediaSurface).toHaveCSS('background-color', hexToRgbCss(changedBackgroundHoverColor));
      await expect(publicPresentationLayer).toHaveCSS('background-color', hexToRgbCss(changedBackgroundHoverColor));
    } finally {
      if (persistedChange && categorySlug) {
        const restoreResponse = await page.request.patch('/api/admin/categories/images', {
          data: {
            updates: [{
              categorySlug,
              presentation: originalPresentation!
            }]
          }
        });
        expect.soft(restoreResponse.ok()).toBeTruthy();
      }
    }
  });

  test('landing editor preserves edits made during a save and re-enables saving afterwards', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    const savedPayloads: Array<{ config: Record<string, unknown> }> = [];
    let releaseFirstSave: (() => void) | undefined;
    let signalFirstSaveStarted: (() => void) | undefined;
    const firstSaveGate = new Promise<void>((resolve) => { releaseFirstSave = resolve; });
    const firstSaveStarted = new Promise<void>((resolve) => { signalFirstSaveStarted = resolve; });

    await page.route('**/api/admin/landing-page', async (route) => {
      if (route.request().method() !== 'PUT') {
        await route.continue();
        return;
      }

      const requestBody = route.request().postDataJSON() as { config: Record<string, unknown> };
      savedPayloads.push(requestBody);
      if (savedPayloads.length === 1) {
        signalFirstSaveStarted?.();
        await firstSaveGate;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          config: {
            ...requestBody.config,
            updatedAt: `2026-07-18T12:00:0${savedPayloads.length}.000Z`
          }
        })
      });
    });

    await page.goto('/admin/podoba/glavna-stran');
    const toolbar = page.getByTestId('homepage-context-toolbar');
    const previewStage = page.getByTestId('homepage-preview-stage');
    await expect(previewStage).toHaveAttribute('data-preview-ready', 'true', { timeout: 15_000 });
    await expect(toolbar).toBeVisible({ timeout: 15_000 });
    await page.locator('[data-canvas-element-id="hero:title"]').click();
    await toolbar.getByRole('button', { name: 'Slog besedila', exact: true }).click();

    const fontSizeInput = page.getByRole('spinbutton', { name: 'Velikost px', exact: true });
    const saveButton = page.getByRole('button', { name: 'Shrani spremembe', exact: true });
    const initialFontSize = Number(await fontSizeInput.inputValue());
    const firstFontSize = initialFontSize >= 239 ? initialFontSize - 1 : initialFontSize + 1;
    const newerFontSize = initialFontSize >= 238 ? initialFontSize - 2 : initialFontSize + 2;

    await fontSizeInput.fill(String(firstFontSize));
    await expect(saveButton).toBeEnabled();

    const firstSaveClick = saveButton.click();
    await firstSaveStarted;
    await firstSaveClick;
    await expect(saveButton).toBeDisabled();

    await toolbar.getByRole('button', { name: 'Slog besedila', exact: true }).click();
    await fontSizeInput.fill(String(newerFontSize));
    await expect(fontSizeInput).toHaveValue(String(newerFontSize));
    releaseFirstSave?.();

    await expect(page.getByText('Neshranjeno', { exact: true })).toBeVisible();
    await expect(fontSizeInput).toHaveValue(String(newerFontSize));
    await expect(saveButton).toBeEnabled();

    await saveButton.click();
    await expect.poll(() => savedPayloads.length).toBe(2);
    await expect(page.getByText('Objavljeno', { exact: true })).toBeVisible();
    await expect(saveButton).toBeDisabled();

    const secondConfig = savedPayloads[1].config as {
      hero: { responsive: { desktop: { titleFontSizePx: number } } };
      canvas: { elements: Record<string, { responsive: { desktop: { fontSizePx: number } } }> };
    };
    expect(secondConfig.hero.responsive.desktop.titleFontSizePx).toBe(newerFontSize);
    expect(secondConfig.canvas.elements['hero:title'].responsive.desktop.fontSizePx).toBe(newerFontSize);

    await toolbar.getByRole('button', { name: 'Slog besedila', exact: true }).click();
    const letterSpacingInput = page.getByRole('spinbutton', { name: 'Razmik črk px', exact: true });
    const currentLetterSpacing = Number(await letterSpacingInput.inputValue());
    await letterSpacingInput.fill(String(currentLetterSpacing + 0.25));
    await expect(saveButton).toBeEnabled();
  });

  test('a pending section rename enables save before blur and is included in the payload', async ({ page }) => {
    let savedConfig: { sectionTitles: Record<string, string> } | undefined;
    await page.route('**/api/admin/landing-page', async (route) => {
      if (route.request().method() !== 'PUT') {
        await route.continue();
        return;
      }
      const requestBody = route.request().postDataJSON() as {
        config: { sectionTitles: Record<string, string> };
      };
      savedConfig = requestBody.config;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ config: requestBody.config })
      });
    });

    await page.goto('/admin/podoba/glavna-stran');
    const toolbar = page.getByTestId('homepage-context-toolbar');
    await expect(toolbar).toBeVisible({ timeout: 15_000 });
    await toolbar.getByRole('button', { name: 'Struktura strani', exact: true }).click();
    await page.getByRole('button', { name: 'Možnosti sekcije', exact: true }).first().click();
    await page.getByRole('button', { name: 'Preimenuj', exact: true }).click();

    const renameInput = page.getByRole('textbox', { name: 'Ime sekcije', exact: true });
    const renamedSection = 'Preizkusna sekcija';
    await renameInput.fill(renamedSection);
    await expect(renameInput).toBeFocused();

    const saveButton = page.getByRole('button', { name: 'Shrani spremembe', exact: true });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    await expect.poll(() => savedConfig).toBeDefined();
    expect(Object.values(savedConfig!.sectionTitles)).toContain(renamedSection);
    await expect(page.getByText('Objavljeno', { exact: true })).toBeVisible();
    await expect(saveButton).toBeDisabled();
  });
});
