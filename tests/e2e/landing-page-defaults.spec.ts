import { expect, test, type Page } from '@playwright/test';

type LandingConfig = Record<string, unknown> & {
  updatedAt?: string | null;
  hero: {
    responsive: {
      desktop: {
        titleFontSizePx: number;
      };
    };
  };
  canvas: {
    elements: Record<string, {
      responsive: {
        desktop: {
          fontSizePx: number;
        };
      };
    }>;
  };
};

type DefaultsRequest = {
  config: LandingConfig;
  expectedUpdatedAt: string | null;
};

type AdminWrite = {
  method: string;
  pathname: string;
};

const writeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

async function guardAdminWrites(page: Page) {
  const writes: AdminWrite[] = [];

  page.on('request', (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.startsWith('/api/admin/') && writeMethods.has(request.method())) {
      writes.push({ method: request.method(), pathname });
    }
  });

  await page.route('**/api/admin/**', async (route) => {
    const request = route.request();
    if (!writeMethods.has(request.method())) {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ message: `Unexpected ${request.method()} ${new URL(request.url()).pathname}` })
    });
  });

  return writes;
}

async function openHeroTitleStyle(page: Page) {
  const stage = page.getByTestId('homepage-preview-stage');
  await expect(stage).toHaveAttribute('data-preview-ready', 'true', { timeout: 15_000 });

  const title = page.locator(
    '[data-testid="homepage-preview-live-layer"] [data-canvas-element-id="hero:title"]'
  );
  await title.click();

  const toolbar = page.getByTestId('homepage-context-toolbar');
  await toolbar.getByRole('button', { name: 'Slog besedila', exact: true }).click();
  const fontSize = page.getByRole('spinbutton', { name: 'Velikost px', exact: true });
  await expect(fontSize).toBeVisible();
  return fontSize;
}

function differentFontSize(current: number, delta = 1) {
  return current + delta > 240 ? current - delta : current + delta;
}

async function acceptSavedDefaultsReset(page: Page) {
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toBe('Ponastavim glavno stran na shranjene privzete nastavitve?');
    await dialog.accept();
  });
  await page.getByRole('button', { name: 'Privzeto', exact: true }).click();
}

async function openCategoryPresentation(page: Page) {
  const scrollRegion = page.getByTestId('homepage-preview-scroll-region');
  await scrollRegion.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });

  const tile = page.locator('[data-homepage-category-card][data-category-slug]').first();
  await expect(tile).toBeVisible({ timeout: 15_000 });
  const categorySlug = await tile.getAttribute('data-category-slug');
  expect(categorySlug).toBeTruthy();

  await tile.hover();
  await tile.getByTestId(`homepage-category-edit-appearance-${categorySlug}`).click();

  const controls = page.locator(`[data-category-media-controls="${categorySlug}"]`);
  const offsetX = controls.locator('[data-category-media-field="offset-x"]');
  await expect(offsetX).toBeVisible();

  return { controls, offsetX };
}

async function stageCategoryPresentationEdit(page: Page) {
  const { controls, offsetX } = await openCategoryPresentation(page);
  const initialOffsetX = Number(await offsetX.inputValue());
  const changedOffsetX = initialOffsetX >= 95 ? initialOffsetX - 1 : initialOffsetX + 1;
  await offsetX.fill(String(changedOffsetX));

  return { controls, offsetX, changedOffsetX };
}

test.describe('landing-page saved defaults', () => {
  test('the accessible action sits at the far right and saves one durable baseline request', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    const writes = await guardAdminWrites(page);
    const defaultsRequests: DefaultsRequest[] = [];
    const persistedUpdatedAt = '2026-07-20T18:00:00.000Z';
    const defaultsUpdatedAt = '2026-07-20T18:00:01.000Z';

    await page.route('**/api/admin/landing-page/defaults', async (route) => {
      const requestBody = route.request().postDataJSON() as DefaultsRequest;
      defaultsRequests.push(requestBody);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          config: { ...requestBody.config, updatedAt: persistedUpdatedAt },
          defaults: { ...requestBody.config, updatedAt: defaultsUpdatedAt }
        })
      });
    });

    await page.goto('/admin/podoba/glavna-stran');

    const previewControls = page.getByRole('group', { name: 'Odzivni predogled' });
    const previewRow = previewControls.locator('..');
    const setDefaultsButton = page.getByTestId('homepage-set-defaults');
    await expect(setDefaultsButton).toBeVisible();
    await expect(setDefaultsButton).toBeEnabled();
    await expect(setDefaultsButton).toHaveAccessibleName('Nastavi kot privzete nastavitve');
    await expect(previewRow.getByTestId('homepage-set-defaults')).toHaveCount(1);

    const [rowBox, controlsBox, buttonBox] = await Promise.all([
      previewRow.boundingBox(),
      previewControls.boundingBox(),
      setDefaultsButton.boundingBox()
    ]);
    expect(rowBox).not.toBeNull();
    expect(controlsBox).not.toBeNull();
    expect(buttonBox).not.toBeNull();
    expect(buttonBox!.x).toBeGreaterThan(controlsBox!.x + controlsBox!.width);
    expect(Math.abs(
      (buttonBox!.y + buttonBox!.height / 2) - (controlsBox!.y + controlsBox!.height / 2)
    )).toBeLessThanOrEqual(2);
    expect(
      rowBox!.x + rowBox!.width - (buttonBox!.x + buttonBox!.width)
    ).toBeLessThanOrEqual(20);

    const fontSize = await openHeroTitleStyle(page);
    const initialFontSize = Number(await fontSize.inputValue());
    const defaultFontSize = differentFontSize(initialFontSize);
    await fontSize.fill(String(defaultFontSize));
    await expect(page.getByRole('button', { name: 'Shrani spremembe', exact: true })).toBeEnabled();

    await setDefaultsButton.click();

    await expect.poll(() => defaultsRequests.length).toBe(1);
    await expect(page.getByText('Privzete nastavitve glavne strani so shranjene.', { exact: true })).toBeVisible();
    await expect(page.getByText('Objavljeno', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Shrani spremembe', exact: true })).toBeDisabled();
    expect(defaultsRequests[0]).toHaveProperty('expectedUpdatedAt');
    expect(defaultsRequests[0].expectedUpdatedAt).toBe(defaultsRequests[0].config.updatedAt ?? null);
    expect(defaultsRequests[0].config.hero.responsive.desktop.titleFontSizePx).toBe(defaultFontSize);
    expect(
      defaultsRequests[0].config.canvas.elements['hero:title'].responsive.desktop.fontSizePx
    ).toBe(defaultFontSize);
    expect(writes).toEqual([
      { method: 'PUT', pathname: '/api/admin/landing-page/defaults' }
    ]);

    const persistedFontSize = await openHeroTitleStyle(page);
    const temporaryFontSize = differentFontSize(defaultFontSize, 2);
    await persistedFontSize.fill(String(temporaryFontSize));
    await expect(page.getByText('Neshranjeno', { exact: true })).toBeVisible();
    await acceptSavedDefaultsReset(page);

    const restoredFontSize = await openHeroTitleStyle(page);
    await expect(restoredFontSize).toHaveValue(String(defaultFontSize));
    await expect(page.getByText('Objavljeno', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Shrani spremembe', exact: true })).toBeDisabled();
    expect(defaultsRequests).toHaveLength(1);
    expect(writes).toEqual([
      { method: 'PUT', pathname: '/api/admin/landing-page/defaults' }
    ]);
  });

  test('setting landing defaults keeps a category draft local and performs no image or footer writes', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    const writes = await guardAdminWrites(page);
    const defaultsRequests: DefaultsRequest[] = [];

    await page.route('**/api/admin/landing-page/defaults', async (route) => {
      const requestBody = route.request().postDataJSON() as DefaultsRequest;
      defaultsRequests.push(requestBody);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          config: { ...requestBody.config, updatedAt: '2026-07-20T18:10:00.000Z' },
          defaults: { ...requestBody.config, updatedAt: '2026-07-20T18:10:01.000Z' }
        })
      });
    });

    await page.goto('/admin/podoba/glavna-stran');
    const fontSize = await openHeroTitleStyle(page);
    const initialFontSize = Number(await fontSize.inputValue());
    const defaultFontSize = differentFontSize(initialFontSize);
    await fontSize.fill(String(defaultFontSize));
    await page.getByRole('button', { name: 'Zapri', exact: true }).click();

    const categoryDraft = await stageCategoryPresentationEdit(page);
    await page.getByTestId('homepage-set-defaults').click();

    await expect.poll(() => defaultsRequests.length).toBe(1);
    await expect(page.getByText('Privzete nastavitve glavne strani so shranjene.', { exact: true })).toBeVisible();
    const preservedDraft = await openCategoryPresentation(page);
    await expect(preservedDraft.offsetX).toHaveValue(String(categoryDraft.changedOffsetX));
    await expect(page.getByText('Neshranjeno', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Shrani spremembe', exact: true })).toBeEnabled();
    expect(writes).toEqual([
      { method: 'PUT', pathname: '/api/admin/landing-page/defaults' }
    ]);

    await acceptSavedDefaultsReset(page);
    await expect(page.getByText('Neshranjeno', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Shrani spremembe', exact: true })).toBeEnabled();

    const reopenedDraft = await openCategoryPresentation(page);
    await expect(reopenedDraft.offsetX).toHaveValue(String(categoryDraft.changedOffsetX));
    expect(defaultsRequests).toHaveLength(1);
    expect(writes).toEqual([
      { method: 'PUT', pathname: '/api/admin/landing-page/defaults' }
    ]);
  });

  test('a stale defaults response preserves the draft and the previous reset baseline', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    const writes = await guardAdminWrites(page);
    const defaultsRequests: DefaultsRequest[] = [];

    await page.route('**/api/admin/landing-page/defaults', async (route) => {
      defaultsRequests.push(route.request().postDataJSON() as DefaultsRequest);
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Glavna stran je bila medtem spremenjena. Osvežite stran in poskusite znova.'
        })
      });
    });

    await page.goto('/admin/podoba/glavna-stran');
    await acceptSavedDefaultsReset(page);
    const baselineFontSizeInput = await openHeroTitleStyle(page);
    const baselineFontSize = Number(await baselineFontSizeInput.inputValue());
    const saveButton = page.getByRole('button', { name: 'Shrani spremembe', exact: true });
    const baselineSaveEnabled = await saveButton.isEnabled();
    const baselineStatus = baselineSaveEnabled ? 'Neshranjeno' : 'Objavljeno';
    const rejectedFontSize = differentFontSize(baselineFontSize);
    await baselineFontSizeInput.fill(String(rejectedFontSize));

    const setDefaultsButton = page.getByTestId('homepage-set-defaults');
    await setDefaultsButton.click();

    await expect.poll(() => defaultsRequests.length).toBe(1);
    await expect(page.getByText(
      'Glavna stran je bila medtem spremenjena. Osvežite stran in poskusite znova.',
      { exact: true }
    )).toBeVisible();
    await expect(setDefaultsButton).toBeEnabled();
    await expect(page.getByText('Neshranjeno', { exact: true })).toBeVisible();
    await expect(saveButton).toBeEnabled();
    expect(defaultsRequests[0]).toHaveProperty('expectedUpdatedAt');
    expect(writes).toEqual([
      { method: 'PUT', pathname: '/api/admin/landing-page/defaults' }
    ]);

    const rejectedDraftFontSize = await openHeroTitleStyle(page);
    await expect(rejectedDraftFontSize).toHaveValue(String(rejectedFontSize));
    await acceptSavedDefaultsReset(page);
    const restoredFontSize = await openHeroTitleStyle(page);
    await expect(restoredFontSize).toHaveValue(String(baselineFontSize));
    await expect(page.getByText(baselineStatus, { exact: true })).toBeVisible();
    expect(await saveButton.isEnabled()).toBe(baselineSaveEnabled);
    expect(defaultsRequests).toHaveLength(1);
    expect(writes).toEqual([
      { method: 'PUT', pathname: '/api/admin/landing-page/defaults' }
    ]);
  });
});
