import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePhotoFramingArgs, planPhotoFraming, validatePhotoFramingManifest, type FramingPhoto, type PhotoFramingProduct } from '../../scripts/refresh-atehna-catalog-photos';
import { simulateRealPhotoPlan, verifyRealPhotoPreservation, type PhotoState } from '../../scripts/replace-atehna-generated-images';

const base = '/images/catalog/2026-09/';
const photo = (patch: Partial<FramingPhoto> = {}): FramingPhoto => ({
  id: 'clear', blobUrl: base + 'new-clear.jpg', sourceUrl: 'https://supplier.example/photo.jpg', sourcePage: 'https://supplier.example/product',
  kind: 'supplier-photo', dimensions: { width: 1200, height: 900 }, sha256: 'b'.repeat(64),
  altText: 'Prava fotografija materiala', visuallyVerified: true, notes: 'Reviewed native photograph with visible material edge.', ...patch
});
const mimes = (...photos: FramingPhoto[]) => new Map(photos.map(entry => [entry.blobUrl, 'image/jpeg']));
function state(): PhotoState {
  return {
    items: [{ id: '1', slug: 'paper', status: 'active', updated_at: 'before' }, { id: '2', slug: 'unrelated', status: 'active', updated_at: 'before' }],
    variants: [
      { id: '11', item_id: '1', variant_name: 'Renamed original', price: '4.20', inventory: 22, thickness: '0.3' },
      { id: '12', item_id: '1', variant_name: 'New production-only variant', price: '7.60', inventory: 9, thickness: null }
    ],
    media: [
      { id: '20', item_id: '1', media_kind: 'image', role: 'gallery', blob_url: base + 'old-flat.jpg', hidden: false, position: 0 },
      { id: '21', item_id: '1', media_kind: 'image', role: 'gallery', blob_url: base + 'edge.jpg', hidden: false, position: 1 },
      { id: '22', item_id: '1', media_kind: 'document', role: 'technical_sheet', blob_url: '/manual.pdf', hidden: false, position: 0 },
      { id: '23', item_id: '2', media_kind: 'image', role: 'gallery', blob_url: base + 'unrelated.jpg', hidden: false, position: 0 }
    ],
    assignments: [
      { variant_id: '11', item_id: '1', media_id: '20', position: 0, created_at: 'before' },
      { variant_id: '12', item_id: '1', media_id: '20', position: 0, created_at: 'before' },
      { variant_id: '11', item_id: '1', media_id: '21', position: 1, created_at: 'before' }
    ]
  };
}

test('replacement inherits current coverage including production-only variants, retaining old rows and fields', () => {
  const before = state(); const original = structuredClone(before); const selected = photo();
  const products: PhotoFramingProduct[] = [{ slug: 'paper', replacements: [{ fromBlobUrl: base + 'old-flat.jpg', photo: selected }], leadBlobUrls: [selected.blobUrl] }];
  const plan = planPhotoFraming(products, before, mimes(selected));
  const after = simulateRealPhotoPlan(before, plan, new Map([[plan.mediaInserts[0].id as string, '99']]));
  assert.deepEqual(before, original);
  assert.equal(after.media.find(row => row.id === '20')?.hidden, true);
  assert.deepEqual(after.assignments.filter(row => row.media_id === '20'), before.assignments.filter(row => row.media_id === '20'));
  assert.deepEqual(after.assignments.filter(row => row.media_id === '99').map(row => row.variant_id), ['11', '12']);
  assert.deepEqual(after.variants, before.variants);
  assert.deepEqual(after.media.find(row => row.id === '22'), before.media.find(row => row.id === '22'));
  assert.deepEqual(after.media.find(row => row.id === '23'), before.media.find(row => row.id === '23'));
  verifyRealPhotoPreservation(before, after, plan, new Map([[plan.mediaInserts[0].id as string, '99']]));
  assert.equal(planPhotoFraming(products, after, mimes(selected)).changedItemIds.length, 0);
});

test('existing edge promotion reorders only its existing assignments and is stable', () => {
  const before = state(); const products = [{ slug: 'paper', leadBlobUrls: [base + 'edge.jpg'] }];
  const plan = planPhotoFraming(products, before, new Map()); const after = simulateRealPhotoPlan(before, plan);
  assert.equal(plan.mediaInserts.length, 0); assert.equal(plan.assignmentDeletes.length, 0);
  assert.deepEqual(plan.mediaUpdates, [{ id: '21', itemId: '1', changes: { position: -1 } }]);
  assert.deepEqual(plan.assignmentUpserts, [{ variant_id: '11', item_id: '1', media_id: '21', position: -1 }]);
  assert.equal(after.assignments.some(row => row.variant_id === '12' && row.media_id === '21'), false);
  assert.equal(planPhotoFraming(products, after, new Map()).changedItemIds.length, 0);
});

test('general addition can restore an authentic hidden overview without assigning it to variants', () => {
  const before = state(); before.media.push({ id: '24', item_id: '1', media_kind: 'image', role: 'gallery', blob_url: base + 'overview.jpg', hidden: true, position: 54 });
  const selected = photo({ blobUrl: base + 'overview.jpg' });
  const products = [{ slug: 'paper', additions: [selected], leadBlobUrls: [selected.blobUrl] }];
  const plan = planPhotoFraming(products, before, mimes(selected)); const after = simulateRealPhotoPlan(before, plan);
  assert.equal(plan.mediaInserts.length, 0); assert.equal(plan.assignmentUpserts.length, 0);
  assert.equal(after.media.find(row => row.id === '24')?.hidden, false);
  assert.equal(after.media.find(row => row.id === '24')?.position, -1);
  assert.deepEqual(after.assignments, before.assignments);
  assert.equal(planPhotoFraming(products, after, mimes(selected)).changedItemIds.length, 0);
});

test('general addition rejects existing variant associations instead of broadening coverage', () => {
  const selected = photo({ blobUrl: base + 'edge.jpg' });
  assert.throws(() => planPhotoFraming([{ slug: 'paper', additions: [selected] }], state(), mimes(selected)), /General addition already has variant assignments/);
});

test('replacement rejects unexpected coverage and cross-item assignments', () => {
  const selected = photo({ blobUrl: base + 'old-flat.jpg' });
  assert.throws(() => planPhotoFraming([{ slug: 'paper', replacements: [{ fromBlobUrl: base + 'edge.jpg', photo: selected }] }], state(), mimes(selected)), /broaden variant coverage/);
  const before = state(); before.assignments[0].item_id = '2';
  const next = photo();
  assert.throws(() => planPhotoFraming([{ slug: 'paper', replacements: [{ fromBlobUrl: base + 'old-flat.jpg', photo: next }] }], before, mimes(next)), /Foreign variant assignment/);
});

test('missing, ambiguous, technical and hidden lead sources require review', () => {
  assert.throws(() => planPhotoFraming([{ slug: 'missing', leadBlobUrls: [base + 'edge.jpg'] }], state(), new Map()), /Missing or archived/);
  const ambiguous = state(); ambiguous.media.push({ ...ambiguous.media[1], id: '25' });
  assert.throws(() => planPhotoFraming([{ slug: 'paper', leadBlobUrls: [base + 'edge.jpg'] }], ambiguous, new Map()), /Ambiguous/);
  const diagram = state(); diagram.media[1].image_type = 'dimension-diagram';
  assert.throws(() => planPhotoFraming([{ slug: 'paper', leadBlobUrls: [base + 'edge.jpg'] }], diagram, new Map()), /non-photo/);
  const hidden = state(); hidden.media[1].hidden = true;
  assert.throws(() => planPhotoFraming([{ slug: 'paper', leadBlobUrls: [base + 'edge.jpg'] }], hidden, new Map()), /missing or hidden/);
});

test('manifest rejects replacement cycles, unsafe paths, synthetic provenance and missing review', () => {
  const selected = photo(); const entries = [{ slug: 'paper', additions: [selected] }];
  assert.throws(() => validatePhotoFramingManifest([{ slug: 'paper', replacements: [{ fromBlobUrl: selected.blobUrl, photo: selected }] }]), /cycle/);
  assert.throws(() => validatePhotoFramingManifest([{ slug: 'paper', additions: [photo({ blobUrl: '/images/catalog/../../private.png' })] }]), /Unsafe photo/);
  assert.throws(() => validatePhotoFramingManifest([{ slug: 'paper', additions: [photo({ visuallyVerified: false })] }]), /visual review/);
  assert.throws(() => validatePhotoFramingManifest(entries, [{ slug: 'paper', additions: [{ blobUrl: selected.blobUrl, kind: 'generated-illustration', sha256: selected.sha256 }] }]), /Known synthetic/);
  assert.throws(() => validatePhotoFramingManifest([{ slug: 'paper', leadBlobUrls: [selected.blobUrl] }], [{ slug: 'paper', additions: [{ blobUrl: selected.blobUrl, kind: 'generated-illustration' }] }]), /Known synthetic leading/);
});

test('apply requires a concrete reviewed plan and rejects unknown arguments', () => {
  assert.deepEqual(parsePhotoFramingArgs(['--target', 'local']), { target: 'local', apply: false, expectedPlan: undefined });
  assert.throws(() => parsePhotoFramingArgs(['--target', 'production', '--apply']), /expected-plan-sha256/);
  assert.equal(parsePhotoFramingArgs(['--target', 'production', '--apply', '--expected-plan-sha256', 'a'.repeat(64)]).apply, true);
  assert.throws(() => parsePhotoFramingArgs(['--target', 'local', '--force']), /Unknown/);
});

test('general replacement stays unassigned and multiple lead ordering does not drift', () => {
  const before = state(); before.assignments = before.assignments.filter(row => row.media_id !== '20');
  const selected = photo();
  const products = [{ slug: 'paper', replacements: [{ fromBlobUrl: base + 'old-flat.jpg', photo: selected }], leadBlobUrls: [selected.blobUrl, base + 'edge.jpg'] }];
  const plan = planPhotoFraming(products, before, mimes(selected)); const after = simulateRealPhotoPlan(before, plan);
  assert.equal(after.assignments.some(row => row.media_id === plan.mediaInserts[0].id), false);
  const first = after.media.find(row => row.blob_url === selected.blobUrl)!;
  const second = after.media.find(row => row.id === '21')!;
  assert.ok(Number(first.position) < Number(second.position));
  assert.equal(planPhotoFraming(products, after, mimes(selected)).changedItemIds.length, 0);
});

test('reviewed original can remain visible as secondary while the clearer replacement leads', () => {
  const before = state(); const selected = photo();
  const products = [{ slug: 'paper', replacements: [{ fromBlobUrl: base + 'old-flat.jpg', photo: selected, keepOriginalVisible: true }], leadBlobUrls: [selected.blobUrl] }];
  const plan = planPhotoFraming(products, before, mimes(selected)); const after = simulateRealPhotoPlan(before, plan);
  assert.deepEqual(after.media.find(row => row.id === '20'), before.media.find(row => row.id === '20'));
  assert.equal(after.media.find(row => row.id === '20')?.hidden, false);
  assert.ok(Number(after.media.find(row => row.blob_url === selected.blobUrl)?.position) < Number(after.media.find(row => row.id === '20')?.position));
  assert.deepEqual(after.assignments.filter(row => row.media_id === '20'), before.assignments.filter(row => row.media_id === '20'));
  assert.equal(planPhotoFraming(products, after, mimes(selected)).changedItemIds.length, 0);
});
