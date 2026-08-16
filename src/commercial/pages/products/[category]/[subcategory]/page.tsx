import Link from 'next/link';
import {
  catalogCategoryHref,
  catalogCategoryItemHref,
  catalogSubcategoryHref
} from '@/commercial/catalog/catalogRoutes';
import { getCatalogItemPrice, getCatalogItemSku, sortCatalogItems } from '@/commercial/catalog/catalogUtils';
import { getCatalogCategorySlugsServer, getCatalogSubcategoryPageDataServer, getCatalogSubcategoryServer, getCatalogSubcategorySlugsServer, isCatalogRouteNotFoundError } from '@/commercial/catalog/catalogServer';
import ProductListing from '@/commercial/components/storefront/ProductListing';
import {
  buildStorefrontProductFromCatalogItem,
  toStorefrontProductSummary
} from '@/commercial/features/products/storefrontProduct';
import { hasDatabaseConnectionString } from '@/shared/server/db';
import { notFound } from 'next/navigation';

export const dynamicParams = true;

export async function generateStaticParams() {
  if (!hasDatabaseConnectionString()) {
    console.warn('Skipping /products/[category]/[subcategory] static params because database connection string is not set.');
    return [];
  }

  const categories = await getCatalogCategorySlugsServer();
  const params: { category: string; subcategory: string }[] = [];
  for (const category of categories) {
    for (const subcategory of await getCatalogSubcategorySlugsServer(category)) {
      params.push({ category, subcategory });
    }
  }
  return params;
}

export async function generateMetadata(props: { params: Promise<{ category: string; subcategory: string }> }) {
  const params = await props.params;
  try {
    const subcategory = await getCatalogSubcategoryServer(params.category, params.subcategory);
    return { title: subcategory.title, description: subcategory.description };
  } catch (error) {
    if (isCatalogRouteNotFoundError(error)) return {};
    throw error;
  }
}

export default async function SubcategoryPage(props: { params: Promise<{ category: string; subcategory: string }> }) {
  const params = await props.params;
  let pageData: Awaited<ReturnType<typeof getCatalogSubcategoryPageDataServer>>;
  try {
    pageData = await getCatalogSubcategoryPageDataServer(params.category, params.subcategory);
  } catch (error) {
    if (isCatalogRouteNotFoundError(error)) notFound();
    throw error;
  }
  const { category, subcategory } = pageData;
  const products = sortCatalogItems(subcategory.items).map((item) => {
    const href = catalogCategoryItemHref(category.slug, item.slug);
    const product = buildStorefrontProductFromCatalogItem(item, {
      href,
      fallbackSku: getCatalogItemSku(category.slug, subcategory.slug, item.slug),
      fallbackPrice:
        item.price ??
        getCatalogItemPrice(category.slug, subcategory.slug, item.slug),
      category: {
        slug: category.slug,
        title: category.title,
        href: catalogCategoryHref(category.slug)
      },
      subcategory: {
        slug: subcategory.slug,
        title: subcategory.title,
        href: catalogSubcategoryHref(category.slug, subcategory.slug)
      }
    });
    return toStorefrontProductSummary(product);
  });

  return (
    <div className="container-base site-section">
      <div className="mx-auto max-w-[calc(1180px/var(--commercial-storefront-scale))]">
        <nav
          aria-label="Drobtinice"
          className="mb-7 text-[length:calc(0.8125rem/var(--commercial-storefront-scale))]"
        >
          <ol className="flex min-w-0 items-center gap-2 text-[color:var(--site-color-text-muted)]">
            <li>
              <Link href="/products" className="site-link font-semibold">
                Izdelki
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="min-w-0">
              <Link
                href={catalogCategoryHref(category.slug)}
                className="site-link block truncate font-semibold"
              >
                {category.title}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="min-w-0">
              <span aria-current="page" className="block truncate">
                {subcategory.title}
              </span>
            </li>
          </ol>
        </nav>

        <ProductListing
          products={products}
          title={subcategory.title}
          description={subcategory.description}
        />
      </div>
    </div>
  );
}
