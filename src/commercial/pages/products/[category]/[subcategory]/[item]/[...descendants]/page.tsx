import { notFound } from 'next/navigation';
import CatalogBrowser from '@/commercial/components/storefront/CatalogBrowser';
import { getCatalogBrowserMetadataServer, getCatalogBrowserPageServer } from '@/commercial/catalog/catalogBrowserServer';

export const dynamicParams = true;
type Props = { params: Promise<{ category: string; subcategory: string; item: string; descendants: string[] }> };

export async function generateMetadata({ params }: Props) {
  const { category, subcategory, item, descendants } = await params;
  return getCatalogBrowserMetadataServer([category, subcategory, item, ...descendants]);
}

export default async function DeepCategoryPage({ params }: Props) {
  const { category, subcategory, item, descendants } = await params;
  const pageData = await getCatalogBrowserPageServer([category, subcategory, item, ...descendants]);
  if (!pageData) notFound();
  return <CatalogBrowser key={pageData.currentHref} {...pageData} />;
}
