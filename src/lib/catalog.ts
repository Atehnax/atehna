import fs from 'fs';
import path from 'path';

export type CatalogItem = {
  slug: string;
  name: string;
  description: string;
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
};

type CatalogData = {
  categories: CatalogCategory[];
};

const catalogPath = path.join(process.cwd(), 'content', 'catalog.json');

export function getCatalog(): CatalogData {
  const raw = fs.readFileSync(catalogPath, 'utf8');
  return JSON.parse(raw) as CatalogData;
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
