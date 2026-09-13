import assert from 'node:assert/strict';
import test from 'node:test';
import type { CatalogItemEditorPayload, CatalogItemEditorVariantPayload } from '../../src/shared/domain/catalog/catalogAdminTypes';
import { isCatalogDimensionOptionAxis, normalizeCatalogDimensionOptions } from '../../src/shared/domain/catalog/catalogDimensionOptions';

function variant(overrides: Partial<CatalogItemEditorVariantPayload> = {}): CatalogItemEditorVariantPayload {
  return {
    variantName: '200 × 200 × 0,5 mm',
    thickness: 0.5,
    length: 200,
    width: 200,
    price: 5,
    costNet: null,
    weight: null,
    errorTolerance: null,
    variantSku: null,
    badge: null,
    optionValueIds: [10],
    optionSelections: { dimenzije: '200-x-200-mm' },
    ...overrides
  };
}

function payload(variants = [variant()]): CatalogItemEditorPayload {
  return {
    itemName: 'Aluminijasta plošča',
    itemType: 'sheet',
    productType: 'dimensions',
    status: 'active',
    categoryPath: ['Materiali', 'Kovine'],
    slug: 'aluminijasta-plosca',
    optionAxes: [{
      id: 1,
      name: 'Dimenzije',
      slug: 'dimenzije',
      position: 0,
      values: [
        { id: 10, value: '200 × 200 mm', slug: '200-x-200-mm', position: 0 },
        { id: 11, value: '300 × 300 mm', slug: '300-x-300-mm', position: 1 }
      ]
    }],
    variants,
    media: []
  };
}

function selectedDimension(input: CatalogItemEditorPayload, index: number) {
  const selectedSlug = input.variants[index].optionSelections?.dimenzije;
  return input.optionAxes?.[0].values.find((value) => value.slug === selectedSlug);
}

test('recognizes exact normalized dimension axes without claiming custom dimensions properties', () => {
  assert.equal(isCatalogDimensionOptionAxis({ name: ' Dimenzije ', slug: 'sizes' }), true);
  assert.equal(isCatalogDimensionOptionAxis({ name: 'Size', slug: ' DIMENSIONS ' }), true);
  assert.equal(isCatalogDimensionOptionAxis({ name: 'Dimenzije paketa', slug: 'package-dimensions' }), false);
  assert.equal(isCatalogDimensionOptionAxis({ name: 'Barva', slug: 'barva' }), false);
});

test('plates with the same length and width but different thickness receive distinct option values', () => {
  const result = normalizeCatalogDimensionOptions(payload([
    variant({ id: 100 }),
    variant({ variantName: '0,3 × 200 × 200 mm', thickness: 0.3, price: 4, costNet: 3 })
  ]));
  assert.equal(selectedDimension(result, 0)?.value, '0,5 × 200 × 200 mm');
  assert.equal(selectedDimension(result, 1)?.value, '0,3 × 200 × 200 mm');
  assert.notEqual(selectedDimension(result, 0)?.slug, selectedDimension(result, 1)?.slug);
  assert.equal(selectedDimension(result, 0)?.id, 10);
  assert.equal(selectedDimension(result, 1)?.id, undefined);
  assert.deepEqual(result.variants.map((entry) => entry.optionValueIds), [[], []]);
  assert.equal(result.optionAxes?.[0].values.filter((entry) => entry.id === 10).length, 1);
  assert.deepEqual(result.optionAxes?.[0].values.find((entry) => entry.id === 11), payload().optionAxes?.[0].values[1]);
});

test('the same physical dimensions share a value even if names or commercial fields differ', () => {
  const result = normalizeCatalogDimensionOptions(payload([
    variant({ variantName: 'First name', price: 5 }),
    variant({ variantName: 'Other name', price: 4, inventory: 0, weight: 0.022, optionValueIds: [], optionSelections: {} })
  ]));
  assert.equal(selectedDimension(result, 0)?.slug, selectedDimension(result, 1)?.slug);
  assert.equal(result.optionAxes?.[0].values.filter((entry) => entry.value === '0,5 × 200 × 200 mm').length, 1);
});

test('partial dimensions retain optional nulls and identify each measurement position separately', () => {
  const input = payload([
    variant({ thickness: null, length: 200, width: null }),
    variant({ thickness: 200, length: null, width: null }),
    variant({ thickness: null, length: null, width: 200 })
  ]);
  const result = normalizeCatalogDimensionOptions(input);
  assert.deepEqual(result.variants.map((entry) => [entry.thickness, entry.length, entry.width]), [
    [null, 200, null],
    [200, null, null],
    [null, null, 200]
  ]);
  assert.equal(new Set(result.variants.map((entry) => entry.optionSelections?.dimenzije)).size, 3);
  for (const [index, entry] of result.variants.entries()) {
    assert.equal(selectedDimension(result, index)?.value, '200 mm');
    assert.equal(entry.costNet, null);
    assert.equal(entry.weight, null);
    assert.equal(entry.errorTolerance, null);
    assert.equal(entry.variantSku, null);
    assert.equal(entry.badge, null);
  }
});

test('all-empty physical dimensions use existing options, then the name or SKU without fabricating measurements', () => {
  const result = normalizeCatalogDimensionOptions(payload([
    variant({ thickness: null, length: null, width: null }),
    variant({ thickness: null, length: null, width: null, variantName: 'Po naročilu', optionValueIds: [], optionSelections: {} }),
    variant({ thickness: null, length: null, width: null, variantName: '', variantSku: 'CUSTOM-SIZE', optionValueIds: [], optionSelections: {} })
  ]));
  assert.equal(selectedDimension(result, 0)?.id, 10);
  assert.equal(selectedDimension(result, 0)?.value, '200 × 200 mm');
  assert.equal(selectedDimension(result, 1)?.value, 'Po naročilu');
  assert.equal(selectedDimension(result, 2)?.value, 'CUSTOM-SIZE');
  assert.ok(result.variants.every((entry) => entry.thickness === null && entry.length === null && entry.width === null));
});

test('unrelated axes, option assignments, shipping and commercial data are preserved without mutation', () => {
  const input = payload([variant({
    optionValueIds: [10, 30],
    optionSelections: { dimenzije: '200-x-200-mm', barva: 'modra' },
    inventory: 55,
    shippingWeightGrams: 22,
    shippingLengthMm: 200,
    shippingWidthMm: 200,
    shippingHeightMm: null,
    minOrder: 5,
    discountPct: 0,
    contentOverride: { deliveryEstimate: '1–2 dni', specifications: { Note: 'Keep me' } },
    imageAssignments: [2, 3]
  })]);
  input.optionAxes?.push({
    id: 3, name: 'Barva', slug: 'barva',
    values: [{ id: 30, value: 'Modra', slug: 'modra', swatch: '#0000ff' }]
  });
  const before = structuredClone(input);
  const result = normalizeCatalogDimensionOptions(input);
  assert.deepEqual(input, before);
  assert.deepEqual(result.optionAxes?.[1], input.optionAxes?.[1]);
  assert.deepEqual(result.variants[0].optionValueIds, [30]);
  assert.equal(result.variants[0].optionSelections?.barva, 'modra');
  const { optionValueIds: _beforeIds, optionSelections: _beforeSelections, ...beforeFields } = input.variants[0];
  const { optionValueIds: _afterIds, optionSelections: _afterSelections, ...afterFields } = result.variants[0];
  assert.deepEqual(afterFields, beforeFields);
});

test('normalization is stable before and after generated values receive database IDs', () => {
  const first = normalizeCatalogDimensionOptions(payload([variant(), variant({ thickness: 0.3 })]));
  assert.deepEqual(normalizeCatalogDimensionOptions(first), first);
  const persisted = structuredClone(first);
  persisted.optionAxes?.[0].values.forEach((value, index) => { value.id ??= 1000 + index; });
  const second = normalizeCatalogDimensionOptions(persisted);
  assert.deepEqual(second, persisted);
  const changed = structuredClone(second);
  changed.variants[1].thickness = 0.4;
  const third = normalizeCatalogDimensionOptions(changed);
  assert.equal(selectedDimension(third, 1)?.id, selectedDimension(second, 1)?.id);
  assert.equal(selectedDimension(third, 1)?.value, '0,4 × 200 × 200 mm');
  assert.deepEqual(normalizeCatalogDimensionOptions(third), third);
});

test('a changed first variant cannot steal the canonical option ID from an unchanged later variant', () => {
  const initial = normalizeCatalogDimensionOptions(payload());
  const existing = initial.variants[0];
  initial.variants = [{ ...existing, thickness: 0.3 }, existing];
  const result = normalizeCatalogDimensionOptions(initial);
  assert.equal(selectedDimension(result, 0)?.id, undefined);
  assert.equal(selectedDimension(result, 1)?.id, 10);
  assert.equal(selectedDimension(result, 1)?.value, '0,5 × 200 × 200 mm');
});

test('ordinary products and omitted or custom-only axes are unchanged; legacy sheets are normalized', () => {
  for (const productType of ['simple', 'weight', 'unique_machine'] as const) {
    const input = { ...payload(), productType };
    assert.equal(normalizeCatalogDimensionOptions(input), input);
  }
  const omitted = { ...payload(), optionAxes: undefined };
  assert.equal(normalizeCatalogDimensionOptions(omitted), omitted);
  const custom = { ...payload(), optionAxes: [{ name: 'Dimenzije paketa', slug: 'package-dimensions', values: [] }] };
  assert.equal(normalizeCatalogDimensionOptions(custom), custom);
  const legacySheet = { ...payload(), productType: undefined };
  assert.equal(selectedDimension(normalizeCatalogDimensionOptions(legacySheet), 0)?.value, '0,5 × 200 × 200 mm');
  const ordinaryLegacy = { ...legacySheet, itemType: 'unit' as const };
  assert.equal(normalizeCatalogDimensionOptions(ordinaryLegacy), ordinaryLegacy);
});
