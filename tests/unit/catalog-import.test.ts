import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { parseCatalogImportArgs, resolveCatalogImportTarget, planCatalogImportProduct, validateCatalogImportManifest, validateCatalogImportAssets, type CatalogImportProduct } from '../../scripts/import-atehna-catalog';
import type { CatalogItemEditorHydration } from '../../src/shared/domain/catalog/catalogAdminTypes';

const product = (): CatalogImportProduct => ({
  itemName: 'Aluminijasta plošča', itemType: 'sheet', productType: 'dimensions', status: 'inactive',
  slug: 'aluminijasta-plosca', categoryPath: ['Materiali'], sku: 'ALU',
  variants: [{ variantName: '300 × 200 × 0,5 mm', variantSku: 'ALU-300-200-05', length: 300, width: 200, thickness: 0.5, price: 0, inventory: 0 }],
  media: [{ mediaKind: 'image', role: 'gallery', sourceKind: 'upload', blobUrl: '/catalog/aluminij.webp', altText: 'Aluminijasta plošča' }],
  sourceUrls: ['https://atehna.si/aluminij/']
});
const existing = (): CatalogItemEditorHydration => ({
  ...product(), id: 12, updatedAt: '2026-09-09T01:00:00.000Z', status: 'active',
  badge: null, statusBeforeDelete: null, deletedAt: null, purgeAfter: null, unit: 'kos', brand: null, material: 'Aluminij', colour: null, shape: 'plošča', description: 'Obstoječi opis', adminNotes: 'Preverjena interna opomba', taxRate: 0.22,
  appearanceOverride: null, position: 4, defaultVariantId: 101, optionAxes: [], quantityDiscounts: [], typeSpecificData: { dimensions: { localSetting: true } }, machineSerialOrderMatches: [],
  variants: [{ ...product().variants[0], id: 101, variantSku: 'ORIGINAL-SKU', price: 12.5, costNet: 4, inventory: 19, weight: 0.081, status: 'active', stockRevision: '7', pricingRevision: '9', imageAssignments: [0] }],
  media: [{ ...product().media[0], blobUrl: '/catalog/old-aluminij.webp', id: 201, variantIndex: 0 }]
} as CatalogItemEditorHydration);

test('manifest rejects repeated product identities and SKUs before any database write', () => {
  const duplicate = product();
  duplicate.slug = 'bakrena-plosca'; duplicate.itemName = 'Bakrena plošča'; duplicate.sku = 'CU';
  assert.throws(() => validateCatalogImportManifest({ version: 1, products: [product(), duplicate] }), /duplicate ALU-300-200-05/u);
  assert.throws(() => validateCatalogImportManifest({ version: 1, products: [{ ...product(), slug: 'Aluminijasta plošča' }] }), /slug/u);
  assert.throws(() => validateCatalogImportManifest({ version: 1, products: [{ ...product(), id: 12 }] }), /omit database IDs/u);
});

test('new records stay inactive even when the manifest asks to publish', () => {
  const incoming = product(); incoming.status = 'active'; incoming.variants[0].status = 'active';
  const plan = planCatalogImportProduct(incoming, null);
  assert.equal(plan.payload.status, 'inactive'); assert.equal(plan.payload.variants[0].status, 'inactive');
  assert.equal(plan.payload.variants[0].weight, undefined);
});

test('matched dimensions retain IDs, commerce values and optimistic concurrency revisions', () => {
  const before = existing();
  const plan = planCatalogImportProduct(product(), before);
  assert.equal(plan.payload.id, 12); assert.equal(plan.payload.expectedUpdatedAt, before.updatedAt);
  assert.equal(plan.payload.status, 'active');
  assert.equal(plan.payload.variants[0].id, 101); assert.equal(plan.payload.variants[0].variantSku, 'ORIGINAL-SKU');
  assert.equal(plan.payload.variants[0].inventory, 19); assert.equal(plan.payload.variants[0].price, 12.5);
  assert.equal(plan.payload.variants[0].costNet, 4); assert.equal(plan.payload.variants[0].weight, 0.081);
  assert.equal(plan.payload.variants[0].expectedStockRevision, '7'); assert.equal(plan.payload.variants[0].expectedPricingRevision, '9');
  assert.deepEqual(plan.payload.typeSpecificData, { dimensions: { localSetting: true } });
  assert.deepEqual(before, existing(), 'Planning must not mutate the fetched snapshot.');
});

test('different thickness creates a new variant and can retire the old one without deletion', () => {
  const before = existing(); before.variants[0].thickness = 1; before.variants[0].variantName = '300 × 200 × 1 mm';
  const plan = planCatalogImportProduct({ ...product(), deactivateUnlistedVariants: true }, before);
  assert.equal(plan.addedVariants, 1); assert.equal(plan.retainedExtraVariants, 1);
  assert.equal(plan.payload.variants.length, 2); assert.equal(plan.payload.variants[0].id, undefined);
  assert.equal(plan.payload.variants[1].id, 101); assert.equal(plan.payload.variants[1].thickness, 1);
  assert.equal(plan.payload.variants[1].inventory, 19); assert.equal(plan.payload.variants[1].status, 'inactive');
  assert.equal(plan.payload.status, 'inactive');
});

test('reused SKU with incompatible dimensions fails instead of rewriting inventory identity', () => {
  const before = existing(); before.variants[0].variantSku = product().variants[0].variantSku; before.variants[0].thickness = 1;
  assert.throws(() => planCatalogImportProduct(product(), before), /different dimensions/u);
});

test('gallery is additive, existing assignments follow their image, and repeated import is stable', () => {
  const initial = planCatalogImportProduct(product(), existing());
  assert.equal(initial.payload.media.length, 2); assert.equal(initial.payload.media[1].id, 201);
  assert.deepEqual(initial.payload.variants[0].imageAssignments, [1]);
  assert.equal(initial.payload.media[1].variantIndex, 0);
  const after = { ...existing(), ...initial.payload, updatedAt: '2026-09-09T02:00:00.000Z', media: initial.payload.media.map((media, index) => ({ ...media, id: media.id ?? 300 + index })) } as CatalogItemEditorHydration;
  const repeated = planCatalogImportProduct(product(), after);
  assert.equal(repeated.addedVariants, 0); assert.equal(repeated.payload.variants.length, 1);
  assert.equal(repeated.payload.media.length, 2); assert.equal(repeated.payload.media[0].id, 300);
  assert.equal(repeated.payload.adminNotes, initial.payload.adminNotes);
});

test('option axes and values keep IDs across repeated imports and preserve unlisted values', () => {
  const before = existing(); before.optionAxes = [{ id: 5, name: 'Barva', slug: 'barva', values: [{ id: 7, value: 'Rdeča', slug: 'rdeca' }] }];
  const incoming = product(); incoming.optionAxes = [{ name: 'Barva', slug: 'barva', values: [{ value: 'Modra', slug: 'modra' }] }];
  const first = planCatalogImportProduct(incoming, before);
  assert.equal(first.payload.optionAxes?.[0].id, 5); assert.equal(first.payload.optionAxes?.[0].values[0].id, 7);
  assert.equal(first.payload.optionAxes?.[0].values.length, 2);
  const after = { ...before, ...first.payload } as CatalogItemEditorHydration;
  assert.equal(planCatalogImportProduct(incoming, after).payload.optionAxes?.[0].values.length, 2);
});

test('public assets must exist and cannot traverse outside the public directory', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'atehna-import-assets-'));
  try {
    await mkdir(path.join(root, 'public', 'catalog'), { recursive: true });
    await writeFile(path.join(root, 'public', 'catalog', 'aluminij.webp'), 'fixture');
    const manifest = validateCatalogImportManifest({ version: 1, products: [product()] });
    await validateCatalogImportAssets(manifest, root);
    await writeFile(path.join(root, 'outside.png'), 'fixture');
    manifest.products[0].media[0].blobUrl = '/../outside.png';
    await assert.rejects(validateCatalogImportAssets(manifest, root), /outside public/u);
    manifest.products[0].media[0].blobUrl = '/catalog/missing.png';
    await assert.rejects(validateCatalogImportAssets(manifest, root), /ENOENT/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('variants with equal dimensions and different colours remain distinct', () => {
  const incoming = product();
  incoming.variants = [
    { ...incoming.variants[0], variantName: 'Pleksi rdeč', variantSku: 'PLEKSI-R' },
    { ...incoming.variants[0], variantName: 'Pleksi moder', variantSku: 'PLEKSI-M' }
  ];
  assert.doesNotThrow(() => validateCatalogImportManifest({ version: 1, products: [incoming] }));
  const before = existing(); before.variants[0].variantName = 'Pleksi zelen'; before.variants[0].variantSku = 'PLEKSI-Z';
  const plan = planCatalogImportProduct(incoming, before);
  assert.equal(plan.addedVariants, 2); assert.equal(plan.retainedExtraVariants, 1);
  assert.equal(plan.payload.variants[2].id, 101);
});

test('replacing a gallery hides old images, retains their IDs and removes hidden slot assignments', () => {
  const plan = planCatalogImportProduct({ ...product(), hideUnlistedGalleryImages: true }, existing());
  assert.equal(plan.payload.media.length, 2); assert.equal(plan.payload.media[1].id, 201);
  assert.equal(plan.payload.media[1].hidden, true); assert.equal(plan.payload.media[1].variantIndex, null);
  assert.deepEqual(plan.payload.variants[0].imageAssignments, []);
});

test('reused media assignments follow an existing variant when import order changes', () => {
  const before = existing();
  before.variants.push({ ...before.variants[0], id: 102, variantName: '200 × 200 × 0,5 mm', variantSku: 'ALU-200-200-05', length: 200, width: 200 });
  const incoming = product();
  incoming.variants = [
    { ...before.variants[1], id: undefined },
    { ...product().variants[0] }
  ];
  incoming.media = [{ ...before.media[0], id: undefined, variantIndex: undefined }];
  delete incoming.media[0].variantIndex;
  const plan = planCatalogImportProduct(incoming, before);
  assert.equal(plan.payload.variants[0].id, 102);
  assert.equal(plan.payload.variants[1].id, 101);
  assert.equal(plan.payload.media[0].id, 201);
  assert.equal(plan.payload.media[0].variantIndex, 1);
  incoming.media[0].variantIndex = 0;
  assert.equal(planCatalogImportProduct(incoming, before).payload.media[0].variantIndex, 0, 'Explicit new assignment wins.');
});

const productionArgs = ['--production', '--expected-host', 'catalog.example.test', '--expected-database', 'atehna'];

test('production requires explicit target confirmations and still defaults to a preview', () => {
  assert.deepEqual(parseCatalogImportArgs([]), { apply: false, production: false });
  const preview = parseCatalogImportArgs(productionArgs);
  assert.equal(preview.production, true);
  assert.equal(preview.apply, false);
  assert.equal(parseCatalogImportArgs([...productionArgs, '--apply']).apply, true);
  assert.equal(parseCatalogImportArgs([...productionArgs, '--dry-run']).apply, false);
  assert.throws(() => parseCatalogImportArgs(['--production']), /requires --expected-host and --expected-database/u);
  assert.throws(() => parseCatalogImportArgs(['--expected-host', 'catalog.example.test']), /require --production/u);
  assert.throws(() => parseCatalogImportArgs([...productionArgs, '--apply', '--dry-run']), /Choose --apply or --dry-run/u);
  assert.throws(() => parseCatalogImportArgs([...productionArgs, '--expected-host', 'different.example.test']), /Repeated argument/u);
  assert.throws(() => parseCatalogImportArgs(['--production', '--expected-host', '--apply']), /requires a value/u);
});

test('production uses the caller database and never falls back to development env files', () => {
  const options = parseCatalogImportArgs(productionArgs);
  let loaded = false;
  const loadDevelopment = () => { loaded = true; throw new Error('Development environment must not be read.'); };
  assert.throws(() => resolveCatalogImportTarget(options, {}, loadDevelopment), /requires DATABASE_URL in the caller environment/u);
  assert.throws(() => resolveCatalogImportTarget(options, { DATABASE_URL: '   ' }, loadDevelopment), /requires DATABASE_URL/u);
  const target = resolveCatalogImportTarget(options, { DATABASE_URL: 'postgresql://user:secret@catalog.example.test/atehna?sslmode=require' }, loadDevelopment);
  assert.equal(target.hostname, 'catalog.example.test');
  assert.equal(target.database, 'atehna');
  assert.equal(loaded, false);
});

test('production rejects mismatched host, database, local addresses and invalid URLs', () => {
  const options = parseCatalogImportArgs(productionArgs);
  assert.throws(() => resolveCatalogImportTarget(options, { DATABASE_URL: 'postgresql://different.example.test/atehna' }), /host does not match/u);
  assert.throws(() => resolveCatalogImportTarget(options, { DATABASE_URL: 'postgresql://catalog.example.test/other' }), /database does not match/u);
  for (const host of ['localhost', '127.0.0.1', '127.0.0.2', '[::1]', '0.0.0.0', 'db.localhost']) {
    assert.throws(() => resolveCatalogImportTarget({ ...options, expectedHost: host }, { DATABASE_URL: `postgresql://${host}/atehna` }), /requires a remote database/u);
  }
  assert.throws(() => resolveCatalogImportTarget(options, { DATABASE_URL: 'https://catalog.example.test/atehna' }), /must use postgres/u);
  assert.throws(() => resolveCatalogImportTarget(options, { DATABASE_URL: 'postgresql://secret@' }), /not a valid PostgreSQL URL/u);
});

test('default local mode loads development settings and refuses a remote database', () => {
  const options = parseCatalogImportArgs([]);
  const environment: Record<string, string | undefined> = {};
  let loadCount = 0;
  const target = resolveCatalogImportTarget(options, environment, () => { loadCount += 1; environment.DATABASE_URL = 'postgresql://localhost/atehna_local'; });
  assert.equal(loadCount, 1);
  assert.equal(target.database, 'atehna_local');
  assert.throws(() => resolveCatalogImportTarget(options, { DATABASE_URL: 'postgresql://catalog.example.test/atehna' }, () => {}), /only accepts a local database/u);
});


test('existing delivery settings and default variant survive incoming local placeholders and reordering', () => {
  const before = existing();
  before.typeSpecificData = { dimensions: { defaultDeliveryTime: '10 dni', variantDeliveryTimes: { '101': '14 dni' } } };
  before.variants[0].contentOverride = { deliveryEstimate: '21 dni', description: 'Old variant description' };
  const incoming = product();
  incoming.typeSpecificData = { dimensions: { defaultDeliveryTime: '2 dni', variantDeliveryTimes: { '101': '3 dni' }, sourceMaterial: 'Aluminij' } };
  incoming.defaultVariantIndex = 0;
  incoming.variants.unshift({ variantName: '100 x 100 x 0,5 mm', variantSku: 'ALU-100', length: 100, width: 100, thickness: 0.5, price: 0 });
  incoming.variants[1].contentOverride = { deliveryEstimate: '', description: 'Updated variant description' };
  const plan = planCatalogImportProduct(incoming, before);
  assert.deepEqual(plan.payload.typeSpecificData, { dimensions: { defaultDeliveryTime: '10 dni', variantDeliveryTimes: { '101': '14 dni' }, sourceMaterial: 'Aluminij' } });
  assert.equal(plan.payload.variants[1].contentOverride?.deliveryEstimate, '21 dni');
  assert.equal(plan.payload.variants[1].contentOverride?.description, 'Updated variant description');
  assert.equal(plan.payload.defaultVariantId, 101);
  assert.equal(plan.payload.defaultVariantIndex, undefined);
});

test('simple operating values and measurements survive incoming placeholders while specifications update', () => {
  const before = existing();
  before.typeSpecificData = { simple: { deliveryTime: '8 dni', minStock: 5, stock: 19, warehouseLocation: 'A12', requireInstructions: true, weightGrams: 81, lengthMm: 300, widthMm: 200, thicknessMm: 0.5, saleStatus: 'available', visibleInStore: true, basePrice: 12.5, technicalSpecs: [{ label: 'Material', value: 'Old' }] } };
  const incoming = product();
  incoming.typeSpecificData = { simple: { deliveryTime: '', minStock: 0, stock: 0, warehouseLocation: '', requireInstructions: false, weightGrams: null, lengthMm: null, widthMm: null, thicknessMm: null, saleStatus: 'hidden', visibleInStore: false, basePrice: 0, technicalSpecs: [{ label: 'Material', value: 'Aluminij' }] } };
  const plan = planCatalogImportProduct(incoming, before);
  assert.deepEqual(plan.payload.typeSpecificData, { simple: { ...before.typeSpecificData.simple as Record<string, unknown>, technicalSpecs: [{ label: 'Material', value: 'Aluminij' }] } });
});

test('existing products without a delivery estimate do not acquire local placeholder estimates', () => {
  const before = existing();
  const incoming = product();
  incoming.typeSpecificData = { dimensions: { defaultDeliveryTime: '2 dni', variantDeliveryTimes: {} } };
  incoming.variants[0].contentOverride = { deliveryEstimate: '2 dni' };
  const plan = planCatalogImportProduct(incoming, before);
  assert.deepEqual(plan.payload.typeSpecificData, { dimensions: { localSetting: true } });
  assert.equal(plan.payload.variants[0].contentOverride?.deliveryEstimate, undefined);
  assert.deepEqual(planCatalogImportProduct(incoming, null).payload.typeSpecificData, incoming.typeSpecificData, 'New drafts retain their own manifest settings.');
});
