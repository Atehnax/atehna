import { expect, test, type Locator, type Page } from '@playwright/test';

type CategoryPresentationUpdate = {
  categoryId?: string;
  categorySlug: string;
  expectedRevision?: string;
  image?: string | null;
  presentation: Record<string, unknown>;
};

type CategoryPresentationPatch = {
  updates: CategoryPresentationUpdate[];
};

async function readSharedEditorContract(
  page: Page,
  controls: Locator,
  context: 'homepage' | 'category-preview'
) {
  const capabilities = ((await page
    .locator(`[data-category-showcase-editor="${context}"]`)
    .getAttribute('data-category-showcase-capabilities')) ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .sort();
  const fields = await controls.locator('[data-category-media-field]').evaluateAll((inputs) =>
    inputs
      .map((input) => ({
        field: input.getAttribute('data-category-media-field'),
        label: input.getAttribute('aria-label'),
        type: input.getAttribute('type'),
        min: input.getAttribute('min'),
        max: input.getAttribute('max'),
        step: input.getAttribute('step'),
        value: (input as HTMLInputElement).value
      }))
      .sort((first, second) => (first.field ?? '').localeCompare(second.field ?? ''))
  );
  const fitOptions = await controls.locator('[data-category-media-fit]').evaluateAll((buttons) =>
    buttons
      .map((button) => button.getAttribute('data-category-media-fit'))
      .filter(Boolean)
      .sort()
  );

  return {
    capabilities,
    fields,
    fitOptions,
    imageInputs: await controls.locator('input[type="file"][accept="image/*"]').count()
  };
}

test('homepage category appearance action reuses one staged shared editor and one image upload', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });

  const writes: string[] = [];
  const uploads: string[] = [];
  const presentationPatches: CategoryPresentationPatch[] = [];
  const authorizedUploadPathnames = new Set<string>();
  const uploadedImageUrl = '/images/categories/category-appearance-test.png';

  page.on('request', (request) => {
    const pathname = new URL(request.url()).pathname;
    if (
      pathname.startsWith('/api/admin/')
      && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method())
    ) {
      writes.push(`${request.method()} ${pathname}`);
    }
  });
  await page.route('**/api/admin/media', async (route) => {
    expect(route.request().method()).toBe('POST');
    const body = route.request().postDataJSON() as {
      type: string;
      payload: {
        pathname: string;
        clientPayload: string;
        multipart: boolean;
      };
    };
    const clientPayload = JSON.parse(body.payload.clientPayload) as {
      contentType: string;
      scope: string;
    };
    expect(body.type).toBe('blob.generate-presigned-url');
    expect(body.payload.multipart).toBe(false);
    expect(clientPayload.scope).toBe('category-image');
    expect(clientPayload.contentType).toBe('image/png');
    expect(body.payload.pathname).toMatch(/^catalog-categories\//u);
    authorizedUploadPathnames.add(body.payload.pathname);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        presignedUrl: `/api/e2e/public-media-upload?pathname=${encodeURIComponent(body.payload.pathname)}`
      })
    });
  });
  await page.route('**/api/e2e/public-media-upload?*', async (route) => {
    const request = route.request();
    expect(request.method()).toBe('PUT');
    expect(await request.headerValue('content-type')).toBe('image/png');
    const pathname = new URL(request.url()).searchParams.get('pathname') ?? '';
    expect(authorizedUploadPathnames.has(pathname)).toBe(true);
    uploads.push(pathname);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ url: uploadedImageUrl, pathname })
    });
  });
  await page.route('**/api/admin/categories/images', async (route) => {
    const request = route.request();
    if (request.method() === 'PATCH') {
      const payload = request.postDataJSON() as CategoryPresentationPatch;
      presentationPatches.push(payload);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, updates: payload.updates })
      });
      return;
    }
    await route.continue();
  });

  await page.goto('/admin/podoba/glavna-stran');
  const homepageTile = page.locator('[data-homepage-category-card][data-category-slug]').first();
  await expect(homepageTile).toBeVisible({ timeout: 15_000 });
  const categorySlug = await homepageTile.getAttribute('data-category-slug');
  const categoryTitle = (await homepageTile.locator('[data-testid="category-showcase-title"] h3').innerText()).trim();
  expect(categorySlug).toBeTruthy();
  expect(categoryTitle).toBeTruthy();

  await homepageTile.hover();
  const appearanceAction = homepageTile.getByTestId(`homepage-category-edit-appearance-${categorySlug}`);
  await expect(appearanceAction).toBeVisible();
  await expect(appearanceAction).toHaveAttribute(
    'aria-label',
    `Uredi videz kategorije ${categoryTitle}`
  );
  await appearanceAction.click();

  const homepageControls = page.locator(`[data-category-media-controls="${categorySlug}"]`);
  await expect(homepageControls).toBeVisible();
  await expect(page.getByTestId('homepage-context-toolbar').getByRole('button', {
    name: 'Uredi videz kategorije',
    exact: true
  })).toBeVisible();
  const homepageContract = await readSharedEditorContract(page, homepageControls, 'homepage');

  const previewPage = await page.context().newPage();
  await previewPage.goto('/admin/kategorije/predogled');
  const previewTile = previewPage.locator(`[data-category-slug="${categorySlug}"]`).first();
  await expect(previewTile).toBeVisible({ timeout: 15_000 });
  await previewTile.hover();
  await previewTile
    .getByRole('button', { name: 'Uredi videz kategorije', exact: true })
    .click();
  const previewControls = previewPage.locator(`[data-category-media-controls="${categorySlug}"]`);
  await expect(previewControls).toBeVisible();
  const previewContract = await readSharedEditorContract(
    previewPage,
    previewControls,
    'category-preview'
  );
  expect(homepageContract).toEqual(previewContract);
  await previewPage.close();

  const offsetX = homepageControls.locator('[data-category-media-field="offset-x"]');
  const nextOffsetX = Number(await offsetX.inputValue()) >= 95
    ? Number(await offsetX.inputValue()) - 1
    : Number(await offsetX.inputValue()) + 1;
  await offsetX.fill(String(nextOffsetX));
  await homepageControls.locator('[data-category-media-field="background-hover"]').fill('#DCE7F5');
  await homepageControls.locator('input[type="file"][accept="image/*"]').setInputFiles({
    name: 'category-appearance-test.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z7xkAAAAASUVORK5CYII=', 'base64')
  });

  await expect(page.getByRole('button', { name: 'Shrani spremembe', exact: true })).toBeEnabled();
  expect(writes).toEqual([]);
  expect(uploads).toEqual([]);
  expect(presentationPatches).toEqual([]);

  await page.getByRole('button', { name: 'Shrani spremembe', exact: true }).click();
  await expect.poll(() => presentationPatches.length).toBe(1);
  await expect.poll(() => uploads.length).toBe(1);
  await page.waitForTimeout(150);

  expect(writes).toEqual([
    'POST /api/admin/media',
    'PATCH /api/admin/categories/images'
  ]);
  expect(uploads).toHaveLength(1);
  expect(presentationPatches).toHaveLength(1);
  expect(presentationPatches[0]?.updates).toHaveLength(1);
  expect(presentationPatches[0]?.updates[0]).toMatchObject({
    categorySlug,
    image: uploadedImageUrl,
    presentation: {
      offsetX: nextOffsetX,
      backgroundHoverColor: '#DCE7F5'
    }
  });
});
