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

const loadFullCatalogServer = cache(async (): Promise<CatalogCategory[]> => {
  const catalog = await getCatalogDataFromDatabase();
  return catalog.categories;
});

const loadCatalogCategoryCardsServer = cache(async (): Promise<Array<Pick<CatalogCategory, 'slug' | 'title' | 'summary' | 'image'>>> =>
  getCatalogCategoryCardsFromDatabase()
);

const loadCatalogCategorySummariesServer = cache(async (): Promise<Array<Pick<CatalogCategory, 'slug' | 'title'>>> =>
  getCatalogCategorySummariesFromDatabase()
);

const loadCatalogCategoryDetailsServer = cache(async (slug: string): Promise<CatalogCategory | null> => {
  const category = await getCatalogCategoryWithSubcategoriesFromDatabase(slug);
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
    const payload = await getCatalogSubcategoryWithCategoryFromDatabase(categorySlug, subSlug);
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
  return loadFullCatalogServer();
}

export async function getCatalogCategoryCardsServer(): Promise<Array<Pick<CatalogCategory, 'slug' | 'title' | 'summary' | 'image'>>> {
  return loadCatalogCategoryCardsServer();
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
  return (await loadCatalogCategoryCardsServer()).map((item) => item.slug);
}

export async function getCatalogSubcategorySlugsServer(categorySlug: string): Promise<string[]> {
  return (await getCatalogCategoryServer(categorySlug)).subcategories.map((item) => item.slug);
}

export async function getCatalogCategoryItemSlugsServer(categorySlug: string): Promise<string[]> {
  return (await getCatalogCategoryServer(categorySlug)).items?.map((item) => item.slug) ?? [];
}

export async function getCatalogItemSlugsServer(categorySlug: string, subSlug: string): Promise<string[]> {
  return (await getCatalogSubcategoryServer(categorySlug, subSlug)).items.map((item) => item.slug);
}

export async function getCatalogSearchItemsServer(): Promise<CatalogSearchItem[]> {
  return (await loadCatalogHomeDataServer()).searchItems;
}

export async function getCatalogPageDataServer(): Promise<{
  categories: Array<Pick<CatalogCategory, 'slug' | 'title' | 'summary' | 'image'>>;
  searchItems: CatalogSearchItem[];
}> {
  return loadCatalogHomeDataServer();
}

export async function getCatalogCategoryPageDataServer(slug: string): Promise<{
  category: CatalogCategory;
  categories: Array<Pick<CatalogCategory, 'slug' | 'title'>>;
}> {
  return loadCatalogCategoryPageDataServer(slug);
}

export async function getCatalogSubcategoryPageDataServer(categorySlug: string, subSlug: string): Promise<{
  category: Pick<CatalogCategory, 'slug' | 'title'>;
  subcategory: CatalogSubcategory;
}> {
  return loadCatalogSubcategoryPageDataServer(categorySlug, subSlug);
}

export async function getCatalogItemPageDataServer(categorySlug: string, subSlug: string, itemSlug: string): Promise<{
  category: Pick<CatalogCategory, 'slug' | 'title'>;
  subcategory: CatalogSubcategory;
  item: CatalogItem;
}> {
  return loadCatalogItemPageDataServer(categorySlug, subSlug, itemSlug);
}

export async function getCatalogCategoryItemPageDataServer(categorySlug: string, itemSlug: string): Promise<{
  category: CatalogCategory;
  item: CatalogItem;
}> {
  return loadCatalogCategoryItemPageDataServer(categorySlug, itemSlug);
}
