import { expect, test, type Page } from '@playwright/test';

type LandingConfig = Record<string, unknown> & {
  updatedAt?: string | null;
  canvas: {
    elements: Record<string, unknown>;
    deletedElementIds: string[];
  };
};

type LandingRequest = {
  config: LandingConfig;
  expectedUpdatedAt?: string | null;
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

async function openLandingEditor(page: Page) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/admin/podoba/glavna-stran');

  const stage = page.getByTestId('homepage-preview-stage');
  await expect(stage).toHaveAttribute('data-preview-ready', 'true', { timeout: 15_000 });
  return {
    stage,
    toolbar: page.getByTestId('homepage-context-toolbar'),
    saveButton: page.getByRole('button', { name: 'Shrani spremembe', exact: true })
  };
}

async function stageCategoryHeadingDeletion(page: Page) {
  const heading = page.locator(
    '[data-testid="homepage-preview-live-layer"] [data-canvas-element-id="categories:heading"]'
  );
  await heading.scrollIntoViewIfNeeded();
  await expect(heading).toBeVisible();
  await heading.click();

  const toolbar = page.getByTestId('homepage-context-toolbar');
  await expect(toolbar.getByText('Naslov kategorij', { exact: true })).toBeVisible();
  await toolbar.getByRole('button', { name: 'Izbriši', exact: true }).click();

  // Delete is staged locally: the editor removes it from view immediately but
  // must not perform persistence until an explicit save action.
  await expect(heading).toBeHidden();
  return heading;
}

function expectCategoryHeadingAbsent(config: LandingConfig) {
  expect(config.canvas.elements).not.toHaveProperty('categories:heading');
  expect(config.canvas.deletedElementIds).toContain('categories:heading');
}

test.describe('landing editor staged element deletion', () => {
  test('Izbriši hides the selected element locally and Shrani commits its removal', async ({ page }) => {
    const writes = await guardAdminWrites(page);
    const requests: LandingRequest[] = [];

    await page.route('**/api/admin/landing-page', async (route) => {
      if (route.request().method() !== 'PUT') {
        await route.continue();
        return;
      }
      const body = route.request().postDataJSON() as LandingRequest;
      requests.push(body);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          config: { ...body.config, updatedAt: '2026-07-20T20:00:00.000Z' }
        })
      });
    });

    const { saveButton } = await openLandingEditor(page);
    const heading = await stageCategoryHeadingDeletion(page);

    expect(writes).toEqual([]);
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    await expect.poll(() => requests.length).toBe(1);
    expectCategoryHeadingAbsent(requests[0].config);
    expect(writes).toEqual([{ method: 'PUT', pathname: '/api/admin/landing-page' }]);
    await expect(heading).toBeHidden();
    await expect(saveButton).toBeDisabled();
  });

  test('Nastavi kot privzete nastavitve commits the staged deletion in its single request', async ({ page }) => {
    const writes = await guardAdminWrites(page);
    const requests: LandingRequest[] = [];

    await page.route('**/api/admin/landing-page/defaults', async (route) => {
      const body = route.request().postDataJSON() as LandingRequest;
      requests.push(body);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          config: { ...body.config, updatedAt: '2026-07-20T20:10:00.000Z' },
          defaults: { ...body.config, updatedAt: '2026-07-20T20:10:01.000Z' }
        })
      });
    });

    const { saveButton } = await openLandingEditor(page);
    const heading = await stageCategoryHeadingDeletion(page);

    expect(writes).toEqual([]);
    const setDefaultsButton = page.getByTestId('homepage-set-defaults');
    await expect(setDefaultsButton).toBeEnabled();
    await setDefaultsButton.click();

    await expect.poll(() => requests.length).toBe(1);
    expect(requests[0]).toHaveProperty('expectedUpdatedAt');
    expectCategoryHeadingAbsent(requests[0].config);
    expect(writes).toEqual([{ method: 'PUT', pathname: '/api/admin/landing-page/defaults' }]);
    await expect(heading).toBeHidden();
    await expect(saveButton).toBeDisabled();
  });

  test('a failed save keeps the deletion hidden, dirty, and available for retry', async ({ page }) => {
    const writes = await guardAdminWrites(page);
    const requests: LandingRequest[] = [];

    await page.route('**/api/admin/landing-page', async (route) => {
      if (route.request().method() !== 'PUT') {
        await route.continue();
        return;
      }
      const body = route.request().postDataJSON() as LandingRequest;
      requests.push(body);
      if (requests.length === 1) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Poskusno shranjevanje ni uspelo.' })
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          config: { ...body.config, updatedAt: '2026-07-20T20:20:00.000Z' }
        })
      });
    });

    const { saveButton } = await openLandingEditor(page);
    const heading = await stageCategoryHeadingDeletion(page);
    await saveButton.click();

    await expect.poll(() => requests.length).toBe(1);
    expectCategoryHeadingAbsent(requests[0].config);
    await expect(page.getByText('Poskusno shranjevanje ni uspelo.', { exact: true })).toBeVisible();
    await expect(heading).toBeHidden();
    await expect(page.getByText('Neshranjeno', { exact: true })).toBeVisible();
    await expect(saveButton).toBeEnabled();

    await saveButton.click();
    await expect.poll(() => requests.length).toBe(2);
    expectCategoryHeadingAbsent(requests[1].config);
    expect(writes).toEqual([
      { method: 'PUT', pathname: '/api/admin/landing-page' },
      { method: 'PUT', pathname: '/api/admin/landing-page' }
    ]);
  });

  test('category media keeps its separate Odstrani sliko action and category-only save path', async ({ page }) => {
    const writes = await guardAdminWrites(page);
    const categoryRequests: Array<{
      updates: Array<{ categorySlug: string; image?: string | null }>;
    }> = [];

    await page.route('**/api/admin/categories/images', async (route) => {
      if (route.request().method() !== 'PATCH') {
        await route.continue();
        return;
      }
      const body = route.request().postDataJSON() as {
        updates: Array<{ categorySlug: string; image?: string | null; presentation: unknown }>;
      };
      categoryRequests.push(body);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ updates: body.updates })
      });
    });

    const { toolbar, saveButton } = await openLandingEditor(page);
    const categoryImage = page.locator(
      '[data-testid="homepage-preview-live-layer"] [data-canvas-element-id^="categories:image:"]'
    ).first();
    await categoryImage.scrollIntoViewIfNeeded();
    await expect(categoryImage).toBeVisible();
    const imageElementId = await categoryImage.getAttribute('data-canvas-element-id');
    expect(imageElementId).toMatch(/^categories:image:/);

    await categoryImage.click();
    await expect(toolbar.getByRole('button', { name: 'Odstrani sliko', exact: true })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Izbriši', exact: true })).toHaveCount(0);
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toBe('Odstranim sliko te kategorije? Sprememba bo potrjena ob shranjevanju.');
      await dialog.accept();
    });
    await toolbar.getByRole('button', { name: 'Odstrani sliko', exact: true }).click();

    expect(writes).toEqual([]);
    await expect(page.locator(`[data-canvas-element-id="${imageElementId}"]`)).toHaveCount(1);
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    await expect.poll(() => categoryRequests.length).toBe(1);
    expect(categoryRequests[0].updates).toHaveLength(1);
    expect(categoryRequests[0].updates[0].categorySlug).toBe(imageElementId!.slice('categories:image:'.length));
    expect(categoryRequests[0].updates[0].image).toBeNull();
    expect(writes).toEqual([{ method: 'PATCH', pathname: '/api/admin/categories/images' }]);
  });
});
