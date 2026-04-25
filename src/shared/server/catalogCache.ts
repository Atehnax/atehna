export const CATALOG_PUBLIC_TAG = 'catalog-public';
export const CATALOG_ADMIN_TAG = 'catalog-admin';

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
  { path: '/admin/artikli', type: 'page' }
] as const;
