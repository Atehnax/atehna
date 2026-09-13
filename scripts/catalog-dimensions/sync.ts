/**
 * Add reviewed dimension SVGs to the local catalog without rewriting photographs or products.
 * DATABASE_URL must be supplied by the caller; this command never loads .env files.
 * Preview: node --import tsx scripts/catalog-dimensions/sync.ts --target local
 * Apply:   node --import tsx scripts/catalog-dimensions/sync.ts --target local --apply
 * Restart the local Next server after CLI writes to refresh its catalog cache.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import sharp from 'sharp';
import { catalogTypeHash, parseCatalogTypeArgs, resolveCatalogTypeTarget } from '../reclassify-atehna-catalog';

export const DIMENSION_SKETCH_MANIFEST = 'data/catalog/dimension-sketches-2026-09.json';
const ASSET_PREFIX = '/images/catalog/2026-09/dimenzije/';
const IMAGE_TYPES = new Set(['dimension-diagram', 'dimension-overview']);
type Row = Record<string, unknown>;
export type DimensionSketchImage = {
  url: string; filename: string; imageType: 'dimension-diagram' | 'dimension-overview';
  width: number; height: number; sha256: string; altText: string;
  variantIds: string[]; variantSkus: string[];
};
export type DimensionVariantSnapshot = {
  id: string; variantSku: string; variantName: string;
  length: number | null; width: number | null; thickness: number | null;
  contentOverride: Row | null; optionLabels?: Record<string, string>;
};
export type DimensionSketchManifest = {
  version: 1;
  mode?: 'per-variant';
  products: Array<{ slug: string; itemId?: string; variantSnapshot: DimensionVariantSnapshot[]; images: DimensionSketchImage[] }>;
};
export type DimensionSketchState = { items: Row[]; variants: Row[]; media: Row[]; assignments: Row[] };
export type DimensionSketchPlan = {
  mediaInserts: Row[];
  mediaUpdates: Array<{ id: string; changes: Row }>;
  assignmentInserts: Row[];
};
function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const record = (value: unknown): value is Row => value !== null && typeof value === 'object' && !Array.isArray(value);
const id = (value: unknown) => String(value);
const same = (left: unknown, right: unknown) => catalogTypeHash(left) === catalogTypeHash(right);
const omit = (row: Row, keys: string[]) => Object.fromEntries(Object.entries(row).filter(([key]) => !keys.includes(key)));
const assignmentKey = (row: Row) => id(row.variant_id) + ':' + id(row.media_id);
const validId = (value: unknown): value is string => typeof value === 'string' && /^[1-9]\d*$/u.test(value);
const validAssetUrl = (value: unknown): value is string => typeof value === 'string'
  && value.startsWith(ASSET_PREFIX) && /^[a-z0-9][a-z0-9._-]*\.svg$/iu.test(value.slice(ASSET_PREFIX.length));
const isManaged = (row: Row) => row.media_kind === 'image' && row.role === 'gallery'
  && row.source_kind === 'upload' && IMAGE_TYPES.has(String(row.image_type)) && validAssetUrl(row.blob_url);

export function validateDimensionSketchManifest(value: unknown): DimensionSketchManifest {
  ensure(record(value) && value.version === 1 && Array.isArray(value.products) && value.products.length > 0,
    'Expected a version: 1 manifest with products.');
  ensure(value.mode === undefined || value.mode === 'per-variant', 'Unsupported dimension sketch mode.');
  const slugs = new Set<string>();
  for (const product of value.products) {
    ensure(record(product) && typeof product.slug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(product.slug), 'Invalid product slug.');
    ensure(!slugs.has(product.slug), 'Duplicate product: ' + product.slug); slugs.add(product.slug);
    ensure(product.itemId === undefined || validId(product.itemId), 'Invalid item ID: ' + product.slug);
    ensure(Array.isArray(product.variantSnapshot) && product.variantSnapshot.length > 0, 'Missing variant snapshot: ' + product.slug);
    const snapshotIds = new Set<string>();
    for (const variant of product.variantSnapshot) {
      ensure(record(variant) && validId(variant.id) && typeof variant.variantSku === 'string' && typeof variant.variantName === 'string',
        'Invalid variant snapshot identity: ' + product.slug);
      ensure(!snapshotIds.has(variant.id), 'Duplicate snapshot variant: ' + variant.id); snapshotIds.add(variant.id);
      ensure([variant.length, variant.width, variant.thickness].every(value => value === null || (typeof value === 'number' && Number.isFinite(value))),
        'Snapshot dimensions must be finite numbers or null: ' + variant.id);
      ensure(variant.contentOverride === null || record(variant.contentOverride), 'Invalid specification snapshot: ' + variant.id);
      ensure(variant.optionLabels === undefined || (record(variant.optionLabels) && Object.values(variant.optionLabels).every(value => typeof value === 'string')),
        'Invalid option-label snapshot: ' + variant.id);
    }
    ensure(Array.isArray(product.images) && product.images.length > 0, 'Missing diagrams: ' + product.slug);
    const urls = new Set<string>(); const filenames = new Set<string>();
    for (const image of product.images) {
      ensure(record(image) && validAssetUrl(image.url), 'Invalid local dimension SVG URL: ' + product.slug);
      ensure(typeof image.filename === 'string' && image.filename === path.posix.basename(image.url), 'Filename must match its SVG URL: ' + image.url);
      ensure(!urls.has(image.url) && !filenames.has(image.filename), 'Duplicate diagram identity: ' + image.url);
      urls.add(image.url); filenames.add(image.filename);
      ensure(IMAGE_TYPES.has(String(image.imageType)), 'Invalid dimension imageType: ' + image.url);
      ensure([image.width, image.height].every(size => typeof size === 'number' && Number.isSafeInteger(size) && size > 0), 'Invalid pixel dimensions: ' + image.url);
      ensure(typeof image.sha256 === 'string' && /^[a-f0-9]{64}$/iu.test(image.sha256), 'Invalid SVG hash: ' + image.url);
      ensure(typeof image.altText === 'string' && image.altText.trim(), 'Missing diagram alternative text: ' + image.url);
      ensure(Array.isArray(image.variantIds) && image.variantIds.every(validId), 'Invalid variant IDs: ' + image.url);
      ensure(new Set(image.variantIds).size === image.variantIds.length, 'Duplicate variant ID: ' + image.url);
      ensure(Array.isArray(image.variantSkus) && image.variantSkus.length === image.variantIds.length
        && image.variantSkus.every(sku => typeof sku === 'string' && sku.trim() === sku && sku.length > 0), 'Variant IDs and SKUs must be paired: ' + image.url);
      ensure(image.imageType === 'dimension-overview' ? image.variantIds.length === 0 : image.variantIds.length > 0,
        'Overviews must be general; individual diagrams need assigned variants: ' + image.url);
    }
    if (value.mode === 'per-variant') {
      const assigned = new Set<string>();
      for (const image of product.images as DimensionSketchImage[]) {
        ensure(image.imageType === 'dimension-diagram' && image.variantIds.length === 1,
          'Each individual sketch must belong to exactly one variant: ' + image.url);
        const variantId = image.variantIds[0];
        const snapshot = (product.variantSnapshot as DimensionVariantSnapshot[]).find(variant => variant.id === variantId);
        ensure(snapshot && snapshot.variantSku === image.variantSkus[0], 'Sketch variant differs from its snapshot: ' + image.url);
        ensure(!assigned.has(variantId), 'More than one sketch for variant: ' + variantId);
        assigned.add(variantId);
      }
      ensure(assigned.size === snapshotIds.size, 'Every configured variant needs its own sketch: ' + product.slug);
    }
  }
  return value as DimensionSketchManifest;
}

function within(root: string, file: string) {
  const relative = path.relative(root, file);
  return relative !== '' && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}
export async function verifyDimensionSketchAssets(manifest: DimensionSketchManifest, root = process.cwd()) {
  const publicRoot = await realpath(path.resolve(root, 'public'));
  const assetRoot = await realpath(path.resolve(publicRoot, '.' + ASSET_PREFIX));
  ensure(within(publicRoot, assetRoot), 'Dimension asset directory escapes public/.');
  const verified = new Map<string, string>();
  for (const image of manifest.products.flatMap(product => product.images)) {
    const assetFile = await realpath(path.resolve(publicRoot, '.' + image.url));
    ensure(within(assetRoot, assetFile), 'SVG resolves outside the managed dimension directory: ' + image.url);
    const bytes = await readFile(assetFile);
    ensure(bytes.length > 0 && bytes.length <= 4 * 1024 * 1024, 'SVG is empty or exceeds 4 MB: ' + image.url);
    const hash = createHash('sha256').update(bytes).digest('hex');
    ensure(hash === image.sha256.toLowerCase(), 'SVG changed after review: ' + image.url);
    ensure(!verified.has(image.url) || verified.get(image.url) === hash, 'Conflicting SVG identity: ' + image.url);
    const metadata = await sharp(bytes).metadata();
    ensure(metadata.format === 'svg' && metadata.width === image.width && metadata.height === image.height,
      'SVG format or dimensions differ from the manifest: ' + image.url);
    verified.set(image.url, hash);
  }
  return verified;
}

/** Plans only managed media changes; existing positions and assignment rows are never rewritten. */
export function planDimensionSketchSync(manifest: DimensionSketchManifest, state: DimensionSketchState): DimensionSketchPlan {
  const plan: DimensionSketchPlan = { mediaInserts: [], mediaUpdates: [], assignmentInserts: [] };
  const assignmentPositions = new Map<string, number>();
  for (const row of state.assignments) assignmentPositions.set(id(row.variant_id), Math.max(assignmentPositions.get(id(row.variant_id)) ?? -1, Number(row.position)));
  for (const product of manifest.products) {
    const matches = state.items.filter(item => item.slug === product.slug);
    ensure(matches.length === 1, 'Product is missing or ambiguous: ' + product.slug);
    const item = matches[0]; const itemId = id(item.id);
    ensure(item.status !== 'deleted', 'Archived product requires review: ' + product.slug);
    ensure(product.itemId === undefined || product.itemId === itemId, 'Product ID changed: ' + product.slug);
    const currentVariants = state.variants.filter(row => id(row.item_id) === itemId);
    ensure(currentVariants.length === product.variantSnapshot.length, 'Configured variants changed since rendering: ' + product.slug);
    for (const snapshot of product.variantSnapshot) {
      const variant = currentVariants.find(row => id(row.id) === snapshot.id);
      ensure(variant, 'Snapshot variant is no longer present: ' + product.slug + '/' + snapshot.id);
      const measurement = (value: unknown) => value === null || value === undefined ? null : Number(value);
      const current = {
        id: id(variant.id), variantSku: String(variant.variant_sku ?? ''), variantName: String(variant.variant_name ?? ''),
        length: measurement(variant.length), width: measurement(variant.width), thickness: measurement(variant.thickness),
        contentOverride: variant.content_override_json ?? null,
        ...(snapshot.optionLabels !== undefined ? { optionLabels: variant.dimension_option_labels ?? {} } : {})
      };
      ensure(same(current, snapshot), 'Variant labels, dimensions or specifications changed since rendering: ' + product.slug + '/' + snapshot.id);
    }
    const currentMedia = state.media.filter(row => id(row.item_id) === itemId);
    let nextPosition = Math.max(-1, ...currentMedia.map(row => Number(row.position))) + 1;
    const retainedManagedIds = new Set<string>();
    for (const image of product.images) {
      for (const [index, variantId] of image.variantIds.entries()) {
        const variant = state.variants.find(row => id(row.id) === variantId && id(row.item_id) === itemId);
        ensure(variant && variant.variant_sku === image.variantSkus[index], 'Variant ID/SKU no longer matches ' + product.slug + ': ' + variantId);
      }
      const candidates = currentMedia.filter(row => row.blob_url === image.url || row.filename === image.filename);
      ensure(candidates.length <= 1, 'Ambiguous existing diagram identity: ' + image.url);
      const existing = candidates[0];
      ensure(!existing || isManaged(existing), 'Refusing to alter an unmarked image or photograph: ' + image.url);
      const mediaId = existing ? id(existing.id) : 'new:' + itemId + ':' + image.filename;
      if (existing) retainedManagedIds.add(mediaId);
      const fields: Row = {
        filename: image.filename, blob_url: image.url, mime_type: 'image/svg+xml', alt_text: image.altText,
        image_dimensions: { width: image.width, height: image.height }, image_type: image.imageType, hidden: false
      };
      if (existing) {
        const changes = Object.fromEntries(Object.entries(fields).filter(([key, value]) => !same(existing[key], value)));
        if (Object.keys(changes).length) plan.mediaUpdates.push({ id: mediaId, changes });
      } else {
        plan.mediaInserts.push({ id: mediaId, item_id: itemId, media_kind: 'image', role: 'gallery', source_kind: 'upload', ...fields, position: nextPosition++ });
      }
      const assignments = existing ? state.assignments.filter(row => id(row.media_id) === mediaId) : [];
      ensure(assignments.every(row => id(row.item_id) === itemId && image.variantIds.includes(id(row.variant_id))),
        'Existing diagram links disagree with the reviewed variants: ' + image.url);
      for (const variantId of image.variantIds) {
        if (assignments.some(row => id(row.variant_id) === variantId)) continue;
        const position = (assignmentPositions.get(variantId) ?? -1) + 1;
        assignmentPositions.set(variantId, position);
        plan.assignmentInserts.push({ variant_id: variantId, item_id: itemId, media_id: mediaId, position });
      }
    }
    for (const row of currentMedia) {
      if (isManaged(row) && !retainedManagedIds.has(id(row.id)) && row.hidden !== true) {
        plan.mediaUpdates.push({ id: id(row.id), changes: { hidden: true } });
      }
    }
  }
  return plan;
}

function applyPlanToState(before: DimensionSketchState, plan: DimensionSketchPlan, insertedIds: Map<string, string>): DimensionSketchState {
  const media = before.media.map(row => {
    const update = plan.mediaUpdates.find(change => change.id === id(row.id));
    return update ? { ...row, ...update.changes } : row;
  });
  for (const row of plan.mediaInserts) {
    const insertedId = insertedIds.get(id(row.id)); ensure(insertedId, 'Missing inserted media ID.');
    media.push({ ...row, id: insertedId });
  }
  const assignments = [...before.assignments, ...plan.assignmentInserts.map(row => ({ ...row, media_id: insertedIds.get(id(row.media_id)) ?? row.media_id }))];
  return { ...before, media, assignments };
}

export function verifyDimensionSketchPreservation(before: DimensionSketchState, after: DimensionSketchState, plan: DimensionSketchPlan, insertedIds: Map<string, string>) {
  ensure(same(before.items, after.items) && same(before.variants, after.variants), 'Products, variants, prices or statuses changed.');
  const expected = applyPlanToState(before, plan, insertedIds);
  ensure(expected.media.length === after.media.length && expected.assignments.length === after.assignments.length, 'Unexpected media or assignment count.');
  const inserted = new Set(insertedIds.values());
  for (const row of expected.media) {
    const actual = after.media.find(entry => id(entry.id) === id(row.id)); ensure(actual, 'Existing media was removed: ' + id(row.id));
    if (inserted.has(id(row.id))) {
      for (const [key, value] of Object.entries(row)) ensure(same(actual[key], value), 'Inserted diagram differs: ' + id(row.id) + '/' + key);
    } else {
      const ignored = plan.mediaUpdates.some(update => update.id === id(row.id)) ? ['updated_at'] : [];
      ensure(same(omit(row, ignored), omit(actual, ignored)), 'Unreviewed media change: ' + id(row.id));
    }
  }
  const existingAssignments = new Set(before.assignments.map(assignmentKey));
  for (const row of expected.assignments) {
    const actual = after.assignments.find(entry => assignmentKey(entry) === assignmentKey(row)); ensure(actual, 'Existing image assignment was removed.');
    if (existingAssignments.has(assignmentKey(row))) ensure(same(row, actual), 'Existing photo/diagram assignment changed.');
    else for (const key of ['variant_id', 'item_id', 'media_id', 'position']) ensure(same(row[key], actual[key]), 'Inserted diagram assignment differs.');
  }
}

const PROTECTED_TABLES = [
  'catalog_items', 'catalog_item_variants', 'catalog_item_editor_details', 'catalog_categories',
  'catalog_option_axes', 'catalog_option_values', 'catalog_variant_option_values', 'catalog_item_quantity_discounts',
  'catalog_item_slug_aliases', 'catalog_supplier_rows', 'pricing_stock_history', 'pricing_stock_model',
  'orders', 'order_items', 'order_line_snapshots', 'order_stock_holds', 'order_historical_changes',
  'quote_requests', 'quote_request_items', 'quote_offer_versions', 'quote_offer_version_items', 'quote_offer_acceptances'
] as const;
async function protectedHashes(client: pg.PoolClient) {
  const hashes: Record<string, string | null> = {};
  for (const table of PROTECTED_TABLES) {
    if (!(await client.query('select to_regclass($1) as name', [table])).rows[0].name) { hashes[table] = null; continue; }
    // Retain hashes instead of copying customer or order content into the backup.
    const result = await client.query(`select count(*)::text as count, md5(coalesce(string_agg(md5(row_to_json(t)::text), '' order by md5(row_to_json(t)::text)), '')) as digest from ${table} t`);
    hashes[table] = catalogTypeHash(result.rows[0]);
  }
  return hashes;
}
async function readState(client: pg.PoolClient, lock = false): Promise<DimensionSketchState> {
  const suffix = lock ? ' for update' : '';
  // Follow the editor's parent-first lock order.
  const items = (await client.query('select * from catalog_items order by id' + suffix)).rows;
  const variants = (await client.query(`select civ.*, coalesce((
      select json_object_agg(coa.name, cov.value order by coa.position, coa.id)
      from catalog_variant_option_values cvov
      join catalog_option_axes coa on coa.id = cvov.axis_id
      join catalog_option_values cov on cov.id = cvov.option_value_id and cov.axis_id = coa.id
      where cvov.variant_id = civ.id
    ), '{}'::json) as dimension_option_labels
    from catalog_item_variants civ order by civ.id` + (lock ? ' for update of civ' : ''))).rows;
  const media = (await client.query('select * from catalog_media order by id' + suffix)).rows;
  const assignments = (await client.query('select * from catalog_variant_media order by variant_id,media_id' + suffix)).rows;
  return { items, variants, media, assignments };
}
const changeCount = (plan: DimensionSketchPlan) => plan.mediaInserts.length + plan.mediaUpdates.length + plan.assignmentInserts.length;


/** Publication checks every immutable SVG on the canonical site before a production write. */
async function verifyPublishedDimensionSketchAssets(manifest: DimensionSketchManifest) {
  const images = [...new Map(manifest.products.flatMap(product => product.images).map(image => [image.url, image])).values()];
  for (let offset = 0; offset < images.length; offset += 8) {
    await Promise.all(images.slice(offset, offset + 8).map(async image => {
      const response = await fetch('https://atehna.vercel.app' + image.url, {
        redirect: 'error', signal: AbortSignal.timeout(20_000), cache: 'no-store'
      });
      ensure(response.ok && response.headers.get('content-type')?.includes('image/svg+xml'),
        'Deploy the reviewed SVG before publishing its catalog record: ' + image.url);
      const bytes = Buffer.from(await response.arrayBuffer());
      ensure(createHash('sha256').update(bytes).digest('hex') === image.sha256,
        'Published SVG bytes differ from the reviewed asset: ' + image.url);
    }));
  }
}

export async function runDimensionSketchSync(args = process.argv.slice(2)) {
  const options = parseCatalogTypeArgs(args);
  ensure(options.target === 'local', 'Dimension sketch synchronization is local-only; use the reviewed production publisher.');
  return synchronizeReviewedDimensionSketches({ ...options, manifestPath: DIMENSION_SKETCH_MANIFEST });
}

/** Shared media-only transaction; production requires explicit fresh identity binding. */
export async function synchronizeReviewedDimensionSketches(options: {
  target: 'local' | 'production';
  apply: boolean;
  manifestPath: string;
  bindManifest?: (manifest: DimensionSketchManifest, state: DimensionSketchState) => DimensionSketchManifest;
}) {
  const target = resolveCatalogTypeTarget(options.target, process.env.DATABASE_URL);
  const manifestBytes = await readFile(options.manifestPath);
  const parsed = JSON.parse(manifestBytes.toString('utf8'));
  ensure(options.target !== 'production' || (parsed.environment === 'production' && options.bindManifest),
    'Production requires a reviewed production manifest and fresh slug/SKU binding.');
  const reviewedManifest = validateDimensionSketchManifest(parsed);
  const verifiedAssets = await verifyDimensionSketchAssets(reviewedManifest);
  if (options.target === 'production' && options.apply) await verifyPublishedDimensionSketchAssets(reviewedManifest);
  const pool = new pg.Pool({ connectionString: target.connectionString, max: 1 });
  const client = await pool.connect(); let committed = false;
  try {
    await client.query(options.apply ? 'begin isolation level serializable' : 'begin isolation level repeatable read read only');
    ensure((await client.query('select current_database() as name')).rows[0].name === target.database, 'Connected database differs from the selected target.');
    if (options.apply) await client.query("select pg_advisory_xact_lock(hashtext('atehna-catalog-dimension-sketches-2026-09'))");
    const before = await readState(client, options.apply);
    const manifest = options.bindManifest ? options.bindManifest(reviewedManifest, before) : reviewedManifest;
    validateDimensionSketchManifest(manifest);
    const plan = planDimensionSketchSync(manifest, before);
    const summary = {
      mode: options.apply ? 'apply' : 'dry-run', target: options.target, host: target.hostname, database: target.database,
      products: manifest.products.length, verifiedAssets: verifiedAssets.size,
      insertedImages: plan.mediaInserts.length, updatedImages: plan.mediaUpdates.filter(row => !(row.changes.hidden === true)).length,
      hiddenStaleDiagrams: plan.mediaUpdates.filter(row => row.changes.hidden === true).length,
      insertedAssignments: plan.assignmentInserts.length
    };
    const directory = path.join('tmp/catalog-refinements', 'dimension-sketches-' + options.target + '-' + new Date().toISOString().replace(/[:.]/gu, '-'));
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, 'plan.json'), JSON.stringify({ summary, plan }, null, 2), { flag: 'wx' });
    console.log(JSON.stringify({ ...summary, plan: path.join(directory, 'plan.json') }));
    if (!options.apply) { await client.query('rollback'); return summary; }
    const hashes = await protectedHashes(client);
    const backup = path.join(directory, 'before.json');
    const snapshot = Buffer.from(JSON.stringify({ capturedAt: new Date().toISOString(), ...before, hashes, plan, manifest, manifestSha256: createHash('sha256').update(manifestBytes).digest('hex'), summary }, null, 2));
    await writeFile(backup, snapshot, { flag: 'wx' });
    ensure(snapshot.equals(await readFile(backup)), 'Rollback snapshot reread failed.');
    // Assets must still match after the database snapshot and before the first mutation.
    await verifyDimensionSketchAssets(manifest);
    const insertedIds = new Map<string, string>();
    for (const row of plan.mediaInserts) {
      const inserted = await client.query(`insert into catalog_media(item_id,media_kind,role,source_kind,filename,blob_url,mime_type,alt_text,image_dimensions,image_type,hidden,position)
        values($1,'image','gallery','upload',$2,$3,'image/svg+xml',$4,$5::jsonb,$6,false,$7) returning id`,
      [row.item_id, row.filename, row.blob_url, row.alt_text, JSON.stringify(row.image_dimensions), row.image_type, row.position]);
      insertedIds.set(id(row.id), id(inserted.rows[0].id));
    }
    const allowedFields = new Set(['filename', 'blob_url', 'mime_type', 'alt_text', 'image_dimensions', 'image_type', 'hidden']);
    for (const update of plan.mediaUpdates) {
      const fields = Object.entries(update.changes);
      ensure(fields.length > 0 && fields.every(([field]) => allowedFields.has(field)), 'Invalid managed diagram update field.');
      const setters = fields.map(([field], index) => `${field}=$${index + 1}${field === 'image_dimensions' ? '::jsonb' : ''}`).join(',');
      const result = await client.query(`update catalog_media set ${setters},updated_at=now() where id=$${fields.length + 1}`,
        [...fields.map(([field, value]) => field === 'image_dimensions' ? JSON.stringify(value) : value), update.id]);
      ensure(result.rowCount === 1, 'Managed diagram update missed its row.');
    }
    for (const row of plan.assignmentInserts) {
      await client.query('insert into catalog_variant_media(variant_id,item_id,media_id,position) values($1,$2,$3,$4)',
        [row.variant_id, row.item_id, insertedIds.get(id(row.media_id)) ?? row.media_id, row.position]);
    }
    const after = await readState(client);
    verifyDimensionSketchPreservation(before, after, plan, insertedIds);
    ensure(same(hashes, await protectedHashes(client)), 'Protected product, pricing, stock, supplier or commerce data changed.');
    ensure(changeCount(planDimensionSketchSync(manifest, after)) === 0, 'Diagram synchronization is not idempotent.');
    await writeFile(path.join(directory, 'applied-plan.json'), JSON.stringify({ insertedIds: Object.fromEntries(insertedIds), plan }, null, 2), { flag: 'wx' });
    await client.query('commit'); committed = true;
    const verification = { ...summary, committed: true, protectedDataUnchanged: true, repeatChanges: 0, backup };
    await writeFile(path.join(directory, 'verification.json'), JSON.stringify(verification, null, 2), { flag: 'wx' });
    console.log(JSON.stringify(verification));
    return verification;
  } catch (error) {
    if (!committed) await client.query('rollback');
    throw error;
  } finally { client.release(); await pool.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runDimensionSketchSync().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
