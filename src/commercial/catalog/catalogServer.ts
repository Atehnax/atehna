import { cache } from 'react';
import type { CatalogCategory, CatalogItem, CatalogSearchItem, CatalogSubcategory } from '@/commercial/catalog/catalog';
import { sortCatalogItems } from '@/commercial/catalog/catalog';
import {
  getCatalogCategoryCardsFromDatabase,
  getCatalogCategorySummariesFromDatabase,
  getCatalogCategoryWithSubcategoriesFromDatabase,
  getCatalogDataFromDatabase,
  getCatalogSearchIndexFromDatabase,
  getCatalogSubcategoryWithCategoryFromDatabase
} from '@/shared/server/catalogCategories';

const loadFullCatalogCachedServer = cache(async (): Promise<CatalogCategory[]> => {
  const catalog = await getCatalogDataFromDatabase();
  return catalog.categories;
});

const loadCatalogCategoryCardsCachedServer = cache(async (): Promise<Array<Pick<CatalogCategory, 'slug' | 'title' | 'summary' | 'image'>>> =>
  getCatalogCategoryCardsFromDatabase()
);

const loadCatalogCategorySummariesCachedServer = cache(async (): Promise<Array<Pick<CatalogCategory, 'slug' | 'title'>>> =>
  getCatalogCategorySummariesFromDatabase()
);

const loadCatalogCategoryDetailsCachedServer = cache(async (slug: string): Promise<CatalogCategory | null> => {
  const category = await getCatalogCategoryWithSubcategoriesFromDatabase(slug);
  if (!category) return null;

  return {
    ...category,
    subcategories: category.subcategories.map((subcategory) => ({ ...subcategory }))
  };
});

const loadCatalogSubcategoryDetailsCachedServer = cache(
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
    const payload = await getCatalogSubcategoryWithCategoryFromDatabase(categorySlug, subSlug);
    if (!payload) return null;

    return {
      category: payload.category,
      subcategory: { ...payload.subcategory }
    };
  }
);

const loadCatalogHomeDataCachedServer = cache(async (): Promise<{
  categories: Array<Pick<CatalogCategory, 'slug' | 'title' | 'summary' | 'image'>>;
  searchItems: CatalogSearchItem[];
}> => {
  const payload = await getCatalogSearchIndexFromDatabase();

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

const loadCatalogCategoryPageDataCachedServer = cache(async (slug: string): Promise<{
  category: CatalogCategory;
  categories: Array<Pick<CatalogCategory, 'slug' | 'title'>>;
}> => {
  const [category, categories] = await Promise.all([
    loadCatalogCategoryDetailsCachedServer(slug),
    loadCatalogCategorySummariesCachedServer()
  ]);

  if (!category) throw new Error(`Category not found: ${slug}`);

  return { category, categories };
});

const loadCatalogSubcategoryPageDataCachedServer = cache(async (categorySlug: string, subSlug: string): Promise<{
  category: Pick<CatalogCategory, 'slug' | 'title'>;
  subcategory: CatalogSubcategory;
}> => {
  const payload = await loadCatalogSubcategoryDetailsCachedServer(categorySlug, subSlug);
  if (!payload) throw new Error(`Subcategory not found: ${categorySlug}/${subSlug}`);
  return payload;
});

const loadCatalogItemPageDataCachedServer = cache(async (categorySlug: string, subSlug: string, itemSlug: string): Promise<{
  category: Pick<CatalogCategory, 'slug' | 'title'>;
  subcategory: CatalogSubcategory;
  item: CatalogItem;
}> => {
  const payload = await loadCatalogSubcategoryDetailsCachedServer(categorySlug, subSlug);
  if (!payload) throw new Error(`Subcategory not found: ${categorySlug}/${subSlug}`);

  const item = payload.subcategory.items.find((entry) => entry.slug === itemSlug);
  if (!item) throw new Error(`Item not found: ${categorySlug}/${subSlug}/${itemSlug}`);

  return {
    category: payload.category,
    subcategory: payload.subcategory,
    item
  };
});

const loadCatalogCategoryItemPageDataCachedServer = cache(async (categorySlug: string, itemSlug: string): Promise<{
  category: CatalogCategory;
  item: CatalogItem;
}> => {
  const category = await loadCatalogCategoryDetailsCachedServer(categorySlug);
  if (!category) throw new Error(`Category not found: ${categorySlug}`);

  const item = category.items?.find((entry) => entry.slug === itemSlug);
  if (!item) throw new Error(`Item not found: ${categorySlug}/${itemSlug}`);

  return { category, item };
});

export async function getCatalogCategoriesServer(): Promise<CatalogCategory[]> {
  return loadFullCatalogCachedServer();
}

export async function getCatalogCategoryCardsServer(): Promise<Array<Pick<CatalogCategory, 'slug' | 'title' | 'summary' | 'image'>>> {
  return loadCatalogCategoryCardsCachedServer();
}

export async function getCatalogCategoryServer(slug: string): Promise<CatalogCategory> {
  return (await loadCatalogCategoryPageDataCachedServer(slug)).category;
}

export async function getCatalogSubcategoryServer(categorySlug: string, subSlug: string): Promise<CatalogSubcategory> {
  return (await loadCatalogSubcategoryPageDataCachedServer(categorySlug, subSlug)).subcategory;
}

function getCatalogItemFromSubcategory(
  subcategory: CatalogSubcategory,
  categorySlug: string,
  subSlug: string,
  itemSlug: string
): Promise<CatalogItem> {
  return (await loadCatalogItemPageDataCachedServer(categorySlug, subSlug, itemSlug)).item;
}

export async function getCatalogCategoryItemServer(categorySlug: string, itemSlug: string): Promise<CatalogItem> {
  return (await loadCatalogCategoryItemPageDataCachedServer(categorySlug, itemSlug)).item;
}

export async function getCatalogCategoriesServer(): Promise<CatalogCategory[]> {
  return loadFullCatalogServer();
}

export async function getCatalogCategoryServer(slug: string): Promise<CatalogCategory> {
  return getCatalogCategoryFromCategories(await loadFullCatalogServer(), slug);
}

export async function getCatalogSubcategoryServer(categorySlug: string, subSlug: string): Promise<CatalogSubcategory> {
  const category = getCatalogCategoryFromCategories(await loadFullCatalogServer(), categorySlug);
  return getCatalogSubcategoryFromCategory(category, categorySlug, subSlug);
}

export async function getCatalogItemServer(
  categorySlug: string,
  subSlug: string,
  itemSlug: string
): Promise<CatalogItem> {
  const category = getCatalogCategoryFromCategories(await loadFullCatalogServer(), categorySlug);
  const subcategory = getCatalogSubcategoryFromCategory(category, categorySlug, subSlug);
  return getCatalogItemFromSubcategory(subcategory, categorySlug, subSlug, itemSlug);
}

export async function getCatalogCategoryItemServer(categorySlug: string, itemSlug: string): Promise<CatalogItem> {
  const category = getCatalogCategoryFromCategories(await loadFullCatalogServer(), categorySlug);
  return getCatalogCategoryItemFromCategory(category, categorySlug, itemSlug);
}

export async function getCatalogCategorySlugsServer(): Promise<string[]> {
  return (await loadCatalogCategoryCardsCachedServer()).map((item) => item.slug);
}

export async function getCatalogSubcategorySlugsServer(categorySlug: string): Promise<string[]> {
  return (await loadCatalogCategoryPageDataCachedServer(categorySlug)).category.subcategories.map((item) => item.slug);
}

export async function getCatalogCategoryItemSlugsServer(categorySlug: string): Promise<string[]> {
  return (await loadCatalogCategoryPageDataCachedServer(categorySlug)).category.items?.map((item) => item.slug) ?? [];
}

export async function getCatalogItemSlugsServer(categorySlug: string, subSlug: string): Promise<string[]> {
  return (await loadCatalogSubcategoryPageDataCachedServer(categorySlug, subSlug)).subcategory.items.map((item) => item.slug);
}

export async function getCatalogSearchItemsServer(): Promise<CatalogSearchItem[]> {
  return (await loadCatalogHomeDataCachedServer()).searchItems;
}

export async function getCatalogPageDataServer(): Promise<{
  categories: Array<Pick<CatalogCategory, 'slug' | 'title' | 'summary' | 'image'>>;
  searchItems: CatalogSearchItem[];
}> {
  return loadCatalogHomeDataCachedServer();
}

export async function getCatalogCategoryPageDataServer(slug: string): Promise<{
  category: CatalogCategory;
  categories: Array<Pick<CatalogCategory, 'slug' | 'title'>>;
}> {
  return loadCatalogCategoryPageDataCachedServer(slug);
}

export async function getCatalogSubcategoryPageDataServer(categorySlug: string, subSlug: string): Promise<{
  category: Pick<CatalogCategory, 'slug' | 'title'>;
  subcategory: CatalogSubcategory;
}> {
  return loadCatalogSubcategoryPageDataCachedServer(categorySlug, subSlug);
}

export async function getCatalogItemPageDataServer(categorySlug: string, subSlug: string, itemSlug: string): Promise<{
  category: Pick<CatalogCategory, 'slug' | 'title'>;
  subcategory: CatalogSubcategory;
  item: CatalogItem;
}> {
  return loadCatalogItemPageDataCachedServer(categorySlug, subSlug, itemSlug);
}

export async function getCatalogCategoryItemPageDataServer(categorySlug: string, itemSlug: string): Promise<{
  category: CatalogCategory;
  item: CatalogItem;
}> {
  return loadCatalogCategoryItemPageDataCachedServer(categorySlug, itemSlug);
}
