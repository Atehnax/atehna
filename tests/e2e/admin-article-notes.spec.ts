import { expect, test } from '@playwright/test';
import type { CatalogItemEditorHydration, CatalogItemEditorPayload } from '@/shared/domain/catalog/catalogAdminTypes';
import type { ProductAppearanceConfig } from '@/shared/domain/style/productAppearance';
import { assertAuthenticatedAdmin, E2E_BASE_URL } from './support/auth';

test('configured note labels/colors persist, custom values survive, and inventory changes leave notes alone', async ({ page, request }) => {
  test.setTimeout(120_000);
  await assertAuthenticatedAdmin(request);
  const readConfig = async () => {
    const response = await request.get('/api/admin/product-appearance');
    expect(response.status(), await response.text()).toBe(200);
    return (await response.json() as { config: ProductAppearanceConfig }).config;
  };
  const beforeConfig = await readConfig();
  const suffix = Date.now().toString(36);
  const slug = 'e2e-opombe-' + suffix;
  const legacyNote = 'Posebna Serija ' + suffix;
  const label = 'Posebna ponudba ' + suffix;
  const newLabel = 'Po naročilu ' + suffix;
  let created = false;
  let configChanged = false;
  try {
    const seedResponse = await request.get('/api/admin/artikli/aluminijasta-plosca');
    expect(seedResponse.status(), await seedResponse.text()).toBe(200);
    const seed = await seedResponse.json() as CatalogItemEditorHydration;
    const payload: CatalogItemEditorPayload = {
      itemName: 'Opombe ' + suffix, slug, sku: 'E2E-NOTE-' + suffix, itemType: 'unit', productType: 'simple', status: 'inactive',
      categoryPath: seed.categoryPath, unit: 'kos', taxRate: 0.22, badge: legacyNote,
      media: [], optionAxes: [], quantityDiscounts: [],
      variants: [
        { variantName: 'Osnovna', variantSku: 'E2E-NOTE-A-' + suffix, price: 3, inventory: 7, status: 'active', badge: 'na-zalogi', unit: 'kos' },
        { variantName: 'Posebna', variantSku: 'E2E-NOTE-B-' + suffix, price: 4, inventory: 0, status: 'active', badge: legacyNote, unit: 'kos' }
      ]
    };
    const create = await request.post('/api/admin/artikli', { headers: { origin: E2E_BASE_URL }, data: payload });
    expect(create.status(), await create.text()).toBe(200);
    created = true;
    const createdId = (await create.json() as { id: number }).id;

    await page.goto('/admin/podoba/artikli');
    await page.getByRole('button', { name: 'Opombe artiklov', exact: true }).click();
    await expect(page.getByLabel('Naziv opombe na-zalogi', { exact: true })).toHaveValue('Brez opomb');
    await page.getByLabel('Naziv opombe ' + legacyNote, { exact: true }).fill(label);
    const color = page.getByLabel('Barva opombe ' + legacyNote, { exact: true });
    await color.fill('#d97706');
    await color.press('Tab');
    await page.getByLabel('Nova opomba', { exact: true }).fill(newLabel);
    await page.getByRole('button', { name: 'Dodaj opombo', exact: true }).click();
    const appearanceSaved = page.waitForResponse(response => new URL(response.url()).pathname === '/api/admin/product-appearance' && response.request().method() === 'PUT');
    await page.getByRole('button', { name: 'Shrani', exact: true }).click();
    const savedResponse = await appearanceSaved;
    configChanged = savedResponse.ok();
    expect(savedResponse.status(), await savedResponse.text()).toBe(200);
    const config = await readConfig();
    expect(config.articleNotes.tags.find(tag => tag.id === legacyNote)).toMatchObject({ label, color: '#d97706' });
    expect(config.articleNotes.tags.some(tag => tag.label === newLabel)).toBe(true);
    await page.reload();
    await page.getByRole('button', { name: 'Opombe artiklov', exact: true }).click();
    await expect(page.getByLabel('Naziv opombe ' + legacyNote, { exact: true })).toHaveValue(label);

    await page.goto('/admin/artikli');
    await page.getByPlaceholder(/Poišči artikel/).first().fill(payload.itemName);
    const row = page.locator('tr[data-edit-scope="family:' + createdId + '"]');
    await expect(row.getByText(label, { exact: true })).toBeVisible();
    await expect(row.getByText(label, { exact: true })).toHaveCSS('color', 'rgb(141, 77, 4)');

    await page.goto('/admin/artikli/' + slug);
    await page.getByRole('tab', { name: 'Prodaja', exact: true }).click();
    await page.getByRole('button', { name: 'Uredi artikel', exact: true }).first().click();
    for (const [variant, stock] of [['Osnovna', '0'], ['Posebna', '3']]) {
      const field = page.getByLabel('Zaloga za ' + variant, { exact: true });
      if (!await field.isVisible()) await page.getByRole('button', { name: 'Razširi različico ' + variant, exact: true }).click();
      await field.fill(stock);
      await field.press('Tab');
    }
    await page.getByRole('button', { name: 'Shrani', exact: true }).click();
    const itemSaved = page.waitForResponse(response => new URL(response.url()).pathname === '/api/admin/artikli' && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Potrdi in shrani', exact: true }).click();
    const itemResponse = await itemSaved;
    expect(itemResponse.status(), await itemResponse.text()).toBe(200);
    const afterResponse = await request.get('/api/admin/artikli/' + slug);
    expect(afterResponse.status(), await afterResponse.text()).toBe(200);
    const after = await afterResponse.json() as CatalogItemEditorHydration;
    expect(after.badge).toBe(legacyNote);
    expect(after.variants.map(variant => ({ stock: variant.inventory, badge: variant.badge }))).toEqual([
      { stock: 0, badge: 'na-zalogi' }, { stock: 3, badge: legacyNote }
    ]);
  } finally {
    if (created) {
      const deleted = await request.delete('/api/admin/artikli/' + slug, { headers: { origin: E2E_BASE_URL } });
      expect.soft(deleted.status(), await deleted.text()).toBe(200);
    }
    if (configChanged) {
      const restored = await request.put('/api/admin/product-appearance', { headers: { origin: E2E_BASE_URL }, data: { config: beforeConfig } });
      expect.soft(restored.status(), await restored.text()).toBe(200);
    }
  }
});
