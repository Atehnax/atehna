/** Selected photo refresh only. Dry-run by default; never replays the historical import. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { catalogTypeHash, parseCatalogTypeArgs, resolveCatalogTypeTarget } from './reclassify-atehna-catalog';
import {
  inspectRealPhotoAsset, realPhotoProvenance, simulateRealPhotoPlan, verifyRealPhotoPreservation,
  protectedHashes, readState, type PhotoState, type RealPhoto, type HistoricalPhotoProduct,
  type planRealPhotoReplacement
} from './replace-atehna-generated-images';

type Row = Record<string, unknown>;
export type FramingPhoto = Omit<RealPhoto, 'variantIndices' | 'retainedVariantDimensions' | 'removeExistingVariantIndices' | 'contextOnly'> & { contextOnly?: boolean };
export type PhotoFramingProduct = {
  slug: string;
  additions?: FramingPhoto[];
  replacements?: Array<{ fromBlobUrl: string; photo: FramingPhoto; keepOriginalVisible?: boolean }>;
  leadBlobUrls?: string[];
};
type Plan = ReturnType<typeof planRealPhotoReplacement>;
const MANIFEST = 'data/catalog/photo-framing-2026-09.json';
const sid = (value: unknown) => String(value);
const urlOf = (row: Row) => String(row.blob_url || row.external_url || '');
const photoRow = (row: Row) => row.media_kind === 'image' && row.role === 'gallery' && !['dimension-diagram', 'dimension-overview'].includes(String(row.image_type));
const same = (a: unknown, b: unknown) => catalogTypeHash({ value: a }) === catalogTypeHash({ value: b });
const keyOf = (row: Row) => `${row.variant_id}:${row.media_id}`;
const assetPath = (value: string) => /^\/images\/catalog\/\d{4}-\d{2}\/[a-z0-9-]+\.(?:png|jpe?g|webp|avif|gif)$/.test(value);
function ensure(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const completePhoto = (photo: FramingPhoto): RealPhoto => ({ ...photo, contextOnly: photo.contextOnly ?? false, variantIndices: [] });

export function validatePhotoFramingManifest(products: PhotoFramingProduct[], history: HistoricalPhotoProduct[] = []) {
  ensure(Array.isArray(products) && products.length > 0, 'Select at least one reviewed product.');
  ensure(new Set(products.map(product => product.slug)).size === products.length, 'Duplicate selected product.');
  const provenance = realPhotoProvenance(history);
  for (const product of products) {
    ensure(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product.slug), 'Unsafe product slug.');
    const additions = product.additions ?? [];
    const replacements = product.replacements ?? [];
    const leads = product.leadBlobUrls ?? [];
    ensure(Array.isArray(additions) && Array.isArray(replacements) && Array.isArray(leads), `Invalid photo lists: ${product.slug}`);
    ensure(additions.length + replacements.length + leads.length > 0, `No selected changes: ${product.slug}`);
    ensure(new Set(leads).size === leads.length && leads.every(assetPath), `Invalid leading photo URLs: ${product.slug}`);
    ensure(leads.every(url => !provenance.generatedUrls.has(url)), `Known synthetic leading photo: ${product.slug}`);
    ensure(replacements.every(entry => entry.keepOriginalVisible === undefined || typeof entry.keepOriginalVisible === 'boolean'), `Invalid original visibility policy: ${product.slug}`);
    const fromUrls = replacements.map(entry => entry.fromBlobUrl);
    const photos = [...additions, ...replacements.map(entry => entry.photo)];
    ensure(new Set(fromUrls).size === fromUrls.length && fromUrls.every(assetPath), `Invalid replacement sources: ${product.slug}`);
    ensure(new Set(photos.map(photo => photo.blobUrl)).size === photos.length, `Duplicate selected photo: ${product.slug}`);
    ensure(fromUrls.every(url => !leads.includes(url) && !photos.some(photo => photo.blobUrl === url)), `Replacement cycle or retired leading photo: ${product.slug}`);
    for (const photo of photos) {
      ensure(photo.visuallyVerified === true && photo.id && photo.notes?.trim() && photo.altText?.trim(), `Missing visual review: ${product.slug}`);
      ensure(assetPath(photo.blobUrl) && /^[a-f0-9]{64}$/i.test(photo.sha256), `Unsafe photo path or checksum: ${photo.id}`);
      ensure(photo.kind && !/generated|illustration|render/i.test(photo.kind), `Synthetic photo is forbidden: ${photo.id}`);
      ensure(!provenance.generatedUrls.has(photo.blobUrl) && !provenance.generatedHashes.has(photo.sha256.toLowerCase()), `Known synthetic source: ${photo.id}`);
      ensure(photo.contextOnly === undefined || typeof photo.contextOnly === 'boolean', `Invalid context classification: ${photo.id}`);
      ensure(photo.dimensions && [photo.dimensions.width, photo.dimensions.height].every(value => Number.isSafeInteger(value) && value > 0), `Invalid photo dimensions: ${photo.id}`);
      for (const value of [photo.sourceUrl, photo.sourcePage]) {
        const url = new URL(value);
        ensure(['https:', 'http:'].includes(url.protocol) && !url.username && !url.password, `Unsafe source URL: ${photo.id}`);
      }
    }
  }
}

/** Match current media URLs, never historical variant counts, names, indices, or measurements. */
export function planPhotoFraming(products: PhotoFramingProduct[], before: PhotoState, mimeByUrl: Map<string, string>): Plan {
  validatePhotoFramingManifest(products);
  const next = structuredClone(before);
  const plan: Plan = { products: [], mediaInserts: [], mediaUpdates: [], assignmentDeletes: [], assignmentUpserts: [], changedItemIds: [] };
  for (const product of products) {
    const items = before.items.filter(item => item.slug === product.slug);
    ensure(items.length === 1 && items[0].status !== 'deleted', `Missing or archived selected product: ${product.slug}`);
    const itemId = sid(items[0].id);
    const findPhoto = (url: string) => {
      const rows = next.media.filter(row => sid(row.item_id) === itemId && urlOf(row) === url);
      ensure(rows.length <= 1 && rows.every(photoRow), `Ambiguous or non-photo source: ${product.slug}/${url}`);
      return rows[0];
    };
    const putPhoto = (photo: FramingPhoto) => {
      let row = findPhoto(photo.blobUrl);
      const mime = mimeByUrl.get(photo.blobUrl);
      ensure(mime?.startsWith('image/'), `Missing validated photo bytes: ${photo.blobUrl}`);
      const fields = { mime_type: mime, alt_text: photo.altText, image_dimensions: photo.dimensions, image_type: photo.contextOnly ? 'context' : 'product', hidden: false };
      if (row) Object.assign(row, fields);
      else {
        row = { id: `new:${itemId}:${photo.id}`, item_id: itemId, media_kind: 'image', role: 'gallery', source_kind: 'upload', filename: path.posix.basename(photo.blobUrl), blob_url: photo.blobUrl, blob_pathname: null, external_url: null, video_type: null, ...fields, position: Math.max(-1, ...next.media.filter(media => sid(media.item_id) === itemId).map(media => Number(media.position))) + 1 };
        ensure(!next.media.some(media => sid(media.id) === sid(row!.id)), `Duplicate new photo ID: ${photo.id}`);
        next.media.push(row);
      }
      return row;
    };
    for (const photo of product.additions ?? []) {
      const row = putPhoto(photo);
      ensure(!next.assignments.some(link => sid(link.media_id) === sid(row.id)), `General addition already has variant assignments: ${photo.blobUrl}`);
    }
    for (const replacement of product.replacements ?? []) {
      const source = findPhoto(replacement.fromBlobUrl);
      ensure(source, `Reviewed replacement source missing: ${product.slug}/${replacement.fromBlobUrl}`);
      const target = putPhoto(replacement.photo);
      const sourceLinks = next.assignments.filter(link => sid(link.media_id) === sid(source.id));
      const targetLinks = next.assignments.filter(link => sid(link.media_id) === sid(target.id));
      ensure(targetLinks.every(link => sourceLinks.some(original => sid(original.variant_id) === sid(link.variant_id))), `Replacement would broaden variant coverage: ${product.slug}`);
      for (const link of sourceLinks) {
        ensure(sid(link.item_id) === itemId && before.variants.some(variant => sid(variant.id) === sid(link.variant_id) && sid(variant.item_id) === itemId), `Foreign variant assignment: ${product.slug}`);
        if (!targetLinks.some(existing => sid(existing.variant_id) === sid(link.variant_id))) next.assignments.push({ variant_id: link.variant_id, item_id: itemId, media_id: target.id, position: link.position });
      }
      // Original rows, files and assignments remain available for rollback.
      if (!replacement.keepOriginalVisible) source.hidden = true;
    }
    const leading = (product.leadBlobUrls ?? []).map(url => {
      const row = findPhoto(url);
      ensure(row && row.hidden !== true, `Leading photo missing or hidden: ${product.slug}/${url}`);
      return sid(row.id);
    });
    const promote = (rows: Row[], rowId: (row: Row) => string) => {
      const matching = leading.filter(id => rows.some(row => rowId(row) === id));
      const start = Math.min(0, ...rows.filter(row => !matching.includes(rowId(row))).map(row => Number(row.position))) - matching.length;
      ensure(Number.isSafeInteger(start) && start >= -2147483648, `Photo position out of range: ${product.slug}`);
      matching.forEach((id, index) => { rows.find(row => rowId(row) === id)!.position = start + index; });
    };
    promote(next.media.filter(row => sid(row.item_id) === itemId && row.media_kind === 'image' && row.role === 'gallery'), row => sid(row.id));
    for (const variant of before.variants.filter(row => sid(row.item_id) === itemId)) promote(next.assignments.filter(row => sid(row.variant_id) === sid(variant.id)), row => sid(row.media_id));
  }
  const changed = new Set<string>();
  for (const row of next.media) {
    const old = before.media.find(entry => sid(entry.id) === sid(row.id));
    if (!old) { plan.mediaInserts.push(row); changed.add(sid(row.item_id)); continue; }
    const changes = Object.fromEntries(Object.entries(row).filter(([key, value]) => !same(old[key], value)));
    if (Object.keys(changes).length) { plan.mediaUpdates.push({ id: sid(row.id), itemId: sid(row.item_id), changes }); changed.add(sid(row.item_id)); }
  }
  for (const row of next.assignments) {
    const old = before.assignments.find(entry => keyOf(entry) === keyOf(row));
    if (!old || Number(old.position) !== Number(row.position)) {
      plan.assignmentUpserts.push({ variant_id: row.variant_id, item_id: row.item_id, media_id: row.media_id, position: row.position }); changed.add(sid(row.item_id));
    }
  }
  plan.changedItemIds = [...changed];
  verifyRealPhotoPreservation(before, simulateRealPhotoPlan(before, plan), plan);
  return plan;
}

export function parsePhotoFramingArgs(args: string[]) {
  const rest = [...args];
  const index = rest.indexOf('--expected-plan-sha256');
  const expectedPlan = index < 0 ? undefined : rest.splice(index, 2)[1];
  ensure(index < 0 || (expectedPlan && /^[a-f0-9]{64}$/i.test(expectedPlan)), 'Invalid expected plan SHA256.');
  const options = parseCatalogTypeArgs(rest);
  ensure(!options.apply || expectedPlan, 'Apply requires --expected-plan-sha256 from a reviewed dry-run.');
  return { ...options, expectedPlan };
}

export async function runPhotoFraming(args = process.argv.slice(2)) {
  const options = parsePhotoFramingArgs(args);
  const target = resolveCatalogTypeTarget(options.target, process.env.DATABASE_URL);
  const manifest = JSON.parse(await readFile(MANIFEST, 'utf8')) as { products: PhotoFramingProduct[]; promotedExistingPhotos?: Array<{ slug: string; photo: FramingPhoto }> };
  const history = JSON.parse(await readFile('data/catalog/image-upgrades-2026-09.json', 'utf8')) as { products: HistoricalPhotoProduct[] };
  validatePhotoFramingManifest(manifest.products, history.products);
  const promoted = manifest.promotedExistingPhotos ?? [];
  ensure(Array.isArray(promoted), 'Invalid promoted-photo reviews.');
  for (const entry of promoted) {
    ensure(manifest.products.some(product => product.slug === entry.slug && product.leadBlobUrls?.includes(entry.photo.blobUrl)), 'Photo review is not a selected promotion.');
    validatePhotoFramingManifest([{ slug: entry.slug, additions: [entry.photo] }], history.products);
  }
  const selectedPhotos = manifest.products.flatMap(product => [...product.additions ?? [], ...(product.replacements ?? []).map(entry => entry.photo)]);
  for (const product of manifest.products) for (const url of product.leadBlobUrls ?? []) {
    if ([...product.additions ?? [], ...(product.replacements ?? []).map(entry => entry.photo)].some(photo => photo.blobUrl === url)) continue;
    ensure(promoted.filter(entry => entry.slug === product.slug && entry.photo.blobUrl === url).length === 1, 'Existing promotion requires one native photo review: ' + url);
  }
  const mimeByUrl = new Map<string, string>();
  for (const photo of [...selectedPhotos, ...promoted.map(entry => entry.photo)]) mimeByUrl.set(photo.blobUrl, await inspectRealPhotoAsset(completePhoto(photo), await readFile(path.resolve('public', '.' + photo.blobUrl))));
  const pool = new pg.Pool({ connectionString: target.connectionString, max: 1 });
  const client = await pool.connect(); let committed = false;
  try {
    await client.query(options.apply ? 'begin isolation level serializable' : 'begin isolation level repeatable read read only');
    ensure((await client.query('select current_database() as name')).rows[0].name === target.database, 'Unexpected database.');
    if (options.apply) {
      await client.query("select pg_advisory_xact_lock(hashtext('atehna-catalog-real-photos-2026-09'))");
      const slugs = manifest.products.map(product => product.slug).sort();
      // Only selected parents and their image rows are locked; the entire catalog is read for preservation checks.
      const ids = (await client.query('select id from catalog_items where slug=any($1::text[]) order by id for update', [slugs])).rows.map(row => row.id);
      await client.query('select id from catalog_item_variants where item_id=any($1::bigint[]) order by id for update', [ids]);
      await client.query('select id from catalog_media where item_id=any($1::bigint[]) order by id for update', [ids]);
      await client.query('select media_id from catalog_variant_media where item_id=any($1::bigint[]) order by variant_id,media_id for update', [ids]);
    }
    const before = await readState(client);
    const plan = planPhotoFraming(manifest.products, before, mimeByUrl);
    const planSha256 = catalogTypeHash({ manifest, plan });
    ensure(!options.apply || options.expectedPlan?.toLowerCase() === planSha256, 'Reviewed plan changed; run and review a new dry-run.');
    const summary = { target: options.target, products: manifest.products.map(product => product.slug), insertedImages: plan.mediaInserts.length, updatedImages: plan.mediaUpdates.length, assignedOrReorderedImages: plan.assignmentUpserts.length, changedItems: plan.changedItemIds.length, planSha256 };
    const directory = path.join('tmp/catalog-refinements', `photo-framing-${options.target}-${new Date().toISOString().replace(/[:.]/g, '-')}`);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, 'plan.json'), JSON.stringify({ summary, manifest, plan }, null, 2), { flag: 'wx' });
    console.log(JSON.stringify({ ...summary, directory }));
    if (!options.apply) { await client.query('rollback'); return summary; }
    const hashes = await protectedHashes(client);
    const backup = path.join(directory, 'before.json');
    const snapshot = Buffer.from(JSON.stringify({ ...before, hashes, summary, manifest, plan }, null, 2));
    await writeFile(backup, snapshot, { flag: 'wx' });
    ensure(snapshot.equals(await readFile(backup)), 'Rollback snapshot reread failed.');
    const insertedIds = new Map<string, string>();
    for (const row of plan.mediaInserts) {
      const inserted = await client.query(`insert into catalog_media(item_id,media_kind,role,source_kind,filename,blob_url,mime_type,alt_text,image_dimensions,image_type,hidden,position) values($1,'image','gallery','upload',$2,$3,$4,$5,$6::jsonb,$7,false,$8) returning id`, [row.item_id, row.filename, row.blob_url, row.mime_type, row.alt_text, JSON.stringify(row.image_dimensions), row.image_type, row.position]);
      insertedIds.set(sid(row.id), sid(inserted.rows[0].id));
    }
    const allowed = new Set(['mime_type', 'alt_text', 'image_dimensions', 'image_type', 'hidden', 'position']);
    for (const update of plan.mediaUpdates) {
      const fields = Object.entries(update.changes);
      ensure(fields.length && fields.every(([field]) => allowed.has(field)), 'Unreviewed media mutation column.');
      const assignments = fields.map(([field], index) => `${field}=$${index + 1}${field === 'image_dimensions' ? '::jsonb' : ''}`).join(',');
      await client.query(`update catalog_media set ${assignments},updated_at=now() where id=$${fields.length + 1} and item_id=$${fields.length + 2}`, [...fields.map(([field, value]) => field === 'image_dimensions' ? JSON.stringify(value) : value), update.id, update.itemId]);
    }
    for (const row of plan.assignmentUpserts) await client.query(`insert into catalog_variant_media(variant_id,item_id,media_id,position) values($1,$2,$3,$4) on conflict(variant_id,media_id) do update set position=excluded.position`, [row.variant_id, row.item_id, insertedIds.get(sid(row.media_id)) ?? row.media_id, row.position]);
    for (const itemId of plan.changedItemIds) await client.query('update catalog_items set updated_at=now() where id=$1', [itemId]);
    const after = await readState(client);
    verifyRealPhotoPreservation(before, after, plan, insertedIds);
    ensure(same(hashes, await protectedHashes(client)), 'Protected catalog or commerce data changed.');
    ensure(planPhotoFraming(manifest.products, after, mimeByUrl).changedItemIds.length === 0, 'Photo refresh is not idempotent.');
    await client.query('commit'); committed = true;
    const verification = { ...summary, committed: true, protectedDataUnchanged: true, repeatChanges: 0, backup, insertedIds: Object.fromEntries(insertedIds) };
    await writeFile(path.join(directory, 'verification.json'), JSON.stringify(verification, null, 2));
    console.log(JSON.stringify(verification)); return verification;
  } catch (error) { if (!committed) await client.query('rollback'); throw error; }
  finally { client.release(); await pool.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) runPhotoFraming().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
