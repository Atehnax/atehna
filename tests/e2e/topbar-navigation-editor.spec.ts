import { expect, test } from '@playwright/test';

test.describe('admin podoba redesign', () => {
  test('navigation top-bar X cells show start-end ranges and keep width editable', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('/admin/podoba/navigacija');

    const selectAll = page.getByRole('checkbox', { name: 'Izberi vse elemente v vrstici', exact: true });
    const tableHeader = selectAll.locator('..').locator('..');
    const xInput = page.getByRole('textbox', { name: 'X za Košarica', exact: true });
    const widthInput = page.getByRole('spinbutton', { name: 'Širina za Košarica', exact: true });
    const xUnit = xInput.locator('..').locator(':scope > span');
    const widthUnit = widthInput.locator('..').locator(':scope > span');

    await expect(selectAll).toBeVisible({ timeout: 15_000 });
    await expect(tableHeader.getByText('Širina', { exact: true })).toBeVisible();
    await expect(xInput).toBeVisible();
    await expect(xInput).toBeEditable();
    await expect(widthInput).toBeVisible();
    await expect(widthInput).toBeEditable();
    await expect(xUnit).toHaveText('px');
    await expect(widthUnit).toHaveText('px');

    const initialRange = (await xInput.inputValue()).match(/^(\d+)-(\d+)$/);
    expect(initialRange).not.toBeNull();
    const initialStart = Number(initialRange?.[1]);
    const initialEnd = Number(initialRange?.[2]);
    const initialWidth = Number(await widthInput.inputValue());
    expect(initialEnd - initialStart).toBe(initialWidth);

    const nextWidth = initialWidth >= 1192 ? initialWidth - 8 : initialWidth + 8;
    await widthInput.fill(String(nextWidth));
    await expect(widthInput).toHaveValue(String(nextWidth));
    await expect.poll(async () => {
      const range = (await xInput.inputValue()).match(/^(\d+)-(\d+)$/);
      return range ? Number(range[2]) - Number(range[1]) : null;
    }).toBe(nextWidth);

    const resizedRange = (await xInput.inputValue()).match(/^(\d+)-(\d+)$/);
    expect(resizedRange).not.toBeNull();
    const nextStart = Math.max(0, Number(resizedRange?.[1]) - 2);
    await xInput.fill(`${nextStart}-${nextStart + nextWidth}`);
    await xInput.press('Enter');
    await expect(xInput).toHaveValue(`${nextStart}-${nextStart + nextWidth}`);
    await expect(widthInput).toHaveValue(String(nextWidth));

    await xInput.fill(`${nextStart}-${nextStart + nextWidth + 7}`);
    await xInput.press('Enter');
    await expect(xInput).toHaveValue(`${nextStart}-${nextStart + nextWidth}`);
    await expect(widthInput).toHaveValue(String(nextWidth));
    await expect(xUnit).toHaveText('px');
    await expect(widthUnit).toHaveText('px');
  });

  test('navigation top-bar accepts a zero gutter shorthand and aligns X zero to the content edge', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('/admin/podoba/navigacija');

    const gutterInput = page.getByRole('textbox', { name: 'Min in Max odmik', exact: true });
    await expect(gutterInput).toBeVisible({ timeout: 15_000 });
    await gutterInput.fill('0');
    await gutterInput.press('Enter');
    await expect(gutterInput).toHaveValue('0-0');

    const edgeDelta = await page.evaluate(() => {
      const renderer = document.querySelector('[data-technical-topbar-renderer="true"]');
      const placementBounds = renderer?.querySelector('.topbar-placement-bounds');
      const logoLink = renderer?.querySelector('a[aria-label="Atehna home"]');
      const visibleBrand = logoLink?.querySelector(':scope > span');
      const cartButton = renderer?.querySelector('button[aria-label^="Ko"]');
      const cartWrapper = cartButton?.parentElement;
      if (
        !(placementBounds instanceof HTMLElement) ||
        !(logoLink instanceof HTMLElement) ||
        !(visibleBrand instanceof HTMLElement) ||
        !(cartButton instanceof HTMLElement) ||
        !(cartWrapper instanceof HTMLElement)
      ) {
        throw new Error('Predogled zgornje vrstice nima pričakovane geometrije.');
      }
      const boundsRect = placementBounds.getBoundingClientRect();
      return {
        link: Math.abs(logoLink.getBoundingClientRect().left - boundsRect.left),
        brand: Math.abs(visibleBrand.getBoundingClientRect().left - boundsRect.left),
        cartWrapper: Math.abs(cartWrapper.getBoundingClientRect().right - boundsRect.right),
        cartButton: Math.abs(cartButton.getBoundingClientRect().right - boundsRect.right)
      };
    });

    expect(edgeDelta.link).toBeLessThanOrEqual(1);
    expect(edgeDelta.brand).toBeLessThanOrEqual(1);
    expect(edgeDelta.cartWrapper).toBeLessThanOrEqual(1);
    expect(edgeDelta.cartButton).toBeLessThanOrEqual(1);

    const previewToggle = page.getByRole('switch', { name: 'Predogled', exact: true });
    await previewToggle.check();
    const pageLevelPreview = page.locator('[data-admin-site-header-preview="true"][data-preview-device="desktop"]');
    await expect(pageLevelPreview).toBeVisible();

    const pageLevelEdgeDelta = await page.evaluate(() => {
      const preview = document.querySelector('[data-admin-site-header-preview="true"][data-preview-device="desktop"]');
      const placementBounds = preview?.querySelector('.topbar-placement-bounds');
      const logoLink = preview?.querySelector('a[aria-label="Atehna home"]');
      const cartButton = preview?.querySelector('button[aria-label^="Ko"]');
      const adminContentLane = document.querySelector('main main > div.mx-auto');
      if (
        !(placementBounds instanceof HTMLElement)
        || !(logoLink instanceof HTMLElement)
        || !(cartButton instanceof HTMLElement)
        || !(adminContentLane instanceof HTMLElement)
      ) {
        throw new Error('Predogled strani nima pričakovane geometrije zgornje vrstice.');
      }

      const boundsRect = placementBounds.getBoundingClientRect();
      const contentLaneRect = adminContentLane.getBoundingClientRect();
      return {
        logoToBounds: Math.abs(logoLink.getBoundingClientRect().left - boundsRect.left),
        cartToBounds: Math.abs(cartButton.getBoundingClientRect().right - boundsRect.right),
        boundsToLaneLeft: Math.abs(boundsRect.left - contentLaneRect.left),
        boundsToLaneRight: Math.abs(boundsRect.right - contentLaneRect.right)
      };
    });

    expect(pageLevelEdgeDelta.logoToBounds).toBeLessThanOrEqual(1);
    expect(pageLevelEdgeDelta.cartToBounds).toBeLessThanOrEqual(1);
    expect(pageLevelEdgeDelta.boundsToLaneLeft).toBeLessThanOrEqual(1);
    expect(pageLevelEdgeDelta.boundsToLaneRight).toBeLessThanOrEqual(1);
    await expect(page.getByRole('textbox', { name: 'X za Logotip', exact: true })).toHaveValue('0-88');

    const selectedWidthLabel = page
      .getByTestId('top-bar-elements-table')
      .getByText(/^(?:Vsebina|Po meri|Celotna stran): \d+ px$/);
    await expect(selectedWidthLabel).toHaveCount(1);
    const selectedWidthText = await selectedWidthLabel.textContent();
    const selectedWidthPx = Number(selectedWidthText?.match(/(\d+)/)?.[1]);
    const cartXInput = page.getByRole('textbox', { name: 'X za Košarica', exact: true });
    const cartRange = (await cartXInput.inputValue()).match(/^(\d+)-(\d+)$/);

    expect(Number.isFinite(selectedWidthPx)).toBe(true);
    expect(cartRange).not.toBeNull();
    expect(Number(cartRange?.[2])).toBe(selectedWidthPx);

    const movedCartStartXPx = Math.max(0, Number(cartRange?.[1]) - 8);
    await cartXInput.fill(`${movedCartStartXPx}-${movedCartStartXPx + 32}`);
    await cartXInput.press('Enter');
    await expect(cartXInput).toHaveValue(`${movedCartStartXPx}-${movedCartStartXPx + 32}`);

    await cartXInput.fill(`${selectedWidthPx - 32}-${selectedWidthPx}`);
    await cartXInput.press('Enter');
    await expect(cartXInput).toHaveValue(`${selectedWidthPx - 32}-${selectedWidthPx}`);
  });

  test('navigation top-bar offsets match the rendered Search, AI and Cart control boxes', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('/admin/podoba/navigacija');

    const gutterInput = page.getByRole('textbox', { name: 'Min in Max odmik', exact: true });
    const searchXInput = page.getByRole('textbox', { name: 'X za Iskanje', exact: true });
    const aiXInput = page.getByRole('textbox', { name: 'X za Vprašaj AI', exact: true });
    const cartXInput = page.getByRole('textbox', { name: 'X za Košarica', exact: true });
    await expect(gutterInput).toBeVisible({ timeout: 15_000 });
    const headerPreviewSwitch = page.getByRole('switch', { name: 'Predogled', exact: true });
    await headerPreviewSwitch.check();
    await expect(headerPreviewSwitch).toBeChecked();

    await gutterInput.fill('0');
    await gutterInput.press('Enter');
    await expect(gutterInput).toHaveValue('0-0');

    const selectedWidthLabel = page
      .getByTestId('top-bar-elements-table')
      .getByText(/^(?:Vsebina|Po meri|Celotna stran): \d+ px$/);
    await expect(selectedWidthLabel).toHaveCount(1);
    const selectedWidthText = await selectedWidthLabel.textContent();
    const selectedWidthPx = Number(selectedWidthText?.match(/(\d+)/)?.[1]);
    expect(Number.isFinite(selectedWidthPx)).toBe(true);
    expect(selectedWidthPx).toBeGreaterThanOrEqual(210);

    const cartEndXPx = selectedWidthPx;
    const cartStartXPx = cartEndXPx - 32;
    const aiEndXPx = cartStartXPx - 15;
    const aiStartXPx = aiEndXPx - 116;
    const searchEndXPx = aiStartXPx - 15;
    const searchStartXPx = searchEndXPx - 32;

    await searchXInput.fill(`${searchStartXPx}-${searchEndXPx}`);
    await searchXInput.press('Enter');
    await aiXInput.fill(`${aiStartXPx}-${aiEndXPx}`);
    await aiXInput.press('Enter');
    await cartXInput.fill(`${cartStartXPx}-${cartEndXPx}`);
    await cartXInput.press('Enter');

    await expect(page.getByRole('spinbutton', { name: 'Levi odmik za Vprašaj AI', exact: true })).toHaveValue('15');
    await expect(page.getByRole('spinbutton', { name: 'Desni odmik za Vprašaj AI', exact: true })).toHaveValue('15');
    await expect(
      page.locator('[data-admin-site-header-preview="true"] button[aria-label="Išči"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-technical-topbar-renderer="true"] button[aria-label="Išči"]')
    ).toBeVisible();

    const renderedGaps = await page.evaluate(({ placementWidthPx, searchWidthPx, aiWidthPx, cartWidthPx }) => {
      const measure = (renderer: Element | null) => {
        const placementBounds = renderer?.querySelector('.topbar-placement-bounds');
        const searchButton = renderer?.querySelector('button[aria-label="Išči"]');
        const aiLink = renderer?.querySelector('a[href="/contact"]');
        const cartButton = renderer?.querySelector('button[aria-label^="Košarica"]');
        if (
          !(placementBounds instanceof HTMLElement)
          || !(searchButton instanceof HTMLElement)
          || !(aiLink instanceof HTMLElement)
          || !(cartButton instanceof HTMLElement)
        ) {
          throw new Error('Predogled nima pričakovanih kontrol zgornje vrstice.');
        }

        const placementWrapper = (control: HTMLElement) => {
          let wrapper = control;
          while (wrapper.parentElement && wrapper.parentElement !== placementBounds) {
            wrapper = wrapper.parentElement;
          }
          if (wrapper.parentElement !== placementBounds) {
            throw new Error('Kontrola ni znotraj pričakovanega pozicijskega ovoja.');
          }
          return wrapper;
        };

        const boundsRect = placementBounds.getBoundingClientRect();
        const searchRect = searchButton.getBoundingClientRect();
        const aiRect = aiLink.getBoundingClientRect();
        const cartRect = cartButton.getBoundingClientRect();
        const searchWrapperRect = placementWrapper(searchButton).getBoundingClientRect();
        const aiWrapperRect = placementWrapper(aiLink).getBoundingClientRect();
        const cartWrapperRect = placementWrapper(cartButton).getBoundingClientRect();
        const toPlacementX = (viewportX: number) =>
          ((viewportX - boundsRect.left) / boundsRect.width) * placementWidthPx;
        const toControlWidth = (
          controlRect: DOMRect,
          wrapperRect: DOMRect,
          configuredWidthPx: number
        ) => (controlRect.width / wrapperRect.width) * configuredWidthPx;
        const searchControlWidth = toControlWidth(searchRect, searchWrapperRect, searchWidthPx);
        const aiControlWidth = toControlWidth(aiRect, aiWrapperRect, aiWidthPx);
        const cartControlWidth = toControlWidth(cartRect, cartWrapperRect, cartWidthPx);
        const searchStartX = toPlacementX(searchWrapperRect.left);
        const aiStartX = toPlacementX(aiWrapperRect.left);
        const cartRightInset = toPlacementX(boundsRect.right) - toPlacementX(cartWrapperRect.right);
        const cartStartX = placementWidthPx - cartRightInset - cartControlWidth;

        return {
          searchWidth: searchControlWidth,
          leftGap: aiStartX - (searchStartX + searchControlWidth),
          rightGap: cartStartX - (aiStartX + aiControlWidth)
        };
      };

      return {
        pageLevel: measure(document.querySelector('[data-admin-site-header-preview="true"]')),
        technical: measure(document.querySelector('[data-technical-topbar-renderer="true"]'))
      };
    }, {
      placementWidthPx: selectedWidthPx,
      searchWidthPx: 32,
      aiWidthPx: 116,
      cartWidthPx: 32
    });

    for (const gaps of [renderedGaps.pageLevel, renderedGaps.technical]) {
      expect(Math.abs(gaps.searchWidth - 32)).toBeLessThan(0.25);
      expect(Math.abs(gaps.leftGap - 15)).toBeLessThan(0.75);
      expect(Math.abs(gaps.rightGap - 15)).toBeLessThan(0.75);
    }
  });

  test('navigation save preserves an edit made in flight and completes a second save', async ({ page }) => {
    type TopBarLayoutPayload = {
      responsive: {
        desktop: {
          items: Array<{ id: string; widthPx: number }>;
        };
      };
    };
    type NavigationPayload = {
      config: Record<string, unknown> & {
        topBarLayout: TopBarLayoutPayload;
        topBarInitialLayout: TopBarLayoutPayload;
      };
    };

    const savedPayloads: NavigationPayload[] = [];
    let releaseFirstSave: (() => void) | undefined;
    let signalFirstSaveStarted: (() => void) | undefined;
    const firstSaveGate = new Promise<void>((resolve) => { releaseFirstSave = resolve; });
    const firstSaveStarted = new Promise<void>((resolve) => { signalFirstSaveStarted = resolve; });

    await page.route('**/api/admin/site-navigation', async (route) => {
      if (route.request().method() !== 'PUT') {
        await route.continue();
        return;
      }

      const requestBody = route.request().postDataJSON() as NavigationPayload;
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
            updatedAt: `2026-07-18T13:00:0${savedPayloads.length}.000Z`
          }
        })
      });
    });

    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('/admin/podoba/navigacija');

    const widthInput = page.getByRole('spinbutton', { name: 'Širina za Košarica', exact: true });
    const saveButton = page.getByRole('button', { name: 'Shrani', exact: true });
    const setDefaultsButton = page.getByRole('button', { name: 'Nastavi kot privzete nastavitve', exact: true });
    await expect(widthInput).toBeVisible({ timeout: 15_000 });
    await expect(saveButton).toBeDisabled();

    const initialWidth = Number(await widthInput.inputValue());
    const firstWidth = initialWidth >= 1192 ? initialWidth - 8 : initialWidth + 8;
    const newerWidth = firstWidth >= 1196 ? firstWidth - 4 : firstWidth + 4;

    await widthInput.fill(String(firstWidth));
    await expect(saveButton).toBeEnabled();

    const firstSaveClick = saveButton.click();
    await firstSaveStarted;
    await firstSaveClick;
    await expect(saveButton).toBeDisabled();
    await expect(setDefaultsButton).toBeDisabled();

    await widthInput.fill(String(newerWidth));
    await expect(widthInput).toHaveValue(String(newerWidth));
    releaseFirstSave?.();

    await expect(setDefaultsButton).toBeEnabled();
    await expect(widthInput).toHaveValue(String(newerWidth));
    await expect(saveButton).toBeEnabled();

    const firstSavedCart = savedPayloads[0]?.config.topBarLayout.responsive.desktop.items.find((item) => item.id === 'cart');
    expect(firstSavedCart?.widthPx).toBe(firstWidth);

    await saveButton.click();
    await expect.poll(() => savedPayloads.length).toBe(2);
    await expect(setDefaultsButton).toBeEnabled();
    await expect(widthInput).toHaveValue(String(newerWidth));
    await expect(saveButton).toBeDisabled();

    const secondSavedCart = savedPayloads[1]?.config.topBarLayout.responsive.desktop.items.find((item) => item.id === 'cart');
    expect(secondSavedCart?.widthPx).toBe(newerWidth);
  });

  test('setting the current navigation top bar as defaults persists the reset baseline', async ({ page }) => {
    type TopBarLayoutPayload = {
      responsive: {
        desktop: {
          items: Array<{ id: string; widthPx: number }>;
        };
      };
    };
    type NavigationPayload = {
      config: Record<string, unknown> & {
        topBarLayout: TopBarLayoutPayload;
        topBarInitialLayout: TopBarLayoutPayload;
      };
    };

    const savedPayloads: NavigationPayload[] = [];
    await page.route('**/api/admin/site-navigation', async (route) => {
      if (route.request().method() !== 'PUT') {
        await route.continue();
        return;
      }

      const requestBody = route.request().postDataJSON() as NavigationPayload;
      savedPayloads.push(requestBody);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          config: {
            ...requestBody.config,
            updatedAt: '2026-07-18T13:10:00.000Z'
          }
        })
      });
    });

    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('/admin/podoba/navigacija');

    const topBarHeader = page.getByRole('heading', { level: 2, name: 'Zgornja vrstica', exact: true }).locator('..').locator('..');
    const resetTopBarButton = topBarHeader.getByRole('button', { name: 'Privzete nastavitve', exact: true });
    const setDefaultsButton = topBarHeader.getByRole('button', { name: 'Nastavi kot privzete nastavitve', exact: true });
    const saveButton = page.getByRole('button', { name: 'Shrani', exact: true });
    const widthInput = page.getByRole('spinbutton', { name: 'Širina za Košarica', exact: true });
    await expect(widthInput).toBeVisible({ timeout: 15_000 });

    const initialWidth = Number(await widthInput.inputValue());
    const defaultWidth = initialWidth >= 1190 ? initialWidth - 10 : initialWidth + 10;
    const temporaryWidth = defaultWidth >= 1195 ? defaultWidth - 5 : defaultWidth + 5;

    await widthInput.fill(String(defaultWidth));
    await expect(saveButton).toBeEnabled();
    await setDefaultsButton.click();

    await expect.poll(() => savedPayloads.length).toBe(1);
    await expect(page.getByText('Privzete nastavitve zgornje vrstice so shranjene.', { exact: true })).toBeVisible();
    await expect(setDefaultsButton).toBeEnabled();
    await expect(saveButton).toBeDisabled();

    const savedConfig = savedPayloads[0]!.config;
    const savedCart = savedConfig.topBarLayout.responsive.desktop.items.find((item) => item.id === 'cart');
    expect(savedCart?.widthPx).toBe(defaultWidth);
    expect(savedConfig.topBarInitialLayout).toEqual(savedConfig.topBarLayout);

    await widthInput.fill(String(temporaryWidth));
    await expect(widthInput).toHaveValue(String(temporaryWidth));
    await expect(saveButton).toBeEnabled();
    await resetTopBarButton.click();

    await expect(widthInput).toHaveValue(String(defaultWidth));
    await expect(saveButton).toBeDisabled();
    expect(savedPayloads).toHaveLength(1);
  });
});
