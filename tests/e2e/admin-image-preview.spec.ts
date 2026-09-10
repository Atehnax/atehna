import { expect, test as base, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import type { CatalogItemEditorHydration, CatalogItemEditorPayload } from '@/shared/domain/catalog/catalogAdminTypes';
import { assertAuthenticatedAdmin, E2E_BASE_URL } from './support/auth';

const IMAGE_PATHS = [
  '/images/catalog/2026-09/aluminijasta-plosca-kvadrat.png',
  '/images/catalog/2026-09/aluminijasta-plosca-pravokotnik.png'
] as const;
const IMAGE_ALTS = ['Kvadratna plošča za preizkus', 'Pravokotna plošča za preizkus'] as const;

async function readItem(request: APIRequestContext, slug: string) {
  const response = await request.get('/api/admin/artikli/' + slug);
  expect(response.status(), await response.text()).toBe(200);
  return response.json() as Promise<CatalogItemEditorHydration>;
}

const test = base.extend<{ imageItem: CatalogItemEditorHydration }>({
  imageItem: async ({ request }, runFixture) => {
    await assertAuthenticatedAdmin(request);
    const seed = await readItem(request, 'aluminijasta-plosca');
    const suffix = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
    const slug = 'e2e-predogled-slik-' + suffix;
    const payload: CatalogItemEditorPayload = {
      itemName: 'Preizkus predogleda slik ' + suffix, slug, sku: 'E2E-IMG-' + suffix,
      itemType: 'unit', productType: 'simple', status: 'inactive', categoryPath: seed.categoryPath,
      unit: 'kos', taxRate: 0.22, optionAxes: [], quantityDiscounts: [],
      media: IMAGE_PATHS.map((blobUrl, index) => ({
        mediaKind: 'image', role: 'gallery', sourceKind: 'upload', blobUrl,
        filename: blobUrl.split('/').at(-1), mimeType: 'image/png', altText: IMAGE_ALTS[index],
        imageDimensions: { width: 1024, height: 1024 }, imageType: 'product', hidden: false, position: index
      })),
      variants: [{
        variantName: 'Osnovna', variantSku: 'E2E-IMG-V-' + suffix, price: 3, inventory: 0,
        status: 'inactive', unit: 'kos', imageAssignments: [0, 1]
      }]
    };
    const response = await request.post('/api/admin/artikli', { headers: { origin: E2E_BASE_URL }, data: payload });
    expect(response.status(), await response.text()).toBe(200);
    try {
      await runFixture(await readItem(request, slug));
    } finally {
      const deleted = await request.delete('/api/admin/artikli/' + slug, { headers: { origin: E2E_BASE_URL } });
      expect.soft(deleted.status(), await deleted.text()).toBe(200);
    }
  }
});

const galleryImage = (page: Page, index: number) => page.getByRole('button', {
  name: 'Povečaj sliko: ' + (index === 0 ? 'Glavna slika' : 'Slika ' + (index + 1)), exact: true
});
const lightbox = (page: Page) => page.locator('[data-storefront-gallery-lightbox]');

async function expectPreview(page: Page, expectedIndex: number) {
  const dialog = lightbox(page);
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-label', 'Povečana slika: ' + IMAGE_ALTS[expectedIndex]);
  const image = dialog.locator('[data-storefront-gallery-lightbox-content] img');
  await expect.poll(async () => {
    const src = await image.getAttribute('src');
    if (!src) return null;
    const url = new URL(src, E2E_BASE_URL);
    return url.searchParams.get('url') ?? url.pathname;
  }).toBe(IMAGE_PATHS[expectedIndex]);
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
  await expect(dialog.getByRole('button', { name: 'Zapri povečano sliko', exact: true })).toBeFocused();
  await expect(page.getByRole('heading', { name: /^Urejanje slike / })).toHaveCount(0);
  return dialog;
}

async function expectClosedWithFocus(page: Page, trigger: Locator) {
  await expect(lightbox(page)).toHaveCount(0);
  await expect(trigger).toBeFocused();
}

test('read-only gallery and metadata thumbnails share a clean preview with Escape, backdrop and focus restoration', async ({ page, request, imageItem }) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.goto('/admin/artikli/' + imageItem.slug);
  const save = page.getByRole('button', { name: 'Shrani', exact: true });
  const name = page.getByRole('textbox', { name: 'Naziv artikla', exact: true }).first();
  await expect(name).toBeDisabled();
  await expect(save).toBeDisabled();
  const previousOverflow = await page.evaluate(() => document.body.style.overflow);

  const main = galleryImage(page, 0);
  await main.click();
  await expectPreview(page, 0);
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('hidden');
  await page.keyboard.press('Escape');
  await expectClosedWithFocus(page, main);
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe(previousOverflow);

  const thumbnail = page.getByRole('button', { name: 'Povečaj sliko: Slika 2 (tabela)', exact: true });
  await thumbnail.click();
  const dialog = await expectPreview(page, 1);
  await dialog.locator('[data-storefront-gallery-lightbox-content]').click();
  await expect(dialog).toBeVisible();
  await dialog.click({ position: { x: 4, y: 4 } });
  await expectClosedWithFocus(page, thumbnail);
  await expect(save).toBeDisabled();

  // A preview must not create hidden edits that appear only after entering edit mode.
  await page.getByRole('button', { name: 'Uredi artikel', exact: true }).first().click();
  await expect(name).toBeEnabled();
  await expect(save).toBeDisabled();
  await page.getByRole('button', { name: 'Uredi artikel', exact: true }).first().click();
  await expect(name).toBeDisabled();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await readItem(request, imageItem.slug)).toEqual(imageItem);
});

test('editing an article still previews image clicks, while the explicit image editor can be cancelled without changes', async ({ page, request, imageItem }) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.goto('/admin/artikli/' + imageItem.slug);
  await page.getByRole('button', { name: 'Uredi artikel', exact: true }).first().click();
  const save = page.getByRole('button', { name: 'Shrani', exact: true });
  await expect(save).toBeDisabled();
  const main = galleryImage(page, 0);
  await main.click();
  const dialog = await expectPreview(page, 0);
  await dialog.getByRole('button', { name: 'Zapri povečano sliko', exact: true }).click();
  await expectClosedWithFocus(page, main);
  await expect(save).toBeDisabled();

  await main.hover();
  await main.locator('..').getByRole('button', { name: 'Uredi sliko', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Urejanje slike 1', exact: true })).toBeVisible();
  await expect(lightbox(page)).toHaveCount(0);
  await expect(page.locator('cropper-canvas')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Polni predogled slike 1', exact: true })).toHaveAttribute('src', IMAGE_PATHS[0]);
  await page.getByRole('button', { name: 'Zavrti levo', exact: true }).click();
  await page.getByRole('button', { name: 'Zapri urejanje slike', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Urejanje slike 1', exact: true })).toHaveCount(0);
  await expect(main.locator('img')).toHaveAttribute('src', IMAGE_PATHS[0]);
  await expect(save).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Razveljavi', exact: true })).toBeDisabled();
  expect(await readItem(request, imageItem.slug)).toEqual(imageItem);
});

test('dragging gallery images reorders the draft without opening a preview or persisting it', async ({ page, request, imageItem }) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.goto('/admin/artikli/' + imageItem.slug);
  await page.getByRole('button', { name: 'Uredi artikel', exact: true }).first().click();
  const main = galleryImage(page, 0);
  const second = galleryImage(page, 1);
  await expect(main.locator('img')).toHaveAttribute('src', IMAGE_PATHS[0]);
  await expect(second.locator('img')).toHaveAttribute('src', IMAGE_PATHS[1]);
  await second.locator('..').dragTo(main.locator('..'));
  await expect(main.locator('img')).toHaveAttribute('src', IMAGE_PATHS[1]);
  await expect(second.locator('img')).toHaveAttribute('src', IMAGE_PATHS[0]);
  await expect(lightbox(page)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /^Urejanje slike / })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Shrani', exact: true })).toBeEnabled();

  // A genuine subsequent click must work after the synthetic click suppression for dragging.
  await main.click();
  await expectPreview(page, 1);
  await page.keyboard.press('Escape');
  await expectClosedWithFocus(page, main);
  expect(await readItem(request, imageItem.slug)).toEqual(imageItem);
});
