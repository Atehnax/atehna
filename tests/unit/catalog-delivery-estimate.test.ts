import assert from 'node:assert/strict';
import test from 'node:test';
import { formatCatalogDeliveryDays, resolveCatalogVariantDeliveryEstimate as resolve } from '@/shared/domain/catalog/catalogDeliveryEstimate';
import type { CatalogEditorProductType } from '@/shared/domain/catalog/catalogAdminTypes';

const variant = { id: 42, thickness: 0.5, length: 100, width: 200 };

test('each product type uses its existing stored default delivery field', () => {
  for (const [type, data] of [
    ['simple', { simple: { deliveryTime: '3 delovni dnevi' } }],
    ['dimensions', { dimensions: { defaultDeliveryTime: '3 delovni dnevi' } }],
    ['weight', { weight: { deliveryTime: '3 delovni dnevi' } }],
    ['unique_machine', { uniqueMachine: { deliveryTime: '3 delovni dnevi' } }],
  ] as const) assert.equal(resolve(type, data, variant), '3 delovni dnevi');
});

test('saved content override takes precedence for every product type', () => {
  const data = { simple: { deliveryTime: '1 dan' }, dimensions: { defaultDeliveryTime: '2 dni', variantDeliveryTimes: { '42': '3 dni' } }, weight: { deliveryTime: '4 dni' }, uniqueMachine: { deliveryTime: '5 dni' } };
  for (const type of ['simple', 'dimensions', 'weight', 'unique_machine'] as CatalogEditorProductType[]) {
    assert.equal(resolve(type, data, { ...variant, contentOverride: { deliveryEstimate: ' 7 delovnih dni ', description: 'Preserved content' } }), '7 delovnih dni');
  }
});

test('dimension-specific lead times prefer variant ID before dimensional key and default', () => {
  const keyed = { defaultDeliveryTime: '1-2 delovna dneva', variantDeliveryTimes: { '42': '3 delovni dnevi', '0P5x100x200': '4 delovni dnevi' } };
  assert.equal(resolve('dimensions', { dimensions: keyed }, variant), '3 delovni dnevi');
  assert.equal(resolve('dimensions', { dimensions: keyed }, { ...variant, id: '43' }), '4 delovni dnevi');
  assert.equal(resolve('dimensions', { dimensions: keyed }, { ...variant, id: '43', width: 300 }), '1-2 delovna dneva');
});

test('dimensional lookup matches editor ordering, P fractions and absent dimensions', () => {
  const data = { dimensions: { variantDeliveryTimes: { '1P25x20P5x': '6 dni', '20P5x1P25x': 'Wrong axis order' } } };
  assert.equal(resolve('dimensions', data, { id: 1, thickness: 1.25, length: 20.5, width: null }), '6 dni');
  assert.equal(resolve('dimensions', data, { id: 1, thickness: 1.25, length: 20.5, width: Number.NaN }), '6 dni');
});

test('existing singular dimension and machine data keys keep their fallback semantics', () => {
  assert.equal(resolve('dimensions', { dimension: { defaultDeliveryTime: '2 dni' } }, variant), '2 dni');
  assert.equal(resolve('unique_machine', { machine: { deliveryTime: '9 dni' } }, variant), '9 dni');
  assert.equal(resolve('dimensions', { dimension: { variantDeliveryTimes: { '42': '5 dni' } } }, variant), '5 dni');
});

test('blank or malformed overrides fall back while missing saved estimates stay null', () => {
  const data = { dimensions: { defaultDeliveryTime: ' 2 dni ', variantDeliveryTimes: { '42': ' ', '0P5x100x200': 7 } } };
  for (const contentOverride of [null, [], { deliveryEstimate: '' }, { deliveryEstimate: 4 }]) {
    assert.equal(resolve('dimensions', data, { ...variant, contentOverride }), '2 dni');
  }
  for (const type of ['simple', 'dimensions', 'weight', 'unique_machine'] as CatalogEditorProductType[]) {
    for (const missing of [null, {}, []]) assert.equal(resolve(type, missing, variant), null);
  }
});

test('resolution leaves all source content, variant overrides and stored values untouched', () => {
  const data = { dimensions: { defaultDeliveryTime: '2 dni', variantDeliveryTimes: { '42': '4 dni' }, variantInventory: [{ stock: 20 }] }, unrelated: { label: 'Keep' } };
  const value = { ...variant, contentOverride: { deliveryEstimate: '8 dni', documentIds: [12] } };
  const before = structuredClone({ data, value });
  assert.equal(resolve('dimensions', data, value), '8 dni');
  assert.deepEqual({ data, value }, before);
});

test('delivery days use the requested numeric value or inclusive range with d suffix', () => {
  for (const [value, expected] of [
    ['2-4 delovne dni', '2–4 d'], ['2–4 dni', '2–4 d'], ['2-4', '2–4 d'],
    ['4 delovne dni', '4 d'], ['0 dni', '0 d'],
  ]) assert.equal(formatCatalogDeliveryDays(value), expected);
});

test('delivery-day formatting accepts normal Slovenian day labels and dash variants', () => {
  for (const [value, expected] of [
    ['1 dan', '1 d'], ['1 delovni dan', '1 d'], ['2 delovna dneva', '2 d'],
    ['3 delovni dnevi', '3 d'], ['5 delovnih dni', '5 d'], ['7 koledarskih dni', '7 d'],
    [' 02 — 04 DELOVNI DNEVI ', '2–4 d'], ['2 d', '2 d'], ['4', '4 d'],
    ['0-2 dni', '0–2 d'], ['4-4 dni', '4 d'],
  ]) assert.equal(formatCatalogDeliveryDays(value), expected);
});

test('delivery-day formatting rejects dates, weeks, other units and free-text promises', () => {
  for (const value of [
    '2-4 tedne', '4 tedni', '2 meseca', '24 ur', '2–4 weeks', '1 delovni teden',
    '2026-09-06', '4. 9. 2026', '4/9', '4.9.', 'po dogovoru', 'na zalogi',
    'do 4 dni', 'približno 4 dni', '4 dni od naročila', '4 dni ali 2 tedna',
  ]) assert.equal(formatCatalogDeliveryDays(value), null, value);
});

test('delivery days reject missing, reversed, negative and fractional quantities', () => {
  for (const value of [null, undefined, '', ' ', '-1 dni', '-1-2 dni', '4-2 dni', '1,5 dni', '1.5 dni', '1e2 dni', '2- dni', '2-4-6 dni', '0'.repeat(81)]) {
    assert.equal(formatCatalogDeliveryDays(value), null, String(value));
  }
});
