import assert from 'node:assert/strict';
import test from 'node:test';
import { planRejectedProductImageDeletion, verifyRejectedPhotoDeletion, technicalImageSnapshot, planCanonicalRejectedPhotoDeletion } from '../../scripts/delete-rejected-product-images';
import { isProtectedTechnicalImage, rejectedPhotoIdentities, removeRejectedPayloadMedia } from '../../scripts/catalog-rejected-photos';
import { planCatalogImportProduct, type CatalogImportProduct } from '../../scripts/import-atehna-catalog';
import type { ImageRemediationManifest } from '../../scripts/remediate-catalog-product-images';
import type { PhotoState } from '../../scripts/replace-atehna-generated-images';
import type { CatalogItemEditorHydration } from '../../src/shared/domain/catalog/catalogAdminTypes';
const empty = (): ImageRemediationManifest => ({ removals: [], replacements: [], restores: [], captions: [], partialUnassignments: [] });
const photo = (id: number, source: string, position: number, hidden = false) => ({ id, item_id: 1, media_kind: 'image', role: 'gallery', source_kind: 'upload', blob_url: source, blob_pathname: null, external_url: null, position, hidden, image_type: 'product', alt_text: source });
const link = (variant: number, media: number, position: number) => ({ variant_id: variant, item_id: 1, media_id: media, position });
const state = (): PhotoState => ({ items: [{ id: 1, slug: 'tool', status: 'active', item_name: 'Tool', price: 30 }], variants: [{ id: 11, item_id: 1, variant_name: 'Exact variant', inventory: 7 }],
  media: [photo(1, '/rejected.jpg', -8, true), photo(2, '/kept.jpg', 3), { ...photo(3, '/schema.png', 19, true), image_type: 'dimension-diagram', image_dimensions: { width: 900, height: 400 }, alt_text: 'Technical dimensions' }, photo(4, '/old.jpg', 25)],
  assignments: [link(11, 1, 0), link(11, 2, 5), link(11, 3, 13), link(11, 4, 21)] });
const replacement = (): ImageRemediationManifest['replacements'][number] => ({ slug: 'tool', fromBlobUrl: '/old.jpg', fromSha256: 'a'.repeat(64), blobUrl: '/images/catalog/2026-09/new.jpg', sha256: 'b'.repeat(64), dimensions: { width: 1600, height: 1200 }, sourcePage: 'https://maker.example/product', sourceUrl: 'https://maker.example/original.jpg', visuallyReviewed: true, humanFree: true, originalBytes: true, imageType: 'product', altText: 'Exact product', hostedBlobUrl: 'https://catalog.public.blob.vercel-storage.com/catalog-items/tool/images/new.jpg', hostedBlobPathname: 'catalog-items/tool/images/new.jpg' });

test('actual deletion removes already-hidden photo records and links while preserving hidden technical rows byte-for-byte', () => {
  const before = state(); const original = structuredClone(before);
  const manifest = { ...empty(), removals: [{ slug: 'tool', blobUrl: '/rejected.jpg' }] };
  const plan = planRejectedProductImageDeletion(before, manifest, 'local');
  assert.deepEqual(before, original);
  assert.equal(plan.deletes.length, 1); assert.equal(plan.updates.length, 0);
  assert.equal(plan.expected.media.some(row => row.id === 1), false);
  assert.equal(plan.expected.assignments.some(row => row.media_id === 1), false);
  assert.deepEqual(plan.expected.media, original.media.slice(1));
  assert.deepEqual(technicalImageSnapshot(plan.expected), technicalImageSnapshot(before));
  verifyRejectedPhotoDeletion(before, plan.expected, plan);
  assert.equal(planRejectedProductImageDeletion(plan.expected, manifest, 'local').mutationCount, 0);
  assert.notEqual(plan.planHash, planRejectedProductImageDeletion({ ...before, variants: [{ ...before.variants[0], inventory: 8 }] }, manifest, 'local').planHash);
});

test('replacements actually remove old originals, preserve order and variant links, and repeat safely after deletion', () => {
  for (const target of ['local', 'production'] as const) {
    const before = state(); const manifest = { ...empty(), replacements: [replacement()] };
    const plan = planRejectedProductImageDeletion(before, manifest, target);
    assert.equal(plan.deletes[0].id, 4); assert.equal(plan.inserts[0].position, 25);
    assert.equal(plan.assignmentInserts[0].position, 21);
    assert.equal(plan.expected.media.some(row => row.id === 4), false);
    verifyRejectedPhotoDeletion(before, plan.expected, plan);
    assert.equal(planRejectedProductImageDeletion(plan.expected, manifest, target).mutationCount, 0);
    const changed = structuredClone(plan.expected); changed.media.at(-1)!.hidden = true;
    assert.throws(() => planRejectedProductImageDeletion(changed, manifest, target), /changed completed replacement/u);
  }
});

test('previously hidden replaced source is deleted even when its replacement is already published', () => {
  const before = state(); before.media[3].hidden = true;
  before.media.push({ ...photo(5, replacement().blobUrl, 25), image_dimensions: replacement().dimensions, alt_text: 'Exact product' } as typeof before.media[number]);
  before.assignments = before.assignments.filter(row => row.media_id !== 4); before.assignments.push(link(11, 5, 21));
  const plan = planRejectedProductImageDeletion(before, { ...empty(), replacements: [replacement()] }, 'local');
  assert.equal(plan.deletes.length, 1); assert.equal(plan.inserts.length, 0);
  assert.equal(plan.updates.length, 0); assert.deepEqual(plan.expected.assignments, before.assignments);
});

test('technical classification, unclassified drawings and SVGs block actual deletion, including hidden images', () => {
  for (const media of [state().media[2], { ...photo(9, '/images/dimenzije/tool.png', 3, true), image_type: 'product' }, photo(10, '/images/tool.svg', 3), { ...photo(11, '/legacy.png', 3), alt_text: 'Tehnična risba izdelka' }]) {
    assert.equal(isProtectedTechnicalImage(media), true);
    const before = state(); before.media = [media]; before.assignments = [];
    assert.throws(() => planRejectedProductImageDeletion(before, { ...empty(), removals: [{ slug: 'tool', blobUrl: String(media.blob_url) }] }, 'local'), /technical image/u);
  }
});

test('last photo can be deleted, target-local identities are excluded from production, and missing/ambiguous identities fail safely', () => {
  const before = state(); before.media = [before.media[0]]; before.assignments = [before.assignments[0]];
  const manifest = { ...empty(), removals: [{ slug: 'tool', blobUrl: '/rejected.jpg' }] };
  const plan = planRejectedProductImageDeletion(before, manifest, 'local');
  assert.deepEqual(plan.expected.media, []); assert.deepEqual(plan.expected.assignments, []);
  assert.equal(planRejectedProductImageDeletion(before, { ...empty(), removals: [{ target: 'local', slug: 'absent', blobUrl: '/fixture.jpg' }] }, 'production').mutationCount, 0);
  assert.throws(() => planRejectedProductImageDeletion(before, { ...empty(), removals: [{ slug: 'absent', blobUrl: '/fixture.jpg' }] }, 'local'), /Missing\/archived/u);
  const ambiguous = state(); ambiguous.media.push({ ...ambiguous.media[0], id: 100 });
  assert.throws(() => planRejectedProductImageDeletion(ambiguous, manifest, 'local'), /Ambiguous/u);
});

const product = (): CatalogImportProduct => ({ itemName: 'Tool', slug: 'tool', itemType: 'unit', status: 'active', categoryPath: ['Tools'], variants: [{ variantName: 'Exact variant', variantSku: 'TOOL-1', price: 30, inventory: 7, imageAssignments: [0, 1, 2] }], media: [
  { mediaKind: 'image', role: 'gallery', sourceKind: 'upload', blobUrl: '/rejected.jpg', altText: 'Rejected', hidden: true, position: -8 },
  { mediaKind: 'image', role: 'gallery', sourceKind: 'upload', blobUrl: '/old.jpg', altText: 'Old', position: 0 },
  { mediaKind: 'image', role: 'gallery', sourceKind: 'upload', blobUrl: '/diagram.svg', altText: 'Diagram', imageType: 'dimension-diagram', position: 9 },
  { mediaKind: 'image', role: 'gallery', sourceKind: 'upload', blobUrl: '/kept.jpg', altText: 'Kept', position: 12 }
] });

test('canonical actual removal remaps visible assignment indexes and retains technical metadata and remaining media order', () => {
  const before = product(); const manifest = { ...empty(), removals: [{ slug: 'tool', blobUrl: '/rejected.jpg' }], replacements: [replacement()] };
  const after = removeRejectedPayloadMedia(before, rejectedPhotoIdentities(manifest));
  assert.deepEqual(after.media, before.media.slice(2));
  assert.deepEqual(after.variants[0].imageAssignments, [0, 1]);
  assert.equal(after.variants[0].price, 30); assert.equal(after.variants[0].inventory, 7);
  assert.deepEqual(removeRejectedPayloadMedia(after, rejectedPhotoIdentities(manifest)), after);
  assert.throws(() => removeRejectedPayloadMedia(before, [{ slug: 'tool', blobUrl: '/diagram.svg' }]), /technical image/u);
});

test('import suppression prevents both an old canonical source and retained database rows from resurrecting rejected photos', () => {
  const rejected = [{ slug: 'tool', blobUrl: '/rejected.jpg' }, { slug: 'tool', blobUrl: '/old.jpg' }];
  const incoming = product();
  const created = planCatalogImportProduct(incoming, null, rejected);
  assert.deepEqual(created.payload.media.map(row => row.blobUrl), ['/diagram.svg', '/kept.jpg']);
  const existing = { ...incoming, id: 1, updatedAt: '2026-09-13', variants: incoming.variants.map(row => ({ ...row, id: 11, imageAssignments: [1, 2, 3] })), media: incoming.media.map((row, index) => ({ ...row, id: index + 1 })) } as CatalogItemEditorHydration;
  const cleaned = removeRejectedPayloadMedia(incoming, rejected);
  const updated = planCatalogImportProduct(cleaned, existing, rejected);
  assert.deepEqual(updated.payload.media.map(row => row.blobUrl), ['/diagram.svg', '/kept.jpg']);
  assert.deepEqual(updated.payload.variants[0].imageAssignments, [0, 1]);
});


test('native PNG replacement keeps its MIME type and replaces multiple source photos with one correctly assigned canonical original', () => {
  const png = { ...replacement(), blobUrl: '/images/catalog/2026-09/new.png' };
  const plan = planRejectedProductImageDeletion(state(), { ...empty(), replacements: [png] }, 'local');
  assert.equal(plan.inserts[0].mime_type, 'image/png');
  const before = { version: 1 as const, products: [product()] };
  const manifest = { ...empty(), replacements: [png, { ...png, fromBlobUrl: '/kept.jpg' }], removals: [{ slug: 'tool', blobUrl: '/rejected.jpg' }] };
  const after = planCanonicalRejectedPhotoDeletion(before, manifest);
  assert.deepEqual(after.products[0].media.map(row => row.blobUrl), [png.blobUrl, '/diagram.svg']);
  assert.equal(after.products[0].media[0].mimeType, 'image/png');
  assert.equal(after.products[0].media[0].position, 0);
  assert.deepEqual(after.products[0].media[1], before.products[0].media[2]);
  assert.deepEqual(after.products[0].variants[0].imageAssignments, [0, 1]);
  assert.deepEqual(after.products[0].mediaSourceAliases, [{ localBlobUrl: png.blobUrl, hostedBlobUrl: png.hostedBlobUrl, hostedBlobPathname: png.hostedBlobPathname }]);
  assert.deepEqual(planCanonicalRejectedPhotoDeletion(after, manifest), after);
});


test('future canonical imports keep unlisted technical schematics visible and preserve already-hidden schematic state', () => {
  const incoming = product(); incoming.hideUnlistedGalleryImages = true;
  incoming.media = [incoming.media[3]]; incoming.variants[0].imageAssignments = [0];
  const before = { ...product(), id: 1, updatedAt: '2026-09-13', variants: product().variants.map(row => ({ ...row, id: 11 })), media: product().media.map((row, index) => ({ ...row, id: index + 1 })) } as CatalogItemEditorHydration;
  before.media.push({ ...before.media[2], id: 99, blobUrl: '/hidden-schema.svg', hidden: true });
  before.variants[0].imageAssignments = [2, 4];
  const plan = planCatalogImportProduct(incoming, before);
  assert.equal(plan.payload.media.find(row => row.id === 3)?.hidden, undefined);
  assert.equal(plan.payload.media.find(row => row.id === 99)?.hidden, true);
  assert.equal(plan.payload.media.find(row => row.id === 2)?.hidden, true);
  assert.equal(plan.payload.imageAssignmentScope, 'all-gallery');
  const assigned = plan.payload.variants[0].imageAssignments!.map(index => plan.payload.media.filter(row => row.role === 'gallery')[index].id);
  assert.deepEqual(assigned, [4, 3, 99]);
});


test('replacement verification permits only generated timestamps on new links and rejects order or retained timestamp changes', () => {
  const before = state(); before.assignments = before.assignments.map(row => ({ ...row, created_at: '2001-01-01' }));
  const plan = planRejectedProductImageDeletion(before, { ...empty(), replacements: [replacement()] }, 'local');
  const after = structuredClone(plan.expected);
  after.assignments.find(row => String(row.media_id).startsWith('new:'))!.created_at = '2026-09-13';
  verifyRejectedPhotoDeletion(before, after, plan);
  const moved = structuredClone(after); moved.assignments.find(row => String(row.media_id).startsWith('new:'))!.position = 22;
  assert.throws(() => verifyRejectedPhotoDeletion(before, moved, plan), /identity.order/u);
  const changedTimestamp = structuredClone(after); changedTimestamp.assignments.find(row => row.media_id === 2)!.created_at = '2026-09-13';
  assert.throws(() => verifyRejectedPhotoDeletion(before, changedTimestamp, plan), /identity.order/u);
});
