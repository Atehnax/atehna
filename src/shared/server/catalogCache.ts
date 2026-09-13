export const CATALOG_PUBLIC_TAG = 'catalog-public';
export const CATALOG_ADMIN_TAG = 'catalog-admin';
/**
 * Media and non-destructive presentation settings for the top-level category
 * showcase. Keeping this separate from the structural catalogue tags means a
 * focal-point or crop adjustment does not evict product indexes and category
 * trees that cannot be affected by that change.
 */
export const CATEGORY_SHOWCASE_TAG = 'category-showcase';

// The homepage is a literal URL. A 'page' type would target /page,
// which is not the /(commercial)/page route group's implicit cache tag.
export const CATALOG_REVALIDATE_PATHS = [
  { path: '/', type: undefined },
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
 * Public pages whose rendered output contains the shared top-level category
 * image. Include the prerendered homepage so image edits invalidate its HTML.
 */
export const CATEGORY_SHOWCASE_REVALIDATE_PATHS = [
  { path: '/', type: undefined },
  { path: '/products', type: 'page' },
  { path: '/products/[category]', type: 'page' }
] as const;
