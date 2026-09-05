import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Pool, PoolClient } from 'pg';
import { getPool } from '@/shared/server/db';
import { normalizedSnapshot, resolveAddressCandidates, pointInGeometry, type AddressSnapshot, type GeographyAddressCandidate, type GeographyReference, type GeographyResolution } from '@/shared/domain/analytics/geography';
import type { CanonicalOrder } from '@/shared/domain/analytics/businessAnalytics';

type Queryable = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;
type StoredResolution = {
  order_id: string; address_basis: string; address_fingerprint: string; official_address_id: string | null;
  municipality_id: string | null; region_id: string | null; resolution_status: GeographyResolution['status'];
  resolution_method: string; source_version: string; resolved_at: Date | string; manual_override: boolean;
};
export type GeographyArea = {
  id: string; code: string; name: string; level: 'municipality' | 'region'; regionId: string | null;
  orderCount: number; activityValue: number | null; knownValueOrders: number; distinctCustomers: number; mappedShare: number | null; municipalityResolvedOrders: number; regionOnlyOrders: number;
};
let staticReference: Promise<GeographyReference> | undefined;
export function getBundledGeography() {
  staticReference ??= readFile(join(process.cwd(), 'public', 'data', 'slovenia-geography.json'), 'utf8').then((text) => JSON.parse(text) as GeographyReference);
  return staticReference;
}
export function addressFingerprint(snapshot: AddressSnapshot) {
  return createHash('sha256').update(JSON.stringify(normalizedSnapshot(snapshot))).digest('hex');
}
export async function getReportingGeography(queryable?: Queryable) {
  const database = queryable ?? await getPool();
  const result = await database.query<{ render_geometry_json: GeographyReference | null; reporting_version: string | null; latest_version: string | null; last_error: string | null; last_success_at: Date | string | null }>(
    `select reference.render_geometry_json, state.reporting_version, state.latest_version, state.last_error, state.last_success_at
     from analytics_geography_state as state
     left join analytics_geography_references as reference on reference.version = state.reporting_version and reference.status = 'validated'
     where state.key = 'active'`
  );
  const row = result.rows[0];
  return { reference: row?.render_geometry_json ?? await getBundledGeography(), state: row ?? null };
}
function resolutionFromRow(row: StoredResolution): GeographyResolution {
  return { orderId: String(row.order_id), fingerprint: row.address_fingerprint, addressBasis: row.address_basis, officialAddressId: row.official_address_id, municipalityId: row.municipality_id, regionId: row.region_id, status: row.resolution_status, method: row.resolution_method, sourceVersion: row.source_version, resolvedAt: new Date(row.resolved_at).toISOString(), manual: row.manual_override };
}
const fullReferences = new Map<string, Promise<GeographyReference | null>>();
async function resolveOfficialPoint(candidate: GeographyAddressCandidate, reference: GeographyReference, database: Queryable) {
  if (candidate.easting == null || candidate.northing == null) return null;
  let fullPromise = fullReferences.get(reference.metadata.version);
  if (!fullPromise) {
    fullPromise = database.query<{ full_geometry_json: GeographyReference }>(
      "select full_geometry_json from analytics_geography_references where version = $1 and status = 'validated'", [reference.metadata.version]
    ).then((result) => result.rows[0]?.full_geometry_json ?? null);
    fullReferences.set(reference.metadata.version, fullPromise);
  }
  const full = await fullPromise;
  if (!full) { fullReferences.delete(reference.metadata.version); return null; }
  const { default: mapshaper } = await import('mapshaper');
  const output = await mapshaper.applyCommands('-i point.json -proj from=EPSG:3794 wgs84 -o point-result.json format=geojson', {
    'point.json': JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [candidate.easting, candidate.northing] }, properties: { id: 'official-centroid' } }] })
  });
  const point = JSON.parse(String(output['point-result.json'])).features[0].geometry.coordinates as [number, number];
  const matches = full.features.filter((feature) => feature.properties.level === 'municipality').map((feature) => ({ feature, relation: pointInGeometry(point, feature.geometry) })).filter((match) => match.relation !== 'outside');
  if (matches.length !== 1 || matches[0].relation === 'boundary') return { ambiguous: true as const };
  return { ambiguous: false as const, municipalityId: matches[0].feature.properties.id, regionId: matches[0].feature.properties.regionId };
}
export async function resolveSavedOrder(orderId: string, snapshot: AddressSnapshot, reference: GeographyReference, database: Queryable, requireSpatial = false): Promise<GeographyResolution> {
  const normalized = normalizedSnapshot(snapshot);
  let candidates: GeographyAddressCandidate[] = [];
  let truncated = false;
  if (normalized.countryCode === 'SI' && normalized.addressLine1 && normalized.city) {
    const matches = await database.query<{
      gurs_house_number_id: string; official_address_id: string | null; municipality_id: string | null; region_id: string | null;
      address_line_1: string; settlement_name: string; postal_name: string; postal_code: string; easting: number | string | null; northing: number | string | null; source_updated_at: Date | string | null; imported_at: Date | string | null;
    }>(`select gurs_house_number_id, official_address_id, municipality_id, region_id, address_line_1, settlement_name, postal_name, postal_code, easting, northing, source_updated_at, imported_at
       from gurs_addresses
       where gurs_house_number_id = nullif($1, '')
          or (search_text like '%' || $2 || '%' and ($3 = '' or postal_code = $3))
       order by gurs_house_number_id
       limit 101`, [normalized.gursHouseNumberId, normalized.addressLine1, normalized.postalCode]);
    truncated = matches.rows.length > 100;
    candidates = matches.rows.map((row) => ({ officialAddressId: row.official_address_id, houseNumberId: row.gurs_house_number_id, municipalityId: row.municipality_id, regionId: row.region_id, addressLine1: row.address_line_1, settlement: row.settlement_name, postalName: row.postal_name, postalCode: row.postal_code, easting: row.easting === null ? null : Number(row.easting), northing: row.northing === null ? null : Number(row.northing), sourceUpdatedAt: row.source_updated_at ? new Date(row.source_updated_at).toISOString() : null, importedAt: row.imported_at ? new Date(row.imported_at).toISOString() : null }));
  }
  let resolved = truncated ? { status: 'ambiguous' as const, candidate: null, method: 'too_many_exact_candidates' } : resolveAddressCandidates(snapshot, candidates);
  if (resolved.candidate && (requireSpatial || resolved.method === 'official_centroid_requires_spatial_join')) {
    const pointResult = await resolveOfficialPoint(resolved.candidate, reference, database);
    if (!pointResult || pointResult.ambiguous) resolved = { status: pointResult?.ambiguous ? 'ambiguous' : 'unmatched', candidate: null, method: pointResult ? 'centroid_on_boundary_or_multiple_areas' : 'full_reporting_geometry_or_centroid_unavailable' };
    else resolved = { status: 'municipality', candidate: { ...resolved.candidate, municipalityId: pointResult.municipalityId, regionId: pointResult.regionId }, method: 'official_centroid_in_full_reporting_boundaries' };
  }
  const municipalities = new Map(reference.features.filter((feature) => feature.properties.level === 'municipality').map((feature) => [feature.properties.id, feature.properties]));
  const regions = new Set(reference.features.filter((feature) => feature.properties.level === 'region').map((feature) => feature.properties.id));
  let municipalityId = resolved.candidate?.municipalityId ?? null;
  let regionId = resolved.candidate?.regionId ?? null;
  let status = resolved.status;
  let method = resolved.method;
  if (municipalityId) {
    const municipality = municipalities.get(municipalityId);
    if (municipality) regionId = municipality.regionId;
    else { municipalityId = null; regionId = null; status = 'unmatched'; method = 'area_missing_in_reporting_vintage'; }
  } else if (regionId && !regions.has(regionId)) {
    regionId = null; status = 'unmatched'; method = 'region_missing_in_reporting_vintage';
  }
  return {
    orderId, fingerprint: addressFingerprint(snapshot), addressBasis: 'delivery_customer_snapshot', status, method,
    municipalityId, regionId, officialAddressId: resolved.candidate?.officialAddressId ?? null,
    sourceVersion: reference.metadata.version, resolvedAt: new Date().toISOString(), manual: false, registrySourceVersion: resolved.candidate ? `rn-import:${resolved.candidate.importedAt ?? 'unknown'};record:${resolved.candidate.sourceUpdatedAt ?? 'unknown'}` : null
  };
}
export function aggregateGeography(records: CanonicalOrder[], resolutions: GeographyResolution[], reference: GeographyReference) {
  const resolutionById = new Map(resolutions.map((resolution) => [resolution.orderId, resolution]));
  const features = new Map(reference.features.map((feature) => [feature.properties.id, feature.properties]));
  const areaById = new Map(reference.features.map((feature) => [feature.properties.id, { ...feature.properties, orderCount: 0, cents: 0, knownValueOrders: 0, customerKeys: new Set<string>(), municipalityResolvedOrders: 0, regionOnlyOrders: 0 }]));
  const reconciliation = { allEligibleOrders: records.length, mappedSlovenianOrders: 0, unresolvedSlovenianOrders: 0, foreignOrders: 0, unknownCountryOrders: 0, regionOnlyResolvedOrders: 0 };
  const coverage = { resolvedOrders: 0, missingReferenceGeometry: 0, staleAddressResolutions: 0, otherVintageOrders: 0, unlinkedCustomerOrders: 0 };
  const unresolved: { id: string; number: string; status: string; method: string; href: string }[] = [];
  const membership = new Map<string, string[]>();
  function add(areaId: string, order: CanonicalOrder, regionOnly: boolean) {
    const area = areaById.get(areaId);
    if (!area) { coverage.missingReferenceGeometry++; return; }
    area.orderCount++;
    if (order.activityCents !== null) { area.cents += order.activityCents; area.knownValueOrders++; }
    if (order.customerKey) area.customerKeys.add(order.customerKey);
    if (regionOnly) area.regionOnlyOrders++; else area.municipalityResolvedOrders++;
    const ids = membership.get(areaId) ?? []; ids.push(order.id); membership.set(areaId, ids);
  }
  for (const order of records) {
    if (!order.customerKey) coverage.unlinkedCustomerOrders++;
    const country = normalizedSnapshot(order.addressSnapshot).countryCode;
    let resolution = resolutionById.get(order.id);
    if (resolution && resolution.fingerprint !== addressFingerprint(order.addressSnapshot)) { coverage.staleAddressResolutions++; resolution = undefined; }
    if (resolution && resolution.sourceVersion !== reference.metadata.version) { coverage.otherVintageOrders++; resolution = undefined; }
    if (!country) { reconciliation.unknownCountryOrders++; continue; }
    if (country !== 'SI') { reconciliation.foreignOrders++; continue; }
    if (resolution?.status === 'municipality' && resolution.municipalityId) {
      reconciliation.mappedSlovenianOrders++; coverage.resolvedOrders++;
      add(resolution.municipalityId, order, false);
      const regionId = features.get(resolution.municipalityId)?.regionId ?? resolution.regionId;
      if (regionId) add(regionId, order, false);
      continue;
    }
    reconciliation.unresolvedSlovenianOrders++;
    if (resolution?.status === 'region_only' && resolution.regionId) {
      reconciliation.regionOnlyResolvedOrders++;
      add(resolution.regionId, order, true);
    }
    unresolved.push({ id: order.id, number: order.number, status: resolution?.status ?? 'unmatched', method: resolution?.method ?? 'backfill_required', href: `/admin/orders/${order.id}` });
  }
  const areas: GeographyArea[] = [...areaById.values()].map((area) => ({
    id: area.id, code: area.code, name: area.name, level: area.level, regionId: area.regionId,
    orderCount: area.orderCount, activityValue: area.orderCount === 0 ? 0 : area.knownValueOrders !== area.orderCount ? null : area.cents / 100,
    knownValueOrders: area.knownValueOrders, distinctCustomers: area.customerKeys.size,
    mappedShare: reconciliation.mappedSlovenianOrders ? area.municipalityResolvedOrders / reconciliation.mappedSlovenianOrders : null,
    municipalityResolvedOrders: area.municipalityResolvedOrders, regionOnlyOrders: area.regionOnlyOrders
  }));
  return { areas, reconciliation, coverage, unresolved, membership };
}
export async function fetchGeography(params: URLSearchParams) {
  const { parseBusinessAsOf, parseBusinessFilters, fetchBusinessActivityRecords } = await import('@/shared/server/businessAnalytics');
  const filters = parseBusinessFilters(params);
  const asOf = parseBusinessAsOf(params.get('asOf'));
  const { period, records } = await fetchBusinessActivityRecords(filters, asOf);
  const database = await getPool();
  const [{ reference, state }, stored, addressSource] = await Promise.all([
    getReportingGeography(database),
    records.length ? database.query<StoredResolution>('select * from order_geography_resolutions where order_id = any($1::bigint[])', [records.map((order) => order.id)]) : Promise.resolve({ rows: [] as StoredResolution[] }),
    database.query<{ imported_at: string | Date | null; source_updated_at: string | Date | null; total: string; linked: string }>(
      `select sync.active_imported_at as imported_at, sync.active_source_updated_at as source_updated_at, sync.active_record_count::text as total,
       (select count(*)::text from gurs_addresses where municipality_id is not null) as linked
       from gurs_address_sync_state as sync where sync.key = 'active'`
    )
  ]);
  const { membership, ...summary } = aggregateGeography(records, stored.rows.map(resolutionFromRow), reference);
  const selectedId = params.get('area') ?? params.get('areaId');
  const selectedIds = new Set(selectedId ? membership.get(selectedId) ?? [] : []);
  const selectedRecords = selectedId ? records.filter((record) => selectedIds.has(record.id)) : [];
  return {
    asOf: asOf.toISOString(), period, filters, reference: { metadata: reference.metadata, assetUrl: '/api/admin/analytics/geography/boundaries', latestVersion: state?.latest_version ?? null, lastError: state?.last_error ?? null },
    ...summary, addressSource: addressSource.rows[0] ?? null,
    denominator: 'Delež naročil, razrešenih do občine, med vsemi slovenskimi naročili, razrešenimi do občine. Regijski dodatki so prikazani ločeno.',
    selected: selectedId ? { id: selectedId, total: selectedRecords.length, records: selectedRecords.slice(0, params.get('export') === 'orders' ? undefined : 50).map((order) => ({ id: order.id, number: order.number, date: order.submittedAt, customerType: order.customerType, customerName: order.customerName, status: order.status, source: order.source, value: order.activityCents === null ? null : order.activityCents / 100, href: `/admin/orders/${order.id}` })) } : null
  };
}
async function savedSnapshot(orderId: string, database: Queryable): Promise<AddressSnapshot> {
  const found = await database.query<{ snapshot: AddressSnapshot }>(
    `select case when jsonb_typeof(analytics_snapshot_json->'address') = 'object' then analytics_snapshot_json->'address'
       else jsonb_build_object('addressLine1', address_line1, 'addressLine2', address_line2, 'city', city, 'postalCode', postal_code, 'countryCode', country_code, 'gursHouseNumberId', gurs_house_number_id) end as snapshot
     from orders where id = $1`, [orderId]);
  if (!found.rows[0]) throw new Error('Naročilo ne obstaja.');
  return found.rows[0].snapshot;
}
async function storeResolution(database: Queryable, snapshot: AddressSnapshot, resolution: GeographyResolution, force = false) {
  await database.query(`insert into order_geography_resolutions (order_id, address_basis, address_fingerprint, address_snapshot_json, official_address_id, municipality_id, region_id, resolution_status, resolution_method, source_version, resolved_at, manual_override)
     values ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $11, $12)
     on conflict (order_id) do update set address_basis = excluded.address_basis, address_fingerprint = excluded.address_fingerprint, address_snapshot_json = excluded.address_snapshot_json,
       official_address_id = excluded.official_address_id, municipality_id = excluded.municipality_id, region_id = excluded.region_id,
       resolution_status = excluded.resolution_status, resolution_method = excluded.resolution_method, source_version = excluded.source_version, resolved_at = excluded.resolved_at, manual_override = excluded.manual_override
     where $13 or (not order_geography_resolutions.manual_override and order_geography_resolutions.resolution_status in ('unmatched', 'partial', 'ambiguous'))`,
    [resolution.orderId, resolution.addressBasis, resolution.fingerprint, JSON.stringify({ ...snapshot, _geographyRegistrySourceVersion: resolution.registrySourceVersion ?? null }), resolution.officialAddressId, resolution.municipalityId, resolution.regionId, resolution.status, resolution.method, resolution.sourceVersion, resolution.resolvedAt, resolution.manual, force]);
}
export async function correctGeography(input: { orderId: string; municipalityId?: string | null; regionId?: string | null; reason: string; remove?: boolean }) {
  if (!/^\d+$/.test(input.orderId) || !input.reason?.trim() || input.reason.length > 1000) throw new Error('Vnesite naročilo in razlog preverjenega popravka.');
  const client = await (await getPool()).connect();
  try {
    await client.query('begin');
    await client.query('select id from orders where id = $1 for update', [input.orderId]);
    const snapshot = await savedSnapshot(input.orderId, client);
    const { reference, state } = await getReportingGeography(client);
    const previous = await client.query<StoredResolution>('select * from order_geography_resolutions where order_id = $1 for update', [input.orderId]);
    let next: GeographyResolution;
    if (input.remove) next = await resolveSavedOrder(input.orderId, snapshot, reference, client, Boolean(state?.latest_version && state.latest_version !== reference.metadata.version));
    else {
      const municipality = reference.features.find((feature) => feature.properties.id === input.municipalityId && feature.properties.level === 'municipality')?.properties;
      const region = municipality?.regionId ?? input.regionId;
      if ((!municipality && !region) || !reference.features.some((feature) => feature.properties.id === region && feature.properties.level === 'region')) throw new Error('Izberite veljavno uradno občino ali regijo.');
      if (normalizedSnapshot(snapshot).countryCode !== 'SI') throw new Error('Geografski popravek je mogoč za shranjen slovenski naslov.');
      next = { orderId: input.orderId, fingerprint: addressFingerprint(snapshot), addressBasis: 'delivery_customer_snapshot', municipalityId: municipality?.id ?? null, regionId: region ?? null, officialAddressId: null, sourceVersion: reference.metadata.version, status: municipality ? 'municipality' : 'region_only', method: 'admin_verified_override', manual: true, resolvedAt: new Date().toISOString() };
    }
    await storeResolution(client, snapshot, next, true);
    await client.query(`insert into order_geography_audit (order_id, action, actor, reason, previous_json, next_json) values ($1, $2, 'authenticated_admin', $3, $4::jsonb, $5::jsonb)`, [input.orderId, input.remove ? 'remove_override' : 'verified_override', input.reason.trim(), JSON.stringify(previous.rows[0] ?? null), JSON.stringify(next)]);
    await client.query('commit');
    return next;
  } catch (error) { await client.query('rollback'); throw error; } finally { client.release(); }
}
export async function backfillGeography(options: { batchSize?: number; retryUnresolved?: boolean } = {}) {
  const batchSize = Math.max(1, Math.min(500, options.batchSize ?? 100));
  const client = await (await getPool()).connect();
  let locked = false;
  try {
    const lock = await client.query<{ acquired: boolean }>("select pg_try_advisory_lock(hashtext('analytics-geography-backfill')) as acquired");
    locked = lock.rows[0].acquired;
    if (!locked) return { status: 'skipped', processed: 0 };
    const { reference, state } = await getReportingGeography(client);
    const progress = await client.query<{ after_order_id: string }>('select after_order_id::text from analytics_geography_backfill where source_version = $1', [reference.metadata.version]);
    const pending = await client.query<{ id: string }> (
      `select orders.id::text as id from orders
       left join order_geography_resolutions as resolution on resolution.order_id = orders.id
       where not orders.is_draft and orders.deleted_at is null and (resolution.order_id is null or ($1 and not resolution.manual_override and resolution.resolution_status in ('unmatched', 'partial', 'ambiguous') and orders.id > $3))
       order by case when resolution.order_id is null then 0 else 1 end, orders.id limit $2`, [options.retryUnresolved ?? false, batchSize, progress.rows[0]?.after_order_id ?? '0']);
    let processed = 0;
    const lookupCache = new Map<string, Promise<GeographyResolution>>();
    for (const order of pending.rows) {
      const snapshot = await savedSnapshot(order.id, client);
      const fingerprint = addressFingerprint(snapshot);
      let lookup = lookupCache.get(fingerprint);
      if (!lookup) {
        lookup = resolveSavedOrder(order.id, snapshot, reference, client, Boolean(state?.latest_version && state.latest_version !== reference.metadata.version));
        lookupCache.set(fingerprint, lookup);
      }
      const resolution = { ...await lookup, orderId: order.id };
      await client.query('begin');
      await storeResolution(client, snapshot, resolution);
      await client.query(`insert into analytics_geography_backfill (source_version, after_order_id, processed_count) values ($1, $2, 1)
        on conflict (source_version) do update set after_order_id = excluded.after_order_id, processed_count = analytics_geography_backfill.processed_count + 1, updated_at = now()`, [reference.metadata.version, order.id]);
      await client.query('commit');
      processed++;
    }
    if (pending.rows.length < batchSize) {
      await client.query('update analytics_geography_backfill set after_order_id = 0, completed_at = now(), updated_at = now() where source_version = $1', [reference.metadata.version]);
    }
    return { status: 'succeeded', processed, remaining: pending.rows.length === batchSize, version: reference.metadata.version };
  } catch (error) { await client.query('rollback').catch(() => undefined); throw error; }
  finally { if (locked) await client.query("select pg_advisory_unlock(hashtext('analytics-geography-backfill'))").catch(() => undefined); client.release(); }
}
