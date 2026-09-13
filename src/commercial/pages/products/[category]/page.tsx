import { notFound } from 'next/navigation';
import CatalogBrowser from '@/commercial/components/storefront/CatalogBrowser';
import { getCatalogBrowserMetadataServer, getCatalogBrowserPageServer } from '@/commercial/catalog/catalogBrowserServer';
import { getCatalogCategorySlugsServer } from '@/commercial/catalog/catalogServer';
import { hasDatabaseConnectionString } from '@/shared/server/db';

export const dynamic = 'force-static';
export const dynamicParams = true;

type Props = { params: Promise<{ category: string }> };

export async function generateStaticParams() {
  if (!hasDatabaseConnectionString()) return [];
  return (await getCatalogCategorySlugsServer()).map((category) => ({ category }));
}

export async function generateMetadata({ params }: Props) {
  const { category } = await params;
  return getCatalogBrowserMetadataServer([category]);
}

export default async function CategoryPage({ params }: Props) {
  const { category } = await params;
  const pageData = await getCatalogBrowserPageServer([category]);
  if (!pageData) notFound();
  return <CatalogBrowser key={pageData.currentHref} {...pageData} />;
}
