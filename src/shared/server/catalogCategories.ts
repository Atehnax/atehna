import { unstable_cache, revalidateTag } from 'next/cache';
import { getPool, getDatabaseUrl } from '@/shared/server/db';
import { instrumentCatalogCacheMiss, instrumentCatalogLoader, profilePayloadEstimate, profileRoutePhase } from '@/shared/server/catalogDiagnostics';
import type { CatalogItem } from '@/commercial/catalog/catalog';
import {
  normalizeCatalogData,
  readCatalogFile,
  type CatalogData,
  type RecursiveCatalogCategory,
  type RecursiveCatalogSubcategory
} from '@/shared/server/catalogAdmin';

type CategoryStatus = 'active' | 'inactive';
type CatalogDataWithStatuses = CatalogData & { statuses: Record<string, CategoryStatus> };

export const CATALOG_PUBLIC_TAG = 'catalog-public';
export const CATALOG_ADMIN_TAG = 'catalog-admin';

export const CATALOG_REVALIDATE_PATHS = [
  { path: '/', type: 'page' },
  { path: '/products', type: 'page' },
  { path: '/products/[category]', type: 'page' },
  { path: '/products/[category]/[subcategory]', type: 'page' },
  { path: '/products/[category]/items/[item]', type: 'page' },
  { path: '/products/[category]/[subcategory]/[item]', type: 'page' },
  { path: '/admin/kategorije', type: 'page' },
  { path: '/admin/kategorije/miller-view', type: 'page' },
  { path: '/admin/artikli', type: 'page' }
] as const;

type CatalogCategoryCard = Pick<RecursiveCatalogCategory, 'slug' | 'title' | 'summary' | 'image'>;
type CatalogCategorySummary = Pick<RecursiveCatalogCategory, 'slug' | 'title'>;
type CatalogCategoryWithSubcategories = Pick<RecursiveCatalogCategory, 'id' | 'slug' | 'title' | 'summary' | 'description' | 'image' | 'items'> & {
  subcategories: Array<Pick<RecursiveCatalogSubcategory, 'id' | 'slug' | 'title' | 'description' | 'items'>>;
};
type CatalogItemsIndex = Array<
  Pick<RecursiveCatalogCategory, 'id' | 'slug' | 'title' | 'items'> & {
    subcategories: Array<Pick<RecursiveCatalogSubcategory, 'id' | 'slug' | 'title' | 'items'>>;
  }
>;
export type AdminPreviewNode = {
  id: string;
  parentId: string | null;
  kind: 'category' | 'subcategory';
  categorySlug: string;
  path: string[];
  slug: string;
  title: string;
  description: string;
  image: string;
  status: CategoryStatus;
  position: number;
  hasChildren: boolean;
};

export type AdminPreviewPayload = {
  nodes: AdminPreviewNode[];
};

export type AdminPreviewLeafItemsPayload = {
  category: Pick<RecursiveCatalogCategory, 'id' | 'slug' | 'title'>;
  subcategory: Pick<RecursiveCatalogSubcategory, 'id' | 'slug' | 'title'> | null;
  items: CatalogItem[];
};

type CategoryCardRow = Pick<CategoryRow, 'slug' | 'title' | 'summary' | 'image'>;
type CategorySummaryRow = Pick<CategoryRow, 'slug' | 'title'>;
type CategoryDetailRow = Pick<CategoryRow, 'id' | 'slug' | 'title' | 'summary' | 'description' | 'image' | 'items'>;
type SubcategoryDetailRow = Pick<CategoryRow, 'id' | 'slug' | 'title' | 'description' | 'items'>;
type SearchCategoryRow = Pick<CategoryRow, 'id' | 'slug' | 'items'>;
type SearchSubcategoryRow = Pick<CategoryRow, 'parent_id' | 'slug' | 'items'>;
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
  admin_notes: string | null;
  banner_image: string | null;
  items: unknown;
  position: number;
  status: string;
  created_at: string;
  updated_at: string;
};

let ensured = false;
let seeded = false;

async function ensureTable() {
  if (ensured) return;
  const pool = await getPool();
  await pool.query(`
    create table if not exists catalog_categories (
      id text primary key,
      parent_id text references catalog_categories(id) on delete cascade,
      slug text not null,
      title text not null,
      summary text not null default '',
      description text not null default '',
      image text not null default '',
      admin_notes text,
      banner_image text,
      items jsonb not null default '[]'::jsonb,
      position integer not null default 0,
      status text not null default 'active',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint catalog_categories_status_check check (status in ('active', 'inactive')),
      constraint catalog_categories_parent_slug_unique unique (parent_id, slug)
    )
  `);
  await pool.query('create index if not exists idx_catalog_categories_parent_position on catalog_categories(parent_id, position)');
  await pool.query('create index if not exists idx_catalog_categories_parent on catalog_categories(parent_id)');
  ensured = true;
}

async function seedIfEmpty() {
  if (seeded) return;

  const pool = await getPool();
  const countResult = await pool.query('select count(*)::int as count from catalog_categories');
  const count = Number(countResult.rows[0]?.count ?? 0);

  if (count > 0) {
    seeded = true;
    return;
  }

  const fromFile = await readCatalogFile();
  await replaceCategoryTree(fromFile);
  seeded = true;
}

function normalizeStatus(value: string): CategoryStatus {
  return value === 'inactive' ? 'inactive' : 'active';
}

function getRowItems(row: { items: unknown }): CatalogItem[] {
  return Array.isArray(row.items) ? (row.items as CatalogItem[]) : [];
}

function rowToCategory(row: CategoryRow): RecursiveCatalogCategory {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    description: row.description,
    image: row.image,
    adminNotes: row.admin_notes ?? undefined,
    bannerImage: row.banner_image ?? undefined,
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
    image: row.image,
    items: getRowItems(row),
    subcategories: [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function buildDefaultStatuses(categories: RecursiveCatalogCategory[]): Record<string, CategoryStatus> {
  const statuses: Record<string, CategoryStatus> = {};

  const visit = (
    categorySlug: string,
    nodes: RecursiveCatalogSubcategory[],
    parentPath: string[] = []
  ) => {
    for (const node of nodes) {
      const currentPath = [...parentPath, node.slug];
      statuses[`sub:${categorySlug}:${currentPath.join('__')}`] = 'active';
      visit(categorySlug, node.subcategories, currentPath);
    }
  };

  for (const category of categories) {
    statuses[`cat:${category.slug}`] = 'active';
    visit(category.slug, category.subcategories);
  }

  return statuses;
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

  if (!getDatabaseUrl()) {
    const normalized = await readCatalogFile();
    return includeStatuses
      ? { categories: normalized.categories, statuses: buildDefaultStatuses(normalized.categories) }
      : normalized;
  }

  await ensureTable();
  await seedIfEmpty();

  const pool = await getPool();
  const result = await profileRoutePhase('db', 'readCatalogDataFromDatabase:allRows', () => pool.query(`
    select id, parent_id, slug, title, summary, description, image, admin_notes, banner_image, items, position, status, created_at, updated_at
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

  const payload: CatalogDataWithStatuses = {
    categories,
    statuses
  };

  const normalizedPayload = includeStatuses ? payload : { categories: payload.categories };
  profilePayloadEstimate('readCatalogDataFromDatabase:payload', normalizedPayload);
  return normalizedPayload;
}

async function readAdminPreviewPayloadFromDatabase(): Promise<AdminPreviewPayload> {
  if (!getDatabaseUrl()) {
    const normalized = await readCatalogFile();
    const nodes: AdminPreviewNode[] = [];

    const visit = (
      categorySlug: string,
      parentId: string,
      entries: RecursiveCatalogSubcategory[],
      parentPath: string[] = []
    ) => {
      entries.forEach((entry, index) => {
        const path = [...parentPath, entry.slug];
        nodes.push({
          id: entry.id,
          parentId,
          kind: 'subcategory',
          categorySlug,
          path,
          slug: entry.slug,
          title: entry.title,
          description: entry.description,
          image: entry.image ?? '',
          status: 'active',
          position: index,
          hasChildren: entry.subcategories.length > 0
        });
        visit(categorySlug, entry.id, entry.subcategories, path);
      });
    };

    normalized.categories.forEach((category, index) => {
      nodes.push({
        id: category.id,
        parentId: null,
        kind: 'category',
        categorySlug: category.slug,
        path: [],
        slug: category.slug,
        title: category.title,
        description: category.summary,
        image: category.image ?? '',
        status: 'active',
        position: index,
        hasChildren: category.subcategories.length > 0
      });
      visit(category.slug, category.id, category.subcategories);
    });

    return { nodes };
  }

  await ensureTable();
  await seedIfEmpty();

  const pool = await getPool();
  const result = await profileRoutePhase('db', 'readAdminPreviewPayloadFromDatabase:nodes', () => pool.query(`
    select id, parent_id, slug, title, summary, description, image, position, status
    from catalog_categories
    order by coalesce(parent_id, ''), position asc, title asc
  `));

  const rows = result.rows as Array<Pick<CategoryRow, 'id' | 'parent_id' | 'slug' | 'title' | 'summary' | 'description' | 'image' | 'position' | 'status'>>;
  const childrenByParent = new Map<string, typeof rows>();
  rows.forEach((row) => {
    if (!row.parent_id) return;
    const list = childrenByParent.get(row.parent_id) ?? [];
    list.push(row);
    childrenByParent.set(row.parent_id, list);
  });

  const buildNodes = (
    parentId: string | null,
    categorySlug: string | null,
    parentPath: string[] = []
  ): AdminPreviewNode[] => {
    const siblings = parentId === null
      ? rows.filter((row) => row.parent_id === null)
      : (childrenByParent.get(parentId) ?? []);

    return siblings.flatMap((row) => {
      const kind = row.parent_id === null ? 'category' as const : 'subcategory' as const;
      const nextCategorySlug = kind === 'category' ? row.slug : (categorySlug ?? row.slug);
      const path = kind === 'category' ? [] : [...parentPath, row.slug];
      const node: AdminPreviewNode = {
        id: row.id,
        parentId: row.parent_id,
        kind,
        categorySlug: nextCategorySlug,
        path,
        slug: row.slug,
        title: row.title,
        description: kind === 'category' ? row.summary : row.description,
        image: row.image ?? '',
        status: normalizeStatus(row.status),
        position: row.position,
        hasChildren: (childrenByParent.get(row.id)?.length ?? 0) > 0
      };

      return [node, ...buildNodes(row.id, nextCategorySlug, path)];
    });
  };

  const payload = { nodes: buildNodes(null, null) };
  profilePayloadEstimate('readAdminPreviewPayloadFromDatabase:payload', payload);
  return payload;
}

async function readAdminPreviewLeafItemsFromDatabase(nodeId: string): Promise<AdminPreviewLeafItemsPayload | null> {
  if (!getDatabaseUrl()) {
    const normalized = await readCatalogFile();
    for (const category of normalized.categories) {
      if (category.id === nodeId) {
        return { category: { id: category.id, slug: category.slug, title: category.title }, subcategory: null, items: category.items ?? [] };
      }

      const visit = (entries: RecursiveCatalogSubcategory[]): AdminPreviewLeafItemsPayload | null => {
        for (const entry of entries) {
          if (entry.id === nodeId) {
            return {
              category: { id: category.id, slug: category.slug, title: category.title },
              subcategory: { id: entry.id, slug: entry.slug, title: entry.title },
              items: entry.items
            };
          }
          const nested = visit(entry.subcategories);
          if (nested) return nested;
        }
        return null;
      };

      const found = visit(category.subcategories);
      if (found) return found;
    }
    return null;
  }

  await ensureTable();
  await seedIfEmpty();
  const pool = await getPool();
  const nodeResult = await profileRoutePhase('db', 'readAdminPreviewLeafItemsFromDatabase:node', () => pool.query(`
    select id, parent_id, slug, title, items
    from catalog_categories
    where id = $1
    limit 1
  `, [nodeId]));
  const node = nodeResult.rows[0] as Pick<CategoryRow, 'id' | 'parent_id' | 'slug' | 'title' | 'items'> | undefined;
  if (!node) return null;

  if (node.parent_id === null) {
    return {
      category: { id: node.id, slug: node.slug, title: node.title },
      subcategory: null,
      items: getRowItems(node)
    };
  }

  const lineageResult = await profileRoutePhase('db', 'readAdminPreviewLeafItemsFromDatabase:lineage', () => pool.query(`
    with recursive lineage as (
      select id, parent_id, slug, title
      from catalog_categories
      where id = $1
      union all
      select parent.id, parent.parent_id, parent.slug, parent.title
      from catalog_categories parent
      inner join lineage child on child.parent_id = parent.id
    )
    select id, parent_id, slug, title
    from lineage
  `, [nodeId]));
  const lineage = lineageResult.rows as Array<Pick<CategoryRow, 'id' | 'parent_id' | 'slug' | 'title'>>;
  const category = lineage.find((entry) => entry.parent_id === null);
  if (!category) return null;

  return {
    category: { id: category.id, slug: category.slug, title: category.title },
    subcategory: { id: node.id, slug: node.slug, title: node.title },
    items: getRowItems(node)
  };
}


async function readCatalogCategoryCardsFromDatabase(): Promise<CatalogCategoryCard[]> {
  if (!getDatabaseUrl()) {
    const normalized = await readCatalogFile();
    return normalized.categories.map(({ slug, title, summary, image }) => ({ slug, title, summary, image }));
  }

  await ensureTable();
  await seedIfEmpty();

  const pool = await getPool();
  const result = await pool.query(`
    select slug, title, summary, image
    from catalog_categories
    where parent_id is null and status = 'active'
    order by position asc, title asc
  `);

  return (result.rows as CategoryCardRow[]).map(({ slug, title, summary, image }) => ({ slug, title, summary, image }));
}

async function readCatalogCategorySummariesFromDatabase(): Promise<CatalogCategorySummary[]> {
  if (!getDatabaseUrl()) {
    const normalized = await readCatalogFile();
    return normalized.categories.map(({ slug, title }) => ({ slug, title }));
  }

  await ensureTable();
  await seedIfEmpty();

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
  if (!getDatabaseUrl()) {
    const normalized = await readCatalogFile();
    const category = normalized.categories.find((entry) => entry.slug === slug);
    if (!category) return null;

    return {
      id: category.id,
      slug: category.slug,
      title: category.title,
      summary: category.summary,
      description: category.description,
      image: category.image,
      items: category.items,
      subcategories: category.subcategories.map(({ id, slug, title, description, items }) => ({
        id,
        slug,
        title,
        description,
        items
      }))
    };
  }

  await ensureTable();
  await seedIfEmpty();

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
      select id, slug, title, description, items
      from catalog_categories
      where parent_id = $1 and status = 'active'
      order by position asc, title asc
    `,
    [categoryRow.id]
  );

  return {
    id: categoryRow.id,
    slug: categoryRow.slug,
    title: categoryRow.title,
    summary: categoryRow.summary,
    description: categoryRow.description,
    image: categoryRow.image,
    items: getRowItems(categoryRow),
    subcategories: (subcategoryResult.rows as SubcategoryDetailRow[]).map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      items: getRowItems(row)
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
  if (!getDatabaseUrl()) {
    const normalized = await readCatalogFile();
    const category = normalized.categories.find((entry) => entry.slug === categorySlug);
    const subcategory = category?.subcategories.find((entry) => entry.slug === subSlug);
    if (!category || !subcategory) return null;

    return {
      category: { slug: category.slug, title: category.title },
      subcategory: {
        id: subcategory.id,
        slug: subcategory.slug,
        title: subcategory.title,
        description: subcategory.description,
        items: subcategory.items
      }
    };
  }

  await ensureTable();
  await seedIfEmpty();

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

  return {
    category: { slug: categoryRow.slug, title: categoryRow.title },
    subcategory: {
      id: subcategoryRow.id,
      slug: subcategoryRow.slug,
      title: subcategoryRow.title,
      description: subcategoryRow.description,
      items: getRowItems(subcategoryRow)
    }
  };
}

async function readCatalogSearchIndexFromDatabase(): Promise<{
  categories: CatalogCategoryCard[];
  searchItems: Array<{ categorySlug: string; subcategorySlug?: string; items: CatalogItem[] }>;
}> {
  if (!getDatabaseUrl()) {
    const normalized = await readCatalogFile();
    return {
      categories: normalized.categories.map(({ slug, title, summary, image }) => ({ slug, title, summary, image })),
      searchItems: normalized.categories.flatMap((category) => {
        const directItems = category.items.length
          ? [{ categorySlug: category.slug, items: category.items }]
          : [];
        const subcategoryItems = category.subcategories.map((subcategory) => ({
          categorySlug: category.slug,
          subcategorySlug: subcategory.slug,
          items: subcategory.items
        }));
        return [...directItems, ...subcategoryItems];
      })
    };
  }

  await ensureTable();
  await seedIfEmpty();

  const pool = await getPool();
  const categoryResult = await pool.query(`
    select id, slug, title, summary, image, items
    from catalog_categories
    where parent_id is null and status = 'active'
    order by position asc, title asc
  `);

  const categoryRows = categoryResult.rows as Array<SearchCategoryRow & CategoryCardRow>;
  const categoryIds = categoryRows.map((row) => row.id);

  const subcategoryRows = categoryIds.length
    ? (await pool.query(
        `
          select parent_id, slug, items
          from catalog_categories
          where parent_id = any($1::text[]) and status = 'active'
          order by position asc, title asc
        `,
        [categoryIds]
      )).rows as SearchSubcategoryRow[]
    : [];

  const categorySlugById = new Map(categoryRows.map((row) => [row.id, row.slug]));

  return {
    categories: categoryRows.map(({ slug, title, summary, image }) => ({ slug, title, summary, image })),
    searchItems: [
      ...categoryRows
        .filter((row) => getRowItems(row).length > 0)
        .map((row) => ({ categorySlug: row.slug, items: getRowItems(row) })),
      ...subcategoryRows
        .map((row) => {
          const categorySlug = row.parent_id ? categorySlugById.get(row.parent_id) : null;
          if (!categorySlug) return null;
          return { categorySlug, subcategorySlug: row.slug, items: getRowItems(row) };
        })
        .filter((row): row is { categorySlug: string; subcategorySlug: string; items: CatalogItem[] } => row !== null)
    ]
  };
}


async function readCatalogItemsIndexFromDatabase(): Promise<CatalogItemsIndex> {
  if (!getDatabaseUrl()) {
    const normalized = await readCatalogFile();
    return normalized.categories.map(({ id, slug, title, items, subcategories }) => ({
      id,
      slug,
      title,
      items,
      subcategories: subcategories.map(({ id: subcategoryId, slug: subcategorySlug, title: subcategoryTitle, items: subcategoryItems }) => ({
        id: subcategoryId,
        slug: subcategorySlug,
        title: subcategoryTitle,
        items: subcategoryItems
      }))
    }));
  }

  await ensureTable();
  await seedIfEmpty();

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

  for (const row of subcategoryRows) {
    if (!row.parent_id) continue;
    const list = subcategoriesByParent.get(row.parent_id) ?? [];
    list.push({
      id: row.id,
      slug: row.slug,
      title: row.title,
      items: getRowItems(row)
    });
    subcategoriesByParent.set(row.parent_id, list);
  }

  const payload = categoryRows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    items: getRowItems(row),
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

const getCachedAdminPreviewPayloadFromDatabase = unstable_cache(
  async () => instrumentCatalogCacheMiss('getCachedAdminPreviewPayloadFromDatabase', '/admin/kategorije/predogled', () => readAdminPreviewPayloadFromDatabase()),
  ['admin-preview-payload'],
  { tags: [CATALOG_ADMIN_TAG] }
);

const getCachedCatalogCategoryCardsFromDatabase = unstable_cache(
  async () => instrumentCatalogCacheMiss('getCachedCatalogCategoryCardsFromDatabase', 'catalog:category-cards', () => readCatalogCategoryCardsFromDatabase()),
  ['catalog-category-cards'],
  { tags: [CATALOG_PUBLIC_TAG] }
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
    if (includeInactive || includeStatuses) {
      return getCachedCatalogAdminDataFromDatabase();
    }

    return getCachedCatalogDataFromDatabase();
  });
}

export async function getCatalogCategoryCardsFromDatabase(diagnosticsContext = 'catalog:category-cards'): Promise<CatalogCategoryCard[]> {
  return instrumentCatalogLoader('getCatalogCategoryCardsFromDatabase', diagnosticsContext, async () => getCachedCatalogCategoryCardsFromDatabase());
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

  return instrumentCatalogLoader('getCatalogCategoryWithSubcategoriesFromDatabase', diagnosticsContext, async () => getCachedCategory());
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

  return instrumentCatalogLoader('getCatalogSearchIndexFromDatabase', diagnosticsContext, async () => getCachedSearchIndex());
}

export async function getCatalogItemsIndexFromDatabase(diagnosticsContext = 'catalog:items-index'): Promise<CatalogItemsIndex> {
  return instrumentCatalogLoader('getCatalogItemsIndexFromDatabase', diagnosticsContext, async () => getCachedCatalogItemsIndexFromDatabase());
}

export async function getAdminPreviewPayloadFromDatabase(
  diagnosticsContext = '/admin/kategorije/predogled'
): Promise<AdminPreviewPayload> {
  return instrumentCatalogLoader('getAdminPreviewPayloadFromDatabase', diagnosticsContext, async () => getCachedAdminPreviewPayloadFromDatabase());
}

export async function getAdminPreviewLeafItemsFromDatabase(
  nodeId: string,
  diagnosticsContext = '/admin/kategorije/predogled'
): Promise<AdminPreviewLeafItemsPayload | null> {
  const getCachedLeafItems = unstable_cache(
    async () => instrumentCatalogCacheMiss('getCachedAdminPreviewLeafItemsFromDatabase', diagnosticsContext, () => readAdminPreviewLeafItemsFromDatabase(nodeId)),
    ['admin-preview-leaf-items', nodeId],
    { tags: [CATALOG_ADMIN_TAG] }
  );

  return instrumentCatalogLoader('getAdminPreviewLeafItemsFromDatabase', diagnosticsContext, async () => getCachedLeafItems());
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

  if (!getDatabaseUrl()) {
    return normalized;
  }

  await ensureTable();
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
            node.image ?? '',
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
            image = excluded.image,
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
          category.bannerImage ?? null,
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
    revalidateTag(CATALOG_PUBLIC_TAG);
    revalidateTag(CATALOG_ADMIN_TAG);
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }

  return normalized;
}

export async function updateCatalogNode(
  nodeId: string,
  updates: Partial<Pick<AdminPreviewNode, 'title' | 'description' | 'image' | 'status' | 'position' | 'parentId'>>
): Promise<AdminPreviewNode | null> {
  if (!getDatabaseUrl()) {
    return null;
  }

  await ensureTable();
  await seedIfEmpty();

  const pool = await getPool();
  const client = await pool.connect();

  try {
    await client.query('begin');

    const currentResult = await client.query(
      `
        select id, parent_id, slug, title, summary, description, image, position, status
        from catalog_categories
        where id = $1
        limit 1
      `,
      [nodeId]
    );

    const current = currentResult.rows[0] as Pick<CategoryRow, 'id' | 'parent_id' | 'slug' | 'title' | 'summary' | 'description' | 'image' | 'position' | 'status'> | undefined;
    if (!current) {
      await client.query('rollback');
      return null;
    }

    const isCategory = current.parent_id === null;

    await client.query(
      `
        update catalog_categories
        set
          parent_id = $2,
          title = $3,
          summary = $4,
          description = $5,
          image = $6,
          position = $7,
          status = $8,
          updated_at = now()
        where id = $1
      `,
      [
        nodeId,
        updates.parentId === undefined ? current.parent_id : updates.parentId,
        updates.title ?? current.title,
        isCategory ? (updates.description ?? current.summary) : current.summary,
        isCategory ? current.description : (updates.description ?? current.description),
        updates.image ?? current.image,
        updates.position ?? current.position,
        updates.status ?? normalizeStatus(current.status)
      ]
    );

    await client.query('commit');
    revalidateTag(CATALOG_PUBLIC_TAG);
    revalidateTag(CATALOG_ADMIN_TAG);

    const previewPayload = await readAdminPreviewPayloadFromDatabase();
    return previewPayload.nodes.find((node) => node.id === nodeId) ?? null;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
