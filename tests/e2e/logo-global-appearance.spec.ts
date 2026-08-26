import { expect, test } from '@playwright/test';
import {
  getAppearanceEditorCompactSelect,
  readAppearanceEditorCompactSelectOptions
} from './support/appearance-editor-compact-select';

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

    await page.getByTestId('logo-context-toolbar').getByRole('button', { name: 'Prileganje' }).click();
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
    await page.getByTestId('logo-context-toolbar').getByRole('button', { name: 'Prileganje' }).click();
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
