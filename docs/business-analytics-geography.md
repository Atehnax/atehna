# Slovenia geography in business analytics

The map uses official GURS polygons and the same canonical submitted-order population, shared period, customer type, status, source and server `asOf` as the order activity heatmap. Values are merchandise after discounts, excluding VAT and shipping. An area's value is unavailable when any of its eligible orders lacks a value. Counts remain available.

## Verified reference, 5 September 2026

The checked-in reporting vintage is `gurs-7afdacabb0103851d8fec37e`. It contains 212 municipalities and 12 statistical regions, validated against the live service's `numberMatched`, rather than fixed importer constants. The most recent municipal `DATUM_SYS` is `2026-09-02T09:07:22Z`; the most recent statistical-region timestamp is `2025-10-09T15:09:28Z`. These are record-update timestamps, not a claim that every feature was updated on that date.

Official discovery and attribution:

- [GURS RPE metadata](https://eprostor.gov.si/imps/srv/api/records/25e80f41-8348-4759-bac1-ec56c7223509), metadata stamp 2026-06-07.
- [GURS Register naslovov](https://www.e-prostor.gov.si/podrocja/prostorske-enote-in-naslovi/register-naslovov/).
- [GURS public access and terms](https://www.e-prostor.gov.si/dostopi/javni-dostop/), CC BY 4.0; credit GURS, the data type and reference date, and identify this application's processing.
- [RPE OGC feature collections](https://ipi.eprostor.gov.si/wfs-si-gurs-rpe/ogc/features/collections?f=application%2Fjson).
- [RN OGC feature collections](https://ipi.eprostor.gov.si/wfs-si-gurs-rn/ogc/features/collections?f=application%2Fjson).

Verified WFS 2.0 services:

- `https://ipi.eprostor.gov.si/wfs-si-gurs-rpe/wfs`: `SI.GURS.RPE:OBCINE`, `SI.GURS.RPE:STATISTICNE_REGIJE`.
- `https://ipi.eprostor.gov.si/wfs-si-gurs-rn/wfs`: `SI.GURS.RN:REGISTER_NASLOVOV`.
- `DescribeFeatureType`, single-feature samples, source counts, sorted latest record queries and live imports were exercised. WFS advertises default CRS `urn:ogc:def:crs:EPSG::3794`, `CountDefault=20000`, paging support, and `PagingIsTransactionSafe=FALSE`. OGC paging returned `rel=next` links using `startIndex`.
- RN provides `EID_NASLOV`, `EID_HISNA_STEVILKA`, `EID_OBCINA`, `EID_STATISTICNA_REGIJA`, address components, `E`, `N` and `DATUM_SYS`. Its GeoJSON features have null geometry; the numeric E/N properties contain the address centroid in the declared native CRS.
- EIDs are 18-digit **strings**; JSON `FEATUREID` is an unsafe numeric alias and is never the canonical ID. Area `SIFRA` is a separate namespace and the source returns it as an integer; the application stores its textual representation. It never treats it as an EID or NUTS code, nor joins display names.

The existing autocomplete importer retains its building-address grain, `ST_STANOVANJA IS NULL`, and `EID_HISNA_STEVILKA` keyset pagination. The live extended import fetched **579,941** building addresses, exactly matching the filtered source count; all had municipality and region EIDs and E/N coordinates. The filtered source update timestamp was `2026-09-04T11:03:43.000Z`. The unfiltered RN sample reported 1,102,321 addresses, including apartments; it is deliberately not the expected autocomplete row count.

## Geometry processing and publication

The importer requests native EPSG:3794 polygons, derives each municipality's largest full-resolution regional overlap, and verifies that **no RN address in that municipality has a different or missing region EID**. All 212 relationships passed. It re-fetches boundary source records before publication to reject a reference that changed during import.

Mapshaper reprojects the declared native CRS to CRS84 longitude/latitude. It simplifies a common topology with a 60-metre interval and `keep-shapes`, retaining repair of newly introduced intersections. Validation rejects omitted units, parts or holes, duplicate IDs, wrong coordinate ranges, inconsistent crosswalks, or incomplete source counts.

- Browser asset: `public/data/slovenia-geography.json`, 1,210,393 bytes at initial generation.
- Server source archive: `data/geography/gurs-7afdacabb0103851d8fec37e.full.geojson.gz`.
- Full resolution: 658,547 vertices, 224 polygon parts and 4 holes.
- Render resolution: 53,532 vertices, the same 224 parts and 4 holes.
- Imported full and rendered geometries, metadata and content-derived version are stored in `analytics_geography_references`.
- Database staging, validation and active-state publication run transactionally under an advisory lock. A failure preserves the previous reporting reference and records an error. The static file is published using a temporary file and rename.
- A refresh records `latest_version` while retaining `reporting_version`. Only the first import initializes reporting. Historical orders are never silently reassigned after a source refresh. A new reporting vintage requires an explicit, reviewed reclassification migration; there is deliberately no automatic promotion.

The browser receives aggregates and simplified boundaries, never the national address registry or customer coordinates. Full geometry is retained outside `public`, and in the database.

## Saved addresses and attribution

This application currently has one saved address on an order and no independent delivery-address column. The selected basis is recorded as `delivery_customer_snapshot`: the order's captured address, never today's customer profile, school headquarters, shop or collection-point address. Legacy snapshots are disclosed by the canonical metric layer.

Matching first verifies a stored GURS house-number EID against the saved address. Otherwise it matches the normalized full address using the local official lookup. It handles Slovenian accents, case, repeated whitespace and attached/spaced house-number suffixes; addresses without street systems use settlement names. Postcodes only narrow candidates and never determine a municipality. Candidate limits are treated as ambiguity rather than selecting a truncated first result. Several exact candidates may resolve only when they all identify the same municipality; their resolution method discloses that level.

For missing relationships or a reporting vintage different from the newest reference, a trustworthy RN centroid is reprojected and tested against full-resolution reporting boundaries. Holes and shared-boundary ambiguities are explicit. An unavailable full reference or centroid stays unresolved.

The school directory is a generic imported cell table. Its existing municipality/region labels do not include a verified EID crosswalk or source version, and school/branch identity is not inherently an order link. Those labels are not promoted into authoritative geographic assignments. A verified manual correction is available in the geography controls; no school page redesign or postcode/name inference is introduced.

Each persisted result records selected basis, original address text, normalized SHA-256 fingerprint, official address ID where unique, municipality and region EIDs, status/method, boundary source version and timestamp. The address snapshot's `_geographyRegistrySourceVersion` stores RN import and record timestamps for lookup provenance. Administrative corrections record reason, actor, prior/new value and time in `order_geography_audit`. Overrides survive backfills and reference refreshes. Changed address fingerprints and other boundary vintages appear as unresolved coverage, rather than silently reusing stale attribution.

Region-only orders appear separately. The invariant is:

```
mapped municipality-resolved Slovenian orders
+ unresolved Slovenian orders (including region-only)
+ foreign orders
+ unknown-country orders
= all eligible orders
```

Region counts include their additional region-only orders, but each region's `municipalityResolvedOrders` equals the sum of its member municipalities. Mapped percentages use the common municipality-resolved Slovenian population. Missing rendering features are a separate error and do not discard mapped orders. Distinct-customer counts use stable canonical customer identifiers; unlinked customer coverage is explicit.

## Commands and access

Apply the additive migration with the application's normal migration workflow:

```
database/migrations/20260905_analytics_geography.sql
```

This is included in the canonical schema and schema contract v4 together with the business analytics migration.

With the intended database explicitly configured:

```sh
# Initialize the exact shipped reference without external access:
npm run geography:import -- --bundled

# Download and validate a new official reference candidate:
npm run geography:import

# Regenerate the local render/source artifacts after review:
npm run geography:import -- --assets-only

# Refresh the existing autocomplete lookup with added official geography fields:
npm run addresses:sync

# Resumable batch: at most 500 orders; rerun while remaining=true.
npm run geography:backfill

# Retry previously ambiguous/partial/unmatched records after improving evidence:
npm run geography:backfill -- --retry-unresolved

# Read-only full-reference and real-address consistency check:
npx tsx scripts/validate-geography.ts
```

Backfill is idempotent for existing resolutions and preserves manual overrides. A durable cursor advances through unresolved retries, and identical addresses reuse a lookup within each batch. It does not overwrite historical mappings merely because the latest reference changed.

Existing monthly address synchronization remains unchanged at `/api/admin/addresses/sync`. The existing Vercel scheduler adds `/api/admin/analytics/geography/refresh` at 05:00 UTC on day 2 monthly. Both proxy and route require the existing cron bearer secret. Refresh never gates checkout.

The daily `/api/admin/analytics/geography/process` job runs at 04:30 UTC. Each invocation performs one local batch of at most 100 orders, prioritizing orders without a resolution, then resuming retries of nonmanual unmatched, partial and ambiguous records. A remaining backlog continues on later runs or through the existing manual backfill command. The shared advisory lock prevents overlapping passes. The pinned reporting vintage, existing resolved history and manual corrections are preserved, including when a correction or resolution occurs after batch selection. This job does not fetch national data and does not gate checkout. The proxy and route independently require GET with the exact configured `CRON_SECRET` bearer; the response is not cached.

All aggregate, selection, CSV, correction, backfill, audit and boundary API routes are under existing admin-session proxy authorization. Corrections are PATCH and backfill is POST at `/api/admin/analytics/geography`. Read the audit at `/api/admin/analytics/geography/audit?orderId=...`. Selection is local through `area`/`areaId`; selected CSV and the normal filtered order list share that exact record set.

## Validation performed

- 13 focused geography unit checks: full-address ambiguity, accents/suffixes, branch address mismatch, foreign/unknown countries, missing value coverage, region-only reconciliation, stale overrides/vintages, missing render features, explicit zero/tied thresholds, holes and boundary ambiguities, and full/render unit topology completeness.
- 10 existing GURS normalization/query/cache/import safety checks passed after the additive importer change.
- TypeScript passed after geography integration (later shared changes are checked by the overall task).
- Genuine official boundary import and 579,941-record address synchronization succeeded against only the verified isolated local analytics UI database. No production database was mutated by this verification.
- Three actual imported suffix addresses produced exactly the same municipality/region through stored-ID matching and full-resolution centroid spatial matching.
- Backfill ran twice on the initially empty isolated UI database and processed zero orders both times. Order mapping coverage depends on the actual application records; reference coverage must not be presented as production order coverage.
