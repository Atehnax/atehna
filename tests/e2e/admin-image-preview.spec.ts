import { expect, test as base, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { resolve } from 'node:path';
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

const DIMENSION_COLORS = ['belo', 'prozorno', 'rdeče', 'modro', 'črno', 'zeleno'];
const dimensionWidth = (index: number) => index < 2 ? 200 : 200 + index * 10;
type ImageVariantsMode = 'basic' | 'standard' | 'dimensions';
const test = base.extend<{ imageItem: CatalogItemEditorHydration; externalImageUrl: string | null; imageVariantsMode: ImageVariantsMode }>({
  externalImageUrl: [null, { option: true }],
  imageVariantsMode: ['basic', { option: true }],
  imageItem: async ({ request, externalImageUrl, imageVariantsMode }, runFixture) => {
    await assertAuthenticatedAdmin(request);
    const seed = await readItem(request, 'aluminijasta-plosca');
    const suffix = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
    const slug = 'e2e-predogled-slik-' + suffix;
    const payload: CatalogItemEditorPayload = {
      itemName: 'Preizkus predogleda slik ' + suffix, slug, sku: 'E2E-IMG-' + suffix,
      itemType: imageVariantsMode === 'dimensions' ? 'sheet' : 'unit', productType: imageVariantsMode === 'dimensions' ? 'dimensions' : 'simple', status: 'inactive', categoryPath: seed.categoryPath,
      unit: 'kos', taxRate: 0.22, optionAxes: imageVariantsMode === 'dimensions' ? [{ name: 'Barva', slug: 'barva', values: DIMENSION_COLORS.map((value, index) => ({ value, slug: 'barva-' + index })) }] : [], quantityDiscounts: [],
      media: IMAGE_PATHS.map((blobUrl, index) => ({
        mediaKind: 'image', role: 'gallery', sourceKind: 'upload',
        ...(index === 0 && externalImageUrl ? { externalUrl: externalImageUrl } : { blobUrl }),
        filename: blobUrl.split('/').at(-1), mimeType: 'image/png', altText: IMAGE_ALTS[index],
        imageDimensions: { width: 1024, height: 1024 }, imageType: 'product', hidden: false, position: index
      })),
      variants: Array.from({ length: imageVariantsMode === 'basic' ? 1 : 6 }, (_, index) => ({
        variantName: imageVariantsMode === 'basic' ? 'Osnovna' : imageVariantsMode === 'dimensions' ? '0,5 × 300 × ' + dimensionWidth(index) + ' mm, ' + DIMENSION_COLORS[index] : 'Komplet za natančno rezanje z dolgim opisnim nazivom ' + (index + 1),
        variantSku: 'E2E-IMG-V-' + suffix + '-' + index, price: 3, inventory: 0,
        status: 'inactive', unit: 'kos', imageAssignments: [0, 1], position: index,
        ...(imageVariantsMode !== 'basic' ? { thickness: 0.5, length: 300, width: imageVariantsMode === 'dimensions' ? dimensionWidth(index) : 200 + index * 10 } : {}),
        ...(imageVariantsMode === 'dimensions' ? { optionSelections: { barva: 'barva-' + index } } : {})
      }))
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

const SUPPLIER_IMAGE_URL = 'https://supplier-catalog.example/products/test-aluminium-sheet.png';

test.describe('external supplier images', () => {
  test.use({ externalImageUrl: SUPPLIER_IMAGE_URL });

  test('thumbnail and shared preview load an unconfigured supplier URL directly without the Next image optimizer', async ({ page, request, imageItem }) => {
    let directImageRequests = 0;
    const optimizedImageRequests: string[] = [];
    await page.route('https://supplier-catalog.example/**', async route => {
      expect(route.request().url()).toBe(SUPPLIER_IMAGE_URL);
      directImageRequests += 1;
      await route.fulfill({
        status: 200, contentType: 'image/png',
        path: resolve('public', IMAGE_PATHS[0].slice(1)),
        headers: { 'access-control-allow-origin': '*' }
      });
    });
    page.on('request', outgoing => {
      const url = new URL(outgoing.url());
      if (url.pathname === '/_next/image' && url.searchParams.get('url') === SUPPLIER_IMAGE_URL) {
        optimizedImageRequests.push(outgoing.url());
      }
    });
    await page.goto('/admin/artikli/' + imageItem.slug);
    expect(imageItem.media[0].externalUrl).toBe(SUPPLIER_IMAGE_URL);
    const trigger = galleryImage(page, 0);
    const thumbnail = trigger.locator('img');
    await expect(thumbnail).toHaveAttribute('src', SUPPLIER_IMAGE_URL);
    await expect.poll(() => thumbnail.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);

    await trigger.click();
    const dialog = lightbox(page);
    await expect(dialog).toBeVisible();
    const enlargedImage = dialog.locator('[data-storefront-gallery-lightbox-content] img');
    await expect(enlargedImage).toHaveAttribute('src', SUPPLIER_IMAGE_URL);
    await expect.poll(() => enlargedImage.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    expect(directImageRequests).toBeGreaterThan(0);
    expect(optimizedImageRequests).toEqual([]);
    await page.keyboard.press('Escape');
    await expectClosedWithFocus(page, trigger);
    await expect(page.getByRole('button', { name: 'Shrani', exact: true })).toBeDisabled();
    expect(await readItem(request, imageItem.slug)).toEqual(imageItem);
  });
});

for (const imageVariantsMode of ['standard', 'dimensions'] as const) {
  test.describe(imageVariantsMode + ' image metadata layout', () => {
    test.use({ imageVariantsMode });

    test('image names stay concise, pixels stay on one line, and assignment tags remain inside their cell', async ({ page, request, imageItem }, testInfo) => {
      await page.setViewportSize({ width: 1500, height: 1000 });
      await page.goto('/admin/artikli/' + imageItem.slug);
      const table = page.getByRole('table', { name: 'Podatki o slikah', exact: true });
      const rows = table.locator('tbody > tr');
      await expect(rows).toHaveCount(2);
      const first = rows.first();
      const assignmentCell = first.getByRole('cell').nth(3);
      const labels = imageItem.variants.map((variant, index) => imageVariantsMode === 'dimensions'
        ? '0,5 × 300 × ' + dimensionWidth(index) + ' mm' : variant.variantName);
      await expect(first.getByRole('cell').nth(0)).toHaveText('Glavna slika');
      await expect(rows.nth(1).getByRole('cell').nth(0)).toHaveText('Slika 2');
      for (const label of new Set(labels)) await expect(assignmentCell.locator('span[title]').filter({ hasText: label })).toHaveCount(labels.filter(value => value === label).length);
      for (const [index, variant] of imageItem.variants.entries()) await expect(assignmentCell.locator('span[title]').nth(index)).toHaveAttribute('title', variant.variantName);
      for (const variant of imageItem.variants) await expect(assignmentCell).not.toContainText(variant.variantSku!);
      if (imageVariantsMode === 'standard') await expect(assignmentCell).not.toContainText('300');
      await expect(first.getByRole('cell').nth(2)).toHaveText('1024 × 1024 px');

      for (const width of [1500, 1100]) {
        await page.setViewportSize({ width, height: 1000 });
        await expect.poll(() => table.evaluate(element => {
          const header = element.querySelectorAll('th');
          const pixelCells = [...element.querySelectorAll('tbody tr')].map(row => row.children[2] as HTMLElement);
          const tags = [...element.querySelectorAll('tbody td:nth-child(4) span[title]')];
          const frame = element.parentElement!.getBoundingClientRect();
          const tableBox = element.getBoundingClientRect();
          const tableFitsFrame = tableBox.width <= frame.width + 1;
          const tagsContained = tags.every(tag => {
            const box = tag.getBoundingClientRect();
            const cell = tag.closest('td')!.getBoundingClientRect();
            return box.left >= cell.left && box.right <= cell.right && box.left >= frame.left && box.right <= frame.right;
          });
          const pixelsFit = pixelCells.every(cell => getComputedStyle(cell).whiteSpace === 'nowrap' && cell.scrollWidth <= cell.clientWidth);
          return { tableFitsFrame, tagsContained, pixelsFit, dimensionsWider: header[2].getBoundingClientRect().width > header[0].getBoundingClientRect().width };
        })).toEqual({ tableFitsFrame: true, tagsContained: true, pixelsFit: true, dimensionsWider: true });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      }
      await page.screenshot({ path: testInfo.outputPath('image-metadata-' + imageVariantsMode + '.png'), fullPage: true });

      await page.getByRole('button', { name: 'Uredi artikel', exact: true }).first().click();
      const removedVariants = imageItem.variants.slice(0, imageVariantsMode === 'dimensions' ? 2 : 1);
      for (const variant of removedVariants) await assignmentCell.getByRole('button', { name: 'Odstrani povezavo slike z različico ' + variant.variantName, exact: true }).click();
      await expect(assignmentCell.locator('span[title]')).toHaveCount(labels.length - removedVariants.length);
      const select = assignmentCell.getByRole('combobox', { name: 'Poveži glavna slika z različico', exact: true });
      // Same-sized color variants keep dimension-only tags but distinct descriptions in selection controls.
      for (const variant of removedVariants) await expect(select.getByRole('option', { name: variant.variantName, exact: true })).toHaveCount(1);
      for (const variant of removedVariants) await select.selectOption({ label: variant.variantName });
      await expect(assignmentCell.locator('span[title]')).toHaveCount(labels.length);
      expect(await readItem(request, imageItem.slug)).toEqual(imageItem);
    });
  });
}
