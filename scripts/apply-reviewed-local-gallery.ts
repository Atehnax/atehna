/** Reviewed local galleries only. No production target, upload, source-file deletion or canonical edits. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import sharp from 'sharp';
import { catalogTypeHash, resolveCatalogTypeTarget } from './reclassify-atehna-catalog';
import { protectedHashes, readState, type PhotoState } from './replace-atehna-generated-images';
import { isProtectedTechnicalImage } from './catalog-rejected-photos';
import { technicalImageSnapshot } from './delete-rejected-product-images';

type Row = Record<string, unknown>;
export type ReviewedLocalAsset = {
  id: string; slug: string; variantSkus: string[]; role: 'main' | 'detail' | 'diagram';
  blobUrl: string; mimeType: string; altText: string; sha256: string; imageType?: 'product' | 'context' | 'diagram';
  imageDimensions: { width: number; height: number; originalUrl?: string; originalWidth?: number; originalHeight?: number };
};
export type ReviewedLocalGallery = {
  version: 1; assets: ReviewedLocalAsset[]; coveredSkus: string[];
  sourceOriginals: Array<{ blobUrl: string; sha256: string; width: number; height: number }>;
  exclusions: Array<string | { sku?: string; variantSku?: string; variantSkus?: string[]; slug?: string }>;
  unresolvedSkus: string[];
};
const sid = (value: unknown) => String(value);
const same = (a: unknown, b: unknown) => catalogTypeHash(a) === catalogTypeHash(b);
const key = (row: Row) => sid(row.variant_id) + ':' + sid(row.media_id);
const source = (row: Row) => String(row.blob_url || row.external_url || '');
const gallery = (row: Row) => row.media_kind === 'image' && row.role === 'gallery';
const photo = (row: Row) => gallery(row) && !isProtectedTechnicalImage(row);
const omit = (row: Row, fields: string[]) => Object.fromEntries(Object.entries(row).filter(([name]) => !fields.includes(name)));
const hashBytes = (value: Buffer) => createHash('sha256').update(value).digest('hex');
function ensure(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function position(value: unknown) { const n = Number(value); ensure(Number.isInteger(n) && n >= -2147483648 && n <= 2147483647, 'Unsafe gallery position.'); return n; }
function unique(values: string[], label: string) { ensure(Array.isArray(values) && values.every(v => typeof v === 'string' && v.trim() === v && v.length > 0) && new Set(values).size === values.length, 'Invalid/duplicate ' + label); }
function localUrl(value: string) { ensure(/^\/images\/catalog\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+\.(?:png|jpe?g|webp|avif)$/u.test(value) && !value.includes('..'), 'Unsafe local image URL: ' + value); }
const roleRank = { main: 0, detail: 1, diagram: 2 };
const ordered = (assets: ReviewedLocalAsset[]) => assets.map((asset, index) => ({ asset, index })).sort((a, b) => roleRank[a.asset.role] - roleRank[b.asset.role] || a.index - b.index).map(entry => entry.asset);

export function validateReviewedLocalGallery(manifest: ReviewedLocalGallery) {
  ensure(manifest?.version === 1 && Array.isArray(manifest.assets) && manifest.assets.length && Array.isArray(manifest.coveredSkus) && Array.isArray(manifest.sourceOriginals) && Array.isArray(manifest.exclusions) && Array.isArray(manifest.unresolvedSkus), 'Expected version1 reviewed local gallery ledger.');
  unique(manifest.coveredSkus, 'covered SKUs'); unique(manifest.unresolvedSkus, 'unresolved SKUs'); unique(manifest.assets.map(a => a.id), 'asset IDs'); unique(manifest.assets.map(a => a.slug + '\n' + a.blobUrl), 'product image URLs');
  const excluded = new Set<string>();
  for (const entry of manifest.exclusions) {
    if (typeof entry === 'string') excluded.add(entry);
    else { ensure(entry && typeof entry === 'object', 'Invalid exclusion.'); const skus = [entry.sku, entry.variantSku, ...(entry.variantSkus ?? [])].filter(Boolean) as string[]; for (const sku of skus) excluded.add(sku); if (!skus.length && entry.slug) excluded.add(entry.slug); }
  }
  for (const sku of manifest.coveredSkus) ensure(!manifest.unresolvedSkus.includes(sku) && !excluded.has(sku) && !sku.startsWith('MAT-KOV-ALU-'), 'Covered SKU is excluded/unresolved/aluminium: ' + sku);
  for (const a of manifest.assets) {
    ensure(a.id.trim() && /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(a.slug) && !excluded.has(a.slug) && a.slug !== 'aluminijasta-plosca', 'Invalid/excluded asset identity.');
    unique(a.variantSkus, 'asset variant SKUs'); ensure(a.variantSkus.length && a.variantSkus.every(sku => manifest.coveredSkus.includes(sku)), 'Asset requires exact covered SKU bindings.');
    ensure(['main', 'detail', 'diagram'].includes(a.role) && a.altText?.trim(), 'Asset requires reviewed role and caption.');
    ensure(a.imageType === undefined || ['product', 'context', 'diagram'].includes(a.imageType), 'Invalid image type.');
    ensure(a.role !== 'main' || !a.imageType || a.imageType === 'product', 'Main must be a product view.'); localUrl(a.blobUrl);
    ensure(/^[a-f0-9]{64}$/u.test(a.sha256), 'Invalid asset SHA256.'); ensure(['image/png', 'image/jpeg', 'image/webp', 'image/avif'].includes(a.mimeType), 'Unsupported reviewed raster format.');
    ensure(Number.isInteger(a.imageDimensions?.width) && a.imageDimensions.width > 0 && Number.isInteger(a.imageDimensions.height) && a.imageDimensions.height > 0, 'Invalid reviewed dimensions.');
    if (a.imageDimensions.originalUrl) {
      localUrl(a.imageDimensions.originalUrl); const original = manifest.sourceOriginals.filter(o => o.blobUrl === a.imageDimensions.originalUrl);
      ensure(original.length === 1 && original[0].width === a.imageDimensions.originalWidth && original[0].height === a.imageDimensions.originalHeight, 'Original zoom identity/dimensions absent from sourceOriginals.');
    } else ensure(a.imageDimensions.originalWidth === undefined && a.imageDimensions.originalHeight === undefined, 'Original dimensions require originalUrl.');
  }
  for (const sku of manifest.coveredSkus) ensure(manifest.assets.filter(a => a.variantSkus.includes(sku) && a.role === 'main').length === 1, 'Exactly one main required for covered SKU: ' + sku);
  unique(manifest.sourceOriginals.map(o => o.blobUrl), 'source-original URLs');
  for (const o of manifest.sourceOriginals) { localUrl(o.blobUrl); ensure(/^[a-f0-9]{64}$/u.test(o.sha256) && Number.isInteger(o.width) && o.width > 0 && Number.isInteger(o.height) && o.height > 0, 'Invalid source-original metadata.'); }
}

/** Checks actual bytes, including individually reviewed exceptions and display crops, without changing them. */
export async function validateReviewedLocalFiles(manifest: ReviewedLocalGallery, root = process.cwd()) {
  validateReviewedLocalGallery(manifest); const publicRoot = await realpath(path.join(root, 'public'));
  const entries = [...manifest.assets.map(a => ({ blobUrl: a.blobUrl, sha256: a.sha256, width: a.imageDimensions.width, height: a.imageDimensions.height, mimeType: a.mimeType })), ...manifest.sourceOriginals];
  const checked = new Map<string, { identity: string; mime: string }>();
  for (const entry of entries) {
    const identity = catalogTypeHash({ sha256: entry.sha256, width: entry.width, height: entry.height }); const prior = checked.get(entry.blobUrl);
    if (prior?.identity === identity) { ensure(!('mimeType' in entry) || entry.mimeType === prior.mime, 'Duplicate reviewed format differs: ' + entry.blobUrl); continue; }
    const resolved = await realpath(path.join(publicRoot, entry.blobUrl.slice(1))); const relative = path.relative(publicRoot, resolved);
    ensure(relative && !relative.startsWith('..') && !path.isAbsolute(relative), 'Image escapes public root.');
    const bytes = await readFile(resolved); ensure(hashBytes(bytes) === entry.sha256, 'Reviewed bytes changed: ' + entry.blobUrl);
    const decoder = sharp(bytes, { failOn: 'error', limitInputPixels: 120_000_000 }); const m = await decoder.metadata();
    ensure(m.width === entry.width && m.height === entry.height, 'Reviewed dimensions changed: ' + entry.blobUrl);
    const mime = m.format === 'heif' && m.compression === 'av1' ? 'image/avif' : 'image/' + m.format;
    ensure(['image/png', 'image/jpeg', 'image/webp', 'image/avif'].includes(mime) && (!('mimeType' in entry) || entry.mimeType === mime), 'Reviewed format changed: ' + entry.blobUrl);
    await decoder.stats(); checked.set(entry.blobUrl, { identity, mime });
  }
  return { files: new Set(entries.map(e => e.blobUrl)).size };
}
function sortedMedia(state: PhotoState, itemId: unknown) { return state.media.filter(r => sid(r.item_id) === sid(itemId)).sort((a, b) => position(a.position) - position(b.position) || sid(a.id).localeCompare(sid(b.id), 'en', { numeric: true })); }
function visiblePhotos(state: PhotoState, variant: Row) {
  const rows = sortedMedia(state, variant.item_id).filter(r => photo(r) && !r.hidden);
  return [...rows.filter(r => state.assignments.some(l => sid(l.media_id) === sid(r.id) && sid(l.variant_id) === sid(variant.id))), ...rows.filter(r => !state.assignments.some(l => sid(l.media_id) === sid(r.id)))].map(r => sid(r.id));
}

export function planReviewedLocalGallery(before: PhotoState, manifest: ReviewedLocalGallery) {
  validateReviewedLocalGallery(manifest); const expected = structuredClone(before);
  const covered = manifest.coveredSkus.map(sku => { const matches = before.variants.filter(r => r.variant_sku === sku); ensure(matches.length === 1, 'Missing/ambiguous exact SKU: ' + sku); return matches[0]; });
  const coveredIds = new Set(covered.map(r => sid(r.id))); const affectedIds = new Set(covered.map(r => sid(r.item_id))); const assetRows = new Map<string, Row>(); const inserts: Row[] = []; const selected = ordered(manifest.assets);
  const minimum = new Map([...affectedIds].map(itemId => [itemId, Math.min(0, ...before.media.filter(r => sid(r.item_id) === itemId).map(r => position(r.position)))]));
  for (const a of selected) {
    const items = before.items.filter(r => r.slug === a.slug); ensure(items.length === 1 && items[0].status !== 'deleted', 'Missing/archived product: ' + a.slug); const item = items[0];
    ensure(a.variantSkus.every(sku => covered.some(v => v.variant_sku === sku && sid(v.item_id) === sid(item.id))), 'SKU does not belong to exact product: ' + a.id);
    const matches = before.media.filter(r => sid(r.item_id) === sid(item.id) && source(r) === a.blobUrl); ensure(matches.length <= 1, 'Ambiguous reviewed URL: ' + a.id);
    const fields = { media_kind: 'image', role: 'gallery', source_kind: 'upload', filename: path.posix.basename(a.blobUrl), blob_url: a.blobUrl, blob_pathname: null, external_url: null, mime_type: a.mimeType, video_type: null, hidden: false, alt_text: a.altText, image_type: a.role === 'diagram' ? 'dimension-diagram' : a.imageType ?? 'product', image_dimensions: a.imageDimensions };
    if (matches[0]) {
      ensure(Object.entries(fields).every(([name, value]) => same(matches[0][name], value)), 'Existing reviewed metadata changed: ' + a.id);
      ensure(before.assignments.filter(l => sid(l.media_id) === sid(matches[0].id)).every(l => covered.some(v => sid(v.id) === sid(l.variant_id) && a.variantSkus.includes(String(v.variant_sku)))), 'Reviewed source has unauthorized association: ' + a.id);
      assetRows.set(a.id, matches[0]);
    } else {
      const itemAssets = selected.filter(entry => entry.slug === a.slug); const row = { id: 'new-local:' + a.id, item_id: item.id, ...fields, position: position(minimum.get(sid(item.id))! - itemAssets.length + itemAssets.indexOf(a)) };
      assetRows.set(a.id, row); expected.media.push(row); inserts.push(row);
    }
  }
  const selectedIds = new Set([...assetRows.values()].map(r => sid(r.id)));
  // Convert old global photos to explicit uncovered bindings before deleting any obsolete row.
  for (const row of before.media.filter(r => affectedIds.has(sid(r.item_id)) && photo(r) && !selectedIds.has(sid(r.id)))) {
    const priorLinks = before.assignments.filter(l => sid(l.media_id) === sid(row.id));
    expected.assignments = expected.assignments.filter(l => !(sid(l.media_id) === sid(row.id) && coveredIds.has(sid(l.variant_id))));
    if (!priorLinks.length) for (const v of before.variants.filter(v => sid(v.item_id) === sid(row.item_id) && !coveredIds.has(sid(v.id)))) expected.assignments.push({ item_id: row.item_id, variant_id: v.id, media_id: row.id, position: position(row.position) });
    if (!expected.assignments.some(l => sid(l.media_id) === sid(row.id))) expected.media = expected.media.filter(r => sid(r.id) !== sid(row.id));
  }
  for (const v of covered) {
    const assets = selected.filter(a => a.variantSkus.includes(String(v.variant_sku)));
    const retained = before.assignments.filter(l => sid(l.variant_id) === sid(v.id) && !selectedIds.has(sid(l.media_id)) && before.media.some(r => sid(r.id) === sid(l.media_id) && isProtectedTechnicalImage(r)));
    const start = Math.min(0, ...retained.map(l => position(l.position))) - assets.length;
    for (let i = 0; i < assets.length; i++) {
      const row = assetRows.get(assets[i].id)!; const desired = { item_id: v.item_id, variant_id: v.id, media_id: row.id, position: position(start + i) }; const old = expected.assignments.find(l => key(l) === key(desired));
      // A targeted omission may leave gaps; retained associations must not be renumbered.
      if (old) position(old.position);
      else expected.assignments.push(desired);
    }
    const desiredIds = assets.map(a => sid(assetRows.get(a.id)!.id));
    const orderedLinks = expected.assignments.filter(l => sid(l.variant_id) === sid(v.id) && desiredIds.includes(sid(l.media_id))).sort((a, b) => position(a.position) - position(b.position) || sid(a.media_id).localeCompare(sid(b.media_id), 'en', { numeric: true }));
    ensure(same(orderedLinks.map(l => sid(l.media_id)), desiredIds), 'Existing reviewed association order changed: ' + v.variant_sku);
  }
  const priorTechnical = technicalImageSnapshot(before); const technicalIds = new Set(priorTechnical.media.map(r => sid(r.id)));
  ensure(same(priorTechnical, { media: expected.media.filter(r => technicalIds.has(sid(r.id))), assignments: expected.assignments.filter(l => technicalIds.has(sid(l.media_id))) }), 'Existing technical rows/metadata/links changed.');
  for (const v of before.variants.filter(r => !coveredIds.has(sid(r.id)))) ensure(same(visiblePhotos(before, v), visiblePhotos(expected, v)), 'Uncovered photo visibility/order would change: ' + v.variant_sku);
  for (const v of covered) ensure(same(visiblePhotos(expected, v), selected.filter(a => a.role !== 'diagram' && a.variantSkus.includes(String(v.variant_sku))).map(a => sid(assetRows.get(a.id)!.id))), 'Covered gallery differs from reviewed main/detail order: ' + v.variant_sku);
  const deletes = before.media.filter(r => !expected.media.some(n => sid(n.id) === sid(r.id)));
  const assignmentDeletes = before.assignments.filter(r => !expected.assignments.some(n => key(n) === key(r))); const assignmentInserts = expected.assignments.filter(r => !before.assignments.some(o => key(o) === key(r)));
  return { expected, inserts, deletes, assignmentDeletes, assignmentInserts, mutationCount: inserts.length + deletes.length + assignmentDeletes.length + assignmentInserts.length, planHash: catalogTypeHash({ before, manifest, inserts, deletes, assignmentDeletes, assignmentInserts }) };
}
export function verifyReviewedLocalGallery(before: PhotoState, after: PhotoState, plan: ReturnType<typeof planReviewedLocalGallery>, ids = new Map<string, string>()) {
  ensure(same(before.items, after.items) && same(before.variants, after.variants), 'Product/variant data changed.'); ensure(after.media.length === plan.expected.media.length && after.assignments.length === plan.expected.assignments.length, 'Unexpected final row count.');
  for (const expected of plan.expected.media) {
    const actual = after.media.find(r => sid(r.id) === (ids.get(sid(expected.id)) ?? sid(expected.id))); const fields = ids.has(sid(expected.id)) ? ['id', 'created_at', 'updated_at'] : [];
    ensure(actual && same(omit(expected, fields), omit(actual, fields)), 'Unexpected media metadata/order: ' + expected.id);
  }
  for (const expected of plan.expected.assignments) {
    const mapped = { ...expected, media_id: ids.get(sid(expected.media_id)) ?? expected.media_id }; const actual = after.assignments.find(r => key(r) === key(mapped)); const fields = plan.assignmentInserts.some(r => key(r) === key(expected)) ? ['media_id', 'created_at'] : ['media_id'];
    ensure(actual && same(omit(mapped, fields), omit(actual, fields)), 'Unexpected association/order: ' + key(mapped));
  }
}
/** Caller owns the transaction; deliberately leaves stored files and storage outbox unchanged. */
export async function applyReviewedLocalGallery(client: pg.PoolClient, plan: ReturnType<typeof planReviewedLocalGallery>) {
  const ids = new Map<string, string>();
  for (const row of plan.inserts) {
    const columns = Object.keys(row).filter(c => c !== 'id'); const result = await client.query(`insert into catalog_media (${columns.join(',')}) values (${columns.map((_, i) => '$' + (i + 1)).join(',')}) returning id`, columns.map(c => c === 'image_dimensions' ? JSON.stringify(row[c]) : row[c])); ids.set(sid(row.id), sid(result.rows[0].id));
  }
  for (const row of plan.assignmentDeletes) ensure((await client.query('delete from catalog_variant_media where variant_id=$1 and media_id=$2 returning media_id', [row.variant_id, row.media_id])).rowCount === 1, 'Association removal failed.');
  for (const row of plan.assignmentInserts) await client.query('insert into catalog_variant_media(item_id,variant_id,media_id,position) values($1,$2,$3,$4)', [row.item_id, row.variant_id, ids.get(sid(row.media_id)) ?? row.media_id, row.position]);
  for (const row of plan.deletes) ensure((await client.query('delete from catalog_media where id=$1 and item_id=$2 and not exists (select 1 from catalog_variant_media where media_id=$1) returning id', [row.id, row.item_id])).rowCount === 1, 'Obsolete photo remains referenced; removal refused.'); return ids;
}
async function snapshot(directory: string, name: string, value: unknown) {
  await mkdir(directory, { recursive: true }); const file = path.join(directory, name); const bytes = Buffer.from(JSON.stringify(value, null, 2) + '\n'); await writeFile(file, bytes, { flag: 'wx' }); ensure(bytes.equals(await readFile(file)), 'Snapshot verification failed.'); return file;
}
export async function runReviewedLocalGallery(args = process.argv.slice(2)) {
  let apply = false, expectedHash: string | undefined, manifestPath = 'data/catalog/reviewed-local-gallery-2026-09.json';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--apply') { ensure(!apply, 'Repeated --apply.'); apply = true; }
    else if (args[i] === '--expected-plan-hash') { ensure(!expectedHash && /^[a-f0-9]{64}$/u.test(args[i + 1] ?? ''), 'Expected reviewed plan hash.'); expectedHash = args[++i]; }
    else if (args[i] === '--manifest') { ensure(args[i + 1]?.endsWith('.json'), 'Expected JSON ledger.'); manifestPath = args[++i]; }
    else throw new Error('Unknown option; this script is local-only: ' + args[i]);
  }
  ensure(!apply || expectedHash, 'Apply requires --expected-plan-hash from reviewed dry-run.');
  const environment = parseEnv(await readFile('.env.development.local', 'utf8')); const target = resolveCatalogTypeTarget('local', environment.DATABASE_URL); ensure(!new URL(target.connectionString).search && !new URL(target.connectionString).hash, 'Local URL must not contain overrides.');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as ReviewedLocalGallery; const validated = await validateReviewedLocalFiles(manifest);
  const pool = new pg.Pool({ connectionString: target.connectionString, ssl: false, max: 1 }); const client = await pool.connect(); const directory = path.join('tmp/catalog-refinements', 'reviewed-local-gallery-' + new Date().toISOString().replace(/[:.]/gu, '-')); let inTransaction = false;
  try {
    await client.query('begin isolation level repeatable read read only'); inTransaction = true;
    const identity = (await client.query('select current_database() as database, host(inet_server_addr()) as address, inet_server_port() as port')).rows[0]; ensure(identity.database === target.database && identity.address === '127.0.0.1' && identity.port === 55434, 'Live identity differs from exact local target.');
    const before = await readState(client); const hashes = await protectedHashes(client); const outbox = (await client.query('select * from archive_blob_deletion_outbox order by id')).rows;
    const plan = planReviewedLocalGallery(before, manifest); const planHash = catalogTypeHash({ plan: plan.planHash, protectedHashes: hashes, outbox }); await client.query('rollback'); inTransaction = false;
    const summary = { target: 'local', database: target.database, manifestPath, planHash, coveredSkus: manifest.coveredSkus.length, validatedFiles: validated.files, mediaInserts: plan.inserts.length, mediaDeletes: plan.deletes.length, associationInserts: plan.assignmentInserts.length, associationDeletes: plan.assignmentDeletes.length, mutationCount: plan.mutationCount, protectedTechnicalImages: technicalImageSnapshot(before).media.length, storedFilesDeleted: 0 };
    if (!apply) { const review = await snapshot(directory, 'plan.json', { ...summary, inserts: plan.inserts, deletes: plan.deletes, assignmentInserts: plan.assignmentInserts, assignmentDeletes: plan.assignmentDeletes }); console.log(JSON.stringify({ ...summary, review })); return summary; }
    ensure(expectedHash === planHash, 'Reviewed plan changed; rerun dry-run.');
    const backup = await snapshot(directory, 'before.json', { before, protectedHashes: hashes, outbox, manifest, summary, rollback: 'Original rows/IDs/timestamps/links retained. No source bytes or storage-outbox changes.' });
    // Backup is durable before any write transaction begins; verify the state again under locks.
    await client.query('begin isolation level serializable'); inTransaction = true; await client.query("select pg_advisory_xact_lock(hashtext('atehna-reviewed-local-gallery'))"); const locked = await readState(client, true);
    ensure(same(before, locked) && same(hashes, await protectedHashes(client)) && same(outbox, (await client.query('select * from archive_blob_deletion_outbox order by id')).rows), 'Database changed after backup; nothing applied.');
    const ids = await applyReviewedLocalGallery(client, plan); const after = await readState(client); verifyReviewedLocalGallery(before, after, plan, ids);
    ensure(same(hashes, await protectedHashes(client)), 'Unrelated catalog/commerce data changed.'); ensure(same(outbox, (await client.query('select * from archive_blob_deletion_outbox order by id')).rows), 'Storage queue changed.'); ensure(planReviewedLocalGallery(after, manifest).mutationCount === 0, 'Repeat apply would not be idempotent.');
    await validateReviewedLocalFiles(manifest); await snapshot(directory, 'after.json', { after, insertedMediaIds: [...ids.values()], planHash, protectedHashes: hashes }); await client.query('commit'); inTransaction = false;
    const result = { ...summary, applied: true, backup, cacheRefreshRequired: 'Restart local app or invalidate catalog-public before storefront verification.' }; await snapshot(directory, 'verification.json', result); console.log(JSON.stringify(result)); return result;
  } finally { if (inTransaction) await client.query('rollback'); client.release(); await pool.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) runReviewedLocalGallery().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
