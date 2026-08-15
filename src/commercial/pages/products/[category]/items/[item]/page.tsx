import {
  catalogCategoryHref,
  catalogCategoryItemHref,
  catalogSubcategoryHref,
  toPublicCatalogSlug
} from '@/commercial/catalog/catalogRoutes';
import {
  getCatalogCategoryItemPrice,
  getCatalogCategoryItemSku,
  getCatalogItemPrice,
  getCatalogItemSku
} from '@/commercial/catalog/catalogUtils';
import { buildCatalogRelatedPresentationContext } from '@/commercial/catalog/catalogRelatedProducts';
import {
  getCatalogItemsIndexServer,
  getCatalogProductByGlobalSlugServer
} from '@/commercial/catalog/catalogServer';
import CatalogProductDetailPage from '@/commercial/features/products/CatalogProductDetailPage';
import { toStorefrontPlainText } from '@/commercial/features/products/storefrontProduct';
import { hasDatabaseConnectionString } from '@/shared/server/db';
import { notFound, permanentRedirect } from 'next/navigation';

export const dynamicParams = true;

export async function generateStaticParams() {
  if (!hasDatabaseConnectionString()) {
    console.warn('Skipping /products/[category]/items/[item] static params because database connection string is not set.');
    return [];
  }

  const categories = await getCatalogItemsIndexServer(
    '/products/[category]/items/[item]:static'
  );
  return categories.flatMap((category) => [
    ...category.items.map((item) => ({
      category: toPublicCatalogSlug(category.slug),
      item: toPublicCatalogSlug(item.slug)
    })),
    ...category.subcategories.flatMap((subcategory) =>
      subcategory.items.map((item) => ({
        category: toPublicCatalogSlug(category.slug),
        item: toPublicCatalogSlug(item.slug)
      }))
    )
  ]);
}

export async function generateMetadata(
  props: {
    params: Promise<{ category: string; item: string }>;
  }
  ) {
  const params = await props.params;
  const resolved = await getCatalogProductByGlobalSlugServer(params.item);
  if (!resolved) return {};
  return {
    title: resolved.item.name,
    description: toStorefrontPlainText(resolved.item.description)
  };
}

export default async function CategoryItemPage(
  props: {
    params: Promise<{ category: string; item: string }>;
  }
) {
  const params = await props.params;
  const resolved = await getCatalogProductByGlobalSlugServer(params.item);
  if (!resolved) notFound();

  const canonicalHref = catalogCategoryItemHref(
    resolved.category.slug,
    resolved.canonicalSlug
  );
  if (
    toPublicCatalogSlug(params.category) !==
      toPublicCatalogSlug(resolved.category.slug) ||
    toPublicCatalogSlug(params.item) !==
      toPublicCatalogSlug(resolved.canonicalSlug)
  ) {
    permanentRedirect(canonicalHref);
  }

  const { category, subcategory, item } = resolved;
  const context = {
    href: canonicalHref,
    fallbackSku: subcategory
      ? getCatalogItemSku(category.slug, subcategory.slug, item.slug)
      : getCatalogCategoryItemSku(category.slug, item.slug),
    fallbackPrice:
      item.price ??
      (subcategory
        ? getCatalogItemPrice(category.slug, subcategory.slug, item.slug)
        : getCatalogCategoryItemPrice(category.slug, item.slug)),
    category: {
      slug: category.slug,
      title: category.title,
      href: catalogCategoryHref(category.slug)
    },
    ...(subcategory
      ? {
          subcategory: {
            slug: subcategory.slug,
            title: subcategory.title,
            href: catalogSubcategoryHref(category.slug, subcategory.slug)
          }
        }
      : {})
  };

  return (
    <CatalogProductDetailPage
      item={item}
      context={context}
      related={resolved.relatedItems.map((related) => ({
        item: related.item,
        context: buildCatalogRelatedPresentationContext(related)
      }))}
    />
  );
}
