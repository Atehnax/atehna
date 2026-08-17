import {
  expect,
  test,
  type APIRequestContext,
  type Page
} from '@playwright/test';
import type { CatalogItemEditorHydration } from '@/shared/domain/catalog/catalogAdminTypes';
import { assertAuthenticatedAdmin } from './support/auth';

const writeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

async function loadSelectedProduct(
  page: Page,
  request: APIRequestContext
): Promise<CatalogItemEditorHydration> {
  const productSelect = page.getByLabel('Artikel v predogledu');
  await expect(productSelect).toBeVisible();
  const selectedSlug = await productSelect.inputValue();
  expect(selectedSlug, 'appearance preview should select a catalogue item')
    .not.toBe('');

  const response = await request.get(
    `/api/admin/artikli/${encodeURIComponent(selectedSlug)}`
  );
  expect(response.ok()).toBeTruthy();
  const product = await response.json() as CatalogItemEditorHydration;
  expect(product.variants.length).toBeGreaterThan(0);
  return product;
}

async function openSpecificationContentPanel(page: Page) {
  const preview = page.locator('[data-admin-product-live-preview="true"]');
  await expect(preview).toBeVisible();

  const specificationContent = preview.locator(
    '[data-product-canvas-element="product-specifications-content"]:visible'
  ).first();
  await expect(
    specificationContent,
    'the nested specification grid should be directly selectable'
  ).toBeVisible();
  await specificationContent.click({ position: { x: 4, y: 4 } });
  await expect(specificationContent).toHaveAttribute(
    'data-product-canvas-selected',
    'true'
  );

  const toolbar = page.locator(
    '[role="toolbar"][data-toolbar-mode="floating"]'
  );
  await expect(toolbar).toBeVisible();
  await expect(toolbar).toHaveAttribute(
    'data-product-toolbar-anchor-id',
    'product-specifications-content'
  );
  await toolbar.getByRole('button', {
    name: 'Vsebina',
    exact: true
  }).click();

  const panel = page.getByRole('dialog', { name: 'Vsebina artikla' });
  await expect(panel).toBeVisible();
  return { panel, preview };
}

test.describe('product specification editing compatibility', () => {
  test('fills desktop specification columns vertically while preserving mobile reading order', async ({
    page,
    request
  }) => {
    await assertAuthenticatedAdmin(request);
    const writes: string[] = [];
    await page.route('**/api/admin/**', async (route) => {
      const method = route.request().method();
      if (writeMethods.has(method)) {
        writes.push(`${method} ${new URL(route.request().url()).pathname}`);
        await route.abort('blockedbyclient');
        return;
      }
      await route.continue();
    });

    await page.setViewportSize({ width: 1329, height: 1000 });
    await page.goto('/admin/podoba/artikli');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Artikli', exact: true })
    ).toBeVisible({ timeout: 15_000 });

    const preview = page.locator('[data-admin-product-live-preview="true"]');
    const rows = preview.locator(
      'dl.storefront-specification-grid .storefront-specification-row'
    );
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(3);
    const firstColumnCount = Math.ceil(rowCount / 2);

    const desktopPositions = await rows.evaluateAll((entries) => (
      entries.map((entry) => {
        const rect = entry.getBoundingClientRect();
        return {
          x: rect.x,
          y: rect.y,
          columnEnd: entry.getAttribute('data-specification-column-end')
        };
      })
    ));
    const leftColumn = desktopPositions.slice(0, firstColumnCount);
    const rightColumn = desktopPositions.slice(firstColumnCount);
    expect(rightColumn.length).toBeGreaterThan(0);
    for (const [index, position] of leftColumn.entries()) {
      expect(position.x).toBeCloseTo(leftColumn[0]!.x, 1);
      if (index > 0) expect(position.y).toBeGreaterThan(leftColumn[index - 1]!.y);
    }
    for (const [index, position] of rightColumn.entries()) {
      expect(position.x).toBeCloseTo(rightColumn[0]!.x, 1);
      if (index > 0) expect(position.y).toBeGreaterThan(rightColumn[index - 1]!.y);
    }
    expect(rightColumn[0]!.x).toBeGreaterThan(leftColumn[0]!.x);
    expect(rightColumn[0]!.y).toBeCloseTo(leftColumn[0]!.y, 1);
    expect(leftColumn.at(-1)?.columnEnd).toBe('true');
    expect(rightColumn.at(-1)?.columnEnd).toBe('true');

    await page.getByRole('button', { name: 'Mobilno', exact: true }).click();
    await expect(preview).toHaveAttribute('data-preview-device', 'mobile');
    const mobilePositions = await rows.evaluateAll((entries) => (
      entries.map((entry) => {
        const rect = entry.getBoundingClientRect();
        return { x: rect.x, y: rect.y };
      })
    ));
    for (const [index, position] of mobilePositions.entries()) {
      expect(position.x).toBeCloseTo(mobilePositions[0]!.x, 1);
      if (index > 0) expect(position.y).toBeGreaterThan(mobilePositions[index - 1]!.y);
    }
    await page.getByRole('button', { name: 'Desktop', exact: true }).click();
    await expect(preview).toHaveAttribute('data-preview-device', 'desktop');
    expect(writes).toEqual([]);
  });

  test('appearance and article editors share editable rows while discard and unsaved preview cause no write', async ({
    page,
    request
  }) => {
    await assertAuthenticatedAdmin(request);
    const writes: string[] = [];
    await page.route('**/api/admin/**', async (route) => {
      const method = route.request().method();
      if (writeMethods.has(method)) {
        writes.push(`${method} ${new URL(route.request().url()).pathname}`);
        await route.abort('blockedbyclient');
        return;
      }
      await route.continue();
    });

    await page.setViewportSize({ width: 1329, height: 1000 });
    await page.goto('/admin/podoba/artikli');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Artikli', exact: true })
    ).toBeVisible({ timeout: 15_000 });
    const product = await loadSelectedProduct(page, request);
    const { panel, preview } = await openSpecificationContentPanel(page);

    const appearanceLabelsBySurface = panel.locator(
      '[data-testid="specification-display-labels-editor"][data-specification-labels-surface="appearance-editor"]'
    );
    await expect(appearanceLabelsBySurface).toBeVisible();
    const materialLabelRow = appearanceLabelsBySurface.locator(
      '[data-testid="specification-display-label-row"][data-specification-key="material"]'
    );
    await expect(materialLabelRow).toBeVisible();
    const materialLabelInput = materialLabelRow.getByTestId(
      'specification-display-label-material'
    );
    const canonicalMaterialInput = materialLabelRow.getByTestId(
      'canonical-specification-material'
    );
    const originalMaterialLabel = await materialLabelInput.inputValue();
    const originalMaterialValue = product.material?.trim() ?? '';
    expect(originalMaterialValue).not.toBe('');
    await expect(canonicalMaterialInput).toHaveValue(originalMaterialValue);

    const previewRows = preview.locator('.storefront-specification-row');
    const materialPreviewIndexBefore = (
      await previewRows.locator('dt').allTextContents()
    ).findIndex((label) => label.trim() === originalMaterialLabel);
    expect(materialPreviewIndexBefore).toBeGreaterThanOrEqual(0);
    const orderRows = panel.getByTestId('product-specification-order-row');
    const materialOrderIndexBefore = (
      await orderRows.allTextContents()
    ).findIndex((text) => text.includes(originalMaterialLabel));
    expect(materialOrderIndexBefore).toBeGreaterThanOrEqual(0);

    const renamedMaterialLabel = `Sestava ${Date.now()}`;
    await materialLabelInput.fill(renamedMaterialLabel);
    await materialLabelInput.press('Enter');
    await expect(materialLabelInput).toHaveValue(renamedMaterialLabel);
    await expect(
      previewRows.nth(materialPreviewIndexBefore).locator('dt')
    ).toHaveText(renamedMaterialLabel);
    await expect(
      previewRows.nth(materialPreviewIndexBefore).locator('dd')
    ).toHaveText(originalMaterialValue);
    await expect(canonicalMaterialInput).toHaveValue(originalMaterialValue);
    await expect.poll(async () => (
      await orderRows.allTextContents()
    ).findIndex((text) => text.includes(renamedMaterialLabel))).toBe(
      materialOrderIndexBefore
    );
    await expect(page.getByText('Neshranjena vsebina', {
      exact: true
    })).toBeVisible();

    const colourLabelRow = appearanceLabelsBySurface.locator(
      '[data-testid="specification-display-label-row"][data-specification-key="barva"]'
    );
    await expect(colourLabelRow).toBeVisible();
    const conflictingLabel = await colourLabelRow.getByTestId(
      'specification-display-label-barva'
    ).inputValue();
    await materialLabelInput.fill(conflictingLabel);
    await expect(materialLabelInput).toHaveAttribute('aria-invalid', 'true');
    await expect(
      previewRows.nth(materialPreviewIndexBefore).locator('dt')
    ).toHaveText(renamedMaterialLabel);
    await expect(
      previewRows.nth(materialPreviewIndexBefore).locator('dd')
    ).toHaveText(originalMaterialValue);
    await expect(canonicalMaterialInput).toHaveValue(originalMaterialValue);
    await expect.poll(async () => (
      await orderRows.allTextContents()
    ).findIndex((text) => text.includes(renamedMaterialLabel))).toBe(
      materialOrderIndexBefore
    );
    await materialLabelInput.press('Tab');
    await expect(materialLabelInput).toHaveValue(renamedMaterialLabel);
    await expect(materialLabelInput).not.toHaveAttribute('aria-invalid', 'true');

    const appearanceEditorBySurface = panel.locator(
      '[data-testid="variant-specifications-editor"][data-variant-specifications-surface="appearance-editor"]'
    );
    await expect(appearanceEditorBySurface).toBeVisible();

    const toleranceValue = `±${90 + Math.floor(Math.random() * 9)} mm`;
    await panel.getByTestId('canonical-specification-tolerance').fill(
      toleranceValue
    );
    await expect(
      previewRows.filter({ hasText: 'Toleranca' })
    ).toContainText(toleranceValue);
    await expect(page.getByText('Neshranjena vsebina', { exact: true }))
      .toBeVisible();

    const originalRowCount = await appearanceEditorBySurface
      .getByTestId('variant-specification-row')
      .count();
    await appearanceEditorBySurface.getByRole('button', {
      name: 'Dodaj specifikacijo',
      exact: true
    }).click();
    const addedRowNumber = originalRowCount + 1;
    const specificationLabel = `Testna lastnost ${Date.now()}`;
    const specificationValue = 'Preizkusna vrednost';
    await appearanceEditorBySurface
      .getByLabel(`Naziv specifikacije ${addedRowNumber}`, { exact: true })
      .fill(specificationLabel);
    await appearanceEditorBySurface
      .getByLabel(`Vrednost specifikacije ${addedRowNumber}`, { exact: true })
      .fill(specificationValue);

    await expect(previewRows.filter({ hasText: specificationLabel })).toContainText(
      specificationValue
    );

    await expect(orderRows.filter({ hasText: specificationLabel })).toHaveCount(1);
    const orderBefore = await orderRows.allTextContents();
    const indexBefore = orderBefore.findIndex((text) => (
      text.includes(specificationLabel)
    ));
    expect(indexBefore).toBeGreaterThan(0);
    await orderRows
      .filter({ hasText: specificationLabel })
      .getByRole('button', {
        name: `Premakni ${specificationLabel} gor`,
        exact: true
      })
      .click();
    await expect.poll(async () => {
      const texts = await orderRows.allTextContents();
      return texts.findIndex((text) => text.includes(specificationLabel));
    }).toBe(indexBefore - 1);
    const customIndexAfterMove = indexBefore - 1;
    const customPreviewIndexAfterMove = (
      await previewRows.locator('dt').allTextContents()
    ).findIndex((label) => label.trim() === specificationLabel);
    expect(customPreviewIndexAfterMove).toBeGreaterThanOrEqual(0);
    const renamedCustomLabel = `Preimenovana lastnost ${Date.now()}`;
    const renamedCustomLabelInput = appearanceEditorBySurface.getByLabel(
      `Naziv specifikacije ${addedRowNumber}`,
      { exact: true }
    );
    await renamedCustomLabelInput.fill(renamedCustomLabel);
    await renamedCustomLabelInput.press('Tab');
    await expect(
      previewRows.nth(customPreviewIndexAfterMove).locator('dt')
    ).toHaveText(renamedCustomLabel);
    await expect(
      previewRows.nth(customPreviewIndexAfterMove).locator('dd')
    ).toHaveText(specificationValue);
    await expect.poll(async () => {
      const texts = await orderRows.allTextContents();
      return texts.findIndex((text) => text.includes(renamedCustomLabel));
    }).toBe(customIndexAfterMove);
    await expect(orderRows.filter({ hasText: specificationLabel })).toHaveCount(0);
    await expect(page.getByText('Neshranjena videz in vsebina', {
      exact: true
    })).toBeVisible();
    expect(writes, 'editing and reordering should remain local until Save')
      .toEqual([]);

    const unchangedResponse = await request.get(
      `/api/admin/artikli/${encodeURIComponent(product.slug)}`
    );
    expect(unchangedResponse.ok()).toBeTruthy();
    const unchangedProduct = await unchangedResponse.json() as CatalogItemEditorHydration;
    expect(unchangedProduct.material).toBe(product.material);
    expect(unchangedProduct.appearanceOverride).toEqual(product.appearanceOverride);

    await panel.getByRole('button', { name: 'Zapri', exact: true }).click();
    await page.goto(`/admin/artikli/${encodeURIComponent(product.slug)}`);
    await page.getByRole('tab', { name: 'Prodaja', exact: true }).click();
    const articleSection = page.getByTestId(
      'article-variant-specifications-section'
    );
    await expect(articleSection).toBeVisible({ timeout: 15_000 });
    await expect(articleSection).not.toContainText(renamedCustomLabel);

    const articleLabelsBySurface = articleSection.locator(
      '[data-testid="specification-display-labels-editor"][data-specification-labels-surface="article-editor"]'
    );
    await expect(articleLabelsBySurface).toBeVisible();
    const articleMaterialRow = articleLabelsBySurface.locator(
      '[data-testid="specification-display-label-row"][data-specification-key="material"]'
    );
    const articleMaterialLabelInput = articleMaterialRow.getByTestId(
      'specification-display-label-material'
    );
    const articleCanonicalMaterialInput = articleMaterialRow.getByTestId(
      'article-canonical-specification-material'
    );
    await expect(articleMaterialLabelInput).toHaveValue(originalMaterialLabel);
    await expect(articleCanonicalMaterialInput).toHaveValue(originalMaterialValue);

    await page.getByRole('button', {
      name: 'Uredi artikel',
      exact: true
    }).first().click();
    await articleMaterialLabelInput.fill(renamedMaterialLabel);
    await articleMaterialLabelInput.press('Enter');
    await expect(articleMaterialLabelInput).toHaveValue(renamedMaterialLabel);
    await expect(articleCanonicalMaterialInput).toHaveValue(originalMaterialValue);
    await expect(page.getByRole('button', {
      name: 'Shrani',
      exact: true
    }).first()).toBeEnabled();

    const articleEditor = articleSection.locator(
      '[data-testid="variant-specifications-editor"][data-variant-specifications-surface="article-editor"]'
    );
    await expect(articleEditor).toBeVisible();
    const articleOriginalRowCount = await articleEditor
      .getByTestId('variant-specification-row')
      .count();
    await articleEditor.getByRole('button', {
      name: 'Dodaj specifikacijo',
      exact: true
    }).click();
    const articleAddedRow = articleOriginalRowCount + 1;
    const articleLabel = `Začasna lastnost ${Date.now()}`;
    const articleLabelInput = articleEditor.getByLabel(
      `Naziv specifikacije ${articleAddedRow}`,
      { exact: true }
    );
    const articleValueInput = articleEditor.getByLabel(
      `Vrednost specifikacije ${articleAddedRow}`,
      { exact: true }
    );
    await expect(articleLabelInput).toHaveValue('Nova lastnost');
    await articleLabelInput.fill(articleLabel);
    await expect(articleLabelInput).toHaveValue(articleLabel);
    await articleValueInput.fill('Začasna vrednost');
    await expect(articleLabelInput).toHaveValue(articleLabel);
    await expect(articleValueInput).toHaveValue('Začasna vrednost');
    await expect(page.getByRole('button', {
      name: 'Shrani',
      exact: true
    }).first()).toBeEnabled();

    await page.getByRole('button', {
      name: 'Uredi artikel',
      exact: true
    }).first().click();
    const discardDialog = page.getByRole('dialog').filter({
      hasText: 'Neshranjene spremembe'
    });
    await expect(discardDialog).toBeVisible();
    await discardDialog.getByRole('button', {
      name: 'Zavrzi spremembe',
      exact: true
    }).click();
    await expect(discardDialog).toBeHidden();
    await expect(
      articleEditor.getByTestId('variant-specification-row')
    ).toHaveCount(articleOriginalRowCount);
    await expect(articleEditor.getByLabel(
      `Naziv specifikacije ${articleAddedRow}`,
      { exact: true }
    )).toHaveCount(0);
    await expect(articleMaterialLabelInput).toHaveValue(originalMaterialLabel);
    await expect(articleCanonicalMaterialInput).toHaveValue(originalMaterialValue);

    const afterDiscardResponse = await request.get(
      `/api/admin/artikli/${encodeURIComponent(product.slug)}`
    );
    expect(afterDiscardResponse.ok()).toBeTruthy();
    const afterDiscard = await afterDiscardResponse.json() as CatalogItemEditorHydration;
    expect(afterDiscard.material).toBe(product.material);
    expect(afterDiscard.appearanceOverride).toEqual(product.appearanceOverride);
    expect(writes, 'discarding in the article editor must not call an API')
      .toEqual([]);
  });

  test('stale specification edits are rejected without changing the shared article hydration', async ({
    page,
    request
  }) => {
    await assertAuthenticatedAdmin(request);
    await page.goto('/admin/podoba/artikli');
    const before = await loadSelectedProduct(page, request);
    const variant = before.variants.find((entry) => typeof entry.id === 'number');
    expect(variant?.id).toBeDefined();

    const staleResponse = await request.patch(
      `/api/admin/product-appearance/products/${encodeURIComponent(before.slug)}`,
      {
        data: {
          expectedUpdatedAt: '1970-01-01T00:00:00.000Z',
          specificationLabels: {},
          variantSpecifications: [{
            variantId: variant!.id,
            specifications: {
              ...(variant!.contentOverride?.specifications ?? {}),
              'Ne sme se shraniti': 'Zastarela sprememba'
            }
          }]
        }
      }
    );
    expect(staleResponse.status()).toBe(409);

    const afterResponse = await request.get(
      `/api/admin/artikli/${encodeURIComponent(before.slug)}`
    );
    expect(afterResponse.ok()).toBeTruthy();
    const after = await afterResponse.json() as CatalogItemEditorHydration;
    expect(after.updatedAt).toBe(before.updatedAt);
    expect(after.variants).toEqual(before.variants);
  });
});
