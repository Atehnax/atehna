import { expect, test, type Locator, type Page } from '@playwright/test';
import type { LogoLibrary, LogoProject } from '../../src/shared/domain/logo/logoLibrary';
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

async function readLogoLibrary(page: Page): Promise<LogoLibrary> {
  const response = await page.request.get('/api/admin/logo-library');
  expect(response.ok()).toBe(true);
  return (await response.json() as { library: LogoLibrary }).library;
}

async function guardLogoPersistence(page: Page) {
  const writes: string[] = [];
  await page.route(/\/api\/admin\/(?:site-logo|logo-library)(?:\/|\?|$)/, async route => {
    const request = route.request();
    if (request.method() === 'GET' || (request.method() === 'POST'
      && new URL(request.url()).pathname === '/api/admin/logo-library'
      && request.postDataJSON()?.action === 'preview')) {
      await route.continue();
      return;
    }
    writes.push(request.method() + ' ' + new URL(request.url()).pathname);
    await route.abort('blockedbyclient');
  });
  page.on('dialog', dialog => dialog.accept());
  return writes;
}

async function importLocalLogoProject(page: Page, project: LogoProject) {
  const libraryDialog = page.getByRole('dialog', { name: 'Različice logotipa', exact: true });
  if (!await libraryDialog.isVisible()) await page.getByRole('button', { name: /^Različice/ }).click();
  const chooser = page.waitForEvent('filechooser');
  await libraryDialog.getByRole('button', { name: 'Uvozi projekt', exact: true }).click();
  await (await chooser).setFiles({ name: 'logo-editor-test.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
  await expect(libraryDialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Shrani osnutek', exact: true })).toBeEnabled();
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

  test('logo variants expose contextual layers and previews for every use case', async ({ page }) => {
    const writes = await guardLogoPersistence(page);
    const before = await readLogoLibrary(page);
    await page.goto('/admin/podoba/logotip');
    await expect(page.getByTestId('logo-library-editor')).toBeVisible();
    await expect(page.getByTestId('logo-editor-canvas')).toBeVisible();
    await expect(page.getByTestId('logo-layers')).toBeVisible();

    await page.getByRole('button', { name: 'Nova različica', exact: true }).click();
    const create = page.getByRole('dialog', { name: 'Nova različica', exact: true });
    const starters = create.getByRole('group', { name: 'Začetna sestava' });
    await expect(starters.getByRole('button')).toHaveCount(3);
    await starters.getByRole('button', { name: /^Besedilni logotip/ }).click();
    await expect(starters.getByRole('button', { name: /^Besedilni logotip/ })).toHaveAttribute('aria-pressed', 'true');
    await create.getByRole('button', { name: 'Prekliči', exact: true }).click();
    const originalName = await page.getByRole('textbox', { name: 'Ime različice', exact: true }).inputValue();
    await page.getByRole('button', { name: 'Kopija različice', exact: true }).click();
    await expect(create.getByRole('textbox', { name: 'Ime nove različice' })).toHaveValue(originalName + ' · kopija');
    await expect(create.getByRole('button', { name: 'Ustvari kopijo', exact: true })).toBeEnabled();
    await create.getByRole('button', { name: 'Prekliči', exact: true }).click();

    await page.locator('summary').filter({ hasText: /^Predogled v uporabi/ }).click();
    const placement = page.getByRole('combobox', { name: 'Mesto predogleda', exact: true });
    await expect(placement.locator('option')).toHaveCount(12);
    for (const purpose of ['header-desktop', 'footer-desktop', 'standalone', 'pdf-document', 'favicon']) {
      await placement.selectOption(purpose);
      await expect(page.locator('[data-logo-context-preview="' + purpose + '"]')).toBeVisible();
    }
    await page.locator('summary').filter({ hasText: /^Uporaba / }).click();
    const favicon = page.locator('[data-logo-placement-selector="favicon"]');
    const selection = favicon.getByRole('combobox');
    const initial = await selection.inputValue();
    await selection.selectOption(initial === 'fallback:none' ? 'fallback:original' : 'fallback:none');
    await expect(favicon.getByRole('button', { name: 'Uporabi', exact: true })).toBeEnabled();
    await favicon.getByRole('button', { name: 'Prekliči', exact: true }).click();
    await expect(selection).toHaveValue(initial);

    await page.getByRole('button', { name: 'Dodaj besedilo', exact: true }).click();
    const properties = page.getByTestId('logo-properties');
    await expect(properties.getByRole('textbox', { name: 'Vsebina besedila' })).toBeVisible();
    await expect(properties.getByRole('combobox', { name: 'Pisava', exact: true })).toBeVisible();
    const id = await properties.getAttribute('data-logo-inspector-layer');
    const layer = page.getByTestId('logo-layers').locator('[data-layer-row="' + id + '"]');
    const artwork = page.getByTestId('logo-editor-canvas').locator('[data-logo-layer="' + id + '"]');
    await layer.getByRole('button', { name: 'Skrij Besedilo', exact: true }).click();
    await expect(artwork).toHaveCount(0);
    await layer.getByRole('button', { name: 'Pokaži Besedilo', exact: true }).click();
    await expect(artwork).toBeVisible();
    await expect(page.getByRole('button', { name: 'Shrani osnutek', exact: true })).toBeEnabled();
    expect(writes).toEqual([]);
    expect(await readLogoLibrary(page)).toEqual(before);
  });

  test('logo resize, crop and move tools edit the canvas directly without saving sources', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 640 });
    const writes = await guardLogoPersistence(page);
    const before = await readLogoLibrary(page);
    const asset = before.assets.find(candidate => candidate.width > 100 && candidate.height > 100);
    expect(asset, 'The migrated canonical logo has an immutable image source.').toBeDefined();
    if (!asset) throw new Error('Canonical logo image source is missing.');
    const project: LogoProject = { version: 1, canvas: { width: 600, height: 300 }, layers: [{
      id: 'e2e-canvas-image', name: 'Preizkusna slika', type: 'image', assetId: asset.id,
      x: 100, y: 80, width: 300, height: 130, rotation: 0, opacity: 1, visible: true, locked: false,
      crop: { x: 0, y: 0, width: 1, height: 1 }, mask: 'rectangle'
    }] };
    await page.goto('/admin/podoba/logotip');
    await importLocalLogoProject(page, project);
    await page.getByTestId('logo-layers').getByRole('button', { name: 'Preizkusna slika', exact: true }).click();
    await page.getByRole('button', { name: 'Prilagodi pogledu', exact: true }).click();
    const canvas = page.getByTestId('logo-editor-canvas');
    const artwork = canvas.locator('[data-logo-layer="e2e-canvas-image"]');
    const properties = page.getByTestId('logo-properties');
    const width = properties.getByRole('spinbutton', { name: 'Širina sloja', exact: true });
    const height = properties.getByRole('spinbutton', { name: 'Višina sloja', exact: true });
    await expect(properties.getByRole('checkbox', { name: 'Ohrani razmerje stranic' })).toBeChecked();
    const initialBounds = await requireBoundingBox(artwork);
    await expect(canvas.locator('.moveable-control[data-direction="se"]')).toBeVisible();
    await dragBy(page, canvas.locator('.moveable-control[data-direction="se"]'), { x: 35, y: 20 });
    await expect.poll(async () => Number(await width.inputValue())).toBeGreaterThan(300);
    expect(Number(await width.inputValue()) / Number(await height.inputValue())).toBeCloseTo(300 / 130, 1);
    expect((await requireBoundingBox(artwork)).width).toBeGreaterThan(initialBounds.width);

    await page.getByRole('button', { name: 'Izreži izbrano sliko', exact: true }).click();
    const crop = page.getByRole('dialog', { name: 'Izreži sliko', exact: true });
    await expect(crop.locator('[data-crop-handle]')).toHaveCount(8);
    const cropDialogBounds = await requireBoundingBox(crop);
    expect(cropDialogBounds.x).toBeGreaterThanOrEqual(7);
    expect(cropDialogBounds.y).toBeGreaterThanOrEqual(7);
    expect(cropDialogBounds.x + cropDialogBounds.width).toBeLessThanOrEqual(1017);
    expect(cropDialogBounds.y + cropDialogBounds.height).toBeLessThanOrEqual(633);
    const frame = crop.getByRole('group', { name: 'Okvir izreza', exact: true });
    const cropBefore = await requireBoundingBox(frame);
    const sourceUrl = await crop.getByTestId('logo-crop-source').locator('img').getAttribute('src');
    await dragBy(page, crop.locator('[data-crop-handle="n"]'), { x: 0, y: Math.min(30, cropBefore.height * .2) });
    await expect.poll(async () => (await requireBoundingBox(frame)).height).toBeLessThan(cropBefore.height - 5);
    const heightBeforeCrop = Number(await height.inputValue());
    await crop.getByRole('button', { name: 'Uporabi izrez', exact: true }).click();
    await expect(crop).toBeHidden();
    await expect.poll(async () => Number(await height.inputValue())).toBeLessThan(heightBeforeCrop);
    await expect(artwork.locator('image')).toHaveAttribute('href', sourceUrl!);

    await properties.locator('summary').filter({ hasText: 'Položaj, zasuk in prosojnost' }).click();
    const x = properties.getByRole('spinbutton', { name: 'Položaj X', exact: true });
    const y = properties.getByRole('spinbutton', { name: 'Položaj Y', exact: true });
    const beforeMove = { x: Number(await x.inputValue()), y: Number(await y.inputValue()) };
    await dragBy(page, artwork, { x: 32, y: 18 });
    await expect.poll(async () => Number(await x.inputValue())).toBeGreaterThan(beforeMove.x);
    await expect.poll(async () => Number(await y.inputValue())).toBeGreaterThan(beforeMove.y);
    await expect(page.getByRole('button', { name: 'Shrani osnutek', exact: true })).toBeEnabled();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Shrani osnutek', exact: true })).toBeDisabled();
    expect(writes).toEqual([]);
    expect(await readLogoLibrary(page)).toEqual(before);
  });

  test('rendered logo bounds drive reversible fitting without changing source artwork', async ({ page }) => {
    const writes = await guardLogoPersistence(page);
    const before = await readLogoLibrary(page);
    const project: LogoProject = { version: 1, canvas: { width: 600, height: 240 }, layers: [{
      id: 'e2e-optical-shape', name: 'Vidna vsebina', type: 'shape', shape: 'rectangle',
      x: 130, y: 60, width: 160, height: 80, rotation: 0, opacity: 1, visible: true, locked: false,
      fill: '#111827', stroke: 'none', strokeWidth: 0, radius: 0
    }] };
    await page.goto('/admin/podoba/logotip');
    await importLocalLogoProject(page, project);
    await page.locator('summary').filter({ hasText: /^Predogled v uporabi/ }).click();
    await page.getByRole('combobox', { name: 'Mesto predogleda', exact: true }).selectOption('standalone');
    const preview = page.getByRole('region', { name: 'Predogled uporabe · Privzeti logotip', exact: true });
    await expect(preview.locator('[data-logo-visible-bounds]')).toBeVisible();
    await expect(preview.getByText(/Logotip vsebuje veliko praznega roba/)).toBeVisible();
    await preview.getByRole('button', { name: 'Obreži na vsebino', exact: true }).click();
    const properties = page.getByTestId('logo-properties');
    await expect(properties.getByRole('spinbutton', { name: 'Širina platna', exact: true })).toHaveValue('160');
    await expect(properties.getByRole('spinbutton', { name: 'Višina platna', exact: true })).toHaveValue('80');
    const artwork = page.getByTestId('logo-editor-canvas').locator('[data-logo-layer="e2e-optical-shape"]');
    await expect.poll(() => artwork.evaluate(element => ({
      width: (element as HTMLElement).style.width, height: (element as HTMLElement).style.height,
      transform: (element as HTMLElement).style.transform
    }))).toEqual({ width: '160px', height: '80px', transform: 'translate(0px, 0px) rotate(0deg)' });
    await page.getByRole('button', { name: 'Razveljavi', exact: true }).click();
    await expect(properties.getByRole('spinbutton', { name: 'Širina platna', exact: true })).toHaveValue('600');
    await expect(properties.getByRole('spinbutton', { name: 'Višina platna', exact: true })).toHaveValue('240');
    await expect(artwork).toHaveCSS('width', '160px');
    await page.getByRole('button', { name: 'Uveljavi', exact: true }).click();
    await expect(properties.getByRole('spinbutton', { name: 'Širina platna', exact: true })).toHaveValue('160');
    await expect(page.getByRole('button', { name: 'Shrani osnutek', exact: true })).toBeEnabled();
    expect(writes).toEqual([]);
    expect(await readLogoLibrary(page)).toEqual(before);
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
