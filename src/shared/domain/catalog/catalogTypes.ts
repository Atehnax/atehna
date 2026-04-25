export type CatalogItem = {
  slug: string;
  name: string;
  description: string;
  image?: string;
  images?: string[];
  price?: number;
  discountPct?: number;
  displayOrder?: number | null;
  createdAt?: string;
  updatedAt?: string;
  created_at?: string;
  updated_at?: string;
};

export type CatalogSubcategory = {
  id: string;
  slug: string;
  title: string;
  description: string;
  adminNotes?: string;
  image?: string;
  items: CatalogItem[];
  createdAt?: string;
  updatedAt?: string;
};

export type CatalogCategory = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  image: string;
  adminNotes?: string;
  bannerImage?: string;
  subcategories: CatalogSubcategory[];
  items?: CatalogItem[];
  createdAt?: string;
  updatedAt?: string;
};

export type CatalogSearchItem = {
  name: string;
  description: string;
  href: string;
};

export type CatalogData = {
  categories: CatalogCategory[];
};

export type RecursiveCatalogSubcategory = Omit<CatalogSubcategory, 'items'> & {
  items: CatalogItem[];
  subcategories: RecursiveCatalogSubcategory[];
};

export type RecursiveCatalogCategory = Omit<CatalogCategory, 'subcategories' | 'items'> & {
  subcategories: RecursiveCatalogSubcategory[];
  items: CatalogItem[];
};

export type RecursiveCatalogData = { categories: RecursiveCatalogCategory[] };

export type CategoryStatus = 'active' | 'inactive';

export type CategoriesView = 'table' | 'preview' | 'miller';
