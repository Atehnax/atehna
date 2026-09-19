/** Add verified photographs without requiring a deleted predecessor. Dry-run first; exact plan hashes gate apply. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import sharp from 'sharp';
import { catalogTypeHash, parseCatalogTypeArgs, resolveCatalogTypeTarget } from './reclassify-atehna-catalog';
import { protectedHashes, readState, realPhotoProvenance, type PhotoState } from './replace-atehna-generated-images';
import { applyRejectedPhotoDeletion, technicalImageSnapshot, verifyRejectedPhotoDeletion, type planRejectedProductImageDeletion } from './delete-rejected-product-images';
import { isProtectedTechnicalImage, rejectedPhotoIdentities, type RejectedPhotoPolicy } from './catalog-rejected-photos';
import { validateCatalogImportManifest, type CatalogImportManifest, type CatalogImportProduct } from './import-atehna-catalog';

type Row = Record<string, unknown>;
type Target = 'local' | 'production';
type ImagePlan = ReturnType<typeof planRejectedProductImageDeletion>;
export type ReviewedImageAddition = {
  id: string; slug: string; variantSkus: string[]; blobUrl: string; sha256: string;
  dimensions: { width: number; height: number }; sourcePage: string; sourceUrl: string; sourceIdentityEvidence: string;
  originalBytes: true; humanFree: true; visuallyReviewed: true; exactVariantMatch: true;
  imageType: 'product' | 'context'; role: 'main' | 'detail'; view: string; altText: string;
  hostedBlobUrl?: string; hostedBlobPathname?: string;
  /** Explicit review of the complete retained SKU set plus new exact variants; never removes links. */
  allowExistingAssociationAdditions?: true;
};
export type ReviewedImageAdditionManifest = { version: 4; reviewedAt: string; additions: ReviewedImageAddition[] };
export type RejectedImageSources = { identities: Set<string>; hashes: Set<string> };
const sid = (value: unknown) => String(value);
const sourceUrl = (row: Row) => String(row.blob_url || row.external_url || '');
const same = (left: unknown, right: unknown) => catalogTypeHash({ value: left }) === catalogTypeHash({ value: right });
const urlIdentity = (slug: string, source: string) => slug + '\n' + source;
const hashBytes = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const MAX_BYTES = 20 * 1024 * 1024;
const mimeFor = (source: string) => /\.png$/u.test(source) ? 'image/png' : /\.webp$/u.test(source) ? 'image/webp' : /\.avif$/u.test(source) ? 'image/avif' : 'image/jpeg';
function ensure(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const unique = (values: string[]) => new Set(values).size === values.length;
const isPhoto = (row: Row) => row.media_kind === 'image' && row.role === 'gallery' && !row.hidden && !isProtectedTechnicalImage(row);
const compareIds = (left: unknown, right: unknown) => sid(left).localeCompare(sid(right), 'en', { numeric: true });
const position = (row: Row) => { const value = Number(row.position); ensure(Number.isSafeInteger(value), 'Invalid existing image/association position.'); return value; };
function validPosition(value: number) { ensure(Number.isInteger(value) && value >= -2147483648 && value <= 2147483647, 'No safe image position remains without a separate reorder.'); return value; }

export function validateImageAdditionManifest(manifest: ReviewedImageAdditionManifest): void {
  ensure(manifest?.version === 4 && Number.isFinite(Date.parse(manifest.reviewedAt)) && Array.isArray(manifest.additions) && manifest.additions.length > 0, 'Expected a reviewed version4 additions ledger.');
  ensure(unique(manifest.additions.map(entry => entry.id)) && unique(manifest.additions.map(entry => urlIdentity(entry.slug, entry.blobUrl))), 'Duplicate reviewed image identity.');
  ensure(unique(manifest.additions.map(entry => urlIdentity(entry.slug, entry.sha256))), 'The same photograph cannot count as an additional view of a product.');
  for (const entry of manifest.additions) {
    ensure(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(entry.id) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(entry.slug), 'Invalid reviewed image/product identifier.');
    ensure(Array.isArray(entry.variantSkus) && entry.variantSkus.length > 0 && entry.variantSkus.every(sku => typeof sku === 'string' && sku.length > 0 && sku === sku.trim()) && unique(entry.variantSkus), 'Every photograph requires explicit unique exact variantSkus; global fallback is forbidden.');
    ensure(entry.allowExistingAssociationAdditions === undefined || entry.allowExistingAssociationAdditions === true, 'Existing association additions require explicit literal true.');
    ensure(/^\/images\/catalog\/\d{4}-\d{2}\/[a-z0-9-]+\.(?:jpe?g|png|webp|avif)$/u.test(entry.blobUrl), 'Unsafe reviewed source path.');
    ensure(/^[a-f0-9]{64}$/u.test(entry.sha256) && entry.dimensions?.width >= 1024 && entry.dimensions?.height >= 1024 && Number.isInteger(entry.dimensions.width) && Number.isInteger(entry.dimensions.height), 'Reviewed originals must meet1024px on both axes.');
    ensure(entry.originalBytes === true && entry.humanFree === true && entry.visuallyReviewed === true && entry.exactVariantMatch === true, 'Missing original-byte, no-human, visual or exact-variant review.');
    ensure(['product', 'context'].includes(entry.imageType) && ['main', 'detail'].includes(entry.role) && (entry.role !== 'main' || entry.imageType === 'product'), 'Main images must be complete product views.');
    ensure(entry.view?.trim() && entry.altText?.trim() && entry.sourceIdentityEvidence?.trim(), 'View, alt text and exact identity evidence are required.');
    for (const source of [entry.sourcePage, entry.sourceUrl]) { const parsed = new URL(source); ensure(parsed.protocol === 'https:' && !parsed.username && !parsed.password, 'Sources must be documented HTTPS pages/originals.'); }
    ensure(!isProtectedTechnicalImage({ image_type: entry.imageType, blob_url: entry.blobUrl, alt_text: entry.altText }), 'Technical schematics do not count as new product photographs.');
  }
  ensure(unique(manifest.additions.filter(entry => entry.role === 'main').flatMap(entry => entry.variantSkus.map(sku => entry.slug + '\n' + sku))), 'Only one main photograph may be designated per exact variant in one ledger.');
}

export async function loadRejectedImageSources(root = process.cwd()): Promise<RejectedImageSources> {
  const identities = new Set<string>(); const hashes = new Set<string>();
  for (const file of ['product-image-remediation-2026-09.json', 'product-image-remediation-v3-2026-09.json']) {
    const policy = JSON.parse(await readFile(path.join(root, 'data/catalog', file), 'utf8')) as RejectedPhotoPolicy & { removals: Array<{ sha256?: string }>; replacements: Array<{ fromSha256?: string }> };
    for (const entry of rejectedPhotoIdentities(policy)) identities.add(urlIdentity(entry.slug, entry.blobUrl));
    for (const entry of policy.removals) if (entry.sha256) hashes.add(entry.sha256);
    for (const entry of policy.replacements) if (entry.fromSha256) hashes.add(entry.fromSha256);
  }
  const history = JSON.parse(await readFile(path.join(root, 'data/catalog/image-upgrades-2026-09.json'), 'utf8'));
  for (const hash of realPhotoProvenance(history.products).generatedHashes) hashes.add(hash);
  return { identities, hashes };
}

export async function inspectReviewedImageOriginal(entry: ReviewedImageAddition, bytes: Buffer, forbidden: RejectedImageSources) {
  ensure(!forbidden.identities.has(urlIdentity(entry.slug, entry.blobUrl)) && !forbidden.identities.has(urlIdentity(entry.slug, entry.hostedBlobUrl ?? '')), 'A rejected image identity cannot be reintroduced.');
  ensure(bytes.length <= MAX_BYTES && bytes.length > 0 && hashBytes(bytes) === entry.sha256, 'Native original checksum/size differs from its reviewed source ledger.');
  ensure(!forbidden.hashes.has(entry.sha256), 'Rejected or generated source bytes cannot be reintroduced under another filename.');
  const decoder = sharp(bytes, { failOn: 'error', limitInputPixels: 80_000_000 });
  const metadata = await decoder.metadata();
  ensure(metadata.width === entry.dimensions.width && metadata.height === entry.dimensions.height && metadata.width >= 1024 && metadata.height >= 1024, 'Actual native dimensions differ from the reviewed minimum.');
  const actualMime = metadata.format === 'heif' && metadata.compression === 'av1' ? 'image/avif' : 'image/' + metadata.format;
  ensure(actualMime === mimeFor(entry.blobUrl), 'Original format and filename differ.');
  await decoder.stats(); // Decode the original; readable header metadata alone is not sufficient.
  return mimeFor(entry.blobUrl);
}

async function hostedBytes(entry: ReviewedImageAddition) {
  ensure(entry.hostedBlobUrl && entry.hostedBlobPathname, 'Production addition requires a verified immutable hosted URL/pathname.');
  const source = new URL(entry.hostedBlobUrl);
  ensure(source.protocol === 'https:' && /^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/u.test(source.hostname) && !source.username && !source.password && !source.port && !source.search && !source.hash, 'Unexpected hosted image origin.');
  ensure(entry.hostedBlobPathname.startsWith(`catalog-items/${entry.slug}/images/`) && decodeURIComponent(source.pathname.slice(1)) === entry.hostedBlobPathname && !/[\\%?#]/u.test(entry.hostedBlobPathname) && !entry.hostedBlobPathname.split('/').includes('..'), 'Hosted source URL/pathname/product mismatch.');
  const response = await fetch(source, { redirect: 'error', signal: AbortSignal.timeout(20000) });
  ensure(response.ok && response.body, 'Hosted reviewed source is not reachable.');
  const chunks: Buffer[] = []; let size = 0;
  const reader = response.body.getReader();
  try { while (true) { const part = await reader.read(); if (part.done) break; const chunk = Buffer.from(part.value); size += chunk.length; ensure(size <= MAX_BYTES, 'Hosted source exceeds20MB.'); chunks.push(chunk); } }
  finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
  return Buffer.concat(chunks);
}

export async function validateReviewedImageAssets(manifest: ReviewedImageAdditionManifest, target: Target, root = process.cwd()) {
  validateImageAdditionManifest(manifest);
  const forbidden = await loadRejectedImageSources(root);
  const publicRoot = await realpath(path.join(root, 'public'));
  for (const entry of manifest.additions) {
    const file = await realpath(path.join(publicRoot, entry.blobUrl)); const relative = path.relative(publicRoot, file);
    ensure(relative && !relative.startsWith('..') && !path.isAbsolute(relative), 'Reviewed source escapes public directory.');
    await inspectReviewedImageOriginal(entry, await readFile(file), forbidden);
    if (target === 'production') ensure(hashBytes(await hostedBytes(entry)) === entry.sha256, 'Hosted bytes differ from the verified native original.');
  }
}

export function planReviewedImageAdditions(before: PhotoState, manifest: ReviewedImageAdditionManifest, target: Target): ImagePlan {
  validateImageAdditionManifest(manifest);
  const expected = structuredClone(before); const inserts: Row[] = []; const assignmentInserts: Row[] = [];
  const initialMinimum = new Map<string, number>();
  for (const item of before.items) initialMinimum.set(sid(item.id), Math.min(0, ...before.media.filter(row => sid(row.item_id) === sid(item.id)).map(position)));
  // Main views are inserted before detail views regardless of ledger ordering.
  const ordered = [...manifest.additions.filter(entry => entry.role === 'main'), ...manifest.additions.filter(entry => entry.role === 'detail')];
  for (const entry of ordered) {
    const item = expected.items.find(row => row.slug === entry.slug); ensure(item && item.status !== 'deleted', 'Missing/archived product: ' + entry.slug);
    const variants = entry.variantSkus.map(sku => { const matches = expected.variants.filter(row => sid(row.item_id) === sid(item.id) && row.variant_sku === sku); ensure(matches.length === 1, 'Missing/ambiguous exact variant SKU: ' + entry.slug + '/' + sku); return matches[0]; });
    const source = target === 'production' ? entry.hostedBlobUrl : entry.blobUrl;
    ensure(source && (target !== 'production' || entry.hostedBlobPathname), 'Missing hosted addition.');
    const matches = expected.media.filter(row => sid(row.item_id) === sid(item.id) && sourceUrl(row) === source); ensure(matches.length <= 1, 'Ambiguous existing image URL.');
    const variantIds = variants.map(row => sid(row.id)).sort();
    const existing = matches[0];
    ensure(!entry.allowExistingAssociationAdditions || existing, 'Reviewed association addition requires the existing photo; it cannot create a replacement.');
    if (existing) {
      ensure(isPhoto(existing) && existing.source_kind === 'upload' && existing.alt_text === entry.altText && existing.image_type === entry.imageType && existing.mime_type === mimeFor(entry.blobUrl) && same(existing.image_dimensions, entry.dimensions), 'Existing reviewed image metadata/visibility changed.');
      if (target === 'production') ensure(existing.blob_pathname === entry.hostedBlobPathname, 'Existing hosted image pathname changed.');
      const priorLinks = expected.assignments.filter(row => sid(row.media_id) === sid(existing.id));
      const linked = priorLinks.map(row => sid(row.variant_id)).sort();
      if (!entry.allowExistingAssociationAdditions) {
        ensure(same(linked, variantIds), 'Existing source has different variant assignments; never turn an unassigned photo into a global fallback.');
        continue;
      }
      ensure(existing.filename === path.posix.basename(entry.blobUrl) && !existing.external_url && !existing.video_type, 'Existing reviewed source metadata changed.');
      ensure(linked.length > 0 && unique(linked) && priorLinks.every(row => sid(row.item_id) === sid(item.id)) && linked.every(id => variantIds.includes(id)), 'Reviewed association additions must include every existing exact variant link and cannot adopt an unassigned photo.');
      for (const variant of variants.filter(row => !linked.includes(sid(row.id)))) {
        const prior = expected.assignments.filter(row => sid(row.variant_id) === sid(variant.id));
        const photos = expected.media.filter(row => sid(row.item_id) === sid(item.id) && isPhoto(row) && prior.some(link => sid(link.media_id) === sid(row.id)));
        const precedes = (left: Row, right: Row) => position(left) < position(right) || (position(left) === position(right) && compareIds(left.id, right.id) < 0);
        if (entry.role === 'detail') ensure(photos.some(photo => photo.image_type !== 'context' && precedes(photo, existing)), 'An existing detail view requires an explicitly assigned main product photo before it for every new target variant.');
        else ensure(photos.every(photo => precedes(existing, photo)), 'An existing main photo cannot be promoted without changing retained gallery order.');
        // A new link gets its own position; all retained links and the shared media row stay untouched.
        const linkPosition = entry.role === 'main' ? Math.min(0, ...prior.map(position)) - 1 : Math.max(0, ...prior.map(position)) + 1;
        const link = { variant_id: variant.id, item_id: item.id, media_id: existing.id, position: validPosition(linkPosition) };
        expected.assignments.push(link); assignmentInserts.push(link);
      }
      continue;
    }
    const photos = expected.media.filter(row => sid(row.item_id) === sid(item.id) && isPhoto(row));
    if (entry.role === 'detail') for (const variant of variants) ensure(photos.some(photo => photo.image_type !== 'context' && expected.assignments.some(link => sid(link.media_id) === sid(photo.id) && sid(link.variant_id) === sid(variant.id))), 'A detail view requires an explicitly assigned main product photo for every target variant.');
    const earlierMainCount = inserts.filter(row => sid(row.item_id) === sid(item.id) && position(row) < initialMinimum.get(sid(item.id))!).length;
    // Tied detail positions sort by increasing media ID, after the existing photo. No retained row is renumbered.
    const mediaPosition = entry.role === 'main' ? initialMinimum.get(sid(item.id))! - ordered.filter(candidate => candidate.slug === entry.slug && candidate.role === 'main').length + earlierMainCount
      : Math.max(...photos.filter(photo => expected.assignments.some(link => sid(link.media_id) === sid(photo.id) && variantIds.includes(sid(link.variant_id)))).map(position));
    const row: Row = { id: `new-v4:${entry.slug}:${entry.id}`, item_id: item.id, media_kind: 'image', role: 'gallery', source_kind: 'upload', filename: path.posix.basename(entry.blobUrl), blob_url: source, blob_pathname: target === 'production' ? entry.hostedBlobPathname : null, external_url: null, mime_type: mimeFor(entry.blobUrl), video_type: null, position: validPosition(mediaPosition), hidden: false, alt_text: entry.altText, image_type: entry.imageType, image_dimensions: entry.dimensions };
    expected.media.push(row); inserts.push(row);
    for (const variant of variants) {
      const prior = expected.assignments.filter(link => sid(link.variant_id) === sid(variant.id));
      const linkedPhotos = prior.filter(link => expected.media.some(photo => sid(photo.id) === sid(link.media_id) && isPhoto(photo)));
      const linkPosition = entry.role === 'main' ? Math.min(0, ...prior.map(position)) - 1 : Math.max(...linkedPhotos.map(position));
      const link = { variant_id: variant.id, item_id: item.id, media_id: row.id, position: validPosition(linkPosition) };
      expected.assignments.push(link); assignmentInserts.push(link);
    }
  }
  ensure(same(technicalImageSnapshot(before), technicalImageSnapshot(expected)), 'Technical image records or associations changed.');
  const changedItemIds = [...new Set([...inserts, ...assignmentInserts].map(row => sid(row.item_id)))];
  return { expected, inserts, assignmentInserts, deletes: [], updates: [], assignmentDeletes: [], changedItemIds, mutationCount: inserts.length + assignmentInserts.length, planHash: catalogTypeHash({ target, before, manifest, inserts, assignmentInserts }) };
}

export function planCanonicalReviewedImageAdditions(before: CatalogImportManifest, manifest: ReviewedImageAdditionManifest): CatalogImportManifest {
  const state: PhotoState = { items: [], variants: [], media: [], assignments: [] };
  const originals = new Map<string, CatalogImportProduct['media'][number]>();
  for (const product of before.products) {
    const itemId = 'item:' + product.slug; state.items.push({ id: itemId, slug: product.slug, status: product.status });
    const galleryIds: string[] = [];
    product.media.forEach((media, index) => {
      const id = `canonical:${product.slug}:${index}`; originals.set(id, media);
      state.media.push({ id, item_id: itemId, media_kind: media.mediaKind, role: media.role, source_kind: media.sourceKind, filename: media.filename ?? null, blob_url: media.blobUrl ?? null, blob_pathname: media.blobPathname ?? null, external_url: media.externalUrl ?? null, mime_type: media.mimeType ?? null, video_type: media.videoType ?? null, position: media.position ?? index, hidden: Boolean(media.hidden), alt_text: media.altText ?? null, image_type: media.imageType ?? null, image_dimensions: media.imageDimensions ?? null });
      if (media.mediaKind === 'image' && media.role === 'gallery' && !media.hidden) galleryIds.push(id);
    });
    product.variants.forEach((variant, index) => {
      const id = `variant:${product.slug}:${index}`; state.variants.push({ id, item_id: itemId, variant_sku: variant.variantSku });
      (variant.imageAssignments ?? []).forEach((slot, position) => { ensure(galleryIds[slot], 'Invalid canonical assignment.'); state.assignments.push({ variant_id: id, item_id: itemId, media_id: galleryIds[slot], position }); });
    });
  }
  const plan = planReviewedImageAdditions(state, manifest, 'local');
  const products = before.products.map(product => {
    const output = structuredClone(product); const itemId = 'item:' + product.slug;
    const rows = plan.expected.media.filter(row => row.item_id === itemId).sort((a, b) => position(a) - position(b) || (originals.has(sid(a.id)) && originals.has(sid(b.id)) ? compareIds(a.id, b.id) : originals.has(sid(a.id)) ? -1 : originals.has(sid(b.id)) ? 1 : plan.inserts.indexOf(a) - plan.inserts.indexOf(b)));
    ensure(same(rows.filter(row => originals.has(sid(row.id))).map(row => sid(row.id)), state.media.filter(row => row.item_id === itemId).map(row => sid(row.id))), 'Canonical pre-existing order would change.');
    output.media = rows.map(row => originals.has(sid(row.id)) ? structuredClone(originals.get(sid(row.id))!) : ({ mediaKind: 'image', role: 'gallery', sourceKind: 'upload', filename: String(row.filename), blobUrl: String(row.blob_url), mimeType: String(row.mime_type), altText: String(row.alt_text), imageType: String(row.image_type), imageDimensions: row.image_dimensions as { width: number; height: number }, hidden: false, position: position(row) }));
    const visibleIds = rows.filter(row => row.media_kind === 'image' && row.role === 'gallery' && !row.hidden).map(row => sid(row.id));
    output.variants = product.variants.map((variant, index) => {
      const id = `variant:${product.slug}:${index}`; const linked = plan.expected.assignments.filter(row => row.variant_id === id).sort((a, b) => position(a) - position(b) || visibleIds.indexOf(sid(a.media_id)) - visibleIds.indexOf(sid(b.media_id)));
      return { ...structuredClone(variant), ...(variant.imageAssignments === undefined && !linked.length ? {} : { imageAssignments: linked.map(row => { const slot = visibleIds.indexOf(sid(row.media_id)); ensure(slot >= 0, 'Canonical assigned image disappeared.'); return slot; }) }) };
    });
    for (const entry of manifest.additions.filter(entry => entry.slug === product.slug && entry.hostedBlobUrl && entry.hostedBlobPathname)) {
      output.mediaSourceAliases ??= [];
      const alias = { localBlobUrl: entry.blobUrl, hostedBlobUrl: entry.hostedBlobUrl!, hostedBlobPathname: entry.hostedBlobPathname! };
      const existing = output.mediaSourceAliases.find(row => row.localBlobUrl === alias.localBlobUrl); ensure(!existing || same(existing, alias), 'Canonical hosted alias changed.');
      if (!existing) output.mediaSourceAliases.push(alias);
    }
    return output;
  });
  return validateCatalogImportManifest({ ...before, products });
}

async function saveSnapshot(directory: string, name: string, data: unknown) {
  await mkdir(directory, { recursive: true }); const bytes = Buffer.from(JSON.stringify(data, null, 2)); const file = path.join(directory, name);
  await writeFile(file, bytes, { flag: 'wx' }); ensure(bytes.equals(await readFile(file)), 'Snapshot reread failed.'); return file;
}

export async function runReviewedImageAdditions(args = process.argv.slice(2)) {
  const plain: string[] = []; let manifestPath: string | undefined; let expectedPlanHash: string | undefined; let canonical = false;
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (flag === '--manifest') { ensure(!manifestPath && args[index + 1]?.endsWith('.json'), 'Supply one reviewed additions manifest.'); manifestPath = path.resolve(args[++index]); }
    else if (flag === '--expected-plan-hash') { ensure(!expectedPlanHash && /^[a-f0-9]{64}$/u.test(args[index + 1] ?? ''), 'Supply one exact internal plan hash.'); expectedPlanHash = args[++index]; }
    else if (flag === '--canonical') { ensure(!canonical, 'Repeated --canonical.'); canonical = true; }
    else plain.push(flag);
  }
  const options = parseCatalogTypeArgs(plain); ensure(manifestPath && (!options.apply || expectedPlanHash), 'Manifest and, for apply, the internal reviewed plan hash are required.');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as ReviewedImageAdditionManifest;
  await validateReviewedImageAssets(manifest, options.target);
  const directory = `tmp/catalog-refinements/add-reviewed-photos-${canonical ? 'canonical' : options.target}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  if (canonical) {
    const file = 'data/catalog/atehna-2026-09.json'; const originalBytes = await readFile(file, 'utf8'); const before = validateCatalogImportManifest(JSON.parse(originalBytes));
    const after = planCanonicalReviewedImageAdditions(before, manifest); const planHash = catalogTypeHash({ originalBytes, after, manifest });
    const summary = { target: 'canonical', manifest: manifestPath, planHash, photoInserts: after.products.reduce((sum, product, index) => sum + product.media.length - before.products[index].media.length, 0), associationInserts: after.products.reduce((sum, product, index) => sum + product.variants.reduce((count, variant, variantIndex) => count + (variant.imageAssignments?.length ?? 0) - (before.products[index].variants[variantIndex].imageAssignments?.length ?? 0), 0), 0) };
    if (!options.apply) { const review = await saveSnapshot(directory, 'plan.json', summary); console.log(JSON.stringify({ ...summary, review })); return summary; }
    ensure(expectedPlanHash === planHash, 'Canonical plan changed; run a fresh dry-run.');
    const backup = await saveSnapshot(directory, 'before.json', { originalBytes, manifest, summary }); ensure(await readFile(file, 'utf8') === originalBytes, 'Canonical changed during snapshot.');
    await writeFile(file, JSON.stringify(after, null, 2) + '\n'); ensure(same(after, JSON.parse(await readFile(file, 'utf8'))), 'Canonical write verification failed.');
    ensure(same(after, planCanonicalReviewedImageAdditions(after, manifest)), 'Canonical repeat plan differs.');
    const result = { ...summary, backup, applied: true, repeatPlanMutations: 0 }; await saveSnapshot(directory, 'verification.json', result); console.log(JSON.stringify(result)); return result;
  }
  const target = resolveCatalogTypeTarget(options.target, process.env.DATABASE_URL); const pool = new pg.Pool({ connectionString: target.connectionString, max: 1 }); const client = await pool.connect(); let committed = false;
  try {
    await client.query(options.apply ? 'begin isolation level serializable' : 'begin isolation level repeatable read read only');
    if (options.apply) await client.query("select pg_advisory_xact_lock(hashtext('atehna-product-image-remediation-2026-09'))");
    const before = await readState(client, options.apply); const plan = planReviewedImageAdditions(before, manifest, options.target);
    const summary = { target: options.target, manifest: manifestPath, planHash: plan.planHash, photoInserts: plan.inserts.length, associationInserts: plan.assignmentInserts.length, mutationCount: plan.mutationCount, protectedTechnicalImages: technicalImageSnapshot(before).media.length,
      additions: plan.inserts.map(row => ({ slug: before.items.find(item => sid(item.id) === sid(row.item_id))?.slug, blobUrl: sourceUrl(row), position: row.position, variantIds: plan.assignmentInserts.filter(link => link.media_id === row.id).map(link => link.variant_id) })),
      existingPhotoAssociations: plan.assignmentInserts.filter(link => before.media.some(row => sid(row.id) === sid(link.media_id))).map(link => ({ slug: before.items.find(item => sid(item.id) === sid(link.item_id))?.slug, mediaId: link.media_id, variantSku: before.variants.find(variant => sid(variant.id) === sid(link.variant_id))?.variant_sku, position: link.position })) };
    if (!options.apply) { await client.query('rollback'); const review = await saveSnapshot(directory, 'plan.json', summary); console.log(JSON.stringify({ ...summary, review })); return summary; }
    ensure(expectedPlanHash === plan.planHash, 'Live additive plan changed; run a fresh dry-run.');
    const hashes = await protectedHashes(client); const queueBefore = (await client.query('select * from archive_blob_deletion_outbox order by id')).rows;
    const backup = await saveSnapshot(directory, 'before.json', { target: options.target, before, hashes, queueBefore, manifest, summary });
    const ids = await applyRejectedPhotoDeletion(client, plan); const after = await readState(client); verifyRejectedPhotoDeletion(before, after, plan, ids);
    ensure(same(hashes, await protectedHashes(client)), 'Unrelated catalog/commerce data changed.');
    ensure(same(queueBefore, (await client.query('select * from archive_blob_deletion_outbox order by id')).rows), 'Additions changed the storage deletion queue.');
    ensure(planReviewedImageAdditions(after, manifest, options.target).mutationCount === 0, 'Repeat additions plan is not a no-op.');
    await saveSnapshot(directory, 'after.json', { after, insertedMediaIds: [...ids.values()], queueBefore, planHash: plan.planHash });
    await client.query('commit'); committed = true;
    const result = { ...summary, backup, applied: true, retainedImagesAndTechnicalAssociationsUnchanged: true, repeatPlanMutations: 0, cacheInvalidationRequired: ['catalog-public', 'catalog-admin'] };
    await saveSnapshot(directory, 'verification.json', result); console.log(JSON.stringify(result)); return result;
  } catch (error) { if (!committed) await client.query('rollback'); throw error; }
  finally { client.release(); await pool.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) runReviewedImageAdditions().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
