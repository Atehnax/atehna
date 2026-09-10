/** Canonical SKU correction for the September catalog. Dry-run unless --apply. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { catalogSkuPart, buildCatalogBaseSku, buildCatalogDimensionSkuSuffix } from '../src/shared/domain/catalog/catalogSku';
import { catalogTypeHash, parseCatalogTypeArgs, resolveCatalogTypeTarget } from './reclassify-atehna-catalog';

type Row = Record<string, unknown>;
type SkuProduct = { id: string; slug: string; item_name: string; sku: string; category_path: string[]; product_type: string };
type SkuVariant = { id: string; item_id: string; variant_name: string; variant_sku: string; thickness: number | string | null; length: number | string | null; width: number | string | null };
const ensure = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
const comparable = (value: string) => value.trim().toLowerCase();

export function planCatalogSkus(products: SkuProduct[], variants: SkuVariant[]) {
  const bases = new Map(products.map(product => [product.id, buildCatalogBaseSku(product.category_path, product.item_name)]));
  // Keep all requested three-letter category/product segments; add a meaningful
  // three-letter name segment only when two products otherwise share one code.
  for (const base of new Set(bases.values())) {
    const group = products.filter(product => bases.get(product.id) === base);
    if (group.length < 2) continue;
    for (const product of group) {
      const words = catalogSkuPart(product.item_name).split('-').slice(1);
      let candidate = base;
      for (let depth = 1; depth <= words.length; depth += 1) {
        candidate = `${base}-${words.slice(0, depth).map(word => word.slice(0, 3)).join('-')}`;
        if (!group.some(other => other.id !== product.id && `${base}-${catalogSkuPart(other.item_name).split('-').slice(1, depth + 1).map(word => word.slice(0, 3)).join('-')}` === candidate)) break;
      }
      bases.set(product.id, candidate);
    }
  }
  const changes = products.map(product => {
    const sku = bases.get(product.id)!;
    const itemVariants = variants.filter(variant => String(variant.item_id) === String(product.id));
    return { id: product.id, slug: product.slug, before: product.sku, after: sku, variants: itemVariants.map(variant => {
      const dimensions = Object.fromEntries(['thickness', 'length', 'width'].map(key => {
        const value = variant[key as 'thickness' | 'length' | 'width'];
        return [key, value === null ? null : Number(value)];
      }));
      const dimensionSuffix = product.product_type === 'dimensions' ? buildCatalogDimensionSkuSuffix(dimensions) : '';
      let label = variant.variant_name;
      if (dimensionSuffix) label = label.replace(/\d+(?:[,.]\d+)?\s*[x×]\s*\d+(?:[,.]\d+)?(?:\s*[x×]\s*\d+(?:[,.]\d+)?)?\s*(?:mm)?/giu, ' ');
      let qualifier = catalogSkuPart(label);
      const productName = catalogSkuPart(product.item_name);
      if (qualifier === productName) qualifier = '';
      else if (qualifier.startsWith(`${productName}-`)) qualifier = qualifier.slice(productName.length + 1);
      const suffix = [dimensionSuffix, qualifier].filter(Boolean).join('-') || 'OSNOVNA';
      return { id: variant.id, name: variant.variant_name, before: variant.variant_sku, after: `${sku}-${suffix}` };
    }) };
  });
  const identifiers = changes.flatMap(item => [item.after, ...item.variants.map(variant => variant.after)]);
  ensure(identifiers.every(Boolean) && new Set(identifiers.map(comparable)).size === identifiers.length, 'Generated SKU collision: review catalog names and distinguishing variant attributes.');
  return changes;
}

function rewriteReferences(value: unknown, mapping: Map<string, string>): unknown {
  if (typeof value === 'string') return mapping.get(value) ?? value;
  if (Array.isArray(value)) return value.map(entry => rewriteReferences(entry, mapping));
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [mapping.get(key) ?? key, rewriteReferences(entry, mapping)]));
  return value;
}
function migrateSkuDetails(data: unknown, productType: string, item: ReturnType<typeof planCatalogSkus>[number], mapping: Map<string, string>) {
  const rewritten = rewriteReferences(data, mapping) as Row;
  if (productType !== 'unique_machine') return rewritten;
  const original = (data ?? {}) as Row;
  const previous = Array.isArray(original.legacySkuAliases) ? original.legacySkuAliases.filter((value): value is string => typeof value === 'string') : [];
  const aliases = [...new Set([...previous, ...[item, ...item.variants].filter(entry => entry.before && entry.before !== entry.after).map(entry => entry.before)])].sort();
  return aliases.length ? { ...rewritten, legacySkuAliases: aliases } : rewritten;
}

const without = (row: Row, fields: string[]) => Object.fromEntries(Object.entries(row).filter(([key]) => !fields.includes(key)));
async function protectedHashes(client: pg.PoolClient) {
  const tables = ['catalog_categories','catalog_media','catalog_variant_media','catalog_option_axes','catalog_option_values','catalog_variant_option_values','catalog_item_quantity_discounts','catalog_supplier_rows','pricing_stock_history','pricing_stock_model'];
  const hashes: Record<string, string> = {};
  for (const table of tables) {
    if (!(await client.query('select to_regclass($1) as name', [table])).rows[0].name) continue;
    hashes[table] = catalogTypeHash((await client.query(`select row_to_json(t) as row from ${table} t order by row_to_json(t)::text`)).rows);
  }
  // Preserve immutable commerce SKU snapshots without exporting customer data.
  for (const table of ['order_items','order_line_snapshots','quote_offer_version_items','quote_request_items']) {
    if (!(await client.query('select to_regclass($1) as name', [table])).rows[0].name) continue;
    hashes[table] = catalogTypeHash((await client.query(`select sku from ${table} order by sku`)).rows);
  }
  return hashes;
}

export async function runCatalogSkuCorrection(args = process.argv.slice(2)) {
  const options = parseCatalogTypeArgs(args);
  const target = resolveCatalogTypeTarget(options.target, process.env.DATABASE_URL);
  const manifest = JSON.parse(await readFile('data/catalog/atehna-2026-09.json', 'utf8')) as { products: Array<{ slug: string }> };
  const slugs = manifest.products.map(product => product.slug);
  ensure(slugs.length === 43 && new Set(slugs).size === 43, 'Expected the 43 imported products.');
  const pool = new pg.Pool({ connectionString: target.connectionString, max: 1 });
  const client = await pool.connect();
  let committed = false;
  try {
    await client.query(options.apply ? 'begin isolation level serializable' : 'begin isolation level repeatable read read only');
    ensure((await client.query('select current_database() as name')).rows[0].name === target.database, 'Unexpected database.');
    if (options.apply) {
      await client.query("select pg_advisory_xact_lock(hashtext('atehna-catalog-sku-correction-2026-09'))");
      await client.query('lock table catalog_items,catalog_item_variants,catalog_item_editor_details in share row exclusive mode');
    }
    const items = (await client.query('select * from catalog_items order by id')).rows;
    const variants = (await client.query('select * from catalog_item_variants order by id')).rows;
    const details = (await client.query('select * from catalog_item_editor_details order by item_id')).rows;
    const paths = (await client.query(`with recursive paths as (select id,parent_id,array[title]::text[] as path from catalog_categories where parent_id is null union all select c.id,c.parent_id,p.path||c.title from catalog_categories c join paths p on p.id=c.parent_id) select * from paths`)).rows;
    const products: SkuProduct[] = items.filter(item => slugs.includes(item.slug)).map(item => {
      ensure(item.status !== 'deleted', `Archived article: ${item.slug}`);
      const detail = details.find(row => String(row.item_id) === String(item.id));
      const category = paths.find(row => String(row.id) === String(item.category_id));
      ensure(detail && category, `Missing category or editor details: ${item.slug}`);
      return { id: String(item.id), slug: item.slug, item_name: item.item_name, sku: item.sku, category_path: category.path, product_type: detail.product_type };
    });
    ensure(products.length === 43, 'An imported product is missing.');
    const plan = planCatalogSkus(products, variants.map(variant => ({ ...variant, id: String(variant.id), item_id: String(variant.item_id) })));
    const selectedIds = new Set(products.map(product => product.id));
    const reserved = new Set([...items.filter(item => !selectedIds.has(String(item.id))).map(item => item.sku), ...variants.filter(variant => !selectedIds.has(String(variant.item_id))).map(variant => variant.variant_sku)].filter(Boolean).map(comparable));
    for (const value of plan.flatMap(item => [item.after, ...item.variants.map(variant => variant.after)])) ensure(!reserved.has(comparable(value)), `SKU belongs to an unrelated article: ${value}`);
    const mapping = new Map(plan.flatMap(item => [[item.before, item.after], ...item.variants.map(variant => [variant.before, variant.after])] as [string, string][]).filter(([before, after]) => before && before !== after));
    const summary = { target: options.target, products: plan.length, productChanges: plan.filter(item => item.before !== item.after).length, variantChanges: plan.flatMap(item => item.variants).filter(variant => variant.before !== variant.after).length };
    console.log(JSON.stringify(summary));
    const directory = path.join('tmp/catalog-refinements', `sku-${options.target}-${new Date().toISOString().replace(/[:.]/g, '-')}`);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, 'plan.json'), JSON.stringify(plan, null, 2));
    if (!options.apply) { await client.query('rollback'); console.log(`Plan: ${directory}/plan.json`); return summary; }
    const hashes = await protectedHashes(client);
    const snapshot = Buffer.from(JSON.stringify({ items, variants, details, plan, hashes }, null, 2));
    const snapshotPath = path.join(directory, 'before.json');
    await writeFile(snapshotPath, snapshot, { flag: 'wx' });
    ensure(snapshot.equals(await readFile(snapshotPath)), 'Snapshot verification failed.');
    for (const item of plan) {
      if (item.before !== item.after) await client.query('update catalog_items set sku=$1,updated_at=now() where id=$2', [item.after, item.id]);
      for (const variant of item.variants) if (variant.before !== variant.after) await client.query('update catalog_item_variants set variant_sku=$1,updated_at=now() where id=$2', [variant.after, variant.id]);
      const detail = details.find(row => String(row.item_id) === item.id)!;
      const data = migrateSkuDetails(detail.data, detail.product_type, item, mapping);
      if (catalogTypeHash(data) !== catalogTypeHash(detail.data)) await client.query('update catalog_item_editor_details set data=$1::jsonb,updated_at=now() where item_id=$2', [JSON.stringify(data), item.id]);
      if (item.variants.some(variant => variant.before !== variant.after)) await client.query('update catalog_items set updated_at=now() where id=$1', [item.id]);
    }
    const afterItems = (await client.query('select * from catalog_items order by id')).rows;
    const afterVariants = (await client.query('select * from catalog_item_variants order by id')).rows;
    const afterDetails = (await client.query('select * from catalog_item_editor_details order by item_id')).rows;
    ensure(catalogTypeHash(items.map(row => without(row, ['sku','updated_at']))) === catalogTypeHash(afterItems.map(row => without(row, ['sku','updated_at']))), 'Unrelated article data changed.');
    ensure(catalogTypeHash(variants.map(row => without(row, ['variant_sku','updated_at']))) === catalogTypeHash(afterVariants.map(row => without(row, ['variant_sku','updated_at']))), 'Unrelated variant data changed.');
    for (const detail of details) {
      const expected = selectedIds.has(String(detail.item_id)) ? migrateSkuDetails(detail.data, detail.product_type, plan.find(item => item.id === String(detail.item_id))!, mapping) : detail.data;
      const actual = afterDetails.find(row => String(row.item_id) === String(detail.item_id));
      ensure(actual && catalogTypeHash(without(detail, ['data','updated_at'])) === catalogTypeHash(without(actual, ['data','updated_at'])) && catalogTypeHash(expected) === catalogTypeHash(actual.data), 'Unexpected editor metadata change.');
    }
    for (const item of plan) {
      ensure(afterItems.find(row => String(row.id) === item.id)?.sku === item.after, 'Article SKU verification failed.');
      for (const variant of item.variants) ensure(afterVariants.find(row => String(row.id) === variant.id)?.variant_sku === variant.after, 'Variant SKU verification failed.');
    }
    ensure(catalogTypeHash(hashes) === catalogTypeHash(await protectedHashes(client)), 'Media, pricing, stock history or order SKU snapshots changed.');
    await client.query('commit'); committed = true;
    await writeFile(path.join(directory, 'verification.json'), JSON.stringify({ ...summary, committed: true, protectedDataUnchanged: true, snapshot: snapshotPath }, null, 2));
    console.log(`Committed and verified: ${directory}`);
    return summary;
  } catch (error) { if (!committed) await client.query('rollback'); throw error; }
  finally { client.release(); await pool.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) runCatalogSkuCorrection().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
