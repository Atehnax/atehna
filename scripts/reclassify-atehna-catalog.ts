/** Narrow, repeatable correction of the 43 September 2026 imported product types.
 * Dry-run is the default. DATABASE_URL must name the exact selected database.
 * Usage: node --import tsx scripts/reclassify-atehna-catalog.ts --target local|production [--apply]
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { resolveCatalogVariantDeliveryEstimate } from '../src/shared/domain/catalog/catalogDeliveryEstimate';
import { buildCatalogPresentationDetails } from '../src/shared/domain/catalog/catalogPresentation';
import type { CatalogEditorProductType } from '../src/shared/domain/catalog/catalogAdminTypes';

type ProductType = CatalogEditorProductType;
type Row = Record<string, unknown>;
type Classification = { productType: ProductType; itemType: 'sheet' | 'unit'; originalType: ProductType; originalItemType: 'sheet' | 'unit' };
const dimensions = [
  'aluminijasta-plosca', 'bakrena-plosca', 'pocinkana-plocevina', 'medeninasta-plosca',
  'penjeni-pvc-komateks', 'pleksi-steklo', 'stiropor', 'seleshamer', 'grafopak',
  'lepenka', 'risalni-list', 'vezana-plosca'
];
const convertedStandard = [
  'barvni-papir', 'fotokarton', 'motorcek', 'geotrikotnik', 'trikotniki-za-tablo',
  'ravnila-za-tablo', 'sestilo', 'kladivo', 'solska-tehtnica',
  'spiralne-zagice-za-les-in-mehke-kovine', 'zagice-za-rezanje-kovin',
  'podlaga-za-rezanje', 'mekol'
];
const standard = [
  'trigonir', 'magnetni-trinog', 'tracni-meter', 'elektricarske-klesce-za-snemanje-izolacije',
  'zlatarske-skarje-za-plocevino', 'digitalno-pomicno-merilo', 'zica-za-lotanje',
  'aluminijasto-ravnilo-z-rocajem', 'otroski-zascitni-predpasnik',
  'otroska-ocala-za-zascito-oci', 'ocala-za-zascito-oci', 'uhu-kraft', 'uhu-super-glue',
  'ploscata-baterija', 'vgradno-stikalo', 'objemka-za-motorcek-re260'
];
const machines = ['krivilnik-za-plasticne-mase', 'vibracijska-zaga-proxxon-dsh'];
export const catalogTypeCorrections: Record<string, Classification> = Object.fromEntries([
  ...dimensions.map(slug => [slug, { productType: 'dimensions', itemType: 'sheet', originalType: 'dimensions', originalItemType: 'sheet' }]),
  ...convertedStandard.map(slug => [slug, { productType: 'simple', itemType: 'unit', originalType: 'dimensions', originalItemType: ['barvni-papir', 'fotokarton'].includes(slug) ? 'sheet' : 'unit' }]),
  ...standard.map(slug => [slug, { productType: 'simple', itemType: 'unit', originalType: 'simple', originalItemType: 'unit' }]),
  ...machines.map(slug => [slug, { productType: 'unique_machine', itemType: 'unit', originalType: 'simple', originalItemType: 'unit' }])
]);
function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const record = (value: unknown): Row => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null;
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value instanceof Date) return value.toISOString();
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonical(entry)]));
  return value;
}
export const catalogTypeHash = (value: unknown) => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const omit = (value: Row, keys: string[]) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));

/** Copy only presentation fields whose ownership changes; commerce remains on variant rows. */
export function migrateCatalogTypeData(data: Row, before: ProductType, after: ProductType): Row {
  const result = structuredClone(data);
  if (before === after) return result;
  const delivery = buildCatalogPresentationDetails(before, data).deliveryEstimate;
  if (after === 'simple' && delivery !== null) {
    const simple = record(result.simple);
    if (simple.deliveryTime === undefined) result.simple = { ...simple, deliveryTime: delivery };
  }
  if (after === 'unique_machine') {
    const simple = record(data.simple);
    const machine = { ...record(result.uniqueMachine ?? result.machine) };
    if (machine.basicInfoRows === undefined && machine.basicInfo === undefined && Array.isArray(simple.basicInfoRows ?? simple.basicInfo)) {
      machine.basicInfoRows = structuredClone(simple.basicInfoRows ?? simple.basicInfo);
    }
    if (machine.specs === undefined && machine.technicalSpecs === undefined && Array.isArray(simple.technicalSpecs)) {
      machine.specs = structuredClone(simple.technicalSpecs);
    }
    if (machine.deliveryTime === undefined && delivery !== null) machine.deliveryTime = delivery;
    if (Object.keys(machine).length) result.uniqueMachine = machine;
  }
  return result;
}

type Item = Row & { id: string; slug: string; item_type: string; status: string };
type Details = Row & { item_id: string; product_type: ProductType; data: Row };
export type TypeChange = {
  id: string; slug: string; before: { productType: ProductType; itemType: string };
  after: Classification; data: Row; changed: boolean; metadataChanged: boolean;
};
export function planCatalogTypeCorrections(items: Item[], details: Details[], variants: Row[]): TypeChange[] {
  const slugs = Object.keys(catalogTypeCorrections);
  ensure(items.length === slugs.length && new Set(items.map(item => item.slug)).size === slugs.length, 'Expected exactly the 43 imported products.');
  return items.map(item => {
    const expected = catalogTypeCorrections[item.slug];
    ensure(expected, `Unexpected product: ${item.slug}`);
    ensure(item.status !== 'deleted', `Archived product needs review: ${item.slug}`);
    const detail = details.find(entry => String(entry.item_id) === String(item.id));
    ensure(detail, `Missing editor details: ${item.slug}`);
    const alreadyCorrect = detail.product_type === expected.productType && item.item_type === expected.itemType;
    const originalItemType = expected.originalItemType;
    ensure(alreadyCorrect || (detail.product_type === expected.originalType && item.item_type === originalItemType), `Product was reclassified independently; review ${item.slug}.`);
    const data = migrateCatalogTypeData(record(detail.data), detail.product_type, expected.productType);
    const itemVariants = variants.filter(variant => String(variant.item_id) === String(item.id));
    ensure(itemVariants.length > 0, `Product has no variants: ${item.slug}`);
    for (const variant of itemVariants) {
      const dimension = (value: unknown) => value === null || value === undefined ? null : Number(value);
      const deliveryVariant = { id: String(variant.id), length: dimension(variant.length), width: dimension(variant.width), thickness: dimension(variant.thickness), contentOverride: variant.content_override_json };
      ensure(resolveCatalogVariantDeliveryEstimate(detail.product_type, detail.data, deliveryVariant) === resolveCatalogVariantDeliveryEstimate(expected.productType, data, deliveryVariant), `Delivery differs after reclassification: ${item.slug}/${variant.id}. Review the inherited per-variant delivery before applying.`);
    }
    if (detail.product_type === 'simple' && expected.productType === 'unique_machine') {
      const presentation = (type: ProductType, value: Row) => buildCatalogPresentationDetails(type, value).specifications.map(spec => ({ label: spec.label, value: spec.value, group: spec.group }));
      const beforeSpecs = presentation(detail.product_type, detail.data);
      const afterSpecs = presentation(expected.productType, data);
      ensure(beforeSpecs.every(spec => afterSpecs.some(entry => catalogTypeHash(spec) === catalogTypeHash(entry))), `Machine specifications would be lost: ${item.slug}`);
    }
    return { id: String(item.id), slug: item.slug, before: { productType: detail.product_type, itemType: item.item_type }, after: expected, data,
      changed: !alreadyCorrect || catalogTypeHash(data) !== catalogTypeHash(detail.data), metadataChanged: catalogTypeHash(data) !== catalogTypeHash(detail.data) };
  });
}

export function parseCatalogTypeArgs(args: string[]) {
  let target: 'local' | 'production' | undefined;
  let apply = false;
  const seen = new Set<string>();
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    ensure(!seen.has(arg), `Repeated argument: ${arg}`); seen.add(arg);
    if (arg === '--target') {
      const value = args[++index];
      ensure(value === 'local' || value === 'production', '--target must be local or production.'); target = value;
    } else if (arg === '--apply') apply = true;
    else if (arg !== '--dry-run') throw new Error(`Unknown argument: ${arg}`);
  }
  ensure(target, 'Usage: reclassify-atehna-catalog.ts --target local|production [--apply|--dry-run]');
  ensure(!(seen.has('--apply') && seen.has('--dry-run')), 'Choose --apply or --dry-run.');
  return { target, apply };
}
export function resolveCatalogTypeTarget(mode: 'local' | 'production', databaseUrl: string | undefined) {
  ensure(databaseUrl, 'DATABASE_URL must be provided by the caller.');
  let target: URL;
  try { target = new URL(databaseUrl); } catch { throw new Error('Invalid PostgreSQL DATABASE_URL.'); }
  ensure(['postgres:', 'postgresql:'].includes(target.protocol), 'Expected a PostgreSQL URL.');
  const database = decodeURIComponent(target.pathname.slice(1));
  if (mode === 'production') {
    ensure(target.hostname === 'ep-patient-surf-agpt9lqx-pooler.c-2.eu-central-1.aws.neon.tech' && database === 'atehna_production' && ['', '5432'].includes(target.port), 'Unexpected production database target.');
  } else {
    ensure(target.hostname === '127.0.0.1' && target.port === '55434' && database === 'atehna_e2e_localhost_quote', 'Unexpected local database target.');
  }
  ensure(!target.searchParams.has('host') && !target.searchParams.has('port') && !target.searchParams.has('dbname'), 'Connection query must not override the target.');
  return { connectionString: target.toString(), hostname: target.hostname, database };
}

// Fixed identifiers only. Hash every row to detect unintended changes, including
// option/media assignments and commerce revisions that are not rewritten here.
const protectedTables = [
  ['catalog_categories', 'id'], ['catalog_item_variants', 'id'], ['catalog_media', 'id'],
  ['catalog_option_axes', 'id'], ['catalog_option_values', 'id'],
  ['catalog_variant_option_values', 'variant_id,axis_id'], ['catalog_variant_media', 'variant_id,media_id'],
  ['catalog_item_quantity_discounts', 'id'], ['catalog_item_slug_aliases', 'id'],
  ['catalog_supplier_rows', 'id'], ['pricing_stock_history', 'id'], ['pricing_stock_model', 'key']
] as const;
async function readProtected(client: pg.PoolClient) {
  const result: Record<string, { rows: number; sha256: string } | { absent: true }> = {};
  for (const [table, order] of protectedTables) {
    // Older local catalogs predate the optional supplier directory.
    if (table === 'catalog_supplier_rows' && !(await client.query('select to_regclass($1) as name', [table])).rows[0].name) {
      result[table] = { absent: true }; continue;
    }
    const rows = (await client.query(`select * from ${table} order by ${order}`)).rows;
    result[table] = { rows: rows.length, sha256: catalogTypeHash(rows) };
  }
  return result;
}

export async function runCatalogTypeCorrection(args = process.argv.slice(2)) {
  const options = parseCatalogTypeArgs(args);
  const target = resolveCatalogTypeTarget(options.target, process.env.DATABASE_URL);
  const manifest = JSON.parse(await readFile('data/catalog/atehna-2026-09.json', 'utf8')) as { products: Array<{ slug: string; productType: string; itemType: string }> };
  ensure(manifest.products.length === 43 && new Set(manifest.products.map(product => product.slug)).size === 43, 'The import manifest must contain the 43 reviewed products.');
  for (const product of manifest.products) {
    const expected = catalogTypeCorrections[product.slug];
    ensure(expected && product.productType === expected.productType && product.itemType === expected.itemType, `Import manifest classification differs: ${product.slug}`);
  }
  const pool = new pg.Pool({ connectionString: target.connectionString, max: 1 });
  const client = await pool.connect();
  let committed = false;
  try {
    await client.query(options.apply ? 'begin isolation level repeatable read' : 'begin isolation level repeatable read read only');
    const identity = (await client.query('select current_database() as database')).rows[0];
    ensure(identity.database === target.database, 'Connected database differs from the selected target.');
    if (options.apply) await client.query("select pg_advisory_xact_lock(hashtext('atehna-catalog-type-correction-2026-09'))");
    const slugs = Object.keys(catalogTypeCorrections).sort();
    const items = (await client.query(`select * from catalog_items where slug=any($1::text[]) order by slug${options.apply ? ' for update' : ''}`, [slugs])).rows as Item[];
    const ids = items.map(item => item.id);
    const details = (await client.query(`select * from catalog_item_editor_details where item_id=any($1::bigint[]) order by item_id${options.apply ? ' for update' : ''}`, [ids])).rows as Details[];
    const variants = (await client.query('select * from catalog_item_variants where item_id=any($1::bigint[]) order by id', [ids])).rows;
    const plans = planCatalogTypeCorrections(items, details, variants);
    const protectedBefore = await readProtected(client);
    const summary = { mode: options.apply ? 'apply' : 'dry-run', target: options.target, host: target.hostname, database: target.database,
      products: plans.length, productsToChange: plans.filter(plan => plan.changed).length,
      metadataToCopy: plans.filter(plan => plan.metadataChanged).map(plan => plan.slug),
      classifications: plans.reduce<Record<string, number>>((counts, plan) => ({ ...counts, [plan.after.productType]: (counts[plan.after.productType] ?? 0) + 1 }), {}),
      changes: plans.filter(plan => plan.changed).map(plan => ({ slug: plan.slug, from: plan.before.productType, to: plan.after.productType })) };
    console.log(JSON.stringify(summary, null, 2));
    if (!options.apply) { await client.query('rollback'); return summary; }
    const runDirectory = path.join('tmp', 'catalog-import', `type-correction-${options.target}-${new Date().toISOString().replace(/[:.]/gu, '-')}`);
    await mkdir(runDirectory, { recursive: true });
    const backup = Buffer.from(JSON.stringify({ capturedAt: new Date().toISOString(), summary, items, details, plans, protectedBefore }, null, 2));
    const backupPath = path.join(runDirectory, 'before-and-plan.json');
    await writeFile(backupPath, backup, { flag: 'wx' });
    ensure(backup.equals(await readFile(backupPath)), 'Snapshot verification failed.');
    for (const plan of plans.filter(entry => entry.changed)) {
      const itemResult = await client.query('update catalog_items set item_type=$1,updated_at=now() where id=$2 and item_type=$3', [plan.after.itemType, plan.id, plan.before.itemType]);
      ensure(itemResult.rowCount === 1, `Concurrent item change: ${plan.slug}`);
      const detailResult = await client.query('update catalog_item_editor_details set product_type=$1,data=$2::jsonb,updated_at=now() where item_id=$3 and product_type=$4', [plan.after.productType, JSON.stringify(plan.data), plan.id, plan.before.productType]);
      ensure(detailResult.rowCount === 1, `Concurrent editor change: ${plan.slug}`);
    }
    const afterItems = (await client.query('select * from catalog_items where id=any($1::bigint[]) order by slug', [ids])).rows as Item[];
    const afterDetails = (await client.query('select * from catalog_item_editor_details where item_id=any($1::bigint[]) order by item_id', [ids])).rows as Details[];
    for (const plan of plans) {
      const beforeItem = items.find(item => String(item.id) === plan.id)!;
      const afterItem = afterItems.find(item => String(item.id) === plan.id)!;
      const beforeDetail = details.find(detail => String(detail.item_id) === plan.id)!;
      const afterDetail = afterDetails.find(detail => String(detail.item_id) === plan.id)!;
      ensure(afterItem.item_type === plan.after.itemType && afterDetail.product_type === plan.after.productType, `Incorrect type: ${plan.slug}`);
      ensure(catalogTypeHash(omit(beforeItem, ['item_type', 'updated_at'])) === catalogTypeHash(omit(afterItem, ['item_type', 'updated_at'])), `Unexpected product change: ${plan.slug}`);
      ensure(catalogTypeHash(omit(beforeDetail, ['product_type', 'data', 'updated_at'])) === catalogTypeHash(omit(afterDetail, ['product_type', 'data', 'updated_at'])) && catalogTypeHash(afterDetail.data) === catalogTypeHash(plan.data), `Unexpected editor metadata change: ${plan.slug}`);
    }
    const protectedAfter = await readProtected(client);
    ensure(catalogTypeHash(protectedBefore) === catalogTypeHash(protectedAfter), 'Protected catalog or commerce rows changed; rolling back.');
    ensure(planCatalogTypeCorrections(afterItems, afterDetails, variants).every(plan => !plan.changed), 'Migration is not idempotent.');
    await client.query('commit'); committed = true;
    const verification = { ...summary, completedAt: new Date().toISOString(), backup: backupPath, protectedBefore, protectedAfter, allProtectedRowsUnchanged: true, repeatChanges: 0 };
    await writeFile(path.join(runDirectory, 'verification.json'), JSON.stringify(verification, null, 2));
    console.log(JSON.stringify({ result: 'committed and verified', verification: path.join(runDirectory, 'verification.json') }));
    return verification;
  } catch (error) {
    if (!committed) await client.query('rollback');
    throw error;
  } finally { client.release(); await pool.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runCatalogTypeCorrection().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
