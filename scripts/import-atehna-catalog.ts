/**
 * Repeatable, additive article import through the same transaction as the admin editor.
 * Preview: node --conditions=react-server --import tsx scripts/import-atehna-catalog.ts
 * Apply:   node --conditions=react-server --import tsx scripts/import-atehna-catalog.ts --apply
 * Production: add --production --expected-host HOST --expected-database DATABASE with DATABASE_URL set by the caller.
 * Production also defaults to preview; only --apply writes. No .env files are loaded in production mode.
 * New products/variants remain drafts. Existing prices, stock and IDs are preserved.
 * Restart a running Next server after CLI writes so its catalog cache is refreshed.
 */
import { readFile, mkdir, writeFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import nextEnv from '@next/env';
import type {
  CatalogItemEditorPayload, CatalogItemEditorHydration, CatalogItemEditorVariantPayload,
  CatalogItemMediaPayload, CatalogItemOptionAxisPayload
} from '../src/shared/domain/catalog/catalogAdminTypes';

export type CatalogImportProduct = CatalogItemEditorPayload & {
  sourceUrls?: string[];
  /** Retain omitted variants and their history, but remove them from publication. */
  deactivateUnlistedVariants?: boolean;
  /** Preserve old image rows while replacing the visible gallery. */
  hideUnlistedGalleryImages?: boolean;
};
export type CatalogImportManifest = { version: 1; products: CatalogImportProduct[] };
export type CatalogImportPlan = {
  payload: CatalogItemEditorPayload;
  before: CatalogItemEditorHydration | null;
  warnings: string[];
  addedVariants: number;
  retainedExtraVariants: number;
};
const normalized = (value: string | null | undefined) => value?.trim().toLocaleLowerCase('sl') ?? '';
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
function ensure(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function unique(values: string[], label: string) {
  const seen = new Set<string>();
  for (const value of values.filter(Boolean)) {
    ensure(!seen.has(normalized(value)), `${label}: duplicate ${value}`);
    seen.add(normalized(value));
  }
}
const variantDimensions = (variant: CatalogItemEditorVariantPayload) =>
  [variant.length, variant.width, variant.thickness].map(value => value ?? '').join('|');
const hasDimensions = (variant: CatalogItemEditorVariantPayload) =>
  [variant.length, variant.width, variant.thickness].some(value => value != null);
const mediaIdentity = (media: CatalogItemMediaPayload) =>
  [media.mediaKind, media.sourceKind, media.blobPathname || media.blobUrl || media.externalUrl || ''].join('|');
const gallery = (media: CatalogItemMediaPayload) => media.mediaKind === 'image' && media.role === 'gallery';

export function validateCatalogImportManifest(value: unknown): CatalogImportManifest {
  ensure(isRecord(value) && value.version === 1 && Array.isArray(value.products) && value.products.length > 0, 'Expected version: 1 and a nonempty products array.');
  for (const entry of value.products) {
    ensure(isRecord(entry), 'Every product must be an object.');
    ensure(typeof entry.itemName === 'string' && entry.itemName.trim(), 'Product itemName is required.');
    const label = String(entry.itemName);
    ensure(typeof entry.slug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(entry.slug), `${label}: slug must use lowercase ASCII Slovenian words separated by hyphens.`);
    ensure(['unit', 'sheet', 'linear', 'bulk'].includes(String(entry.itemType)), `${label}: invalid itemType.`);
    ensure(entry.productType === undefined || ['simple', 'dimensions', 'weight', 'unique_machine'].includes(String(entry.productType)), `${label}: invalid productType.`);
    ensure(['active', 'inactive'].includes(String(entry.status)), `${label}: invalid status.`);
    ensure(entry.id === undefined && entry.expectedUpdatedAt === undefined, `${label}: omit database IDs and revisions; they are resolved by slug.`);
    ensure(Array.isArray(entry.categoryPath) && entry.categoryPath.every(segment => typeof segment === 'string' && segment.trim()), `${label}: invalid categoryPath.`);
    ensure(Array.isArray(entry.variants) && entry.variants.length > 0, `${label}: variants are required.`);
    for (const variant of entry.variants) {
      ensure(isRecord(variant) && typeof variant.variantName === 'string' && variant.variantName.trim(), `${label}: variantName is required.`);
      ensure(variant.id === undefined, `${label}: omit variant IDs.`);
      ensure(typeof variant.variantSku === 'string' && variant.variantSku.trim(), `${label}: a stable variantSku is required for repeat imports.`);
      ensure(typeof variant.price === 'number' && Number.isFinite(variant.price) && variant.price >= 0, `${label}: price must be a finite nonnegative number.`);
      for (const field of ['length', 'width', 'thickness', 'weight'] as const) {
        ensure(variant[field] == null || (typeof variant[field] === 'number' && Number.isFinite(variant[field]) && variant[field] > 0), `${label}: invalid ${field}.`);
      }
      ensure(variant.inventory == null || (Number.isSafeInteger(variant.inventory) && Number(variant.inventory) >= 0), `${label}: inventory must be a nonnegative integer.`);
    }
    ensure(Array.isArray(entry.media), `${label}: media must be an array.`);
    for (const media of entry.media) {
      ensure(isRecord(media) && media.id === undefined, `${label}: omit media IDs.`);
      ensure(media.mediaKind === 'image' && media.role === 'gallery' && media.sourceKind === 'upload', `${label}: this importer accepts local gallery images only.`);
      ensure(typeof media.blobUrl === 'string' && media.blobUrl.startsWith('/') && !media.blobUrl.startsWith('//') && !/[?#\\]/u.test(media.blobUrl), `${label}: image must have a public local blobUrl.`);
      ensure(typeof media.altText === 'string' && media.altText.trim(), `${label}: image altText is required.`);
      ensure(media.variantIndex == null || (Number.isInteger(media.variantIndex) && Number(media.variantIndex) >= 0 && Number(media.variantIndex) < entry.variants.length), `${label}: invalid image variantIndex.`);
    }
    const typed = entry as CatalogImportProduct;
    unique(typed.media.map(mediaIdentity), `${label} media`);
    unique(typed.variants.map(variant => variant.variantName), `${label} variant names`);

    if (typed.sourceUrls !== undefined) {
      ensure(Array.isArray(typed.sourceUrls) && typed.sourceUrls.every(url => typeof url === 'string' && /^https:\/\//u.test(url)), `${label}: sourceUrls must be HTTPS URLs.`);
    }
    ensure(typed.deactivateUnlistedVariants === undefined || typeof typed.deactivateUnlistedVariants === 'boolean', `${label}: deactivateUnlistedVariants must be boolean.`);
    ensure(typed.hideUnlistedGalleryImages === undefined || typeof typed.hideUnlistedGalleryImages === 'boolean', `${label}: hideUnlistedGalleryImages must be boolean.`);
    const axes = typed.optionAxes ?? [];
    ensure(Array.isArray(axes), `${label}: optionAxes must be an array.`);
    unique(axes.map(axis => axis.slug), `${label} option axes`);
    for (const axis of axes) {
      ensure(axis.id === undefined && axis.slug && axis.name && Array.isArray(axis.values) && axis.values.length, `${label}: invalid option axis.`);
      unique(axis.values.map(option => option.slug), `${label} option values`);
      for (const option of axis.values) ensure(option.id === undefined && option.slug && option.value, `${label}: invalid option value.`);
    }
    for (const variant of typed.variants) {
      for (const [axisSlug, valueSlug] of Object.entries(variant.optionSelections ?? {})) {
        ensure(axes.some(axis => axis.slug === axisSlug && axis.values.some(option => option.slug === valueSlug)), `${label}: unknown option selection ${axisSlug}/${valueSlug}.`);
      }
      const visibleGalleryCount = typed.media.filter(media => gallery(media) && !media.hidden).length;
      ensure((variant.imageAssignments ?? []).every(index => Number.isInteger(index) && index >= 0 && index < visibleGalleryCount), `${label}: invalid imageAssignments index.`);
    }
  }
  const manifest = value as CatalogImportManifest;
  unique(manifest.products.map(product => product.slug), 'Product slugs');
  unique(manifest.products.map(product => product.itemName), 'Product names');
  unique(manifest.products.flatMap(product => [product.sku ?? '', ...product.variants.map(variant => variant.variantSku ?? '')]), 'Catalog SKUs');
  return manifest;
}

/** Also rejects symlinks escaping public/; never downloads a guessed image URL. */
export async function validateCatalogImportAssets(manifest: CatalogImportManifest, root = process.cwd()) {
  const publicRoot = await realpath(path.join(root, 'public'));
  const urls = new Set(manifest.products.flatMap(product => product.media.map(media => media.blobUrl!)));
  for (const url of urls) {
    const file = await realpath(path.resolve(publicRoot, `.${decodeURIComponent(url)}`));
    const relative = path.relative(publicRoot, file);
    ensure(relative && !relative.startsWith('..') && !path.isAbsolute(relative), `Image is outside public/: ${url}`);
    const details = await stat(file);
    ensure(details.isFile() && details.size > 0, `Image is missing or empty: ${url}`);
  }
}

function mergeRecords(before: Record<string, unknown> = {}, incoming: Record<string, unknown> = {}): Record<string, unknown> {
  const output = { ...before };
  for (const [key, value] of Object.entries(incoming)) {
    output[key] = isRecord(value) && isRecord(before[key]) ? mergeRecords(before[key], value) : value;
  }
  return output;
}
/** Imported descriptions/specifications must not replace reviewed operating settings. */
function mergeTypeSpecificData(before: Record<string, unknown> = {}, incoming: Record<string, unknown> = {}) {
  const output = mergeRecords(before, incoming);
  const protectedSections = [
    { names: ['simple'], fields: ['basePrice', 'actionPrice', 'actionPriceEnabled', 'weightGrams', 'lengthMm', 'widthMm', 'thicknessMm', 'stock', 'minStock', 'deliveryTime', 'moq', 'warehouseLocation', 'saleStatus', 'visibleInStore', 'showAsNew', 'requireInstructions'] },
    { names: ['dimensions', 'dimension'], fields: ['defaultDeliveryTime', 'variantDeliveryTimes'] },
    { names: ['weight'], fields: ['deliveryTime'] },
    { names: ['uniqueMachine', 'machine'], fields: ['deliveryTime'] }
  ];
  for (const { names, fields } of protectedSections) {
    const prior = names.map(name => before[name]).find(isRecord) ?? {};
    for (const name of names) {
      const section = output[name];
      if (!isRecord(section)) continue;
      for (const field of fields) {
        if (Object.hasOwn(prior, field)) section[field] = structuredClone(prior[field]);
        else delete section[field];
      }
    }
  }
  return output;
}

function mergeAxes(before: CatalogItemOptionAxisPayload[], incoming: CatalogItemOptionAxisPayload[] = []) {
  const output = structuredClone(before);
  for (const axis of incoming) {
    const prior = output.find(candidate => candidate.slug === axis.slug);
    if (!prior) { output.push(structuredClone(axis)); continue; }
    prior.name = axis.name;
    for (const value of axis.values) {
      const priorValue = prior.values.find(candidate => candidate.slug === value.slug);
      if (priorValue) Object.assign(priorValue, value, { id: priorValue.id });
      else prior.values.push(structuredClone(value));
    }
  }
  return output;
}

export function planCatalogImportProduct(product: CatalogImportProduct, before: CatalogItemEditorHydration | null): CatalogImportPlan {
  const { sourceUrls, deactivateUnlistedVariants, hideUnlistedGalleryImages, ...incoming } = structuredClone(product);
  const warnings: string[] = [];
  const sourceNote = sourceUrls?.length ? `Viri za pripravo artikla:\n${sourceUrls.join('\n')}` : '';
  const notes = [before?.adminNotes, incoming.adminNotes, sourceNote].filter((note): note is string => Boolean(note?.trim()));
  const adminNotes = [...new Set(notes)].filter((note, index, all) => !all.some((other, otherIndex) => index !== otherIndex && other.includes(note))).join('\n\n');
  if (!before) {
    return {
      payload: { ...incoming, adminNotes, status: 'inactive', variants: incoming.variants.map((variant, index) => ({ ...variant, status: 'inactive', position: index })) },
      before, warnings: ['New item and variants are inactive until commercial/shipping details are reviewed.'],
      addedVariants: incoming.variants.length, retainedExtraVariants: 0
    };
  }
  ensure(before.status !== 'deleted', `${incoming.slug}: archived product exists; restore it explicitly before importing.`);
  ensure(before.slug === incoming.slug, `${incoming.slug}: this is an alias of ${before.slug}; use the canonical slug.`);
  const claimed = new Set<number>();
  let addedVariants = 0;
  const variants: CatalogItemEditorVariantPayload[] = incoming.variants.map((variant, index) => {
    const available = before.variants.filter(candidate => candidate.id && !claimed.has(candidate.id));
    const skuMatch = available.find(candidate => normalized(candidate.variantSku) === normalized(variant.variantSku));
    if (skuMatch && (hasDimensions(variant) || hasDimensions(skuMatch))) {
      ensure(variantDimensions(skuMatch) === variantDimensions(variant), `${incoming.slug}: SKU ${variant.variantSku} belongs to different dimensions; assign a new SKU.`);
    }
    const nameMatches = available.filter(candidate => normalized(candidate.variantName) === normalized(variant.variantName)
      && variantDimensions(candidate) === variantDimensions(variant));
    const allowDimensionsMatch = deactivateUnlistedVariants && hasDimensions(variant)
      && incoming.variants.filter(candidate => variantDimensions(candidate) === variantDimensions(variant)).length === 1;
    const matches = skuMatch ? [skuMatch] : nameMatches.length ? nameMatches : allowDimensionsMatch
      ? available.filter(candidate => variantDimensions(candidate) === variantDimensions(variant)) : [];
    ensure(matches.length <= 1, `${incoming.slug}: ambiguous existing variant ${variant.variantName}.`);
    const prior = matches[0];
    if (!prior) { addedVariants += 1; return { ...variant, status: 'inactive' as const, position: index }; }
    claimed.add(prior.id!);
    const merged = { ...prior, ...variant,
      id: prior.id, position: index, variantSku: prior.variantSku || variant.variantSku,
      price: prior.price, costNet: prior.costNet, inventory: prior.inventory, discountPct: prior.discountPct, minOrder: prior.minOrder,
      weight: prior.weight ?? variant.weight, status: prior.status,
      expectedStockRevision: prior.stockRevision, expectedPricingRevision: prior.pricingRevision,
      contentOverride: mergeRecords(prior.contentOverride ?? {}, variant.contentOverride ?? {})
    };
    if (Object.hasOwn(prior.contentOverride ?? {}, 'deliveryEstimate')) {
      merged.contentOverride.deliveryEstimate = prior.contentOverride!.deliveryEstimate;
    } else delete merged.contentOverride.deliveryEstimate;
    if (variant.optionSelections !== undefined) delete merged.optionValueIds;
    return merged;
  });
  const extras = before.variants.filter(variant => !claimed.has(variant.id!));
  for (const extra of extras) {
    variants.push({ ...structuredClone(extra), status: deactivateUnlistedVariants ? 'inactive' : extra.status,
      position: variants.length, expectedStockRevision: extra.stockRevision, expectedPricingRevision: extra.pricingRevision });
  }
  if (extras.length) warnings.push(`${extras.length} unlisted existing variant(s) retained${deactivateUnlistedVariants ? ' as inactive' : ''}: ${extras.map(variant => variant.variantName).join(', ')}`);
  if (addedVariants) warnings.push(`${addedVariants} new variant(s) are inactive pending review.`);
  const oldIndexToNew = new Map(before.variants.map((variant, index) => [index, variants.findIndex(candidate => candidate.id === variant.id)]));
  const media: CatalogItemMediaPayload[] = incoming.media.map(entry => {
    const prior = before.media.find(candidate => mediaIdentity(candidate) === mediaIdentity(entry));
    return { ...prior,
      variantIndex: prior?.variantIndex == null ? null : oldIndexToNew.get(prior.variantIndex) ?? null,
      ...entry, id: prior?.id };
  });
  for (const entry of before.media) {
    if (!media.some(candidate => mediaIdentity(candidate) === mediaIdentity(entry))) {
      const hidden = hideUnlistedGalleryImages && gallery(entry) ? true : entry.hidden;
      media.push({ ...structuredClone(entry), hidden,
        variantIndex: hidden || entry.variantIndex == null ? null : oldIndexToNew.get(entry.variantIndex) ?? null });
    }
  }
  media.forEach((entry, index) => { entry.position = index; });
  const oldGallery = before.media.filter(gallery);
  const newVisibleGallery = media.filter(entry => gallery(entry) && !entry.hidden);
  for (const variant of variants) {
    const prior = before.variants.find(candidate => variant.id && candidate.id === variant.id);
    const specified = incoming.variants[variant.position ?? 0];
    if (prior && (!specified || specified.imageAssignments === undefined)) {
      variant.imageAssignments = (prior.imageAssignments ?? []).flatMap(oldSlot => {
        const oldImage = oldGallery[oldSlot];
        const slot = oldImage ? newVisibleGallery.findIndex(candidate => mediaIdentity(candidate) === mediaIdentity(oldImage)) : -1;
        return slot < 0 ? [] : [slot];
      });
    }
  }
  const status = before.status === 'active' && variants.some(variant => variant.status === 'active') ? 'active' : 'inactive';
  if (status !== before.status) warnings.push('Item becomes inactive because no reviewed active variant remains.');
  const payload: CatalogItemEditorPayload = {
    ...before, ...incoming, id: before.id, expectedUpdatedAt: before.updatedAt,
    sku: before.sku || incoming.sku, adminNotes, status, variants, media,
    typeSpecificData: mergeTypeSpecificData(before.typeSpecificData, incoming.typeSpecificData),
    optionAxes: mergeAxes(before.optionAxes, incoming.optionAxes),
    quantityDiscounts: before.quantityDiscounts,
    defaultVariantId: before.defaultVariantId, defaultVariantIndex: undefined
  };
  return { payload, before, warnings, addedVariants, retainedExtraVariants: extras.length };
}

export type CatalogImportOptions = {
  apply: boolean;
  production: boolean;
  manifestPath?: string;
  expectedHost?: string;
  expectedDatabase?: string;
};
const importUsage = 'Usage: node --conditions=react-server --import tsx scripts/import-atehna-catalog.ts [manifest.json] [--apply|--dry-run] [--production --expected-host HOST --expected-database DATABASE]';

export function parseCatalogImportArgs(args: string[]): CatalogImportOptions {
  const options: CatalogImportOptions = { apply: false, production: false };
  const seen = new Set<string>();
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith('--')) {
      ensure(!options.manifestPath, importUsage);
      options.manifestPath = arg;
      continue;
    }
    ensure(!seen.has(arg), `Repeated argument ${arg}. ${importUsage}`);
    seen.add(arg);
    if (arg === '--apply') options.apply = true;
    else if (arg === '--dry-run') continue;
    else if (arg === '--production') options.production = true;
    else if (arg === '--expected-host' || arg === '--expected-database') {
      const value = args[++index];
      ensure(value?.trim() && !value.startsWith('--'), `${arg} requires a value. ${importUsage}`);
      if (arg === '--expected-host') options.expectedHost = value.trim().toLowerCase();
      else options.expectedDatabase = value.trim();
    } else throw new Error(importUsage);
  }
  ensure(!seen.has('--apply') || !seen.has('--dry-run'), 'Choose --apply or --dry-run, not both.');
  ensure(!options.production || (options.expectedHost && options.expectedDatabase), 'Production requires --expected-host and --expected-database.');
  ensure(options.production || (!options.expectedHost && !options.expectedDatabase), 'Target confirmations require --production.');
  return options;
}

/** Production never loads .env files: the caller must provide the exact connection target. */
export function resolveCatalogImportTarget(
  options: CatalogImportOptions,
  environment: Record<string, string | undefined> = process.env,
  loadDevelopmentEnv: () => unknown = () => nextEnv.loadEnvConfig(process.cwd(), true)
) {
  if (!options.production) loadDevelopmentEnv();
  const databaseUrl = environment.DATABASE_URL?.trim();
  ensure(databaseUrl, options.production ? 'Production requires DATABASE_URL in the caller environment; no .env files are loaded.' : 'DATABASE_URL is not configured.');
  let target: URL;
  try { target = new URL(databaseUrl); } catch { throw new Error('DATABASE_URL is not a valid PostgreSQL URL.'); }
  ensure(['postgres:', 'postgresql:'].includes(target.protocol), 'DATABASE_URL must use postgres:// or postgresql://.');
  const hostname = target.hostname.toLowerCase();
  const database = decodeURIComponent(target.pathname.slice(1));
  ensure(database && !database.includes('/'), 'DATABASE_URL must name a database.');
  if (options.production) {
    const local = hostname === 'localhost' || hostname.endsWith('.localhost') || /^127\./u.test(hostname)
      || ['[::1]', '0.0.0.0', '[::]'].includes(hostname);
    ensure(!local, '--production requires a remote database, not a local address.');
    ensure(options.expectedHost?.toLowerCase() === hostname, 'DATABASE_URL host does not match --expected-host.');
    ensure(options.expectedDatabase === database, 'DATABASE_URL database does not match --expected-database.');
  } else {
    ensure(['127.0.0.1', 'localhost', '[::1]'].includes(hostname), 'The default catalog import only accepts a local database; use --production with explicit target confirmations for production.');
  }
  return { databaseUrl, hostname, database };
}

async function main() {
  const options = parseCatalogImportArgs(process.argv.slice(2));
  const { apply } = options;
  const manifestPath = path.resolve(options.manifestPath ?? 'data/catalog/atehna-2026-09.json');
  const manifest = validateCatalogImportManifest(JSON.parse(await readFile(manifestPath, 'utf8')));
  await validateCatalogImportAssets(manifest);
  const target = resolveCatalogImportTarget(options);
  const { getPool } = await import('../src/shared/server/db');
  const { fetchCatalogItemEditorBySlug, getCatalogItemIdentityAvailability, upsertCatalogItem } = await import('../src/shared/server/catalogItems');
  const pool = await getPool();
  try {
    const identity = (await pool.query('select current_database() as database, host(inet_server_addr()) as address, inet_server_port() as port')).rows[0];
    ensure(identity.database === target.database, 'Connected database does not match the confirmed URL database.');
    const plans: CatalogImportPlan[] = [];
    for (const product of manifest.products) {
      const before = await fetchCatalogItemEditorBySlug(product.slug);
      const plan = planCatalogImportProduct(product, before);
      let parentId: string | null = null;
      for (const segment of plan.payload.categoryPath) {
        const category: { id: string } | undefined = (await pool.query("select id from catalog_categories where coalesce(parent_id, '') = coalesce($1::text, '') and lower(trim(title)) = lower(trim($2::text)) order by position,id limit 1", [parentId, segment])).rows[0];
        ensure(category, `${product.slug}: category path does not exist: ${plan.payload.categoryPath.join(' / ')}`);
        parentId = String(category.id);
      }
      for (const [field, value, variantId] of [
        ['name', plan.payload.itemName, null], ['slug', plan.payload.slug, null], ['sku', plan.payload.sku, null],
        ...plan.payload.variants.map(variant => ['sku', variant.variantSku, variant.id ?? null])
      ] as Array<['name' | 'slug' | 'sku', string | null | undefined, number | null]>) {
        if (!value) continue;
        const available = await getCatalogItemIdentityAvailability({ field, value, itemId: before?.id, variantId });
        ensure(available.isAvailable, `${product.slug}: ${field} ${value} conflicts with ${available.conflictLabel}.`);
      }
      plans.push(plan);
    }
    console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', environment: options.production ? 'production' : 'local', host: target.hostname, database: identity, manifest: manifestPath,
      products: plans.length, create: plans.filter(plan => !plan.before).length, update: plans.filter(plan => plan.before).length,
      variantsToAdd: plans.reduce((sum, plan) => sum + plan.addedVariants, 0),
      items: plans.map(plan => ({ id: plan.before?.id ?? null, slug: plan.payload.slug, status: plan.payload.status,
        variants: plan.payload.variants.length, media: plan.payload.media.length, warnings: plan.warnings })) }, null, 2));
    if (!apply) return;
    const runDirectory = path.join(process.cwd(), 'tmp', 'catalog-import', new Date().toISOString().replace(/[:.]/gu, '-'));
    await mkdir(runDirectory, { recursive: true });
    await writeFile(path.join(runDirectory, 'before-and-plan.json'), JSON.stringify({ environment: options.production ? 'production' : 'local', host: target.hostname, database: identity, manifestPath, plans }, null, 2));
    const applied = [];
    console.log(`Snapshot: ${path.join(runDirectory, 'before-and-plan.json')}`);
    for (const plan of plans) {
      const saved = await upsertCatalogItem(plan.payload, { revalidate: false });
      applied.push(saved);
      await writeFile(path.join(runDirectory, 'applied.json'), JSON.stringify(applied, null, 2));
      console.log(`Saved ${saved.id}: ${saved.slug}`);
    }
    console.log(`Imported ${applied.length} products. Restart the Next server to refresh the public catalog cache.`);
  } finally { await pool.end(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
