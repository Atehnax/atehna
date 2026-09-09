import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  catalogTypeCorrections, catalogTypeHash, migrateCatalogTypeData,
  parseCatalogTypeArgs, planCatalogTypeCorrections, resolveCatalogTypeTarget
} from '../../scripts/reclassify-atehna-catalog';
import type { CatalogEditorProductType } from '../../src/shared/domain/catalog/catalogAdminTypes';

const manifest = JSON.parse(readFileSync('data/catalog/atehna-2026-09.json', 'utf8')) as {
  products: Array<{ slug: string; productType: CatalogEditorProductType; itemType: string; unit: string; typeSpecificData: Record<string, unknown>; variants: Array<Record<string, unknown>> }>
};
function originalRows() {
  const items = manifest.products.map((product, index) => ({ id: String(index + 1), slug: product.slug,
    item_type: catalogTypeCorrections[product.slug].originalItemType, status: 'inactive', category_id: `category-${index}`, sku: `sku-${index}` }));
  const details = manifest.products.map((product, index) => {
    const data = structuredClone(product.typeSpecificData);
    if (catalogTypeCorrections[product.slug].productType === 'unique_machine') delete data.uniqueMachine;
    return { item_id: String(index + 1), product_type: catalogTypeCorrections[product.slug].originalType, data };
  });
  const variants = manifest.products.flatMap((product, index) => product.variants.map((variant, variantIndex) => ({ ...structuredClone(variant), id: `${index + 1}-${variantIndex}`, item_id: String(index + 1), content_override_json: variant.contentOverride })));
  return { items, details, variants };
}

test('reviewed catalog uses 12 dimension materials, 29 standard products and two machines', () => {
  assert.equal(Object.keys(catalogTypeCorrections).length, 43);
  assert.equal(manifest.products.length, 43);
  const counts: Record<string, number> = {};
  for (const product of manifest.products) {
    const correction = catalogTypeCorrections[product.slug];
    assert.ok(correction, product.slug);
    assert.equal(product.productType, correction.productType, product.slug);
    assert.equal(product.itemType, correction.itemType, product.slug);
    counts[product.productType] = (counts[product.productType] ?? 0) + 1;
  }
  assert.deepEqual(counts, { dimensions: 12, simple: 29, unique_machine: 2 });
  assert.equal(manifest.products.reduce((count, product) => count + product.variants.length, 0), 182);
});

test('packaged contents, hammer mass, blade grade and tool sizes are standard attributes', () => {
  for (const slug of ['mekol', 'uhu-kraft', 'zica-za-lotanje', 'kladivo', 'zagice-za-rezanje-kovin', 'spiralne-zagice-za-les-in-mehke-kovine', 'podlaga-za-rezanje', 'geotrikotnik', 'motorcek', 'barvni-papir', 'fotokarton']) {
    const product = manifest.products.find(entry => entry.slug === slug)!;
    assert.equal(product.productType, 'simple', slug);
    assert.equal(product.unit, 'kos', slug);
  }
  assert.equal(manifest.products.find(product => product.slug === 'mekol')!.variants.length, 5);
  assert.equal(manifest.products.find(product => product.slug === 'kladivo')!.variants.length, 4);
});

test('migration changes only the 15 reviewed types and retains every variant input', () => {
  const rows = originalRows();
  const before = catalogTypeHash(rows);
  const plans = planCatalogTypeCorrections(rows.items, rows.details, rows.variants);
  assert.equal(plans.filter(plan => plan.changed).length, 15);
  assert.deepEqual(plans.filter(plan => plan.metadataChanged).map(plan => plan.slug).sort(), ['krivilnik-za-plasticne-mase', 'vibracijska-zaga-proxxon-dsh']);
  assert.equal(catalogTypeHash(rows), before, 'Planning must not mutate the snapshot.');
  const afterItems = rows.items.map(item => ({ ...item, item_type: plans.find(plan => plan.id === item.id)!.after.itemType }));
  const afterDetails = rows.details.map(detail => { const plan = plans.find(entry => entry.id === detail.item_id)!; return { ...detail, product_type: plan.after.productType, data: plan.data }; });
  assert.ok(planCatalogTypeCorrections(afterItems, afterDetails, rows.variants).every(plan => !plan.changed));
});

test('a missing, archived, duplicate or independently reclassified product blocks the whole plan', () => {
  const rows = originalRows();
  assert.throws(() => planCatalogTypeCorrections(rows.items.slice(1), rows.details, rows.variants), /43 imported products/u);
  assert.throws(() => planCatalogTypeCorrections([...rows.items.slice(1), rows.items[1]], rows.details, rows.variants), /43 imported products/u);
  const archived = structuredClone(rows.items); archived[0].status = 'deleted';
  assert.throws(() => planCatalogTypeCorrections(archived, rows.details, rows.variants), /Archived/u);
  const changedDetails = structuredClone(rows.details); changedDetails[0].product_type = 'weight';
  assert.throws(() => planCatalogTypeCorrections(rows.items, changedDetails, rows.variants), /independently/u);
});

test('machine migration copies reviewed specs without guessing serials, warranty or package mass', () => {
  const data = { simple: { technicalSpecs: [{ id: 'mass', property: 'Masa', value: '20 kg' }], basicInfoRows: [], deliveryTime: '4 dni', basePrice: 212, stock: 3 }, custom: { keep: true } };
  const result = migrateCatalogTypeData(data, 'simple', 'unique_machine');
  assert.deepEqual(result.simple, data.simple);
  assert.deepEqual(result.custom, data.custom);
  assert.deepEqual(result.uniqueMachine, { basicInfoRows: [], specs: data.simple.technicalSpecs, deliveryTime: '4 dni' });
  assert.deepEqual(migrateCatalogTypeData(result, 'unique_machine', 'unique_machine'), result);
});

test('uniform inherited delivery follows the new preset without changing variant rows', () => {
  const rows = originalRows();
  const item = rows.items.find(entry => entry.slug === 'mekol')!;
  const detail = rows.details.find(entry => entry.item_id === item.id)!;
  detail.data = { dimensions: { defaultDeliveryTime: '3–5 dni', variantDeliveryTimes: {} }, custom: true };
  const plan = planCatalogTypeCorrections(rows.items, rows.details, rows.variants).find(entry => entry.slug === 'mekol')!;
  assert.deepEqual(plan.data.simple, { deliveryTime: '3–5 dni' });
  assert.deepEqual(plan.data.dimensions, detail.data.dimensions);
  assert.equal(plan.data.custom, true);
});

test('unexpected per-variant inherited delivery blocks rather than dropping it', () => {
  const rows = originalRows();
  const item = rows.items.find(entry => entry.slug === 'mekol')!;
  const variant = rows.variants.find(entry => entry.item_id === item.id)!;
  rows.details.find(entry => entry.item_id === item.id)!.data = { dimensions: { defaultDeliveryTime: '', variantDeliveryTimes: { [variant.id]: '7 dni' } } };
  assert.throws(() => planCatalogTypeCorrections(rows.items, rows.details, rows.variants), /Delivery differs/u);
});

test('classification CLI defaults to dry-run and requires an unambiguous explicit target', () => {
  assert.deepEqual(parseCatalogTypeArgs(['--target', 'production']), { target: 'production', apply: false });
  assert.deepEqual(parseCatalogTypeArgs(['--target', 'local', '--apply']), { target: 'local', apply: true });
  for (const args of [[], ['--apply'], ['--target', 'staging'], ['--target', 'local', '--apply', '--dry-run'], ['--target', 'local', '--apply', '--apply']]) assert.throws(() => parseCatalogTypeArgs(args));
});

test('database targets reject other databases, hosts and connection query overrides', () => {
  const remote = 'postgresql://test:test@ep-patient-surf-agpt9lqx-pooler.c-2.eu-central-1.aws.neon.tech/atehna_production';
  const local = 'postgresql://test:test@127.0.0.1:55434/atehna_e2e_localhost_quote';
  assert.equal(resolveCatalogTypeTarget('production', remote).database, 'atehna_production');
  assert.equal(resolveCatalogTypeTarget('local', local).database, 'atehna_e2e_localhost_quote');
  for (const url of [remote.replace('atehna_production', 'neondb'), remote.replace('ep-patient-surf-agpt9lqx-pooler.c-2.eu-central-1.aws.neon.tech', 'example.com'), local, remote + '?host=example.com', remote + '?dbname=other']) assert.throws(() => resolveCatalogTypeTarget('production', url));
  assert.throws(() => resolveCatalogTypeTarget('local', remote));
  assert.throws(() => resolveCatalogTypeTarget('local', local.replace('55434', '5432')));
});
