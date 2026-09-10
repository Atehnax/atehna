import { expect, test, type APIRequestContext } from '@playwright/test';
import type { CatalogItemEditorHydration, CatalogItemEditorPayload } from '@/shared/domain/catalog/catalogAdminTypes';
import { E2E_BASE_URL } from './support/auth';

const endpoint = '/api/admin/artikli/activate';
const headers = { origin: E2E_BASE_URL };
const ownedSlugs: string[] = [];
async function read(request: APIRequestContext, slug: string): Promise<CatalogItemEditorHydration> {
  const response = await request.get('/api/admin/artikli/' + slug);
  expect(response.status(), await response.text()).toBe(200);
  return response.json();
}
async function create(request: APIRequestContext, options: { existingActive?: boolean; missingShipping?: boolean } = {}) {
  const seed = await read(request, 'aluminijasta-plosca');
  const suffix = Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  const slug = 'aktivacija-' + suffix;
  const payload: CatalogItemEditorPayload = {
    slug, sku: 'ACT-' + suffix, itemName: 'Preizkus aktivacije ' + suffix,
    itemType: 'unit', productType: 'simple', unit: 'kos', status: 'inactive',
    categoryPath: seed.categoryPath, media: [], taxRate: 0.22,
    optionAxes: [{ name: 'Izvedba', slug: 'izvedba', values: [0, 1, 2].map(index => ({ value: String(index + 1), slug: String(index + 1) })) }],
    variants: [0, 1, 2].map(index => ({
      variantName: 'Izvedba ' + (index + 1), variantSku: 'ACT-' + suffix + '-' + index,
      status: options.existingActive && index === 2 ? 'active' : 'inactive',
      price: 4 + index, costNet: 1 + index, inventory: 10 + index, position: index + 1,
      length: 100, width: 50, thickness: 20, weight: options.missingShipping ? null : 0.3,
      optionSelections: { izvedba: String(index + 1) },
      contentOverride: { description: 'Opis ' + index, deliveryEstimate: '3 dni' }
    }))
  };
  const response = await request.post('/api/admin/artikli', { headers, data: payload });
  expect(response.status(), await response.text()).toBe(200);
  ownedSlugs.push(slug);
  return read(request, slug);
}
const preserved = (item: CatalogItemEditorHydration) => item.variants.map(({ status: _status, ...variant }) => variant);
test.afterAll(async ({ request }) => {
  for (const slug of ownedSlugs) expect((await request.delete('/api/admin/artikli/' + slug, { headers })).status()).toBe(200);
});

test('first and all activation preserve existing active rows and every commercial field', async ({ request }) => {
  const before = await create(request, { existingActive: true });
  const first = await request.post(endpoint, { headers, data: { mode: 'first', itemIdentifiers: [before.slug] } });
  expect(first.status(), await first.text()).toBe(200);
  const afterFirst = await read(request, before.slug);
  expect(afterFirst.status).toBe('active');
  expect(afterFirst.variants.map(variant => variant.status)).toEqual(['active', 'inactive', 'active']);
  expect(preserved(afterFirst)).toEqual(preserved(before));
  expect(afterFirst.defaultVariantId).toBe(before.defaultVariantId);
  const all = await request.post(endpoint, { headers, data: { mode: 'all', itemIdentifiers: [before.slug] } });
  expect(all.status(), await all.text()).toBe(200);
  const afterAll = await read(request, before.slug);
  expect(afterAll.variants.every(variant => variant.status === 'active')).toBe(true);
  expect(preserved(afterAll)).toEqual(preserved(before));
});

test('invalid shipping rolls back activation of every selected parent and variant', async ({ request }) => {
  const valid = await create(request);
  const invalid = await create(request, { missingShipping: true });
  const response = await request.post(endpoint, { headers, data: { mode: 'all', itemIdentifiers: [valid.slug, invalid.slug] } });
  expect(response.status(), await response.text()).toBe(400);
  expect((await response.json()).message).toMatch(/poštnino/);
  for (const before of [valid, invalid]) {
    const after = await read(request, before.slug);
    expect(after.status).toBe('inactive');
    expect(after.updatedAt).toBe(before.updatedAt);
    expect(after.variants).toEqual(before.variants);
  }
});

test('explicit variant targets merge with first activation and reject foreign variants atomically', async ({ request }) => {
  const before = await create(request);
  const other = await create(request);
  const bad = await request.post(endpoint, { headers, data: { mode: 'first', itemIdentifiers: [before.slug], variants: [{ itemIdentifier: before.slug, variantId: other.variants[1].id }] } });
  expect(bad.status()).toBe(400);
  expect((await read(request, before.slug)).variants).toEqual(before.variants);
  const good = await request.post(endpoint, { headers, data: { mode: 'first', itemIdentifiers: [before.slug], variants: [{ itemIdentifier: before.slug, variantId: before.variants[2].id }] } });
  expect(good.status(), await good.text()).toBe(200);
  expect((await read(request, before.slug)).variants.map(variant => variant.status)).toEqual(['active', 'inactive', 'active']);
  const variantOnly = await request.post(endpoint, { headers, data: { mode: 'first', itemIdentifiers: [], variants: [{ itemIdentifier: other.slug, variantId: other.variants[1].id }] } });
  expect(variantOnly.status(), await variantOnly.text()).toBe(200);
  const unchangedParent = await read(request, other.slug);
  expect(unchangedParent.status).toBe('inactive');
  expect(unchangedParent.variants.map(variant => variant.status)).toEqual(['inactive', 'active', 'inactive']);
});

test('activation requires authenticated same-origin requests and an explicit mode', async ({ playwright, request }) => {
  const anonymous = await playwright.request.newContext({ baseURL: E2E_BASE_URL, storageState: { cookies: [], origins: [] } });
  try { expect((await anonymous.post(endpoint, { data: { mode: 'all', itemIdentifiers: ['unknown'] } })).status()).toBe(401); }
  finally { await anonymous.dispose(); }
  expect((await request.post(endpoint, { headers: { origin: 'https://attacker.test', 'sec-fetch-site': 'cross-site' }, data: { mode: 'all', itemIdentifiers: ['unknown'] } })).status()).toBe(403);
  expect((await request.post(endpoint, { headers, data: { itemIdentifiers: ['unknown'] } })).status()).toBe(400);
});


test('bulk list activation offers both choices before saving and activates the chosen rows', async ({ page, request }) => {
  const first = await create(request);
  const second = await create(request);
  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.goto('/admin/artikli');
  await page.getByPlaceholder(/Poišči artikel/).first().fill('Preizkus aktivacije');
  for (const item of [first, second]) {
    await page.locator('tr[data-edit-scope="family:' + item.id + '"]').getByRole('checkbox', { name: 'Izberi ' + item.itemName, exact: true }).check();
  }
  await page.getByRole('button', { name: 'Status ▾ (2)', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Aktiven', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Aktivacija artiklov', exact: true });
  await expect(dialog).toBeVisible();
  const all = dialog.getByRole('radio', { name: /^Glavni artikli in vse različice/ });
  const onlyFirst = dialog.getByRole('radio', { name: /^Glavni artikli in prve različice/ });
  await expect(all).toBeChecked();
  await onlyFirst.check();
  expect((await read(request, first.slug)).status).toBe('inactive');
  const saved = page.waitForResponse(response => new URL(response.url()).pathname === endpoint && response.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Aktiviraj', exact: true }).click();
  const response = await saved;
  expect(response.status(), await response.text()).toBe(200);
  await expect(dialog).toHaveCount(0);
  for (const item of [first, second]) {
    const after = await read(request, item.slug);
    expect(after.status).toBe('active');
    expect(after.variants.map(variant => variant.status)).toEqual(['active', 'inactive', 'inactive']);
    expect(preserved(after)).toEqual(preserved(item));
  }
});
