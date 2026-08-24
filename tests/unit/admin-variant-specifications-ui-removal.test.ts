import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

const readSource = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8').replace(/\r\n?/g, '\n');

const editorSource = readSource(
  'src/admin/features/artikli/components/AdminItemEditorPage.tsx'
);
const weightEditorSource = readSource(
  'src/admin/features/artikli/components/pricing/DimensionProductPricingSectionsImpl.tsx'
);
const storefrontMapperSource = readSource(
  'src/commercial/features/products/storefrontProduct.ts'
);
const storefrontDetailSource = readSource(
  'src/commercial/components/storefront/ProductDetailView.tsx'
);
const orderCommerceSource = readSource('src/shared/server/orderCommerce.ts');
const orderRouteSource = readSource('src/commercial/api/orders/route.ts');
const orderConfirmationRouteSource = readSource(
  'src/commercial/api/orders/confirmation/route.ts'
);
const orderContractsSource = readSource('src/commercial/order/contracts.ts');

function sourceBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex, `Missing source marker: ${start}`).toBeGreaterThanOrEqual(0);
  expect(endIndex, `Missing source marker: ${end}`).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

test('article editor no longer renders or maintains the duplicate variant-specifications UI', () => {
  const removedMarkers = [
    'article-variant-specifications-section',
    'Specifikacije razli\u010dice',
    'Razli\u010dica za dodatne specifikacije',
    'Sistemske specifikacije',
    'Dodatne specifikacije',
    'VariantSpecificationsEditor',
    'SpecificationDisplayLabelsEditor',
    'specificationVariantId',
    'specificationVariant',
    'protectedCatalogSpecificationLabels',
    'articleParentSpecifications',
    'articleVariantSpecifications',
    'articleMergedSpecifications',
    'articleSystemSpecificationRows',
    'updateSpecificationVariant',
    'updateArticleSpecificationLabels',
    'renderArticleSpecificationValueEditor'
  ];

  for (const marker of removedMarkers) {
    expect(
      editorSource.includes(marker), `Duplicate specification marker remains: ${marker}`
    ).toBe(false);
  }

  // This reader still belongs to save-diff reporting, not the removed controls.
  expect(editorSource).toContain('readCatalogSpecificationLabels');
});

test('dimension and weight variant matrices remain the canonical editing surfaces', () => {
  const dimensionRows = sourceBetween(
    editorSource,
    'const DIMENSION_VARIANT_MATRIX_ROWS:',
    'type DimensionVariantBulkApplyRowKey ='
  );
  for (const rowKey of [
    'thickness',
    'length',
    'width',
    'weight',
    'tolerance',
    'price',
    'stock',
    'delivery',
    'sku',
    'status'
  ]) {
    expect(dimensionRows).toContain(`key: '${rowKey}'`);
  }
  expect(editorSource).toContain('renderExpandedDimensionVariantCell');
  expect(editorSource).toContain('{DIMENSION_VARIANT_MATRIX_ROWS.map((row, rowIndex) => {');
  expect(editorSource).toContain(
    'aria-label="Razli\u010dice artikla s polji v vrsticah"'
  );

  const weightRows = sourceBetween(
    weightEditorSource,
    'const WEIGHT_VARIANT_MATRIX_ROWS:',
    'type WeightSortableKeyboardMetadata ='
  );
  for (const rowKey of [
    'netMass',
    'color',
    'fraction',
    'tolerance',
    'priceNet',
    'poolStock',
    'poolDelivery',
    'sku',
    'status'
  ]) {
    expect(weightRows).toContain(`key: '${rowKey}'`);
  }
  expect(weightEditorSource).toContain('renderExpandedWeightVariantCell');
  expect(weightEditorSource).toContain('{WEIGHT_VARIANT_MATRIX_ROWS.map((row, rowIndex) => {');
  expect(weightEditorSource).toContain(
    'aria-label="Razli\u010dice artikla po masi s polji v vrsticah"'
  );
});

test('removing duplicate controls preserves variant specifications through save and storefront rendering', () => {
  expect(editorSource).toContain(
    'specifications: variant.contentOverride.specifications ? { ...variant.contentOverride.specifications } : undefined,'
  );
  expect(editorSource).toContain('contentOverride: variant.contentOverride ?? null,');
  expect(
    editorSource.match(/contentOverride: variant\.contentOverride \?\? null,/gu)?.length ?? 0
  ).toBeGreaterThanOrEqual(2);

  expect(storefrontMapperSource).toContain(
    'contentOverride.specifications ?? raw.specifications'
  );
  expect(storefrontDetailSource).toContain(
    'selectedVariant?.specifications ?? []'
  );
  expect(storefrontDetailSource).toContain('product.specifications');
});

test('canonical matrix values remain snapshotted and restored with customer orders', () => {
  const attributeBuilder = sourceBetween(
    orderCommerceSource,
    'function buildAttributes(',
    'function priceLine('
  );
  for (const persistedField of [
    'length',
    'width',
    'thickness',
    'weight',
    'errorTolerance',
    'material',
    'colour',
    'shape'
  ]) {
    expect(attributeBuilder).toContain(`['${persistedField}', row.`);
  }

  expect(orderCommerceSource).toContain(
    'const attributes = buildAttributes(row, optionAssignments);'
  );
  expect(orderContractsSource).toContain(
    'attributes: Record<string, string | number>;'
  );
  expect(orderRouteSource).toContain('JSON.stringify(item.attributes)');
  expect(orderConfirmationRouteSource).toContain(
    'attributes: objectValue(row.selected_attributes)'
  );
});
