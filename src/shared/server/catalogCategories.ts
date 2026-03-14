import { getPool, getDatabaseUrl } from '@/shared/server/db';
import type { CatalogCategory } from '@/commercial/catalog/catalog';
import { normalizeCatalogData, readCatalogFile } from '@/shared/server/catalogAdmin';

type CatalogData = { categories: CatalogCategory[] };

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

  const fromFile = normalizeCatalogData(await readCatalogFile());
  await replaceCategoryTree(fromFile);
  seeded = true;
}

function rowToCategory(row: CategoryRow): CatalogCategory {
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
    items: Array.isArray(row.items) ? row.items : []
  };
}

export async function getCatalogDataFromDatabase(): Promise<CatalogData> {
  if (!getDatabaseUrl()) {
    return normalizeCatalogData(await readCatalogFile());
  }

  await ensureTable();
  await seedIfEmpty();

  const pool = await getPool();
  const result = await pool.query(`
    select id, parent_id, slug, title, summary, description, image, admin_notes, banner_image, items, position, status
    from catalog_categories
    where status = 'active'
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

  return {
    categories: topLevel.map((row) => {
      const category = rowToCategory(row);
      const children = (childrenByParent.get(row.id) ?? []).map((child) => ({
        id: child.id,
        slug: child.slug,
        title: child.title,
        description: child.description,
        adminNotes: child.admin_notes ?? undefined,
        image: child.image,
        items: Array.isArray(child.items) ? child.items : []
      }));
      category.subcategories = children;
      return category;
    })
  };
}

export async function replaceCategoryTree(input: unknown): Promise<CatalogData> {
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

    for (const [categoryIndex, category] of normalized.categories.entries()) {
      idsToKeep.push(category.id);
      await client.query(
        `
          insert into catalog_categories
            (id, parent_id, slug, title, summary, description, image, admin_notes, banner_image, items, position, status, updated_at)
          values
            ($1, null, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, 'active', now())
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
            status = 'active',
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
          categoryIndex
        ]
      );

      for (const [subcategoryIndex, subcategory] of category.subcategories.entries()) {
        idsToKeep.push(subcategory.id);
        await client.query(
          `
            insert into catalog_categories
              (id, parent_id, slug, title, summary, description, image, admin_notes, banner_image, items, position, status, updated_at)
            values
              ($1, $2, $3, $4, '', $5, $6, $7, null, $8::jsonb, $9, 'active', now())
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
              status = 'active',
              updated_at = now()
          `,
          [
            subcategory.id,
            category.id,
            subcategory.slug,
            subcategory.title,
            subcategory.description,
            subcategory.image ?? '',
            subcategory.adminNotes ?? null,
            JSON.stringify(Array.isArray(subcategory.items) ? subcategory.items : []),
            subcategoryIndex
          ]
        );
      }
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
