import assert from 'node:assert/strict';
import test from 'node:test';
import { CATALOG_ACTIVATION_DUPLICATE_OPTIONS_REASON, CATALOG_ACTIVATION_OPTIONS_REASON, CATALOG_ACTIVATION_PRICE_REASON, CatalogActivationValidationError, getCatalogActivationVariantIds, getCatalogVariantPublicationReasons, parseCatalogBulkActivationRequest, planCatalogItemActivation, type CatalogActivationVariant } from '@/shared/domain/catalog/catalogActivation';
import { deriveCatalogVariantShippingMeasurements, getCatalogShippingReadiness } from '@/shared/domain/catalog/catalogShipping';

test('bulk activation validates the explicit mode and target ownership shape before persistence', () => {
  assert.deepEqual(parseCatalogBulkActivationRequest({ mode: 'first', itemIdentifiers: [' plošča ', 'plošča'], variants: [{ itemIdentifier: 'plošča', variantId: 4 }, { itemIdentifier: 'plošča', variantId: 4 }] }), {
    mode: 'first', itemIdentifiers: ['plošča'], variants: [{ itemIdentifier: 'plošča', variantId: 4 }]
  });
  for (const invalid of [null, {}, { mode: 'all', itemIdentifiers: [] }, { mode: 'other', itemIdentifiers: ['one'] }, { mode: 'all', itemIdentifiers: [' '] }, { mode: 'all', itemIdentifiers: [], variants: [{ itemIdentifier: 'one', variantId: -1 }] }, { mode: 'all', itemIdentifiers: [], variants: [{ itemIdentifier: 'one', variantId: '4' }] }]) {
    assert.throws(() => parseCatalogBulkActivationRequest(invalid), CatalogActivationValidationError);
  }
});

test('first activation follows persisted row order and does not mutate or filter the source variants', () => {
  const variants = [{ id: 90, position: 4, status: 'active' }, { id: 8, position: 1, status: 'inactive' }, { id: 2, position: 1, status: 'inactive' }];
  const snapshot = structuredClone(variants);
  assert.deepEqual(getCatalogActivationVariantIds('first', variants), [2]);
  assert.deepEqual(getCatalogActivationVariantIds('all', variants), [2, 8, 90]);
  assert.deepEqual(variants, snapshot);
});

const item = { itemId: 1, itemIdentifier: 'izdelek', itemName: 'Izdelek', itemSku: 'ART-1', status: 'inactive' };
const variant = (id: number, patch: Partial<CatalogActivationVariant> = {}): CatalogActivationVariant => ({
  id, position: id, name: 'Izvedba ' + id, sku: 'SKU-' + id, price: 5, status: 'inactive',
  optionAxisCount: 0, assignedOptionCount: 0, optionSignature: null, ...patch
});
const plan = (variants: CatalogActivationVariant[], patch: Partial<Parameters<typeof planCatalogItemActivation>[0]> = {}) =>
  planCatalogItemActivation({ item, variants, parentSelected: true, parentReasons: [], mode: 'all', explicitVariantIds: [], ...patch });

test('publication needs a positive price and SKU while missing shipping remains a delivery issue', () => {
  for (const price of [0, -1, Number.NaN, Infinity, null, undefined, '5']) {
    assert.ok(getCatalogVariantPublicationReasons({ sku: 'SKU', price }).includes(CATALOG_ACTIVATION_PRICE_REASON));
  }
  assert.deepEqual(getCatalogVariantPublicationReasons({ sku: 'SKU', price: 0.01 }), []);
  assert.ok(getCatalogVariantPublicationReasons({ sku: ' ', price: 5 }).some(reason => reason.includes('SKU')));
  for (const measurements of [{}, { weight: 0, length: 0, width: 0, thickness: 0 }]) {
    const candidate = { sku: 'SKU', price: 5, ...measurements };
    assert.deepEqual(getCatalogVariantPublicationReasons(candidate), []);
    const shipping = deriveCatalogVariantShippingMeasurements(candidate);
    assert.equal(getCatalogShippingReadiness({}, shipping).isReady, false);
  }
});

test('all activation retains eligible rows and reports invalid siblings without mutating source data', () => {
  const variants = [variant(1), variant(2, { price: 0 }), variant(3, { sku: null }), variant(4, { status: 'active' })];
  const before = structuredClone(variants);
  const result = plan(variants);
  assert.equal(result.activateItem, true);
  assert.deepEqual(result.activateVariantIds, [1]);
  assert.deepEqual(result.skipped.map(row => row.variantId), [2, 3]);
  assert.deepEqual(result.skipped[0], { itemId: 1, itemIdentifier: 'izdelek', itemName: 'Izdelek', itemSku: 'ART-1', variantId: 2, variantName: 'Izvedba 2', variantSku: 'SKU-2', reasons: [CATALOG_ACTIVATION_PRICE_REASON] });
  assert.deepEqual(variants, before);
});

test('an invalid first variant does not silently select the second; explicit selection remains effective', () => {
  const variants = [variant(1, { price: 0 }), variant(2)];
  const first = plan(variants, { mode: 'first' });
  assert.equal(first.activateItem, false);
  assert.deepEqual(first.activateVariantIds, []);
  assert.deepEqual(first.skipped.map(row => row.variantId), [1, undefined]);
  const explicit = plan(variants, { mode: 'first', explicitVariantIds: [2] });
  assert.equal(explicit.activateItem, true);
  assert.deepEqual(explicit.activateVariantIds, [2]);
});

test('invalid categories skip a selected parent and its requested children but variant-only drafts stay independent', () => {
  const variants = [variant(1), variant(2)];
  const blocked = plan(variants, { parentReasons: ['Najprej aktivirajte kategorijo.'] });
  assert.equal(blocked.activateItem, false);
  assert.deepEqual(blocked.activateVariantIds, []);
  assert.deepEqual(blocked.skipped.map(row => row.variantId), [1, 2, undefined]);
  assert.ok(blocked.skipped.every(row => row.reasons.includes('Najprej aktivirajte kategorijo.')));
  const variantOnly = plan(variants, { parentSelected: false, explicitVariantIds: [2] });
  assert.equal(variantOnly.activateItem, false);
  assert.deepEqual(variantOnly.activateVariantIds, [2]);
  assert.deepEqual(variantOnly.skipped, []);
});

test('preserved active invalid rows block new parent publication without deactivating them or losing eligible changes', () => {
  const variants = [variant(1), variant(2, { price: 0, status: 'active' })];
  const before = structuredClone(variants);
  const result = plan(variants, { mode: 'first' });
  assert.equal(result.activateItem, false);
  assert.deepEqual(result.activateVariantIds, [1]);
  const parentSkip = result.skipped.find(row => row.variantId === undefined);
  assert.ok(parentSkip?.reasons.some(reason => reason.includes('Izvedba 2') && reason.includes('SKU-2') && reason.includes(CATALOG_ACTIVATION_PRICE_REASON)));
  assert.deepEqual(variants, before);
  const activeParent = plan(variants, { item: { ...item, status: 'active' } });
  assert.equal(activeParent.activateItem, false);
  assert.deepEqual(activeParent.activateVariantIds, [1]);
});

test('option eligibility skips incomplete and duplicate choices while preserving existing active priority', () => {
  const variants = [
    variant(1, { optionAxisCount: 2, assignedOptionCount: 1, optionSignature: '10' }),
    variant(2, { optionAxisCount: 1, assignedOptionCount: 1, optionSignature: '20' }),
    variant(3, { optionAxisCount: 1, assignedOptionCount: 1, optionSignature: '30' }),
    variant(4, { optionAxisCount: 1, assignedOptionCount: 1, optionSignature: '30' }),
    variant(5, { optionAxisCount: 1, assignedOptionCount: 1, optionSignature: '20', status: 'active' })
  ];
  const result = plan(variants);
  assert.equal(result.activateItem, true);
  assert.deepEqual(result.activateVariantIds, [3]);
  assert.deepEqual(result.skipped.map(row => [row.variantId, row.reasons]), [
    [1, [CATALOG_ACTIVATION_OPTIONS_REASON]], [2, [CATALOG_ACTIVATION_DUPLICATE_OPTIONS_REASON]], [4, [CATALOG_ACTIVATION_DUPLICATE_OPTIONS_REASON]]
  ]);
  const historicalDuplicates = plan([variant(1, { status: 'active', optionAxisCount: 1, assignedOptionCount: 1, optionSignature: '10' }), variant(2, { status: 'active', optionAxisCount: 1, assignedOptionCount: 1, optionSignature: '10' }), variant(3)]);
  assert.equal(historicalDuplicates.activateItem, false);
  assert.deepEqual(historicalDuplicates.activateVariantIds, [3]);
  assert.ok(historicalDuplicates.skipped.some(row => row.variantId === undefined && row.reasons.some(reason => reason.includes(CATALOG_ACTIVATION_DUPLICATE_OPTIONS_REASON))));
});

test('already active eligible selections produce no new status changes or false skipped reasons', () => {
  const variants = [variant(1), variant(2)];
  const first = plan(variants);
  assert.equal(first.activateItem, true);
  assert.deepEqual(first.activateVariantIds, [1, 2]);
  const next = variants.map(row => ({ ...row, status: first.activateVariantIds.includes(row.id) ? 'active' : row.status }));
  assert.deepEqual(plan(next, { item: { ...item, status: 'active' } }), { activateItem: false, activateVariantIds: [], skipped: [] });
});