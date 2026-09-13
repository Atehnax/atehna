import CatalogBrowser from '@/commercial/components/storefront/CatalogBrowser';
import { getCatalogBrowserMetadataServer, getCatalogBrowserPageServer } from '@/commercial/catalog/catalogBrowserServer';
import {
  catalogCategoryItemHref,
  toPublicCatalogSlug
} from '@/commercial/catalog/catalogRoutes';
import {
  getCatalogCategorySlugsServer,
  getCatalogItemSlugsServer,
  getCatalogProductByGlobalSlugServer,
  getCatalogSubcategorySlugsServer
} from '@/commercial/catalog/catalogServer';
import { hasDatabaseConnectionString } from '@/shared/server/db';
import { notFound, permanentRedirect } from 'next/navigation';

export const dynamicParams = true;

export async function generateStaticParams() {
  if (!hasDatabaseConnectionString()) {
    console.warn('Skipping /products/[category]/[subcategory]/[item] static params because database connection string is not set.');
    return [];
  }

  const categories = await getCatalogCategorySlugsServer();
  const params: { category: string; subcategory: string; item: string }[] = [];

  for (const category of categories) {
    for (const subcategory of await getCatalogSubcategorySlugsServer(category)) {
      for (const item of await getCatalogItemSlugsServer(category, subcategory)) {
        params.push({ category, subcategory, item });
      }
    }
  }

  return params;
}

export async function generateMetadata(
  props: { params: Promise<{ category: string; subcategory: string; item: string }> }
) {
  const params = await props.params;
  const categoryPath = [params.category, params.subcategory, params.item];
  const categoryMetadata = await getCatalogBrowserMetadataServer(categoryPath);
  if (categoryMetadata.title) return categoryMetadata;
  const resolved = await getCatalogProductByGlobalSlugServer(params.item);
  if (!resolved) return {};
  return { title: resolved.item.name, description: resolved.item.description };
}

export default async function ItemPage(
  props: { params: Promise<{ category: string; subcategory: string; item: string }> }
) {
  const params = await props.params;
  const pageData = await getCatalogBrowserPageServer([params.category, params.subcategory, params.item]);
  if (pageData) return <CatalogBrowser key={pageData.currentHref} {...pageData} />;
  const resolved = await getCatalogProductByGlobalSlugServer(params.item);
  if (!resolved) notFound();
  permanentRedirect(
    catalogCategoryItemHref(
      resolved.category.slug,
      toPublicCatalogSlug(resolved.canonicalSlug)
    )
  );
}
