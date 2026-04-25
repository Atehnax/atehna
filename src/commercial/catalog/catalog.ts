import catalogData from '@/commercial/content/data/catalog.json';
import { sortCatalogItems } from '@/commercial/catalog/catalogUtils';
import type { CatalogCategory, CatalogData, CatalogItem, CatalogSearchItem, CatalogSubcategory } from '@/shared/domain/catalog/catalogTypes';

export {
  formatCatalogPrice,
  getCatalogCategoryItemPrice,
  getCatalogCategoryItemSku,
  getCatalogItemPrice,
  getCatalogItemSku,
  getDiscountedPrice,
  sortCatalogItems
} from '@/commercial/catalog/catalogUtils';

export type { CatalogCategory, CatalogData, CatalogItem, CatalogSearchItem, CatalogSubcategory } from '@/shared/domain/catalog/catalogTypes';

const embeddedCatalogData = catalogData satisfies CatalogData;

export function getCatalog(): CatalogData {
  if (typeof window !== 'undefined') {
    return embeddedCatalogData;
  }

  try {
    const req = eval('require') as NodeRequire;
    const fs = req('fs') as typeof import('fs');
    const path = req('path') as typeof import('path');
    const catalogPath = path.join(process.cwd(), 'src/commercial/content/data/catalog.json');
    const raw = fs.readFileSync(catalogPath, 'utf8');
    return JSON.parse(raw) as CatalogData;
  } catch {
    return embeddedCatalogData;
  }
}

export function getCatalogCategories(): CatalogCategory[] {
  return getCatalog().categories;
}

export function getCatalogCategory(slug: string): CatalogCategory {
  const category = getCatalogCategories().find((item) => item.slug === slug);
  if (!category) {
    throw new Error(`Category not found: ${slug}`);
  }
  return category;
}

export function getCatalogSubcategory(categorySlug: string, subSlug: string): CatalogSubcategory {
  const category = getCatalogCategory(categorySlug);
  const subcategory = category.subcategories.find((item) => item.slug === subSlug);
  if (!subcategory) {
    throw new Error(`Subcategory not found: ${categorySlug}/${subSlug}`);
  }
  return subcategory;
}

export function getCatalogItem(
  categorySlug: string,
  subSlug: string,
  itemSlug: string
): CatalogItem {
  const subcategory = getCatalogSubcategory(categorySlug, subSlug);
  const item = subcategory.items.find((entry) => entry.slug === itemSlug);
  if (!item) {
    throw new Error(`Item not found: ${categorySlug}/${subSlug}/${itemSlug}`);
  }
  return item;
}

export function getCatalogCategorySlugs(): string[] {
  return getCatalogCategories().map((item) => item.slug);
}

export function getCatalogSubcategorySlugs(categorySlug: string): string[] {
  return getCatalogCategory(categorySlug).subcategories.map((item) => item.slug);
}

export function getCatalogItemSlugs(categorySlug: string, subSlug: string): string[] {
  return getCatalogSubcategory(categorySlug, subSlug).items.map((item) => item.slug);
}

export function getCatalogCategoryItemSlugs(categorySlug: string): string[] {
  return getCatalogCategory(categorySlug).items?.map((item) => item.slug) ?? [];
}

export function getCatalogCategoryItem(categorySlug: string, itemSlug: string): CatalogItem {
  const category = getCatalogCategory(categorySlug);
  const item = category.items?.find((entry) => entry.slug === itemSlug);
  if (!item) {
    throw new Error(`Item not found: ${categorySlug}/${itemSlug}`);
  }
  return item;
}

export function getCatalogSearchItems(): CatalogSearchItem[] {
  return getCatalogCategories().flatMap((category) => {
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
