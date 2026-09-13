import type { CatalogBrowserProps } from './catalogBrowserTypes';
import { CATALOG_ALL_PRODUCTS_HREF } from './catalogRoutes';

export function getCatalogAllProductsPresentation(): Pick<
  CatalogBrowserProps,
  'title' | 'description' | 'breadcrumbs' | 'currentHref'
> {
  return {
    title: 'Vse kategorije',
    description: 'Vsi izdelki za šole in delavnice na enem mestu.',
    breadcrumbs: [
      { label: 'Domov', href: '/' },
      { label: 'Katalog', href: '/products' },
      { label: 'Vse kategorije' }
    ],
    currentHref: CATALOG_ALL_PRODUCTS_HREF
  };
}
