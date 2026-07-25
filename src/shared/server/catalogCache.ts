export const CATALOG_PUBLIC_TAG = 'catalog-public';
export const CATALOG_ADMIN_TAG = 'catalog-admin';
/**
 * Media and non-destructive presentation settings for the top-level category
 * showcase. Keeping this separate from the structural catalogue tags means a
 * focal-point or crop adjustment does not evict product indexes and category
 * trees that cannot be affected by that change.
 */
export const CATEGORY_SHOWCASE_TAG = 'category-showcase';

export const CATALOG_REVALIDATE_PATHS = [
  { path: '/', type: 'page' },
  { path: '/products', type: 'page' },
  { path: '/products/[category]', type: 'page' },
  { path: '/products/[category]/[subcategory]', type: 'page' },
  { path: '/products/[category]/items/[item]', type: 'page' },
  { path: '/products/[category]/[subcategory]/[item]', type: 'page' },
  { path: '/admin/kategorije', type: 'page' },
  { path: '/admin/kategorije/predogled', type: 'page' },
  { path: '/admin/kategorije/miller-view', type: 'page' },
  { path: '/admin/podoba/glavna-stran', type: 'page' },
  { path: '/admin/artikli', type: 'page' }
] as const;

/**
 * Static catalogue pages whose rendered output contains the shared top-level
 * category image. Force-dynamic landing/admin pages only need the showcase tag
 * invalidation and must not be regenerated for presentation-only edits.
 */
export const CATEGORY_SHOWCASE_REVALIDATE_PATHS = [
  { path: '/products', type: 'page' },
  { path: '/products/[category]', type: 'page' }
] as const;
