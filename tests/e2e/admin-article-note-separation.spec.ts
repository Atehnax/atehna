import { expect, test, type APIRequestContext } from '@playwright/test';
import type { CatalogItemEditorHydration, CatalogItemEditorPayload } from '@/shared/domain/catalog/catalogAdminTypes';
import type { ProductAppearanceConfig } from '@/shared/domain/style/productAppearance';
import { assertAuthenticatedAdmin, E2E_BASE_URL } from './support/auth';

test('internal article notes never become badges or dropdown choices and survive an editor save', async ({ page, request }) => {
  test.setTimeout(120_000);
  await assertAuthenticatedAdmin(request);
  const suffix = Date.now().toString(36);
  const longInternalNote = `Interni uvoz ${suffix}. Nov artikel je osnutek. Cene so informativne prodajne cene brez DDV; zaloga ni prenesena. Pred objavo preverite ceno, razpoložljivost ter izmerite maso in mere pošiljke.\nDruga vrstica je namenjena samo administratorju.`;
  // A short note must also stay separate; excluding long strings alone would conceal the bug.
  const shortInternalNote = `Dobavitelj preverja paket ${suffix}`;
  const customBadge = `Posebna Serija ${suffix}`;
  const ownedSlugs: string[] = [];
  const readItem = async (client: APIRequestContext, slug: string) => {
    const response = await client.get('/api/admin/artikli/' + slug);
    expect(response.status(), await response.text()).toBe(200);
    return response.json() as Promise<CatalogItemEditorHydration>;
  };
  const seed = await readItem(request, 'aluminijasta-plosca');
  const createItem = async (id: string, adminNotes: string, badge: string | null) => {
    const slug = `e2e-locene-opombe-${suffix}-${id}`;
    const payload: CatalogItemEditorPayload = {
      itemName: `Ločene opombe ${suffix} ${id}`, slug, sku: `E2E-NSEP-${suffix}-${id}`,
      itemType: 'unit', productType: 'simple', status: 'inactive', unit: 'kos', taxRate: 0.22,
      categoryPath: seed.categoryPath, adminNotes, badge, media: [], optionAxes: [], quantityDiscounts: [],
      variants: [{ variantName: 'Osnovna', variantSku: `E2E-NSEP-V-${suffix}-${id}`, price: 3, inventory: 0, status: 'inactive', unit: 'kos', badge: null }]
    };
    const response = await request.post('/api/admin/artikli', { headers: { origin: E2E_BASE_URL }, data: payload });
    expect(response.status(), await response.text()).toBe(200);
    ownedSlugs.push(slug);
    return readItem(request, slug);
  };

  try {
    const noBadge = await createItem('plain', longInternalNote, null);
    const custom = await createItem('custom', shortInternalNote, customBadge);
    const appearanceResponse = await request.get('/api/admin/product-appearance');
    expect(appearanceResponse.status(), await appearanceResponse.text()).toBe(200);
    const config = (await appearanceResponse.json() as { config: ProductAppearanceConfig }).config;
    expect(config.articleNotes.tags.some(tag => tag.id === customBadge)).toBe(true);
    for (const internal of [longInternalNote, shortInternalNote]) {
      expect(config.articleNotes.tags.some(tag => tag.id === internal || tag.label === internal)).toBe(false);
    }

    await page.goto('/admin/artikli/' + noBadge.slug);
    await expect(page.getByRole('button', { name: 'Brez opomb', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: longInternalNote, exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Uredi artikel', exact: true }).first().click();
    await page.getByRole('button', { name: /Brez opomb/ }).first().click();
    const menu = page.getByRole('menu').filter({ has: page.getByRole('menuitem', { name: 'Brez opomb', exact: true }) });
    await expect(menu).toBeVisible();
    for (const internal of [longInternalNote, shortInternalNote]) {
      await expect(menu.getByRole('menuitem', { name: internal, exact: true })).toHaveCount(0);
    }
    await expect(menu.getByRole('menuitem', { name: customBadge, exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('textbox', { name: 'Naziv artikla', exact: true }).first().fill(noBadge.itemName + ' urejeno');
    await page.getByRole('button', { name: 'Shrani', exact: true }).click();
    const saved = page.waitForResponse(response => new URL(response.url()).pathname === '/api/admin/artikli' && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Potrdi in shrani', exact: true }).click();
    const saveResponse = await saved;
    expect(saveResponse.status(), await saveResponse.text()).toBe(200);
    const after = await readItem(request, noBadge.slug);
    expect(after.badge).toBeNull();
    expect(after.adminNotes).toBe(longInternalNote);
    expect(after.variants.every(variant => !variant.badge)).toBe(true);

    await page.goto('/admin/artikli/' + custom.slug);
    await expect(page.getByRole('button', { name: customBadge, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: shortInternalNote, exact: true })).toHaveCount(0);
    const unchanged = await readItem(request, custom.slug);
    expect(unchanged.badge).toBe(customBadge);
    expect(unchanged.adminNotes).toBe(shortInternalNote);

    await page.goto('/admin/artikli');
    await page.getByPlaceholder(/Poišči artikel/).first().fill(shortInternalNote);
    const customRow = page.locator(`tr[data-edit-scope="family:${custom.id}"]`);
    await expect(customRow).toBeVisible();
    await expect(customRow.getByText(customBadge, { exact: true })).toBeVisible();
  } finally {
    for (const slug of ownedSlugs) {
      const response = await request.delete('/api/admin/artikli/' + slug, { headers: { origin: E2E_BASE_URL } });
      expect.soft(response.status(), await response.text()).toBe(200);
    }
  }
});
