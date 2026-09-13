import { notFound } from 'next/navigation';
import CatalogBrowser from '@/commercial/components/storefront/CatalogBrowser';
import { getCatalogBrowserMetadataServer, getCatalogBrowserPageServer } from '@/commercial/catalog/catalogBrowserServer';
import { getCatalogCategorySlugsServer, getCatalogSubcategorySlugsServer } from '@/commercial/catalog/catalogServer';
import { hasDatabaseConnectionString } from '@/shared/server/db';

export const dynamicParams = true;
type Props = { params: Promise<{ category: string; subcategory: string }> };

export async function generateStaticParams() {
  if (!hasDatabaseConnectionString()) return [];
  const categories = await getCatalogCategorySlugsServer();
  const nested = await Promise.all(categories.map(async (category) =>
    (await getCatalogSubcategorySlugsServer(category)).map((subcategory) => ({ category, subcategory }))
  ));
  return nested.flat();
}

export async function generateMetadata({ params }: Props) {
  const { category, subcategory } = await params;
  return getCatalogBrowserMetadataServer([category, subcategory]);
}

export default async function SubcategoryPage({ params }: Props) {
  const { category, subcategory } = await params;
  const pageData = await getCatalogBrowserPageServer([category, subcategory]);
  if (!pageData) notFound();
  return <CatalogBrowser key={pageData.currentHref} {...pageData} />;
}
