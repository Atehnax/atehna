import { expect, test, type APIRequestContext } from '@playwright/test';
import type { CatalogItemEditorHydration, CatalogItemEditorPayload } from '@/shared/domain/catalog/catalogAdminTypes';
import { assertAuthenticatedAdmin, E2E_BASE_URL } from './support/auth';

const createdSlugs: string[] = [];

async function createArticle(request: APIRequestContext, prefix: string, suffix: string, imageUrl?: string, overrides: Partial<CatalogItemEditorPayload> = {}) {
  const seedResponse = await request.get('/api/admin/artikli/aluminijasta-plosca');
  expect(seedResponse.status(), await seedResponse.text()).toBe(200);
  const seed = await seedResponse.json() as CatalogItemEditorHydration;
  const slug = `${prefix}-${suffix}`;
  const payload: CatalogItemEditorPayload = {
    itemName: `${prefix} ${suffix}`, slug, sku: `THUMB-${slug}`,
    itemType: 'unit', productType: 'simple', status: 'inactive', categoryPath: seed.categoryPath,
    unit: 'kos', taxRate: 0.22, quantityDiscounts: [], optionAxes: [],
    media: imageUrl ? [{ mediaKind: 'image', role: 'gallery', sourceKind: 'upload', externalUrl: imageUrl, filename: 'thumbnail.svg', mimeType: 'image/svg+xml', position: 0 }] : [],
    variants: [{ variantName: 'Osnovna', variantSku: `THUMB-VAR-${slug}`, price: 3, inventory: 4, minOrder: 1, discountPct: 0, status: 'active', unit: 'kos' }],
    ...overrides
  };
  const response = await request.post('/api/admin/artikli', { headers: { origin: E2E_BASE_URL }, data: payload });
  expect(response.status(), await response.text()).toBe(200);
  createdSlugs.push(slug);
  return { ...await response.json() as { id: number; slug: string }, name: payload.itemName };
}

test.afterAll(async ({ request }) => {
  for (const slug of createdSlugs) {
    const response = await request.delete(`/api/admin/artikli/${slug}`, { headers: { origin: E2E_BASE_URL } });
    expect(response.status(), await response.text()).toBe(200);
  }
});

test('article thumbnails default off, show existing images or fallback, and keep filtered selection counts', async ({ page, request }) => {
  await assertAuthenticatedAdmin(request);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const prefix = `e2e-thumb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const imageUrl = `https://catalog-image.example.invalid/${prefix}.svg`;
  const withImage = await createArticle(request, prefix, 's-slika', imageUrl);
  const withoutImage = await createArticle(request, prefix, 'brez-slike');
  let imageRequests = 0;
  await page.route(imageUrl, async (route) => {
    imageRequests += 1;
    await route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36"><rect width="36" height="36" fill="#2563eb"/></svg>' });
  });
  await page.goto('/admin/artikli');
  const search = page.getByPlaceholder(/Poišči artikel/).first();
  await search.fill(prefix);
  const count = page.getByTestId('admin-items-count');
  await expect(count).toHaveText('2 artikla');
  const toggle = page.getByTestId('admin-items-thumbnails-toggle');
  const reviewToggle = page.getByTestId('admin-items-review-mode-toggle');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('admin-item-thumbnail')).toHaveCount(0);
  expect(imageRequests).toBe(0);
  const toggleBox = await toggle.boundingBox();
  const reviewBox = await reviewToggle.boundingBox();
  expect(toggleBox!.x + toggleBox!.width).toBeLessThanOrEqual(reviewBox!.x);
  const imageRow = page.locator(`tr[data-edit-scope="family:${withImage.id}"]`);
  const rowHeight = (await imageRow.boundingBox())!.height;
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('admin-item-thumbnail')).toHaveCount(2);
  await expect(imageRow.locator('img')).toHaveAttribute('src', imageUrl);
  await expect.poll(() => imageRow.locator('img').evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBe(36);
  const fallbackRow = page.locator(`tr[data-edit-scope="family:${withoutImage.id}"]`);
  await expect(fallbackRow.getByRole('img', { name: 'Slika ni na voljo', exact: true })).toBeVisible();
  await imageRow.getByRole('checkbox', { name: `Izberi ${withImage.name}`, exact: true }).check();
  await expect(count).toHaveText('1 izbran / 2 artikla');
  await search.fill(withImage.name);
  await expect(count).toHaveText('1 izbran / 1 artikel');
  await imageRow.getByRole('checkbox', { name: `Izberi ${withImage.name}`, exact: true }).uncheck();
  await expect(count).toHaveText('1 artikel');
  await toggle.click();
  await expect(page.getByTestId('admin-item-thumbnail')).toHaveCount(0);
  expect((await imageRow.boundingBox())!.height).toBeCloseTo(rowHeight, 1);
});


test('article thumbnail prefers a shared image, otherwise the first inactive variant in saved order', async ({ page, request }) => {
  await assertAuthenticatedAdmin(request);
  const prefix = 'e2e-thumb-order-' + Date.now();
  const url = (name: string) => 'https://catalog-image.example.invalid/' + prefix + '-' + name + '.svg';
  const media = ['later', 'hidden', 'first', 'common'].map((name, position) => ({ mediaKind: 'image' as const, role: 'gallery' as const, sourceKind: 'upload' as const, externalUrl:url(name), position, hidden:name==='hidden' }));
  const variants = [
    { variantName:'Prva',variantSku:prefix+'-first',price:1,status:'inactive' as const,position:0,imageAssignments:[1] },
    { variantName:'Druga',variantSku:prefix+'-later',price:1,status:'active' as const,position:1,imageAssignments:[0] }
  ];
  const first = await createArticle(request,prefix,'prva',undefined,{media:media.slice(0,3),variants});
  const common = await createArticle(request,prefix,'skupna',undefined,{media,variants:variants.map((variant,index)=>({...variant,variantSku:prefix+'-common-'+index,imageAssignments:[...variant.imageAssignments,2]}))});
  await page.route('https://catalog-image.example.invalid/**', route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36"/>'}));
  await page.goto('/admin/artikli');
  await page.getByPlaceholder(/Poišči artikel/).first().fill(prefix);
  await page.getByTestId('admin-items-thumbnails-toggle').click();
  await expect(page.locator('tr[data-edit-scope="family:'+first.id+'"] img')).toHaveAttribute('src',url('first'));
  await expect(page.locator('tr[data-edit-scope="family:'+common.id+'"] img')).toHaveAttribute('src',url('common'));
});
