import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  getAppearanceEditorCompactSelect,
  readAppearanceEditorCompactSelectOptions
} from './support/appearance-editor-compact-select';

type ElementBounds = { x: number; y: number; width: number; height: number };

async function requireBoundingBox(locator: Locator): Promise<ElementBounds> {
  await expect(locator).toBeVisible();
  const bounds = await locator.boundingBox();
  if (!bounds) throw new Error('Expected the visible logo editor element to have bounds.');
  return bounds;
}

async function dragBy(
  page: Page,
  locator: Locator,
  delta: { x: number; y: number },
  origin: { x: number; y: number } = { x: 0.5, y: 0.5 }
) {
  await locator.scrollIntoViewIfNeeded();
  const bounds = await requireBoundingBox(locator);
  const startX = bounds.x + bounds.width * origin.x;
  const startY = bounds.y + bounds.height * origin.y;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + delta.x, startY + delta.y, { steps: 6 });
  await page.mouse.up();
}

test.describe('admin podoba redesign', () => {
  test('Logotip is the third podoba tab and its canonical route loads', async ({ page }) => {
    await page.goto('/admin/podoba/glavna-stran');

    const logoTab = page.getByRole('tab', { name: 'Logotip' });
    await expect(logoTab).toBeVisible();
    await logoTab.click();
    await expect(page).toHaveURL(/\/admin\/podoba\/logotip\/?$/);
    await expect(page.getByRole('tab', { name: 'Logotip' })).toHaveAttribute('aria-selected', 'true');
  });

  test('logo outputs are selected from compact use cases and edited contextually', async ({ page }) => {
    await page.goto('/admin/podoba/logotip');

    const catalogue = page.getByTestId('logo-purpose-catalogue');
    await expect(catalogue.getByRole('tab')).toHaveCount(4);
    await expect(catalogue.getByRole('tab', { name: 'Glava' })).toBeVisible();
    await expect(catalogue.getByRole('tab', { name: 'Noga' })).toBeVisible();
    await expect(catalogue.getByRole('tab', { name: 'Samostojno' })).toBeVisible();
    await expect(catalogue.getByRole('tab', { name: 'Dokumenti' })).toBeVisible();
    await expect(page.locator('[data-logo-use-case="header-desktop"]')).toBeVisible();
    await expect(page.getByTestId('logo-context-toolbar')).toBeVisible();
    await expect(page.getByText('Barva logotipa', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Pisava logotipa', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Filter', { exact: true })).toHaveCount(0);

    await catalogue.getByRole('button', { name: 'Drugi izhodi' }).click();
    await catalogue.getByRole('menuitem', { name: 'Favicon' }).click();
    await expect(page.locator('[data-logo-use-case="favicon"]')).toBeVisible();
    const visibilityToggle = page.getByTestId('logo-context-toolbar').getByRole('button', { name: 'Skrij uporabo' });
    await visibilityToggle.click();
    await expect(page.getByTestId('logo-context-toolbar').getByRole('button', { name: 'Prikaži uporabo' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Shrani', exact: true })).toBeEnabled();

    await page.getByRole('button', { name: 'Zavrzi neshranjene spremembe' }).click();
    await expect(page.getByRole('button', { name: 'Shrani', exact: true })).toBeDisabled();
  });

  test('logo fit, resize, crop, and move tools remain compact and edit the canvas directly', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 640 });
    const persistenceWrites: string[] = [];
    page.on('request', (request) => {
      if (
        request.url().includes('/api/admin/site-logo')
        && request.method() !== 'GET'
      ) {
        persistenceWrites.push(`${request.method()} ${request.url()}`);
      }
    });

    await page.goto('/admin/podoba/logotip');
    const discardButton = page.getByRole('button', { name: 'Zavrzi neshranjene spremembe' });
    const saveButton = page.getByRole('button', { name: 'Shrani', exact: true });

    try {
      const catalogue = page.getByTestId('logo-purpose-catalogue');
      await catalogue.getByRole('tab', { name: 'Samostojno' }).click();

      const toolbar = page.getByTestId('logo-context-toolbar');
      const preview = page.locator('[data-logo-use-case="standalone"]');
      const fitTrigger = toolbar.getByRole('button', { name: 'Prileganje', exact: true });
      await expect(toolbar).toBeVisible();
      await expect(preview).toBeVisible();

      await fitTrigger.click();
      const fitPopover = page.getByRole('dialog', { name: 'Prileganje logotipa' });
      await expect(fitPopover).toHaveAttribute('data-appearance-editor-toolbar-popover-ready', 'true');
      await expect(fitPopover).toHaveAttribute('data-appearance-editor-toolbar-popover-size', 'compact');
      const fitBounds = await requireBoundingBox(fitPopover);
      const viewport = page.viewportSize();
      if (!viewport) throw new Error('Expected a configured Playwright viewport.');
      expect(fitBounds.width).toBeLessThanOrEqual(361);
      expect(fitBounds.x).toBeGreaterThanOrEqual(7);
      expect(fitBounds.y).toBeGreaterThanOrEqual(7);
      expect(fitBounds.x + fitBounds.width).toBeLessThanOrEqual(viewport.width - 7);
      expect(fitBounds.y + fitBounds.height).toBeLessThanOrEqual(viewport.height - 7);

      const xInput = fitPopover.locator('[data-logo-translation-field="x"]').getByRole('spinbutton');
      const yInput = fitPopover.locator('[data-logo-translation-field="y"]').getByRole('spinbutton');
      const cropYInput = fitPopover.locator('[data-logo-crop-field="y"]');
      const cropHeightInput = fitPopover.locator('[data-logo-crop-field="height"]');
      const initialCropY = Number(await cropYInput.inputValue());
      const initialCropHeight = Number(await cropHeightInput.inputValue());
      const initialX = Number(await xInput.inputValue());
      const initialY = Number(await yInput.inputValue());
      await fitTrigger.click();
      await expect(fitPopover).toBeHidden();

      const resizeMode = toolbar.locator('[data-logo-edit-mode-control="resize"]');
      await resizeMode.click();
      await expect(resizeMode).toHaveAttribute('aria-pressed', 'true');
      const resizeHandles = preview.locator('[data-logo-resize-handle]');
      await expect(resizeHandles).toHaveCount(4);
      const artworkFrame = preview.locator('[data-logo-editable-artwork-frame]');
      const resizeBefore = await requireBoundingBox(artworkFrame);
      await dragBy(page, preview.locator('[data-logo-resize-handle="se"]'), {
        x: Math.min(48, resizeBefore.width * 0.12),
        y: Math.min(36, resizeBefore.height * 0.16)
      });
      await expect.poll(async () => (await artworkFrame.boundingBox())?.width ?? 0).toBeGreaterThan(
        resizeBefore.width * 1.02
      );

      const cropMode = toolbar.locator('[data-logo-edit-mode-control="crop"]');
      await cropMode.click();
      await expect(cropMode).toHaveAttribute('aria-pressed', 'true');
      const cropHandles = preview.locator('[data-logo-crop-handle]');
      await expect(cropHandles).toHaveCount(8);
      const cropBounds = preview.locator('[data-logo-transform-bounds]');
      const cropBefore = await requireBoundingBox(cropBounds);
      const cropStyleBefore = await cropBounds.evaluate((element) => ({
        top: (element as HTMLElement).style.top,
        height: (element as HTMLElement).style.height
      }));
      await dragBy(page, preview.locator('[data-logo-crop-handle="n"]'), {
        x: 0,
        y: Math.min(36, cropBefore.height * 0.18)
      });
      await expect.poll(() => cropBounds.evaluate((element) => (
        (element as HTMLElement).style.height
      ))).not.toBe(cropStyleBefore.height);
      expect(await cropBounds.evaluate((element) => (element as HTMLElement).style.top)).not.toBe(
        cropStyleBefore.top
      );

      const moveMode = toolbar.locator('[data-logo-edit-mode-control="move"]');
      await moveMode.click();
      await expect(moveMode).toHaveAttribute('aria-pressed', 'true');
      const canvas = preview.locator(':scope > div[tabindex="0"]');
      await dragBy(
        page,
        canvas,
        {
          x: initialX > 50 ? -40 : 40,
          y: initialY > 50 ? -24 : 24
        },
        { x: 0.12, y: 0.82 }
      );

      await fitTrigger.click();
      await expect(fitPopover).toBeVisible();
      await expect.poll(async () => Number(await xInput.inputValue())).not.toBe(initialX);
      await expect.poll(async () => Number(await yInput.inputValue())).not.toBe(initialY);
      await expect.poll(async () => Number(await cropYInput.inputValue())).not.toBe(initialCropY);
      await expect.poll(async () => Number(await cropHeightInput.inputValue())).not.toBe(initialCropHeight);
      await expect(page.getByText('Neshranjeno', { exact: true })).toBeVisible();
      await expect(saveButton).toBeEnabled();
    } finally {
      await page.keyboard.press('Escape').catch(() => undefined);
      if (await discardButton.isEnabled().catch(() => false)) {
        await discardButton.click();
        await expect(saveButton).toBeDisabled();
      }
      await page.reload();
      await expect(saveButton).toBeDisabled();
      expect(persistenceWrites).toEqual([]);
    }
  });

  test('logo masters are optically analysed and remain non-destructive', async ({ page }) => {
    await page.goto('/admin/podoba/logotip');
    await page.getByTestId('logo-context-toolbar').getByRole('button', { name: 'Izvirnik' }).click();
    const master = page.locator('[data-logo-master-library] [data-logo-master="full-lockup"]');
    await master.locator('input[type="file"]').setInputFiles({
      name: 'atehna-lockup.svg',
      mimeType: 'image/svg+xml',
      buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200" viewBox="0 0 600 200"><g fill="#111827"><rect x="130" y="60" width="80" height="80" rx="12"/><text x="235" y="125" font-size="72" font-family="Arial">Atehna</text></g></svg>'
      )
    });

    await expect(master.locator('img')).toBeVisible();
    await expect(page.getByText('Neshranjeno', { exact: true })).toBeVisible();
    await expect(page.getByText('Predlagano prileganje', { exact: true })).toBeVisible();

    await page.getByTestId('logo-context-toolbar').getByRole('button', { name: 'Prileganje', exact: true }).click();
    const headerHeight = page.getByRole('spinbutton', {
      name: 'Višina logotipa za Glava · namizje'
    });
    await expect(headerHeight).toHaveAttribute('min', '8');
    await expect(headerHeight).toHaveAttribute('max', '64');
    await headerHeight.fill('14');
    await expect(headerHeight).toHaveValue('14');
    await expect(page.getByText('Višina: 14 px', { exact: true })).toBeVisible();
    await expect(page.getByText('Ročno prilagojeno', { exact: true })).toBeVisible();
    await page.locator('[data-logo-placement-option="header-tablet"]').click();
    await expect(page.getByText('Predlagano prileganje', { exact: true })).toBeVisible();
    await page.locator('[data-logo-placement-option="header-desktop"]').click();
    await page.getByTestId('logo-context-toolbar').getByRole('button', { name: 'Prileganje', exact: true }).click();
    await page.getByRole('button', { name: 'Uporabi predlagano prileganje' }).click();
    await expect(page.getByText('Predlagano prileganje', { exact: true })).toBeVisible();
  });

  test('Globalni parametri is the fourth podoba tab and its route loads', async ({ page }) => {
    await page.goto('/admin/podoba/glavna-stran');

    const tabs = page.getByRole('tab');
    await expect(tabs).toHaveCount(5);
    await expect(tabs.nth(0)).toHaveText('Glavna stran');
    await expect(tabs.nth(1)).toHaveText('Navigacija');
    await expect(tabs.nth(2)).toHaveText('Logotip');
    await expect(tabs.nth(3)).toHaveText('Globalni parametri');
    await expect(tabs.nth(4)).toHaveText('Artikli');

    await tabs.nth(3).click();
    await expect(page).toHaveURL(/\/admin\/podoba\/globalni-parametri\/?$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Globalni parametri' })).toBeVisible({
      timeout: 15_000
    });
    await expect(page.getByRole('tab', { name: 'Globalni parametri' })).toHaveAttribute('aria-selected', 'true');

    const elementTabs = page.getByRole('tablist', { name: 'Elementi globalnih parametrov' });
    await elementTabs.getByRole('tab', { name: /^Osnovno besedilo/ }).click();
    const bodyFontSelect = getAppearanceEditorCompactSelect(page, 'Osnovna pisava');
    await expect(bodyFontSelect).toBeVisible();
    await expect.poll(() => readAppearanceEditorCompactSelectOptions(page, bodyFontSelect)).toEqual(
      expect.arrayContaining(['IBM Plex Sans', 'Manrope', 'Bitter'])
    );
  });

  test('global parameters use an element-centric live editor', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin/podoba/globalni-parametri');

    await expect(page.getByRole('tablist', { name: 'Skupine globalnih parametrov' })).toHaveCount(0);

    const elementSidebar = page.getByTestId('global-parameter-element-list');
    const workspace = page.getByTestId('global-parameter-workspace');
    const settings = workspace.getByTestId('global-parameter-settings');
    const preview = workspace.locator('[data-global-parameters-preview]');
    const elementTabs = elementSidebar.getByRole('tablist', { name: 'Elementi globalnih parametrov' });

    await expect(elementSidebar).toBeVisible();
    await expect(workspace).toBeVisible();
    await expect(settings).toBeVisible();
    await expect(preview).toBeVisible();
    await expect(elementTabs.getByRole('tab')).toHaveCount(18);

    const [sidebarBox, workspaceBox] = await Promise.all([
      elementSidebar.boundingBox(),
      workspace.boundingBox()
    ]);
    expect(sidebarBox).not.toBeNull();
    expect(workspaceBox).not.toBeNull();
    expect(workspaceBox!.x).toBeGreaterThan(sidebarBox!.x);
    expect(workspaceBox!.width).toBeGreaterThan(sidebarBox!.width * 2);

    const reachableSettingPaths: string[] = [];
    for (const elementTab of await elementTabs.getByRole('tab').all()) {
      await elementTab.click();
      const visiblePaths = await settings.locator('[data-global-style-setting]').evaluateAll((elements) => (
        elements.map((element) => element.getAttribute('data-global-style-setting')).filter((value): value is string => Boolean(value))
      ));
      reachableSettingPaths.push(...visiblePaths);
    }
    expect(reachableSettingPaths).toHaveLength(86);
    expect(new Set(reachableSettingPaths).size).toBe(86);

    const buttonTab = elementTabs.getByRole('tab', { name: /^Gumb/ });
    await buttonTab.click();
    await expect(buttonTab).toHaveAttribute('aria-selected', 'true');
    await expect(preview).toHaveAttribute('data-active-global-element', 'button');

    const buttonHeightSetting = settings.locator('[data-global-style-setting="buttons.heightPx"]');
    const buttonHeightInput = buttonHeightSetting.getByRole('spinbutton');
    await expect(buttonHeightSetting).toBeVisible();

    const nextButtonHeight = Number(await buttonHeightInput.inputValue()) === 61 ? 62 : 61;
    await buttonHeightInput.fill(String(nextButtonHeight));
    await expect(buttonHeightInput).toHaveValue(String(nextButtonHeight));
    await expect.poll(async () => preview.evaluate((element) => (
      getComputedStyle(element).getPropertyValue('--site-button-height').trim()
    ))).toBe(`${nextButtonHeight}px`);
    await expect(page.getByText('Neshranjeno', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Shrani', exact: true })).toBeEnabled();

    const formFieldTab = elementTabs.getByRole('tab', { name: /^Vnosno polje/ });
    await formFieldTab.click();
    await expect(formFieldTab).toHaveAttribute('aria-selected', 'true');
    await expect(preview).toHaveAttribute('data-active-global-element', 'form-field');
    await expect(page.getByText('Fokusni obroč', { exact: true })).toHaveCount(0);

    const heightField = settings.locator('[data-global-style-setting="forms.heightPx"]').getByRole('spinbutton');
    await heightField.focus();
    await expect(heightField.locator('..')).toHaveCSS('box-shadow', 'none');
    await expect(preview.getByText('Fokusirano polje', { exact: true })).toHaveCSS('box-shadow', 'none');
  });
});
