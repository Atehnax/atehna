import assert from 'node:assert/strict';
import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());
const { getPool } = await import('../src/shared/server/db');
const { getReportingGeography, resolveSavedOrder } = await import('../src/shared/server/geographyAnalytics');
const pool = await getPool();
try {
  const { reference } = await getReportingGeography(pool);
  const coverage = await pool.query(`select count(*)::integer as total, count(*) filter (where municipality_id is not null and region_id is not null)::integer as linked, count(*) filter (where easting is not null and northing is not null)::integer as centroids from gurs_addresses`);
  const samples = await pool.query<{ gurs_house_number_id: string; address_line_1: string; settlement_name: string; postal_code: string; municipality_id: string; region_id: string }>(`select gurs_house_number_id, address_line_1, settlement_name, postal_code, municipality_id, region_id from gurs_addresses where municipality_id is not null and region_id is not null and house_suffix is not null order by gurs_house_number_id limit 3`);
  assert.equal(samples.rows.length, 3, 'Import official addresses before reference validation.');
  for (const sample of samples.rows) {
    const address = { gursHouseNumberId: sample.gurs_house_number_id, addressLine1: sample.address_line_1, city: sample.settlement_name, postalCode: sample.postal_code, countryCode: 'SI' };
    const direct = await resolveSavedOrder('validation-only', address, reference, pool);
    assert.equal(direct.municipalityId, sample.municipality_id);
    assert.equal(direct.regionId, sample.region_id);
    const spatial = await resolveSavedOrder('validation-only', address, reference, pool, true);
    assert.equal(spatial.municipalityId, direct.municipalityId);
    assert.equal(spatial.regionId, direct.regionId);
    assert.equal(spatial.method, 'official_centroid_in_full_reporting_boundaries');
  }
  process.stdout.write(JSON.stringify({ sourceVersion: reference.metadata.version, addressCoverage: coverage.rows[0], verifiedDirectAndSpatialSamples: samples.rows.length, writes: 0 }) + '\n');
} finally { await pool.end(); }
