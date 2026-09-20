/** Actual removal phase. Dry-run first; apply uses the exact returned plan hash. Never deletes source files. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { catalogTypeHash, parseCatalogTypeArgs, resolveCatalogTypeTarget } from './reclassify-atehna-catalog';
import { protectedHashes, readState, type PhotoState } from './replace-atehna-generated-images';
import { planProductImageRemediation, validateRemediationAssets, type ImageRemediationManifest } from './remediate-catalog-product-images';
import { isProtectedTechnicalImage, rejectedPhotoIdentities, removeRejectedPayloadMedia } from './catalog-rejected-photos';
import { queueRemovedCatalogMediaFiles } from '../src/shared/server/catalogMediaDeletion';
import { validateCatalogImportManifest, type CatalogImportManifest, type CatalogImportProduct } from './import-atehna-catalog';

type Row = Record<string, unknown>;
const defaultPolicyPath = 'data/catalog/product-image-remediation-2026-09.json';
const replacementMime = (source: string) => /\.png$/iu.test(source) ? 'image/png' : /\.webp$/iu.test(source) ? 'image/webp' : 'image/jpeg';
const canonicalPath = 'data/catalog/atehna-2026-09.json';
const sid = (value: unknown) => String(value);
const url = (row: Row) => String(row.blob_url || row.external_url || '');
const linkKey = (row: Row) => `${row.variant_id}:${row.media_id}`;
const same = (a: unknown, b: unknown) => catalogTypeHash({ value: a }) === catalogTypeHash({ value: b });
const omit = (row: Row, fields: string[]) => Object.fromEntries(Object.entries(row).filter(([key]) => !fields.includes(key)));
function ensure(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }

export function technicalImageSnapshot(state: PhotoState) {
  const media = state.media.filter(isProtectedTechnicalImage);
  const ids = new Set(media.map(row => sid(row.id)));
  return { media, assignments: state.assignments.filter(row => ids.has(sid(row.media_id))) };
}

export function planRejectedProductImageDeletion(before: PhotoState, manifest: ImageRemediationManifest, target: 'local' | 'production') {
  const selected = rejectedPhotoIdentities(manifest, target);
  const find = (slug: string, source: string) => {
    const item = before.items.find(row => row.slug === slug);
    ensure(item && item.status !== 'deleted', `Missing/archived item ${slug}`);
    const matches = before.media.filter(row => sid(row.item_id) === sid(item.id) && url(row) === source);
    ensure(matches.length <= 1, `Ambiguous image ${slug}/${source}`);
    if (matches[0]) ensure(matches[0].media_kind === 'image' && matches[0].role === 'gallery', `Not a gallery image ${slug}/${source}`);
    return matches[0];
  };
  const deletes = selected.flatMap(entry => {
    const row = find(entry.slug, entry.blobUrl);
    if (!row) return [];
    ensure(!isProtectedTechnicalImage(row), `Refusing to remove technical image: ${entry.slug}/${entry.blobUrl}`);
    return [row];
  });
  // A replacement applied during the earlier hide phase may already exist. Its old source is still deleted.
  const replacements = manifest.replacements.filter(entry => !entry.target || entry.target === target).filter(entry => {
    if (find(entry.slug, entry.fromBlobUrl)) return true;
    const destination = target === 'production' ? entry.hostedBlobUrl : entry.blobUrl;
    ensure(destination, `Missing hosted replacement for ${entry.slug}`);
    const existing = find(entry.slug, destination);
    ensure(existing && !existing.hidden && existing.source_kind === 'upload'
      && existing.alt_text === entry.altText && existing.image_type === entry.imageType
      && same(existing.image_dimensions, entry.dimensions), `Missing or changed completed replacement: ${entry.slug}/${destination}`);
    return false;
  });
  const replacementPlan = planProductImageRemediation(before, { removals: [], replacements, restores: [], captions: [], partialUnassignments: [] }, target);
  const expected = replacementPlan.expected;
  for (const inserted of replacementPlan.inserts) {
    const entry = replacements.find(entry => (target === 'production' ? entry.hostedBlobUrl : entry.blobUrl) === url(inserted));
    ensure(entry, 'Inserted replacement has no reviewed source.');
    inserted.mime_type = replacementMime(entry.blobUrl);
  }
  const deletedIds = new Set(deletes.map(row => sid(row.id)));
  expected.media = expected.media.filter(row => !deletedIds.has(sid(row.id)));
  expected.assignments = expected.assignments.filter(row => !deletedIds.has(sid(row.media_id)));
  ensure(same(technicalImageSnapshot(before), technicalImageSnapshot(expected)), 'Technical images, metadata, IDs, positions or links would change.');
  const inserts = expected.media.filter(row => !before.media.some(old => sid(old.id) === sid(row.id)));
  const updates = expected.media.filter(row => before.media.some(old => sid(old.id) === sid(row.id) && !same(old, row)));
  const assignmentDeletes = before.assignments.filter(row => !expected.assignments.some(next => linkKey(row) === linkKey(next)));
  const assignmentInserts = expected.assignments.filter(row => !before.assignments.some(old => linkKey(row) === linkKey(old)));
  for (const row of expected.assignments) {
    const old = before.assignments.find(candidate => linkKey(candidate) === linkKey(row));
    ensure(!old || same(old, row), 'Remaining variant image order would change.');
  }
  const changedItemIds = [...new Set([...deletes, ...inserts, ...updates, ...assignmentDeletes, ...assignmentInserts].map(row => sid(row.item_id)))];
  const mutationCount = deletes.length + inserts.length + updates.length + assignmentDeletes.length + assignmentInserts.length;
  return { expected, deletes, inserts, updates, assignmentDeletes, assignmentInserts, changedItemIds, mutationCount,
    planHash: catalogTypeHash({ target, before, manifest, deletes, inserts, updates, assignmentDeletes, assignmentInserts }) };
}

export function verifyRejectedPhotoDeletion(before: PhotoState, after: PhotoState, plan: ReturnType<typeof planRejectedProductImageDeletion>, ids = new Map<string, string>()) {
  ensure(same(before.variants, after.variants), 'Variant data changed.');
  ensure(same(before.items.map(row => omit(row, ['updated_at'])), after.items.map(row => omit(row, ['updated_at']))), 'Non-image product data changed.');
  ensure(same(technicalImageSnapshot(before), technicalImageSnapshot(after)), 'Technical image rows or links changed.');
  ensure(after.media.length === plan.expected.media.length && after.assignments.length === plan.expected.assignments.length, 'Unexpected media/association row count.');
  for (const expected of plan.expected.media) {
    const id = ids.get(sid(expected.id)) ?? sid(expected.id);
    const actual = after.media.find(row => sid(row.id) === id);
    const fields = ids.has(sid(expected.id)) ? ['id', 'created_at', 'updated_at'] : plan.updates.some(row => sid(row.id) === id) ? ['updated_at'] : [];
    ensure(actual && same(omit(expected, fields), omit(actual, fields)), `Unexpected retained image data/order: ${id}`);
  }
  for (const expected of plan.expected.assignments) {
    const mapped: Row = { ...expected, media_id: ids.get(sid(expected.media_id)) ?? expected.media_id };
    const actual = after.assignments.find(row => sid(row.variant_id) === sid(mapped.variant_id) && sid(row.media_id) === sid(mapped.media_id));
    // New links receive a fresh database creation timestamp; retained links must remain byte-for-byte identical.
    const inserted = plan.assignmentInserts.some(row => linkKey(row) === linkKey(expected));
    const fields = inserted ? ['media_id', 'created_at'] : ['media_id'];
    ensure(actual && same(omit(actual, fields), omit(mapped, fields)), 'Association identity/order verification failed: ' + mapped.variant_id + '/' + mapped.media_id);
  }
}

/** Caller owns the transaction; both associations and storage queue roll back together on failure. */
export async function applyRejectedPhotoDeletion(client: pg.PoolClient, plan: ReturnType<typeof planRejectedProductImageDeletion>) {
  const ids = new Map<string, string>();
  for (const row of plan.inserts) {
    const keys = Object.keys(row).filter(key => key !== 'id');
    const actual = (await client.query(`insert into catalog_media (${keys.join(',')}) values (${keys.map((_, i) => '$' + (i + 1)).join(',')}) returning id`, keys.map(key => key === 'image_dimensions' ? JSON.stringify(row[key]) : row[key]))).rows[0].id;
    ids.set(sid(row.id), sid(actual));
  }
  for (const row of plan.updates) await client.query('update catalog_media set hidden=$1,alt_text=$2,image_type=$3,updated_at=now() where id=$4', [row.hidden, row.alt_text, row.image_type, row.id]);
  for (const row of plan.assignmentDeletes) await client.query('delete from catalog_variant_media where variant_id=$1 and media_id=$2', [row.variant_id, row.media_id]);
  for (const row of plan.deletes) {
    const deleted = await client.query('delete from catalog_media where id=$1 and item_id=$2 returning id', [row.id, row.item_id]);
    ensure(deleted.rowCount === 1, `Image deletion did not persist: ${row.id}`);
  }
  for (const row of plan.assignmentInserts) await client.query('insert into catalog_variant_media(variant_id,item_id,media_id,position) values($1,$2,$3,$4)', [row.variant_id, row.item_id, ids.get(sid(row.media_id)) ?? row.media_id, row.position]);
  for (const itemId of plan.changedItemIds) {
    await queueRemovedCatalogMediaFiles(client, Number(itemId), plan.deletes.filter(row => sid(row.item_id) === itemId));
    await client.query('update catalog_items set updated_at=now() where id=$1', [itemId]);
  }
  return ids;
}

/** Put reviewed replacements at the source slot before removing rejected canonical records. */
export function planCanonicalRejectedPhotoDeletion(before: CatalogImportManifest, manifest: ImageRemediationManifest): CatalogImportManifest {
  const rejected = rejectedPhotoIdentities(manifest);
  const products = before.products.map(product => {
    const isVisibleGallery = (row: CatalogImportProduct['media'][number]) => row.mediaKind === 'image' && row.role === 'gallery' && !row.hidden;
    const originalVisible = product.media.filter(isVisibleGallery);
    const working = structuredClone(product);
    const replacementUrls = new Map<string, string>();
    for (const entry of manifest.replacements.filter(entry => entry.slug === product.slug)) {
      replacementUrls.set(entry.fromBlobUrl, entry.blobUrl);
      const old = working.media.find(row => row.blobUrl === entry.fromBlobUrl);
      let destination = working.media.find(row => row.blobUrl === entry.blobUrl);
      ensure(old || destination, 'Missing canonical replacement anchor: ' + product.slug + '/' + entry.fromBlobUrl);
      if (old) ensure(!isProtectedTechnicalImage(old), 'Refusing to replace canonical technical image: ' + entry.fromBlobUrl);
      if (!destination) {
        destination = { ...structuredClone(old!), filename: path.posix.basename(entry.blobUrl), blobUrl: entry.blobUrl,
          blobPathname: null, externalUrl: null, mimeType: replacementMime(entry.blobUrl), imageDimensions: entry.dimensions,
          imageType: entry.imageType, altText: entry.altText, hidden: false };
        working.media.splice(working.media.indexOf(old!), 0, destination);
      }
      ensure(!destination.hidden && !isProtectedTechnicalImage(destination), 'Canonical replacement is hidden or technical.');
      if (entry.hostedBlobUrl && entry.hostedBlobPathname) {
        working.mediaSourceAliases ??= [];
        const existing = working.mediaSourceAliases.find(alias => alias.localBlobUrl === entry.blobUrl);
        const alias = { localBlobUrl: entry.blobUrl, hostedBlobUrl: entry.hostedBlobUrl, hostedBlobPathname: entry.hostedBlobPathname };
        ensure(!existing || same(existing, alias), 'Canonical hosted alias changed.');
        if (!existing) working.mediaSourceAliases.push(alias);
      }
    }
    const output = removeRejectedPayloadMedia(working, rejected);
    const finalVisible = output.media.filter(isVisibleGallery);
    output.variants = product.variants.map(variant => ({ ...structuredClone(variant),
      ...(variant.imageAssignments === undefined ? {} : { imageAssignments: [...new Set(variant.imageAssignments.flatMap(index => {
        const original = originalVisible[index];
        if (!original) return [];
        const source = replacementUrls.get(original.blobUrl!) ?? original.blobUrl;
        const nextIndex = finalVisible.findIndex(row => row.blobUrl === source);
        return nextIndex < 0 ? [] : [nextIndex];
      }))] })
    }));
    const technical = (value: CatalogImportProduct) => value.media.filter(isProtectedTechnicalImage);
    ensure(same(technical(product), technical(output)), 'Canonical technical image metadata or order changed.');
    return output;
  });
  return validateCatalogImportManifest({ ...before, products });
}

function parseArgs(args: string[]) {
  const plain: string[] = [];
  let expectedPlanHash: string | undefined;
  let canonical = false;
  let manifestPath: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--manifest') {
      ensure(!manifestPath && args[index + 1]?.endsWith('.json'), 'Expected a single JSON manifest path.');
      manifestPath = path.resolve(args[++index]);
    } else if (args[index] === '--expected-plan-hash') {
      ensure(!expectedPlanHash && /^[a-f0-9]{64}$/u.test(args[index + 1] ?? ''), 'Expected a single SHA-256 plan hash.');
      expectedPlanHash = args[++index];
    } else if (args[index] === '--canonical') { ensure(!canonical, 'Repeated --canonical.'); canonical = true; }
    else plain.push(args[index]);
  }
  const options = parseCatalogTypeArgs(plain);
  ensure(!options.apply || expectedPlanHash, 'Apply requires the hash from the internal dry-run plan.');
  return { ...options, expectedPlanHash, canonical, manifestPath: manifestPath ?? defaultPolicyPath };
}

async function snapshot(directory: string, name: string, value: unknown) {
  await mkdir(directory, { recursive: true });
  const bytes = Buffer.from(JSON.stringify(value, null, 2));
  const filename = path.join(directory, name);
  await writeFile(filename, bytes, { flag: 'wx' });
  ensure(bytes.equals(await readFile(filename)), `Snapshot verification failed: ${filename}`);
  return filename;
}

export async function runRejectedProductImageDeletion(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  const manifest = JSON.parse(await readFile(options.manifestPath, 'utf8')) as ImageRemediationManifest;
  const directory = `tmp/catalog-refinements/actual-photo-removal-${options.canonical ? 'canonical' : options.target}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  if (options.canonical) {
    const originalBytes = await readFile(canonicalPath, 'utf8');
    const before = validateCatalogImportManifest(JSON.parse(originalBytes));
    await validateRemediationAssets({ ...manifest, restores: [], captions: [], partialUnassignments: [] }, options.target);
    const after = planCanonicalRejectedPhotoDeletion(before, manifest);
    const removed = before.products.flatMap(product => product.media.filter(row => !after.products.find(next => next.slug === product.slug)!.media.some(next => same(next, row))).map(row => ({ slug: product.slug, blobUrl: row.blobUrl })));
    const planHash = catalogTypeHash({ originalBytes, after, manifest });
    const inserted = after.products.flatMap(product => product.media.filter(row => !before.products.find(prior => prior.slug === product.slug)!.media.some(prior => prior.blobUrl === row.blobUrl)).map(row => ({ slug: product.slug, blobUrl: row.blobUrl })));
    const summary = { target: 'canonical', manifest: options.manifestPath, planHash, mediaDeletes: removed.length, mediaInserts: inserted.length, removed, inserted };
    if (!options.apply) { const review = await snapshot(directory, 'plan.json', summary); console.log(JSON.stringify({ ...summary, review })); return summary; }
    ensure(options.expectedPlanHash === planHash, 'Canonical plan changed; run a fresh dry-run.');
    const backup = await snapshot(directory, 'before.json', { path: canonicalPath, originalBytes, manifest, summary });
    ensure(await readFile(canonicalPath, 'utf8') === originalBytes, 'Canonical source changed while preparing backup.');
    await writeFile(canonicalPath, JSON.stringify(after, null, 2) + '\n');
    ensure(same(after, JSON.parse(await readFile(canonicalPath, 'utf8'))), 'Canonical write verification failed.');
    const result = { ...summary, backup, applied: true, sourceFilesDeleted: 0 };
    await snapshot(directory, 'verification.json', result); console.log(JSON.stringify(result)); return result;
  }
  const connection = resolveCatalogTypeTarget(options.target, process.env.DATABASE_URL);
  // The historical restore/caption operations have already run; only replacement assets are relevant here.
  await validateRemediationAssets({ ...manifest, restores: [], captions: [], partialUnassignments: [] }, options.target);
  const pool = new pg.Pool({ connectionString: connection.connectionString, max: 1 });
  const client = await pool.connect();
  let committed = false;
  try {
    await client.query(options.apply ? 'begin isolation level serializable' : 'begin isolation level repeatable read read only');
    if (options.apply) await client.query("select pg_advisory_xact_lock(hashtext('atehna-product-image-remediation-2026-09'))");
    const before = await readState(client, options.apply);
    const plan = planRejectedProductImageDeletion(before, manifest, options.target);
    const summary = { target: options.target, manifest: options.manifestPath, planHash: plan.planHash, changedProducts: plan.changedItemIds.length,
      mediaDeletes: plan.deletes.length, mediaInserts: plan.inserts.length, mediaUpdates: plan.updates.length,
      associationRemovals: plan.assignmentDeletes.length, associationAdditions: plan.assignmentInserts.length, mutationCount: plan.mutationCount,
      removed: plan.deletes.map(row => ({ id: row.id, itemId: row.item_id, slug: before.items.find(item => sid(item.id) === sid(row.item_id))?.slug,
        blobUrl: url(row), hidden: row.hidden, position: row.position, variantLinks: before.assignments.filter(link => sid(link.media_id) === sid(row.id)) })),
      protectedTechnicalImages: technicalImageSnapshot(before).media.length, sourceFilesDeleted: 0 };
    if (!options.apply) {
      await client.query('rollback'); const review = await snapshot(directory, 'plan.json', summary);
      console.log(JSON.stringify({ ...summary, review })); return summary;
    }
    ensure(options.expectedPlanHash === plan.planHash, 'Live image plan changed; run a fresh dry-run.');
    const hashes = await protectedHashes(client);
    const outboxBefore = (await client.query('select * from archive_blob_deletion_outbox order by id')).rows;
    const backup = await snapshot(directory, 'before.json', { target: options.target, before, hashes, outboxBefore, manifest, summary,
      rollback: 'Full original catalog rows, variant links and outbox are preserved here with original IDs and timestamps. No source bytes are deleted by this phase.' });
    const ids = await applyRejectedPhotoDeletion(client, plan);
    const after = await readState(client);
    verifyRejectedPhotoDeletion(before, after, plan, ids);
    ensure(same(hashes, await protectedHashes(client)), 'Protected catalog or commerce data changed.');
    ensure(planRejectedProductImageDeletion(after, manifest, options.target).mutationCount === 0, 'Repeat deletion plan is not a no-op.');
    const outboxAfter = (await client.query('select * from archive_blob_deletion_outbox order by id')).rows;
    for (const prior of outboxBefore) ensure(outboxAfter.some(row => same(prior, row)), 'Existing storage deletion queue changed.');
    const queueAdditions = outboxAfter.filter(row => !outboxBefore.some(prior => sid(prior.id) === sid(row.id)));
    // Save the exact post-image state before commit, so rollback can detect intervening edits.
    await snapshot(directory, 'after.json', { after, outboxAfter, insertedMediaIds: [...ids.values()], queueAdditions, planHash: plan.planHash });
    await client.query('commit'); committed = true;
    const result = { ...summary, backup, applied: true, queueAdditions: queueAdditions.length,
      verifiedUnrelatedDataPreserved: true, verifiedTechnicalImagesPreserved: true, repeatPlanMutations: 0,
      cacheInvalidationRequired: ['catalog-public', 'catalog-admin'] };
    await snapshot(directory, 'verification.json', result); console.log(JSON.stringify(result)); return result;
  } catch (error) { if (!committed) await client.query('rollback'); throw error; }
  finally { client.release(); await pool.end(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) runRejectedProductImageDeletion().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
