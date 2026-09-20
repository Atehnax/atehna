import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { planProductImageRemediation, validateRemediationSourceChecksums, type ImageRemediationManifest } from '../../scripts/remediate-catalog-product-images';
import { validateCatalogImportManifest } from '../../scripts/import-atehna-catalog';
import type { CatalogItemEditorVariantPayload } from '../../src/shared/domain/catalog/catalogAdminTypes';
import type { PhotoState } from '../../scripts/replace-atehna-generated-images';

const empty = (): ImageRemediationManifest => ({ removals: [], restores: [], captions: [], replacements: [], partialUnassignments: [] });
const photo = (id: number, url: string, position: number, hidden = false) => ({ id, item_id: 1, media_kind: 'image', role: 'gallery', source_kind: 'upload', blob_url: url, blob_pathname: null, external_url: null, position, hidden, image_type: 'product', alt_text: url });
const link = (variantId: number, mediaId: number, position: number) => ({ variant_id: variantId, item_id: 1, media_id: mediaId, position });
const state = (): PhotoState => ({
  items: [{ id: 1, slug: 'tool', status: 'active', item_name: 'Tool', price: 40 }],
  variants: [{ id: 11, item_id: 1, variant_name: '200 g', price: 12 }, { id: 12, item_id: 1, variant_name: '300 g', price: 15 }, { id: 13, item_id: 1, variant_name: '200 g, pack' }],
  media: [photo(1, '/rejected.jpg', -8), photo(2, '/remaining.jpg', 4), photo(3, '/old.jpg', 7), photo(4, '/restored.jpg', 12, true)],
  assignments: [link(11, 1, 1), link(11, 2, 6), link(12, 2, 8), link(11, 3, 9), link(12, 4, 3)]
});
const replacement = (): ImageRemediationManifest['replacements'][number] => ({
  slug: 'tool', fromBlobUrl: '/old.jpg', fromSha256: 'a'.repeat(64), blobUrl: '/images/catalog/2026-09/new.jpg', sha256: 'b'.repeat(64),
  dimensions: { width: 1600, height: 1200 }, sourcePage: 'https://maker.example/product', sourceUrl: 'https://maker.example/original.jpg',
  visuallyReviewed: true, humanFree: true, originalBytes: true, imageType: 'product', altText: 'Exact tool',
  hostedBlobUrl: 'https://catalog.public.blob.vercel-storage.com/catalog-items/tool/images/new.jpg',
  hostedBlobPathname: 'catalog-items/tool/images/new.jpg'
});

test('image remediation preserves remaining order and unrelated data and becomes a no-op on repeat', () => {
  const before = state();
  const snapshot = structuredClone(before);
  const manifest: ImageRemediationManifest = { ...empty(), removals: [{ slug: 'tool', blobUrl: '/rejected.jpg' }], replacements: [replacement()] };
  const plan = planProductImageRemediation(before, manifest, 'local');
  assert.deepEqual(before, snapshot, 'planning never mutates its input');
  assert.deepEqual(plan.expected.items, snapshot.items);
  assert.deepEqual(plan.expected.variants, snapshot.variants);
  assert.deepEqual(plan.expected.media.find(row => row.id === 2), snapshot.media[1]);
  assert.deepEqual(plan.expected.assignments.filter(row => row.media_id === 2), snapshot.assignments.filter(row => row.media_id === 2));
  assert.equal(plan.inserts[0].position, snapshot.media[2].position);
  assert.equal(plan.assignmentInserts[0].position, 9);
  assert.equal(plan.expected.media.find(row => row.id === 1)?.hidden, true);
  assert.equal(plan.expected.media.find(row => row.id === 3)?.hidden, true);
  assert.equal(planProductImageRemediation(plan.expected, manifest, 'local').mutationCount, 0);
});

test('removing the final image leaves retained rollback bytes and no visible picture or variant link', () => {
  const before = state();
  before.media = [before.media[0]];
  before.assignments = [before.assignments[0]];
  const plan = planProductImageRemediation(before, { ...empty(), removals: [{ slug: 'tool', blobUrl: '/rejected.jpg' }] }, 'local');
  assert.equal(plan.expected.media.length, 1);
  assert.equal(plan.expected.media.filter(row => !row.hidden).length, 0);
  assert.deepEqual(plan.expected.assignments, []);
});

test('restoration assigns exact variant names, removes incorrect links, and preserves already correct positions', () => {
  const before = state();
  before.assignments.push(link(11, 4, 15));
  const manifest: ImageRemediationManifest = { ...empty(), restores: [{ slug: 'tool', blobUrl: '/restored.jpg', imageType: 'product', altText: 'Supplier original', variantNames: [' 200 g ', '200 g, pack'] }] };
  const plan = planProductImageRemediation(before, manifest, 'local');
  const assigned = plan.expected.assignments.filter(row => row.media_id === 4);
  assert.deepEqual(assigned.map(row => row.variant_id), [11, 13]);
  assert.equal(assigned[0].position, 15);
  assert.equal(plan.expected.media.find(row => row.id === 4)?.hidden, false);
  assert.equal(planProductImageRemediation(plan.expected, manifest, 'local').mutationCount, 0);
  assert.throws(() => planProductImageRemediation(before, { ...manifest, restores: [{ ...manifest.restores[0], variantNames: ['400 g'] }] }, 'local'), /Missing\/ambiguous variant/u);
});

test('removing a wrong variant link preserves the valid link and refuses accidental global publication', () => {
  const before = state();
  const manifest: ImageRemediationManifest = { ...empty(), partialUnassignments: [{ slug: 'tool', blobUrl: '/remaining.jpg', variantNames: ['300 g'] }] };
  const plan = planProductImageRemediation(before, manifest, 'local');
  assert.deepEqual(plan.expected.assignments.filter(row => row.media_id === 2), [link(11, 2, 6)]);
  assert.equal(planProductImageRemediation(plan.expected, manifest, 'local').mutationCount, 0);
  assert.throws(() => planProductImageRemediation(before, { ...manifest, partialUnassignments: [{ ...manifest.partialUnassignments[0], variantNames: ['200 g', '300 g'] }] }, 'local'), /make the image global/u);
});

test('production replacements require their hosted source while local uses the repository original', () => {
  const manifest = { ...empty(), replacements: [replacement()] };
  const local = planProductImageRemediation(state(), manifest, 'local');
  const production = planProductImageRemediation(state(), manifest, 'production');
  assert.equal(local.inserts[0].blob_url, manifest.replacements[0].blobUrl);
  assert.equal(local.inserts[0].blob_pathname, null);
  assert.equal(production.inserts[0].blob_url, manifest.replacements[0].hostedBlobUrl);
  assert.equal(production.inserts[0].blob_pathname, manifest.replacements[0].hostedBlobPathname);
  assert.equal(planProductImageRemediation(production.expected, manifest, 'production').mutationCount, 0);
  assert.throws(() => planProductImageRemediation(state(), { ...empty(), replacements: [{ ...replacement(), hostedBlobUrl: undefined }] }, 'production'), /hosted URL/u);
});

test('replacement refuses ambiguous, non-image, independently hidden, and missing sources', () => {
  const manifest = { ...empty(), replacements: [replacement()] };
  for (const extra of [
    [photo(5, replacement().blobUrl, 0), photo(6, replacement().blobUrl, 1)],
    [{ ...photo(5, replacement().blobUrl, 0), media_kind: 'document' }],
    [photo(5, replacement().blobUrl, 0, true)]
  ]) {
    const before = state(); before.media.push(...extra);
    assert.throws(() => planProductImageRemediation(before, manifest, 'local'), /replacement|hidden/u);
  }
  const missing = state(); missing.media = missing.media.filter(row => row.id !== 3);
  assert.throws(() => planProductImageRemediation(missing, manifest, 'local'), /Missing image/u);
  assert.throws(() => planProductImageRemediation(state(), { ...empty(), replacements: [{ ...replacement(), blobUrl: '/old.jpg' }] }, 'local'), /must differ/u);
});

test('target-local operations skip missing production products while missing required selected rows fail', () => {
  const manifest: ImageRemediationManifest = { ...empty(), removals: [{ target: 'local', slug: 'only-local', blobUrl: '/fixture.png' }], captions: [{ target: 'local', slug: 'only-local', blobUrl: '/fixture.png', imageType: 'context', altText: 'Local fixture' }] };
  assert.equal(planProductImageRemediation(state(), manifest, 'production').mutationCount, 0);
  assert.throws(() => planProductImageRemediation(state(), manifest, 'local'), /Missing\/archived item/u);
  assert.equal(planProductImageRemediation(state(), { ...empty(), removals: [{ slug: 'tool', blobUrl: '/already-removed.jpg' }] }, 'local').mutationCount, 0);
  assert.throws(() => planProductImageRemediation(state(), { ...empty(), captions: [{ slug: 'tool', blobUrl: '/missing.jpg', imageType: 'product', altText: 'Missing' }] }, 'local'), /Missing image/u);
});

test('recorded original checksums catch changed source files and reject unsafe paths', async () => {
  const filename = 'quality-checksum-' + randomUUID() + '.png';
  const url = '/images/catalog/2026-09/' + filename;
  const file = path.resolve('public/images/catalog/2026-09', filename);
  const bytes = Buffer.from('original source bytes');
  const manifest = { ...empty(), removals: [{ slug: 'tool', blobUrl: url, sha256: createHash('sha256').update(bytes).digest('hex') }] };
  await writeFile(file, bytes, { flag: 'wx' });
  try {
    await validateRemediationSourceChecksums(manifest, 'local');
    await writeFile(file, 'changed');
    await assert.rejects(validateRemediationSourceChecksums(manifest, 'local'), /source bytes changed/u);
    await validateRemediationSourceChecksums({ ...manifest, removals: [{ ...manifest.removals[0], target: 'local' }] }, 'production');
    await assert.rejects(validateRemediationSourceChecksums({ ...manifest, removals: [{ ...manifest.removals[0], blobUrl: '/images/../../package.json' }] }), /Unsafe recorded source/u);
  } finally { await rm(file); }
});

test('canonical catalog remains importable and reviewed variant restrictions survive image synchronization', async () => {
  const canonical = validateCatalogImportManifest(JSON.parse(await readFile('data/catalog/atehna-2026-09.json', 'utf8')));
  const manifest = JSON.parse(await readFile('data/catalog/product-image-remediation-2026-09.json', 'utf8')) as ImageRemediationManifest;
  const finalManifest = JSON.parse(await readFile('data/catalog/product-image-remediation-v3-2026-09.json', 'utf8')) as ImageRemediationManifest;
  const finallyRemoved = [...finalManifest.removals, ...finalManifest.replacements.map(entry => ({ ...entry, blobUrl: entry.fromBlobUrl }))];
  const rejected = new Set(finallyRemoved.map(entry => entry.slug + '\n' + entry.blobUrl));
  for (const entry of [...manifest.removals, ...finallyRemoved]) {
    const product = canonical.products.find(product => product.slug === entry.slug);
    if (!product) continue;
    assert.equal(product.media.some(image => image.blobUrl === entry.blobUrl), false, entry.slug + ' rejected image record must not return in future imports');
  }
  for (const entry of [...manifest.restores, ...manifest.partialUnassignments]) {
    const product = canonical.products.find(product => product.slug === entry.slug);
    if (!product) continue;
    const visible = product.media.filter(image => image.mediaKind === 'image' && image.role === 'gallery' && !image.hidden);
    const restored = manifest.restores.some(restore => restore.slug === entry.slug && restore.blobUrl === entry.blobUrl) && !rejected.has(entry.slug + '\n' + entry.blobUrl);
    for (const name of entry.variantNames) {
      const variant: CatalogItemEditorVariantPayload | undefined = product.variants.find(candidate => candidate.variantName === name);
      assert.ok(variant, entry.slug + '/' + name);
      const urls: Array<string | null | undefined> = (variant.imageAssignments ?? []).map((index: number) => visible[index]?.blobUrl);
      assert.equal(urls.includes(entry.blobUrl), restored, entry.slug + '/' + name + ' reviewed assignment');
    }
  }
});
