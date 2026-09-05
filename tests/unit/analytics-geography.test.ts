import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { test } from 'node:test';
import { candidateMatchesSnapshot, normalizedSnapshot, resolveAddressCandidates, validateReference, equalWidthThresholds, polygonParts, pointInGeometry, type GeographyAddressCandidate, type GeographyReference, type GeographyResolution } from '@/shared/domain/analytics/geography';
import { addressFingerprint, aggregateGeography } from '@/shared/server/geographyAnalytics';
import type { CanonicalOrder } from '@/shared/domain/analytics/businessAnalytics';

const address = { addressLine1: '  Čopova ULICA 11 C ', city: 'Ljubljana', postalCode: '1000', countryCode: 'SI', gursHouseNumberId: 'house-1' };
const candidate: GeographyAddressCandidate = { officialAddressId: 'address-1', houseNumberId: 'house-1', municipalityId: 'municipality-1', regionId: 'region-1', addressLine1: 'Čopova ulica 11c', settlement: 'Ljubljana', postalName: 'Ljubljana', postalCode: '1000' };
const polygon = { type: 'Polygon' as const, coordinates: [[[14, 46], [15, 46], [15, 46.5], [14, 46.5], [14, 46]]] as [number, number][][] };
const reference: GeographyReference = { type: 'FeatureCollection', metadata: { version: 'fixture-v1', importedAt: '2026-09-05T00:00:00Z', sourceUpdatedAt: { municipalities: '2026-09-01', regions: '2026-09-01' }, sourceCrs: 'EPSG:3794', renderCrs: 'OGC:CRS84', attribution: 'Test fixture only', licence: 'Test fixture', sources: [], counts: { municipalities: 2, regions: 1 }, crosswalkMethod: 'fixture' }, features: [
  { type: 'Feature', geometry: polygon, properties: { id: 'municipality-1', code: '001', name: 'Občina ena', level: 'municipality', regionId: 'region-1' } },
  { type: 'Feature', geometry: polygon, properties: { id: 'municipality-2', code: '002', name: 'Občina dve', level: 'municipality', regionId: 'region-1' } },
  { type: 'Feature', geometry: polygon, properties: { id: 'region-1', code: '01', name: 'Regija', level: 'region', regionId: 'region-1' } }
]};
function order(id: string, snapshot = address, cents: number | null = 1000, customerKey: string | null = 'customer-1') {
  return {
    id, number: id, addressSnapshot: snapshot, activityCents: cents, customerKey,
    submittedAt: '2026-09-04T12:00:00Z', fulfilledAt: null, customerType: 'school',
    customerName: 'Testna šola', fulfilledCents: null, refundCents: null, refundComplete: false,
    status: 'received', source: 'direct', snapshotOrigin: 'captured', shippingGrossCents: null,
    shippingTaxRate: null, shippingSnapshot: null, packedWeightGrams: null, carrierCostNetCents: null,
    parcelCount: null, preparationMinutes: null, oversize: null, lines: []
  } satisfies CanonicalOrder;
}
function resolution(id: string, overrides: Partial<GeographyResolution> = {}): GeographyResolution {
  return { orderId: id, fingerprint: addressFingerprint(address), addressBasis: 'delivery_customer_snapshot', status: 'municipality', method: 'test', municipalityId: 'municipality-1', regionId: 'region-1', officialAddressId: 'address-1', sourceVersion: 'fixture-v1', resolvedAt: '2026-09-05T00:00:00Z', manual: false, ...overrides };
}
test('full address matching handles diacritics, whitespace and house suffixes without postcode-only attribution', () => {
  assert.equal(candidateMatchesSnapshot(address, candidate), true);
  assert.equal(normalizedSnapshot(address).addressLine1, 'copova ulica 11c');
  assert.equal(candidateMatchesSnapshot({ ...address, addressLine1: 'Druga ulica 11c' }, candidate), false);
  assert.equal(resolveAddressCandidates({ city: 'Ljubljana', postalCode: '1000', countryCode: 'SI' }, [candidate]).status, 'partial');
});
test('stored house identifier cannot assign a school headquarters when delivery address differs', () => {
  assert.equal(resolveAddressCandidates({ ...address, addressLine1: 'Podružnica 4' }, [candidate]).status, 'unmatched');
});
test('duplicate place names and shared postcodes remain ambiguous across municipalities', () => {
  const alternatives = [candidate, { ...candidate, municipalityId: 'municipality-2', houseNumberId: 'house-2' }];
  assert.equal(resolveAddressCandidates({ ...address, gursHouseNumberId: '' }, alternatives).status, 'ambiguous');
  assert.equal(resolveAddressCandidates(address, alternatives).status, 'municipality');
});
test('apartment candidates with one uniquely evidenced municipality resolve only at municipality level', () => {
  const result = resolveAddressCandidates({ ...address, gursHouseNumberId: '' }, [candidate, { ...candidate, officialAddressId: 'apartment-2' }]);
  assert.equal(result.status, 'municipality');
  assert.equal(result.method, 'exact_address_unique_municipality');
  assert.equal(result.candidate?.officialAddressId, null);
});
test('foreign and missing-country addresses do not get inferred as Slovenia', () => {
  assert.equal(resolveAddressCandidates({ ...address, countryCode: 'AT' }, [candidate]).status, 'foreign');
  assert.equal(resolveAddressCandidates({ ...address, countryCode: '' }, [candidate]).status, 'unknown_country');
});
test('municipality and common-subset region sums agree; region-only, unknown and unresolved orders reconcile', () => {
  const records = [order('1'), order('2', address, 2000), order('3'), order('4', { ...address, countryCode: 'AT' }), order('5', { ...address, countryCode: '' }), order('6'), order('7', address, null, null)];
  const actual = aggregateGeography(records, [resolution('1'), resolution('2', { municipalityId: 'municipality-2' }), resolution('3', { status: 'region_only', municipalityId: null }), resolution('7')], reference);
  assert.deepEqual(actual.reconciliation, { allEligibleOrders: 7, mappedSlovenianOrders: 3, unresolvedSlovenianOrders: 2, foreignOrders: 1, unknownCountryOrders: 1, regionOnlyResolvedOrders: 1 });
  const region = actual.areas.find((area) => area.level === 'region')!;
  const municipalities = actual.areas.filter((area) => area.level === 'municipality');
  assert.equal(region.municipalityResolvedOrders, municipalities.reduce((sum, area) => sum + area.orderCount, 0));
  assert.equal(region.orderCount, 4);
  assert.equal(region.knownValueOrders, 3);
  assert.equal(region.distinctCustomers, 1);
  assert.equal(actual.coverage.unlinkedCustomerOrders, 1);
  assert.deepEqual(actual.membership.get('municipality-1'), ['1', '7']);
});
test('stale address fingerprints and reference vintages stay unresolved, including preserved manual overrides', () => {
  const actual = aggregateGeography([order('1'), order('2')], [resolution('1', { fingerprint: 'old-address', manual: true }), resolution('2', { sourceVersion: 'old-vintage' })], reference);
  assert.equal(actual.reconciliation.unresolvedSlovenianOrders, 2);
  assert.equal(actual.coverage.staleAddressResolutions, 1);
  assert.equal(actual.coverage.otherVintageOrders, 1);
});
test('zero and tied intensity domains remain finite and explicit', () => {
  assert.deepEqual(equalWidthThresholds(0), [0]);
  assert.deepEqual(equalWidthThresholds(10), [0, 2, 4, 6, 8, 10]);
  assert.deepEqual(equalWidthThresholds(10, 2, 'sqrt'), [0, 2.5, 10]);
});
test('invalid source CRS, omitted units and mismatched official crosswalk are rejected', () => {
  assert.equal(validateReference(reference), reference);
  const invalid = structuredClone(reference);
  invalid.features[0].geometry.coordinates[0][0] = [500000, 100000] as never;
  assert.throws(() => validateReference(invalid), /ring|CRS/);
  assert.throws(() => validateReference({ ...reference, features: reference.features.slice(1) }), /count mismatch/);
});
test('checked-in official render retains every full-resolution polygon part and hole', () => {
  const rendered = JSON.parse(readFileSync('public/data/slovenia-geography.json', 'utf8')) as GeographyReference;
  const full = JSON.parse(gunzipSync(readFileSync(`data/geography/${rendered.metadata.version}.full.geojson.gz`)).toString()) as GeographyReference;
  validateReference(full);
  validateReference(rendered);
  assert.equal(rendered.features.length, full.features.length);
  for (let index = 0; index < full.features.length; index++) {
    assert.equal(rendered.features[index].properties.id, full.features[index].properties.id);
    assert.deepEqual(polygonParts(rendered.features[index].geometry).map((part) => part.length), polygonParts(full.features[index].geometry).map((part) => part.length));
  }
});


test('address points respect holes and treat shared boundaries explicitly', () => {
  const withHole = { type: 'Polygon' as const, coordinates: [polygon.coordinates[0], [[14.2, 46.1], [14.4, 46.1], [14.4, 46.2], [14.2, 46.2], [14.2, 46.1]]] as [number, number][][] };
  assert.equal(pointInGeometry([14.1, 46.1], withHole), 'inside');
  assert.equal(pointInGeometry([14.3, 46.15], withHole), 'outside');
  assert.equal(pointInGeometry([14.2, 46.15], withHole), 'boundary');
  assert.equal(pointInGeometry([15, 46.1], withHole), 'boundary');
});
test('missing render feature is reported independently from mapped-order reconciliation', () => {
  const missingFeature = { ...reference, features: reference.features.filter((feature) => feature.properties.id !== 'municipality-1') };
  const actual = aggregateGeography([order('1')], [resolution('1')], missingFeature);
  assert.equal(actual.reconciliation.mappedSlovenianOrders, 1);
  assert.equal(actual.coverage.missingReferenceGeometry, 1);
  assert.equal(actual.areas.find((area) => area.level === 'region')!.orderCount, 1);
});
test('partial activity value is unavailable just as in the canonical heatmap', () => {
  const actual = aggregateGeography([order('1'), order('2', address, null)], [resolution('1'), resolution('2')], reference);
  const area = actual.areas.find((value) => value.id === 'municipality-1')!;
  assert.equal(area.orderCount, 2);
  assert.equal(area.knownValueOrders, 1);
  assert.equal(area.activityValue, null);
});
