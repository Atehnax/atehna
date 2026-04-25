import { getPool } from '@/shared/server/db';
import { revalidateTag } from 'next/cache';
import { CATALOG_PUBLIC_TAG } from '@/shared/server/catalogCache';
import type { CatalogItemType } from '@/shared/domain/catalog/itemType';

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
  media: CatalogItemEditorPayload['media'];
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
    order by ci.position asc, ci.item_name asc, ci.id asc
    `
  );

  return (result.rows as Record<string, unknown>[]).map((row) => ({
    id: Number(row.id),
    slug: String(row.slug ?? ''),
    itemName: String(row.item_name ?? ''),
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
    variants: Array.isArray(row.variants)
      ? row.variants.map((variant) => {
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
            status: String(entry.status ?? 'inactive') === 'active' ? 'active' : 'inactive',
            badge: asStringOrNull(entry.badge),
            position: asNumber(entry.position)
          };
        })
      : []
  }));
}

export async function fetchCatalogItemEditorBySlug(slug: string): Promise<CatalogItemEditorHydration | null> {
  const normalizedSlug = slug.trim();
  if (!normalizedSlug) return null;

  const pool = await getPool();
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

  return {
    id: asNumber(row.id),
    itemName: String(row.item_name ?? ''),
    itemType: String(row.item_type ?? 'unit') as CatalogItemType,
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
    media
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
        patch.itemName !== undefined ? patch.itemName : String(existing.item_name ?? ''),
        patch.sku !== undefined ? asStringOrNull(patch.sku) : asStringOrNull(existing.sku),
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
        patch.variantSku !== undefined ? asStringOrNull(patch.variantSku) : asStringOrNull(existing.variant_sku),
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

    const categoryId = await resolveCategoryIdByPath(payload.categoryPath);

    const existingBySlug = payload.id
      ? null
      : await client.query('select id from catalog_items where slug = $1 limit 1', [payload.slug]);
    const effectiveId = payload.id ?? (existingBySlug?.rows[0]?.id ? Number(existingBySlug.rows[0].id) : null);

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
