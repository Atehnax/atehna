import {
  expect,
  test,
  type APIRequestContext,
  type Page
} from '@playwright/test';
import nextEnv from '@next/env';
import { computeCatalogItemAuditDiff } from '@/shared/audit/auditDiff';
import type {
  CatalogItemEditorHydration,
  CatalogItemEditorVariantPayload
} from '@/shared/domain/catalog/catalogAdminTypes';
import {
  applyVariantPresentationPatch,
  validateAndNormalizeVariantPresentationPatches
} from '@/shared/domain/catalog/catalogVariantPresentationPatch';
import {
  migrateCatalogSpecificationKey,
  readCatalogSpecificationLabels,
  validateAndNormalizeCatalogAppearanceOverride,
  validateAndNormalizeCatalogSpecificationLabels,
  writeCatalogSpecificationLabels
} from '@/shared/domain/catalog/catalogSpecification';
import type { CatalogItem } from '@/shared/domain/catalog/catalogTypes';
import {
  buildStorefrontProductFromCatalogItem
} from '@/commercial/features/products/storefrontProduct';
import {
  getStorefrontSpecificationOrderKey,
  prepareStorefrontSpecifications
} from '@/commercial/features/products/storefrontSpecifications';

const { loadEnvConfig } = nextEnv;
const writeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const contractVariants: CatalogItemEditorVariantPayload[] = [
  {
    id: 11,
    variantName: 'Prva različica',
    variantSku: 'VAR-11',
    price: 12,
    length: 100,
    width: 80,
    thickness: 2,
    weight: 320,
    contentOverride: {
      description: 'Opis različice',
      specifications: { Material: 'Aluminij' },
      attributes: { Barva: 'Srebrna' },
      includedItems: ['Navodila'],
      deliveryEstimate: '2 dni',
      documentIds: [7]
    }
  },
  {
    id: 12,
    variantName: 'Druga različica',
    variantSku: 'VAR-12',
    price: 14
  }
];

async function ensurePageAdminSession(
  page: Page,
  request: APIRequestContext
) {
  const probe = await request.get('/api/admin/product-appearance');
  if (probe.status() === 401) {
    loadEnvConfig(process.cwd(), true);
    const username = process.env.ADMIN_USERNAME?.trim() || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'admin';
    const login = await request.post('/api/admin/login', {
      data: { username, password }
    });
    if (!login.ok()) {
      throw new Error(`Admin test login failed with status ${login.status()}.`);
    }
  } else {
    expect(probe.ok()).toBeTruthy();
  }
  await page.context().addCookies((await request.storageState()).cookies);
}

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
  test('uses the article-compatible weight unit in storefront specifications', () => {
    const build = (productType: 'dimensions' | 'weight') => (
      buildStorefrontProductFromCatalogItem({
        id: productType === 'dimensions' ? 81 : 82,
        slug: `test-${productType}`,
        name: `Test ${productType}`,
        productType,
        status: 'active',
        defaultVariantId: productType === 'dimensions' ? 811 : 821,
        variants: [{
          id: productType === 'dimensions' ? 811 : 821,
          variantName: 'Privzeta',
          variantSku: `TEST-${productType}`,
          weight: 320,
          price: 10,
          inventory: 1,
          status: 'active'
        }]
      } as unknown as CatalogItem, {
        href: `/products/test-${productType}`,
        fallbackSku: 'TEST',
        fallbackPrice: 0,
        category: {
          slug: 'test',
          title: 'Test',
          href: '/products/test'
        }
      })
    );

    expect(build('dimensions').variants[0]?.attributes.Teža).toBe('320 g');
    expect(build('weight').variants[0]?.attributes.Teža).toBe('320 kg');
  });

  test('validates specification identity and variant ownership before persistence', () => {
    const normalizedDuplicate = validateAndNormalizeVariantPresentationPatches(
      [{
        variantId: 11,
        specifications: {
          'Površina': 'Brušena',
          'povrsina!': 'Polirana'
        }
      }],
      { variants: contractVariants }
    );
    expect(normalizedDuplicate).toEqual({
      ok: false,
      message: 'Nazivi specifikacij morajo biti enolični.'
    });

    const duplicateVariant = validateAndNormalizeVariantPresentationPatches(
      [
        { variantId: 11, specifications: { Material: 'Aluminij' } },
        { variantId: 11, specifications: { Barva: 'Srebrna' } }
      ],
      { variants: contractVariants }
    );
    expect(duplicateVariant).toEqual({
      ok: false,
      message: 'Ista različica je bila poslana večkrat.'
    });

    const foreignVariant = validateAndNormalizeVariantPresentationPatches(
      [{ variantId: 999, specifications: { Material: 'Aluminij' } }],
      { variants: contractVariants }
    );
    expect(foreignVariant).toEqual({
      ok: false,
      message: 'Izbrana različica ne pripada temu artiklu.'
    });
  });

  test('normalizes ordered rows and applies them without losing article-editor fields', () => {
    const validation = validateAndNormalizeVariantPresentationPatches(
      [{
        variantId: 11,
        specifications: {
          '  Obdelava  ': '  Brušena  ',
          Trdota: '  95 HB '
        },
        thickness: 2.5,
        errorTolerance: '  ±0,2 mm  ',
        variantSku: '  VAR-11-NOV  '
      }],
      { variants: contractVariants }
    );
    expect(validation.ok).toBe(true);
    if (!validation.ok || !validation.value) return;

    const patch = validation.value[0];
    expect(Object.entries(patch.specifications)).toEqual([
      ['Obdelava', 'Brušena'],
      ['Trdota', '95 HB']
    ]);
    const applied = applyVariantPresentationPatch(contractVariants[0], patch);
    expect(applied).toMatchObject({
      id: 11,
      variantName: 'Prva različica',
      variantSku: 'VAR-11-NOV',
      price: 12,
      length: 100,
      width: 80,
      thickness: 2.5,
      weight: 320,
      errorTolerance: '±0,2 mm',
      contentOverride: {
        description: 'Opis različice',
        specifications: {
          Obdelava: 'Brušena',
          Trdota: '95 HB'
        },
        attributes: { Barva: 'Srebrna' },
        includedItems: ['Navodila'],
        deliveryEstimate: '2 dni',
        documentIds: [7]
      }
    });
    expect(contractVariants[0].contentOverride?.specifications).toEqual({
      Material: 'Aluminij'
    });

    const cleared = applyVariantPresentationPatch(applied, {
      variantId: 11,
      specifications: {}
    });
    expect(cleared.contentOverride).toEqual({
      description: 'Opis različice',
      attributes: { Barva: 'Srebrna' },
      includedItems: ['Navodila'],
      deliveryEstimate: '2 dni',
      documentIds: [7]
    });
  });

  test('renames only specification presentation while preserving values and stable order keys', () => {
    const sourceSpecifications = [
      {
        id: 'material',
        label: 'Material',
        value: 'Aluminij',
        orderKey: 'material'
      },
      {
        id: 'color',
        label: 'Barva',
        value: 'Srebrna',
        orderKey: 'barva'
      },
      {
        id: 'finish',
        label: 'Obdelava',
        value: 'Brušena',
        orderKey: 'obdelava'
      }
    ];
    const specificationOrder = ['barva', 'material', 'obdelava'];
    const before = prepareStorefrontSpecifications(
      sourceSpecifications,
      specificationOrder
    );
    const renamed = prepareStorefrontSpecifications(
      sourceSpecifications,
      specificationOrder,
      { material: 'Sestava' }
    );

    expect(renamed.map(getStorefrontSpecificationOrderKey)).toEqual(
      before.map(getStorefrontSpecificationOrderKey)
    );
    expect(renamed.map((entry) => entry.value)).toEqual(
      before.map((entry) => entry.value)
    );
    expect(renamed.map((entry) => entry.label)).toEqual([
      'Barva',
      'Sestava',
      'Obdelava'
    ]);

    const appearanceOverride = {
      relatedProducts: { enabled: false },
      secondaryContent: {
        specificationOrder,
        tabs: ['description', 'specifications']
      }
    };
    const written = writeCatalogSpecificationLabels(
      appearanceOverride,
      { material: '  Sestava  ' }
    );
    expect(readCatalogSpecificationLabels(written)).toEqual({
      material: 'Sestava'
    });
    expect(written).toMatchObject(appearanceOverride);

    const cleared = writeCatalogSpecificationLabels(written, {});
    expect(readCatalogSpecificationLabels(cleared)).toEqual({});
    expect(cleared).toEqual(appearanceOverride);

    const migrated = migrateCatalogSpecificationKey(
      specificationOrder,
      { obdelava: 'Končna obdelava' },
      'Obdelava',
      'Površinska obdelava'
    );
    expect(migrated).toEqual({
      specificationOrder: ['barva', 'material', 'povrsinska-obdelava'],
      specificationLabels: {
        'povrsinska-obdelava': 'Končna obdelava'
      }
    });

    expect(validateAndNormalizeCatalogSpecificationLabels({
      Material: '  Sestava  ',
      Barva: 'Odtenek'
    })).toEqual({
      ok: true,
      value: { material: 'Sestava', barva: 'Odtenek' }
    });
    expect(validateAndNormalizeCatalogSpecificationLabels({
      Material: 'Sestava',
      Barva: 'séstava!'
    })).toEqual({
      ok: false,
      message: 'Prikazni nazivi specifikacij morajo biti enolični.'
    });
    expect(validateAndNormalizeCatalogSpecificationLabels({
      Material: 'Barva'
    })).toEqual({
      ok: false,
      message: 'Prikazni nazivi specifikacij morajo biti enolični.'
    });

    expect(validateAndNormalizeCatalogAppearanceOverride({
      relatedProducts: { enabled: false },
      secondaryContent: {
        specificationOrder,
        specificationLabels: { Material: '  Sestava  ' }
      }
    })).toEqual({
      ok: true,
      value: {
        relatedProducts: { enabled: false },
        secondaryContent: {
          specificationOrder,
          specificationLabels: { material: 'Sestava' }
        }
      }
    });
    expect(validateAndNormalizeCatalogAppearanceOverride({
      secondaryContent: {
        specificationOrder,
        specificationLabels: { Material: 'Barva' }
      }
    })).toEqual({
      ok: false,
      message: 'Prikazni nazivi specifikacij morajo biti enolični.'
    });
  });

  test('a specification-only variant change is represented in the item audit diff', () => {
    const before = {
      variants: [{
        id: 17,
        variantSku: 'SPEC-17',
        variantName: 'Privzeta različica',
        contentOverride: {
          description: 'Opis ostane nespremenjen.',
          specifications: {
            Material: 'Aluminij',
            Površina: 'Brušena'
          },
          includedItems: ['Navodila']
        }
      }]
    };
    const after = structuredClone(before);
    after.variants[0].contentOverride.specifications.Površina = 'Polirana';

    const diff = computeCatalogItemAuditDiff(before, after);

    expect(diff).toHaveProperty('variants');
    expect(diff.variants).toMatchObject({
      updated: [{
        id: 'SPEC-17',
        changes: {
          specifications: expect.objectContaining({
            label: 'Specifikacije',
            before: expect.any(String),
            after: expect.any(String)
          })
        }
      }]
    });
  });

  test('fills desktop specification columns vertically while preserving mobile reading order', async ({
    page,
    request
  }) => {
    await ensurePageAdminSession(page, request);
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
    await ensurePageAdminSession(page, request);
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
    await ensurePageAdminSession(page, request);
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
