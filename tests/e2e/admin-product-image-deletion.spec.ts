import { expect, test, request as requestFactory, type Page } from '@playwright/test';
import sharp from 'sharp';
import pg from 'pg';
import { readE2eEnvironment } from '../../scripts/e2e-database.mjs';
import { catalogCategoryItemHref } from '../../src/commercial/catalog/catalogRoutes';
import type { CatalogItemEditorHydration, CatalogItemEditorPayload } from '../../src/shared/domain/catalog/catalogAdminTypes';
import { assertAuthenticatedAdmin, E2E_BASE_URL } from './support/auth';

const imageEntries = (item: CatalogItemEditorHydration) => item.media.filter(media => media.mediaKind === 'image' && media.role === 'gallery');
const imageUrls = (item: CatalogItemEditorHydration) => imageEntries(item).map(media => media.blobUrl || media.externalUrl);

async function save(page: Page) {
  await page.getByRole('button', { name: 'Shrani', exact: true }).click();
  const response = page.waitForResponse(response => new URL(response.url()).pathname === '/api/admin/artikli' && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Potrdi in shrani', exact: true }).click();
  return response;
}

test('image deletion stages saved and unsaved images, cancels and undoes, persists main/final removal and refreshes storefront', async ({ page, request, browser }, testInfo) => {
  test.setTimeout(120_000);
  await assertAuthenticatedAdmin(request);
  const duplicate = await request.post('/api/admin/artikli/duplicate', { headers: { origin: E2E_BASE_URL }, data: { itemIdentifier: 'aluminijasta-plosca' } });
  expect(duplicate.status(), await duplicate.text()).toBe(200);
  const copied = (await duplicate.json() as { item: { slug: string } }).item;
  const read = async () => {
    const response = await request.get('/api/admin/artikli/' + copied.slug);
    expect(response.status(), await response.text()).toBe(200);
    return response.json() as Promise<CatalogItemEditorHydration>;
  };
  const initial = await read();
  const originalUrls = imageUrls(initial);
  expect(originalUrls.length).toBe(2);
  const gallery = page.getByRole('table', { name: 'Podatki o slikah' });
  const deleteButtons = page.getByRole('button', { name: 'Izbriši sliko', exact: true });
  const edit = () => page.getByRole('button', { name: 'Uredi artikel', exact: true }).click();
  const mainImage = () => page.getByRole('button', { name: 'Povečaj sliko: Glavna slika', exact: true }).locator('img');
  const storefront = await browser.newPage();
  try {
    // Publish only the isolated copied fixture; original seed and live catalog remain untouched.
    const publish = await request.post('/api/admin/artikli', { headers: { origin: E2E_BASE_URL }, data: { ...initial, status: 'active', expectedUpdatedAt: initial.updatedAt, imageAssignmentScope: 'all-gallery' } });
    expect(publish.status(), await publish.text()).toBe(200);
    const productHref = catalogCategoryItemHref(initial.categorySlug || 'materiali', copied.slug);
    await storefront.goto(productHref);
    await expect(storefront.locator('[data-storefront-gallery-main-image] img')).toHaveAttribute('src', new RegExp(encodeURIComponent(originalUrls[0]!).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

    await page.goto('/admin/artikli/' + copied.slug);
    await edit();
    await expect(deleteButtons).toHaveCount(2);
    await page.mouse.move(500, 100);
    await expect(deleteButtons.first()).toHaveCSS('opacity', '1');
    await expect(deleteButtons.first()).toHaveAttribute('title', 'Izbriši sliko');
    await gallery.scrollIntoViewIfNeeded();
    await page.getByRole('complementary', { name: 'Mediji artikla' }).screenshot({ path: testInfo.outputPath('image-delete-controls.png'), animations: 'disabled' });

    // Removing a saved secondary image remains local until save and is discarded with the form.
    await deleteButtons.nth(1).click();
    await expect(deleteButtons).toHaveCount(1);
    expect(imageUrls(await read())).toEqual(originalUrls);
    await edit();
    await page.getByRole('button', { name: 'Zavrzi spremembe', exact: true }).click();
    await expect(gallery.locator('tbody tr')).toHaveCount(2);
    await edit();

    // A genuinely unsaved File is removed without any upload request; undo keeps its blob URL alive.
    const uploads: string[] = [];
    page.on('request', request => { if (/\/api\/admin\/.*(?:upload|media)/.test(new URL(request.url()).pathname) && request.method() !== 'GET') uploads.push(request.url()); });
    const png = await sharp({ create: { width: 1200, height: 1200, channels: 3, background: '#527c95' } }).png().toBuffer();
    await page.getByRole('button', { name: 'Naloži sliko', exact: true }).locator('input[type="file"]').setInputFiles({ name: 'unsaved-test-image.png', mimeType: 'image/png', buffer: png });
    await expect(deleteButtons).toHaveCount(3);
    await deleteButtons.nth(2).click();
    await expect(deleteButtons).toHaveCount(2);
    await page.getByRole('button', { name: 'Razveljavi', exact: true }).click();
    await expect(deleteButtons).toHaveCount(3);
    const restored = page.getByRole('button', { name: 'Povečaj sliko: Slika 3', exact: true }).locator('img');
    await expect.poll(() => restored.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBe(1200);
    await deleteButtons.nth(2).click();
    expect(uploads).toEqual([]);

    // A failed server write must keep the edit pending and leave persisted media untouched.
    await deleteButtons.first().click();
    await expect(mainImage()).toHaveAttribute('src', originalUrls[1]!);
    await page.route('**/api/admin/artikli', async route => {
      if (route.request().method() === 'POST') await route.fulfill({ status: 500, json: { message: 'Brisanja slik ni bilo mogoče shraniti.' } });
      else await route.continue();
    });
    expect((await save(page)).status()).toBe(500);
    await expect(page.getByText('Brisanja slik ni bilo mogoče shraniti.', { exact: true })).toBeVisible();
    expect(imageUrls(await read())).toEqual(originalUrls);
    await expect(deleteButtons).toHaveCount(1);
    await page.unroute('**/api/admin/artikli');
    const saved = await save(page);
    expect(saved.status(), await saved.text()).toBe(200);
    expect(imageUrls(await read())).toEqual([originalUrls[1]]);
    await page.reload();
    await expect(mainImage()).toHaveAttribute('src', originalUrls[1]!);
    await storefront.reload();
    await expect(storefront.locator('[data-storefront-gallery-main-image] img')).toHaveAttribute('src', new RegExp(encodeURIComponent(originalUrls[1]!).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

    // Removing the final image is valid; no fallback should resurrect the removed photograph.
    await edit();
    await deleteButtons.first().focus();
    await page.keyboard.press('Enter');
    await expect(deleteButtons).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Naloži sliko/ }).first()).toBeVisible();
    const finalSave = await save(page);
    expect(finalSave.status(), await finalSave.text()).toBe(200);
    const empty = await read();
    expect(imageUrls(empty)).toEqual([]);
    expect(empty.variants.every(variant => !variant.imageAssignments?.length)).toBe(true);
    await page.reload();
    await expect(page.getByRole('button', { name: /Povečaj sliko:/ })).toHaveCount(0);
    await storefront.reload();
    await expect(storefront.getByText('Slika izdelka še ni objavljena.', { exact: true })).toBeVisible();
    await expect(storefront.locator('[data-storefront-gallery-main-image] img')).toHaveCount(0);
    await page.getByRole('complementary', { name: 'Mediji artikla' }).screenshot({ path: testInfo.outputPath('image-deletion-empty-state.png'), animations: 'disabled' });

    // Cookie presence alone does not grant permission to persist media removals.
    const anonymous = await requestFactory.newContext({ baseURL: E2E_BASE_URL, storageState: { cookies: [], origins: [] } });
    try {
      const denied = await anonymous.post('/api/admin/artikli', { headers: { origin: E2E_BASE_URL, cookie: 'atehna_admin_session=invalid' }, data: { ...empty, expectedUpdatedAt: empty.updatedAt } });
      expect(denied.status()).toBe(401);
    } finally { await anonymous.dispose(); }
  } finally {
    await storefront.close();
    const removed = await request.delete('/api/admin/artikli/' + copied.slug, { headers: { origin: E2E_BASE_URL } });
    expect.soft(removed.status(), await removed.text()).toBe(200);
  }
});

test('saved removal retains shared stored files and queues an unreferenced owned file for checked cleanup', async ({ request }) => {
  const { databaseUrl } = readE2eEnvironment();
  const pool = new pg.Pool({ connectionString: databaseUrl, ssl: false });
  const suffix = Date.now().toString(36);
  const ownedPath = `catalog-items/e2e-${suffix}/images/owned.png`;
  const sharedPath = `catalog-items/e2e-${suffix}/images/shared.png`;
  const base = (await request.get('/api/admin/artikli/aluminijasta-plosca'));
  const seed = await base.json() as CatalogItemEditorHydration;
  let createdId = 0;
  try {
    const payload: CatalogItemEditorPayload = { itemName: 'E2E media cleanup ' + suffix, slug: 'e2e-media-cleanup-' + suffix, status: 'inactive', itemType: 'unit', productType: 'simple', categoryPath: seed.categoryPath, variants: [{ variantName: 'Osnovna', price: 1, inventory: 1, status: 'active', unit: 'kos' }], media: [] };
    const create = await request.post('/api/admin/artikli', { headers: { origin: E2E_BASE_URL }, data: payload });
    expect(create.status(), await create.text()).toBe(200);
    createdId = (await create.json() as { id: number }).id;
    // Seed only this disposable test database with owned/shared storage identities.
    await pool.query(`insert into catalog_media(item_id,media_kind,role,source_kind,blob_url,blob_pathname,position) values ($1,'image','gallery','upload',$2,$3,0),($1,'image','gallery','upload',$4,$5,1),($6,'image','gallery','upload',$4,null,99)`, [createdId, 'https://fixture.public.blob.vercel-storage.com/' + ownedPath, ownedPath, 'https://fixture.public.blob.vercel-storage.com/' + sharedPath, sharedPath, seed.id]);
    const before = await (await request.get('/api/admin/artikli/' + payload.slug)).json() as CatalogItemEditorHydration;
    // A validation failure after detaching/queuing must roll back the entire transaction.
    const failed = await request.post('/api/admin/artikli', { headers: { origin: E2E_BASE_URL }, data: { ...before, expectedUpdatedAt: before.updatedAt, media: [], variants: before.variants.map((variant, index) => ({ ...variant, imageAssignments: index === 0 ? [0] : [] })) } });
    expect(failed.status(), await failed.text()).toBe(400);
    expect(Number((await pool.query('select count(*) from catalog_media where item_id=$1', [createdId])).rows[0].count)).toBe(2);
    expect(Number((await pool.query('select count(*) from archive_blob_deletion_outbox where source_product_id=$1', [createdId])).rows[0].count)).toBe(0);
    const removal = await request.post('/api/admin/artikli', { headers: { origin: E2E_BASE_URL }, data: { ...before, expectedUpdatedAt: before.updatedAt, media: [] } });
    expect(removal.status(), await removal.text()).toBe(200);
    const intents = await pool.query('select blob_target from archive_blob_deletion_outbox where source_product_id=$1', [createdId]);
    expect(intents.rows.map(row => row.blob_target)).toEqual([ownedPath]);
    expect(Number((await pool.query('select count(*) from catalog_media where item_id=$1', [createdId])).rows[0].count)).toBe(0);
    expect(Number((await pool.query('select count(*) from catalog_media where blob_url=$1', ['https://fixture.public.blob.vercel-storage.com/' + sharedPath])).rows[0].count)).toBe(1);
  } finally {
    await pool.query('delete from catalog_media where blob_url=$1', ['https://fixture.public.blob.vercel-storage.com/' + sharedPath]);
    if (createdId) {
      await pool.query('delete from archive_blob_deletion_outbox where source_product_id=$1', [createdId]);
      await request.delete('/api/admin/artikli/' + createdId, { headers: { origin: E2E_BASE_URL } });
    }
    await pool.end();
  }
});
