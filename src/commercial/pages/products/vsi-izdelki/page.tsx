import type { Metadata } from 'next';
import CatalogBrowser from '@/commercial/components/storefront/CatalogBrowser';
import { getCatalogBrowserPageServer } from '@/commercial/catalog/catalogBrowserServer';
import { getCatalogAllProductsPresentation } from '@/commercial/catalog/catalogBrowserAllProducts';

const presentation = getCatalogAllProductsPresentation();

export const metadata: Metadata = {
  title: presentation.title,
  description: presentation.description,
  alternates: { canonical: presentation.currentHref },
  openGraph: {
    title: presentation.title,
    description: presentation.description ?? undefined,
    url: presentation.currentHref,
    type: 'website'
  }
};

export default async function AllProductsPage() {
  const pageData = await getCatalogBrowserPageServer();
  return pageData ? <CatalogBrowser key={presentation.currentHref} {...pageData} {...presentation} /> : null;
}
