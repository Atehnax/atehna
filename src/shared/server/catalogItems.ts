import { getPool } from '@/shared/server/db';
import { revalidateTag } from 'next/cache';
import { CATALOG_PUBLIC_TAG } from '@/shared/server/catalogCache';
import type { CatalogItemType } from '@/shared/domain/catalog/itemType';
import { fetchOrderItemAllocationsForSkus, type OrderItemSkuAllocationRow } from '@/shared/server/orders';

export type CatalogEditorProductType = 'simple' | 'dimensions' | 'weight' | 'unique_machine';
export type CatalogItemTypeSpecificData = Record<string, unknown>;

export type CatalogItemSeedRow = {
  id: number;
  item_name: string;
  description: string;
  category_path: string;
  category_id: string | null;
  parent_category_id: string | null;
  variant_id: number;
  variant_name: string;
  variant_count: number;
  length: number | null;
  width: number | null;
  thickness: number | null;
  weight: number | null;
  price: number;
  sku: string;
  images: string[];
  discount_pct: number;
  item_position: number;
};

export type CatalogItemEditorPayload = {
  id?: number;
  itemName: string;
  itemType: CatalogItemType;
  productType?: CatalogEditorProductType;
  typeSpecificData?: CatalogItemTypeSpecificData;
  badge?: string | null;
  status: 'active' | 'inactive';
  categoryPath: string[];
  sku?: string | null;
  slug: string;
  unit?: string | null;
  brand?: string | null;
  material?: string | null;
  colour?: string | null;
  shape?: string | null;
  description?: string | null;
  adminNotes?: string | null;
  position?: number;
  variants: Array<{
    id?: number;
    variantName: string;
    length?: number | null;
    width?: number | null;
    thickness?: number | null;
    weight?: number | null;
    errorTolerance?: string | null;
    price: number;
    discountPct?: number;
    inventory?: number;
    minOrder?: number;
    variantSku?: string | null;
    unit?: string | null;
    status?: 'active' | 'inactive';
    badge?: string | null;
    position?: number;
    imageAssignments?: number[];
  }>;
  quantityDiscounts?: CatalogItemQuantityDiscountRule[];
  media: Array<{
    id?: number;
    variantIndex?: number | null;
    mediaKind: 'image' | 'video' | 'document';
    role: 'gallery' | 'technical_sheet';
    sourceKind: 'upload' | 'youtube';
    filename?: string | null;
    blobUrl?: string | null;
    blobPathname?: string | null;
    externalUrl?: string | null;
    mimeType?: string | null;
    altText?: string | null;
    imageType?: string | null;
    imageDimensions?: { width?: number; height?: number } | null;
    videoType?: string | null;
    hidden?: boolean;
    position?: number;
  }>;
};

export type CatalogItemQuantityDiscountRule = {
  id?: number;
  minQuantity: number;
  discountPercent: number;
  appliesTo?: 'allVariants' | string | null;
  note?: string | null;
  position?: number | null;
};

export type AdminCatalogVariantSummary = {
  id: number;
  variantName: string;
  variantSku: string | null;
  length: number | null;
  width: number | null;
  thickness: number | null;
  weight: number | null;
  price: number;
  discountPct: number;
  inventory: number;
  minOrder: number;
  status: 'active' | 'inactive';
  badge: string | null;
  position: number;
};

export type AdminCatalogListItem = {
  id: number;
  slug: string;
  itemName: string;
  productType: CatalogEditorProductType;
  typeSpecificData: CatalogItemTypeSpecificData;
  material: string | null;
  baseSku: string | null;
  categoryLabel: string;
  status: 'active' | 'inactive';
  badge: string | null;
  variantCount: number;
  minPrice: number;
  maxPrice: number;
  defaultDiscountPct: number;
  adminNotes: string | null;
  variants: AdminCatalogVariantSummary[];
};

export type CatalogItemEditorHydration = {
  id: number;
  itemName: string;
  itemType: CatalogItemType;
  productType: CatalogEditorProductType;
  typeSpecificData: CatalogItemTypeSpecificData;
  badge: string | null;
  status: 'active' | 'inactive';
  categoryPath: string[];
  sku: string | null;
  slug: string;
  unit: string | null;
  brand: string | null;
  material: string | null;
  colour: string | null;
  shape: string | null;
  description: string | null;
  adminNotes: string | null;
  position: number;
  variants: CatalogItemEditorPayload['variants'];
  quantityDiscounts: CatalogItemQuantityDiscountRule[];
  media: CatalogItemEditorPayload['media'];
  machineSerialOrderMatches: OrderItemSkuAllocationRow[];
};

export type CatalogItemQuickPatch = {
  itemName?: string;
  sku?: string | null;
  status?: 'active' | 'inactive';
  badge?: string | null;
  categoryPath?: string[];
  categoryId?: string | null;
};

export type CatalogVariantQuickPatch = {
  variantName?: string;
  variantSku?: string | null;
  length?: number | null;
  width?: number | null;
  thickness?: number | null;
  weight?: number | null;
  errorTolerance?: string | null;
  price?: number;
  discountPct?: number;
  inventory?: number;
  minOrder?: number;
  status?: 'active' | 'inactive';
  badge?: string | null;
  position?: number;
};

export type CatalogItemIdentityField = 'name' | 'sku' | 'slug';

export type CatalogItemIdentityAvailability = {
  field: CatalogItemIdentityField;
  value: string;
  isAvailable: boolean;
  conflictLabel: string | null;
  suggestions: string[];
};

export type CatalogItemIdentityConflict = CatalogItemIdentityAvailability & {
  message: string;
};

export class CatalogItemIdentityConflictError extends Error {
  readonly conflicts: CatalogItemIdentityConflict[];
  readonly statusCode = 409;

  constructor(conflicts: CatalogItemIdentityConflict[]) {
    const firstConflict = conflicts[0];
    const suggestionText = firstConflict && firstConflict.suggestions.length > 0
      ? ` Predlogi: ${firstConflict.suggestions.join(', ')}.`
      : '';
    super(firstConflict ? `${firstConflict.message}${suggestionText}` : 'Podatki artikla niso enolični.');
    this.name = 'CatalogItemIdentityConflictError';
    this.conflicts = conflicts;
  }
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function normalizeActiveState(value: unknown): 'active' | 'inactive' {
  return String(value ?? 'inactive') === 'active' ? 'active' : 'inactive';
}

async function ensureCatalogItemQuantityDiscountsTable(db: { query: (sql: string, params?: unknown[]) => Promise<unknown> }) {
  await db.query(`
    create table if not exists catalog_item_quantity_discounts (
      id bigserial primary key,
      item_id bigint not null references catalog_items(id) on delete cascade,
      min_quantity integer not null default 1,
      discount_percent numeric(5,2) not null default 0,
      applies_to text not null default 'allVariants',
      note text,
      position integer not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      check (min_quantity >= 1),
      check (discount_percent >= 0 and discount_percent <= 100)
    )
  `);
  await db.query('create index if not exists idx_catalog_item_quantity_discounts_item_id on catalog_item_quantity_discounts(item_id)');
  await db.query('create index if not exists idx_catalog_item_quantity_discounts_position on catalog_item_quantity_discounts(item_id, position)');
}

async function ensureCatalogItemEditorDetailsTable(db: { query: (sql: string, params?: unknown[]) => Promise<unknown> }) {
  await db.query(`
    create table if not exists catalog_item_editor_details (
      item_id bigint primary key references catalog_items(id) on delete cascade,
      product_type text not null default 'simple',
      data jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      check (product_type in ('simple', 'dimensions', 'weight', 'unique_machine'))
    )
  `);
  await db.query('create index if not exists idx_catalog_item_editor_details_product_type on catalog_item_editor_details(product_type)');
}

function normalizeCatalogEditorProductType(value: unknown): CatalogEditorProductType | null {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (normalized === 'simple' || normalized === 'dimensions' || normalized === 'weight' || normalized === 'unique_machine') {
    return normalized;
  }
  return null;
}

function inferCatalogEditorProductType(itemType: unknown, variants: Array<Record<string, unknown>>): CatalogEditorProductType {
  if (itemType === 'bulk') return 'weight';
  if (itemType === 'sheet') return 'dimensions';
  const hasDimensionVariants = variants.some((variant) =>
    variant.length !== null && variant.length !== undefined
    || variant.width !== null && variant.width !== undefined
    || variant.thickness !== null && variant.thickness !== undefined
  );
  if (hasDimensionVariants || variants.length > 1) return 'dimensions';
  return 'simple';
}

function normalizeTypeSpecificData(value: unknown): CatalogItemTypeSpecificData {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as CatalogItemTypeSpecificData;
  }
  return {};
}

function normalizeQuantityDiscountRule(entry: Record<string, unknown>, fallbackPosition: number): CatalogItemQuantityDiscountRule {
  return {
    id: entry.id === null || entry.id === undefined ? undefined : asNumber(entry.id),
    minQuantity: Math.max(1, Math.floor(asNumber(entry.minQuantity ?? entry.min_quantity, 1))),
    discountPercent: Math.min(100, Math.max(0, asNumber(entry.discountPercent ?? entry.discount_percent))),
    appliesTo: asStringOrNull(entry.appliesTo ?? entry.applies_to) ?? 'allVariants',
    note: asStringOrNull(entry.note),
    position: asNumber(entry.position, fallbackPosition)
  };
}

function normalizeIdentityValue(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function normalizeIdentityComparisonValue(value: unknown): string {
  return normalizeIdentityValue(value).toLocaleLowerCase('sl');
}

function normalizeSlugSuggestionBase(value: string) {
  const normalized = normalizeIdentityValue(value)
    .toLocaleLowerCase('sl')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return normalized || 'artikel';
}

function normalizeSkuSuggestionBase(value: string) {
  return normalizeIdentityValue(value).toLocaleUpperCase('sl').replace(/\s+/g, '-').replace(/-+/g, '-') || 'SKU';
}

function createIdentitySuggestion(field: CatalogItemIdentityField, value: string, suffix: number) {
  if (field === 'name') return `${normalizeIdentityValue(value)} ${suffix}`;
  if (field === 'slug') return `${normalizeSlugSuggestionBase(value)}-${suffix}`;
  return `${normalizeSkuSuggestionBase(value)}-${suffix}`;
}

async function fetchReservedIdentityValues(
  client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> },
  field: CatalogItemIdentityField,
  currentItemId: number | null,
  currentVariantId: number | null
) {
  if (field === 'name') {
    const result = await client.query(
      `
      select item_name as value
      from catalog_items
      where item_name is not null
        and ($1::bigint is null or id <> $1)
      `,
      [currentItemId]
    );
    return new Set(result.rows.map((row) => normalizeIdentityComparisonValue(row.value)));
  }

  if (field === 'slug') {
    const result = await client.query(
      `
      select slug as value
      from catalog_items
      where slug is not null
        and ($1::bigint is null or id <> $1)
      `,
      [currentItemId]
    );
    return new Set(result.rows.map((row) => normalizeIdentityComparisonValue(row.value)));
  }

  const result = await client.query(
    `
    select sku as value
    from catalog_items
    where nullif(trim(sku), '') is not null
      and ($1::bigint is null or id <> $1)
    union all
    select variant_sku as value
    from catalog_item_variants
    where nullif(trim(variant_sku), '') is not null
      and (
        $1::bigint is null
        or item_id <> $1
        or ($2::bigint is not null and id <> $2)
      )
    `,
    [currentItemId, currentVariantId]
  );
  return new Set(result.rows.map((row) => normalizeIdentityComparisonValue(row.value)));
}

async function buildIdentitySuggestions(
  client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> },
  field: CatalogItemIdentityField,
  value: string,
  currentItemId: number | null,
  currentVariantId: number | null,
  extraReservedValues: string[] = []
) {
  const reserved = await fetchReservedIdentityValues(client, field, currentItemId, currentVariantId);
  extraReservedValues.forEach((entry) => reserved.add(normalizeIdentityComparisonValue(entry)));

  const suggestions: string[] = [];
  for (let suffix = 2; suggestions.length < 5 && suffix <= 99; suffix += 1) {
    const suggestion = createIdentitySuggestion(field, value, suffix);
    const comparison = normalizeIdentityComparisonValue(suggestion);
    if (!comparison || reserved.has(comparison)) continue;
    reserved.add(comparison);
    suggestions.push(suggestion);
  }
  return suggestions;
}

async function findIdentityConflict(
  client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> },
  field: CatalogItemIdentityField,
  value: string,
  currentItemId: number | null,
  currentVariantId: number | null
) {
  const normalized = normalizeIdentityValue(value);
  if (!normalized) return null;

  if (field === 'name') {
    const result = await client.query(
      `
      select item_name as label
      from catalog_items
      where lower(trim(item_name)) = lower(trim($1::text))
        and ($2::bigint is null or id <> $2)
      limit 1
      `,
      [normalized, currentItemId]
    );
    return typeof result.rows[0]?.label === 'string' ? result.rows[0].label : null;
  }

  if (field === 'slug') {
    const result = await client.query(
      `
      select item_name as label
      from catalog_items
      where lower(trim(slug)) = lower(trim($1::text))
        and ($2::bigint is null or id <> $2)
      limit 1
      `,
      [normalized, currentItemId]
    );
    return typeof result.rows[0]?.label === 'string' ? result.rows[0].label : null;
  }

  const result = await client.query(
    `
    select label
    from (
      select item_name as label
      from catalog_items
      where lower(trim(sku)) = lower(trim($1::text))
        and ($2::bigint is null or id <> $2)
      union all
      select ci.item_name || coalesce(' / ' || nullif(civ.variant_name, ''), '') as label
      from catalog_item_variants civ
      join catalog_items ci on ci.id = civ.item_id
      where lower(trim(civ.variant_sku)) = lower(trim($1::text))
        and (
          $2::bigint is null
          or civ.item_id <> $2
          or ($3::bigint is not null and civ.id <> $3)
        )
    ) matches
    limit 1
    `,
    [normalized, currentItemId, currentVariantId]
  );
  return typeof result.rows[0]?.label === 'string' ? result.rows[0].label : null;
}

function identityConflictMessage(field: CatalogItemIdentityField, conflictLabel: string | null) {
  const suffix = conflictLabel ? ` (${conflictLabel})` : '';
  if (field === 'name') return `Naziv artikla je že uporabljen${suffix}.`;
  if (field === 'slug') return `URL artikla je že uporabljen${suffix}.`;
  return `SKU je že uporabljen${suffix}.`;
}

async function buildIdentityConflict(
  client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> },
  field: CatalogItemIdentityField,
  value: string,
  currentItemId: number | null,
  currentVariantId: number | null,
  conflictLabel: string | null,
  extraReservedValues: string[] = []
): Promise<CatalogItemIdentityConflict> {
  return {
    field,
    value: normalizeIdentityValue(value),
    isAvailable: false,
    conflictLabel,
    message: identityConflictMessage(field, conflictLabel),
    suggestions: await buildIdentitySuggestions(client, field, value, currentItemId, currentVariantId, extraReservedValues)
  };
}

export async function getCatalogItemIdentityAvailability({
  field,
  value,
  itemId = null,
  variantId = null
}: {
  field: CatalogItemIdentityField;
  value: string;
  itemId?: number | null;
  variantId?: number | null;
}): Promise<CatalogItemIdentityAvailability> {
  const pool = await getPool();
  const normalized = normalizeIdentityValue(value);
  if (!normalized) {
    return { field, value: normalized, isAvailable: false, conflictLabel: null, suggestions: [] };
  }

  const conflictLabel = await findIdentityConflict(pool, field, normalized, itemId, variantId);
  const suggestions = conflictLabel
    ? await buildIdentitySuggestions(pool, field, normalized, itemId, variantId)
    : [];

  return {
    field,
    value: normalized,
    isAvailable: conflictLabel === null,
    conflictLabel,
    suggestions
  };
}

async function assertCatalogItemIdentityAvailable(
  client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> },
  input: {
    itemId: number | null;
    itemName?: string | null;
    slug?: string | null;
    sku?: string | null;
    variantSkus?: Array<{ sku: string | null | undefined; variantId?: number | null; label?: string }>;
  }
) {
  const conflicts: CatalogItemIdentityConflict[] = [];

  const itemName = normalizeIdentityValue(input.itemName);
  if (itemName) {
    const conflictLabel = await findIdentityConflict(client, 'name', itemName, input.itemId, null);
    if (conflictLabel) conflicts.push(await buildIdentityConflict(client, 'name', itemName, input.itemId, null, conflictLabel));
  }

  const slug = normalizeIdentityValue(input.slug);
  if (slug) {
    const conflictLabel = await findIdentityConflict(client, 'slug', slug, input.itemId, null);
    if (conflictLabel) conflicts.push(await buildIdentityConflict(client, 'slug', slug, input.itemId, null, conflictLabel));
  }

  const sku = normalizeIdentityValue(input.sku);
  if (sku) {
    const conflictLabel = await findIdentityConflict(client, 'sku', sku, input.itemId, null);
    if (conflictLabel) conflicts.push(await buildIdentityConflict(client, 'sku', sku, input.itemId, null, conflictLabel));
  }

  const seenVariantSkus = new Map<string, string>();
  for (const variant of input.variantSkus ?? []) {
    const variantSku = normalizeIdentityValue(variant.sku);
    if (!variantSku) continue;

    const comparison = normalizeIdentityComparisonValue(variantSku);
    const duplicateLabel = seenVariantSkus.get(comparison);
    if (duplicateLabel) {
      conflicts.push(
        await buildIdentityConflict(client, 'sku', variantSku, input.itemId, variant.variantId ?? null, duplicateLabel, [...seenVariantSkus.keys()])
      );
      continue;
    }
    seenVariantSkus.set(comparison, variant.label ?? variantSku);

    const conflictLabel = await findIdentityConflict(client, 'sku', variantSku, input.itemId, variant.variantId ?? null);
    if (conflictLabel) {
      conflicts.push(await buildIdentityConflict(client, 'sku', variantSku, input.itemId, variant.variantId ?? null, conflictLabel));
    }
  }

  if (conflicts.length > 0) {
    throw new CatalogItemIdentityConflictError(conflicts);
  }
}

async function resolveItemIdByIdentifier(client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> }, itemIdentifier: string): Promise<number | null> {
  const normalized = itemIdentifier.trim();
  if (!normalized) return null;
  const result = await client.query(
    `
    select id
    from catalog_items
    where slug = $1
       or id::text = $1
    order by case when slug = $1 then 0 else 1 end
    limit 1
    `,
    [normalized]
  );
  const id = result.rows[0]?.id;
  return typeof id === 'number' ? id : typeof id === 'string' ? Number(id) : null;
}

async function fetchAdminCatalogListItemByItemId(itemId: number): Promise<AdminCatalogListItem | null> {
  const items = await fetchAdminCatalogListItems();
  return items.find((item) => item.id === itemId) ?? null;
}

function createCopyName(value: unknown, attempt: number) {
  const base = normalizeIdentityValue(value) || 'Artikel';
  return attempt === 0 ? `${base} kopija` : `${base} kopija ${attempt + 1}`;
}

function createCopySku(value: unknown, attempt: number) {
  const base = normalizeIdentityValue(value);
  if (!base) return null;
  return attempt === 0 ? `${base}-KOPIJA` : `${base}-KOPIJA-${attempt + 1}`;
}

function createCopySlug(sourceSlug: unknown, sourceName: unknown, attempt: number) {
  const base = normalizeIdentityValue(sourceSlug) || normalizeSlugSuggestionBase(normalizeIdentityValue(sourceName));
  return attempt === 0 ? `${base}-kopija` : `${base}-kopija-${attempt + 1}`;
}

async function buildCatalogItemCopyIdentity(
  client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> },
  source: Record<string, unknown>,
  variants: Array<Record<string, unknown>>
) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const itemName = createCopyName(source.item_name, attempt);
    const sku = createCopySku(source.sku, attempt);
    const slug = createCopySlug(source.slug, source.item_name, attempt);
    const variantSkus = variants.map((variant) => createCopySku(variant.variant_sku, attempt));

    try {
      await assertCatalogItemIdentityAvailable(client, {
        itemId: null,
        itemName,
        slug,
        sku,
        variantSkus: variants.map((variant, index) => ({
          sku: variantSkus[index],
          variantId: null,
          label: String(variant.variant_name ?? `Različica ${index + 1}`)
        }))
      });
      return { itemName, sku, slug, variantSkus };
    } catch (error) {
      if (error instanceof CatalogItemIdentityConflictError) continue;
      throw error;
    }
  }

  throw new Error('Ni bilo mogoče najti prostega naziva, SKU ali URL za kopijo artikla.');
}

function serializeJsonbValue(value: unknown) {
  if (value === null || value === undefined) return null;
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export async function duplicateCatalogItemByIdentifier(itemIdentifier: string): Promise<AdminCatalogListItem | null> {
  const normalizedIdentifier = itemIdentifier.trim();
  if (!normalizedIdentifier) throw new Error('Neveljaven identifikator artikla.');

  const pool = await getPool();
  const client = await pool.connect();
  let newItemId: number | null = null;

  try {
    await client.query('begin');
    await ensureCatalogItemQuantityDiscountsTable(client);
    await ensureCatalogItemEditorDetailsTable(client);

    const itemId = await resolveItemIdByIdentifier(client, normalizedIdentifier);
    if (!itemId) {
      await client.query('rollback');
      return null;
    }

    const sourceResult = await client.query(
      `
      select id, item_name, item_type, badge, status, category_id, sku, slug, unit, brand, material, colour, shape, description, admin_notes, position
      from catalog_items
      where id = $1
      limit 1
      `,
      [itemId]
    );
    const source = sourceResult.rows[0] as Record<string, unknown> | undefined;
    if (!source) {
      await client.query('rollback');
      return null;
    }

    const variants = (
      await client.query(
        `
        select id, variant_name, length, width, thickness, weight, error_tolerance, price, discount_pct, inventory, min_order, variant_sku, unit, status, badge, position
        from catalog_item_variants
        where item_id = $1
        order by position asc, id asc
        `,
        [itemId]
      )
    ).rows as Array<Record<string, unknown>>;

    const media = (
      await client.query(
        `
        select variant_id, media_kind, role, source_kind, filename, blob_url, blob_pathname, external_url, mime_type,
               alt_text, image_type, image_dimensions, video_type, hidden, position
        from catalog_media
        where item_id = $1
        order by position asc, id asc
        `,
        [itemId]
      )
    ).rows as Array<Record<string, unknown>>;
    const quantityDiscounts = (
      await client.query(
        `
        select min_quantity, discount_percent, applies_to, note, position
        from catalog_item_quantity_discounts
        where item_id = $1
        order by position asc, min_quantity asc, id asc
        `,
        [itemId]
      )
    ).rows as Array<Record<string, unknown>>;
    const editorDetails = (
      await client.query(
        `
        select product_type, data
        from catalog_item_editor_details
        where item_id = $1
        limit 1
        `,
        [itemId]
      )
    ).rows[0] as Record<string, unknown> | undefined;

    const identity = await buildCatalogItemCopyIdentity(client, source, variants);
    const sourcePosition = asNumber(source.position);
    const nextPosition = sourcePosition + 1;

    await client.query(
      `
      update catalog_items
      set position = position + 1,
          updated_at = now()
      where position > $1
      `,
      [sourcePosition]
    );

    const itemResult = await client.query(
      `
      insert into catalog_items (
        item_name, item_type, badge, status, category_id, sku, slug, unit, brand, material, colour, shape, description, admin_notes, position
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      returning id
      `,
      [
        identity.itemName,
        String(source.item_type ?? 'unit'),
        asStringOrNull(source.badge),
        normalizeActiveState(source.status),
        asStringOrNull(source.category_id),
        identity.sku,
        identity.slug,
        asStringOrNull(source.unit),
        asStringOrNull(source.brand),
        asStringOrNull(source.material),
        asStringOrNull(source.colour),
        asStringOrNull(source.shape),
        String(source.description ?? ''),
        asStringOrNull(source.admin_notes),
        nextPosition
      ]
    );
    newItemId = asNumber(itemResult.rows[0]?.id, -1);
    if (!newItemId || newItemId < 0) throw new Error('Kopiranje artikla ni uspelo.');

    const variantIdBySourceId = new Map<number, number>();
    for (let index = 0; index < variants.length; index += 1) {
      const variant = variants[index];
      const variantResult = await client.query(
        `
        insert into catalog_item_variants (
          item_id, variant_name, length, width, thickness, weight, error_tolerance, price, discount_pct,
          inventory, min_order, variant_sku, unit, status, badge, position
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        returning id
        `,
        [
          newItemId,
          String(variant.variant_name ?? ''),
          variant.length ?? null,
          variant.width ?? null,
          variant.thickness ?? null,
          variant.weight ?? null,
          asStringOrNull(variant.error_tolerance),
          asNumber(variant.price),
          asNumber(variant.discount_pct),
          asNumber(variant.inventory),
          Math.max(1, asNumber(variant.min_order, 1)),
          identity.variantSkus[index],
          asStringOrNull(variant.unit),
          normalizeActiveState(variant.status),
          asStringOrNull(variant.badge),
          asNumber(variant.position, index)
        ]
      );
      variantIdBySourceId.set(asNumber(variant.id), asNumber(variantResult.rows[0]?.id));
    }

    for (const mediaEntry of media) {
      const sourceVariantId = mediaEntry.variant_id === null ? null : asNumber(mediaEntry.variant_id, -1);
      const nextVariantId = sourceVariantId !== null && sourceVariantId >= 0 ? variantIdBySourceId.get(sourceVariantId) ?? null : null;

      await client.query(
        `
        insert into catalog_media (
          item_id, variant_id, media_kind, role, source_kind, filename, blob_url, blob_pathname, external_url, mime_type,
          alt_text, image_type, image_dimensions, video_type, hidden, position
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15,$16)
        `,
        [
          newItemId,
          nextVariantId,
          String(mediaEntry.media_kind ?? 'image'),
          String(mediaEntry.role ?? 'gallery'),
          String(mediaEntry.source_kind ?? 'upload'),
          asStringOrNull(mediaEntry.filename),
          asStringOrNull(mediaEntry.blob_url),
          asStringOrNull(mediaEntry.blob_pathname),
          asStringOrNull(mediaEntry.external_url),
          asStringOrNull(mediaEntry.mime_type),
          asStringOrNull(mediaEntry.alt_text),
          asStringOrNull(mediaEntry.image_type),
          serializeJsonbValue(mediaEntry.image_dimensions),
          asStringOrNull(mediaEntry.video_type),
          Boolean(mediaEntry.hidden),
          asNumber(mediaEntry.position)
        ]
      );
    }

    for (const quantityDiscount of quantityDiscounts) {
      await client.query(
        `
        insert into catalog_item_quantity_discounts (
          item_id, min_quantity, discount_percent, applies_to, note, position
        ) values ($1,$2,$3,$4,$5,$6)
        `,
        [
          newItemId,
          Math.max(1, Math.floor(asNumber(quantityDiscount.min_quantity, 1))),
          Math.min(100, Math.max(0, asNumber(quantityDiscount.discount_percent))),
          asStringOrNull(quantityDiscount.applies_to) ?? 'allVariants',
          asStringOrNull(quantityDiscount.note),
          asNumber(quantityDiscount.position)
        ]
      );
    }

    await client.query(
      `
      insert into catalog_item_editor_details (item_id, product_type, data)
      values ($1,$2,$3::jsonb)
      on conflict (item_id) do update
      set product_type = excluded.product_type,
          data = excluded.data,
          updated_at = now()
      `,
      [
        newItemId,
        normalizeCatalogEditorProductType(editorDetails?.product_type) ?? inferCatalogEditorProductType(source.item_type, variants),
        serializeJsonbValue(normalizeTypeSpecificData(editorDetails?.data)) ?? '{}'
      ]
    );

    await client.query('commit');
    revalidateTag(CATALOG_PUBLIC_TAG, 'max');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }

  return newItemId ? await fetchAdminCatalogListItemByItemId(newItemId) : null;
}

async function resolveCategoryIdByPath(path: string[]): Promise<string | null> {
  if (path.length === 0) return null;
  const pool = await getPool();
  let parentId: string | null = null;
  let lastId: string | null = null;

  for (const segment of path) {
    const result = await pool.query(
      `
      select id
      from catalog_categories
      where coalesce(parent_id, '') = coalesce($1::text, '')
        and lower(trim(title)) = lower(trim($2::text))
      order by position asc, id asc
      limit 1
      `,
      [parentId, segment]
    );

    const row = result.rows[0] as { id?: string } | undefined;
    if (!row?.id) return null;
    parentId = row.id;
    lastId = row.id;
  }

  return lastId;
}

export async function fetchCatalogItemSeeds(): Promise<CatalogItemSeedRow[]> {
  const pool = await getPool();
  const result = await pool.query(
    `
    with recursive category_paths as (
      select id, parent_id, title, title::text as full_path
      from catalog_categories
      where parent_id is null
      union all
      select c.id, c.parent_id, c.title, cp.full_path || ' / ' || c.title
      from catalog_categories c
      join category_paths cp on cp.id = c.parent_id
    ),
    media_images as (
      select item_id,
             coalesce(
               array_agg(coalesce(nullif(blob_url, ''), external_url) order by position asc, id asc)
                 filter (where media_kind = 'image' and role = 'gallery' and coalesce(nullif(blob_url, ''), external_url) is not null),
               array[]::text[]
             ) as image_urls
      from catalog_media
      group by item_id
    )
    select
      ci.id,
      ci.item_name,
      ci.description,
      coalesce(cp.full_path, '') as category_path,
      ci.category_id,
      cc.parent_id as parent_category_id,
      civ.id as variant_id,
      civ.variant_name,
      count(civ.id) over (partition by ci.id)::int as variant_count,
      civ.length::text as variant_length,
      civ.width::text as variant_width,
      civ.thickness::text as variant_thickness,
      civ.weight::text as variant_weight,
      coalesce(civ.price, 0)::text as price,
      coalesce(nullif(civ.variant_sku, ''), nullif(ci.sku, ''), ci.slug) as sku,
      coalesce(mi.image_urls, array[]::text[]) as images,
      coalesce(civ.discount_pct, 0)::text as discount_pct,
      ci.position as item_position
    from catalog_items ci
    left join catalog_item_variants civ on civ.item_id = ci.id
    left join media_images mi on mi.item_id = ci.id
    left join category_paths cp on cp.id = ci.category_id
    left join catalog_categories cc on cc.id = ci.category_id
    where ci.status = 'active'
    order by ci.position asc, ci.id asc, civ.position asc, civ.id asc
    `
  );

  return (result.rows as Record<string, unknown>[])
    .filter((row) => row.variant_id !== null)
    .map((row) => ({
      id: Number(row.id),
      item_name: String(row.item_name ?? ''),
      description: String(row.description ?? ''),
      category_path: String(row.category_path ?? ''),
      category_id: asStringOrNull(row.parent_category_id) ?? asStringOrNull(row.category_id),
      parent_category_id: asStringOrNull(row.category_id),
      variant_id: Number(row.variant_id),
      variant_name: String(row.variant_name ?? ''),
      variant_count: asNumber(row.variant_count),
      length: row.variant_length === null ? null : asNumber(row.variant_length),
      width: row.variant_width === null ? null : asNumber(row.variant_width),
      thickness: row.variant_thickness === null ? null : asNumber(row.variant_thickness),
      weight: row.variant_weight === null ? null : asNumber(row.variant_weight),
      price: asNumber(row.price),
      sku: String(row.sku ?? ''),
      images: Array.isArray(row.images) ? row.images.map((image) => String(image)) : [],
      discount_pct: asNumber(row.discount_pct),
      item_position: asNumber(row.item_position)
    }));
}

export async function fetchCatalogItemsForCategory(categoryIds: string[]): Promise<Array<{ category_id: string; item: Record<string, unknown> }>> {
  if (categoryIds.length === 0) return [];

  const pool = await getPool();
  const result = await pool.query(
    `
    with variants_agg as (
      select
        item_id,
        min(price)::text as min_price,
        max(price)::text as max_price,
        coalesce(
          json_agg(
            json_build_object(
              'id', id,
              'variantName', variant_name,
              'length', length,
              'width', width,
              'thickness', thickness,
              'price', price,
              'discountPct', discount_pct,
              'inventory', inventory,
              'minOrder', min_order,
              'variantSku', variant_sku,
              'unit', unit,
              'status', status,
              'badge', badge
            )
            order by position asc, id asc
          ),
          '[]'::json
        ) as variants
      from catalog_item_variants
      group by item_id
    ),
    media_agg as (
      select
        item_id,
        coalesce(json_agg(
          json_build_object(
            'id', id,
            'mediaKind', media_kind,
            'role', role,
            'sourceKind', source_kind,
            'filename', filename,
            'blobUrl', blob_url,
            'blobPathname', blob_pathname,
            'externalUrl', external_url,
            'mimeType', mime_type,
            'altText', alt_text,
            'imageType', image_type,
            'imageDimensions', image_dimensions,
            'videoType', video_type,
            'variantId', variant_id,
            'hidden', hidden,
            'position', position
          )
          order by position asc, id asc
        ), '[]'::json) as media
      from catalog_media
      group by item_id
    )
    select
      ci.category_id,
      json_build_object(
        'id', ci.id,
        'slug', ci.slug,
        'name', ci.item_name,
        'description', ci.description,
        'image', coalesce((
          select coalesce(nullif(cm.blob_url, ''), cm.external_url)
          from catalog_media cm
          where cm.item_id = ci.id
            and cm.media_kind = 'image'
            and cm.role = 'gallery'
            and coalesce(cm.hidden, false) = false
          order by cm.position asc, cm.id asc
          limit 1
        ), ''),
        'images', coalesce((
          select json_agg(coalesce(nullif(cm.blob_url, ''), cm.external_url) order by cm.position asc, cm.id asc)
          from catalog_media cm
          where cm.item_id = ci.id
            and cm.media_kind = 'image'
            and cm.role = 'gallery'
            and coalesce(cm.hidden, false) = false
            and coalesce(nullif(cm.blob_url, ''), cm.external_url) is not null
        ), '[]'::json),
        'price', coalesce(va.min_price, '0')::numeric,
        'discountPct', coalesce((
          select max(discount_pct)
          from catalog_item_variants civ
          where civ.item_id = ci.id
        ), 0),
        'displayOrder', ci.position,
        'variants', coalesce(va.variants, '[]'::json),
        'media', coalesce(ma.media, '[]'::json)
      ) as item
    from catalog_items ci
    left join variants_agg va on va.item_id = ci.id
    left join media_agg ma on ma.item_id = ci.id
    where ci.status = 'active'
      and ci.category_id = any($1::text[])
    order by ci.position asc, ci.item_name asc, ci.id asc
    `,
    [categoryIds]
  );

  return (result.rows as Array<{ category_id: string; item: Record<string, unknown> }>);
}

export async function fetchAdminCatalogListItems(): Promise<AdminCatalogListItem[]> {
  const pool = await getPool();
  await ensureCatalogItemEditorDetailsTable(pool);
  const result = await pool.query(
    `
    with recursive category_paths as (
      select id, parent_id, title, title::text as full_path
      from catalog_categories
      where parent_id is null
      union all
      select c.id, c.parent_id, c.title, cp.full_path || ' / ' || c.title
      from catalog_categories c
      join category_paths cp on cp.id = c.parent_id
    ),
    variants_agg as (
      select
        civ.item_id,
        coalesce(count(*), 0)::int as variant_count,
        coalesce(min(civ.price), 0)::numeric as min_price,
        coalesce(max(civ.price), 0)::numeric as max_price,
        coalesce(max(civ.discount_pct), 0)::numeric as max_discount_pct,
        coalesce(
          json_agg(
            json_build_object(
              'id', civ.id,
              'variantName', civ.variant_name,
              'variantSku', civ.variant_sku,
              'length', civ.length,
              'width', civ.width,
              'thickness', civ.thickness,
              'weight', civ.weight,
              'price', civ.price,
              'discountPct', civ.discount_pct,
              'inventory', civ.inventory,
              'minOrder', civ.min_order,
              'status', civ.status,
              'badge', civ.badge,
              'position', civ.position
            )
            order by civ.position asc, civ.id asc
          ),
          '[]'::json
        ) as variants
      from catalog_item_variants civ
      group by civ.item_id
    )
    select
      ci.id,
      ci.slug,
      ci.item_name,
      ci.item_type,
      cied.product_type as editor_product_type,
      coalesce(cied.data, '{}'::jsonb) as type_specific_data,
      ci.material,
      ci.sku,
      ci.status,
      ci.badge,
      ci.admin_notes,
      coalesce(cp.full_path, '') as category_label,
      coalesce(va.variant_count, 0) as variant_count,
      coalesce(va.min_price, 0)::text as min_price,
      coalesce(va.max_price, 0)::text as max_price,
      coalesce(va.max_discount_pct, 0)::text as default_discount_pct,
      coalesce(va.variants, '[]'::json) as variants
    from catalog_items ci
    left join category_paths cp on cp.id = ci.category_id
    left join variants_agg va on va.item_id = ci.id
    left join catalog_item_editor_details cied on cied.item_id = ci.id
    order by ci.position asc, ci.item_name asc, ci.id asc
    `
  );

  return (result.rows as Record<string, unknown>[]).map((row) => {
    const variantsJson = Array.isArray(row.variants) ? row.variants : [];
    const variants = variantsJson.map((variant) => {
      const entry = variant as Record<string, unknown>;
      return {
        id: asNumber(entry.id),
        variantName: String(entry.variantName ?? ''),
        variantSku: asStringOrNull(entry.variantSku),
        length: entry.length === null ? null : asNumber(entry.length),
        width: entry.width === null ? null : asNumber(entry.width),
        thickness: entry.thickness === null ? null : asNumber(entry.thickness),
        weight: entry.weight === null ? null : asNumber(entry.weight),
        price: asNumber(entry.price),
        discountPct: asNumber(entry.discountPct),
        inventory: asNumber(entry.inventory),
        minOrder: Math.max(1, asNumber(entry.minOrder, 1)),
        status: (String(entry.status ?? 'inactive') === 'active' ? 'active' : 'inactive') as 'active' | 'inactive',
        badge: asStringOrNull(entry.badge),
        position: asNumber(entry.position)
      };
    });

    return {
      id: Number(row.id),
      slug: String(row.slug ?? ''),
      itemName: String(row.item_name ?? ''),
      productType:
        normalizeCatalogEditorProductType(row.editor_product_type)
        ?? inferCatalogEditorProductType(row.item_type, variantsJson as Array<Record<string, unknown>>),
      typeSpecificData: normalizeTypeSpecificData(row.type_specific_data),
      material: asStringOrNull(row.material),
      baseSku: asStringOrNull(row.sku),
      categoryLabel: String(row.category_label ?? ''),
      status: String(row.status ?? 'inactive') === 'active' ? 'active' : 'inactive',
      badge: asStringOrNull(row.badge),
      variantCount: asNumber(row.variant_count),
      minPrice: asNumber(row.min_price),
      maxPrice: asNumber(row.max_price),
      defaultDiscountPct: asNumber(row.default_discount_pct),
      adminNotes: asStringOrNull(row.admin_notes),
      variants
    };
  });
}

export async function fetchCatalogItemEditorBySlug(slug: string): Promise<CatalogItemEditorHydration | null> {
  const normalizedSlug = slug.trim();
  if (!normalizedSlug) return null;

  const pool = await getPool();
  await ensureCatalogItemQuantityDiscountsTable(pool);
  await ensureCatalogItemEditorDetailsTable(pool);
  const result = await pool.query(
    `
    with item as (
      select *
      from catalog_items
      where slug = $1
         or id::text = $1
      order by case when id::text = $1 then 0 else 1 end
      limit 1
    ),
    category_path as (
      with recursive chain as (
        select cc.id, cc.parent_id, cc.title, 0 as depth
        from catalog_categories cc
        join item i on i.category_id = cc.id
        union all
        select parent.id, parent.parent_id, parent.title, chain.depth + 1
        from catalog_categories parent
        join chain on chain.parent_id = parent.id
      )
      select coalesce(array_agg(title order by depth desc), array[]::text[]) as path
      from chain
    )
    select
      i.id,
      i.item_name,
      i.item_type,
      i.badge,
      i.status,
      i.sku,
      i.slug,
      i.unit,
      i.brand,
      i.material,
      i.colour,
      i.shape,
      i.description,
      i.admin_notes,
      i.position,
      (
        select cied.product_type
        from catalog_item_editor_details cied
        where cied.item_id = i.id
        limit 1
      ) as editor_product_type,
      coalesce((
        select cied.data
        from catalog_item_editor_details cied
        where cied.item_id = i.id
        limit 1
      ), '{}'::jsonb) as type_specific_data,
      coalesce((select path from category_path), array[]::text[]) as category_path,
      coalesce((
        select json_agg(
          json_build_object(
            'id', civ.id,
            'variantName', civ.variant_name,
            'length', civ.length,
            'width', civ.width,
            'thickness', civ.thickness,
            'weight', civ.weight,
            'errorTolerance', civ.error_tolerance,
            'price', civ.price,
            'discountPct', civ.discount_pct,
            'inventory', civ.inventory,
            'minOrder', civ.min_order,
            'variantSku', civ.variant_sku,
            'unit', civ.unit,
            'status', civ.status,
            'badge', civ.badge,
            'position', civ.position
          )
          order by civ.position asc, civ.id asc
        )
        from catalog_item_variants civ
        where civ.item_id = i.id
      ), '[]'::json) as variants,
      coalesce((
        select json_agg(
          json_build_object(
            'id', cqd.id,
            'minQuantity', cqd.min_quantity,
            'discountPercent', cqd.discount_percent,
            'appliesTo', cqd.applies_to,
            'note', cqd.note,
            'position', cqd.position
          )
          order by cqd.position asc, cqd.min_quantity asc, cqd.id asc
        )
        from catalog_item_quantity_discounts cqd
        where cqd.item_id = i.id
      ), '[]'::json) as quantity_discounts,
      coalesce((
        select json_agg(
          json_build_object(
            'id', cm.id,
            'variantId', cm.variant_id,
            'mediaKind', cm.media_kind,
            'role', cm.role,
            'sourceKind', cm.source_kind,
            'filename', cm.filename,
            'blobUrl', cm.blob_url,
            'blobPathname', cm.blob_pathname,
            'externalUrl', cm.external_url,
            'mimeType', cm.mime_type,
            'altText', cm.alt_text,
            'imageType', cm.image_type,
            'imageDimensions', cm.image_dimensions,
            'videoType', cm.video_type,
            'hidden', cm.hidden,
            'position', cm.position
          )
          order by cm.position asc, cm.id asc
        )
        from catalog_media cm
        where cm.item_id = i.id
      ), '[]'::json) as media
    from item i
    `
    ,
    [normalizedSlug]
  );

  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;

  const variantsJson = Array.isArray(row.variants) ? row.variants : [];
  const quantityDiscountsJson = Array.isArray(row.quantity_discounts) ? row.quantity_discounts : [];
  const mediaJson = Array.isArray(row.media) ? row.media : [];
  const variantIdToIndex = new Map<number, number>();
  const variants = variantsJson.map((entry, index) => {
    const variant = entry as Record<string, unknown>;
    const id = asNumber(variant.id);
    variantIdToIndex.set(id, index);
    return {
      id,
      variantName: String(variant.variantName ?? ''),
      length: variant.length === null ? null : asNumber(variant.length),
      width: variant.width === null ? null : asNumber(variant.width),
      thickness: variant.thickness === null ? null : asNumber(variant.thickness),
      weight: variant.weight === null ? null : asNumber(variant.weight),
      errorTolerance: asStringOrNull(variant.errorTolerance),
      price: asNumber(variant.price),
      discountPct: asNumber(variant.discountPct),
      inventory: asNumber(variant.inventory),
      minOrder: Math.max(1, asNumber(variant.minOrder, 1)),
      variantSku: asStringOrNull(variant.variantSku),
      unit: asStringOrNull(variant.unit),
      status: (String(variant.status ?? 'inactive') === 'active' ? 'active' : 'inactive') as 'active' | 'inactive',
      badge: asStringOrNull(variant.badge),
      position: asNumber(variant.position, index)
    };
  });

  const media = mediaJson.map((entry, index) => {
    const item = entry as Record<string, unknown>;
    const variantId = item.variantId === null ? null : asNumber(item.variantId, -1);
    return {
      id: asNumber(item.id),
      variantIndex: variantId !== null && variantIdToIndex.has(variantId) ? variantIdToIndex.get(variantId) ?? null : null,
      mediaKind: String(item.mediaKind ?? 'image') as 'image' | 'video' | 'document',
      role: String(item.role ?? 'gallery') as 'gallery' | 'technical_sheet',
      sourceKind: String(item.sourceKind ?? 'upload') as 'upload' | 'youtube',
      filename: asStringOrNull(item.filename),
      blobUrl: asStringOrNull(item.blobUrl),
      blobPathname: asStringOrNull(item.blobPathname),
      externalUrl: asStringOrNull(item.externalUrl),
      mimeType: asStringOrNull(item.mimeType),
      altText: asStringOrNull(item.altText),
      imageType: asStringOrNull(item.imageType),
      imageDimensions: (typeof item.imageDimensions === 'object' && item.imageDimensions !== null
        ? (item.imageDimensions as { width?: number; height?: number })
        : null),
      videoType: asStringOrNull(item.videoType),
      hidden: Boolean(item.hidden),
      position: asNumber(item.position, index)
    };
  });
  const quantityDiscounts = quantityDiscountsJson.map((entry, index) =>
    normalizeQuantityDiscountRule(entry as Record<string, unknown>, index)
  );
  const productType =
    normalizeCatalogEditorProductType(row.editor_product_type)
    ?? inferCatalogEditorProductType(row.item_type, variantsJson as Array<Record<string, unknown>>);
  const machineSerialOrderMatchSkus = productType === 'unique_machine'
    ? [
        asStringOrNull(row.sku),
        ...variants.map((variant) => variant.variantSku)
      ].filter((entry): entry is string => Boolean(entry?.trim()))
    : [];
  const machineSerialOrderMatches = machineSerialOrderMatchSkus.length > 0
    ? await fetchOrderItemAllocationsForSkus(machineSerialOrderMatchSkus)
    : [];

  return {
    id: asNumber(row.id),
    itemName: String(row.item_name ?? ''),
    itemType: String(row.item_type ?? 'unit') as CatalogItemType,
    productType,
    typeSpecificData: normalizeTypeSpecificData(row.type_specific_data),
    badge: asStringOrNull(row.badge),
    status: String(row.status ?? 'inactive') === 'active' ? 'active' : 'inactive',
    categoryPath: Array.isArray(row.category_path) ? row.category_path.map((entry) => String(entry)) : [],
    sku: asStringOrNull(row.sku),
    slug: String(row.slug ?? ''),
    unit: asStringOrNull(row.unit),
    brand: asStringOrNull(row.brand),
    material: asStringOrNull(row.material),
    colour: asStringOrNull(row.colour),
    shape: asStringOrNull(row.shape),
    description: asStringOrNull(row.description),
    adminNotes: asStringOrNull(row.admin_notes),
    position: asNumber(row.position),
    variants,
    quantityDiscounts,
    media,
    machineSerialOrderMatches
  };
}

export async function quickPatchCatalogItemByIdentifier(
  itemIdentifier: string,
  patch: CatalogItemQuickPatch
): Promise<AdminCatalogListItem | null> {
  const normalizedIdentifier = itemIdentifier.trim();
  if (!normalizedIdentifier) throw new Error('Neveljaven identifikator artikla.');

  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query('begin');

    const itemId = await resolveItemIdByIdentifier(client, normalizedIdentifier);
    if (!itemId) {
      await client.query('rollback');
      return null;
    }

    const existingResult = await client.query(
      `
      select id, item_name, sku, status, badge, category_id
      from catalog_items
      where id = $1
      limit 1
      `,
      [itemId]
    );
    const existing = existingResult.rows[0];
    if (!existing) {
      await client.query('rollback');
      return null;
    }

    const nextCategoryId =
      patch.categoryId !== undefined
        ? asStringOrNull(patch.categoryId)
        : patch.categoryPath !== undefined
          ? await resolveCategoryIdByPath(patch.categoryPath)
          : asStringOrNull(existing.category_id);
    const nextItemName = patch.itemName !== undefined ? patch.itemName : String(existing.item_name ?? '');
    const nextSku = patch.sku !== undefined ? asStringOrNull(patch.sku) : asStringOrNull(existing.sku);

    await assertCatalogItemIdentityAvailable(client, {
      itemId,
      itemName: nextItemName,
      sku: nextSku
    });

    await client.query(
      `
      update catalog_items
      set item_name = $1,
          sku = $2,
          status = $3,
          badge = $4,
          category_id = $5,
          updated_at = now()
      where id = $6
      `,
      [
        nextItemName,
        nextSku,
        patch.status !== undefined ? patch.status : normalizeActiveState(existing.status),
        patch.badge !== undefined ? asStringOrNull(patch.badge) : asStringOrNull(existing.badge),
        nextCategoryId,
        itemId
      ]
    );

    await client.query('commit');
    revalidateTag(CATALOG_PUBLIC_TAG, 'max');
    return await fetchAdminCatalogListItemByItemId(itemId);
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function quickPatchCatalogVariantByIdentifier(
  itemIdentifier: string,
  variantId: number,
  patch: CatalogVariantQuickPatch
): Promise<{ item: AdminCatalogListItem; variant: AdminCatalogVariantSummary } | null> {
  const normalizedIdentifier = itemIdentifier.trim();
  if (!normalizedIdentifier || !Number.isFinite(variantId)) throw new Error('Neveljaven identifikator različice.');

  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query('begin');

    const itemId = await resolveItemIdByIdentifier(client, normalizedIdentifier);
    if (!itemId) {
      await client.query('rollback');
      return null;
    }

    const existingResult = await client.query(
      `
      select id, item_id, variant_name, variant_sku, length, width, thickness, weight, error_tolerance, price, discount_pct, inventory, min_order, status, badge, position
      from catalog_item_variants
      where id = $1 and item_id = $2
      limit 1
      `,
      [variantId, itemId]
    );
    const existing = existingResult.rows[0];
    if (!existing) {
      await client.query('rollback');
      return null;
    }
    const nextVariantSku = patch.variantSku !== undefined ? asStringOrNull(patch.variantSku) : asStringOrNull(existing.variant_sku);

    await assertCatalogItemIdentityAvailable(client, {
      itemId,
      variantSkus: [{ sku: nextVariantSku, variantId, label: String(existing.variant_name ?? '') }]
    });

    await client.query(
      `
      update catalog_item_variants
      set variant_name = $1,
          variant_sku = $2,
          length = $3,
          width = $4,
          thickness = $5,
          weight = $6,
          error_tolerance = $7,
          price = $8,
          discount_pct = $9,
          inventory = $10,
          min_order = $11,
          status = $12,
          badge = $13,
          position = $14
      where id = $15
        and item_id = $16
      `,
      [
        patch.variantName !== undefined ? patch.variantName : String(existing.variant_name ?? ''),
        nextVariantSku,
        patch.length !== undefined ? patch.length : existing.length,
        patch.width !== undefined ? patch.width : existing.width,
        patch.thickness !== undefined ? patch.thickness : existing.thickness,
        patch.weight !== undefined ? patch.weight : existing.weight,
        patch.errorTolerance !== undefined ? asStringOrNull(patch.errorTolerance) : asStringOrNull(existing.error_tolerance),
        patch.price !== undefined ? patch.price : asNumber(existing.price),
        patch.discountPct !== undefined ? patch.discountPct : asNumber(existing.discount_pct),
        patch.inventory !== undefined ? patch.inventory : asNumber(existing.inventory),
        patch.minOrder !== undefined ? Math.max(1, patch.minOrder) : Math.max(1, asNumber(existing.min_order, 1)),
        patch.status !== undefined ? patch.status : normalizeActiveState(existing.status),
        patch.badge !== undefined ? asStringOrNull(patch.badge) : asStringOrNull(existing.badge),
        patch.position !== undefined ? Math.max(1, patch.position) : asNumber(existing.position, 1),
        variantId,
        itemId
      ]
    );

    await client.query('commit');
    revalidateTag(CATALOG_PUBLIC_TAG, 'max');
    const item = await fetchAdminCatalogListItemByItemId(itemId);
    if (!item) return null;
    const variant = item.variants.find((entry) => entry.id === variantId);
    if (!variant) return null;
    return { item, variant };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function upsertCatalogItem(payload: CatalogItemEditorPayload): Promise<{ id: number; slug: string }> {
  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query('begin');
    await ensureCatalogItemQuantityDiscountsTable(client);

    const categoryId = await resolveCategoryIdByPath(payload.categoryPath);
    const effectiveId = payload.id ?? null;

    await assertCatalogItemIdentityAvailable(client, {
      itemId: effectiveId,
      itemName: payload.itemName,
      slug: payload.slug,
      sku: payload.sku,
      variantSkus: payload.variants.map((variant, index) => ({
        sku: variant.variantSku,
        variantId: variant.id ?? null,
        label: variant.variantName || `Različica ${index + 1}`
      }))
    });

    const itemResult = effectiveId
      ? await client.query(
          `
          update catalog_items
          set item_name = $1,
              item_type = $2,
              badge = $3,
              status = $4,
              category_id = $5,
              sku = $6,
              slug = $7,
              unit = $8,
              brand = $9,
              material = $10,
              colour = $11,
              shape = $12,
              description = $13,
              admin_notes = $14,
              position = $15,
              updated_at = now()
          where id = $16
          returning id, slug
          `,
          [
            payload.itemName,
            payload.itemType,
            asStringOrNull(payload.badge),
            payload.status,
            categoryId,
            asStringOrNull(payload.sku),
            payload.slug,
            asStringOrNull(payload.unit),
            asStringOrNull(payload.brand),
            asStringOrNull(payload.material),
            asStringOrNull(payload.colour),
            asStringOrNull(payload.shape),
            payload.description ?? '',
            asStringOrNull(payload.adminNotes),
            payload.position ?? 0,
            effectiveId
          ]
        )
      : await client.query(
          `
          insert into catalog_items (
            item_name, item_type, badge, status, category_id, sku, slug, unit, brand, material, colour, shape, description, admin_notes, position
          ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
          returning id, slug
          `,
          [
            payload.itemName,
            payload.itemType,
            asStringOrNull(payload.badge),
            payload.status,
            categoryId,
            asStringOrNull(payload.sku),
            payload.slug,
            asStringOrNull(payload.unit),
            asStringOrNull(payload.brand),
            asStringOrNull(payload.material),
            asStringOrNull(payload.colour),
            asStringOrNull(payload.shape),
            payload.description ?? '',
            asStringOrNull(payload.adminNotes),
            payload.position ?? 0
          ]
        );

    const itemRow = itemResult.rows[0] as { id: number; slug: string } | undefined;
    if (!itemRow) throw new Error('Shranjevanje artikla ni uspelo.');

    await client.query(
      `
      insert into catalog_item_editor_details (item_id, product_type, data)
      values ($1,$2,$3::jsonb)
      on conflict (item_id) do update
      set product_type = excluded.product_type,
          data = excluded.data,
          updated_at = now()
      `,
      [
        itemRow.id,
        normalizeCatalogEditorProductType(payload.productType) ?? inferCatalogEditorProductType(payload.itemType, payload.variants as Array<Record<string, unknown>>),
        serializeJsonbValue(normalizeTypeSpecificData(payload.typeSpecificData)) ?? '{}'
      ]
    );

    await client.query('delete from catalog_item_quantity_discounts where item_id = $1', [itemRow.id]);
    const quantityDiscounts = payload.quantityDiscounts ?? [];
    for (let index = 0; index < quantityDiscounts.length; index += 1) {
      const discount = normalizeQuantityDiscountRule(quantityDiscounts[index] as Record<string, unknown>, index);
      await client.query(
        `
        insert into catalog_item_quantity_discounts (
          item_id, min_quantity, discount_percent, applies_to, note, position
        ) values ($1,$2,$3,$4,$5,$6)
        `,
        [
          itemRow.id,
          discount.minQuantity,
          discount.discountPercent,
          discount.appliesTo ?? 'allVariants',
          asStringOrNull(discount.note),
          discount.position ?? index
        ]
      );
    }

    await client.query('delete from catalog_item_variants where item_id = $1', [itemRow.id]);

    const variantIdByIndex: Array<number | null> = [];
    for (let index = 0; index < payload.variants.length; index += 1) {
      const variant = payload.variants[index];
      const variantResult = await client.query(
        `
        insert into catalog_item_variants (
          item_id, variant_name, length, width, thickness, weight, error_tolerance, price, discount_pct,
          inventory, min_order, variant_sku, unit, status, badge, position
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        returning id
        `,
        [
          itemRow.id,
          variant.variantName,
          variant.length ?? null,
          variant.width ?? null,
          variant.thickness ?? null,
          variant.weight ?? null,
          asStringOrNull(variant.errorTolerance),
          variant.price,
          variant.discountPct ?? 0,
          variant.inventory ?? 0,
          Math.max(1, variant.minOrder ?? 1),
          asStringOrNull(variant.variantSku),
          asStringOrNull(variant.unit),
          variant.status ?? 'active',
          asStringOrNull(variant.badge),
          variant.position ?? index
        ]
      );
      variantIdByIndex[index] = Number(variantResult.rows[0]?.id ?? null);
    }

    await client.query('delete from catalog_media where item_id = $1', [itemRow.id]);

    for (const media of payload.media) {
      const variantId = typeof media.variantIndex === 'number' ? variantIdByIndex[media.variantIndex] ?? null : null;
      await client.query(
        `
        insert into catalog_media (
          item_id, variant_id, media_kind, role, source_kind, filename, blob_url, blob_pathname, external_url, mime_type,
          alt_text, image_type, image_dimensions, video_type, hidden, position
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15,$16)
        `,
        [
          itemRow.id,
          variantId,
          media.mediaKind,
          media.role,
          media.sourceKind,
          asStringOrNull(media.filename),
          asStringOrNull(media.blobUrl),
          asStringOrNull(media.blobPathname),
          asStringOrNull(media.externalUrl),
          asStringOrNull(media.mimeType),
          asStringOrNull(media.altText),
          asStringOrNull(media.imageType),
          media.imageDimensions ? JSON.stringify(media.imageDimensions) : null,
          asStringOrNull(media.videoType),
          Boolean(media.hidden),
          media.position ?? 0
        ]
      );
    }

    await client.query('commit');
    revalidateTag(CATALOG_PUBLIC_TAG, 'max');
    return { id: itemRow.id, slug: itemRow.slug };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteCatalogItemBySlug(slug: string): Promise<boolean> {
  const pool = await getPool();
  const result = await pool.query('delete from catalog_items where slug = $1 returning id', [slug]);
  if ((result.rowCount ?? 0) > 0) {
    revalidateTag(CATALOG_PUBLIC_TAG, 'max');
    return true;
  }
  return false;
}
