import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { buildDimensionalVariantSelectorModel } from '@/commercial/features/products/dimensionalVariants';
import { buildStorefrontProductFromCatalogItem } from '@/commercial/features/products/storefrontProduct';
import type { CatalogItemEditorHydration, CatalogItemEditorPayload } from '@/shared/domain/catalog/catalogAdminTypes';
import type { CatalogItem } from '@/shared/domain/catalog/catalogTypes';
import { assertAuthenticatedAdmin, E2E_BASE_URL } from './support/auth';

const createdSlugs: string[] = [];
async function readProduct(request: APIRequestContext, slug: string) {
  const response = await request.get('/api/admin/artikli/' + encodeURIComponent(slug));
  expect(response.status(), await response.text()).toBe(200);
  return response.json() as Promise<CatalogItemEditorHydration>;
}
async function createDimensionProduct(request: APIRequestContext) {
  // Borrow only the seeded category; the real aluminium product is never edited.
  const seed = await readProduct(request, 'aluminijasta-plosca');
  const suffix = Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  const slug = 'preizkus-dimenzij-' + suffix;
  const payload: CatalogItemEditorPayload = {
    itemName: 'Preizkus dimenzij ' + suffix, slug, sku: 'E2E-DIM-' + suffix,
    itemType: 'sheet', productType: 'dimensions', status: 'active',
    categoryPath: seed.categoryPath, unit: 'kos', taxRate: 0.22, media: [], quantityDiscounts: [],
    typeSpecificData: { dimensions: { defaultDeliveryTime: '', variantDeliveryTimes: {} } },
    optionAxes: [{
      name: 'Dimenzije', slug: 'dimenzije',
      values: [{ value: '200 × 200 mm', slug: '200-200-mm' }]
    }],
    variants: [0.5, 0.3].map((thickness, index) => ({
      variantName: String(thickness).replace('.', ',') + ' × 200 × 200 mm',
      variantSku: 'E2E-DIM-' + suffix + '-' + index,
      thickness, length: 200, width: 200, price: index === 0 ? 5 : 4,
      inventory: 50 + index, minOrder: 1, discountPct: 0,
      costNet: null, weight: null, errorTolerance: null, contentOverride: null, badge: null,
      status: 'active', unit: 'kos',
      // This legacy selection used to collide despite the different thickness.
      optionSelections: { dimenzije: '200-200-mm' }
    }))
  };
  const response = await request.post('/api/admin/artikli', {
    headers: { origin: E2E_BASE_URL }, data: payload
  });
  expect(response.status(), await response.text()).toBe(200);
  createdSlugs.push(slug);
  return readProduct(request, slug);
}
function expectDistinctDimensionChoices(product: CatalogItemEditorHydration, thicknesses: number[]) {
  expect(product.optionAxes).toHaveLength(1);
  const axis = product.optionAxes[0];
  expect(axis.name).toBe('Dimenzije');
  expect(axis.values).toHaveLength(thicknesses.length);
  const selectionIds = product.variants.map((variant, index) => {
    expect(variant).toMatchObject({ thickness: thicknesses[index], length: 200, width: 200 });
    expect(variant.optionValueIds).toHaveLength(1);
    const selectedId = variant.optionValueIds![0];
    expect(axis.values.find(value => value.id === selectedId)?.value).toBe(
      String(thicknesses[index]).replace('.', ',') + ' × 200 × 200 mm'
    );
    return selectedId;
  });
  expect(new Set(selectionIds).size).toBe(thicknesses.length);
  // Exercise the public mapper and selection model with the persisted records.
  const storefront = buildStorefrontProductFromCatalogItem({
    ...product, name: product.itemName
  } as unknown as CatalogItem, {
    href: '/products/test/items/' + product.slug,
    fallbackSku: product.sku ?? '', fallbackPrice: 0,
    category: { slug: 'test', title: 'Test', href: '/products/test' }
  });
  const model = buildDimensionalVariantSelectorModel(storefront.optionAxes, storefront.variants);
  expect(model).not.toBeNull();
  const choices = model!.groups.flatMap(group => group.choices);
  expect(choices).toHaveLength(thicknesses.length);
  for (const choice of choices) {
    expect(storefront.variants.filter(variant => variant.optionValueIds.includes(choice.axisValueId))
      .map(variant => variant.id)).toEqual([choice.variant.id]);
  }
}
async function saveEditor(page: Page) {
  await page.getByRole('button', { name: 'Shrani', exact: true }).click();
  const confirmation = page.getByRole('button', { name: 'Potrdi in shrani', exact: true });
  await expect(confirmation).toBeVisible();
  const saved = page.waitForResponse(response =>
    new URL(response.url()).pathname === '/api/admin/artikli' && response.request().method() === 'POST'
  );
  await confirmation.click();
  const response = await saved;
  expect(response.status(), await response.text()).toBe(200);
  await expect(page.getByRole('button', { name: 'Shrani', exact: true })).toBeDisabled();
}
test.afterAll(async ({ request }) => {
  for (const slug of createdSlugs) {
    const response = await request.delete('/api/admin/artikli/' + slug, { headers: { origin: E2E_BASE_URL } });
    expect(response.status(), await response.text()).toBe(200);
  }
});
test('dimension variants save distinct thicknesses with optional blanks and a single dimensions editor row', async ({ page, request }) => {
  test.setTimeout(60_000);
  await assertAuthenticatedAdmin(request);
  const before = await createDimensionProduct(request);
  expectDistinctDimensionChoices(before, [0.5, 0.3]);
  for (const variant of before.variants) {
    expect(variant).toMatchObject({ costNet: null, weight: null, errorTolerance: null, badge: null });
  }
  const duplicate = await request.post('/api/admin/artikli', {
    headers: { origin: E2E_BASE_URL },
    data: {
      ...before,
      status: 'active',
      expectedUpdatedAt: before.updatedAt,
      variants: before.variants.map(variant => ({ ...variant, thickness: 0.5 }))
    }
  });
  expect(duplicate.status(), await duplicate.text()).toBe(400);
  expect((await duplicate.json()).message).toBe('Vsaka različica mora imeti enolično kombinacijo izbirnih lastnosti.');
  expectDistinctDimensionChoices(await readProduct(request, before.slug), [0.5, 0.3]);
  await page.goto('/admin/artikli/' + before.slug);
  await page.getByRole('tab', { name: 'Prodaja', exact: true }).click();
  await page.getByRole('button', { name: 'Uredi artikel', exact: true }).first().click();
  const sales = page.locator('#product-measurements');
  await expect(sales.getByRole('rowheader').filter({ hasText: /^Dimenzije/ })).toHaveCount(1);
  await expect(sales.getByLabel(/^Dimenzije za /)).toHaveCount(0);
  await expect(sales.getByRole('button', { name: 'Uredi lastnosti', exact: true })).toHaveCount(0);
  const thickness = sales.getByLabel(/^Debelina oziroma fi za 0,3/);
  if (!await thickness.isVisible()) {
    await sales.getByRole('button', { name: /^Razširi različico 0,3/ }).click();
  }
  await expect(thickness).toHaveValue('0,3');
  await thickness.fill('0,4');
  await thickness.press('Tab');
  await saveEditor(page);
  const after = await readProduct(request, before.slug);
  expectDistinctDimensionChoices(after, [0.5, 0.4]);
  expect(after.variants.map(variant => ({
    id: variant.id, sku: variant.variantSku, price: variant.price,
    inventory: variant.inventory, costNet: variant.costNet, weight: variant.weight,
    errorTolerance: variant.errorTolerance, badge: variant.badge
  }))).toEqual(before.variants.map(variant => ({
    id: variant.id, sku: variant.variantSku, price: variant.price,
    inventory: variant.inventory, costNet: variant.costNet, weight: variant.weight,
    errorTolerance: variant.errorTolerance, badge: variant.badge
  })));
  // Save again in the same mounted editor: fresh server option IDs must be retained.
  await page.getByRole('button', { name: 'Uredi artikel', exact: true }).first().click();
  const price = sales.getByLabel(/^Prodajna cena brez DDV za 0,4/);
  if (!await price.isVisible()) {
    await sales.getByRole('button', { name: /^Razširi različico 0,4/ }).click();
  }
  await price.fill('4,5');
  await price.press('Tab');
  await saveEditor(page);
  const afterSecondSave = await readProduct(request, before.slug);
  expectDistinctDimensionChoices(afterSecondSave, [0.5, 0.4]);
  expect(afterSecondSave.optionAxes).toEqual(after.optionAxes);
  expect(afterSecondSave.variants.map(variant => ({ id: variant.id, options: variant.optionValueIds })))
    .toEqual(after.variants.map(variant => ({ id: variant.id, options: variant.optionValueIds })));
  expect(afterSecondSave.variants.map(variant => variant.price)).toEqual([5, 4.5]);
  await page.reload();
  await page.getByRole('tab', { name: 'Prodaja', exact: true }).click();
  await expect(sales.getByRole('rowheader').filter({ hasText: /^Dimenzije/ })).toHaveCount(1);
  await expect(sales.getByLabel(/^Dimenzije za /)).toHaveCount(0);
});
