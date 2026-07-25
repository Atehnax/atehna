import { unstable_cache, revalidateTag } from 'next/cache';
import { getPool } from '@/shared/server/db';
import { instrumentCatalogCacheMiss, instrumentCatalogLoader, profilePayloadEstimate, profileRoutePhase } from '@/shared/server/catalogDiagnostics';
import type { CatalogItem, CategoriesView, CategoryStatus } from '@/shared/domain/catalog/catalogTypes';
import {
  normalizeCategoryShowcaseMediaSettings,
  resolveCategoryShowcaseImage,
  type CategoryShowcaseItem,
  type CategoryShowcaseMediaSettings
} from '@/shared/features/category-showcase/categoryShowcaseSchema';
import {
  normalizeCatalogData,
  type CatalogData,
  type RecursiveCatalogCategory,
  type RecursiveCatalogSubcategory
} from '@/shared/server/catalogAdmin';
import {
  CATALOG_ADMIN_TAG,
  CATALOG_PUBLIC_TAG,
  CATEGORY_SHOWCASE_TAG
} from '@/shared/server/catalogCache';
import {
  getCategoryShowcaseItemsFromDatabase,
  type StoredCategoryShowcaseItem
} from '@/shared/server/categoryShowcase';
import { fetchCatalogItemsForCategory } from '@/shared/server/catalogItems';

export {
  CATALOG_ADMIN_TAG,
  CATALOG_PUBLIC_TAG,
  CATALOG_REVALIDATE_PATHS,
  CATEGORY_SHOWCASE_REVALIDATE_PATHS,
  CATEGORY_SHOWCASE_TAG
} from '@/shared/server/catalogCache';

type CatalogDataWithStatuses = CatalogData & { statuses: Record<string, CategoryStatus> };
type CatalogPreviewSubcategory = Pick<RecursiveCatalogSubcategory, 'id' | 'slug' | 'title' | 'description' | 'image' | 'items'> & {
  subcategories: CatalogPreviewSubcategory[];
};
type CatalogPreviewCategory = Pick<RecursiveCatalogCategory, 'id' | 'slug' | 'title' | 'summary' | 'description' | 'image' | 'presentation' | 'revision' | 'items'> & {
  subcategories: CatalogPreviewSubcategory[];
};
type CatalogPreviewData = { categories: CatalogPreviewCategory[] };
type CatalogPreviewDataWithStatuses = CatalogPreviewData & { statuses: Record<string, CategoryStatus> };

export type CatalogCategoryCard = Pick<RecursiveCatalogCategory, 'id' | 'slug' | 'title' | 'summary' | 'image' | 'presentation' | 'revision'>;
type CatalogCategorySummary = Pick<RecursiveCatalogCategory, 'slug' | 'title'>;
type CatalogCategoryWithSubcategories = Pick<RecursiveCatalogCategory, 'id' | 'slug' | 'title' | 'summary' | 'description' | 'image' | 'presentation' | 'revision' | 'items'> & {
  subcategories: Array<Pick<RecursiveCatalogSubcategory, 'id' | 'slug' | 'title' | 'description' | 'items'>>;
};
type CatalogCategoryPageSubcategory = Pick<RecursiveCatalogSubcategory, 'id' | 'slug' | 'title' | 'description'> & {
  itemCount: number;
};
type CatalogCategoryPageData = Pick<RecursiveCatalogCategory, 'id' | 'slug' | 'title' | 'summary' | 'description' | 'image'> & {
  items: CatalogItem[];
  subcategories: CatalogCategoryPageSubcategory[];
};
type CatalogItemsIndex = Array<
  Pick<RecursiveCatalogCategory, 'id' | 'slug' | 'title' | 'items'> & {
    subcategories: Array<Pick<RecursiveCatalogSubcategory, 'id' | 'slug' | 'title' | 'items'>>;
  }
>;

type CategoryCardRow = Pick<CategoryRow, 'id' | 'slug' | 'title' | 'summary' | 'image' | 'presentation_json'>;
type CategorySummaryRow = Pick<CategoryRow, 'slug' | 'title'>;
type CategoryDetailRow = Pick<CategoryRow, 'id' | 'slug' | 'title' | 'summary' | 'description' | 'image' | 'presentation_json' | 'items'>;
type SubcategoryDetailRow = Pick<CategoryRow, 'id' | 'slug' | 'title' | 'description' | 'items'>;
type SubcategoryCountRow = Pick<CategoryRow, 'id' | 'slug' | 'title' | 'description'> & { item_count: number };
type SearchCategoryRow = Pick<CategoryRow, 'id' | 'slug' | 'items'>;
type SearchSubcategoryRow = Pick<CategoryRow, 'parent_id' | 'id' | 'slug' | 'items'>;
type ItemsIndexCategoryRow = Pick<CategoryRow, 'id' | 'slug' | 'title' | 'items'>;
type ItemsIndexSubcategoryRow = Pick<CategoryRow, 'parent_id' | 'id' | 'slug' | 'title' | 'items'>;
type CategoryRow = {
  id: string;
  parent_id: string | null;
  slug: string;
  title: string;
  summary: string;
  description: string;
  image: string;
  presentation_json: unknown;
  admin_notes: string | null;
  banner_image: string | null;
  items: unknown;
  position: number;
  status: string;
  created_at: string;
  updated_at: string;
};

function normalizeStatus(value: string): CategoryStatus {
  return value === 'inactive' ? 'inactive' : 'active';
}

function getRowItems(row: { items: unknown }): CatalogItem[] {
  return Array.isArray(row.items) ? (row.items as CatalogItem[]) : [];
}

function mapItemsByCategoryId(rows: Array<{ category_id: string; item: Record<string, unknown> }>): Map<string, CatalogItem[]> {
  const byCategoryId = new Map<string, CatalogItem[]>();

  for (const row of rows) {
    const list = byCategoryId.get(row.category_id) ?? [];
    list.push(row.item as CatalogItem);
    byCategoryId.set(row.category_id, list);
  }

  return byCategoryId;
}

function assignItemsToCategoryTree(
  categories: RecursiveCatalogCategory[],
  itemsByCategoryId: Map<string, CatalogItem[]>
): RecursiveCatalogCategory[] {
  const mapSubcategories = (subcategories: RecursiveCatalogSubcategory[]): RecursiveCatalogSubcategory[] =>
    subcategories.map((subcategory) => ({
      ...subcategory,
      items: itemsByCategoryId.get(subcategory.id) ?? [],
      subcategories: mapSubcategories(subcategory.subcategories)
    }));

  return categories.map((category) => ({
    ...category,
    items: itemsByCategoryId.get(category.id) ?? [],
    subcategories: mapSubcategories(category.subcategories)
  }));
}

function normalizeCatalogImage(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('data:image/') ? '' : trimmed;
}

function rowToCategory(row: CategoryRow): RecursiveCatalogCategory {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    description: row.description,
    image: resolveCategoryShowcaseImage(normalizeCatalogImage(row.image), row.slug),
    presentation: normalizeCategoryShowcaseMediaSettings(row.presentation_json),
    adminNotes: row.admin_notes ?? undefined,
    bannerImage: normalizeCatalogImage(row.banner_image) || undefined,
    subcategories: [],
    items: getRowItems(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function rowToSubcategory(row: CategoryRow): RecursiveCatalogSubcategory {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    adminNotes: row.admin_notes ?? undefined,
    image: normalizeCatalogImage(row.image),
    items: getRowItems(row),
    subcategories: [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function rowToPreviewCategory(row: CategoryRow): CatalogPreviewCategory {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    description: row.description,
    image: resolveCategoryShowcaseImage(normalizeCatalogImage(row.image), row.slug),
    presentation: normalizeCategoryShowcaseMediaSettings(row.presentation_json),
    items: getRowItems(row),
    subcategories: []
  };
}

function rowToPreviewSubcategory(row: CategoryRow): CatalogPreviewSubcategory {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    image: normalizeCatalogImage(row.image),
    items: getRowItems(row),
    subcategories: []
  };
}

function buildSubcategoryTree(
  parentId: string,
  topCategorySlug: string,
  childrenByParent: Map<string, CategoryRow[]>,
  statuses: Record<string, CategoryStatus>,
  parentPath: string[] = []
): RecursiveCatalogSubcategory[] {
  const children = childrenByParent.get(parentId) ?? [];

  return children.map((row) => {
    const currentPath = [...parentPath, row.slug];
    const node = rowToSubcategory(row);

    statuses[`sub:${topCategorySlug}:${currentPath.join('__')}`] = normalizeStatus(row.status);
    node.subcategories = buildSubcategoryTree(row.id, topCategorySlug, childrenByParent, statuses, currentPath);

    return node;
  });
}

async function readCatalogDataFromDatabase(
  options: { includeInactive?: boolean; includeStatuses?: boolean } = {}
): Promise<CatalogData | CatalogDataWithStatuses> {
  const { includeInactive = false, includeStatuses = false } = options;

  const pool = await getPool();
  const result = await profileRoutePhase('db', 'readCatalogDataFromDatabase:allRows', () => pool.query(`
    select id, parent_id, slug, title, summary, description, image, presentation_json, admin_notes, banner_image, items, position, status, created_at,
           updated_at::text as updated_at
    from catalog_categories
    ${includeInactive ? '' : "where status = 'active'"}
    order by coalesce(parent_id, ''), position asc, title asc
  `));

  const rows = result.rows as CategoryRow[];
  const topLevel = rows.filter((row) => row.parent_id === null);
  const childrenByParent = new Map<string, CategoryRow[]>();

  for (const row of rows) {
    if (!row.parent_id) continue;
    const list = childrenByParent.get(row.parent_id) ?? [];
    list.push(row);
    childrenByParent.set(row.parent_id, list);
  }

  const statuses: Record<string, CategoryStatus> = {};
  const categories = topLevel.map((row) => {
    const category = rowToCategory(row);
    statuses[`cat:${row.slug}`] = normalizeStatus(row.status);
    category.subcategories = buildSubcategoryTree(row.id, row.slug, childrenByParent, statuses);
    return category;
  });

  const allCategoryIds = rows.map((row) => row.id);
  const itemsByCategoryId = mapItemsByCategoryId(await fetchCatalogItemsForCategory(allCategoryIds));

  const payload: CatalogDataWithStatuses = {
    categories: assignItemsToCategoryTree(categories, itemsByCategoryId),
    statuses
  };

  const normalizedPayload = includeStatuses ? payload : { categories: payload.categories };
  profilePayloadEstimate('readCatalogDataFromDatabase:payload', normalizedPayload);
  return normalizedPayload;
}

/**
 * Fresh, lightweight structural snapshot used by write-time audit diffing.
 * It intentionally bypasses caches and never joins/aggregates product data,
 * avoiding a full catalogue hydration immediately before every mutation.
 */
export async function getCatalogAdminAuditPayloadFromDatabase(
  diagnosticsContext = '/api/admin/categories:audit-before'
): Promise<CatalogDataWithStatuses> {
  return instrumentCatalogLoader('getCatalogAdminAuditPayloadFromDatabase', diagnosticsContext, async () => {
    const pool = await getPool();
    const result = await profileRoutePhase('db', 'getCatalogAdminAuditPayloadFromDatabase:rows', () => pool.query(`
      select id, parent_id, slug, title, summary, description, image, presentation_json,
             admin_notes, banner_image, position, status, created_at, updated_at::text as updated_at
      from catalog_categories
      order by coalesce(parent_id, ''), position asc, title asc
    `));
    const rows = result.rows as CategoryRow[];
    const topLevel = rows.filter((row) => row.parent_id === null);
    const childrenByParent = new Map<string, CategoryRow[]>();
    for (const row of rows) {
      if (!row.parent_id) continue;
      const children = childrenByParent.get(row.parent_id) ?? [];
      children.push(row);
      childrenByParent.set(row.parent_id, children);
    }

    const statuses: Record<string, CategoryStatus> = {};
    const categories = topLevel.map((row) => {
      const category = rowToCategory(row);
      category.items = [];
      statuses[`cat:${row.slug}`] = normalizeStatus(row.status);
      category.subcategories = buildSubcategoryTree(row.id, row.slug, childrenByParent, statuses).map((subcategory) => ({
        ...subcategory,
        items: []
      }));
      return category;
    });
    return { categories, statuses };
  });
}

function buildPreviewSubcategoryTree(
  parentId: string,
  topCategorySlug: string,
  childrenByParent: Map<string, CategoryRow[]>,
  statuses: Record<string, CategoryStatus>,
  parentPath: string[] = []
): CatalogPreviewSubcategory[] {
  const children = childrenByParent.get(parentId) ?? [];

  return children.map((row) => {
    const currentPath = [...parentPath, row.slug];
    const node = rowToPreviewSubcategory(row);

    statuses[`sub:${topCategorySlug}:${currentPath.join('__')}`] = normalizeStatus(row.status);
    node.subcategories = buildPreviewSubcategoryTree(row.id, topCategorySlug, childrenByParent, statuses, currentPath);

    return node;
  });
}

async function readCatalogPreviewDataFromDatabase(
  options: { includeInactive?: boolean; includeStatuses?: boolean } = {}
): Promise<CatalogPreviewData | CatalogPreviewDataWithStatuses> {
  const { includeInactive = false, includeStatuses = false } = options;

  const pool = await getPool();
  const result = await profileRoutePhase('db', 'readCatalogPreviewDataFromDatabase:allRows', () => pool.query(`
    select id, parent_id, slug, title, summary, description, image, presentation_json, items, position, status
    from catalog_categories
    ${includeInactive ? '' : "where status = 'active'"}
    order by coalesce(parent_id, ''), position asc, title asc
  `));

  const rows = result.rows as Array<Pick<CategoryRow, 'id' | 'parent_id' | 'slug' | 'title' | 'summary' | 'description' | 'image' | 'presentation_json' | 'items' | 'position' | 'status'>>;
  const topLevel = rows.filter((row) => row.parent_id === null);
  const childrenByParent = new Map<string, CategoryRow[]>();

  for (const row of rows) {
    if (!row.parent_id) continue;
    const list = childrenByParent.get(row.parent_id) ?? [];
    list.push(row as CategoryRow);
    childrenByParent.set(row.parent_id, list);
  }

  const statuses: Record<string, CategoryStatus> = {};
  const categories = topLevel.map((row) => {
    const category = rowToPreviewCategory(row as CategoryRow);
    statuses[`cat:${row.slug}`] = normalizeStatus(row.status);
    category.subcategories = buildPreviewSubcategoryTree(row.id, row.slug, childrenByParent, statuses);
    return category;
  });

  const allCategoryIds = rows.map((row) => row.id);
  const itemsByCategoryId = mapItemsByCategoryId(await fetchCatalogItemsForCategory(allCategoryIds));
  const assignPreviewItems = (nodes: CatalogPreviewSubcategory[]): CatalogPreviewSubcategory[] =>
    nodes.map((node) => ({
      ...node,
      items: itemsByCategoryId.get(node.id) ?? [],
      subcategories: assignPreviewItems(node.subcategories)
    }));
  const previewCategories = categories.map((category) => ({
    ...category,
    items: itemsByCategoryId.get(category.id) ?? [],
    subcategories: assignPreviewItems(category.subcategories)
  }));

  const payload: CatalogPreviewDataWithStatuses = { categories: previewCategories, statuses };
  const normalizedPayload = includeStatuses ? payload : { categories: payload.categories };
  profilePayloadEstimate('readCatalogPreviewDataFromDatabase:payload', normalizedPayload);
  return normalizedPayload;
}


async function readCatalogCategorySummariesFromDatabase(): Promise<CatalogCategorySummary[]> {
  const pool = await getPool();
  const result = await pool.query(`
    select slug, title
    from catalog_categories
    where parent_id is null and status = 'active'
    order by position asc, title asc
  `);

  return (result.rows as CategorySummaryRow[]).map(({ slug, title }) => ({ slug, title }));
}

async function readCatalogCategoryWithSubcategoriesFromDatabase(
  slug: string
): Promise<CatalogCategoryWithSubcategories | null> {
  const pool = await getPool();
  const categoryResult = await pool.query(
    `
      select id, slug, title, summary, description, image, presentation_json, items
      from catalog_categories
      where parent_id is null and status = 'active' and slug = $1
      limit 1
    `,
    [slug]
  );

  const categoryRow = (categoryResult.rows as CategoryDetailRow[])[0];
  if (!categoryRow) return null;

  const subcategoryResult = await pool.query(
    `
      select id, slug, title, description, items
      from catalog_categories
      where parent_id = $1 and status = 'active'
      order by position asc, title asc
    `,
    [categoryRow.id]
  );
  const subRows = subcategoryResult.rows as SubcategoryDetailRow[];
  const itemsByCategoryId = mapItemsByCategoryId(
    await fetchCatalogItemsForCategory([categoryRow.id, ...subRows.map((row) => row.id)])
  );

  return {
    id: categoryRow.id,
    slug: categoryRow.slug,
    title: categoryRow.title,
    summary: categoryRow.summary,
    description: categoryRow.description,
    image: resolveCategoryShowcaseImage(categoryRow.image, categoryRow.slug),
    presentation: normalizeCategoryShowcaseMediaSettings(categoryRow.presentation_json),
    items: itemsByCategoryId.get(categoryRow.id) ?? [],
    subcategories: subRows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      items: itemsByCategoryId.get(row.id) ?? []
    }))
  };
}

async function readCatalogCategoryPageDataFromDatabase(
  slug: string
): Promise<CatalogCategoryPageData | null> {
  const pool = await getPool();
  const categoryResult = await pool.query(
    `
      select id, slug, title, summary, description, image, items
      from catalog_categories
      where parent_id is null and status = 'active' and slug = $1
      limit 1
    `,
    [slug]
  );

  const categoryRow = (categoryResult.rows as CategoryDetailRow[])[0];
  if (!categoryRow) return null;

  const subcategoryResult = await pool.query(
    `
      select id, slug, title, description, coalesce(jsonb_array_length(items), 0)::int as item_count
      from catalog_categories
      where parent_id = $1 and status = 'active'
      order by position asc, title asc
    `,
    [categoryRow.id]
  );

  const subRows = subcategoryResult.rows as SubcategoryCountRow[];
  const itemsByCategoryId = mapItemsByCategoryId(
    await fetchCatalogItemsForCategory([categoryRow.id, ...subRows.map((row) => row.id)])
  );

  return {
    id: categoryRow.id,
    slug: categoryRow.slug,
    title: categoryRow.title,
    summary: categoryRow.summary,
    description: categoryRow.description,
    image: resolveCategoryShowcaseImage(categoryRow.image, categoryRow.slug),
    items: subRows.length === 0 ? itemsByCategoryId.get(categoryRow.id) ?? [] : [],
    subcategories: subRows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      itemCount: (itemsByCategoryId.get(row.id) ?? []).length
    }))
  };
}

async function readCatalogSubcategoryWithCategoryFromDatabase(
  categorySlug: string,
  subSlug: string
): Promise<{
  category: CatalogCategorySummary;
  subcategory: Pick<RecursiveCatalogSubcategory, 'id' | 'slug' | 'title' | 'description' | 'items'>;
} | null> {
  const pool = await getPool();
  const categoryResult = await pool.query(
    `
      select id, slug, title
      from catalog_categories
      where parent_id is null and status = 'active' and slug = $1
      limit 1
    `,
    [categorySlug]
  );

  const categoryRow = (categoryResult.rows as Array<Pick<CategoryRow, 'id' | 'slug' | 'title'>>)[0];
  if (!categoryRow) return null;

  const subcategoryResult = await pool.query(
    `
      select id, slug, title, description, items
      from catalog_categories
      where parent_id = $1 and status = 'active' and slug = $2
      limit 1
    `,
    [categoryRow.id, subSlug]
  );

  const subcategoryRow = (subcategoryResult.rows as SubcategoryDetailRow[])[0];
  if (!subcategoryRow) return null;
  const itemsByCategoryId = mapItemsByCategoryId(await fetchCatalogItemsForCategory([subcategoryRow.id]));

  return {
    category: { slug: categoryRow.slug, title: categoryRow.title },
    subcategory: {
      id: subcategoryRow.id,
      slug: subcategoryRow.slug,
      title: subcategoryRow.title,
      description: subcategoryRow.description,
      items: itemsByCategoryId.get(subcategoryRow.id) ?? []
    }
  };
}

async function readCatalogSearchIndexFromDatabase(): Promise<{
  categories: CatalogCategoryCard[];
  searchItems: Array<{ categorySlug: string; subcategorySlug?: string; items: CatalogItem[] }>;
}> {
  const pool = await getPool();
  const categoryResult = await pool.query(`
    select id, slug, title, summary, image, presentation_json, items
    from catalog_categories
    where parent_id is null and status = 'active'
    order by position asc, title asc
  `);

  const categoryRows = categoryResult.rows as Array<SearchCategoryRow & CategoryCardRow>;
  const categoryIds = categoryRows.map((row) => row.id);

  const subcategoryRows = categoryIds.length
    ? (await pool.query(
        `
          select parent_id, id, slug, items
          from catalog_categories
          where parent_id = any($1::text[]) and status = 'active'
          order by position asc, title asc
        `,
        [categoryIds]
      )).rows as SearchSubcategoryRow[]
    : [];

  const categorySlugById = new Map(categoryRows.map((row) => [row.id, row.slug]));
  const itemsByCategoryId = mapItemsByCategoryId(
    await fetchCatalogItemsForCategory([...categoryRows.map((row) => row.id), ...subcategoryRows.map((row) => row.id)])
  );

  return {
    categories: categoryRows.map(({ id, slug, title, summary, image, presentation_json }) => ({
      id,
      slug,
      title,
      summary,
      image: resolveCategoryShowcaseImage(normalizeCatalogImage(image), slug),
      presentation: normalizeCategoryShowcaseMediaSettings(presentation_json)
    })),
    searchItems: [
      ...categoryRows
        .map((row) => ({ categorySlug: row.slug, items: itemsByCategoryId.get(row.id) ?? [] }))
        .filter((row) => row.items.length > 0),
      ...subcategoryRows
        .map((row) => {
          const categorySlug = row.parent_id ? categorySlugById.get(row.parent_id) : null;
          if (!categorySlug) return null;
          return { categorySlug, subcategorySlug: row.slug, items: itemsByCategoryId.get(row.id) ?? [] };
        })
        .filter((row): row is { categorySlug: string; subcategorySlug: string; items: CatalogItem[] } => row !== null)
        .filter((row) => row.items.length > 0)
    ]
  };
}


async function readCatalogItemsIndexFromDatabase(): Promise<CatalogItemsIndex> {
  const pool = await getPool();
  const categoryResult = await profileRoutePhase('db', 'readCatalogItemsIndexFromDatabase:categories', () => pool.query(`
    select id, slug, title, items
    from catalog_categories
    where parent_id is null and status = 'active'
    order by position asc, title asc
  `));

  const categoryRows = categoryResult.rows as ItemsIndexCategoryRow[];
  const categoryIds = categoryRows.map((row) => row.id);

  const subcategoryRows = categoryIds.length
    ? ((await profileRoutePhase('db', 'readCatalogItemsIndexFromDatabase:subcategories', () => pool.query(
        `
          select parent_id, id, slug, title, items
          from catalog_categories
          where parent_id = any($1::text[]) and status = 'active'
          order by position asc, title asc
        `,
        [categoryIds]
      ))).rows as ItemsIndexSubcategoryRow[])
    : [];

  const subcategoriesByParent = new Map<string, Array<Pick<RecursiveCatalogSubcategory, 'id' | 'slug' | 'title' | 'items'>>>();
  const allCategoryIdsForItems = [...categoryIds, ...subcategoryRows.map((row) => row.id)];
  const itemsByCategoryId = mapItemsByCategoryId(await fetchCatalogItemsForCategory(allCategoryIdsForItems));

  for (const row of subcategoryRows) {
    if (!row.parent_id) continue;
    const list = subcategoriesByParent.get(row.parent_id) ?? [];
    list.push({
      id: row.id,
      slug: row.slug,
      title: row.title,
      items: itemsByCategoryId.get(row.id) ?? []
    });
    subcategoriesByParent.set(row.parent_id, list);
  }

  const payload = categoryRows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    items: itemsByCategoryId.get(row.id) ?? [],
    subcategories: subcategoriesByParent.get(row.id) ?? []
  }));
  profilePayloadEstimate('readCatalogItemsIndexFromDatabase:payload', payload);
  return payload;
}

const getCachedCatalogDataFromDatabase = unstable_cache(
  async () => instrumentCatalogCacheMiss('getCachedCatalogDataFromDatabase', 'catalog:data', () => readCatalogDataFromDatabase()),
  ['catalog-data-active'],
  { tags: [CATALOG_PUBLIC_TAG] }
);

const getCachedCatalogAdminDataFromDatabase = unstable_cache(
  async () => instrumentCatalogCacheMiss(
    'getCachedCatalogAdminDataFromDatabase',
    '/admin/kategorije',
    async () => readCatalogDataFromDatabase({ includeInactive: true, includeStatuses: true }) as Promise<CatalogDataWithStatuses>
  ),
  ['catalog-data-admin'],
  { tags: [CATALOG_PUBLIC_TAG, CATALOG_ADMIN_TAG] }
);

const getCachedCatalogAdminPreviewDataFromDatabase = unstable_cache(
  async () => instrumentCatalogCacheMiss(
    'getCachedCatalogAdminPreviewDataFromDatabase',
    '/admin/kategorije/predogled',
    async () => readCatalogPreviewDataFromDatabase({ includeInactive: true, includeStatuses: true }) as Promise<CatalogPreviewDataWithStatuses>
  ),
  ['catalog-data-admin-preview'],
  { tags: [CATALOG_PUBLIC_TAG, CATALOG_ADMIN_TAG] }
);

const getCachedCatalogCategorySummariesFromDatabase = unstable_cache(
  async () => instrumentCatalogCacheMiss('getCachedCatalogCategorySummariesFromDatabase', 'catalog:category-summaries', () => readCatalogCategorySummariesFromDatabase()),
  ['catalog-category-summaries'],
  { tags: [CATALOG_PUBLIC_TAG] }
);

const getCachedCatalogItemsIndexFromDatabase = unstable_cache(
  async () => instrumentCatalogCacheMiss('getCachedCatalogItemsIndexFromDatabase', 'catalog:items-index', () => readCatalogItemsIndexFromDatabase()),
  ['catalog-items-index'],
  { tags: [CATALOG_PUBLIC_TAG] }
);

export async function getCatalogDataFromDatabase(
  options: { includeInactive?: boolean; includeStatuses?: boolean; diagnosticsContext?: string } = {}
): Promise<CatalogData | CatalogDataWithStatuses> {
  const { includeInactive = false, includeStatuses = false, diagnosticsContext } = options;
  const context = diagnosticsContext ?? (includeInactive || includeStatuses ? '/admin/kategorije' : 'catalog:data');

  return instrumentCatalogLoader('getCatalogDataFromDatabase', context, async () => {
    const [payload, showcaseItems] = await Promise.all([
      includeInactive || includeStatuses
        ? getCachedCatalogAdminDataFromDatabase()
        : getCachedCatalogDataFromDatabase(),
      getCategoryShowcaseItemsFromDatabase(context)
    ]);
    const showcaseById = new Map(showcaseItems.map((item) => [item.id, item]));
    return {
      ...payload,
      categories: payload.categories.map((category) => {
        const showcase = showcaseById.get(category.id);
        return showcase
          ? {
              ...category,
              image: showcase.image,
              presentation: showcase.presentation,
              revision: showcase.revision
            }
          : category;
      })
    };
  });
}

export async function getCatalogPreviewDataFromDatabase(
  options: { includeInactive?: boolean; includeStatuses?: boolean; diagnosticsContext?: string } = {}
): Promise<CatalogPreviewData | CatalogPreviewDataWithStatuses> {
  const { includeInactive = false, includeStatuses = false, diagnosticsContext } = options;
  const context = diagnosticsContext ?? '/admin/kategorije/predogled';

  return instrumentCatalogLoader('getCatalogPreviewDataFromDatabase', context, async () => {
    const [payload, showcaseItems] = await Promise.all([
      includeInactive || includeStatuses
        ? getCachedCatalogAdminPreviewDataFromDatabase()
        : readCatalogPreviewDataFromDatabase(),
      getCategoryShowcaseItemsFromDatabase(context)
    ]);
    const showcaseById = new Map(showcaseItems.map((item) => [item.id, item]));
    return {
      ...payload,
      categories: payload.categories.map((category) => {
        const showcase = showcaseById.get(category.id);
        return showcase
          ? {
              ...category,
              image: showcase.image,
              presentation: showcase.presentation,
              revision: showcase.revision
            }
          : category;
      })
    };
  });
}

type CatalogAdminInitialRow = Pick<
  CategoryRow,
  'id' | 'parent_id' | 'slug' | 'title' | 'summary' | 'description' | 'position' | 'status' | 'created_at' | 'updated_at'
>;

type CatalogAdminInitialItemRow = {
  category_id: string;
  slug: string;
  item_name: string;
  description: string;
  created_at: string;
  updated_at: string;
};

function groupInitialRowsByParent(rows: CatalogAdminInitialRow[]) {
  const childrenByParent = new Map<string, CatalogAdminInitialRow[]>();
  for (const row of rows) {
    if (!row.parent_id) continue;
    const children = childrenByParent.get(row.parent_id) ?? [];
    children.push(row);
    childrenByParent.set(row.parent_id, children);
  }
  return childrenByParent;
}

function buildInitialStatusMap(rows: CatalogAdminInitialRow[]): Record<string, CategoryStatus> {
  const statuses: Record<string, CategoryStatus> = {};
  const childrenByParent = groupInitialRowsByParent(rows);

  const visit = (topSlug: string, parentId: string, path: string[]) => {
    for (const child of childrenByParent.get(parentId) ?? []) {
      const childPath = [...path, child.slug];
      statuses[`sub:${topSlug}:${childPath.join('__')}`] = normalizeStatus(child.status);
      visit(topSlug, child.id, childPath);
    }
  };

  for (const row of rows) {
    if (row.parent_id) continue;
    statuses[`cat:${row.slug}`] = normalizeStatus(row.status);
    visit(row.slug, row.id, []);
  }
  return statuses;
}

function mapInitialItemsByCategory(
  rows: CatalogAdminInitialItemRow[],
  includeTimestamps: boolean
): Map<string, CatalogItem[]> {
  const itemsByCategory = new Map<string, CatalogItem[]>();
  for (const row of rows) {
    const items = itemsByCategory.get(row.category_id) ?? [];
    items.push({
      slug: row.slug,
      name: row.item_name,
      description: includeTimestamps ? '' : row.description,
      ...(includeTimestamps
        ? {
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            created_at: row.created_at,
            updated_at: row.updated_at
          }
        : {})
    });
    itemsByCategory.set(row.category_id, items);
  }
  return itemsByCategory;
}

async function readCatalogAdminInitialRowsFromDatabase(
  diagnosticsLabel: string,
  includeItems: boolean
): Promise<{ rows: CatalogAdminInitialRow[]; itemRows: CatalogAdminInitialItemRow[] }> {
  const pool = await getPool();
  const result = await profileRoutePhase('db', `${diagnosticsLabel}:categories`, () => pool.query(`
    select id, parent_id, slug, title, summary, description, position, status, created_at,
           updated_at::text as updated_at
    from catalog_categories
    order by coalesce(parent_id, ''), position asc, title asc
  `));
  const rows = result.rows as CatalogAdminInitialRow[];
  if (!includeItems || rows.length === 0) return { rows, itemRows: [] };

  const itemResult = await profileRoutePhase('db', `${diagnosticsLabel}:item-identities`, () => pool.query(`
    select category_id, slug, item_name, description, created_at, updated_at
    from catalog_items
    where category_id = any($1::text[])
    order by category_id, position asc, item_name asc, id asc
  `, [rows.map((row) => row.id)]));

  return { rows, itemRows: itemResult.rows as CatalogAdminInitialItemRow[] };
}

async function readCatalogAdminTableInitialPayloadFromDatabase(): Promise<CatalogDataWithStatuses> {
  const { rows, itemRows } = await readCatalogAdminInitialRowsFromDatabase('catalog-admin-initial-table', true);
  const childrenByParent = groupInitialRowsByParent(rows);
  const itemsByCategory = mapInitialItemsByCategory(itemRows, false);
  const mapSubcategories = (parentId: string): RecursiveCatalogSubcategory[] =>
    (childrenByParent.get(parentId) ?? []).map((subcategory) => ({
      id: subcategory.id,
      slug: subcategory.slug,
      title: subcategory.title,
      description: subcategory.description,
      image: '',
      items: itemsByCategory.get(subcategory.id) ?? [],
      subcategories: mapSubcategories(subcategory.id)
    }));
  const categories = rows
    .filter((row) => row.parent_id === null)
    .map((row): RecursiveCatalogCategory => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      summary: row.summary,
      description: row.description,
      image: '',
      presentation: normalizeCategoryShowcaseMediaSettings(undefined),
      items: itemsByCategory.get(row.id) ?? [],
      subcategories: mapSubcategories(row.id)
    }));

  const payload = { categories, statuses: buildInitialStatusMap(rows) };
  profilePayloadEstimate('readCatalogAdminTableInitialPayloadFromDatabase:payload', payload);
  return payload;
}

async function readCatalogAdminMillerInitialPayloadFromDatabase(): Promise<CatalogDataWithStatuses> {
  const { rows, itemRows } = await readCatalogAdminInitialRowsFromDatabase('catalog-admin-initial-miller', true);
  const childrenByParent = groupInitialRowsByParent(rows);
  const itemsByCategory = mapInitialItemsByCategory(itemRows, true);
  const mapSubcategories = (parentId: string): RecursiveCatalogSubcategory[] =>
    (childrenByParent.get(parentId) ?? []).map((subcategory) => ({
      id: subcategory.id,
      slug: subcategory.slug,
      title: subcategory.title,
      description: '',
      image: '',
      createdAt: subcategory.created_at,
      updatedAt: subcategory.updated_at,
      items: itemsByCategory.get(subcategory.id) ?? [],
      subcategories: mapSubcategories(subcategory.id)
    }));
  const categories = rows
    .filter((row) => row.parent_id === null)
    .map((row): RecursiveCatalogCategory => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      summary: '',
      description: '',
      image: '',
      presentation: normalizeCategoryShowcaseMediaSettings(undefined),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      items: itemsByCategory.get(row.id) ?? [],
      subcategories: mapSubcategories(row.id)
    }));

  const payload = { categories, statuses: buildInitialStatusMap(rows) };
  profilePayloadEstimate('readCatalogAdminMillerInitialPayloadFromDatabase:payload', payload);
  return payload;
}

async function readCatalogAdminPreviewInitialPayloadFromDatabase(): Promise<CatalogDataWithStatuses> {
  const showcaseItems = await getCategoryShowcaseItemsFromDatabase('/admin/kategorije/predogled:initial');
  const categories = showcaseItems.map((item): RecursiveCatalogCategory => ({
    id: item.id,
    slug: item.slug,
    title: item.title,
    summary: item.summary,
    description: item.description,
    image: item.image,
    presentation: item.presentation,
    revision: item.revision,
    items: [],
    subcategories: []
  }));
  const payload = {
    categories,
    statuses: Object.fromEntries(showcaseItems.map((item) => [`cat:${item.slug}`, item.status]))
  };
  profilePayloadEstimate('readCatalogAdminPreviewInitialPayloadFromDatabase:payload', payload);
  return payload;
}

const getCachedCatalogAdminTableInitialPayloadFromDatabase = unstable_cache(
  async () => instrumentCatalogCacheMiss(
    'getCachedCatalogAdminTableInitialPayloadFromDatabase',
    '/admin/kategorije:initial',
    readCatalogAdminTableInitialPayloadFromDatabase
  ),
  ['catalog-admin-initial-table'],
  { tags: [CATALOG_ADMIN_TAG] }
);

const getCachedCatalogAdminMillerInitialPayloadFromDatabase = unstable_cache(
  async () => instrumentCatalogCacheMiss(
    'getCachedCatalogAdminMillerInitialPayloadFromDatabase',
    '/admin/kategorije/miller-view:initial',
    readCatalogAdminMillerInitialPayloadFromDatabase
  ),
  ['catalog-admin-initial-miller'],
  { tags: [CATALOG_ADMIN_TAG] }
);

export async function getCatalogAdminInitialPayloadFromDatabase(
  view: CategoriesView,
  diagnosticsContext?: string
): Promise<CatalogDataWithStatuses> {
  const context = diagnosticsContext ?? `/admin/kategorije${view === 'preview' ? '/predogled' : view === 'miller' ? '/miller-view' : ''}`;
  return instrumentCatalogLoader('getCatalogAdminInitialPayloadFromDatabase', context, () =>
    view === 'table'
      ? getCachedCatalogAdminTableInitialPayloadFromDatabase()
      : view === 'miller'
        ? getCachedCatalogAdminMillerInitialPayloadFromDatabase()
        : readCatalogAdminPreviewInitialPayloadFromDatabase()
  );
}

type CatalogRowPatch = {
  id: string;
  parentId: string | null;
  slug: string;
  title: string;
  summary: string;
  description: string;
  image?: string | null;
  removeImage?: boolean;
  adminNotes?: string | null;
  bannerImage?: string | null;
  items: CatalogItem[];
  position: number;
  status: CategoryStatus;
};

export async function patchCategoryTree(
  patches: { upserts: CatalogRowPatch[]; deleteIds: string[] }
): Promise<void> {
  const { upserts, deleteIds } = patches;

  if (upserts.length === 0 && deleteIds.length === 0) return;

  const pool = await getPool();
  const client = await pool.connect();

  try {
    await client.query('begin');

    for (const patch of upserts) {
      const hasImageUpdate = patch.removeImage === true || Object.prototype.hasOwnProperty.call(patch, 'image');
      await client.query(
        `
          insert into catalog_categories
            (id, parent_id, slug, title, summary, description, image, admin_notes, banner_image, items, position, status, updated_at)
          values
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, now())
          on conflict (id) do update set
            parent_id = excluded.parent_id,
            slug = excluded.slug,
            title = excluded.title,
            summary = excluded.summary,
            description = excluded.description,
            image = case
              when catalog_categories.parent_id is null then catalog_categories.image
              when $13::boolean then excluded.image
              else catalog_categories.image
            end,
            admin_notes = excluded.admin_notes,
            banner_image = excluded.banner_image,
            items = excluded.items,
            position = excluded.position,
            status = excluded.status,
            updated_at = now()
        `,
        [
          patch.id,
          patch.parentId,
          patch.slug,
          patch.title,
          patch.summary,
          patch.description,
          patch.removeImage || patch.image === null ? '' : normalizeCatalogImage(patch.image),
          patch.adminNotes ?? null,
          patch.bannerImage ? normalizeCatalogImage(patch.bannerImage) : null,
          JSON.stringify(Array.isArray(patch.items) ? patch.items : []),
          patch.position,
          patch.status,
          hasImageUpdate
        ]
      );
    }

    if (deleteIds.length > 0) {
      await client.query('delete from catalog_categories where id = any($1::text[])', [deleteIds]);
    }

    await client.query('commit');
    revalidateTag(CATALOG_PUBLIC_TAG, { expire: 0 });
    revalidateTag(CATALOG_ADMIN_TAG, { expire: 0 });
    revalidateTag(CATEGORY_SHOWCASE_TAG, { expire: 0 });
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export type TopLevelCategoryPresentationUpdate = {
  categoryId?: string;
  categorySlug?: string;
  image?: string | null;
  presentation?: CategoryShowcaseMediaSettings;
  expectedRevision?: string;
};

type UpdatedTopLevelCategoryRow = Pick<CategoryRow, 'id' | 'slug' | 'image' | 'presentation_json'> & {
  revision: string;
};

export type UpdatedTopLevelCategoryPresentation = Pick<
  CategoryShowcaseItem,
  'id' | 'slug' | 'image' | 'presentation' | 'revision'
>;

export class CategoryShowcaseConflictError extends Error {
  readonly statusCode = 409;

  constructor(categoryLabel: string) {
    super(`Kategorija ${categoryLabel} je bila med urejanjem spremenjena v drugem zavihku. Osvežite podatke in poskusite znova.`);
    this.name = 'CategoryShowcaseConflictError';
  }
}

/**
 * Canonical top-level category artwork mutation. Image and non-destructive
 * presentation settings are committed in one transaction so both admin
 * contexts always observe the same record.
 */
export async function updateTopLevelCategoryPresentations(
  updates: TopLevelCategoryPresentationUpdate[]
): Promise<UpdatedTopLevelCategoryPresentation[]> {
  if (updates.length === 0) return [];

  const pool = await getPool();
  const client = await pool.connect();
  const saved: UpdatedTopLevelCategoryPresentation[] = [];

  try {
    await client.query('begin');
    for (const update of updates) {
      const categoryId = update.categoryId?.trim() || null;
      const categorySlug = update.categorySlug?.trim() || null;
      const hasImage = Object.prototype.hasOwnProperty.call(update, 'image');
      const hasPresentation = Object.prototype.hasOwnProperty.call(update, 'presentation');
      const expectedRevision = typeof update.expectedRevision === 'string'
        ? update.expectedRevision.trim().toLowerCase()
        : null;
      if ((!categoryId && !categorySlug) || (!hasImage && !hasPresentation)) {
        throw new Error('Sprememba predstavitve kategorije ni veljavna.');
      }

      const result = await client.query(
        `
          update catalog_categories
          set
            image = case when $3::boolean then $4::text else image end,
            presentation_json = case when $5::boolean then $6::jsonb else presentation_json end,
            updated_at = now()
          where parent_id is null
            and ($1::text is null or id = $1)
            and ($2::text is null or slug = $2)
            and (
              $7::text is null
              or md5(coalesce(image, '') || '|' || coalesce(presentation_json::text, '{}')) = $7::text
            )
          returning id, slug, image, presentation_json,
                    md5(coalesce(image, '') || '|' || coalesce(presentation_json::text, '{}')) as revision
        `,
        [
          categoryId,
          categorySlug,
          hasImage,
          hasImage && update.image ? normalizeCatalogImage(update.image) : '',
          hasPresentation,
          JSON.stringify(normalizeCategoryShowcaseMediaSettings(update.presentation)),
          expectedRevision
        ]
      );
      if (result.rowCount !== 1) {
        const categoryLabel = categoryId ?? categorySlug ?? '';
        if (expectedRevision) {
          const exists = await client.query(
            `select 1 from catalog_categories where parent_id is null
             and ($1::text is null or id = $1)
             and ($2::text is null or slug = $2)
             limit 1`,
            [categoryId, categorySlug]
          );
          if (exists.rowCount === 1) throw new CategoryShowcaseConflictError(categoryLabel);
        }
        throw new Error(`Kategorija ${categoryLabel} ne obstaja.`);
      }
      const row = (result.rows as UpdatedTopLevelCategoryRow[])[0];
      saved.push({
        id: row.id,
        slug: row.slug,
        image: resolveCategoryShowcaseImage(normalizeCatalogImage(row.image), row.slug),
        presentation: normalizeCategoryShowcaseMediaSettings(row.presentation_json),
        revision: row.revision
      });
    }
    await client.query('commit');
    revalidateTag(CATEGORY_SHOWCASE_TAG, { expire: 0 });
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }

  return saved;
}

/** @deprecated Use updateTopLevelCategoryPresentations for new integrations. */
export async function updateTopLevelCategoryImages(
  updates: Array<{ categorySlug: string; image: string | null }>
): Promise<void> {
  await updateTopLevelCategoryPresentations(updates);
}

export async function getCatalogCategoryCardsFromDatabase(diagnosticsContext = 'catalog:category-cards'): Promise<CatalogCategoryCard[]> {
  return instrumentCatalogLoader('getCatalogCategoryCardsFromDatabase', diagnosticsContext, async () =>
    (await getCategoryShowcaseItemsFromDatabase(diagnosticsContext))
      .filter((category) => category.status === 'active')
      .map(mapStoredCategoryShowcaseToCard)
  );
}

function mapStoredCategoryShowcaseToCard(category: StoredCategoryShowcaseItem): CatalogCategoryCard {
  return {
    id: category.id,
    slug: category.slug,
    title: category.title,
    summary: category.summary ?? '',
    image: category.image ?? '',
    presentation: category.presentation,
    revision: category.revision
  };
}

export async function getCatalogCategorySummariesFromDatabase(diagnosticsContext = 'catalog:category-summaries'): Promise<CatalogCategorySummary[]> {
  return instrumentCatalogLoader('getCatalogCategorySummariesFromDatabase', diagnosticsContext, async () => getCachedCatalogCategorySummariesFromDatabase());
}

export async function getCatalogCategoryWithSubcategoriesFromDatabase(
  slug: string,
  diagnosticsContext = 'catalog:category-details'
): Promise<CatalogCategoryWithSubcategories | null> {
  const getCachedCategory = unstable_cache(
    async () => instrumentCatalogCacheMiss('getCachedCatalogCategoryWithSubcategoriesFromDatabase', diagnosticsContext, () =>
      readCatalogCategoryWithSubcategoriesFromDatabase(slug)
    ),
    ['catalog-category-with-subcategories', slug],
    { tags: [CATALOG_PUBLIC_TAG] }
  );

  return instrumentCatalogLoader('getCatalogCategoryWithSubcategoriesFromDatabase', diagnosticsContext, async () => {
    const [category, showcaseItems] = await Promise.all([
      getCachedCategory(),
      getCategoryShowcaseItemsFromDatabase(diagnosticsContext)
    ]);
    if (!category) return null;
    const showcase = showcaseItems.find((item) => item.slug === category.slug);
    return showcase
      ? {
          ...category,
          image: showcase.image,
          presentation: showcase.presentation,
          revision: showcase.revision
        }
      : category;
  });
}

export async function getCatalogCategoryPageDataFromDatabase(
  slug: string,
  diagnosticsContext = '/products/[category]'
): Promise<CatalogCategoryPageData | null> {
  const getCachedCategoryPageData = unstable_cache(
    async () =>
      instrumentCatalogCacheMiss('getCachedCatalogCategoryPageDataFromDatabase', diagnosticsContext, () =>
        readCatalogCategoryPageDataFromDatabase(slug)
      ),
    ['catalog-category-page-data', slug],
    { tags: [CATALOG_PUBLIC_TAG] }
  );

  return instrumentCatalogLoader('getCatalogCategoryPageDataFromDatabase', diagnosticsContext, async () => {
    const [category, showcaseItems] = await Promise.all([
      getCachedCategoryPageData(),
      getCategoryShowcaseItemsFromDatabase(diagnosticsContext)
    ]);
    if (!category) return null;
    const showcase = showcaseItems.find((item) => item.slug === category.slug);
    return showcase ? { ...category, image: showcase.image } : category;
  });
}

export async function getCatalogSubcategoryWithCategoryFromDatabase(
  categorySlug: string,
  subSlug: string,
  diagnosticsContext = 'catalog:subcategory-details'
): Promise<{
  category: CatalogCategorySummary;
  subcategory: Pick<RecursiveCatalogSubcategory, 'id' | 'slug' | 'title' | 'description' | 'items'>;
} | null> {
  const getCachedSubcategory = unstable_cache(
    async () => instrumentCatalogCacheMiss('getCachedCatalogSubcategoryWithCategoryFromDatabase', diagnosticsContext, () =>
      readCatalogSubcategoryWithCategoryFromDatabase(categorySlug, subSlug)
    ),
    ['catalog-subcategory-with-category', categorySlug, subSlug],
    { tags: [CATALOG_PUBLIC_TAG] }
  );

  return instrumentCatalogLoader('getCatalogSubcategoryWithCategoryFromDatabase', diagnosticsContext, async () => getCachedSubcategory());
}

export async function getCatalogSearchIndexFromDatabase(diagnosticsContext = 'catalog:search-index'): Promise<{
  categories: CatalogCategoryCard[];
  searchItems: Array<{ categorySlug: string; subcategorySlug?: string; items: CatalogItem[] }>;
}> {
  const getCachedSearchIndex = unstable_cache(
    async () => instrumentCatalogCacheMiss('getCachedCatalogSearchIndexFromDatabase', diagnosticsContext, () => readCatalogSearchIndexFromDatabase()),
    ['catalog-search-index'],
    { tags: [CATALOG_PUBLIC_TAG] }
  );

  return instrumentCatalogLoader('getCatalogSearchIndexFromDatabase', diagnosticsContext, async () => {
    const [payload, showcaseItems] = await Promise.all([
      getCachedSearchIndex(),
      getCategoryShowcaseItemsFromDatabase(diagnosticsContext)
    ]);
    const showcaseBySlug = new Map(showcaseItems.map((item) => [item.slug, item]));
    return {
      ...payload,
      categories: payload.categories.map((category) => {
        const showcase = showcaseBySlug.get(category.slug);
        return showcase ? mapStoredCategoryShowcaseToCard(showcase) : category;
      })
    };
  });
}

export async function getCatalogItemsIndexFromDatabase(diagnosticsContext = 'catalog:items-index'): Promise<CatalogItemsIndex> {
  return instrumentCatalogLoader('getCatalogItemsIndexFromDatabase', diagnosticsContext, async () => getCachedCatalogItemsIndexFromDatabase());
}

/**
 * Single database-backed catalog mutation path.
 *
 * Any future catalog write must either call this function or invalidate the exact same public/admin cache surface.
 */
export async function replaceCategoryTree(
  input: unknown,
  statuses: Record<string, CategoryStatus> = {}
): Promise<CatalogData> {
  const normalized = normalizeCatalogData(input);

  const pool = await getPool();
  const client = await pool.connect();

  try {
    await client.query('begin');

    const idsToKeep: string[] = [];

    const upsertSubcategoryTree = async (
      topCategorySlug: string,
      parentId: string,
      nodes: RecursiveCatalogSubcategory[],
      parentPath: string[] = []
    ) => {
      for (const [position, node] of nodes.entries()) {
        const currentPath = [...parentPath, node.slug];
        idsToKeep.push(node.id);

        await client.query(
          `
            insert into catalog_categories
              (id, parent_id, slug, title, summary, description, image, admin_notes, banner_image, items, position, status, updated_at)
            values
              ($1, $2, $3, $4, '', $5, $6, $7, null, $8::jsonb, $9, $10, now())
            on conflict (id) do update set
              parent_id = excluded.parent_id,
              slug = excluded.slug,
              title = excluded.title,
              summary = excluded.summary,
              description = excluded.description,
              image = excluded.image,
              admin_notes = excluded.admin_notes,
              banner_image = null,
              items = excluded.items,
              position = excluded.position,
              status = excluded.status,
              updated_at = now()
          `,
          [
            node.id,
            parentId,
            node.slug,
            node.title,
            node.description,
            normalizeCatalogImage(node.image),
            node.adminNotes ?? null,
            JSON.stringify(Array.isArray(node.items) ? node.items : []),
            position,
            statuses[`sub:${topCategorySlug}:${currentPath.join('__')}`] ?? 'active'
          ]
        );

        await upsertSubcategoryTree(topCategorySlug, node.id, node.subcategories, currentPath);
      }
    };

    for (const [categoryIndex, category] of normalized.categories.entries()) {
      idsToKeep.push(category.id);

      await client.query(
        `
          insert into catalog_categories
            (id, parent_id, slug, title, summary, description, image, admin_notes, banner_image, items, position, status, updated_at)
          values
            ($1, null, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, now())
          on conflict (id) do update set
            parent_id = excluded.parent_id,
            slug = excluded.slug,
            title = excluded.title,
            summary = excluded.summary,
            description = excluded.description,
            image = catalog_categories.image,
            admin_notes = excluded.admin_notes,
            banner_image = excluded.banner_image,
            items = excluded.items,
            position = excluded.position,
            status = excluded.status,
            updated_at = now()
        `,
        [
          category.id,
          category.slug,
          category.title,
          category.summary,
          category.description,
          category.image,
          category.adminNotes ?? null,
          normalizeCatalogImage(category.bannerImage) || null,
          JSON.stringify(Array.isArray(category.items) ? category.items : []),
          categoryIndex,
          statuses[`cat:${category.slug}`] ?? 'active'
        ]
      );

      await upsertSubcategoryTree(category.slug, category.id, category.subcategories);
    }

    if (idsToKeep.length > 0) {
      await client.query('delete from catalog_categories where not (id = any($1::text[]))', [idsToKeep]);
    } else {
      await client.query('delete from catalog_categories');
    }

    await client.query('commit');
    revalidateTag(CATALOG_PUBLIC_TAG, { expire: 0 });
    revalidateTag(CATALOG_ADMIN_TAG, { expire: 0 });
    revalidateTag(CATEGORY_SHOWCASE_TAG, { expire: 0 });
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }

  return normalized;
}
