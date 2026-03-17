import { getPool, getDatabaseUrl } from '@/shared/server/db';
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

function getRowItems(row: CategoryRow): CatalogItem[] {
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

export async function getCatalogDataFromDatabase(
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
  const result = await pool.query(`
    select id, parent_id, slug, title, summary, description, image, admin_notes, banner_image, items, position, status, created_at, updated_at
    from catalog_categories
    ${includeInactive ? '' : "where status = 'active'"}
    order by coalesce(parent_id, ''), position asc, title asc
  `);

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

  return includeStatuses ? payload : { categories: payload.categories };
}

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
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }

  return normalized;
}