import { cache } from 'react';
import type { CatalogCategory, CatalogItem, CatalogSearchItem, CatalogSubcategory } from '@/commercial/catalog/catalog';
import { sortCatalogItems } from '@/commercial/catalog/catalog';
import { instrumentCatalogCacheMiss, instrumentCatalogLoader } from '@/shared/server/catalogDiagnostics';
import {
  getCatalogCategoryCardsFromDatabase,
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
 * - Admin side-data (catalog item pickers, article seed lists): prefer `getCatalogItemsIndexServer`.
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

const loadCatalogItemsIndexServer = cache(async (diagnosticsContext: string) =>
  instrumentCatalogCacheMiss('loadCatalogItemsIndexServer', diagnosticsContext, () =>
    getCatalogItemsIndexFromDatabase(diagnosticsContext)
  )
);

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
        href: subcategorySlug
          ? `/products/${categorySlug}/${subcategorySlug}/${item.slug}`
          : `/products/${categorySlug}/items/${item.slug}`
      }))
    )
  };
});

const loadCatalogCategoryPageDataServer = cache(async (slug: string): Promise<{
  category: CatalogCategory;
  categories: Array<Pick<CatalogCategory, 'slug' | 'title'>>;
}> => {
  const [category, categories] = await Promise.all([
    loadCatalogCategoryDetailsServer(slug),
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
  const category = categories.find((item) => item.slug === slug);
  if (!category) throw new Error(`Category not found: ${slug}`);
  return category;
}

function getCatalogSubcategoryFromCategory(category: CatalogCategory, categorySlug: string, subSlug: string): CatalogSubcategory {
  const subcategory = category.subcategories.find((item) => item.slug === subSlug);
  if (!subcategory) throw new Error(`Subcategory not found: ${categorySlug}/${subSlug}`);
  return subcategory;
}

function getCatalogItemFromSubcategory(
  subcategory: CatalogSubcategory,
  categorySlug: string,
  subSlug: string,
  itemSlug: string
): CatalogItem {
  const item = subcategory.items.find((entry) => entry.slug === itemSlug);
  if (!item) throw new Error(`Item not found: ${categorySlug}/${subSlug}/${itemSlug}`);
  return item;
}

function getCatalogCategoryItemFromCategory(category: CatalogCategory, categorySlug: string, itemSlug: string): CatalogItem {
  const item = category.items?.find((entry) => entry.slug === itemSlug);
  if (!item) throw new Error(`Item not found: ${categorySlug}/${itemSlug}`);
  return item;
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
    return getCatalogSubcategoryFromCategory(category, categorySlug, subSlug);
  });
}

export async function getCatalogItemServer(
  categorySlug: string,
  subSlug: string,
  itemSlug: string
): Promise<CatalogItem> {
  return instrumentCatalogLoader('getCatalogItemServer', '/products/[category]/[subcategory]/[item]', async () => {
    const category = getCatalogCategoryFromCategories(await loadFullCatalogServer(), categorySlug);
    const subcategory = getCatalogSubcategoryFromCategory(category, categorySlug, subSlug);
    return getCatalogItemFromSubcategory(subcategory, categorySlug, subSlug, itemSlug);
  });
}

export async function getCatalogCategoryItemServer(categorySlug: string, itemSlug: string): Promise<CatalogItem> {
  return instrumentCatalogLoader('getCatalogCategoryItemServer', '/products/[category]/items/[item]', async () => {
    const category = getCatalogCategoryFromCategories(await loadFullCatalogServer(), categorySlug);
    return getCatalogCategoryItemFromCategory(category, categorySlug, itemSlug);
  });
}

export async function getCatalogCategorySlugsServer(): Promise<string[]> {
  return instrumentCatalogLoader('getCatalogCategorySlugsServer', '/products/[category]', async () =>
    (await loadCatalogCategoryCardsServer()).map((item) => item.slug)
  );
}

export async function getCatalogSubcategorySlugsServer(categorySlug: string): Promise<string[]> {
  return instrumentCatalogLoader('getCatalogSubcategorySlugsServer', '/products/[category]/[subcategory]', async () => {
    const category = getCatalogCategoryFromCategories(await loadFullCatalogServer(), categorySlug);
    return category.subcategories.map((item) => item.slug);
  });
}

export async function getCatalogCategoryItemSlugsServer(categorySlug: string): Promise<string[]> {
  return instrumentCatalogLoader('getCatalogCategoryItemSlugsServer', '/products/[category]/items/[item]', async () => {
    const category = getCatalogCategoryFromCategories(await loadFullCatalogServer(), categorySlug);
    return category.items?.map((item) => item.slug) ?? [];
  });
}

export async function getCatalogItemSlugsServer(categorySlug: string, subSlug: string): Promise<string[]> {
  return instrumentCatalogLoader('getCatalogItemSlugsServer', '/products/[category]/[subcategory]/[item]', async () => {
    const category = getCatalogCategoryFromCategories(await loadFullCatalogServer(), categorySlug);
    const subcategory = getCatalogSubcategoryFromCategory(category, categorySlug, subSlug);
    return subcategory.items.map((item) => item.slug);
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
  category: CatalogCategory;
  categories: Array<Pick<CatalogCategory, 'slug' | 'title'>>;
}> {
  return instrumentCatalogLoader('getCatalogCategoryPageDataServer', '/products/[category]', () => loadCatalogCategoryPageDataServer(slug));
}

export async function getCatalogSubcategoryPageDataServer(categorySlug: string, subSlug: string): Promise<{
  category: Pick<CatalogCategory, 'slug' | 'title'>;
  subcategory: CatalogSubcategory;
}> {
  return instrumentCatalogLoader('getCatalogSubcategoryPageDataServer', '/products/[category]/[subcategory]', () =>
    loadCatalogSubcategoryPageDataServer(categorySlug, subSlug)
  );
}

export async function getCatalogItemPageDataServer(categorySlug: string, subSlug: string, itemSlug: string): Promise<{
  category: Pick<CatalogCategory, 'slug' | 'title'>;
  subcategory: CatalogSubcategory;
  item: CatalogItem;
}> {
  return instrumentCatalogLoader('getCatalogItemPageDataServer', '/products/[category]/[subcategory]/[item]', () =>
    loadCatalogItemPageDataServer(categorySlug, subSlug, itemSlug)
  );
}

export async function getCatalogCategoryItemPageDataServer(categorySlug: string, itemSlug: string): Promise<{
  category: CatalogCategory;
  item: CatalogItem;
}> {
  return instrumentCatalogLoader('getCatalogCategoryItemPageDataServer', '/products/[category]/items/[item]', () =>
    loadCatalogCategoryItemPageDataServer(categorySlug, itemSlug)
  );
}
