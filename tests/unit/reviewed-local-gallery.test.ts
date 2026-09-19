import assert from 'node:assert/strict';
import test from 'node:test';
import { planReviewedLocalGallery, validateReviewedLocalGallery, verifyReviewedLocalGallery, type ReviewedLocalAsset, type ReviewedLocalGallery } from '../../scripts/apply-reviewed-local-gallery';
import type { PhotoState } from '../../scripts/replace-atehna-generated-images';
const asset = (patch: Partial<ReviewedLocalAsset> = {}): ReviewedLocalAsset => ({ id: 'front', slug: 'tool', variantSkus: ['A'], role: 'main', blobUrl: '/images/catalog/2026-09/reviewed-local/front.png', mimeType: 'image/png', altText: 'Reviewed exact main', imageDimensions: { width: 1254, height: 1254 }, sha256: 'a'.repeat(64), ...patch });
const ledger = (...assets: ReviewedLocalAsset[]): ReviewedLocalGallery => ({ version: 1, assets, coveredSkus: [...new Set(assets.flatMap(a => a.variantSkus))], sourceOriginals: [], exclusions: [], unresolvedSkus: [] });
const media = (id: string, position: number, image_type = 'product', hidden = false) => ({ id, item_id: '1', media_kind: 'image', role: 'gallery', source_kind: 'upload', filename: id + '.png', blob_url: '/old/' + id + '.png', blob_pathname: null, external_url: null, mime_type: 'image/png', video_type: null, hidden, alt_text: id, image_type, image_dimensions: { width: 1254, height: 1254 }, position, created_at: '2026-01-01', updated_at: '2026-01-01' });
const link = (variant_id: string, media_id: string, position: number) => ({ variant_id, item_id: '1', media_id, position, created_at: '2026-01-01' });
const state = (): PhotoState => ({ items: [{ id: '1', slug: 'tool', status: 'active', default_variant_id: '11', updated_at: '2026-01-01' }], variants: [{ id: '11', item_id: '1', variant_sku: 'A', price: 10, inventory: 4 }, { id: '12', item_id: '1', variant_sku: 'B', price: 20, inventory: 7 }], media: [media('21', 0), media('22', 1, 'dimension-diagram'), media('23', 2, 'dimension-overview', true)], assignments: [link('11', '21', 0), link('11', '22', 1), link('12', '22', 1)] });
function persisted(plan: ReturnType<typeof planReviewedLocalGallery>) {
  const after = structuredClone(plan.expected); const ids = new Map(plan.inserts.map((row, index) => [String(row.id), String(100 + index)]));
  for (const row of after.media) if (ids.has(String(row.id))) { row.id = ids.get(String(row.id)); row.created_at = '2026-09-20'; row.updated_at = '2026-09-20'; }
  for (const row of after.assignments) { const old = String(row.media_id); if (ids.has(old)) row.media_id = ids.get(old); if (plan.assignmentInserts.some(l => String(l.variant_id) === String(row.variant_id) && String(l.media_id) === old)) row.created_at = '2026-09-20'; }
  after.media.sort((a,b) => Number(a.id)-Number(b.id)); after.assignments.sort((a,b) => Number(a.variant_id)-Number(b.variant_id) || Number(a.media_id)-Number(b.media_id));
  return { after, ids };
}
test('replaces only covered photos; preserves technical rows, hidden/global sketches, commerce and exact new order; repeat is no-op', () => {
  const before = state(); const original = structuredClone(before); const manifest = ledger(asset(), asset({ id: 'side', role: 'detail', blobUrl: '/images/catalog/2026-09/side.png' }), asset({ id: 'chart', role: 'diagram', imageType: 'diagram', blobUrl: '/images/catalog/2026-09/chart.png' }));
  const plan = planReviewedLocalGallery(before, manifest); assert.deepEqual(before, original); assert.deepEqual(plan.deletes.map(r=>r.id), ['21']);
  assert.deepEqual(plan.inserts.map(r=>r.position), [-3,-2,-1]); assert.deepEqual(plan.expected.media.filter(r=>['22','23'].includes(String(r.id))), before.media.slice(1));
  const {after,ids}=persisted(plan); verifyReviewedLocalGallery(before,after,plan,ids); assert.equal(planReviewedLocalGallery(after,manifest).mutationCount,0); assert.deepEqual(after.items,before.items); assert.deepEqual(after.variants,before.variants);
});
test('shared photo survives with its uncovered association and global photo becomes explicitly uncovered', () => {
  const before=state(); before.assignments.push(link('12','21',0)); before.media.push(media('24',3)); const plan=planReviewedLocalGallery(before,ledger(asset()));
  assert.equal(plan.deletes.length,0); assert.deepEqual(plan.expected.assignments.find(l=>l.variant_id==='12'&&l.media_id==='21'),before.assignments.at(-1));
  assert.ok(plan.assignmentInserts.some(l=>l.variant_id==='12'&&l.media_id==='24')); assert.ok(!plan.expected.assignments.some(l=>l.variant_id==='11'&&l.media_id==='21'));
  const {after,ids}=persisted(plan); verifyReviewedLocalGallery(before,after,plan,ids); assert.equal(planReviewedLocalGallery(after,ledger(asset())).mutationCount,0);
});
test('refuses global conversion that would reorder the uncovered gallery', () => {
  const before=state(); before.assignments.push(link('12','21',0)); before.media.push(media('24',-2)); assert.throws(()=>planReviewedLocalGallery(before,ledger(asset())),/Uncovered photo visibility\/order/);
});
test('fully covered family removes orphan photographs but never global or hidden technical images', () => {
  const before=state(); before.media.push(media('24',3)); const plan=planReviewedLocalGallery(before,ledger(asset({variantSkus:['A','B']}))); assert.deepEqual(plan.deletes.map(r=>r.id),['21','24']); assert.ok(plan.expected.media.some(r=>r.id==='23'));
});
test('exact scope rejects wrong family, excluded or unresolved SKU, aluminium, duplicate main and missing main', () => {
  const wrong=ledger(asset({slug:'wrong'})); assert.throws(()=>planReviewedLocalGallery(state(),wrong),/Missing\/archived/);
  for(const manifest of [ {...ledger(asset()),exclusions:[{sku:'A',slug:'tool'}]}, {...ledger(asset()),unresolvedSkus:['A']}, ledger(asset({variantSkus:['MAT-KOV-ALU-X']})) ]) assert.throws(()=>validateReviewedLocalGallery(manifest),/excluded\/unresolved\/aluminium/);
  assert.throws(()=>validateReviewedLocalGallery(ledger(asset(),asset({id:'second',blobUrl:'/images/catalog/2026-09/second.png'}))),/Exactly one main/);
  assert.throws(()=>validateReviewedLocalGallery(ledger(asset({role:'detail'}))),/Exactly one main/);
  const partial=ledger(asset()); partial.exclusions=[{sku:'B',slug:'tool'}]; assert.doesNotThrow(()=>planReviewedLocalGallery(state(),partial));
});
test('unrelated items/variants and files are not removed; original zoom requires exact recorded source dimensions', () => {
  const before=state(); before.items.push({id:'2',slug:'aluminijasta-plosca',status:'active'}); before.variants.push({id:'13',item_id:'2',variant_sku:'MAT-KOV-ALU-X'}); before.media.push({...media('30',0),item_id:'2'});
  const plan=planReviewedLocalGallery(before,ledger(asset())); assert.deepEqual(plan.expected.media.find(r=>r.id==='30'),before.media.at(-1));
  const zoom=ledger(asset({imageDimensions:{width:1254,height:600,originalUrl:'/images/catalog/2026-09/original.png',originalWidth:1500,originalHeight:1500}}));
  assert.throws(()=>validateReviewedLocalGallery(zoom),/Original zoom identity/); zoom.sourceOriginals=[{blobUrl:'/images/catalog/2026-09/original.png',width:1500,height:1500,sha256:'b'.repeat(64)}]; assert.doesNotThrow(()=>validateReviewedLocalGallery(zoom));
});
test('verification rejects association order or metadata drift, but accepts DB-generated creation timestamps', () => {
  const before=state(),plan=planReviewedLocalGallery(before,ledger(asset())); const {after,ids}=persisted(plan); assert.doesNotThrow(()=>verifyReviewedLocalGallery(before,after,plan,ids));
  const shifted=structuredClone(after); shifted.assignments.find(l=>l.media_id==='100')!.position=99; assert.throws(()=>verifyReviewedLocalGallery(before,shifted,plan,ids),/Unexpected association\/order/);
  const changed=structuredClone(after); changed.media.find(r=>r.id==='22')!.hidden=true; assert.throws(()=>verifyReviewedLocalGallery(before,changed,plan,ids),/Unexpected media/);
  const stale=structuredClone(after); stale.variants[0].price=11; assert.throws(()=>verifyReviewedLocalGallery(before,stale,plan,ids),/Product\/variant data/);
});
test('a changed existing selected record cannot be silently repaired or broadened to an unauthorized variant', () => {
  const plan=planReviewedLocalGallery(state(),ledger(asset())); const {after}=persisted(plan); after.media.find(r=>r.id==='100')!.alt_text='changed'; assert.throws(()=>planReviewedLocalGallery(after,ledger(asset())),/metadata changed/);
});

test('targeted detail omissions retain existing link-position gaps and repeat without renumbering', () => {
  const initial = ledger(asset(), asset({ id: 'side', role: 'detail', blobUrl: '/images/catalog/2026-09/side.png' }), asset({ id: 'chart', role: 'diagram', imageType: 'diagram', blobUrl: '/images/catalog/2026-09/chart.png' }));
  const { after } = persisted(planReviewedLocalGallery(state(), initial));
  const sideId = after.media.find(row => row.blob_url === initial.assets[1].blobUrl)!.id;
  after.media = after.media.filter(row => row.id !== sideId);
  after.assignments = after.assignments.filter(link => link.media_id !== sideId);
  const reduced = ledger(initial.assets[0], initial.assets[2]);
  const repeat = planReviewedLocalGallery(after, reduced);
  assert.equal(repeat.mutationCount, 0);
  assert.deepEqual(repeat.expected.assignments, after.assignments);
  const reordered = structuredClone(after);
  reordered.assignments.find(link => link.media_id === '100')!.position = 99;
  assert.throws(() => planReviewedLocalGallery(reordered, reduced), /association order changed/);
});
