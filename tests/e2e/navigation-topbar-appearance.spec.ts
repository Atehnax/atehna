import { expect, test } from '@playwright/test';
import {
  chooseAppearanceEditorCompactSelectOption,
  getAppearanceEditorCompactSelect,
  readAppearanceEditorCompactSelectOptions,
  readAppearanceEditorCompactSelectValue
} from './support/appearance-editor-compact-select';

type TopBarAppearanceSettings = {
  backgroundColor: string;
  backgroundOpacityPercent: number;
  textColor: string;
  fontFamily: string;
  fontSizePx: number;
  fontWeight: number;
  fontStyle: string;
};

type TopBarLayoutPayload = {
  responsive: {
    desktop: { settings: TopBarAppearanceSettings };
    tablet: { settings: TopBarAppearanceSettings };
    mobile: { settings: TopBarAppearanceSettings };
  };
};

type NavigationSavePayload = {
  config: {
    topBarLayout: TopBarLayoutPayload;
    topBarInitialLayout: TopBarLayoutPayload;
    [key: string]: unknown;
  };
};

test.describe('Navigation top-bar appearance', () => {
  test('keeps section heading typography aligned and gives the top-bar heading row a full-width divider', async ({ page }) => {
    await page.setViewportSize({ width: 1329, height: 920 });
    await page.goto('/admin/podoba/navigacija');

    const topBarHeading = page
      .getByRole('heading', { level: 2, name: 'Zgornja vrstica', exact: true })
      .first();
    const mainMenuHeading = page.getByRole('heading', { level: 2, name: 'Glavni meni', exact: true });

    await expect(topBarHeading).toBeVisible({ timeout: 15_000 });
    await expect(mainMenuHeading).toBeVisible();

    const [topBarFontSize, mainMenuFontSize] = await Promise.all([
      topBarHeading.evaluate((element) => getComputedStyle(element).fontSize),
      mainMenuHeading.evaluate((element) => getComputedStyle(element).fontSize)
    ]);
    expect(mainMenuFontSize).toBe(topBarFontSize);

    const headingRow = topBarHeading.locator('xpath=../..');
    const dividerGeometry = await headingRow.evaluate((row) => {
      const section = row.parentElement;
      if (!(section instanceof HTMLElement)) throw new Error('The top-bar section is missing.');

      const rowBox = row.getBoundingClientRect();
      const sectionStyle = getComputedStyle(section);
      const rowStyle = getComputedStyle(row);
      const expectedContentWidth = section.clientWidth
        - Number.parseFloat(sectionStyle.paddingLeft)
        - Number.parseFloat(sectionStyle.paddingRight);

      return {
        rowWidth: rowBox.width,
        expectedContentWidth,
        borderBottomWidth: Number.parseFloat(rowStyle.borderBottomWidth),
        borderBottomStyle: rowStyle.borderBottomStyle,
        borderBottomColor: rowStyle.borderBottomColor
      };
    });

    expect(Math.abs(dividerGeometry.rowWidth - dividerGeometry.expectedContentWidth)).toBeLessThanOrEqual(1);
    expect(dividerGeometry.borderBottomWidth).toBeGreaterThan(0);
    expect(dividerGeometry.borderBottomStyle).toBe('solid');
    expect(dividerGeometry.borderBottomColor).not.toBe('rgba(0, 0, 0, 0)');

    const mobileDeviceButton = page.getByRole('button', { name: 'Mobilno', exact: true }).first();
    const deviceDivider = await mobileDeviceButton.locator('..').evaluate((group) => {
      const buttons = Array.from(group.querySelectorAll('button'));
      const firstButton = buttons[0]?.getBoundingClientRect();
      const lastButton = buttons.at(-1)?.getBoundingClientRect();
      const groupBox = group.getBoundingClientRect();
      const outerBox = group.parentElement?.getBoundingClientRect();
      const style = getComputedStyle(group);

      return {
        groupWidth: groupBox.width,
        buttonSpan: firstButton && lastButton ? lastButton.right - firstButton.left : 0,
        outerWidth: outerBox?.width ?? 0,
        borderBottomWidth: Number.parseFloat(style.borderBottomWidth),
        borderBottomStyle: style.borderBottomStyle,
        borderBottomColor: style.borderBottomColor
      };
    });

    expect(deviceDivider.borderBottomWidth).toBeGreaterThan(0);
    expect(deviceDivider.borderBottomStyle).toBe('solid');
    expect(deviceDivider.borderBottomColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(Math.abs(deviceDivider.groupWidth - deviceDivider.buttonSpan)).toBeLessThanOrEqual(1);
    expect(deviceDivider.groupWidth).toBeLessThan(deviceDivider.outerWidth / 2);
  });

  test('uses the full table height to give appearance and width controls comfortable vertical spacing', async ({ page }) => {
    await page.setViewportSize({ width: 1329, height: 920 });
    await page.goto('/admin/podoba/navigacija');

    const settingsPanel = page.getByTestId('top-bar-settings-panel');
    const appearance = page.getByTestId('top-bar-appearance-settings');
    const widthSettings = page.getByTestId('top-bar-width-settings');
    const dimensions = page.getByTestId('top-bar-dimensions-settings');
    const elementTable = page.getByTestId('top-bar-elements-table');

    await expect(settingsPanel).toBeVisible({ timeout: 15_000 });
    await expect(appearance).toBeVisible();
    await expect(widthSettings).toBeVisible();
    await expect(dimensions).toBeVisible();
    await expect(elementTable).toBeVisible();

    const background = appearance.locator('input[type="text"][aria-label="Ozadje zgornje vrstice"]');
    const textColor = appearance.locator('input[type="text"][aria-label="Barva besedila zgornje vrstice"]');
    const fontSize = appearance.getByRole('spinbutton', { name: 'Velikost pisave zgornje vrstice', exact: true });
    const widthHeading = widthSettings.getByText('Širina zgornje vrstice', { exact: true });
    const widthModes = widthSettings.getByRole('button', { name: 'Vsebina', exact: true });
    const height = dimensions.getByRole('spinbutton', { name: 'Višina', exact: true });
    const breakpoint = dimensions.getByRole('textbox', { name: 'Prelomna širina', exact: true });
    const gutter = dimensions.getByRole('textbox', { name: 'Min in Max odmik', exact: true });

    const measurable = async (locator: typeof settingsPanel, label: string) => {
      const box = await locator.boundingBox();
      if (!box) throw new Error(`${label} must be measurable.`);
      return box;
    };

    const [
      panelBox,
      tableBox,
      appearanceBox,
      appearanceHeadingBox,
      backgroundBox,
      textColorBox,
      fontSizeBox,
      widthBox,
      widthHeadingBox,
      widthModesBox,
      dimensionsBox,
      heightBox,
      breakpointBox,
      gutterBox
    ] = await Promise.all([
      measurable(settingsPanel, 'The settings panel'),
      measurable(elementTable, 'The element table'),
      measurable(appearance, 'The appearance section'),
      measurable(appearance.getByText('Videz', { exact: true }), 'The appearance heading'),
      measurable(background, 'The background field'),
      measurable(textColor, 'The text color field'),
      measurable(fontSize, 'The typography field'),
      measurable(widthSettings, 'The width section'),
      measurable(widthHeading, 'The width heading'),
      measurable(widthModes, 'The width mode controls'),
      measurable(dimensions, 'The dimensions section'),
      measurable(height, 'The height field'),
      measurable(breakpoint, 'The breakpoint field'),
      measurable(gutter, 'The gutter field')
    ]);

    expect(Math.abs(panelBox.y - tableBox.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(panelBox.height - tableBox.height)).toBeLessThanOrEqual(10);

    expect(backgroundBox.y - (appearanceHeadingBox.y + appearanceHeadingBox.height)).toBeGreaterThanOrEqual(6);
    expect(textColorBox.y - (backgroundBox.y + backgroundBox.height)).toBeGreaterThanOrEqual(8);
    expect(fontSizeBox.y - (textColorBox.y + textColorBox.height)).toBeGreaterThanOrEqual(8);
    expect(appearanceBox.y + appearanceBox.height - (fontSizeBox.y + fontSizeBox.height)).toBeGreaterThanOrEqual(8);

    expect(widthBox.y - (appearanceBox.y + appearanceBox.height)).toBeGreaterThanOrEqual(10);
    expect(widthModesBox.y - (widthHeadingBox.y + widthHeadingBox.height)).toBeGreaterThanOrEqual(6);
    expect(dimensionsBox.y - (widthBox.y + widthBox.height)).toBeGreaterThanOrEqual(10);

    expect(breakpointBox.y - (heightBox.y + heightBox.height)).toBeGreaterThanOrEqual(7);
    expect(gutterBox.y - (breakpointBox.y + breakpointBox.height)).toBeGreaterThanOrEqual(7);

    const unusedBottomSpace = panelBox.y + panelBox.height - (gutterBox.y + gutterBox.height);
    expect(unusedBottomSpace).toBeGreaterThanOrEqual(8);
    expect(unusedBottomSpace).toBeLessThanOrEqual(20);
    expect(await settingsPanel.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
  });

  test('keeps the settings panel level with the element table and contained at responsive widths', async ({ page }) => {
    await page.setViewportSize({ width: 1329, height: 920 });
    await page.goto('/admin/podoba/navigacija');

    const appearance = page.getByTestId('top-bar-appearance-settings');
    const settingsPanel = page.getByTestId('top-bar-settings-panel');
    const elementTableHeading = page.getByRole('heading', { level: 3, name: 'Elementi v vrstici', exact: true }).first();
    const elementTable = page.getByTestId('top-bar-elements-table');

    await expect(appearance).toBeVisible({ timeout: 15_000 });
    await expect(elementTableHeading).toBeVisible();

    const expectDesktopGridGeometry = async () => {
      const panelBox = await settingsPanel.boundingBox();
      const tableBox = await elementTable.boundingBox();
      if (!panelBox || !tableBox) {
        throw new Error('The top-bar settings panel and element table must both be measurable.');
      }

      expect(Math.abs(panelBox.y - tableBox.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(panelBox.height - tableBox.height)).toBeLessThanOrEqual(10);
      expect(await settingsPanel.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    };

    await expectDesktopGridGeometry();

    for (const device of [
      { button: 'Tablica', previewLabel: /Tablica · viewport:/ },
      { button: 'Mobilno', previewLabel: /Mobilno · viewport:/ }
    ]) {
      await page.getByRole('button', { name: device.button, exact: true }).first().click();
      await expect(page.getByText(device.previewLabel).first()).toBeVisible();
      await expectDesktopGridGeometry();
    }

    await page.getByRole('button', { name: 'Desktop', exact: true }).first().click();
    await expect(page.getByText(/Desktop · viewport:/).first()).toBeVisible();
    await expectDesktopGridGeometry();

    const customWidthMode = settingsPanel.getByRole('button', { name: 'Po meri', exact: true });
    await customWidthMode.click();
    const customWidth = settingsPanel.getByRole('spinbutton', { name: 'Po meri', exact: true });
    await expect(customWidth).toBeVisible();
    await expect(customWidth).toBeEnabled();
    await expectDesktopGridGeometry();

    await settingsPanel.getByRole('button', { name: 'Vsebina', exact: true }).click();
    await expect(customWidth).toHaveCount(0);
    await expectDesktopGridGeometry();

    const background = appearance.locator('input[type="text"][aria-label="Ozadje zgornje vrstice"]');
    const backgroundOpacity = appearance.getByRole('spinbutton', { name: 'Prosojnost ozadja zgornje vrstice', exact: true });
    const textColor = appearance.locator('input[type="text"][aria-label="Barva besedila zgornje vrstice"]');
    const fontFamily = getAppearanceEditorCompactSelect(appearance, 'Pisava zgornje vrstice');
    const fontSize = appearance.getByRole('spinbutton', { name: 'Velikost pisave zgornje vrstice', exact: true });
    const fontWeight = getAppearanceEditorCompactSelect(appearance, 'Debelina pisave zgornje vrstice');
    const fontStyle = getAppearanceEditorCompactSelect(appearance, 'Slog pisave zgornje vrstice');
    const appearanceControls = [background, backgroundOpacity, textColor, fontFamily, fontSize, fontWeight, fontStyle];

    for (const control of appearanceControls) {
      await expect(control).toBeVisible();
      await expect(control).toBeEnabled();
    }

    await expect(fontWeight).toHaveAttribute('aria-haspopup', 'listbox');
    await expect.poll(() => readAppearanceEditorCompactSelectOptions(page, fontWeight)).toEqual(
      ['300', '400', '500', '600', '700', '800', '900']
    );

    await background.fill('#1E293B');
    await backgroundOpacity.fill('47');
    await textColor.fill('#F8FAFC');
    await chooseAppearanceEditorCompactSelectOption(page, fontFamily, 'Georgia');
    await fontSize.fill('17');
    await chooseAppearanceEditorCompactSelectOption(page, fontWeight, '600');
    await chooseAppearanceEditorCompactSelectOption(page, fontStyle, 'italic');

    await expect(background).toHaveValue('#1E293B');
    await expect(backgroundOpacity).toHaveValue('47');
    await expect(textColor).toHaveValue('#F8FAFC');
    await expect.poll(() => readAppearanceEditorCompactSelectValue(fontFamily)).toBe('Georgia');
    await expect(fontSize).toHaveValue('17');
    await expect.poll(() => readAppearanceEditorCompactSelectValue(fontWeight)).toBe('600');
    await expect.poll(() => readAppearanceEditorCompactSelectValue(fontStyle)).toBe('italic');

    await expect(settingsPanel.getByRole('button', { name: 'Vsebina', exact: true })).toBeEnabled();
    await expect(settingsPanel.getByRole('button', { name: 'Po meri', exact: true })).toBeEnabled();
    await expect(settingsPanel.getByRole('button', { name: 'Celotna stran', exact: true })).toBeEnabled();
    await expect(settingsPanel.getByRole('spinbutton', { name: 'Višina', exact: true })).toBeEnabled();
    await expect(settingsPanel.getByRole('textbox', { name: 'Prelomna širina', exact: true })).toBeEnabled();
    await expect(settingsPanel.getByRole('textbox', { name: 'Min in Max odmik', exact: true })).toBeEnabled();

    await page.setViewportSize({ width: 1024, height: 1000 });
    await expect(settingsPanel).toBeVisible();
    await expect(elementTable).toBeVisible();

    const responsivePanelBox = await settingsPanel.boundingBox();
    const responsiveTableBox = await elementTable.boundingBox();
    if (!responsivePanelBox || !responsiveTableBox) {
      throw new Error('The responsive top-bar settings panel and element table must both be measurable.');
    }

    expect(responsivePanelBox.x).toBeGreaterThanOrEqual(0);
    expect(responsivePanelBox.x + responsivePanelBox.width).toBeLessThanOrEqual(1025);
    expect(Math.abs(responsivePanelBox.width - responsiveTableBox.width)).toBeLessThanOrEqual(2);

    const horizontalOverflow = await settingsPanel.evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(horizontalOverflow).toBeLessThanOrEqual(1);

    for (const control of appearanceControls) {
      const controlBox = await control.boundingBox();
      if (!controlBox) throw new Error('A responsive appearance control is not measurable.');
      expect(controlBox.x).toBeGreaterThanOrEqual(responsivePanelBox.x - 1);
      expect(controlBox.x + controlBox.width).toBeLessThanOrEqual(responsivePanelBox.x + responsivePanelBox.width + 1);
    }
  });

  test('keeps the controls compact, updates the shared header preview, and saves every appearance field', async ({ page }) => {
    const savedPayloads: NavigationSavePayload[] = [];

    await page.route('**/api/admin/site-navigation', async (route) => {
      if (route.request().method() !== 'PUT') {
        await route.continue();
        return;
      }

      const requestBody = route.request().postDataJSON() as NavigationSavePayload;
      savedPayloads.push(requestBody);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          config: {
            ...requestBody.config,
            updatedAt: '2026-07-20T12:00:00.000Z'
          }
        })
      });
    });

    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('/admin/podoba/navigacija');

    const appearance = page.getByTestId('top-bar-appearance-settings');
    const background = appearance.locator('input[type="text"][aria-label="Ozadje zgornje vrstice"]');
    const backgroundOpacity = appearance.getByRole('spinbutton', { name: 'Prosojnost ozadja zgornje vrstice', exact: true });
    const textColor = appearance.locator('input[type="text"][aria-label="Barva besedila zgornje vrstice"]');
    const fontFamily = getAppearanceEditorCompactSelect(appearance, 'Pisava zgornje vrstice');
    const fontSize = appearance.getByRole('spinbutton', { name: 'Velikost pisave zgornje vrstice', exact: true });
    const fontWeight = getAppearanceEditorCompactSelect(appearance, 'Debelina pisave zgornje vrstice');
    const fontStyle = getAppearanceEditorCompactSelect(appearance, 'Slog pisave zgornje vrstice');

    await expect(appearance).toBeVisible({ timeout: 15_000 });
    await expect(appearance.getByText('Videz', { exact: true })).toBeVisible();
    await expect(background).toBeVisible();
    await expect(backgroundOpacity).toBeVisible();
    await expect(textColor).toBeVisible();
    await expect(fontFamily).toBeVisible();
    await expect(fontSize).toBeVisible();
    await expect(fontWeight).toBeVisible();
    await expect(fontStyle).toBeVisible();

    const compactLayout = await Promise.all(
      [appearance, background, backgroundOpacity, textColor, fontFamily, fontSize, fontWeight, fontStyle].map(async (locator) => {
        const box = await locator.boundingBox();
        if (!box) throw new Error('The top-bar appearance control is not measurable.');
        return box;
      })
    );
    const [panelBox, backgroundBox, opacityBox, textColorBox, familyBox, sizeBox, weightBox, styleBox] = compactLayout;
    expect(panelBox.height).toBeLessThan(250);
    expect(Math.abs(backgroundBox.y - opacityBox.y)).toBeLessThanOrEqual(4);
    expect(Math.abs(textColorBox.y - familyBox.y)).toBeLessThanOrEqual(4);
    expect(Math.abs(sizeBox.y - weightBox.y)).toBeLessThanOrEqual(4);
    expect(Math.abs(sizeBox.y - styleBox.y)).toBeLessThanOrEqual(4);
    expect(textColorBox.y).toBeGreaterThan(backgroundBox.y + 20);
    expect(sizeBox.y).toBeGreaterThan(textColorBox.y + 20);

    const sharedHeader = page.locator('[data-technical-topbar-renderer="true"] header').first();
    await expect(sharedHeader).toBeVisible();
    const initialHeaderBox = await sharedHeader.boundingBox();
    if (!initialHeaderBox) throw new Error('The shared header is not measurable.');

    await background.fill('#18324A');
    await backgroundOpacity.fill('42');
    await textColor.fill('#F4D35E');
    await chooseAppearanceEditorCompactSelectOption(page, fontFamily, 'Georgia');
    await fontSize.fill('18');
    await chooseAppearanceEditorCompactSelectOption(page, fontWeight, '700');
    await chooseAppearanceEditorCompactSelectOption(page, fontStyle, 'italic');

    await expect.poll(() => sharedHeader.evaluate((element) => {
      const style = getComputedStyle(element);
      const textSurface = element.querySelector<HTMLElement>('nav button, nav a');
      if (!textSurface) throw new Error('The shared header navigation text surface is missing.');
      const textStyle = getComputedStyle(textSurface);
      const storefrontScale = Number.parseFloat(textStyle.getPropertyValue('--commercial-storefront-scale')) || 1;
      return {
        backgroundColor: style.backgroundColor,
        fontFamily: textStyle.fontFamily,
        logicalFontSize: Math.round(Number.parseFloat(textStyle.fontSize) * storefrontScale * 100) / 100,
        fontWeight: textStyle.fontWeight,
        fontStyle: textStyle.fontStyle,
        backgroundVariable: style.getPropertyValue('--topbar-background').trim(),
        backgroundOpacityVariable: style.getPropertyValue('--topbar-background-opacity').trim(),
        textColorVariable: style.getPropertyValue('--topbar-text-color').trim(),
        familyVariable: style.getPropertyValue('--topbar-font-family').trim(),
        sizeVariable: style.getPropertyValue('--topbar-font-size').trim(),
        weightVariable: style.getPropertyValue('--topbar-font-weight').trim(),
        styleVariable: style.getPropertyValue('--topbar-font-style').trim()
      };
    })).toEqual({
      backgroundColor: 'rgba(24, 50, 74, 0.42)',
      fontFamily: 'Georgia, "Times New Roman", serif',
      logicalFontSize: 18,
      fontWeight: '700',
      fontStyle: 'italic',
      backgroundVariable: '#18324A',
      backgroundOpacityVariable: '42%',
      textColorVariable: '#F4D35E',
      familyVariable: 'Georgia, "Times New Roman", serif',
      sizeVariable: '18px',
      weightVariable: '700',
      styleVariable: 'italic'
    });

    const navigationTrigger = sharedHeader.locator('nav button, nav a').first();
    const aiLabel = sharedHeader.getByText('Vprašaj AI', { exact: true }).first();
    const searchField = sharedHeader.locator('input[type="search"]').first();
    await expect(searchField).toHaveCount(1);

    await expect.poll(async () => Promise.all(
      [navigationTrigger, aiLabel, searchField].map((locator) => locator.evaluate((element) => {
        const style = getComputedStyle(element);
        const storefrontScale = Number.parseFloat(style.getPropertyValue('--commercial-storefront-scale')) || 1;
        return {
          color: style.color,
          fontFamily: style.fontFamily,
          logicalFontSize: Math.round(Number.parseFloat(style.fontSize) * storefrontScale * 100) / 100,
          fontWeight: style.fontWeight,
          fontStyle: style.fontStyle
        };
      }))
    )).toEqual(Array.from({ length: 3 }, () => ({
      color: 'rgb(244, 211, 94)',
      fontFamily: 'Georgia, "Times New Roman", serif',
      logicalFontSize: 18,
      fontWeight: '700',
      fontStyle: 'italic'
    })));

    const updatedHeaderBox = await sharedHeader.boundingBox();
    if (!updatedHeaderBox) throw new Error('The updated shared header is not measurable.');
    expect(Math.abs(updatedHeaderBox.height - initialHeaderBox.height)).toBeLessThanOrEqual(0.5);

    await page.getByRole('switch', { name: 'Predogled', exact: true }).first().click();
    const publicPreviewHeader = page.locator('[data-admin-site-header-preview="true"] header').first();
    await expect(publicPreviewHeader).toBeVisible();
    await expect.poll(() => publicPreviewHeader.evaluate((element) => {
      const style = getComputedStyle(element);
      const navigationTrigger = element.querySelector<HTMLElement>('nav button, nav a');
      if (!navigationTrigger) throw new Error('The public preview navigation trigger is missing.');
      return {
        backgroundColor: style.backgroundColor,
        backgroundVariable: style.getPropertyValue('--topbar-background').trim(),
        opacityVariable: style.getPropertyValue('--topbar-background-opacity').trim(),
        textColorVariable: style.getPropertyValue('--topbar-text-color').trim(),
        triggerColor: getComputedStyle(navigationTrigger).color
      };
    })).toEqual({
      backgroundColor: 'rgba(24, 50, 74, 0.42)',
      backgroundVariable: '#18324A',
      opacityVariable: '42%',
      textColorVariable: '#F4D35E',
      triggerColor: 'rgb(244, 211, 94)'
    });

    await page.getByRole('button', { name: 'Tablica', exact: true }).click();
    await background.fill('#0E7490');
    await backgroundOpacity.fill('65');
    await textColor.fill('#F8FAFC');
    await expect.poll(() => publicPreviewHeader.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        device: element.parentElement?.getAttribute('data-preview-device'),
        backgroundColor: style.backgroundColor,
        textColorVariable: style.getPropertyValue('--topbar-text-color').trim()
      };
    })).toEqual({
      device: 'tablet',
      backgroundColor: 'rgba(14, 116, 144, 0.65)',
      textColorVariable: '#F8FAFC'
    });

    await page.getByRole('button', { name: 'Mobilno', exact: true }).click();
    const mobileBaseline = {
      backgroundColor: await background.inputValue(),
      backgroundOpacityPercent: Number(await backgroundOpacity.inputValue()),
      textColor: await textColor.inputValue()
    };
    await page.getByRole('button', { name: 'Desktop', exact: true }).click();
    await expect(background).toHaveValue('#18324A');
    await expect(backgroundOpacity).toHaveValue('42');
    await expect(textColor).toHaveValue('#F4D35E');

    expect(savedPayloads).toHaveLength(0);
    const saveButton = page.getByRole('button', { name: 'Shrani', exact: true });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();
    await expect.poll(() => savedPayloads.length).toBe(1);

    expect(savedPayloads[0]?.config.topBarLayout.responsive.desktop.settings).toMatchObject({
      backgroundColor: '#18324A',
      backgroundOpacityPercent: 42,
      textColor: '#F4D35E',
      fontFamily: 'Georgia',
      fontSizePx: 18,
      fontWeight: 700,
      fontStyle: 'italic'
    });
    expect(savedPayloads[0]?.config.topBarLayout.responsive.tablet.settings).toMatchObject({
      backgroundColor: '#0E7490',
      backgroundOpacityPercent: 65,
      textColor: '#F8FAFC'
    });
    expect(savedPayloads[0]?.config.topBarLayout.responsive.mobile.settings).toMatchObject(mobileBaseline);
    await expect(saveButton).toBeDisabled();
  });

  test('keeps the logo font independent from the top-bar font in both header previews', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('/admin/podoba/navigacija');

    const appearance = page.getByTestId('top-bar-appearance-settings');
    const fontFamily = getAppearanceEditorCompactSelect(appearance, 'Pisava zgornje vrstice');
    const sharedHeader = page.locator('[data-technical-topbar-renderer="true"] header').first();
    const sharedLogo = sharedHeader.getByRole('link', { name: 'Atehna home', exact: true });
    const sharedNavigationTrigger = sharedHeader.locator('nav button, nav a').first();
    const previewSwitch = page.getByRole('switch', { name: 'Predogled', exact: true }).first();
    const publicPreviewHeader = page.locator('[data-admin-site-header-preview="true"] header').first();
    const publicPreviewLogo = publicPreviewHeader.getByRole('link', { name: 'Atehna home', exact: true });
    const publicPreviewNavigationTrigger = publicPreviewHeader.locator('nav button, nav a').first();
    const computedFontFamily = (locator: typeof sharedLogo) => locator.evaluate((element) => getComputedStyle(element).fontFamily);

    await expect(fontFamily).toBeVisible({ timeout: 15_000 });
    await expect(sharedLogo).toBeVisible();
    await expect(sharedNavigationTrigger).toBeVisible();
    const sharedLogoFontBefore = await computedFontFamily(sharedLogo);

    await previewSwitch.click();
    await expect(publicPreviewLogo).toBeVisible();
    const publicPreviewLogoFontBefore = await computedFontFamily(publicPreviewLogo);

    await previewSwitch.click();
    await expect(sharedLogo).toBeVisible();

    const selectedFamily = await readAppearanceEditorCompactSelectValue(fontFamily) === 'Georgia' ? 'Bitter' : 'Georgia';
    await chooseAppearanceEditorCompactSelectOption(page, fontFamily, selectedFamily);

    await expect.poll(() => computedFontFamily(sharedNavigationTrigger)).toContain(selectedFamily);
    await expect.poll(() => computedFontFamily(sharedLogo)).toBe(sharedLogoFontBefore);

    await previewSwitch.click();
    await expect(publicPreviewLogo).toBeVisible();
    await expect.poll(() => computedFontFamily(publicPreviewNavigationTrigger)).toContain(selectedFamily);
    await expect.poll(() => computedFontFamily(publicPreviewLogo)).toBe(publicPreviewLogoFontBefore);
  });

  test('stores opacity and text colour in the top-bar defaults and restores that baseline locally', async ({ page }) => {
    const savedPayloads: NavigationSavePayload[] = [];

    await page.route('**/api/admin/site-navigation', async (route) => {
      if (route.request().method() !== 'PUT') {
        await route.continue();
        return;
      }

      const requestBody = route.request().postDataJSON() as NavigationSavePayload;
      savedPayloads.push(requestBody);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          config: {
            ...requestBody.config,
            updatedAt: '2026-07-21T09:00:00.000Z'
          }
        })
      });
    });

    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('/admin/podoba/navigacija');

    const appearance = page.getByTestId('top-bar-appearance-settings');
    const background = appearance.locator('input[type="text"][aria-label="Ozadje zgornje vrstice"]');
    const backgroundOpacity = appearance.getByRole('spinbutton', { name: 'Prosojnost ozadja zgornje vrstice', exact: true });
    const textColor = appearance.locator('input[type="text"][aria-label="Barva besedila zgornje vrstice"]');
    await expect(background).toBeVisible({ timeout: 15_000 });

    const topBarSection = page
      .getByRole('heading', { level: 2, name: 'Zgornja vrstica', exact: true })
      .locator('..')
      .locator('..');
    const setDefaultsButton = topBarSection.getByRole('button', { name: 'Nastavi kot privzete nastavitve', exact: true });
    const resetButton = topBarSection.getByRole('button', { name: 'Privzete nastavitve', exact: true });
    const saveButton = page.getByRole('button', { name: 'Shrani', exact: true });

    const defaults = {
      backgroundColor: '#312E81',
      backgroundOpacityPercent: 38,
      textColor: '#FDE68A'
    };
    await background.fill(defaults.backgroundColor);
    await backgroundOpacity.fill(String(defaults.backgroundOpacityPercent));
    await textColor.fill(defaults.textColor);
    await expect(saveButton).toBeEnabled();

    await setDefaultsButton.click();
    await expect.poll(() => savedPayloads.length).toBe(1);
    expect(savedPayloads[0]?.config.topBarLayout.responsive.desktop.settings).toMatchObject(defaults);
    expect(savedPayloads[0]?.config.topBarInitialLayout.responsive.desktop.settings).toMatchObject(defaults);
    expect(savedPayloads[0]?.config.topBarInitialLayout).toEqual(savedPayloads[0]?.config.topBarLayout);
    await expect(saveButton).toBeDisabled();

    await background.fill('#0F172A');
    await backgroundOpacity.fill('91');
    await textColor.fill('#E2E8F0');
    await expect(saveButton).toBeEnabled();
    await resetButton.click();

    await expect(background).toHaveValue(defaults.backgroundColor);
    await expect(backgroundOpacity).toHaveValue(String(defaults.backgroundOpacityPercent));
    await expect(textColor).toHaveValue(defaults.textColor);
    await expect(saveButton).toBeDisabled();
    expect(savedPayloads).toHaveLength(1);
  });
});
