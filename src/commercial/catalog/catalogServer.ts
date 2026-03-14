import type { CatalogCategory, CatalogItem, CatalogSearchItem, CatalogSubcategory } from '@/commercial/catalog/catalog';
import { sortCatalogItems } from '@/commercial/catalog/catalog';
import { getCatalogDataFromDatabase } from '@/shared/server/catalogCategories';

export async function getCatalogCategoriesServer(): Promise<CatalogCategory[]> {
  const catalog = await getCatalogDataFromDatabase();
  return catalog.categories;
}

export async function getCatalogCategoryServer(slug: string): Promise<CatalogCategory> {
  const category = (await getCatalogCategoriesServer()).find((item) => item.slug === slug);
  if (!category) throw new Error(`Category not found: ${slug}`);
  return category;
}

export async function getCatalogSubcategoryServer(categorySlug: string, subSlug: string): Promise<CatalogSubcategory> {
  const category = await getCatalogCategoryServer(categorySlug);
  const subcategory = category.subcategories.find((item) => item.slug === subSlug);
  if (!subcategory) throw new Error(`Subcategory not found: ${categorySlug}/${subSlug}`);
  return subcategory;
}

export async function getCatalogItemServer(
  categorySlug: string,
  subSlug: string,
  itemSlug: string
): Promise<CatalogItem> {
  const subcategory = await getCatalogSubcategoryServer(categorySlug, subSlug);
  const item = subcategory.items.find((entry) => entry.slug === itemSlug);
  if (!item) throw new Error(`Item not found: ${categorySlug}/${subSlug}/${itemSlug}`);
  return item;
}

export async function getCatalogCategoryItemServer(categorySlug: string, itemSlug: string): Promise<CatalogItem> {
  const category = await getCatalogCategoryServer(categorySlug);
  const item = category.items?.find((entry) => entry.slug === itemSlug);
  if (!item) throw new Error(`Item not found: ${categorySlug}/${itemSlug}`);
  return item;
}

export async function getCatalogCategorySlugsServer(): Promise<string[]> {
  return (await getCatalogCategoriesServer()).map((item) => item.slug);
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
  const categories = await getCatalogCategoriesServer();
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
