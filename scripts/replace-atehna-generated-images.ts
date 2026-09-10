/** Replace explicitly reviewed catalog illustrations with real photographs. Dry-run unless --apply. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import sharp from 'sharp';
import { catalogTypeHash, parseCatalogTypeArgs, resolveCatalogTypeTarget } from './reclassify-atehna-catalog';
import { matchImageUpgradeVariant, matchRetainedImageVariant, planReviewedImagePositions } from './upgrade-atehna-catalog-images';

type Row = Record<string, unknown>;
type Dimensions = { length: number; width: number; thickness: number };
export type RealPhoto = {
  id: string; blobUrl: string; sourceUrl: string; sourcePage: string; kind: string;
  dimensions: { width: number; height: number }; sha256: string; altText: string;
  variantIndices: number[]; contextOnly: boolean; visuallyVerified: boolean; notes: string;
  retainedVariantDimensions?: Dimensions[];
  removeExistingVariantIndices?: number[];
};
export type RealPhotoProduct = { slug: string; photos: RealPhoto[]; removeBlobUrls: string[] };
export type RealPhotoSource = {
  slug: string;
  variants: Array<{ variantName: string; variantSku: string; length?: number; width?: number; thickness?: number }>;
  media?: Array<{ blobUrl?: string; externalUrl?: string }>;
};
export type HistoricalPhotoProduct = {
  slug: string; additions?: Row[]; currentMediaAudit?: Row[];
  variantAssignments?: Array<{ originalIndex: number; oldSku: string }>;
};
export type PhotoState = { items: Row[]; variants: Row[]; media: Row[]; assignments: Row[] };
type PhotoPlan = {
  products: Array<{ slug: string; itemId: string; variantIds: string[]; photos: Array<{ photo: RealPhoto; mediaId: string; targetIds: string[]; removeTargetIds: string[]; general: boolean }>; rejectedIds: string[] }>;
  mediaInserts: Row[];
  mediaUpdates: Array<{ id: string; itemId: string; changes: Row }>;
  assignmentDeletes: Row[];
  assignmentUpserts: Row[];
  changedItemIds: string[];
};
const METALS = new Set(['aluminijasta-plosca', 'bakrena-plosca', 'medeninasta-plosca', 'pocinkana-plocevina']);
const MANIFESTS = ['materials', 'tools', 'metals'].map(group => `data/catalog/real-photo-${group}-2026-09.json`);
const id = (value: unknown) => String(value);
const urlOf = (row: Row) => String(row.blob_url || row.external_url || '');
const galleryImage = (row: Row) => row.media_kind === 'image' && row.role === 'gallery';
const assignmentKey = (row: Row) => `${row.variant_id}:${row.media_id}`;
const omit = (row: Row, keys: string[]) => Object.fromEntries(Object.entries(row).filter(([key]) => !keys.includes(key)));
const same = (left: unknown, right: unknown) => catalogTypeHash({ value: left }) === catalogTypeHash({ value: right });
function ensure(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const ordered = (rows: Row[]) => [...rows].sort((left, right) => Number(left.position) - Number(right.position) || id(left.id ?? left.media_id).localeCompare(id(right.id ?? right.media_id), 'en', { numeric: true }));
const isClearPhoto = (photo: RealPhoto) => !photo.contextOnly && !/swatch/i.test(photo.kind);
const isGeneral = (photo: RealPhoto) => photo.variantIndices.length === 0 && !(photo.retainedVariantDimensions?.length);
const photoOrder = (photos: RealPhoto[]) => [...photos].sort((left, right) => Number(!isClearPhoto(left)) - Number(!isClearPhoto(right)));

/** Historical manifests establish provenance only; they never drive a new assignment or automatic removal. */
export function realPhotoProvenance(history: HistoricalPhotoProduct[]) {
  const knownUrls = new Map<string, Set<string>>();
  const generatedUrls = new Set<string>();
  const generatedHashes = new Set<string>();
  for (const product of history) {
    const entries = [...product.currentMediaAudit ?? [], ...product.additions ?? []];
    knownUrls.set(product.slug, new Set(entries.map(entry => String(entry.blobUrl ?? '')).filter(Boolean)));
    for (const entry of entries) {
      // The seven original metal illustrations have now also been explicitly superseded by real photographs.
      const originalMetalIllustration = METALS.has(product.slug) && /user-source/i.test(String(entry.quality));
      if (!originalMetalIllustration && !entry.generation && !/generated|illustration|render/i.test(String(entry.kind ?? '') + ' ' + String(entry.quality ?? ''))) continue;
      if (entry.blobUrl) generatedUrls.add(String(entry.blobUrl));
      if (entry.sha256) generatedHashes.add(String(entry.sha256).toLowerCase());
    }
  }
  return { knownUrls, generatedUrls, generatedHashes };
}

export function validateRealPhotoManifest(products: RealPhotoProduct[], source: RealPhotoSource[], history: HistoricalPhotoProduct[]) {
  ensure(products.length > 0 && new Set(products.map(product => product.slug)).size === products.length, 'Real-photo manifests must contain distinct products.');
  const provenance = realPhotoProvenance(history);
  for (const product of products) {
    const original = source.find(entry => entry.slug === product.slug);
    ensure(original, `Unknown catalog product: ${product.slug}`);
    ensure(Array.isArray(product.photos) && product.photos.length > 0 && Array.isArray(product.removeBlobUrls), `Missing photo/removal list: ${product.slug}`);
    ensure(new Set(product.photos.map(photo => photo.id)).size === product.photos.length, `Duplicate photo ID: ${product.slug}`);
    ensure(new Set(product.photos.map(photo => photo.blobUrl)).size === product.photos.length, `Duplicate photo URL: ${product.slug}`);
    ensure(new Set(product.removeBlobUrls).size === product.removeBlobUrls.length, `Duplicate rejected URL: ${product.slug}`);
    const knownUrls = new Set([...provenance.knownUrls.get(product.slug) ?? [], ...original.media?.flatMap(media => [media.blobUrl, media.externalUrl].filter((url): url is string => Boolean(url))) ?? []]);
    for (const url of product.removeBlobUrls) {
      ensure(knownUrls.has(url), `Removal has no historical provenance: ${product.slug}/${url}`);
      ensure(!product.photos.some(photo => photo.blobUrl === url), `Photo is both selected and rejected: ${url}`);
    }
    for (const photo of product.photos) {
      ensure(typeof photo.id === 'string' && photo.id.trim() && photo.visuallyVerified === true, `Unreviewed real photo: ${product.slug}`);
      ensure(typeof photo.kind === 'string' && photo.kind.trim() && !/generated|illustration|render/i.test(photo.kind), `Synthetic photo kind is forbidden: ${photo.id}`);
      ensure(/^\/images\/catalog\/2026-09\/[a-z0-9-]+\.(?:png|jpe?g|webp|avif|gif)$/i.test(photo.blobUrl), `Unsafe photo asset path: ${photo.blobUrl}`);
      ensure(typeof photo.sha256 === 'string' && /^[a-f0-9]{64}$/i.test(photo.sha256), `Invalid native photo checksum: ${photo.id}`);
      ensure(!provenance.generatedUrls.has(photo.blobUrl) && !provenance.generatedHashes.has(photo.sha256.toLowerCase()), `Known synthetic asset cannot be relabeled as a source photo: ${photo.id}`);
      ensure(typeof photo.altText === 'string' && photo.altText.trim() && typeof photo.notes === 'string' && photo.notes.trim(), `Missing photo review or alt text: ${photo.id}`);
      ensure(typeof photo.contextOnly === 'boolean', `Missing explicit context classification: ${photo.id}`);
      ensure(photo.dimensions && [photo.dimensions.width, photo.dimensions.height].every(value => Number.isSafeInteger(value) && value > 0), `Invalid native dimensions: ${photo.id}`);
      for (const sourceUrl of [photo.sourceUrl, photo.sourcePage]) {
        let parsed: URL; try { parsed = new URL(sourceUrl); } catch { throw new Error(`Invalid source URL: ${photo.id}`); }
        ensure(['https:', 'http:'].includes(parsed.protocol) && !parsed.username && !parsed.password, `Invalid source URL: ${photo.id}`);
      }
      ensure(Array.isArray(photo.variantIndices) && new Set(photo.variantIndices).size === photo.variantIndices.length && photo.variantIndices.every(index => Number.isSafeInteger(index) && index >= 0 && Boolean(original.variants[index])), `Invalid canonical variant index: ${product.slug}/${photo.id}`);
      const removalIndices = photo.removeExistingVariantIndices ?? [];
      ensure(Array.isArray(removalIndices) && new Set(removalIndices).size === removalIndices.length && removalIndices.every(index => Number.isSafeInteger(index) && index >= 0 && Boolean(original.variants[index])), `Invalid removal variant index: ${product.slug}/${photo.id}`);
      ensure(removalIndices.every(index => !photo.variantIndices.includes(index)), `Photo variant is both selected and removed: ${product.slug}/${photo.id}`);
      ensure(photo.retainedVariantDimensions === undefined || Array.isArray(photo.retainedVariantDimensions), `Invalid retained dimensions: ${photo.id}`);
      for (const dimensions of photo.retainedVariantDimensions ?? []) {
        ensure(METALS.has(product.slug) && ['length', 'width', 'thickness'].every(key => typeof dimensions[key as keyof Dimensions] === 'number' && Number.isFinite(dimensions[key as keyof Dimensions]) && dimensions[key as keyof Dimensions] > 0), `Invalid retained metal dimensions: ${photo.id}`);
      }
    }
  }
}

/** Match canonical identities before planning any image mutation; never match SKU or row position alone. */
export function planRealPhotoReplacement(products: RealPhotoProduct[], source: RealPhotoSource[], history: HistoricalPhotoProduct[], state: PhotoState, mimeByUrl: Map<string, string>): PhotoPlan {
  validateRealPhotoManifest(products, source, history);
  const plan: PhotoPlan = { products: [], mediaInserts: [], mediaUpdates: [], assignmentDeletes: [], assignmentUpserts: [], changedItemIds: [] };
  const changed = new Set<string>();
  const syntheticUrls = realPhotoProvenance(history).generatedUrls;
  for (const product of products) {
    const matches = state.items.filter(item => item.slug === product.slug);
    ensure(matches.length === 1 && matches[0].status !== 'deleted', `Missing or archived article: ${product.slug}`);
    const itemId = id(matches[0].id);
    const variants = state.variants.filter(variant => id(variant.item_id) === itemId);
    ensure(variants.length, `Article has no variants: ${product.slug}`);
    const original = source.find(entry => entry.slug === product.slug)!;
    const historical = history.find(entry => entry.slug === product.slug);
    const canonical = new Map<number, string>();
    for (const index of new Set(product.photos.flatMap(photo => [...photo.variantIndices, ...photo.removeExistingVariantIndices ?? []]))) {
      const expected = original.variants[index];
      const variant = matchImageUpgradeVariant({ originalIndex: index, variantName: expected.variantName, oldSku: historical?.variantAssignments?.find(assignment => assignment.originalIndex === index)?.oldSku ?? expected.variantSku, addImageIds: [] }, original, variants);
      ensure(![...canonical.values()].includes(id(variant.id)), `Canonical variants resolve to the same row: ${product.slug}`);
      if (METALS.has(product.slug)) ensure(['length', 'width', 'thickness'].every(key => Number(variant[key]) === original.variants[index][key as keyof Dimensions]), `Canonical metal dimensions changed: ${product.slug}/${index}`);
      canonical.set(index, id(variant.id));
    }
    const currentMedia = state.media.filter(media => id(media.item_id) === itemId);
    const photos = photoOrder(product.photos).flatMap(photo => {
      const targetIds = new Set(photo.variantIndices.map(index => canonical.get(index)!));
      for (const dimensions of photo.retainedVariantDimensions ?? []) {
        const physicalMatches = variants.filter(variant => Object.entries(dimensions).every(([key, value]) => Number(variant[key]) === value));
        if (!physicalMatches.length) continue; // A reviewed retained format need not exist in both environments.
        targetIds.add(id(matchRetainedImageVariant({ target: 'production', dimensions, addImageIds: [] }, variants).id));
      }
      const removeTargetIds = (photo.removeExistingVariantIndices ?? []).map(index => canonical.get(index)!);
      ensure(removeTargetIds.every(variantId => !targetIds.has(variantId)), `Photo target is both retained and removed: ${product.slug}/${photo.id}`);
      const general = isGeneral(photo);
      if (!general && !targetIds.size) return []; // A retained-only photo is irrelevant where that format does not exist.
      const reused = currentMedia.filter(media => urlOf(media) === photo.blobUrl);
      ensure(reused.length <= 1 && reused.every(galleryImage), `Photo URL is ambiguous or belongs to non-image media: ${product.slug}/${photo.blobUrl}`);
      const mediaId = reused.length ? id(reused[0].id) : `new:${itemId}:${photo.id}`;
      const existingLinks = state.assignments.filter(link => id(link.media_id) === mediaId);
      ensure(general || existingLinks.every(link => targetIds.has(id(link.variant_id)) || removeTargetIds.includes(id(link.variant_id))), `Reviewed photo has an unreviewed existing variant assignment: ${product.slug}/${photo.id}`);
      return [{ photo, mediaId, targetIds: [...targetIds], removeTargetIds, general }];
    });
    const rejected = currentMedia.filter(media => product.removeBlobUrls.includes(urlOf(media)));
    ensure(rejected.every(galleryImage), `Rejected URL belongs to non-image media: ${product.slug}`);
    const rejectedIds = new Set(rejected.map(media => id(media.id)));
    const generalIds = new Set(photos.filter(entry => entry.general).map(entry => entry.mediaId));
    const photoPositions = planReviewedImagePositions(photos.map(entry => entry.photo), currentMedia.filter(galleryImage).map(media => ({ ...media, blob_url: urlOf(media) })));
    for (const entry of photos) {
      const position = photoPositions.find(value => value.addition.blobUrl === entry.photo.blobUrl)!.position;
      const fields = { mime_type: mimeByUrl.get(entry.photo.blobUrl), alt_text: entry.photo.altText, image_dimensions: entry.photo.dimensions, image_type: entry.photo.contextOnly ? 'context' : 'product', hidden: false, position };
      ensure(fields.mime_type, `Missing validated native MIME type: ${entry.photo.id}`);
      const existing = currentMedia.find(media => id(media.id) === entry.mediaId);
      if (existing) {
        const changes = Object.fromEntries(Object.entries(fields).filter(([key, value]) => !same(existing[key], value)));
        if (Object.keys(changes).length) { plan.mediaUpdates.push({ id: entry.mediaId, itemId, changes }); changed.add(itemId); }
      } else {
        plan.mediaInserts.push({ id: entry.mediaId, item_id: itemId, media_kind: 'image', role: 'gallery', source_kind: 'upload', filename: path.posix.basename(entry.photo.blobUrl), blob_url: entry.photo.blobUrl, blob_pathname: null, external_url: null, video_type: null, ...fields });
        changed.add(itemId);
      }
    }
    for (const media of rejected) if (media.hidden !== true) {
      plan.mediaUpdates.push({ id: id(media.id), itemId, changes: { hidden: true } }); changed.add(itemId);
    }
    for (const variant of variants) {
      const current = ordered(state.assignments.filter(link => id(link.variant_id) === id(variant.id)));
      const removed = current.filter(link => rejectedIds.has(id(link.media_id)) || generalIds.has(id(link.media_id)) || photos.some(entry => entry.mediaId === id(link.media_id) && entry.removeTargetIds.includes(id(variant.id))));
      plan.assignmentDeletes.push(...removed);
      const wanted = photos.filter(entry => entry.targetIds.includes(id(variant.id))).map(entry => entry.mediaId);
      if (!wanted.length && !removed.length) continue;
      const remaining = current.filter(link => !removed.includes(link));
      const nextIds = [...new Set([...wanted, ...remaining.map(link => id(link.media_id))])];
      for (const [position, mediaId] of nextIds.entries()) {
        const existing = remaining.find(link => id(link.media_id) === mediaId);
        if (!existing || Number(existing.position) !== position) {
          plan.assignmentUpserts.push({ variant_id: id(variant.id), item_id: itemId, media_id: mediaId, position }); changed.add(itemId);
        }
      }
      if (removed.length) changed.add(itemId);
    }
    plan.products.push({ slug: product.slug, itemId, variantIds: variants.map(variant => id(variant.id)), photos, rejectedIds: [...new Set([...rejectedIds, ...currentMedia.filter(media => syntheticUrls.has(urlOf(media))).map(media => id(media.id))])] });
  }
  plan.changedItemIds = [...changed];
  verifyRealPhotoCoverage(plan, simulateRealPhotoPlan(state, plan));
  return plan;
}

/** Pure projection also makes the repeat/no-op and preservation contract testable without a database. */
export function simulateRealPhotoPlan(state: PhotoState, plan: PhotoPlan, insertedIds = new Map<string, string>()): PhotoState {
  const resolve = (value: unknown) => insertedIds.get(id(value)) ?? value;
  const media = state.media.map(row => ({ ...row, ...plan.mediaUpdates.find(update => update.id === id(row.id))?.changes }));
  media.push(...plan.mediaInserts.map(row => ({ ...row, id: resolve(row.id) })));
  const removed = new Set(plan.assignmentDeletes.map(assignmentKey));
  const assignments = state.assignments.filter(row => !removed.has(assignmentKey(row))).map(row => ({ ...row }));
  for (const row of plan.assignmentUpserts) {
    const next: Row = { ...row, media_id: resolve(row.media_id) };
    const existing = assignments.find(entry => assignmentKey(entry) === assignmentKey(next));
    if (existing) existing.position = next.position; else assignments.push(next);
  }
  return { items: state.items, variants: state.variants, media, assignments };
}

export function verifyRealPhotoCoverage(plan: PhotoPlan, actual: PhotoState, insertedIds = new Map<string, string>()) {
  for (const product of plan.products) {
    const media = actual.media.filter(row => id(row.item_id) === product.itemId);
    for (const rejectedId of product.rejectedIds) {
      ensure(media.find(row => id(row.id) === rejectedId)?.hidden === true, `Rejected image remains visible: ${product.slug}/${rejectedId}`);
      ensure(!actual.assignments.some(link => id(link.media_id) === rejectedId), `Rejected image remains assigned: ${product.slug}/${rejectedId}`);
    }
    for (const variantId of product.variantIds) {
      const covered = product.photos.filter(entry => isClearPhoto(entry.photo)).some(entry => {
        const mediaId = insertedIds.get(entry.mediaId) ?? entry.mediaId;
        const photo = media.find(row => id(row.id) === mediaId);
        if (!photo || photo.hidden === true || !galleryImage(photo)) return false;
        const links = actual.assignments.filter(link => id(link.media_id) === mediaId);
        return links.length === 0 ? entry.general : links.some(link => id(link.variant_id) === variantId);
      });
      ensure(covered, `No reviewed clear visible photograph for variant: ${product.slug}/${variantId}`);
    }
  }
}

export function verifyRealPhotoPreservation(before: PhotoState, after: PhotoState, plan: PhotoPlan, insertedIds = new Map<string, string>()) {
  const expected = simulateRealPhotoPlan(before, plan, insertedIds);
  ensure(before.items.length === after.items.length, 'Article row count changed.');
  for (const item of before.items) {
    const actual = after.items.find(row => id(row.id) === id(item.id));
    const ignored = plan.changedItemIds.includes(id(item.id)) ? ['updated_at'] : [];
    ensure(actual && same(omit(item, ignored), omit(actual, ignored)), `Article fields changed: ${item.id}`);
  }
  ensure(same(before.variants, after.variants), 'Variant rows, prices, stock or physical measurements changed.');
  ensure(expected.media.length === after.media.length, 'Unexpected media row count.');
  const inserted = new Set([...insertedIds.values(), ...plan.mediaInserts.map(row => id(row.id))]);
  for (const row of expected.media) {
    const actual = after.media.find(entry => id(entry.id) === id(row.id));
    ensure(actual, `Media row was removed: ${row.id}`);
    if (inserted.has(id(row.id))) {
      for (const [key, value] of Object.entries(row)) ensure(same(key.endsWith('_id') || key === 'id' ? id(actual[key]) : actual[key], key.endsWith('_id') || key === 'id' ? id(value) : value), `Inserted media differs: ${row.id}/${key}`);
    } else {
      const ignored = plan.mediaUpdates.some(update => update.id === id(row.id)) ? ['updated_at'] : [];
      ensure(same(omit(row, ignored), omit(actual, ignored)), `Unreviewed media field changed: ${row.id}`);
    }
  }
  ensure(expected.assignments.length === after.assignments.length, 'Unexpected image assignment row count.');
  for (const row of expected.assignments) {
    const actual = after.assignments.find(entry => assignmentKey(entry) === assignmentKey(row));
    ensure(actual, `Image assignment was removed: ${assignmentKey(row)}`);
    if (before.assignments.some(entry => assignmentKey(entry) === assignmentKey(row))) ensure(same(row, actual), `Existing image assignment fields changed: ${assignmentKey(row)}`);
    else for (const key of ['variant_id', 'item_id', 'media_id', 'position']) ensure(id(row[key]) === id(actual[key]), `New image assignment differs: ${assignmentKey(row)}/${key}`);
  }
  verifyRealPhotoCoverage(plan, after, insertedIds);
}

const PROTECTED_TABLES = [
  'catalog_item_editor_details', 'catalog_categories', 'catalog_option_axes', 'catalog_option_values',
  'catalog_variant_option_values', 'catalog_item_quantity_discounts', 'catalog_item_slug_aliases',
  'catalog_supplier_rows', 'pricing_stock_history', 'pricing_stock_model',
  'orders', 'order_items', 'order_line_snapshots', 'order_stock_holds', 'order_historical_changes',
  'quote_requests', 'quote_request_items', 'quote_offer_versions', 'quote_offer_version_items', 'quote_offer_acceptances'
] as const;
async function protectedHashes(client: pg.PoolClient) {
  const hashes: Record<string, string | null> = {};
  for (const table of PROTECTED_TABLES) {
    if (!(await client.query('select to_regclass($1) as name', [table])).rows[0].name) { hashes[table] = null; continue; }
    // Hash-only output avoids writing customer/commerce content into the rollback artifact.
    const digest = await client.query(`select count(*)::text as count, md5(coalesce(string_agg(md5(row_to_json(t)::text), '' order by md5(row_to_json(t)::text)), '')) as digest from ${table} t`);
    hashes[table] = catalogTypeHash(digest.rows[0]);
  }
  return hashes;
}
async function readState(client: pg.PoolClient, lock = false): Promise<PhotoState> {
  const suffix = lock ? ' for update' : '';
  // Parent-first locking matches the editor and quick-save lock order.
  const items = (await client.query('select * from catalog_items order by id' + suffix)).rows;
  const variants = (await client.query('select * from catalog_item_variants order by id' + suffix)).rows;
  const media = (await client.query('select * from catalog_media order by id' + suffix)).rows;
  const assignments = (await client.query('select * from catalog_variant_media order by variant_id,media_id' + suffix)).rows;
  return { items, variants, media, assignments };
}

/** Verify the actual unchanged source bytes, not just a filename or a claimed source kind. */
export async function inspectRealPhotoAsset(photo: RealPhoto, bytes: Buffer): Promise<string> {
  ensure(createHash('sha256').update(bytes).digest('hex') === photo.sha256.toLowerCase(), 'Native asset changed after review: ' + photo.blobUrl);
  const metadata = await sharp(bytes).metadata();
  ensure(metadata.width === photo.dimensions.width && metadata.height === photo.dimensions.height, 'Native dimensions changed: ' + photo.blobUrl);
  ensure(metadata.format && ['jpeg', 'png', 'webp', 'avif', 'gif'].includes(metadata.format), 'Not a native photograph format: ' + photo.blobUrl);
  return metadata.format === 'jpeg' ? 'image/jpeg' : 'image/' + metadata.format;
}

export async function runRealPhotoReplacement(args = process.argv.slice(2)) {
  const options = parseCatalogTypeArgs(args);
  const target = resolveCatalogTypeTarget(options.target, process.env.DATABASE_URL);
  const source = JSON.parse(await readFile('data/catalog/atehna-2026-09.json', 'utf8')) as { products: RealPhotoSource[] };
  const historical = JSON.parse(await readFile('data/catalog/image-upgrades-2026-09.json', 'utf8')) as { products: HistoricalPhotoProduct[] };
  const groups = await Promise.all(MANIFESTS.map(async file => JSON.parse(await readFile(file, 'utf8')) as { products: RealPhotoProduct[] }));
  const products = groups.flatMap(group => group.products);
  validateRealPhotoManifest(products, source.products, historical.products);
  const mimeByUrl = new Map<string, string>();
  for (const photo of products.flatMap(product => product.photos)) {
    const bytes = await readFile(path.resolve('public', '.' + photo.blobUrl));
    mimeByUrl.set(photo.blobUrl, await inspectRealPhotoAsset(photo, bytes));
  }
  const pool = new pg.Pool({ connectionString: target.connectionString, max: 1 });
  const client = await pool.connect(); let committed = false;
  try {
    await client.query(options.apply ? 'begin isolation level serializable' : 'begin isolation level repeatable read read only');
    ensure((await client.query('select current_database() as name')).rows[0].name === target.database, 'Unexpected database.');
    if (options.apply) await client.query("select pg_advisory_xact_lock(hashtext('atehna-catalog-real-photos-2026-09'))");
    const before = await readState(client, options.apply);
    const plan = planRealPhotoReplacement(products, source.products, historical.products, before, mimeByUrl);
    const summary = { target: options.target, products: products.length, insertedImages: plan.mediaInserts.length, updatedImages: plan.mediaUpdates.length, removedAssignments: plan.assignmentDeletes.length, addedOrReorderedAssignments: plan.assignmentUpserts.length, changedItems: plan.changedItemIds.length };
    const directory = path.join('tmp/catalog-refinements', `real-photos-${options.target}-${new Date().toISOString().replace(/[:.]/g, '-')}`);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, 'plan.json'), JSON.stringify({ summary, plan }, null, 2), { flag: 'wx' });
    console.log(JSON.stringify({ ...summary, plan: path.join(directory, 'plan.json') }));
    if (!options.apply) { await client.query('rollback'); return summary; }
    const hashes = await protectedHashes(client);
    const backup = path.join(directory, 'before.json');
    const snapshot = Buffer.from(JSON.stringify({ ...before, hashes, summary, manifests: MANIFESTS }, null, 2));
    await writeFile(backup, snapshot, { flag: 'wx' });
    ensure(snapshot.equals(await readFile(backup)), 'Rollback snapshot reread failed.');
    const insertedIds = new Map<string, string>();
    for (const row of plan.mediaInserts) {
      const inserted = await client.query(`insert into catalog_media(item_id,media_kind,role,source_kind,filename,blob_url,mime_type,alt_text,image_dimensions,image_type,hidden,position) values($1,'image','gallery','upload',$2,$3,$4,$5,$6::jsonb,$7,false,$8) returning id`, [row.item_id, row.filename, row.blob_url, row.mime_type, row.alt_text, JSON.stringify(row.image_dimensions), row.image_type, row.position]);
      insertedIds.set(id(row.id), id(inserted.rows[0].id));
    }
    const allowedMediaFields = new Set(['mime_type', 'alt_text', 'image_dimensions', 'image_type', 'hidden', 'position']);
    for (const update of plan.mediaUpdates) {
      const fields = Object.entries(update.changes);
      ensure(fields.length && fields.every(([field]) => allowedMediaFields.has(field)), 'Unreviewed media mutation column.');
      const assignments = fields.map(([field], index) => `${field}=$${index + 1}${field === 'image_dimensions' ? '::jsonb' : ''}`).join(',');
      await client.query(`update catalog_media set ${assignments},updated_at=now() where id=$${fields.length + 1}`, [...fields.map(([field, value]) => field === 'image_dimensions' ? JSON.stringify(value) : value), update.id]);
    }
    for (const row of plan.assignmentDeletes) await client.query('delete from catalog_variant_media where variant_id=$1 and media_id=$2', [row.variant_id, row.media_id]);
    for (const row of plan.assignmentUpserts) await client.query(`insert into catalog_variant_media(variant_id,item_id,media_id,position) values($1,$2,$3,$4) on conflict(variant_id,media_id) do update set position=excluded.position`, [row.variant_id, row.item_id, insertedIds.get(id(row.media_id)) ?? row.media_id, row.position]);
    for (const itemId of plan.changedItemIds) await client.query('update catalog_items set updated_at=now() where id=$1', [itemId]);
    const after = await readState(client);
    verifyRealPhotoPreservation(before, after, plan, insertedIds);
    ensure(same(hashes, await protectedHashes(client)), 'Protected catalog, supplier, pricing, stock or commerce data changed.');
    const repeat = planRealPhotoReplacement(products, source.products, historical.products, after, mimeByUrl);
    ensure(repeat.changedItemIds.length === 0, 'Real-photo replacement is not idempotent.');
    await client.query('commit'); committed = true;
    const verification = { ...summary, committed: true, protectedDataUnchanged: true, allVariantsHaveClearPhotos: true, repeatChanges: 0, backup };
    await writeFile(path.join(directory, 'verification.json'), JSON.stringify(verification, null, 2));
    console.log(JSON.stringify(verification)); return verification;
  } catch (error) { if (!committed) await client.query('rollback'); throw error; }
  finally { client.release(); await pool.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) runRealPhotoReplacement().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
