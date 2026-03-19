import { cache } from 'react';
import type { CatalogCategory, CatalogItem, CatalogSearchItem, CatalogSubcategory } from '@/commercial/catalog/catalog';
import { sortCatalogItems } from '@/commercial/catalog/catalog';
import { getCatalogDataFromDatabase } from '@/shared/server/catalogCategories';

const loadFullCatalogServer = cache(async (): Promise<CatalogCategory[]> => {
  const catalog = await getCatalogDataFromDatabase();
  return catalog.categories;
});

function getCatalogSearchItemsFromCategories(categories: CatalogCategory[]): CatalogSearchItem[] {
  return categories.flatMap((category) => {
    const categoryItems = sortCatalogItems(category.items ?? []);
    const directItems = categoryItems.map((item) => ({
      name: item.name,
      description: item.description,
      href: `/products/${category.slug}/items/${item.slug}`
    }));

    const subcategoryItems = category.subcategories.flatMap((subcategory) =>
      sortCatalogItems(subcategory.items).map((item) => ({
        name: item.name,
        description: item.description,
        href: `/products/${category.slug}/${subcategory.slug}/${item.slug}`
      }))
    );

    return [...directItems, ...subcategoryItems];
  });
}

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
  return (await loadFullCatalogServer()).map((item) => item.slug);
}

export async function getCatalogSubcategorySlugsServer(categorySlug: string): Promise<string[]> {
  const category = getCatalogCategoryFromCategories(await loadFullCatalogServer(), categorySlug);
  return category.subcategories.map((item) => item.slug);
}

export async function getCatalogCategoryItemSlugsServer(categorySlug: string): Promise<string[]> {
  const category = getCatalogCategoryFromCategories(await loadFullCatalogServer(), categorySlug);
  return category.items?.map((item) => item.slug) ?? [];
}

export async function getCatalogItemSlugsServer(categorySlug: string, subSlug: string): Promise<string[]> {
  const category = getCatalogCategoryFromCategories(await loadFullCatalogServer(), categorySlug);
  const subcategory = getCatalogSubcategoryFromCategory(category, categorySlug, subSlug);
  return subcategory.items.map((item) => item.slug);
}

export async function getCatalogSearchItemsServer(): Promise<CatalogSearchItem[]> {
  return getCatalogSearchItemsFromCategories(await loadFullCatalogServer());
}

export async function getCatalogPageDataServer(): Promise<{
  categories: CatalogCategory[];
  searchItems: CatalogSearchItem[];
}> {
  const categories = await loadFullCatalogServer();

  return {
    categories,
    searchItems: getCatalogSearchItemsFromCategories(categories)
  };
}
