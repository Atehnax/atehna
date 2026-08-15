import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  applyVariantValueToAll,
  createVariant,
  type Variant,
  type VariantBulkApplyField
} from '@/admin/features/artikli/lib/familyModel';

const createFixtureVariants = (): Variant[] => [
  createVariant({
    id: 'source',
    label: '0,5 × 100 × 100 mm',
    width: 100,
    length: 100,
    thickness: 0.5,
    errorTolerance: '0,2',
    weight: 24,
    minOrder: 5,
    sku: 'SOURCE',
    price: 12.5,
    costNet: 8.25,
    discountPct: 7.5,
    stock: 40,
    active: true,
    sort: 1,
    contentOverride: {
      description: 'Source description',
      deliveryEstimate: '3–5 delovnih dni'
    }
  }),
  createVariant({
    id: 'active-target',
    label: '0,5 × 200 × 100 mm',
    width: 100,
    length: 200,
    thickness: 0.5,
    errorTolerance: '0,1',
    weight: 48,
    minOrder: 1,
    sku: 'TARGET-A',
    price: 20,
    costNet: 13,
    discountPct: 0,
    stock: 2,
    active: false,
    sort: 2,
    contentOverride: {
      specifications: { Material: 'Aluminij' },
      deliveryEstimate: '1–2 delovna dneva'
    }
  }),
  createVariant({
    id: 'inactive-target',
    label: '0,5 × 300 × 100 mm',
    width: 100,
    length: 300,
    thickness: 0.5,
    errorTolerance: null,
    weight: null,
    minOrder: 2,
    sku: 'TARGET-B',
    price: 30,
    costNet: null,
    discountPct: 3,
    stock: 0,
    active: false,
    sort: 3,
    contentOverride: {
      attributes: { Barva: 'Srebrna' }
    }
  })
];

const readField = (variant: Variant, field: VariantBulkApplyField) => {
  if (field === 'deliveryEstimate') {
    return variant.contentOverride?.deliveryEstimate ?? null;
  }
  return variant[field];
};

test('safe variant values are applied to every other variant, including inactive variants', () => {
  const fields: VariantBulkApplyField[] = [
    'weight',
    'errorTolerance',
    'costNet',
    'price',
    'discountPct',
    'stock',
    'minOrder',
    'active'
  ];

  for (const field of fields) {
    const variants = createFixtureVariants();
    const before = structuredClone(variants);
    const result = applyVariantValueToAll(variants, 'source', field);

    expect(result.changedVariantIds).toEqual(['active-target', 'inactive-target']);
    expect(readField(result.variants[1], field)).toEqual(
      readField(result.variants[0], field)
    );
    expect(readField(result.variants[2], field)).toEqual(
      readField(result.variants[0], field)
    );
    expect(result.variants.map(({ id, sku, width, length, thickness }) => ({
      id,
      sku,
      width,
      length,
      thickness
    }))).toEqual(before.map(({ id, sku, width, length, thickness }) => ({
      id,
      sku,
      width,
      length,
      thickness
    })));
    expect(variants).toEqual(before);
  }
});

test('delivery applies or clears only the delivery override and preserves other content', () => {
  const variants = createFixtureVariants();
  const before = structuredClone(variants);
  const explicitResult = applyVariantValueToAll(
    variants,
    'source',
    'deliveryEstimate'
  );

  expect(explicitResult.changedVariantIds).toEqual([
    'active-target',
    'inactive-target'
  ]);
  expect(explicitResult.variants[1].contentOverride).toEqual({
    specifications: { Material: 'Aluminij' },
    deliveryEstimate: '3–5 delovnih dni'
  });
  expect(explicitResult.variants[2].contentOverride).toEqual({
    attributes: { Barva: 'Srebrna' },
    deliveryEstimate: '3–5 delovnih dni'
  });
  expect(variants).toEqual(before);

  const inheritedSource = createFixtureVariants().map((variant) =>
    variant.id === 'source'
      ? { ...variant, contentOverride: { description: 'Source description' } }
      : variant
  );
  const inheritedResult = applyVariantValueToAll(
    inheritedSource,
    'source',
    'deliveryEstimate'
  );

  expect(inheritedResult.variants[1].contentOverride).toEqual({
    specifications: { Material: 'Aluminij' }
  });
  expect(inheritedResult.variants[2].contentOverride).toEqual({
    attributes: { Barva: 'Srebrna' }
  });
});

test('missing sources, single variants, and identical targets are no-ops', () => {
  const variants = createFixtureVariants();
  const missing = applyVariantValueToAll(variants, 'missing', 'price');
  const single = applyVariantValueToAll([variants[0]], 'source', 'price');
  const identical = applyVariantValueToAll(
    variants.map((variant) => ({ ...variant, price: variants[0].price })),
    'source',
    'price'
  );

  expect(missing.variants).toBe(variants);
  expect(missing.changedVariantIds).toEqual([]);
  expect(single.changedVariantIds).toEqual([]);
  expect(identical.changedVariantIds).toEqual([]);
});

test('the rows matrix exposes an accessible apply-to-all action only through its row policy', () => {
  const editorSource = readFileSync(
    resolve(
      process.cwd(),
      'src/admin/features/artikli/components/AdminItemEditorPage.tsx'
    ),
    'utf8'
  );

  expect(editorSource).toContain(
    'const DIMENSION_VARIANT_BULK_APPLY_ROW_KEYS = new Set<DimensionVariantMatrixRowKey>(['
  );
  const bulkRowPolicy = editorSource.match(
    /const DIMENSION_VARIANT_BULK_APPLY_ROW_KEYS = new Set<DimensionVariantMatrixRowKey>\(\[([\s\S]*?)\]\);/
  )?.[1];
  expect(bulkRowPolicy).toBeDefined();
  for (const rowKey of [
    'weight',
    'tolerance',
    'cost',
    'price',
    'discount',
    'stock',
    'minOrder',
    'delivery',
    'status',
    'note'
  ]) {
    expect(bulkRowPolicy).toContain(`'${rowKey}'`);
  }
  expect(editorSource).toContain(
    'const bulkApplyRowKey = isDimensionVariantBulkApplyRow(row.key)'
  );
  expect(editorSource).toContain(
    '`Uporabi ${row.label} iz ${bulkApplySourceName} za vse različice`'
  );
  expect(editorSource).toContain(
    'onClick={() => applyDimensionVariantRowValueToAll(bulkApplyRowKey)}'
  );
  expect(editorSource).toContain('<ApplyToAllIcon className="!h-3.5 !w-3.5" />');
  expect(editorSource).toContain(
    "Statusa »Neaktiven« ni mogoče uporabiti za vse"
  );
  expect(editorSource).toContain(
    '? getDimensionVariantDeliveryTime(typeSpecificData.dimensions, sourceVariant)'
  );
  expect(editorSource).toContain(
    '...stockTagVariantIds.filter((variantId) => variantId !== resolvedSourceVariant.id)'
  );
});

test('the first expanded variant uses a full-height vertical left edge', () => {
  const editorSource = readFileSync(
    resolve(
      process.cwd(),
      'src/admin/features/artikli/components/AdminItemEditorPage.tsx'
    ),
    'utf8'
  );
  const weightEditorSource = readFileSync(
    resolve(
      process.cwd(),
      'src/admin/features/artikli/components/pricing/DimensionProductPricingSectionsImpl.tsx'
    ),
    'utf8'
  );

  for (const source of [editorSource, weightEditorSource]) {
    expect(source).toContain(
      'const expandedVariantHasLeftSlant = variantIndex > 0;'
    );
    expect(source).toContain(
      '{expandedVariantHasLeftSlant ? ('
    );
    expect(source).toContain(
      "width: expandedVariantHasLeftSlant"
    );
    expect(source).toContain(
      ": '100%',"
    );
  }
  expect(editorSource).toContain(
    '? dimensionVariantNormalBandHeight'
  );
  expect(weightEditorSource).toContain(
    '? weightVariantNormalBandHeight'
  );
});

test('collapsed rows-matrix body cells expand dimension and weight variants without hijacking controls', () => {
  const editorSource = readFileSync(
    resolve(
      process.cwd(),
      'src/admin/features/artikli/components/AdminItemEditorPage.tsx'
    ),
    'utf8'
  );
  const weightEditorSource = readFileSync(
    resolve(
      process.cwd(),
      'src/admin/features/artikli/components/pricing/DimensionProductPricingSectionsImpl.tsx'
    ),
    'utf8'
  );

  expect(editorSource).toContain(
    'const activateCollapsedDimensionVariant = ('
  );
  expect(editorSource).toContain(
    '\'button, input, select, textarea, a, label, [role="button"], [role="checkbox"], [role="radio"], [contenteditable="true"]\''
  );
  expect(editorSource).toContain(
    'onClick={(event) => activateCollapsedDimensionVariant(event, variant.id)}'
  );
  expect(editorSource).toContain(
    'className={`admin-variant-matrix-cell-transition flex min-w-0 cursor-pointer items-center justify-center'
  );
  expect(editorSource).toContain(
    'onClick={(event) => event.stopPropagation()}'
  );
  expect(
    editorSource.match(/activateCollapsedDimensionVariant\(event, variant\.id\)/g)
  ).toHaveLength(1);
  expect(editorSource).toContain('disabled:pointer-events-none');

  expect(weightEditorSource).toContain(
    'const activateCollapsedWeightVariant = ('
  );
  expect(weightEditorSource).toContain(
    'onClick={(event) => activateCollapsedWeightVariant(event, variant.id)}'
  );
  expect(weightEditorSource).toContain(
    'className={`admin-variant-matrix-cell-transition flex min-w-0 cursor-pointer items-center justify-center'
  );
  expect(weightEditorSource).toContain(
    'onClick={(event) => event.stopPropagation()}'
  );
  expect(
    weightEditorSource.match(/activateCollapsedWeightVariant\(event, variant\.id\)/g)
  ).toHaveLength(1);
  expect(weightEditorSource).toContain('disabled:pointer-events-none');
});

test('dimension and weight matrices use interpolation-compatible synchronized motion', () => {
  const editorSource = readFileSync(
    resolve(
      process.cwd(),
      'src/admin/features/artikli/components/AdminItemEditorPage.tsx'
    ),
    'utf8'
  );
  const weightEditorSource = readFileSync(
    resolve(
      process.cwd(),
      'src/admin/features/artikli/components/pricing/DimensionProductPricingSectionsImpl.tsx'
    ),
    'utf8'
  );
  const globalStyles = readFileSync(
    resolve(process.cwd(), 'src/shared/styles/globals.css'),
    'utf8'
  );

  expect(editorSource).toContain(
    'const dimensionVariantLayoutCompactCount = Math.max(0, draft.variants.length - 1);'
  );
  expect(weightEditorSource).toContain(
    'const weightVariantLayoutCompactCount = Math.max(0, weightData.variants.length - 1);'
  );
  expect(editorSource).toContain(
    'return `minmax(${minimumWidth}px, ${flexibleWidth}fr)`;'
  );
  expect(weightEditorSource).toContain(
    'return `minmax(${minimumWidth}px, ${flexibleWidth}fr)`;'
  );
  expect(
    editorSource.match(/admin-variant-matrix-track-transition/g)
  ).toHaveLength(1);
  expect(
    weightEditorSource.match(/admin-variant-matrix-track-transition/g)
  ).toHaveLength(1);
  expect(
    editorSource.match(/admin-variant-matrix-row/g)
  ).toHaveLength(2);
  expect(
    weightEditorSource.match(/admin-variant-matrix-row/g)
  ).toHaveLength(2);
  expect(editorSource).toContain(
    'gridTemplateColumns: dimensionMatrixGridTemplateColumns'
  );
  expect(weightEditorSource).toContain(
    'gridTemplateColumns: weightMatrixGridTemplateColumns'
  );
  expect(globalStyles).toContain('grid-template-columns: subgrid;');
  expect(globalStyles).toContain(
    'transition-property: grid-template-columns, min-width;'
  );
  expect(globalStyles).toContain('transition-duration: 220ms;');
  expect(globalStyles).toContain('transition-timing-function: linear;');
  expect(globalStyles).toContain(
    'animation: admin-dimension-variant-content-enter 220ms linear both;'
  );
  expect(globalStyles).not.toContain('transform: translateX(4px);');
  expect(globalStyles).not.toContain('transform: scaleX(0.96);');
  expect(globalStyles).toContain(
    '.admin-variant-matrix-track-transition,\n  .admin-variant-matrix-cell-transition {\n    transition: none;'
  );
});

test('slanted matrix borders retain the same apparent one-pixel weight as straight borders', () => {
  const editorSource = readFileSync(
    resolve(
      process.cwd(),
      'src/admin/features/artikli/components/AdminItemEditorPage.tsx'
    ),
    'utf8'
  );
  const weightEditorSource = readFileSync(
    resolve(
      process.cwd(),
      'src/admin/features/artikli/components/pricing/DimensionProductPricingSectionsImpl.tsx'
    ),
    'utf8'
  );
  const globalStyles = readFileSync(
    resolve(process.cwd(), 'src/shared/styles/globals.css'),
    'utf8'
  );

  expect(
    editorSource.match(/admin-variant-matrix-diagonal-border/g)
  ).toHaveLength(4);
  expect(
    weightEditorSource.match(/admin-variant-matrix-diagonal-border/g)
  ).toHaveLength(4);
  expect(editorSource).not.toContain('w-px origin-bottom');
  expect(weightEditorSource).not.toContain('w-px origin-bottom');
  expect(globalStyles).toContain(
    '.admin-variant-matrix-diagonal-border {\n  width: 1.4142135624px;'
  );
});
