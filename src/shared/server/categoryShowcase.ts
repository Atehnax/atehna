import { unstable_cache } from 'next/cache';
import type { CategoryStatus } from '@/shared/domain/catalog/catalogTypes';
import {
  normalizeCategoryShowcaseMediaSettings,
  resolveCategoryShowcaseImage,
  type CategoryShowcaseMediaSettings
} from '@/shared/features/category-showcase/categoryShowcaseSchema';
import { CATEGORY_SHOWCASE_TAG } from '@/shared/server/catalogCache';
import { instrumentCatalogCacheMiss, instrumentCatalogLoader } from '@/shared/server/catalogDiagnostics';
import { getPool } from '@/shared/server/db';

export type StoredCategoryShowcaseItem = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  image: string;
  presentation: CategoryShowcaseMediaSettings;
  position: number;
  status: CategoryStatus;
  revision: string;
};

type CategoryShowcaseRow = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  image: string;
  presentation_json: unknown;
  position: number;
  status: string;
  revision: string;
};

function normalizeStoredImage(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('data:image/')) return '';
  return trimmed;
}

async function readCategoryShowcaseItemsFromDatabase(): Promise<StoredCategoryShowcaseItem[]> {
  const pool = await getPool();
  const result = await pool.query(`
    select id, slug, title, summary, description, image, presentation_json, position, status,
           md5(coalesce(image, '') || '|' || coalesce(presentation_json::text, '{}')) as revision
    from catalog_categories
    where parent_id is null
    order by position asc, title asc
  `);

  return (result.rows as CategoryShowcaseRow[]).map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    description: row.description,
    image: resolveCategoryShowcaseImage(normalizeStoredImage(row.image), row.slug),
    presentation: normalizeCategoryShowcaseMediaSettings(row.presentation_json),
    position: row.position,
    status: row.status === 'inactive' ? 'inactive' : 'active',
    revision: row.revision
  }));
}

/**
 * One canonical cached read for category-showcase media and presentation data.
 * It deliberately includes inactive top-level categories: public consumers
 * filter them out, while admin consumers can preserve their status-aware view
 * without creating a second presentation cache.
 */
const getCachedCategoryShowcaseItemsFromDatabase = unstable_cache(
  async () => instrumentCatalogCacheMiss(
    'getCachedCategoryShowcaseItemsFromDatabase',
    'category-showcase:shared',
    readCategoryShowcaseItemsFromDatabase
  ),
  ['category-showcase-shared-v2'],
  { tags: [CATEGORY_SHOWCASE_TAG] }
);

export async function getCategoryShowcaseItemsFromDatabase(
  diagnosticsContext = 'category-showcase:shared'
): Promise<StoredCategoryShowcaseItem[]> {
  return instrumentCatalogLoader(
    'getCategoryShowcaseItemsFromDatabase',
    diagnosticsContext,
    getCachedCategoryShowcaseItemsFromDatabase
  );
}
