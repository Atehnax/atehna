import assert from 'node:assert/strict';
import { readE2eEnvironment } from './e2e-database.mjs';
import type { BusinessAnalyticsResponse, BusinessDrilldownResponse } from '../src/shared/domain/analytics/businessAnalytics';
import type { GeographyArea } from '../src/shared/server/geographyAnalytics';

const expected = readE2eEnvironment();
const base = new URL(process.env.ANALYTICS_TEST_BASE_URL ?? 'http://127.0.0.1:3049');
if (!['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname)) throw new Error('Analytics API fixtures must target an isolated loopback server.');
const health = await fetch(new URL('/api/e2e/health', base));
assert.equal(health.status, 200, 'Isolated E2E server is not ready; refresh its schema fingerprint if the schema changed.');
const healthBody = await health.json() as { databaseIdentity: { database: string; serverPort: number } };
assert.equal(healthBody.databaseIdentity.database, expected.databaseName);
assert.equal(healthBody.databaseIdentity.serverPort, expected.databaseIdentity.serverPort);
for (const route of ['/api/admin/analytics/business', '/api/admin/analytics/business/records?format=csv', '/api/admin/analytics/geography', '/api/admin/analytics/orders/3/measurements']) {
  assert.equal((await fetch(new URL(route, base))).status, 401, 'Aggregate, CSV, map and capture endpoints require admin authentication.');
}
const login = await fetch(new URL('/api/admin/login', base), {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD })
});
assert.equal(login.status, 200);
const cookie = login.headers.get('set-cookie')?.split(';')[0];
assert.ok(cookie);
async function get<T>(route: string): Promise<T> {
  const response = await fetch(new URL(route, base), { headers: { cookie: cookie! } });
  assert.equal(response.status, 200, 'Request failed: ' + route);
  assert.match(response.headers.get('cache-control') ?? '', /no-store/);
  return response.json() as Promise<T>;
}
const asOf = process.env.ANALYTICS_FIXTURE_AS_OF ?? new Date().toISOString();
const query = new URLSearchParams({ range: '90D', source: 'direct', asOf });
const business = await get<BusinessAnalyticsResponse>('/api/admin/analytics/business?' + query);
assert.equal(business.summary.orderCount, 12);
assert.equal(business.summary.activityValue, 4235);
assert.ok(Math.abs(business.summary.meanOrderValue! - 4235 / 12) < 1e-9);
assert.equal(business.summary.medianOrderValue, 192.5);
assert.equal(business.summary.realisedCount, 9);
assert.equal(business.summary.realisedValue, null, 'One unquantified refund must make the full net total unavailable.');
assert.equal(business.coverage.realisedValueOrders, 8);
assert.equal(business.days.reduce((sum, day) => sum + day.orderCount, 0), 12);
assert.equal(business.days.reduce((sum, day) => sum + day.activityValue, 0), 4235);
const workload = await get<BusinessAnalyticsResponse>('/api/admin/analytics/business?' + query + '&view=postnina');
assert.ok(workload.workload.regression.slope !== null, 'Workload uses nonconstant paired line-count/time measurements.');
const records = await get<BusinessDrilldownResponse>('/api/admin/analytics/business/records?' + query + '&kind=orders');
assert.equal(records.total, 12);
assert.equal(records.records.length, 12);
assert.equal(records.records.reduce((sum, record) => sum + (record.value ?? 0), 0), 4235);
const csv = await fetch(new URL('/api/admin/analytics/business/records?' + query + '&kind=orders&format=csv', base), { headers: { cookie } });
assert.equal(csv.status, 200);
assert.equal((await csv.text()).trim().split(/\r?\n/).length, 13);
type MapResponse = {
  areas: GeographyArea[];
  reconciliation: { allEligibleOrders: number; mappedSlovenianOrders: number; unresolvedSlovenianOrders: number; foreignOrders: number; unknownCountryOrders: number; regionOnlyResolvedOrders: number };
  selected?: { total: number; records: Array<{ id: string }> } | null;
};
const map = await get<MapResponse>('/api/admin/analytics/geography?' + query);
assert.deepEqual(map.reconciliation, { allEligibleOrders: 12, mappedSlovenianOrders: 8, unresolvedSlovenianOrders: 2, foreignOrders: 1, unknownCountryOrders: 1, regionOnlyResolvedOrders: 1 });
const municipalities = map.areas.filter(area => area.level === 'municipality');
const regions = map.areas.filter(area => area.level === 'region');
assert.equal(municipalities.reduce((sum, area) => sum + area.orderCount, 0), 8);
assert.equal(regions.reduce((sum, area) => sum + area.orderCount, 0), 9);
for (const region of regions) assert.equal(region.municipalityResolvedOrders, municipalities.filter(area => area.regionId === region.id).reduce((sum, area) => sum + area.orderCount, 0));
const ljubljana = municipalities.find(area => area.name === 'Ljubljana');
assert.ok(ljubljana); assert.equal(ljubljana.orderCount, 2);
const selected = await get<MapResponse>('/api/admin/analytics/geography?' + query + '&area=' + ljubljana.id);
assert.equal(selected.selected?.total, 2);
const areaCsv = await fetch(new URL('/api/admin/analytics/geography?' + query + '&area=' + ljubljana.id + '&export=orders', base), { headers: { cookie } });
assert.equal(areaCsv.status, 200); assert.equal((await areaCsv.text()).trim().split(/\r?\n/).length, 3);
const schoolQuery = new URLSearchParams(query); schoolQuery.set('customerType', 'school');
const school = await get<BusinessAnalyticsResponse>('/api/admin/analytics/business?' + schoolQuery);
assert.equal(school.summary.orderCount, 4); assert.equal(school.summary.activityValue, 1490);
const schoolMap = await get<MapResponse>('/api/admin/analytics/geography?' + schoolQuery);
assert.equal(schoolMap.reconciliation.allEligibleOrders, 4);
assert.equal(schoolMap.reconciliation.mappedSlovenianOrders, 2);
assert.equal(schoolMap.reconciliation.unresolvedSlovenianOrders, 2);

const captureId = records.records.find(record => record.number === 'ANALYTICS-FIXTURE-02')?.id;
assert.ok(captureId);
type Measurement = { revision: number; fields: Record<string, unknown>; history?: Array<{ reason: string; revision: number }> };
const route = '/api/admin/analytics/orders/' + captureId + '/measurements';
const before = await get<Measurement>(route);
async function patch(body: unknown) {
  return fetch(new URL(route, base), { method: 'POST', headers: { cookie: cookie!, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
assert.equal((await patch({ expectedRevision: before.revision, reason: 'PREIZKUS – neveljavna meritev', fields: { actualCarrierCostNet: '-1' } })).status, 400);
const savedResponse = await patch({ expectedRevision: before.revision, reason: 'PREIZKUS – preverjanje sočasnosti in revizijske sledi', fields: { actualCarrierCostNet: '4.19', preparationMinutes: '20.25' } });
assert.equal(savedResponse.status, 200);
const saved = await savedResponse.json() as Measurement;
try {
  assert.equal(saved.revision, before.revision + 1);
  assert.equal(saved.fields.actualCarrierCostNet, '4.19');
  assert.equal((await patch({ expectedRevision: before.revision, reason: 'PREIZKUS – zastarela revizija', fields: { preparationMinutes: '99' } })).status, 409);
  const after = await get<Measurement>(route);
  assert.equal(after.revision, saved.revision);
  assert.ok(after.history?.some(entry => entry.revision === saved.revision && entry.reason.includes('sočasnosti')));
} finally {
  const restored = await patch({ expectedRevision: saved.revision, reason: 'PREIZKUS – obnovitev prvotnih meritev po preverjanju', fields: before.fields });
  assert.equal(restored.status, 200, 'Restore the disposable fixture measurement values after verification.');
}
const final = await get<Measurement>(route);
assert.deepEqual(final.fields, before.fields);
console.info('Verified isolated API: admin protection; direct90D count/value/mean/median; incomplete refund total; heatmap, records and CSV parity; geography8+2+1+1 and region-only invariant; school filter; selected-area export; operational optimistic revision and durable audit. Original fixture measurements restored.');
