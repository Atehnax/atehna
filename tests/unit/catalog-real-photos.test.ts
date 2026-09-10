import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import {
  inspectRealPhotoAsset, planRealPhotoReplacement, realPhotoProvenance, simulateRealPhotoPlan,
  validateRealPhotoManifest, verifyRealPhotoCoverage, verifyRealPhotoPreservation,
  type HistoricalPhotoProduct, type PhotoState, type RealPhoto, type RealPhotoProduct, type RealPhotoSource
} from '../../scripts/replace-atehna-generated-images';

const base = '/images/catalog/2026-09/';
const source: RealPhotoSource[] = [{ slug: 'aluminijasta-plosca', variants: [
  { variantName: '300 × 200 × 0,5 mm', variantSku: 'MAT-KOV-ALU-0P5x300x200', length: 300, width: 200, thickness: 0.5 },
  { variantName: '100 × 100 × 0,5 mm', variantSku: 'MAT-KOV-ALU-0P5x100x100', length: 100, width: 100, thickness: 0.5 }
] }];
const history: HistoricalPhotoProduct[] = [{ slug: source[0].slug, additions: [
  { blobUrl: base + 'old-illustration.png', kind: 'generated-illustration', sha256: 'a'.repeat(64) }
], currentMediaAudit: [{ blobUrl: base + 'old-real.jpg', quality: 'high-quality-source-photo' }], variantAssignments: [
  { originalIndex: 0, oldSku: 'OLD-300' }, { originalIndex: 1, oldSku: 'OLD-100' }
] }];
const photo = (patch: Partial<RealPhoto> = {}): RealPhoto => ({
  id: 'clear', blobUrl: base + 'new-real.jpg', sourceUrl: 'https://supplier.example/photo.jpg',
  sourcePage: 'https://supplier.example/product', kind: 'supplier-photo', dimensions: { width: 1200, height: 900 },
  sha256: 'b'.repeat(64), altText: 'Prava aluminijasta pločevina', variantIndices: [0, 1],
  contextOnly: false, visuallyVerified: true, notes: 'Native photo visually checked against material and variant.', ...patch
});
const products = (photos = [photo()]): RealPhotoProduct[] => [{ slug: source[0].slug, photos, removeBlobUrls: [base + 'old-illustration.png'] }];
const mimes = (entries: RealPhotoProduct[]) => new Map(entries.flatMap(product => product.photos.map(entry => [entry.blobUrl, 'image/jpeg'] as [string, string])));
const stamp = '2026-09-01T00:00:00.000Z';
function state(): PhotoState {
  return {
    items: [{ id: '1', slug: source[0].slug, status: 'inactive', sku: 'MAT-KOV-ALU', item_name: 'Aluminijasta plošča', updated_at: stamp }, { id: '2', slug: 'unrelated', status: 'active', updated_at: stamp }],
    variants: [
      { id: '11', item_id: '1', variant_name: '0,5 × 300 × 200 mm', variant_sku: 'OLD-300', length: '300', width: '200', thickness: '0.5', price: '3.50', inventory: 7, pricing_revision: '8', stock_revision: '9' },
      { id: '12', item_id: '1', variant_name: source[0].variants[1].variantName, variant_sku: 'OLD-100', length: '100', width: '100', thickness: '0.5', price: '2.50', inventory: 5, pricing_revision: '6', stock_revision: '7' }
    ],
    media: [
      { id: '20', item_id: '1', media_kind: 'image', role: 'gallery', blob_url: base + 'old-illustration.png', hidden: false, position: 0, alt_text: 'Old illustration', created_at: stamp, updated_at: stamp },
      { id: '21', item_id: '1', media_kind: 'image', role: 'gallery', blob_url: base + 'old-real.jpg', hidden: false, position: 1, alt_text: 'Existing supplier caption', created_at: stamp, updated_at: stamp },
      { id: '22', item_id: '1', media_kind: 'document', role: 'technical_sheet', blob_url: '/documents/manual.pdf', hidden: false, position: -9, filename: 'Keep this manual', updated_at: stamp },
      { id: '23', item_id: '2', media_kind: 'image', role: 'gallery', blob_url: '/other.jpg', hidden: false, position: 0, updated_at: stamp }
    ],
    assignments: [
      { variant_id: '11', item_id: '1', media_id: '20', position: 0, created_at: stamp },
      { variant_id: '12', item_id: '1', media_id: '20', position: 0, created_at: stamp },
      { variant_id: '11', item_id: '1', media_id: '21', position: 1, created_at: stamp },
      { variant_id: '11', item_id: '1', media_id: '22', position: 2, created_at: stamp }
    ]
  };
}

test('real-photo validation rejects generated kinds and known synthetic bytes even under a new URL', () => {
  for (const kind of ['generated-illustration', 'render', 'AI-generated-photo']) {
    assert.throws(() => validateRealPhotoManifest(products([photo({ kind })]), source, history), /Synthetic photo kind/);
  }
  assert.throws(() => validateRealPhotoManifest(products([photo({ sha256: 'a'.repeat(64) })]), source, history), /Known synthetic asset/);
  const syntheticOriginal = [{ slug: source[0].slug, currentMediaAudit: [{ blobUrl: base + 'metal-original.png', quality: 'high-quality-user-source', sha256: 'c'.repeat(64) }] }];
  assert.equal(realPhotoProvenance(syntheticOriginal).generatedHashes.has('c'.repeat(64)), true);
  assert.throws(() => validateRealPhotoManifest(products([photo({ blobUrl: base + 'metal-original.png' })]), source, [...history, ...syntheticOriginal]), /Known synthetic asset|historical provenance/);
});

test('reviewed metadata, canonical indices and explicit removal provenance are mandatory', () => {
  assert.throws(() => validateRealPhotoManifest(products([photo({ variantIndices: [2] })]), source, history), /canonical variant index/);
  assert.throws(() => validateRealPhotoManifest(products([photo({ visuallyVerified: false })]), source, history), /Unreviewed/);
  assert.throws(() => validateRealPhotoManifest(products([photo({ blobUrl: '/images/catalog/2026-09/../../secret.jpg' })]), source, history), /Unsafe photo asset path/);
  assert.throws(() => validateRealPhotoManifest([{ ...products()[0], removeBlobUrls: ['/unreviewed.jpg'] }], source, history), /historical provenance/);
  assert.throws(() => validateRealPhotoManifest(products([photo({ sourcePage: 'file:///private/photo' })]), source, history), /Invalid source URL/);
});

test('replacement prioritizes clear photos, unassigns only rejected media, and preserves unrelated rows', () => {
  const before = state();
  const original = structuredClone(before);
  const entries = products([photo({ id: 'context', blobUrl: base + 'context.jpg', contextOnly: true }), photo()]);
  const plan = planRealPhotoReplacement(entries, source, history, before, mimes(entries));
  const after = simulateRealPhotoPlan(before, plan);
  assert.deepEqual(before, original);
  assert.deepEqual(plan.mediaInserts.map(row => row.blob_url), [base + 'new-real.jpg', base + 'context.jpg']);
  assert.deepEqual(plan.assignmentDeletes.map(row => [row.variant_id, row.media_id]), [['11', '20'], ['12', '20']]);
  assert.deepEqual(after.variants, before.variants);
  assert.deepEqual(after.media.find(row => row.id === '21'), before.media.find(row => row.id === '21'));
  assert.deepEqual(after.media.find(row => row.id === '22'), before.media.find(row => row.id === '22'));
  assert.deepEqual(plan.changedItemIds, ['1']);
  verifyRealPhotoPreservation(before, after, plan);
});

test('reapplying the reviewed plan does not change timestamps, positions or row counts', () => {
  const before = state();
  const entries = products();
  const plan = planRealPhotoReplacement(entries, source, history, before, mimes(entries));
  const after = simulateRealPhotoPlan(before, plan, new Map([['new:1:clear', '30']]));
  const repeat = planRealPhotoReplacement(entries, source, history, after, mimes(entries));
  assert.deepEqual(repeat.changedItemIds, []);
  assert.deepEqual(repeat.mediaUpdates, []);
  assert.deepEqual(repeat.mediaInserts, []);
  assert.deepEqual(repeat.assignmentDeletes, []);
  assert.deepEqual(repeat.assignmentUpserts, []);
});

test('canonical matching rejects reused SKU or ambiguous physical identity', () => {
  const before = state();
  before.variants[0].variant_name = 'Prozorna plastična plošča';
  assert.throws(() => planRealPhotoReplacement(products(), source, history, before, mimes(products())), /identity changed/);
  const ambiguous = state();
  ambiguous.variants[0].variant_sku = 'RENAMED';
  ambiguous.variants.push({ ...ambiguous.variants[0], id: '14', variant_sku: 'ALSO-RENAMED' });
  assert.throws(() => planRealPhotoReplacement(products(), source, history, ambiguous, mimes(products())), /missing or ambiguous/);
});

test('general real photos remain unassigned and cover all existing variants including retained formats', () => {
  const before = state();
  before.variants.push({ ...before.variants[0], id: '13', variant_name: '0,5 × 200 × 100 mm', variant_sku: 'LEGACY', length: '200', width: '100' });
  const entries = products([photo({ variantIndices: [] })]);
  const plan = planRealPhotoReplacement(entries, source, history, before, mimes(entries));
  const after = simulateRealPhotoPlan(before, plan);
  assert.equal(plan.assignmentUpserts.some(row => String(row.media_id).startsWith('new:')), false);
  verifyRealPhotoCoverage(plan, after);
});

test('context or swatches cannot be the only photograph and dropped/hidden actual coverage is detected', () => {
  for (const selected of [photo({ contextOnly: true }), photo({ kind: 'source-swatch' })]) {
    const entries = products([selected]);
    assert.throws(() => planRealPhotoReplacement(entries, source, history, state(), mimes(entries)), /No reviewed clear visible photograph/);
  }
  const before = state();
  const entries = products();
  const plan = planRealPhotoReplacement(entries, source, history, before, mimes(entries));
  const after = simulateRealPhotoPlan(before, plan);
  after.assignments = after.assignments.filter(row => row.variant_id !== '12');
  assert.throws(() => verifyRealPhotoCoverage(plan, after), /aluminijasta-plosca\/12/);
  const hidden = simulateRealPhotoPlan(before, plan);
  hidden.media.find(row => row.id === 'new:1:clear')!.hidden = true;
  assert.throws(() => verifyRealPhotoCoverage(plan, hidden), /No reviewed clear visible photograph/);
});

test('retained metal formats are explicit, optional per database, and must be uniquely dimensional', () => {
  const entries = products([photo({ retainedVariantDimensions: [{ length: 200, width: 100, thickness: 0.5 }] })]);
  assert.doesNotThrow(() => planRealPhotoReplacement(entries, source, history, state(), mimes(entries)));
  const before = state();
  before.variants.push({ ...before.variants[0], id: '13', variant_name: '0,5 × 200 × 100 mm', variant_sku: 'LEGACY', length: '200', width: '100' });
  const plan = planRealPhotoReplacement(entries, source, history, before, mimes(entries));
  assert.equal(plan.assignmentUpserts.some(row => row.variant_id === '13'), true);
  before.variants[2].variant_name = '200 × 100 × 0,5 mm, bela';
  assert.throws(() => planRealPhotoReplacement(entries, source, history, before, mimes(entries)), /descriptive identity/);
});

test('an existing reviewed URL is reused, captions update explicitly, and unrelated source fields stay intact', () => {
  const before = state();
  const entries = products([photo({ blobUrl: base + 'old-real.jpg', altText: 'Verified new caption' })]);
  const plan = planRealPhotoReplacement(entries, source, history, before, mimes(entries));
  assert.equal(plan.mediaInserts.length, 0);
  const after = simulateRealPhotoPlan(before, plan);
  assert.equal(after.media.find(row => row.id === '21')!.alt_text, 'Verified new caption');
  verifyRealPhotoPreservation(before, after, plan);
  const restricted = products([photo({ blobUrl: base + 'old-real.jpg', variantIndices: [1] })]);
  assert.throws(() => planRealPhotoReplacement(restricted, source, history, before, mimes(restricted)), /unreviewed existing variant assignment/);
});

test('preservation verification rejects any unplanned catalog, media or assignment change', () => {
  const before = state();
  const entries = products();
  const plan = planRealPhotoReplacement(entries, source, history, before, mimes(entries));
  for (const mutate of [
    (after: PhotoState) => { after.variants[0].price = '99'; },
    (after: PhotoState) => { after.items[1].updated_at = 'changed'; },
    (after: PhotoState) => { after.media.find(row => row.id === '21')!.alt_text = 'unexpected'; },
    (after: PhotoState) => { after.assignments.find(row => row.media_id === '21')!.created_at = 'changed'; }
  ]) {
    const after = structuredClone(simulateRealPhotoPlan(before, plan));
    mutate(after);
    assert.throws(() => verifyRealPhotoPreservation(before, after, plan), /changed/);
  }
});

test('unlisted synthetic media cannot silently survive and requires an explicit reviewed removal', () => {
  const entries = [{ ...products()[0], removeBlobUrls: [] }];
  assert.throws(() => planRealPhotoReplacement(entries, source, history, state(), mimes(entries)), /Rejected image remains visible/);
});

test('making a reviewed photo general removes only its own links and preserves all other real media', () => {
  const before = state();
  const entries = products([photo({ blobUrl: base + 'old-real.jpg', variantIndices: [] })]);
  const plan = planRealPhotoReplacement(entries, source, history, before, mimes(entries));
  const after = simulateRealPhotoPlan(before, plan);
  assert.equal(after.assignments.some(row => row.media_id === '21'), false);
  assert.equal(after.assignments.some(row => row.media_id === '22'), true);
  verifyRealPhotoPreservation(before, after, plan);
});

test('native asset inspection rejects changed bytes and claimed dimensions', async () => {
  const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jk7sAAAAASUVORK5CYII=', 'base64');
  const sourcePhoto = photo({ sha256: createHash('sha256').update(bytes).digest('hex'), dimensions: { width: 1, height: 1 } });
  assert.equal(await inspectRealPhotoAsset(sourcePhoto, bytes), 'image/png');
  await assert.rejects(inspectRealPhotoAsset({ ...sourcePhoto, sha256: 'f'.repeat(64) }, bytes), /Native asset changed/);
  await assert.rejects(inspectRealPhotoAsset({ ...sourcePhoto, dimensions: { width: 1000, height: 1000 } }, bytes), /Native dimensions changed/);
});


test('explicit canonical removal deletes only the reviewed old link and is idempotent', () => {
  const before = state();
  const entries = products([
    photo({ id: 'restricted', blobUrl: base + 'old-real.jpg', variantIndices: [1], removeExistingVariantIndices: [0] }),
    photo({ id: 'replacement', variantIndices: [0] })
  ]);
  const plan = planRealPhotoReplacement(entries, source, history, before, mimes(entries));
  assert.equal(plan.assignmentDeletes.filter(row => row.media_id === '21').length, 1);
  assert.equal(plan.assignmentDeletes.find(row => row.media_id === '21')!.variant_id, '11');
  const after = simulateRealPhotoPlan(before, plan);
  assert.equal(after.assignments.some(row => row.media_id === '21' && row.variant_id === '11'), false);
  assert.equal(after.assignments.some(row => row.media_id === '21' && row.variant_id === '12'), true);
  assert.equal(after.assignments.some(row => row.media_id === '22' && row.variant_id === '11'), true);
  verifyRealPhotoPreservation(before, after, plan);
  const repeat = planRealPhotoReplacement(entries, source, history, after, mimes(entries));
  assert.deepEqual(repeat.changedItemIds, []);
  assert.deepEqual(repeat.assignmentDeletes, []);
});

test('removal indices cannot bypass identity checks, overlap selected rows or remove unlisted assignments', () => {
  const conflicting = products([photo({ removeExistingVariantIndices: [0] })]);
  assert.throws(() => validateRealPhotoManifest(conflicting, source, history), /both selected and removed/);
  const invalid = products([photo({ removeExistingVariantIndices: [9] })]);
  assert.throws(() => validateRealPhotoManifest(invalid, source, history), /Invalid removal variant index/);
  const entries = products([
    photo({ id: 'restricted', blobUrl: base + 'old-real.jpg', variantIndices: [1], removeExistingVariantIndices: [0] }),
    photo({ id: 'general', variantIndices: [] })
  ]);
  const changedIdentity = state();
  changedIdentity.variants[0].variant_name = 'Unreviewed renamed product';
  assert.throws(() => planRealPhotoReplacement(entries, source, history, changedIdentity, mimes(entries)), /identity changed/);
  const extra = state();
  extra.variants.push({ ...extra.variants[0], id: '13', variant_name: '0,5 × 200 × 100 mm', variant_sku: 'EXTRA', length: '200', width: '100' });
  extra.assignments.push({ variant_id: '13', item_id: '1', media_id: '21', position: 0, created_at: stamp });
  assert.throws(() => planRealPhotoReplacement(entries, source, history, extra, mimes(entries)), /unreviewed existing variant assignment/);
});

test('a reused external-url photo keeps its URL storage and repeated positions stable', () => {
  const before = state();
  const existing = before.media.find(row => row.id === '21')!;
  existing.external_url = existing.blob_url;
  existing.blob_url = null;
  existing.source_kind = 'upload';
  const entries = products([photo({ blobUrl: base + 'old-real.jpg' })]);
  const plan = planRealPhotoReplacement(entries, source, history, before, mimes(entries));
  const after = simulateRealPhotoPlan(before, plan);
  assert.equal(plan.mediaInserts.length, 0);
  assert.equal(after.media.find(row => row.id === '21')!.blob_url, null);
  assert.equal(after.media.find(row => row.id === '21')!.external_url, base + 'old-real.jpg');
  verifyRealPhotoPreservation(before, after, plan);
  const repeat = planRealPhotoReplacement(entries, source, history, after, mimes(entries));
  assert.deepEqual(repeat.changedItemIds, []);
  assert.deepEqual(repeat.mediaUpdates, []);
});
