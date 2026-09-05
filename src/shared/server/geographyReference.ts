import { createHash } from 'node:crypto';
import { mkdir, rename, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import mapshaper from 'mapshaper';
import { getPool } from '@/shared/server/db';
import { validateReference, geometryVertexCount, polygonParts, type GeographyFeature, type GeographyReference, type PolygonGeometry } from '@/shared/domain/analytics/geography';

const RPE = 'https://ipi.eprostor.gov.si/wfs-si-gurs-rpe/wfs';
const RN = 'https://ipi.eprostor.gov.si/wfs-si-gurs-rn/wfs';
type SourceFeature = { geometry: PolygonGeometry; properties: Record<string, unknown> };
type SourceCollection = { numberMatched: number; numberReturned: number; features: SourceFeature[] };
function wfs(base: string, values: Record<string, string>) {
  const url = new URL(base);
  for (const [key, value] of Object.entries({ service: 'WFS', version: '2.0.0', request: 'GetFeature', ...values })) url.searchParams.set(key, value);
  return url;
}
async function readSource(url: URL, fetchImpl: typeof fetch) {
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(60_000), headers: { 'User-Agent': 'Atehna-geography-reference/1.0' } });
  if (!response.ok) throw new Error(`GURS returned HTTP ${response.status}.`);
  const text = await response.text();
  if (text.length > 100_000_000) throw new Error('GURS boundary response exceeds the import safety limit.');
  return text;
}
async function sourceBoundaries(layer: string, fetchImpl: typeof fetch) {
  const source = JSON.parse(await readSource(wfs(RPE, { typeNames: `SI.GURS.RPE:${layer}`, count: '1000', sortBy: 'SIFRA', srsName: 'EPSG:3794', outputFormat: 'application/json' }), fetchImpl)) as SourceCollection;
  if (!Array.isArray(source.features) || !source.features.length || source.features.length !== source.numberMatched || source.features.length !== source.numberReturned) throw new Error(`Incomplete official ${layer} response.`);
  const rawIds = source.features.map((feature) => feature.properties[layer === 'OBCINE' ? 'EID_OBCINA' : 'EID_STATISTICNA_REGIJA']);
  if (rawIds.some((id) => typeof id !== 'string')) throw new Error('GURS official EIDs must be transmitted as strings.');
  const ids = rawIds as string[];
  if (new Set(ids).size !== ids.length || ids.some((id) => !/^\d{18}$/.test(id))) throw new Error('Invalid official EID namespace.');
  return source;
}
async function checkCrosswalk(features: GeographyFeature[], fetchImpl: typeof fetch) {
  // Confirm every spatially-derived relationship against official RN relationships.
  // Count queries return no national address records and do not send customer addresses.
  const pending = [...features];
  let checked = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (;;) {
      const feature = pending.shift();
      if (!feature) return;
      const municipality = feature.properties.id;
      const region = feature.properties.regionId;
      if (!/^\d{18}$/.test(municipality) || !region || !/^\d{18}$/.test(region)) throw new Error('Invalid derived area relationship.');
      const url = wfs(RN, { typeNames: 'SI.GURS.RN:REGISTER_NASLOVOV', resultType: 'hits', cql_filter: `EID_OBCINA = '${municipality}' AND (EID_STATISTICNA_REGIJA IS NULL OR EID_STATISTICNA_REGIJA <> '${region}')` });
      const xml = await readSource(url, fetchImpl);
      const match = xml.match(/numberMatched=["'](\d+)["']/);
      if (!match || Number(match[1]) !== 0) throw new Error(`RN disagrees with municipality-region relationship ${municipality}.`);
      checked++;
    }
  }));
  if (checked !== features.length) throw new Error('Crosswalk validation was interrupted.');
}
export async function downloadGeographyReference(options: { fetchImpl?: typeof fetch } = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const [municipalitySource, regionSource] = await Promise.all([sourceBoundaries('OBCINE', fetchImpl), sourceBoundaries('STATISTICNE_REGIJE', fetchImpl)]);
  const sourceUpdatedAt = {
    municipalities: municipalitySource.features.map((feature) => String(feature.properties.DATUM_SYS)).sort().at(-1)!,
    regions: regionSource.features.map((feature) => String(feature.properties.DATUM_SYS)).sort().at(-1)!
  };
  const municipalityFeatures = municipalitySource.features.map((feature) => ({
    type: 'Feature', geometry: feature.geometry, properties: { id: String(feature.properties.EID_OBCINA), code: String(feature.properties.SIFRA), name: String(feature.properties.NAZIV), level: 'municipality', regionId: null }
  }));
  const regionFeatures = regionSource.features.map((feature) => ({
    type: 'Feature', geometry: feature.geometry, properties: { id: String(feature.properties.EID_STATISTICNA_REGIJA), code: String(feature.properties.SIFRA), name: String(feature.properties.NAZIV), level: 'region', regionId: String(feature.properties.EID_STATISTICNA_REGIJA) }
  }));
  const crosswalkOutput = await mapshaper.applyCommands(
    '-i municipalities.json -join regions.json fields=regionId largest-overlap force -o joined.json format=geojson',
    { 'municipalities.json': JSON.stringify({ type: 'FeatureCollection', features: municipalityFeatures }), 'regions.json': JSON.stringify({ type: 'FeatureCollection', features: regionFeatures }) }
  );
  const joinedMunicipalities = JSON.parse(String(crosswalkOutput['joined.json'])).features as GeographyFeature[];
  await checkCrosswalk(joinedMunicipalities, fetchImpl);
  const sourceJson = JSON.stringify({ type: 'FeatureCollection', features: [...joinedMunicipalities, ...regionFeatures] });
  const projected = await mapshaper.applyCommands('-i source.json -proj from=EPSG:3794 wgs84 -o full.json format=geojson', { 'source.json': sourceJson });
  const projectedJson = String(projected['full.json']);
  const version = `gurs-${createHash('sha256').update(sourceJson).digest('hex').slice(0, 24)}`;
  const metadata: GeographyReference['metadata'] = {
    version, importedAt: new Date().toISOString(), sourceUpdatedAt,
    attribution: `Geodetska uprava Republike Slovenije, Register prostorskih enot; občine ${sourceUpdatedAt.municipalities}, statistične regije ${sourceUpdatedAt.regions}. Predelava: Atehna.`,
    licence: 'CC BY 4.0', sourceCrs: 'EPSG:3794', renderCrs: 'OGC:CRS84',
    counts: { municipalities: municipalitySource.numberMatched, regions: regionSource.numberMatched },
    sources: [RPE, RN, 'https://eprostor.gov.si/imps/srv/api/records/25e80f41-8348-4759-bac1-ec56c7223509', 'https://www.e-prostor.gov.si/dostopi/javni-dostop/'],
    crosswalkMethod: 'Largest full-resolution polygon overlap, verified against all current RN municipality-region relationships with count-only queries.'
  };
  const full = validateReference({ ...JSON.parse(projectedJson), metadata } as GeographyReference);
  // All municipalities and regions share one topology during simplification.
  const simplified = await mapshaper.applyCommands('-i full.json -simplify interval=60 keep-shapes -o render.json format=geojson precision=0.000001', { 'full.json': projectedJson });
  const render = validateReference({ ...JSON.parse(String(simplified['render.json'])), metadata } as GeographyReference);
  const fullIds = new Set(full.features.map((feature) => feature.properties.id));
  if (render.features.length !== full.features.length || render.features.some((feature) => !fullIds.has(feature.properties.id))) throw new Error('Simplification omitted a geographic unit.');
  for (let index = 0; index < full.features.length; index++) {
    if (!geometryVertexCount(render.features[index].geometry)) throw new Error('Simplification removed polygon geometry.');
    const fullParts = polygonParts(full.features[index].geometry).map((polygon) => polygon.length).sort();
    const renderParts = polygonParts(render.features[index].geometry).map((polygon) => polygon.length).sort();
    if (JSON.stringify(fullParts) !== JSON.stringify(renderParts)) throw new Error('Simplification removed a polygon part or hole; retain the last-good asset and reduce the tolerance.');
  }
  // WFS paging is not transaction-safe: recheck source metadata before publication.
  const [municipalityAfter, regionAfter] = await Promise.all([sourceBoundaries('OBCINE', fetchImpl), sourceBoundaries('STATISTICNE_REGIJE', fetchImpl)]);
  if (JSON.stringify(municipalityAfter.features) !== JSON.stringify(municipalitySource.features) || JSON.stringify(regionAfter.features) !== JSON.stringify(regionSource.features)) throw new Error('GURS reference changed during import; last-good snapshot retained. Retry.');
  return { full, render };
}
export async function writeGeographyAssets(full: GeographyReference, render: GeographyReference, root = process.cwd()) {
  const publicDirectory = join(root, 'public', 'data');
  const archiveDirectory = join(root, 'data', 'geography');
  await mkdir(publicDirectory, { recursive: true });
  await mkdir(archiveDirectory, { recursive: true });
  await writeFile(join(archiveDirectory, `${full.metadata.version}.full.geojson.gz`), gzipSync(JSON.stringify(full)));
  const temporary = join(publicDirectory, `slovenia-geography.${render.metadata.version}.tmp`);
  await writeFile(temporary, JSON.stringify(render));
  await rename(temporary, join(publicDirectory, 'slovenia-geography.json'));
}
export async function importGeographyReference(options: { assetsOnly?: boolean; writeAssets?: boolean; bundled?: boolean } = {}) {
  const pool = options.assetsOnly ? null : await getPool();
  const client = pool ? await pool.connect() : null;
  let locked = false;
  try {
    if (client) {
      const lock = await client.query<{ acquired: boolean }>("select pg_try_advisory_lock(hashtext('analytics-geography-reference')) as acquired");
      locked = lock.rows[0].acquired;
      if (!locked) return { status: 'skipped', reason: 'Import already running.' };
      await client.query("update analytics_geography_state set last_attempt_at = now(), last_error = null where key = 'active'");
    }
    const bundledRender = options.bundled ? JSON.parse(await readFile(join(process.cwd(), 'public', 'data', 'slovenia-geography.json'), 'utf8')) as GeographyReference : null;
    if (bundledRender && !/^gurs-[a-f0-9]{24}$/.test(bundledRender.metadata.version)) throw new Error('Invalid bundled reference version.');
    const bundledFull = bundledRender ? JSON.parse(gunzipSync(await readFile(join(process.cwd(), 'data', 'geography', `${bundledRender.metadata.version}.full.geojson.gz`))).toString()) as GeographyReference : null;
    const { full, render } = bundledFull && bundledRender
      ? { full: validateReference(bundledFull), render: validateReference(bundledRender) }
      : await downloadGeographyReference();
    if (full.metadata.version !== render.metadata.version) throw new Error('Bundled full and rendering geometry versions differ.');
    if (client) {
      await client.query('begin');
      await client.query(`insert into analytics_geography_references (version, imported_at, metadata_json, full_geometry_json, render_geometry_json, status)
        values ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, 'staged')
        on conflict (version) do nothing`, [full.metadata.version, full.metadata.importedAt, JSON.stringify(full.metadata), JSON.stringify(full), JSON.stringify(render)]);
      await client.query("update analytics_geography_references set status = 'validated' where version = $1", [full.metadata.version]);
      // A reference refresh never silently reclassifies historical orders.
      await client.query(`update analytics_geography_state set latest_version = $1, reporting_version = coalesce(reporting_version, $1), last_success_at = now(), last_error = null where key = 'active'`, [full.metadata.version]);
      await client.query('commit');
    }
    if (options.assetsOnly || options.writeAssets) await writeGeographyAssets(full, render);
    return { status: 'succeeded', version: full.metadata.version, ...full.metadata.counts, sourceUpdatedAt: full.metadata.sourceUpdatedAt, reportingVintagePreserved: true };
  } catch (error) {
    if (client) {
      await client.query('rollback').catch(() => undefined);
      await client.query("update analytics_geography_state set last_error = $1 where key = 'active'", [error instanceof Error ? error.message.slice(0, 1000) : 'Import failed']).catch(() => undefined);
    }
    throw error;
  } finally {
    if (client && locked) await client.query("select pg_advisory_unlock(hashtext('analytics-geography-reference'))").catch(() => undefined);
    client?.release();
  }
}
