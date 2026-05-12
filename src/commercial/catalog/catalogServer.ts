import { cache } from 'react';
import type { CatalogCategory, CatalogItem, CatalogSearchItem, CatalogSubcategory } from '@/shared/domain/catalog/catalogTypes';
import { catalogCategoryItemHref, catalogSubcategoryItemHref, toPublicCatalogSlug } from '@/commercial/catalog/catalogRoutes';
import { sortCatalogItems } from '@/commercial/catalog/catalogUtils';
import { instrumentCatalogCacheMiss, instrumentCatalogLoader } from '@/shared/server/catalogDiagnostics';
import {
  getCatalogCategoryCardsFromDatabase,
  getCatalogCategoryPageDataFromDatabase,
  getCatalogCategorySummariesFromDatabase,
  getCatalogCategoryWithSubcategoriesFromDatabase,
  getCatalogDataFromDatabase,
  getCatalogItemsIndexFromDatabase,
  getCatalogSearchIndexFromDatabase,
  getCatalogSubcategoryWithCategoryFromDatabase
} from '@/shared/server/catalogCategories';

/**
 * Catalog server loader guidance:
 * - `/` and `/products`: use `getCatalogPageDataServer` / `getCatalogCategoryCardsServer`.
 * - category page: use `getCatalogCategoryPageDataServer`.
 * - subcategory page: use `getCatalogSubcategoryPageDataServer`.
 * - item pages: use `getCatalogItemPageDataServer` or `getCatalogCategoryItemPageDataServer`.
 * - `/admin/kategorije`: use `getCatalogDataFromDatabase({ includeInactive: true, includeStatuses: true })`.
 * - Admin side-data (catalog category pickers, category-linked item overviews): prefer `getCatalogItemsIndexServer`.
 * - Avoid calling internal API routes from server components for catalog reads; import this loader layer directly.
 */

/**
 * Broad full-catalog loader.
 * Expensive compared with the narrow loaders below, so prefer it only for admin/full-tree workflows and slug helpers.
 */
const loadFullCatalogServer = cache(async (): Promise<CatalogCategory[]> =>
  instrumentCatalogCacheMiss('loadFullCatalogServer', 'catalog:full', async () => {
    const catalog = await getCatalogDataFromDatabase({ diagnosticsContext: 'catalog:full' });
    return catalog.categories;
  })
);

const loadCatalogItemsIndexServer = cache(async (diagnosticsContext: string) => getCatalogItemsIndexFromDatabase(diagnosticsContext));

const loadCatalogCategoryCardsServer = cache(async (): Promise<Array<Pick<CatalogCategory, 'slug' | 'title' | 'summary' | 'image'>>> =>
  instrumentCatalogCacheMiss('loadCatalogCategoryCardsServer', '/products', () => getCatalogCategoryCardsFromDatabase('/products'))
);

const loadCatalogCategorySummariesServer = cache(async (): Promise<Array<Pick<CatalogCategory, 'slug' | 'title'>>> =>
  instrumentCatalogCacheMiss('loadCatalogCategorySummariesServer', '/products/[category]', () =>
    getCatalogCategorySummariesFromDatabase('/products/[category]')
  )
);

const loadCatalogCategoryDetailsServer = cache(async (slug: string): Promise<CatalogCategory | null> => {
  const category = await instrumentCatalogCacheMiss('loadCatalogCategoryDetailsServer', '/products/[category]', () =>
    getCatalogCategoryWithSubcategoriesFromDatabase(slug, '/products/[category]')
  );
  if (!category) return null;

  return {
    ...category,
    subcategories: category.subcategories.map((subcategory) => ({ ...subcategory }))
  };
});

const loadCatalogSubcategoryDetailsServer = cache(
  async (
    categorySlug: string,
    subSlug: string
  ): Promise<
    | {
        category: Pick<CatalogCategory, 'slug' | 'title'>;
        subcategory: CatalogSubcategory;
      }
    | null
  > => {
    const payload = await instrumentCatalogCacheMiss('loadCatalogSubcategoryDetailsServer', '/products/[category]/[subcategory]', () =>
      getCatalogSubcategoryWithCategoryFromDatabase(categorySlug, subSlug, '/products/[category]/[subcategory]')
    );
    if (!payload) return null;

    return {
      category: payload.category,
      subcategory: { ...payload.subcategory }
    };
  }
);

const loadCatalogHomeDataServer = cache(async (): Promise<{
  categories: Array<Pick<CatalogCategory, 'slug' | 'title' | 'summary' | 'image'>>;
  searchItems: CatalogSearchItem[];
}> => {
  const payload = await instrumentCatalogCacheMiss('loadCatalogHomeDataServer', '/products', () =>
    getCatalogSearchIndexFromDatabase('/products')
  );

  return {
    categories: payload.categories,
    searchItems: payload.searchItems.flatMap(({ categorySlug, subcategorySlug, items }) =>
      sortCatalogItems(items).map((item) => ({
        name: item.name,
        description: item.description,
        href: subcategorySlug ? catalogSubcategoryItemHref(categorySlug, subcategorySlug, item.slug) : catalogCategoryItemHref(categorySlug, item.slug)
      }))
    )
  };
});

const loadCatalogCategoryPageDataServer = cache(async (slug: string): Promise<{
  category: NonNullable<Awaited<ReturnType<typeof getCatalogCategoryPageDataFromDatabase>>>;
  categories: Array<Pick<CatalogCategory, 'slug' | 'title'>>;
}> => {
  const [category, categories] = await Promise.all([
    getCatalogCategoryPageDataFromDatabase(slug, '/products/[category]'),
    loadCatalogCategorySummariesServer()
  ]);

  if (!category) throw new Error(`Category not found: ${slug}`);

  return { category, categories };
});

const loadCatalogSubcategoryPageDataServer = cache(async (categorySlug: string, subSlug: string): Promise<{
  category: Pick<CatalogCategory, 'slug' | 'title'>;
  subcategory: CatalogSubcategory;
}> => {
  const payload = await loadCatalogSubcategoryDetailsServer(categorySlug, subSlug);
  if (!payload) throw new Error(`Subcategory not found: ${categorySlug}/${subSlug}`);
  return payload;
});

const loadCatalogItemPageDataServer = cache(async (categorySlug: string, subSlug: string, itemSlug: string): Promise<{
  category: Pick<CatalogCategory, 'slug' | 'title'>;
  subcategory: CatalogSubcategory;
  item: CatalogItem;
}> => {
  const payload = await loadCatalogSubcategoryDetailsServer(categorySlug, subSlug);
  if (!payload) throw new Error(`Subcategory not found: ${categorySlug}/${subSlug}`);

  const item = getCatalogItemFromSubcategory(payload.subcategory, categorySlug, subSlug, itemSlug);

  return {
    category: payload.category,
    subcategory: payload.subcategory,
    item
  };
});

const loadCatalogCategoryItemPageDataServer = cache(async (categorySlug: string, itemSlug: string): Promise<{
  category: CatalogCategory;
  item: CatalogItem;
}> => {
  const category = await loadCatalogCategoryDetailsServer(categorySlug);
  if (!category) throw new Error(`Category not found: ${categorySlug}`);

  return {
    category,
    item: getCatalogCategoryItemFromCategory(category, categorySlug, itemSlug)
  };
});

function getCatalogCategoryFromCategories(categories: CatalogCategory[], slug: string): CatalogCategory {
  const routeSlug = toPublicCatalogSlug(slug);
  const category = categories.find((item) => toPublicCatalogSlug(item.slug) === routeSlug);
  if (!category) throw new Error(`Category not found: ${slug}`);
  return category;
}

function getCatalogSubcategoryFromCategory(category: CatalogCategory, categorySlug: string, subSlug: string): CatalogSubcategory {
  const routeSlug = toPublicCatalogSlug(subSlug);
  const subcategory = category.subcategories.find((item) => toPublicCatalogSlug(item.slug) === routeSlug);
  if (!subcategory) throw new Error(`Subcategory not found: ${categorySlug}/${subSlug}`);
  return subcategory;
}

function getCatalogItemFromSubcategory(
  subcategory: CatalogSubcategory,
  categorySlug: string,
  subSlug: string,
  itemSlug: string
): CatalogItem {
  const routeSlug = toPublicCatalogSlug(itemSlug);
  const item = subcategory.items.find((entry) => toPublicCatalogSlug(entry.slug) === routeSlug);
  if (!item) throw new Error(`Item not found: ${categorySlug}/${subSlug}/${itemSlug}`);
  return item;
}

function getCatalogCategoryItemFromCategory(category: CatalogCategory, categorySlug: string, itemSlug: string): CatalogItem {
  const routeSlug = toPublicCatalogSlug(itemSlug);
  const item = category.items?.find((entry) => toPublicCatalogSlug(entry.slug) === routeSlug);
  if (!item) throw new Error(`Item not found: ${categorySlug}/${itemSlug}`);
  return item;
}

async function resolveCatalogCategorySlug(categorySlug: string): Promise<string> {
  return getCatalogCategoryFromCategories(await loadFullCatalogServer(), categorySlug).slug;
}

async function resolveCatalogSubcategoryPath(categorySlug: string, subSlug: string): Promise<{ categorySlug: string; subSlug: string }> {
  const category = getCatalogCategoryFromCategories(await loadFullCatalogServer(), categorySlug);
  const subcategory = getCatalogSubcategoryFromCategory(category, category.slug, subSlug);

  return {
    categorySlug: category.slug,
    subSlug: subcategory.slug
  };
}

async function resolveCatalogItemPath(
  categorySlug: string,
  subSlug: string,
  itemSlug: string
): Promise<{ categorySlug: string; subSlug: string; itemSlug: string }> {
  const category = getCatalogCategoryFromCategories(await loadFullCatalogServer(), categorySlug);
  const subcategory = getCatalogSubcategoryFromCategory(category, category.slug, subSlug);
  const item = getCatalogItemFromSubcategory(subcategory, category.slug, subcategory.slug, itemSlug);

  return {
    categorySlug: category.slug,
    subSlug: subcategory.slug,
    itemSlug: item.slug
  };
}

async function resolveCatalogCategoryItemPath(categorySlug: string, itemSlug: string): Promise<{ categorySlug: string; itemSlug: string }> {
  const category = getCatalogCategoryFromCategories(await loadFullCatalogServer(), categorySlug);
  const item = getCatalogCategoryItemFromCategory(category, category.slug, itemSlug);

  return {
    categorySlug: category.slug,
    itemSlug: item.slug
  };
}

export async function getCatalogCategoriesServer(): Promise<CatalogCategory[]> {
  return instrumentCatalogLoader('getCatalogCategoriesServer', 'catalog:categories', () => loadFullCatalogServer());
}

export async function getCatalogItemsIndexServer(diagnosticsContext = 'catalog:items-index') {
  return instrumentCatalogLoader('getCatalogItemsIndexServer', diagnosticsContext, () => loadCatalogItemsIndexServer(diagnosticsContext));
}

export async function getCatalogCategoryCardsServer(): Promise<Array<Pick<CatalogCategory, 'slug' | 'title' | 'summary' | 'image'>>> {
  return instrumentCatalogLoader('getCatalogCategoryCardsServer', '/products', () => loadCatalogCategoryCardsServer());
}

export async function getCatalogCategoryServer(slug: string): Promise<CatalogCategory> {
  return instrumentCatalogLoader('getCatalogCategoryServer', '/products/[category]', async () =>
    getCatalogCategoryFromCategories(await loadFullCatalogServer(), slug)
  );
}

export async function getCatalogSubcategoryServer(categorySlug: string, subSlug: string): Promise<CatalogSubcategory> {
  return instrumentCatalogLoader('getCatalogSubcategoryServer', '/products/[category]/[subcategory]', async () => {
    const category = getCatalogCategoryFromCategories(await loadFullCatalogServer(), categorySlug);
    return getCatalogSubcategoryFromCategory(category, category.slug, subSlug);
  });
}

export async function getCatalogItemServer(
  categorySlug: string,
  subSlug: string,
  itemSlug: string
): Promise<CatalogItem> {
  return instrumentCatalogLoader('getCatalogItemServer', '/products/[category]/[subcategory]/[item]', async () => {
    const category = getCatalogCategoryFromCategories(await loadFullCatalogServer(), categorySlug);
    const subcategory = getCatalogSubcategoryFromCategory(category, category.slug, subSlug);
    return getCatalogItemFromSubcategory(subcategory, category.slug, subcategory.slug, itemSlug);
  });
}

export async function getCatalogCategoryItemServer(categorySlug: string, itemSlug: string): Promise<CatalogItem> {
  return instrumentCatalogLoader('getCatalogCategoryItemServer', '/products/[category]/items/[item]', async () => {
    const category = getCatalogCategoryFromCategories(await loadFullCatalogServer(), categorySlug);
    return getCatalogCategoryItemFromCategory(category, category.slug, itemSlug);
  });
}

export async function getCatalogCategorySlugsServer(): Promise<string[]> {
  return instrumentCatalogLoader('getCatalogCategorySlugsServer', '/products/[category]', async () =>
    (await loadCatalogCategoryCardsServer()).map((item) => toPublicCatalogSlug(item.slug))
  );
}

export async function getCatalogSubcategorySlugsServer(categorySlug: string): Promise<string[]> {
  return instrumentCatalogLoader('getCatalogSubcategorySlugsServer', '/products/[category]/[subcategory]', async () => {
    const category = getCatalogCategoryFromCategories(await loadFullCatalogServer(), categorySlug);
    return category.subcategories.map((item) => toPublicCatalogSlug(item.slug));
  });
}

export async function getCatalogCategoryItemSlugsServer(categorySlug: string): Promise<string[]> {
  return instrumentCatalogLoader('getCatalogCategoryItemSlugsServer', '/products/[category]/items/[item]', async () => {
    const category = getCatalogCategoryFromCategories(await loadFullCatalogServer(), categorySlug);
    return category.items?.map((item) => toPublicCatalogSlug(item.slug)) ?? [];
  });
}

export async function getCatalogItemSlugsServer(categorySlug: string, subSlug: string): Promise<string[]> {
  return instrumentCatalogLoader('getCatalogItemSlugsServer', '/products/[category]/[subcategory]/[item]', async () => {
    const category = getCatalogCategoryFromCategories(await loadFullCatalogServer(), categorySlug);
    const subcategory = getCatalogSubcategoryFromCategory(category, category.slug, subSlug);
    return subcategory.items.map((item) => toPublicCatalogSlug(item.slug));
  });
}

export async function getCatalogSearchItemsServer(): Promise<CatalogSearchItem[]> {
  return instrumentCatalogLoader('getCatalogSearchItemsServer', '/products', async () => (await loadCatalogHomeDataServer()).searchItems);
}

export async function getCatalogPageDataServer(): Promise<{
  categories: Array<Pick<CatalogCategory, 'slug' | 'title' | 'summary' | 'image'>>;
  searchItems: CatalogSearchItem[];
}> {
  return instrumentCatalogLoader('getCatalogPageDataServer', '/products', () => loadCatalogHomeDataServer());
}

export async function getCatalogCategoryPageDataServer(slug: string): Promise<{
  category: NonNullable<Awaited<ReturnType<typeof getCatalogCategoryPageDataFromDatabase>>>;
  categories: Array<Pick<CatalogCategory, 'slug' | 'title'>>;
}> {
  const categorySlug = await resolveCatalogCategorySlug(slug);
  return instrumentCatalogLoader('getCatalogCategoryPageDataServer', '/products/[category]', () => loadCatalogCategoryPageDataServer(categorySlug));
}

export async function getCatalogSubcategoryPageDataServer(categorySlug: string, subSlug: string): Promise<{
  category: Pick<CatalogCategory, 'slug' | 'title'>;
  subcategory: CatalogSubcategory;
}> {
  const resolved = await resolveCatalogSubcategoryPath(categorySlug, subSlug);
  return instrumentCatalogLoader('getCatalogSubcategoryPageDataServer', '/products/[category]/[subcategory]', () =>
    loadCatalogSubcategoryPageDataServer(resolved.categorySlug, resolved.subSlug)
  );
}

export async function getCatalogItemPageDataServer(categorySlug: string, subSlug: string, itemSlug: string): Promise<{
  category: Pick<CatalogCategory, 'slug' | 'title'>;
  subcategory: CatalogSubcategory;
  item: CatalogItem;
}> {
  const resolved = await resolveCatalogItemPath(categorySlug, subSlug, itemSlug);
  return instrumentCatalogLoader('getCatalogItemPageDataServer', '/products/[category]/[subcategory]/[item]', () =>
    loadCatalogItemPageDataServer(resolved.categorySlug, resolved.subSlug, resolved.itemSlug)
  );
}

export async function getCatalogCategoryItemPageDataServer(categorySlug: string, itemSlug: string): Promise<{
  category: CatalogCategory;
  item: CatalogItem;
}> {
  const resolved = await resolveCatalogCategoryItemPath(categorySlug, itemSlug);
  return instrumentCatalogLoader('getCatalogCategoryItemPageDataServer', '/products/[category]/items/[item]', () =>
    loadCatalogCategoryItemPageDataServer(resolved.categorySlug, resolved.itemSlug)
  );
}
