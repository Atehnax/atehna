import test from 'node:test';
import assert from 'node:assert/strict';
import { bindReviewedProductionManifest } from '../../scripts/catalog-dimensions/publish-production';
import { planDimensionSketchSync, type DimensionSketchManifest, type DimensionSketchState } from '../../scripts/catalog-dimensions/sync';

function fixture() {
  const snapshot = { id: '1', variantSku: 'ALU-300', variantName: '300 × 200 × 0,5 mm', length: 300, width: 200, thickness: 0.5, contentOverride: null, optionLabels: { Dimenzije: '300 × 200 mm' } };
  const manifest: DimensionSketchManifest & { productNames: Record<string, string> } = {
    version: 1, mode: 'per-variant', productNames: { 'aluminijasta-plosca': 'Aluminijasta plošča' },
    products: [{
      slug: 'aluminijasta-plosca', itemId: '10', variantSnapshot: [snapshot],
      images: [{ url: '/images/catalog/2026-09/dimenzije/alu.svg', filename: 'alu.svg', imageType: 'dimension-diagram', width: 1800, height: 1800, sha256: 'a'.repeat(64), altText: 'Skica', variantIds: ['1'], variantSkus: ['ALU-300'] }]
    }]
  };
  const state: DimensionSketchState = {
    items: [{ id: '500', slug: 'aluminijasta-plosca', item_name: 'Aluminijasta plošča', status: 'active' }],
    variants: [{ id: '900', item_id: '500', variant_sku: 'ALU-300', variant_name: snapshot.variantName, length: 300, width: 200, thickness: 0.5, content_override_json: null, dimension_option_labels: snapshot.optionLabels }],
    media: [{ id: '800', item_id: '500', filename: 'photo.jpg', blob_url: '/photo.jpg', media_kind: 'image', role: 'main', source_kind: 'upload', hidden: false, position: 0 }],
    assignments: [{ item_id: '500', variant_id: '900', media_id: '800', position: 0 }]
  };
  return { manifest, state };
}

test('production binding resolves fresh slug/SKU identities and appends media without touching photographs', () => {
  const { manifest, state } = fixture();
  const before = structuredClone(state);
  const bound = bindReviewedProductionManifest(manifest, state);
  assert.equal(bound.products[0].itemId, '500');
  assert.equal(bound.products[0].variantSnapshot[0].id, '900');
  assert.deepEqual(bound.products[0].images[0].variantIds, ['900']);
  assert.equal(manifest.products[0].itemId, '10');
  const plan = planDimensionSketchSync(bound, state);
  assert.equal(plan.mediaInserts.length, 1);
  assert.equal(plan.mediaInserts[0].item_id, '500');
  assert.equal(plan.mediaInserts[0].position, 1);
  assert.deepEqual(plan.mediaUpdates, []);
  assert.equal(plan.assignmentInserts[0].variant_id, '900');
  assert.equal(plan.assignmentInserts[0].position, 1);
  assert.deepEqual(state, before);
});

test('production publisher rejects geometry, specification, option, identity and variant-set drift', () => {
  const mutations = [
    (s: DimensionSketchState) => { s.variants[0].width = 201; },
    (s: DimensionSketchState) => { s.variants[0].content_override_json = { specifications: { Material: 'Baker' } }; },
    (s: DimensionSketchState) => { s.variants[0].dimension_option_labels = { Dimenzije: '301 × 200 mm' }; },
    (s: DimensionSketchState) => { s.variants[0].variant_sku = 'ALU-OTHER'; },
    (s: DimensionSketchState) => { s.variants.push({ ...s.variants[0], id: '901' }); },
    (s: DimensionSketchState) => { s.items[0].item_name = 'Bakrena plošča'; },
    (s: DimensionSketchState) => { s.items[0].status = 'deleted'; }
  ];
  for (const mutate of mutations) {
    const { manifest, state } = fixture();
    mutate(state);
    assert.throws(() => bindReviewedProductionManifest(manifest, state));
  }
});
