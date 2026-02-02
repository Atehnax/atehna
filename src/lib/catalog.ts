import fs from 'fs';
import path from 'path';

export type CatalogItem = {
  slug: string;
  name: string;
  description: string;
  image?: string;
  price?: number;
};

export type CatalogSubcategory = {
  slug: string;
  title: string;
  description: string;
  items: CatalogItem[];
};

export type CatalogCategory = {
  slug: string;
  title: string;
  summary: string;
  description: string;
  image: string;
  subcategories: CatalogSubcategory[];
  items?: CatalogItem[];
};

export type CatalogSearchItem = {
  name: string;
  description: string;
  href: string;
};

type CatalogData = {
  categories: CatalogCategory[];
};

const catalogPath = path.join(process.cwd(), 'content', 'catalog.json');
let cachedCatalog: CatalogData | null = null;

export function getCatalog(): CatalogData {
  if (cachedCatalog) {
    return cachedCatalog;
  }
  const raw = fs.readFileSync(catalogPath, 'utf8');
  cachedCatalog = JSON.parse(raw) as CatalogData;
  return cachedCatalog;
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

export function getCatalogItemSku(
  categorySlug: string,
  subSlug: string,
  itemSlug: string
): string {
  return `${categorySlug}-${subSlug}-${itemSlug}`;
}

export function getCatalogCategoryItemSku(categorySlug: string, itemSlug: string): string {
  return `${categorySlug}-${itemSlug}`;
}

export function getCatalogItemPrice(
  categorySlug: string,
  subSlug: string,
  itemSlug: string
): number {
  const seed = `${categorySlug}-${subSlug}-${itemSlug}`;
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) % 1000;
  }
  return Number((4 + (hash % 80) / 10).toFixed(2));
}

export function getCatalogCategoryItemPrice(categorySlug: string, itemSlug: string): number {
  const seed = `${categorySlug}-${itemSlug}`;
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) % 1000;
  }
  return Number((4 + (hash % 80) / 10).toFixed(2));
}

export function formatCatalogPrice(price: number): string {
  return new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR' }).format(price);
}

export function getCatalogSearchItems(): CatalogSearchItem[] {
  return getCatalogCategories().flatMap((category) => {
    const categoryItems = category.items ?? [];
    const directItems = categoryItems.map((item) => ({
      name: item.name,
      description: item.description,
      href: `/products/${category.slug}/items/${item.slug}`
    }));
    const subcategoryItems = category.subcategories.flatMap((subcategory) =>
      subcategory.items.map((item) => ({
        name: item.name,
        description: item.description,
        href: `/products/${category.slug}/${subcategory.slug}/${item.slug}`
      }))
    );
    return [...directItems, ...subcategoryItems];
  });
}
