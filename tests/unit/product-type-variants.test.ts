import assert from 'node:assert/strict';
import test from 'node:test';
import { createVariant } from '@/admin/features/artikli/lib/familyModel';
import {
  buildSimpleCatalogVariants, buildMachineCatalogVariants, buildWeightCatalogVariants,
  createWeightProductDataFromVariants, getSimpleSimulatorOptions, getMachineSimulatorOptions,
  normalizeSimpleProductData, normalizeUniqueMachineProductData, normalizeWeightProductData,
  mergeGeneratedWeightVariants, getWeightBillableQuantity, getWeightSimulatorOptions
} from '@/admin/features/artikli/components/pricing/productData';
import { toPricingSimulatorOptions } from '@/admin/features/artikli/components/pricing/simulatorUtils';
import { loadBoundServerModule } from './support/loadBoundServerModule';

const variants = () => [
  createVariant({ id: '17', label: 'Ekspres 500 g', sku: 'MEKOL-E', unit: 'kos', price: 4.5, costNet: 2, stock: 9, discountPct: 10, minOrder: 2, weight: 0.55, length: 60, width: 40, thickness: 180, stockRevision: '4', pricingRevision: '7', optionSelections: { izvedba: 'Ekspres', 'neto-masa': '500 g' }, optionValueIds: [3, 5], imageAssignments: [1], contentOverride: { description: 'Posebna izvedba', deliveryEstimate: '4 dni', attributes: { material: 'PVAc' } } }),
  createVariant({ id: '18', label: 'Special 500 g', sku: 'MEKOL-S', unit: 'paket', price: 7, costNet: 3, stock: 5, discountPct: 0, minOrder: 1, weight: null, active: false, optionSelections: { izvedba: 'Special', 'neto-masa': '500 g' }, imageAssignments: [2], sort: 2 })
];

for (const [name, build] of [['standard', buildSimpleCatalogVariants], ['equipment', buildMachineCatalogVariants]] as const) {
  test(`${name} builders preserve every canonical row and ignore stale singleton commercial data`, () => {
    const input = variants();
    const output = build({ basePrice: 999, stock: 999, packageWeightKg: 99 }, input, 'BASE', 'Family');
    assert.deepEqual(output, input);
    output[0].optionSelections!.izvedba = 'changed';
    output[0].contentOverride!.attributes!.material = 'changed';
    assert.equal(input[0].optionSelections!.izvedba, 'Ekspres');
    assert.equal(input[0].contentOverride!.attributes!.material, 'PVAc');
    assert.deepEqual(build({ basePrice: 999, stock: 999 }, [input[0]], 'BASE', 'Family'), [input[0]]);
  });
}

test('standard and equipment simulators select each row with its own price, stock, SKU and sale unit', () => {
  const rows = variants();
  const standard = getSimpleSimulatorOptions({ basePrice: 999, stock: 999 }, 'Family', 'BASE', rows);
  assert.deepEqual(standard.map((row) => [row.id, row.targetKey, row.basePrice, row.quantityUnit]), [['17', 'MEKOL-E', 4.05, 'kos'], ['18', 'MEKOL-S', 7, 'paket']]);
  assert.equal(standard[1].stockLabel, '5 paket');
  const equipment = getMachineSimulatorOptions({ basePrice: 999, stock: 999, serialNumbers: [{ id: 'serial', serialNumber: 'SN-1', status: 'in_stock' }] }, 'Equipment', rows);
  assert.deepEqual(equipment.map((row) => [row.id, row.basePrice, row.discountPercent]), [['17', 4.5, 10], ['18', 7, 0]]);
  assert.ok(equipment.every((row) => row.serialLabels === undefined));
  assert.deepEqual(getSimpleSimulatorOptions({}, '', '', []), []);
});

test('switching to weight tools retains rows without inventing net contents, fractions or shared stock', () => {
  const input = variants();
  const weight = createWeightProductDataFromVariants(undefined, input, 'MEKOL');
  assert.equal(weight.variants.length, input.length);
  assert.deepEqual(weight.variants.map((row) => [row.netMassKg, row.fraction, row.stockKg]), [[null, '', 9], [null, '', 5]]);
  assert.deepEqual(weight.packagingChips, []);
  assert.deepEqual(weight.fractionChips, []);
  const output = buildWeightCatalogVariants(weight, 'MEKOL', input);
  for (let index = 0; index < input.length; index += 1) {
    for (const key of ['id', 'label', 'sku', 'price', 'costNet', 'stock', 'discountPct', 'minOrder', 'weight', 'length', 'width', 'thickness', 'active', 'optionSelections', 'optionValueIds', 'imageAssignments', 'contentOverride'] as const) {
      assert.deepEqual(output[index][key], input[index][key], `${index}.${key}`);
    }
  }
});

test('weight edits keep freshly changed inline attributes, metadata and physical weight', () => {
  const input = variants();
  const weight = createWeightProductDataFromVariants({ variants: [{ id: '17', sku: 'MEKOL-E', netMassKg: 0.5, fraction: '' }] }, input, 'MEKOL');
  weight.variants[0].unitPrice = 12;
  weight.variants[0].deliveryTime = '7 dni';
  input[0].optionSelections!.izvedba = 'Updated';
  input[0].contentOverride!.description = 'Updated description';
  const [result] = buildWeightCatalogVariants(weight, 'MEKOL', input);
  assert.equal(result.price, 12);
  assert.equal(result.optionSelections!.izvedba, 'Updated');
  assert.equal(result.contentOverride!.description, 'Updated description');
  assert.equal(result.contentOverride!.deliveryEstimate, '7 dni');
  assert.equal(result.weight, 0.55);
});

test('new standard and equipment metadata contain no sample prices, stock, warranty or specifications', () => {
  const standard = normalizeSimpleProductData(undefined);
  assert.equal(standard.basePrice, 0);
  assert.equal(standard.stock, 0);
  const equipment = normalizeUniqueMachineProductData(undefined);
  assert.equal(equipment.basePrice, 0);
  assert.equal(equipment.stock, 0);
  assert.equal(equipment.packageWeightKg, 0);
  assert.equal(equipment.packageLengthMm, null);
  assert.equal(equipment.warrantyMonths, '');
  assert.deepEqual(equipment.specs, []);
  assert.deepEqual(equipment.includedItems, []);
  const inherited = normalizeUniqueMachineProductData({}, { variants: variants() });
  assert.equal(inherited.basePrice, 4.5);
  assert.equal(inherited.packageWeightKg, 0.55);
});

test('the server rejects empty variant lists for every product type before touching persistence', async () => {
  let databaseCalls = 0;
  const { upsertCatalogItem } = loadBoundServerModule<{ upsertCatalogItem: (payload: unknown) => Promise<unknown> }>('src/shared/server/catalogItems.ts', {
    getPool: () => { databaseCalls += 1; throw new Error('Unexpected persistence'); }
  });
  for (const productType of ['simple', 'dimensions', 'weight', 'unique_machine']) {
    await assert.rejects(upsertCatalogItem({ productType, status: 'inactive', variants: [] }), (error: unknown) => {
      const result = error as { name: string; statusCode: number };
      return result.name === 'CatalogItemValidationError' && result.statusCode === 400;
    });
  }
  assert.equal(databaseCalls, 0);
});

test('weight hydration preserves separate same-mass rows and does not attach new rows to an existing ID', () => {
  const input = variants();
  const previous = { pricingBasis: 'kg', variants: input.map((row) => ({ id: row.id, sku: row.sku, netMassKg: 0.5, unitPrice: row.price, stockKg: row.stock, stockManagedPerVariant: true, fraction: '', color: '—', label: row.label })) };
  const hydrated = normalizeWeightProductData(previous, { variants: input, baseSku: 'MEKOL' });
  assert.deepEqual(hydrated.variants.map((row) => [row.id, row.label, row.optionSelections?.izvedba]), [['17', 'Ekspres 500 g', 'Ekspres'], ['18', 'Special 500 g', 'Special']]);
  const seeded = normalizeWeightProductData(undefined, { variants: input, baseSku: 'MEKOL' });
  assert.deepEqual(seeded.variants.map((row) => row.id), ['17', '18']);
  const withNew = { ...hydrated, variants: [{ ...hydrated.variants[0], id: 'new-weight', sku: 'NEW', label: 'New' }, ...hydrated.variants] };
  const saved = buildWeightCatalogVariants(withNew, 'MEKOL', input);
  assert.deepEqual(saved.map((row) => row.id), ['new-weight', '17', '18']);
});

test('weight regeneration keeps all attribute combinations and adds only missing weight combinations', () => {
  const rows = createWeightProductDataFromVariants(undefined, variants(), 'MEKOL').variants.map((row) => ({ ...row, netMassKg: 0.5 }));
  const result = mergeGeneratedWeightVariants(rows, [rows[0], { ...rows[0], netMassKg: 1 }]);
  assert.equal(result.length, 3);
  assert.deepEqual(result.slice(0, 2), rows);
  assert.notEqual(result[2].id, rows[0].id);
  assert.notEqual(result[2].sku, rows[0].sku);
  assert.equal(result[2].netMassKg, 1);
});

test('new kilogram pricing uses ordered mass and preserves legacy package calculations', () => {
  const row = { id: 'w', sku: 'W', netMassKg: 5, unitPrice: 12, minQuantity: 2, stockKg: 100, fraction: '', color: '—' };
  const byKg = getWeightSimulatorOptions({ pricingBasis: 'kg', variants: [row] })[0];
  const legacy = getWeightSimulatorOptions({ variants: [row] })[0];
  assert.equal(byKg.weightPricingBasis, 'kg');
  assert.equal(legacy.weightPricingBasis, 'package');
  assert.equal(getWeightBillableQuantity(2.5, byKg.weightNetMassKg, byKg.weightPricingBasis) * byKg.basePrice, 30);
  assert.equal(getWeightBillableQuantity(2.5, 500, 'kg') * byKg.basePrice, 30);
  assert.equal(getWeightBillableQuantity(10, legacy.weightNetMassKg, legacy.weightPricingBasis) * legacy.basePrice, 24);
  assert.equal(byKg.minOrderLabel, '2 kg');
  assert.equal(legacy.minOrderLabel, '10 kg');
  assert.equal(toPricingSimulatorOptions([byKg])[0].weightPricingBasis, 'kg');
});
