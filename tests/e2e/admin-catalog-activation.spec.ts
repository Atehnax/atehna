import { expect, test, type APIRequestContext } from '@playwright/test';
import type { CatalogEditorProductType, CatalogItemEditorHydration, CatalogItemEditorPayload } from '@/shared/domain/catalog/catalogAdminTypes';
import { E2E_BASE_URL } from './support/auth';

const endpoint = '/api/admin/artikli/activate';
const headers = { origin: E2E_BASE_URL };
const ownedSlugs: string[] = [];
async function read(request: APIRequestContext, slug: string): Promise<CatalogItemEditorHydration> {
  const response = await request.get('/api/admin/artikli/' + slug);
  expect(response.status(), await response.text()).toBe(200);
  return response.json();
}
type CreateOptions = {
  existingActive?: boolean;
  shipping?: 'complete' | 'missing' | 'zero';
  prices?: [number, number, number];
  productType?: CatalogEditorProductType;
  namePrefix?: string;
};
async function create(request: APIRequestContext, options: CreateOptions = {}) {
  const seed = await read(request, 'aluminijasta-plosca');
  const suffix = Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  const slug = 'aktivacija-' + suffix;
  const productType = options.productType ?? 'simple';
  const measurement = options.shipping === 'missing' ? null : options.shipping === 'zero' ? 0 : undefined;
  const payload: CatalogItemEditorPayload = {
    slug, sku: 'ACT-' + suffix, itemName: (options.namePrefix ?? 'Preizkus aktivacije') + ' ' + suffix,
    itemType: productType === 'dimensions' ? 'sheet' : productType === 'weight' ? 'bulk' : 'unit',
    productType, unit: productType === 'weight' ? 'kg' : 'kos', status: 'inactive',
    categoryPath: seed.categoryPath, media: [], taxRate: 0.22,
    optionAxes: [{ name: 'Izvedba', slug: 'izvedba', values: [0, 1, 2].map(index => ({ value: String(index + 1), slug: String(index + 1) })) }],
    variants: [0, 1, 2].map(index => ({
      variantName: 'Izvedba ' + (index + 1), variantSku: 'ACT-' + suffix + '-' + index,
      status: options.existingActive && index === 2 ? 'active' : 'inactive',
      price: options.prices?.[index] ?? 4 + index, costNet: 1 + index, inventory: 10 + index, position: index + 1,
      length: measurement === undefined ? 100 : measurement,
      width: measurement === undefined ? 50 : measurement,
      thickness: measurement === undefined ? 20 : measurement,
      weight: measurement === undefined ? 0.3 : measurement,
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

test('missing and zero shipping measurements never block activation for any article type', async ({ request }) => {
  test.setTimeout(120_000);
  const items: CatalogItemEditorHydration[] = [];
  for (const productType of ['simple', 'dimensions', 'weight', 'unique_machine'] as const) {
    for (const shipping of ['missing', 'zero'] as const) items.push(await create(request, { productType, shipping }));
  }
  const response = await request.post(endpoint, { headers, data: { mode: 'all', itemIdentifiers: items.map(item => item.slug) } });
  expect(response.status(), await response.text()).toBe(200);
  const result = await response.json();
  expect(result.skipped).toEqual([]);
  expect(result.activatedItemCount).toBe(8);
  expect(result.activatedVariantCount).toBe(24);
  for (const before of items) {
    const after = await read(request, before.slug);
    expect(after.status).toBe('active');
    expect(after.variants.every(variant => variant.status === 'active')).toBe(true);
    expect(preserved(after)).toEqual(preserved(before));
    expect(result.items.find((item: { id: number }) => item.id === after.id)?.shippingReady).toBe(false);
    for (const variant of after.variants) expect(variant.shippingWeightGrams).toBeNull();
  }
});

test('explicit variant targets merge with first activation and reject foreign variants atomically', async ({ request }) => {
  const before = await create(request);
  const other = await create(request);
  const bad = await request.post(endpoint, { headers, data: { mode: 'first', itemIdentifiers: [before.slug], variants: [{ itemIdentifier: before.slug, variantId: other.variants[1].id }] } });
  expect(bad.status()).toBe(400);
  expect(await read(request, before.slug)).toEqual(before);
  expect(await read(request, other.slug)).toEqual(other);
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


test('mixed valid and zero-price families activate eligible rows and report every skipped identity', async ({ request }) => {
  const valid = await create(request, { shipping: 'missing' });
  const invalid = await create(request, { prices: [0, 0, 0], shipping: 'zero' });
  const response = await request.post(endpoint, { headers, data: { mode: 'all', itemIdentifiers: [valid.slug, invalid.slug] } });
  expect(response.status(), await response.text()).toBe(200);
  const result = await response.json();
  expect(result.activatedItemCount).toBe(1);
  expect(result.activatedVariantCount).toBe(3);
  for (const variant of invalid.variants) {
    expect(result.skipped).toContainEqual(expect.objectContaining({
      itemId: invalid.id, itemName: invalid.itemName, itemSku: invalid.sku,
      variantId: variant.id, variantName: variant.variantName, variantSku: variant.variantSku,
      reasons: expect.arrayContaining([expect.stringMatching(/cena.*večja od 0/i)])
    }));
  }
  expect(result.skipped).toContainEqual(expect.objectContaining({ itemId: invalid.id, itemName: invalid.itemName }));
  const validAfter = await read(request, valid.slug);
  expect(validAfter.status).toBe('active');
  expect(validAfter.variants.map(variant => variant.status)).toEqual(['active', 'active', 'active']);
  expect(preserved(validAfter)).toEqual(preserved(valid));
  expect(await read(request, invalid.slug)).toEqual(invalid);
});

test('a partially valid family publishes eligible variants while leaving zero-price rows unchanged', async ({ request }) => {
  const before = await create(request, { prices: [4, 0, 6], shipping: 'missing' });
  const response = await request.post(endpoint, { headers, data: { mode: 'all', itemIdentifiers: [before.slug] } });
  expect(response.status(), await response.text()).toBe(200);
  const result = await response.json();
  expect(result.activatedItemCount).toBe(1);
  expect(result.activatedVariantCount).toBe(2);
  expect(result.skipped).toHaveLength(1);
  expect(result.skipped[0]).toMatchObject({ itemId: before.id, variantId: before.variants[1].id, variantSku: before.variants[1].variantSku });
  expect(result.skipped[0].reasons.join(' ')).toMatch(/cena.*večja od 0/i);
  const after = await read(request, before.slug);
  expect(after.status).toBe('active');
  expect(after.variants.map(variant => variant.status)).toEqual(['active', 'inactive', 'active']);
  expect(preserved(after)).toEqual(preserved(before));
});

test('first mode never substitutes a later eligible variant for an invalid first row', async ({ request }) => {
  const before = await create(request, { prices: [0, 5, 6] });
  const response = await request.post(endpoint, { headers, data: { mode: 'first', itemIdentifiers: [before.slug] } });
  expect(response.status(), await response.text()).toBe(200);
  const result = await response.json();
  expect(result.activatedItemCount).toBe(0);
  expect(result.activatedVariantCount).toBe(0);
  expect(result.skipped).toContainEqual(expect.objectContaining({
    itemId: before.id, variantId: before.variants[0].id,
    reasons: expect.arrayContaining([expect.stringMatching(/cena.*večja od 0/i)])
  }));
  expect(await read(request, before.slug)).toEqual(before);
});

test('an already-active invalid sibling blocks parent publication without undoing eligible activation', async ({ request }) => {
  const before = await create(request, { existingActive: true, prices: [4, 5, 0], shipping: 'missing' });
  const response = await request.post(endpoint, { headers, data: { mode: 'first', itemIdentifiers: [before.slug] } });
  expect(response.status(), await response.text()).toBe(200);
  const result = await response.json();
  expect(result.activatedItemCount).toBe(0);
  expect(result.activatedVariantCount).toBe(1);
  const parentSkip = result.skipped.find((target: { itemId: number; variantId?: number }) => target.itemId === before.id && target.variantId === undefined);
  expect(parentSkip).toBeDefined();
  expect(parentSkip.reasons.join(' ')).toMatch(/cena.*večja od 0/i);
  const after = await read(request, before.slug);
  expect(after.status).toBe('inactive');
  expect(after.variants.map(variant => variant.status)).toEqual(['active', 'inactive', 'active']);
  expect(preserved(after)).toEqual(preserved(before));
  expect(after.defaultVariantId).toBe(before.defaultVariantId);
});

test('explicit variant-only targets still enforce positive prices under an inactive parent', async ({ request }) => {
  const before = await create(request, { prices: [0, 5, 6], shipping: 'missing' });
  const response = await request.post(endpoint, { headers, data: {
    mode: 'all', itemIdentifiers: [],
    variants: before.variants.slice(0, 2).map(variant => ({ itemIdentifier: before.slug, variantId: variant.id }))
  } });
  expect(response.status(), await response.text()).toBe(200);
  const result = await response.json();
  expect(result.activatedItemCount).toBe(0);
  expect(result.activatedVariantCount).toBe(1);
  expect(result.skipped).toContainEqual(expect.objectContaining({ variantId: before.variants[0].id }));
  const after = await read(request, before.slug);
  expect(after.status).toBe('inactive');
  expect(after.variants.map(variant => variant.status)).toEqual(['inactive', 'active', 'inactive']);
  expect(preserved(after)).toEqual(preserved(before));
});

test('malformed or missing activation targets roll back the entire request', async ({ request }) => {
  const before = await create(request);
  const invalidSelections = [
    { mode: 'all', itemIdentifiers: [before.slug, 'missing-activation-' + Date.now()] },
    { mode: 'all', itemIdentifiers: [before.slug], variants: [{ itemIdentifier: before.slug, variantId: String(before.variants[0].id) }] },
    { mode: 'all', itemIdentifiers: [before.slug], variants: [{ itemIdentifier: before.slug, variantId: -1 }] }
  ];
  for (const data of invalidSelections) {
    const response = await request.post(endpoint, { headers, data });
    expect(response.status(), await response.text()).toBe(400);
    expect(await read(request, before.slug)).toEqual(before);
  }
});

test('repeating partial activation has zero transitions and preserves timestamps and commercial revisions', async ({ request }) => {
  const before = await create(request, { prices: [4, 0, 6], shipping: 'missing' });
  const data = { mode: 'all', itemIdentifiers: [before.slug] };
  const first = await request.post(endpoint, { headers, data });
  expect(first.status(), await first.text()).toBe(200);
  const afterFirst = await read(request, before.slug);
  const second = await request.post(endpoint, { headers, data });
  expect(second.status(), await second.text()).toBe(200);
  const repeated = await second.json();
  expect(repeated.activatedItemCount).toBe(0);
  expect(repeated.activatedVariantCount).toBe(0);
  expect(repeated.skipped).toHaveLength(1);
  expect(await read(request, before.slug)).toEqual(afterFirst);
});

test('full editor saves can publish every article type without shipping data but reject zero selling prices', async ({ request }) => {
  test.setTimeout(120_000);
  for (const productType of ['simple', 'dimensions', 'weight', 'unique_machine'] as const) {
    const before = await create(request, { productType, shipping: 'missing' });
    const payload: CatalogItemEditorPayload = {
      ...before, expectedUpdatedAt: before.updatedAt, status: 'active',
      variants: before.variants.map(variant => ({ ...variant, status: 'active', expectedStockRevision: variant.stockRevision, expectedPricingRevision: variant.pricingRevision }))
    };
    const saved = await request.post('/api/admin/artikli', { headers, data: payload });
    expect(saved.status(), await saved.text()).toBe(200);
    const after = await read(request, before.slug);
    expect(after.status).toBe('active');
    expect(after.productType).toBe(productType);
    expect(preserved(after)).toEqual(preserved(before));
    const invalidPayload: CatalogItemEditorPayload = {
      ...after, expectedUpdatedAt: after.updatedAt, status: 'active',
      variants: after.variants.map((variant, index) => ({ ...variant, price: index === 0 ? 0 : variant.price, expectedStockRevision: variant.stockRevision, expectedPricingRevision: variant.pricingRevision }))
    };
    const rejected = await request.post('/api/admin/artikli', { headers, data: invalidPayload });
    expect(rejected.status(), await rejected.text()).toBe(400);
    expect((await rejected.json()).message).toMatch(/cena.*večja od 0/i);
    expect(await read(request, before.slug)).toEqual(after);
  }
});

test('an activated article with missing shipping measurements can be edited and saved through the browser', async ({ page, request }) => {
  const created = await create(request, { shipping: 'missing' });
  const activated = await request.post(endpoint, { headers, data: { mode: 'all', itemIdentifiers: [created.slug] } });
  expect(activated.status(), await activated.text()).toBe(200);
  const before = await read(request, created.slug);
  expect(before.status).toBe('active');
  expect(before.variants.every(variant => variant.shippingWeightGrams === null)).toBe(true);
  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.goto('/admin/artikli/' + before.slug);
  const name = page.getByRole('textbox', { name: 'Naziv artikla', exact: true }).first();
  await expect(name).toBeDisabled();
  await page.getByRole('button', { name: 'Uredi artikel', exact: true }).first().click();
  await expect(name).toBeEnabled();
  const changedName = before.itemName + ' popravljeno';
  await name.fill(changedName);
  const save = page.getByRole('button', { name: 'Shrani', exact: true });
  await expect(save).toBeEnabled();
  await save.click();
  const confirmation = page.getByRole('dialog', { name: /^Pred shranjevanjem preverite spremembe/ });
  await expect(confirmation).toBeVisible();
  await expect(confirmation).toContainText(changedName);
  const posted = page.waitForResponse(response => new URL(response.url()).pathname === '/api/admin/artikli' && response.request().method() === 'POST');
  await confirmation.getByRole('button', { name: 'Potrdi in shrani', exact: true }).click();
  const response = await posted;
  expect(response.status(), await response.text()).toBe(200);
  await expect(confirmation).toHaveCount(0);
  await expect(save).toBeDisabled();
  const after = await read(request, before.slug);
  expect(after.itemName).toBe(changedName);
  expect(after.status).toBe('active');
  const commercialAndShipping = (item: CatalogItemEditorHydration) => item.variants.map(variant => ({
    id: variant.id, status: variant.status, price: variant.price, costNet: variant.costNet,
    inventory: variant.inventory, stockRevision: variant.stockRevision, pricingRevision: variant.pricingRevision,
    weight: variant.weight, length: variant.length, width: variant.width, thickness: variant.thickness,
    shippingWeightGrams: variant.shippingWeightGrams, shippingLengthMm: variant.shippingLengthMm,
    shippingWidthMm: variant.shippingWidthMm, shippingHeightMm: variant.shippingHeightMm
  }));
  expect(commercialAndShipping(after)).toEqual(commercialAndShipping(before));
});

test('bulk activation shows skipped item, variant, SKU and reason in a notice below stock settings and above the table', async ({ page, request }) => {
  const namePrefix = 'Preizkus opozorila aktivacije ' + Date.now();
  const valid = await create(request, { namePrefix, shipping: 'missing' });
  const invalid = await create(request, { namePrefix, prices: [0, 0, 0] });
  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.goto('/admin/artikli');
  await page.getByPlaceholder(/Poišči artikel/).first().fill(namePrefix);
  for (const item of [valid, invalid]) {
    await page.locator('tr[data-edit-scope="family:' + item.id + '"]').getByRole('checkbox', { name: 'Izberi ' + item.itemName, exact: true }).check();
  }
  await page.getByRole('button', { name: 'Status ▾ (2)', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Aktiven', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Aktivacija artiklov', exact: true });
  await expect(dialog.getByRole('radio', { name: /^Glavni artikli in vse različice/ })).toBeChecked();
  await expect(dialog).toContainText('nad tabelo, pod razdelkom Zaloga');
  const saved = page.waitForResponse(response => new URL(response.url()).pathname === endpoint && response.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Aktiviraj', exact: true }).click();
  expect((await saved).status()).toBe(200);
  await expect(dialog).toHaveCount(0);
  const notice = page.getByRole('status', { name: 'Ni bilo aktivirano', exact: true });
  await expect(notice).toBeVisible();
  await expect(notice.getByRole('heading', { name: 'Ni bilo aktivirano', exact: true })).toBeVisible();
  await expect(notice).toContainText(invalid.itemName);
  for (const variant of invalid.variants) {
    await expect(notice).toContainText(variant.variantName);
    await expect(notice).toContainText(variant.variantSku!);
  }
  await expect(notice).toContainText(/cena.*večja od 0/i);
  await expect(notice).not.toContainText(valid.itemName);
  const table = page.getByRole('table').first();
  const stock = page.getByTestId('admin-inventory-policy-control');
  const [tableBox, noticeBox, stockBox] = await Promise.all([table.boundingBox(), notice.boundingBox(), stock.boundingBox()]);
  expect(tableBox).not.toBeNull();
  expect(noticeBox).not.toBeNull();
  expect(stockBox).not.toBeNull();
  expect(noticeBox!.y).toBeGreaterThanOrEqual(stockBox!.y + stockBox!.height - 1);
  expect(noticeBox!.y + noticeBox!.height).toBeLessThanOrEqual(tableBox!.y + 1);
  expect((await read(request, valid.slug)).status).toBe('active');
  expect(await read(request, invalid.slug)).toEqual(invalid);
});
