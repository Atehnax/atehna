import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import sharp from 'sharp';
import { inspectReviewedImageOriginal, loadRejectedImageSources, planCanonicalReviewedImageAdditions, planReviewedImageAdditions, validateImageAdditionManifest, type ReviewedImageAddition, type ReviewedImageAdditionManifest } from '../../scripts/add-reviewed-product-images';
import { technicalImageSnapshot, verifyRejectedPhotoDeletion } from '../../scripts/delete-rejected-product-images';
import { planCatalogImportProduct, type CatalogImportManifest } from '../../scripts/import-atehna-catalog';
import type { PhotoState } from '../../scripts/replace-atehna-generated-images';
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const entry = (patch: Partial<ReviewedImageAddition> = {}): ReviewedImageAddition => ({ id: 'new-front', slug: 'tool', variantSkus: ['TOOL-B'], blobUrl: '/images/catalog/2026-09/new-front.png', sha256: 'b'.repeat(64), dimensions: { width: 1200, height: 1024 }, sourcePage: 'https://maker.example/tool', sourceUrl: 'https://maker.example/original.png', sourceIdentityEvidence: 'Manufacturer exact TOOL-B model and markings independently reviewed.', originalBytes: true, humanFree: true, visuallyReviewed: true, exactVariantMatch: true, imageType: 'product', role: 'main', view: 'front', altText: 'Exact tool B, complete front view', hostedBlobUrl: 'https://fixture.public.blob.vercel-storage.com/catalog-items/tool/images/new-front.png', hostedBlobPathname: 'catalog-items/tool/images/new-front.png', ...patch });
const ledger = (...additions: ReviewedImageAddition[]): ReviewedImageAdditionManifest => ({ version: 4, reviewedAt: '2026-09-14T10:00:00Z', additions });
const detail = (patch: Partial<ReviewedImageAddition> = {}) => entry({ id: 'new-side', blobUrl: '/images/catalog/2026-09/new-side.png', sha256: 'c'.repeat(64), role: 'detail', view: 'side', altText: 'Exact tool B, side and controls', hostedBlobUrl: 'https://fixture.public.blob.vercel-storage.com/catalog-items/tool/images/new-side.png', hostedBlobPathname: 'catalog-items/tool/images/new-side.png', ...patch });
const photo = (id: number, source: string, position: number, hidden = false) => ({ id, item_id: 1, media_kind: 'image', role: 'gallery', source_kind: 'upload', blob_url: source, blob_pathname: null, external_url: null, position, hidden, image_type: 'product', alt_text: source, created_at: '2001-01-01' });
const link = (variant: number, media: number, position: number) => ({ variant_id: variant, item_id: 1, media_id: media, position, created_at: '2001-01-01' });
const state = (): PhotoState => ({ items: [{ id: 1, slug: 'tool', status: 'active', item_name: 'Tool' }], variants: [{ id: 11, item_id: 1, variant_sku: 'TOOL-A', inventory: 7 }, { id: 12, item_id: 1, variant_sku: 'TOOL-B', inventory: 8 }, { id: 13, item_id: 1, variant_sku: 'TOOL-C', inventory: 9 }], media: [photo(101, '/kept-native.jpg', -5), { ...photo(102, '/technical.svg', 0), image_type: 'dimension-diagram' }, { ...photo(103, '/hidden-drawing.png', 2, true), image_type: 'dimension-diagram' }], assignments: [link(11, 101, -3), link(11, 102, 4), link(12, 102, 1), link(12, 103, -4)] });

test('new native main/detail need no old anchor and preserve all existing rows, exact links, order and hidden schematics', () => {
  const before = state(); const original = structuredClone(before); const manifest = ledger(detail(), entry());
  for (const target of ['local', 'production'] as const) {
    const plan = planReviewedImageAdditions(before, manifest, target);
    assert.deepEqual(before, original); assert.equal(plan.inserts.length, 2); assert.equal(plan.assignmentInserts.length, 2);
    assert.deepEqual(plan.expected.media.slice(0, before.media.length), before.media);
    assert.deepEqual(plan.expected.assignments.slice(0, before.assignments.length), before.assignments);
    assert.deepEqual(technicalImageSnapshot(plan.expected), technicalImageSnapshot(before));
    assert.deepEqual(plan.inserts.map(row => row.position), [-6, -6]);
    assert.deepEqual(plan.assignmentInserts.map(row => [row.variant_id, row.position]), [[12, -5], [12, -5]]);
    assert.deepEqual([plan.deletes, plan.updates, plan.assignmentDeletes], [[], [], []]);
    assert.equal(plan.inserts[0].blob_url, target === 'production' ? entry().hostedBlobUrl : entry().blobUrl);
    assert.equal(plan.expected.assignments.some(row => row.variant_id === 13), false);
    verifyRejectedPhotoDeletion(before, plan.expected, plan);
    assert.equal(planReviewedImageAdditions(plan.expected, manifest, target).mutationCount, 0);
  }
});

test('exact SKU authorization rejects absent, ambiguous, whitespace or implicit global variants', () => {
  for (const variantSkus of [[], ['UNKNOWN'], ['tool-b'], [' TOOL-B'], ['TOOL-B', 'TOOL-B']]) {
    assert.throws(() => planReviewedImageAdditions(state(), ledger(entry({ variantSkus })), 'local'), /variantSkus|variant SKU/u);
  }
  assert.throws(() => validateImageAdditionManifest(ledger(entry({ variantSkus: undefined as unknown as string[] }))), /variantSkus/u);
  const ambiguous = state(); ambiguous.variants.push({ ...ambiguous.variants[1], id: 44 });
  assert.throws(() => planReviewedImageAdditions(ambiguous, ledger(entry()), 'local'), /ambiguous exact variant SKU/u);
  const deleted = state(); deleted.items[0].status = 'deleted';
  assert.throws(() => planReviewedImageAdditions(deleted, ledger(entry()), 'local'), /archived product/u);
});

test('repeat runs refuse changed metadata, hidden sources or unauthorized associations instead of repairing them silently', () => {
  const manifest = ledger(entry()); const initial = planReviewedImageAdditions(state(), manifest, 'local');
  for (const field of [{ hidden: true }, { alt_text: 'Changed caption' }, { image_dimensions: { width: 500, height: 500 } }]) {
    const changed = structuredClone(initial.expected); Object.assign(changed.media.at(-1)!, field);
    assert.throws(() => planReviewedImageAdditions(changed, manifest, 'local'), /metadata\/visibility changed/u);
  }
  const global = structuredClone(initial.expected); global.assignments.pop();
  assert.throws(() => planReviewedImageAdditions(global, manifest, 'local'), /different variant assignments/u);
  const wrong = structuredClone(initial.expected); wrong.assignments.at(-1)!.variant_id = 11;
  assert.throws(() => planReviewedImageAdditions(wrong, manifest, 'local'), /different variant assignments/u);
});

test('independent variant main views preserve ledger order with bounded new positions and details require a product main', () => {
  const second = entry({ id: 'other-front', variantSkus: ['TOOL-C'], blobUrl: '/images/catalog/2026-09/other-front.png', sha256: 'd'.repeat(64) });
  const plan = planReviewedImageAdditions(state(), ledger(entry(), second), 'local');
  assert.deepEqual(plan.inserts.map(row => row.position), [-7, -6]);
  assert.deepEqual(plan.assignmentInserts.map(row => row.variant_id), [12, 13]);
  assert.throws(() => planReviewedImageAdditions(state(), ledger(detail()), 'local'), /requires an explicitly assigned main/u);
  const overflow = state(); overflow.media[0].position = -2147483648;
  assert.throws(() => planReviewedImageAdditions(overflow, ledger(entry()), 'local'), /No safe image position/u);
});

test('ledger rejects duplicate photographs, duplicate main views, schematics and missing original review', () => {
  assert.throws(() => validateImageAdditionManifest(ledger(entry(), detail({ sha256: entry().sha256 }))), /same photograph/u);
  assert.throws(() => validateImageAdditionManifest(ledger(entry(), detail({ role: 'main' }))), /Only one main/u);
  for (const patch of [{ originalBytes: false }, { humanFree: false }, { exactVariantMatch: false }, { visuallyReviewed: false }]) {
    assert.throws(() => validateImageAdditionManifest(ledger(entry(patch as Partial<ReviewedImageAddition>))), /Missing original-byte/u);
  }
  assert.throws(() => validateImageAdditionManifest(ledger(entry({ blobUrl: '/images/catalog/2026-09/technical-drawing.png' }))), /Technical schematics/u);
  assert.throws(() => validateImageAdditionManifest(ledger(entry({ imageType: 'context' }))), /Main images/u);
  assert.throws(() => validateImageAdditionManifest(ledger(entry({ blobUrl: '/images/catalog/2026-09/../../escape.png' }))), /Unsafe/u);
});

const canonical = (): CatalogImportManifest => ({ version: 1, products: [{ itemName: 'Tool', slug: 'tool', itemType: 'unit', status: 'active', categoryPath: ['Tools'], variants: [{ variantName: 'Tool A', variantSku: 'TOOL-A', price: 10, inventory: 4, imageAssignments: [0, 1] }, { variantName: 'Tool B', variantSku: 'TOOL-B', price: 20, inventory: 7, imageAssignments: [1] }, { variantName: 'Tool C', variantSku: 'TOOL-C', price: 30, inventory: 9 }], media: [
  { mediaKind: 'image', role: 'gallery', sourceKind: 'upload', blobUrl: '/old-native.jpg', altText: 'Existing exact tool A', imageType: 'product', position: -5 },
  { mediaKind: 'image', role: 'gallery', sourceKind: 'upload', blobUrl: '/technical.svg', altText: 'Technical dimensions', imageType: 'dimension-diagram', position: 0, imageDimensions: { width: 500, height: 300 } },
  { mediaKind: 'image', role: 'gallery', sourceKind: 'upload', blobUrl: '/hidden-drawing.png', altText: 'Technical underside drawing', imageType: 'dimension-diagram', position: 2, hidden: true }
] }] });

test('canonical inserts original bytes and hosted aliases, remaps only new indexes and keeps prior photo/schematic order and metadata', () => {
  const before = canonical(); const original = structuredClone(before);
  const manifest = ledger(entry(), detail({ id: 'z-side' }), detail({ id: 'a-rear', blobUrl: '/images/catalog/2026-09/new-rear.png', sha256: 'd'.repeat(64), hostedBlobUrl: 'https://fixture.public.blob.vercel-storage.com/catalog-items/tool/images/new-rear.png', hostedBlobPathname: 'catalog-items/tool/images/new-rear.png' }));
  const after = planCanonicalReviewedImageAdditions(before, manifest); const product = after.products[0];
  assert.deepEqual(before, original);
  assert.deepEqual(product.media.slice(3), before.products[0].media);
  assert.deepEqual(product.media.slice(0, 3).map(row => row.blobUrl), manifest.additions.map(row => row.blobUrl));
  assert.deepEqual(product.variants.map(row => row.imageAssignments), [[3, 4], [0, 1, 2, 4], undefined]);
  assert.deepEqual(product.variants.map(({ imageAssignments: _assigned, ...rest }) => rest), before.products[0].variants.map(({ imageAssignments: _assigned, ...rest }) => rest));
  assert.equal(product.mediaSourceAliases!.length, 3); assert.equal(product.media[0].mimeType, 'image/png');
  assert.deepEqual(planCanonicalReviewedImageAdditions(after, manifest), after);
  const imported = planCatalogImportProduct(product, null, [{ slug: 'tool', blobUrl: '/previously-rejected.jpg' }]);
  assert.deepEqual(imported.payload.media.map(row => row.blobUrl), product.media.map(row => row.blobUrl));
  assert.deepEqual(imported.payload.variants.map(row => row.imageAssignments), product.variants.map(row => row.imageAssignments));
});

test('native original validation decodes correct PNG/JPEG bytes and rejects wrong size, type, checksum or truncated data', async () => {
  const png = await sharp({ create: { width: 1200, height: 1024, channels: 3, background: '#54798b' } }).png().toBuffer();
  const jpeg = await sharp(png).jpeg({ quality: 90 }).toBuffer();
  const forbidden = { identities: new Set<string>(), hashes: new Set<string>() };
  assert.equal(await inspectReviewedImageOriginal(entry({ sha256: digest(png) }), png, forbidden), 'image/png');
  assert.equal(await inspectReviewedImageOriginal(entry({ blobUrl: '/images/catalog/2026-09/native.jpg', sha256: digest(jpeg) }), jpeg, forbidden), 'image/jpeg');
  await assert.rejects(inspectReviewedImageOriginal(entry(), png, forbidden), /checksum/u);
  await assert.rejects(inspectReviewedImageOriginal(entry({ sha256: digest(jpeg) }), jpeg, forbidden), /format/u);
  const small = await sharp(png).resize(600, 512).png().toBuffer();
  await assert.rejects(inspectReviewedImageOriginal(entry({ sha256: digest(small) }), small, forbidden), /native dimensions/u);
  const truncated = png.subarray(0, 60);
  await assert.rejects(inspectReviewedImageOriginal(entry({ sha256: digest(truncated) }), truncated, forbidden));
  const known = entry({ sha256: digest(png) });
  await assert.rejects(inspectReviewedImageOriginal(known, png, { identities: new Set(['tool\n' + known.blobUrl]), hashes: new Set() }), /rejected image identity/u);
  await assert.rejects(inspectReviewedImageOriginal(known, png, { identities: new Set(), hashes: new Set([known.sha256]) }), /Rejected or generated/u);
});

test('historical active rejections remain loaded to prevent file renaming from reviving rejected source bytes', async () => {
  const rejected = await loadRejectedImageSources();
  assert.ok(rejected.identities.size > 200); assert.ok(rejected.hashes.size > 200);
});
