import type { StorefrontProductSummary } from '@/commercial/features/products/storefrontProduct';

export type CatalogBrowserProduct = StorefrontProductSummary & {
  priceOptions: Array<{ gross: number; inStock: boolean; orderable: boolean }>;
};

export type CatalogBrowserNode = {
  id: string;
  title: string;
  href: string;
  description?: string | null;
  products: CatalogBrowserProduct[];
  children: CatalogBrowserNode[];
};

export type CatalogBrowserNavigation = {
  id: string;
  title: string;
  href: string;
};

export type CatalogBrowserProps = {
  title: string;
  description?: string | null;
  breadcrumbs: Array<{ label: string; href?: string }>;
  nodes: CatalogBrowserNode[];
  navigation: CatalogBrowserNavigation[];
  currentHref: string;
};


export type CatalogBrowserShellData = {
  nodes: CatalogBrowserNode[];
  navigation: CatalogBrowserNavigation[];
  routes: Array<
    Pick<CatalogBrowserProps, 'title' | 'description' | 'breadcrumbs' | 'currentHref'> & {
      priceBounds: { min: number; max: number };
    }
  >;
};
