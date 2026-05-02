import type {
  CatalogCategory,
  CatalogSubcategory,
  RecursiveCatalogCategory,
  RecursiveCatalogData,
  RecursiveCatalogSubcategory
} from '@/shared/domain/catalog/catalogTypes';

export type {
  RecursiveCatalogCategory,
  RecursiveCatalogData as CatalogData,
  RecursiveCatalogSubcategory
} from '@/shared/domain/catalog/catalogTypes';

function normalizeCatalogImage(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('data:image/') ? '' : trimmed;
}

export function normalizeCatalogData(input: unknown): RecursiveCatalogData {
  const categoriesSource =
    typeof input === 'object' && input !== null && Array.isArray((input as { categories?: unknown }).categories)
      ? (input as { categories: unknown[] }).categories
      : [];

  const categories = categoriesSource
    .map((rawCategory) => normalizeCategory(rawCategory))
    .filter((entry): entry is RecursiveCatalogCategory => entry !== null);

  return { categories };
}

function normalizeCategory(raw: unknown): RecursiveCatalogCategory | null {
  if (typeof raw !== 'object' || raw === null) return null;

  const category = raw as Partial<CatalogCategory> & { subcategories?: unknown[] };
  const slug = typeof category.slug === 'string' ? category.slug.trim() : '';
  if (!slug) return null;

  const categoryId = normalizeNodeId(category.id, `cat-${slug}`);
  const subcategoriesSource = Array.isArray(category.subcategories) ? category.subcategories : [];

  return {
    id: categoryId,
    slug,
    title: typeof category.title === 'string' ? category.title : slug,
    summary: typeof category.summary === 'string' ? category.summary : '',
    description: typeof category.description === 'string' ? category.description : '',
    image: normalizeCatalogImage(category.image),
    adminNotes: typeof category.adminNotes === 'string' ? category.adminNotes : undefined,
    bannerImage: normalizeCatalogImage(category.bannerImage) || undefined,
    subcategories: subcategoriesSource
      .map((rawSubcategory) => normalizeSubcategory(rawSubcategory, categoryId, []))
      .filter((entry): entry is RecursiveCatalogSubcategory => entry !== null),
    items: Array.isArray(category.items) ? category.items : []
  };
}

function normalizeSubcategory(
  raw: unknown,
  categoryId: string,
  parentPath: string[]
): RecursiveCatalogSubcategory | null {
  if (typeof raw !== 'object' || raw === null) return null;

  const subcategory = raw as Partial<CatalogSubcategory> & { subcategories?: unknown[] };
  const slug = typeof subcategory.slug === 'string' ? subcategory.slug.trim() : '';
  if (!slug) return null;

  const currentPath = [...parentPath, slug];
  const childrenSource = Array.isArray(subcategory.subcategories) ? subcategory.subcategories : [];

  return {
    id: normalizeNodeId(subcategory.id, `sub-${categoryId}-${currentPath.join('-')}`),
    slug,
    title: typeof subcategory.title === 'string' ? subcategory.title : slug,
    description: typeof subcategory.description === 'string' ? subcategory.description : '',
    adminNotes: typeof subcategory.adminNotes === 'string' ? subcategory.adminNotes : undefined,
    image: normalizeCatalogImage(subcategory.image),
    items: Array.isArray(subcategory.items) ? subcategory.items : [],
    subcategories: childrenSource
      .map((child) => normalizeSubcategory(child, categoryId, currentPath))
      .filter((entry): entry is RecursiveCatalogSubcategory => entry !== null)
  };
}

function normalizeNodeId(value: unknown, fallbackSeed: string): string {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  return stableIdFromSeed(fallbackSeed);
}

function stableIdFromSeed(seed: string): string {
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return `id-${hash.toString(36)}`;
}
