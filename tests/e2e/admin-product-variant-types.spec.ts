import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import type { CatalogItemEditorHydration, CatalogItemEditorPayload, CatalogEditorProductType } from '@/shared/domain/catalog/catalogAdminTypes';
import { assertAuthenticatedAdmin, E2E_BASE_URL } from './support/auth';

const createdSlugs: string[] = [];
async function readProduct(request: APIRequestContext, slug: string) {
  const response = await request.get(`/api/admin/artikli/${encodeURIComponent(slug)}`);
  expect(response.status(), await response.text()).toBe(200);
  return response.json() as Promise<CatalogItemEditorHydration>;
}
async function createProduct(request: APIRequestContext, type: CatalogEditorProductType, count = 2) {
  const seed = await readProduct(request, 'aluminijasta-plosca');
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const slug = `preizkus-razlicic-${suffix}`;
  const payload: CatalogItemEditorPayload = {
    itemName: `Preizkus različic ${suffix}`, slug, sku: `E2E-VAR-${suffix}`,
    itemType: type === 'dimensions' ? 'sheet' : type === 'weight' ? 'bulk' : 'unit',
    productType: type, status: 'inactive', categoryPath: seed.categoryPath,
    unit: type === 'weight' ? 'kg' : 'kos', taxRate: 0.22, media: [], quantityDiscounts: [],
    typeSpecificData: {
      simple: { basePrice: 999, stock: 999, deliveryTime: '3 dni' },
      dimensions: { defaultDeliveryTime: '3 dni', variantDeliveryTimes: {} },
      uniqueMachine: { basePrice: 999, stock: 999, deliveryTime: '3 dni', serialNumbers: [] }
    },
    optionAxes: [{ name: 'Izvedba', slug: 'izvedba', values: [
      { value: 'Ekspres', slug: 'ekspres' }, ...(count > 1 ? [{ value: 'Special', slug: 'special' }] : [])
    ] }, { name: 'Neto masa', slug: 'neto-masa', values: [{ value: '500 g', slug: '500-g' }] }],
    variants: Array.from({ length: count }, (_, index) => ({
      variantName: `${index ? 'Special' : 'Ekspres'} 500 g`, variantSku: `E2E-VAR-${suffix}-${index}`,
      price: index ? 8.35 : 4.75, costNet: index ? 3.15 : 2.25, inventory: index ? 13 : 7,
      discountPct: index ? 5 : 0, minOrder: 1, status: 'active', unit: type === 'weight' ? 'kg' : 'kos',
      length: type === 'dimensions' ? 200 : null, width: type === 'dimensions' ? 100 : null,
      thickness: type === 'dimensions' ? 0.5 : null, weight: null,
      optionSelections: { izvedba: index ? 'special' : 'ekspres', 'neto-masa': '500-g' },
      contentOverride: { description: `Opis različice ${index}`, specifications: { 'Neto vsebina': '500 g' } }
    }))
  };
  const response = await request.post('/api/admin/artikli', { headers: { origin: E2E_BASE_URL }, data: payload });
  expect(response.status(), await response.text()).toBe(200);
  createdSlugs.push(slug);
  return readProduct(request, slug);
}
function commerce(product: CatalogItemEditorHydration) {
  return product.variants.map(v => ({ id:v.id, sku:v.variantSku, name:v.variantName, price:v.price,
    costNet:v.costNet, stock:v.inventory, discount:v.discountPct, unit:v.unit,
    length:v.length,width:v.width,thickness:v.thickness,weight:v.weight,
    shippingWeightGrams:v.shippingWeightGrams, shippingLengthMm:v.shippingLengthMm,
    shippingWidthMm:v.shippingWidthMm,shippingHeightMm:v.shippingHeightMm,
    description:v.contentOverride?.description, specifications:v.contentOverride?.specifications,
  }));
}
async function openEditor(page: Page, slug: string) {
  await page.goto(`/admin/artikli/${slug}`);
  await page.getByRole('tab', { name: 'Prodaja', exact: true }).click();
  await page.getByRole('button', { name: 'Uredi artikel', exact: true }).first().click();
  await expandVariant(page, 'Ekspres 500 g');
}
async function expandVariant(page: Page, label: string) {
  const field = page.getByLabel(`Izvedba za ${label}`, { exact: true });
  if (!await field.isVisible()) {
    await page.getByRole('button', { name: `Razširi različico ${label}`, exact: true }).click();
  }
  await expect(field).toBeVisible();
}
async function saveEditor(page: Page) {
  await page.getByRole('button', { name: 'Shrani', exact: true }).click();
  const confirmation = page.getByRole('button', { name: 'Potrdi in shrani', exact: true });
  await expect(confirmation).toBeVisible();
  const saved = page.waitForResponse(response => new URL(response.url()).pathname === '/api/admin/artikli' && response.request().method() === 'POST');
  await confirmation.click();
  const response = await saved;
  expect(response.status(), await response.text()).toBe(200);
  await expect(page.getByRole('button', { name: 'Shrani', exact: true })).toBeDisabled();
}
async function selectType(page: Page, title: string) {
  const expand = page.getByRole('button', { name: 'Spremeni tip artikla', exact: true });
  if (await expand.isVisible()) await expand.click();
  await page.getByRole('button', { name: new RegExp(`^${title.replace('/', '\\/')}`) }).click();
  const confirm = page.getByRole('button', { name: 'Da, spremeni tip', exact: true });
  if (await confirm.isVisible()) await confirm.click();
}

test.afterAll(async ({ request }) => {
  for (const slug of createdSlugs) {
    const response = await request.delete(`/api/admin/artikli/${slug}`, { headers: { origin:E2E_BASE_URL } });
    expect(response.status(), await response.text()).toBe(200);
  }
});

test('standard products edit attributes in variant rows and keep same-mass formulations separate', async ({ page, request }) => {
  await assertAuthenticatedAdmin(request);
  const before = await createProduct(request, 'simple');
  await openEditor(page, before.slug);
  await expect(page.getByRole('heading', { name:'Izbirne lastnosti', exact:true })).toHaveCount(0);
  await page.getByLabel('Izvedba za Ekspres 500 g', { exact:true }).fill('Ekspres Plus');
  await page.getByLabel('Izvedba za Ekspres 500 g', { exact:true }).press('Tab');
  await page.getByLabel('Nova lastnost različic', { exact:true }).fill('Pakiranje');
  await page.getByRole('button', { name:'Dodaj lastnost', exact:true }).click();
  for (const label of ['Ekspres 500 g', 'Special 500 g']) {
    await expandVariant(page, label);
    await page.getByLabel(`Pakiranje za ${label}`, { exact:true }).fill('Plastenka');
    await page.getByLabel(`Pakiranje za ${label}`, { exact:true }).press('Tab');
  }
  await saveEditor(page);
  const after = await readProduct(request, before.slug);
  expect(after.productType).toBe('simple');
  expect(commerce(after)).toEqual(commerce(before));
  const packaging = after.optionAxes.find(axis=>axis.name==='Pakiranje');
  expect(packaging?.values.some(value=>value.value==='Plastenka')).toBe(true);
  expect(after.optionAxes.find(axis=>axis.name==='Izvedba')?.values.some(value=>value.value==='Ekspres Plus')).toBe(true);
  const massAxis = after.optionAxes.find(axis=>axis.name==='Neto masa')!;
  expect(massAxis.values.map(value=>value.value)).toEqual(['500 g']);
  expect(after.variants.map(v=>v.optionValueIds)).not.toEqual([after.variants[0].optionValueIds,after.variants[0].optionValueIds]);
  await page.reload();
  await page.getByRole('tab', { name:'Prodaja',exact:true }).click();
  await expandVariant(page, 'Ekspres 500 g');
  await expect(page.getByLabel('Izvedba za Ekspres 500 g', {exact:true})).toHaveValue('Ekspres Plus');
});

test('switching dimensions to standard and machine preserves every variant and its sales data', async ({ page, request }) => {
  const before = await createProduct(request, 'dimensions');
  await openEditor(page,before.slug);
  await selectType(page,'Standardni');
  await saveEditor(page);
  const standard = await readProduct(request,before.slug);
  expect(standard.productType).toBe('simple');
  expect(standard.itemType).toBe('unit');
  expect(commerce(standard)).toEqual(commerce(before));
  expect(standard.optionAxes).toEqual(before.optionAxes);
  await page.reload();
  await page.getByRole('tab',{name:'Prodaja',exact:true}).click();
  await page.getByRole('button',{name:'Uredi artikel',exact:true}).first().click();
  await selectType(page,'Stroj / oprema');
  await saveEditor(page);
  const machine = await readProduct(request,before.slug);
  expect(machine.productType).toBe('unique_machine');
  expect(commerce(machine)).toEqual(commerce(before));
  expect(machine.optionAxes).toEqual(before.optionAxes);
  await page.goto('/admin/artikli');
  await page.getByPlaceholder(/Poišči artikel/).first().fill(before.itemName);
  const expand = page.getByRole('button',{name:`Prikaži različice za ${before.itemName}`,exact:true});
  await expect(expand).toBeEnabled();
  await expand.click();
  for (const variant of before.variants) await expect(page.getByText(variant.variantSku!,{exact:true}).first()).toBeVisible();
});

test('one standard variant is sufficient and an empty variant list is rejected', async ({ page,request }) => {
  const before=await createProduct(request,'simple',1);
  await openEditor(page,before.slug);
  await page.getByLabel('Izvedba za Ekspres 500 g',{exact:true}).fill('Ekspres Plus');
  await page.getByLabel('Izvedba za Ekspres 500 g',{exact:true}).press('Tab');
  await saveEditor(page);
  const after=await readProduct(request,before.slug);
  expect(commerce(after)).toEqual(commerce(before));
  expect(after.variants).toHaveLength(1);
  const response=await request.post('/api/admin/artikli',{headers:{origin:E2E_BASE_URL},data:{...after,status:'inactive',expectedUpdatedAt:after.updatedAt,variants:[]}});
  expect(response.status()).toBe(400);
  expect((await readProduct(request,before.slug)).variants).toHaveLength(1);
});


test('dimension variants edit arbitrary attributes in the same table without changing measurements', async ({ page, request }) => {
  const before=await createProduct(request,'dimensions');
  await openEditor(page,before.slug);
  await page.getByLabel('Izvedba za Ekspres 500 g',{exact:true}).fill('Ekspres Plus');
  await page.getByLabel('Izvedba za Ekspres 500 g',{exact:true}).press('Tab');
  await saveEditor(page);
  const after=await readProduct(request,before.slug);
  expect(after.productType).toBe('dimensions');
  expect(commerce(after)).toEqual(commerce(before));
});

test('standard delivery measurements can be entered independently of variant options and used for publication', async ({ page, request }) => {
  const before=await createProduct(request,'simple',1);
  await openEditor(page,before.slug);
  for(const [field,value] of [['Dolžina','100'],['Širina','80'],['Višina','60']]) {
    await page.getByLabel(field+' za dostavo za Ekspres 500 g',{exact:true}).fill(value);
    await page.getByLabel(field+' za dostavo za Ekspres 500 g',{exact:true}).press('Tab');
  }
  await page.getByLabel('Masa za Ekspres 500 g',{exact:true}).fill('620');
  await page.getByLabel('Masa za Ekspres 500 g',{exact:true}).press('Tab');
  await saveEditor(page);
  const after=await readProduct(request,before.slug);
  expect(after.variants[0]).toMatchObject({length:100,width:80,thickness:60,weight:0.62,shippingWeightGrams:620,shippingLengthMm:100,shippingWidthMm:80,shippingHeightMm:60});
  expect(after.optionAxes).toEqual(before.optionAxes);
  const published=await request.post('/api/admin/artikli',{headers:{origin:E2E_BASE_URL},data:{...after,status:'active',expectedUpdatedAt:after.updatedAt}});
  expect(published.status(),await published.text()).toBe(200);
  expect((await readProduct(request,before.slug)).status).toBe('active');
});

test('weight variants retain independent options, IDs, prices and stock when they have the same mass choice', async ({ page, request }) => {
  const before=await createProduct(request,'weight');
  await openEditor(page,before.slug);
  await page.getByLabel('Izvedba za Ekspres 500 g',{exact:true}).fill('Ekspres Plus');
  await page.getByLabel('Izvedba za Ekspres 500 g',{exact:true}).press('Tab');
  await saveEditor(page);
  const after=await readProduct(request,before.slug);
  expect(after.productType).toBe('weight');
  expect(commerce(after)).toEqual(commerce(before));
  expect(after.variants.every(variant=>variant.unit==='kg')).toBe(true);
});
