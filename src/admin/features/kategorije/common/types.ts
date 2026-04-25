import type {
  CatalogCategory,
  CatalogSubcategory,
  CategoriesView,
  CategoryStatus,
  RecursiveCatalogData as CatalogData
} from '@/shared/domain/catalog/catalogTypes';

export type {
  CategoriesView,
  CategoryStatus,
  RecursiveCatalogCategory,
  RecursiveCatalogData as CatalogData,
  RecursiveCatalogSubcategory
} from '@/shared/domain/catalog/catalogTypes';

export type AdminCategoriesPayload = {
  categories: CatalogCategory[];
  statuses?: Record<string, CategoryStatus>;
  payloadMode?: 'full' | 'partial';
  payloadView?: CategoriesView;
};

export type SelectedNode =
  | { kind: 'root' }
  | { kind: 'category'; categorySlug: string }
  | { kind: 'subcategory'; categorySlug: string; subcategoryPath?: string[]; subcategorySlug?: string };

type DeleteTarget =
  | { kind: 'root' }
  | { kind: 'category'; categorySlug: string }
  | { kind: 'subcategory'; categorySlug: string; subcategoryPath?: string[]; subcategorySlug?: string }
  | null;

export type ImageDeleteTarget =
  | { kind: 'category' | 'subcategory'; categorySlug: string; subcategorySlug?: string }
  | null;

export type ContentCard = {
  id: string;
  title: string;
  description: string;
  image?: string;
  kind: 'category' | 'subcategory';
  categorySlug: string;
  subcategoryPath: string[];
  openLabel: string;
  hasChildren: boolean;
  isInactive?: boolean;
};

export type EditingRowDraft = {
  id: string;
  kind: 'root' | 'category' | 'subcategory';
  categorySlug?: string;
  subcategoryPath?: string[];
  subcategorySlug?: string;
  title: string;
  description: string;
  status: CategoryStatus;
  initialTitle?: string;
  initialDescription?: string;
  initialStatus?: CategoryStatus;
};

export type CreateTarget =
  | { kind: 'category'; afterSlug?: string }
  | { kind: 'subcategory'; categorySlug: string; parentPath?: string[]; afterSlug?: string }
  | null;

export type MillerDeleteTarget =
  | { column: 'categories'; ids: string[] }
  | { column: 'subcategories'; ids: string[]; categorySlug: string }
  | { column: 'items'; ids: string[]; categorySlug: string; subcategorySlug?: string }
  | null;

export type MillerRenameDraft = { id: string; value: string };
export type HistorySnapshot = { catalog: CatalogData; statuses: Record<string, CategoryStatus> };

export type SelectedPreviewContext =
  | { kind: 'root' }
  | { kind: 'category'; category: CatalogCategory }
  | { kind: 'subcategory'; category: CatalogCategory; subcategory: CatalogSubcategory }
  | null;
