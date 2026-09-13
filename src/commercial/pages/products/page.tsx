import CatalogBrowser from '@/commercial/components/storefront/CatalogBrowser';
import { getCatalogBrowserPageServer } from '@/commercial/catalog/catalogBrowserServer';

export const metadata = {
  title: 'Katalog izdelkov',
  description: 'Materiali, orodje in oprema za šole in delavnice.'
};
export const dynamic = 'force-static';

export default async function ProductsPage() {
  const pageData = await getCatalogBrowserPageServer();
  return pageData ? <CatalogBrowser key={pageData.currentHref} {...pageData} /> : null;
}
