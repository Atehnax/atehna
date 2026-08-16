import Link from 'next/link';
import type { Metadata } from 'next';
import { catalogCategoryHref, catalogCategoryItemHref, catalogSubcategoryHref } from '@/commercial/catalog/catalogRoutes';
import {
  getCatalogCategoryItemPrice,
  getCatalogCategoryItemSku,
  sortCatalogItems
} from '@/commercial/catalog/catalogUtils';
import {
  getCatalogCategoryPageDataServer,
  getCatalogCategoryServer,
  getCatalogCategorySlugsServer,
  isCatalogRouteNotFoundError
} from '@/commercial/catalog/catalogServer';
import StorefrontCategoryShowcase from '@/commercial/components/storefront/StorefrontCategoryShowcase';
import ProductListing from '@/commercial/components/storefront/ProductListing';
import {
  buildStorefrontProductFromCatalogItem,
  toStorefrontProductSummary
} from '@/commercial/features/products/storefrontProduct';
import { hasDatabaseConnectionString } from '@/shared/server/db';
import { getLandingPageConfig } from '@/shared/server/landingPage';
import { notFound } from 'next/navigation';

export const dynamic = 'force-static';
export const dynamicParams = true;

export async function generateStaticParams() {
  if (!hasDatabaseConnectionString()) {
    console.warn('Skipping /products/[category] static params because database connection string is not set.');
    return [];
  }
  return (await getCatalogCategorySlugsServer()).map((category) => ({ category }));
}

const siteOrigin = new URL('https://atehna.si');

const getImageSrc = (value: string | null | undefined) => value?.trim() || null;

const normalizeCopy = (value: string) => value.trim().toLocaleLowerCase('sl');

const getCategoryCopy = (category: {
  title: string;
  summary?: string | null;
  description?: string | null;
}) => {
  const title = normalizeCopy(category.title);
  const copy = [category.summary, category.description]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .filter((value, index, values) => {
      const normalized = normalizeCopy(value);
      return normalized !== title && values.findIndex((candidate) => normalizeCopy(candidate) === normalized) === index;
    });

  return {
    lead: copy[0] ?? null,
    detail: copy[1] ?? null
  };
};

const getAbsoluteImageUrl = (value: string | null | undefined) => {
  const image = getImageSrc(value);
  if (!image) return null;

  try {
    return new URL(image, siteOrigin).toString();
  } catch {
    return null;
  }
};

export async function generateMetadata(props: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const params = await props.params;
  try {
    const category = await getCatalogCategoryServer(params.category);
    const description =
      getCategoryCopy(category).lead ??
      `Preglejte izdelke v kategoriji ${category.title}.`;
    const image = getAbsoluteImageUrl(category.image);

    return {
      title: category.title,
      description,
      openGraph: {
        title: category.title,
        description,
        url: new URL(catalogCategoryHref(category.slug), siteOrigin),
        type: 'website',
        images: image ? [{ url: image, alt: category.title }] : []
      },
      twitter: {
        card: image ? 'summary_large_image' : 'summary',
        title: category.title,
        description,
        images: image ? [image] : []
      }
    };
  } catch (error) {
    if (isCatalogRouteNotFoundError(error)) return {};
    throw error;
  }
}

export default async function CategoryPage(props: { params: Promise<{ category: string }> }) {
  const params = await props.params;
  let pageData: Awaited<ReturnType<typeof getCatalogCategoryPageDataServer>>;
  let landingSettings: Awaited<ReturnType<typeof getLandingPageConfig>>;
  try {
    [pageData, landingSettings] = await Promise.all([
      getCatalogCategoryPageDataServer(params.category),
      getLandingPageConfig()
    ]);
  } catch (error) {
    if (isCatalogRouteNotFoundError(error)) notFound();
    throw error;
  }
  const { category } = pageData;
  const categoryCopy = getCategoryCopy(category);
  const subcategoryShowcaseItems = category.subcategories.map((subcategory) => ({
    ...subcategory,
    href: catalogSubcategoryHref(category.slug, subcategory.slug)
  }));
  const products = sortCatalogItems(category.items ?? []).map((item) => {
    const href = catalogCategoryItemHref(category.slug, item.slug);
    const product = buildStorefrontProductFromCatalogItem(item, {
      href,
      fallbackSku: getCatalogCategoryItemSku(category.slug, item.slug),
      fallbackPrice:
        item.price ?? getCatalogCategoryItemPrice(category.slug, item.slug),
      category: {
        slug: category.slug,
        title: category.title,
        href: catalogCategoryHref(category.slug)
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
              <span aria-current="page" className="block truncate">
                {category.title}
              </span>
            </li>
          </ol>
        </nav>

        {products.length > 0 || category.subcategories.length === 0 ? (
          <ProductListing
            products={products}
            title={category.title}
            description={categoryCopy.lead}
            secondaryDescription={categoryCopy.detail}
          >
            {category.subcategories.length > 0 ? (
              <section className="mt-10" aria-label="Podkategorije">
                <StorefrontCategoryShowcase
                  categorySlug={category.slug}
                  items={subcategoryShowcaseItems}
                  settings={landingSettings.categories}
                  canvas={landingSettings.canvas}
                />
              </section>
            ) : null}
          </ProductListing>
        ) : (
          <>
            <header className="border-b border-[color:var(--site-divider-color)] pb-8">
              <div className="site-content-measure">
                <h1 className="site-heading-2">{category.title}</h1>
                {categoryCopy.lead ? (
                  <p className="mt-3 max-w-xl text-[length:calc(0.9375rem/var(--commercial-storefront-scale))] leading-7 text-[color:var(--site-color-text-muted)]">
                    {categoryCopy.lead}
                  </p>
                ) : null}
                {categoryCopy.detail ? (
                  <p className="mt-2 max-w-xl text-[length:calc(0.8125rem/var(--commercial-storefront-scale))] leading-6 text-[color:var(--site-color-text-muted)]">
                    {categoryCopy.detail}
                  </p>
                ) : null}
              </div>
            </header>
            <section className="mt-10" aria-label="Podkategorije">
              <StorefrontCategoryShowcase
                categorySlug={category.slug}
                items={subcategoryShowcaseItems}
                settings={landingSettings.categories}
                canvas={landingSettings.canvas}
              />
            </section>
          </>
        )}

        <nav
          aria-label="Katalog izdelkov"
          className="mt-10 border-t border-[color:var(--site-divider-color)] pt-5"
        >
          <Link
            href="/products"
            className="site-link inline-flex items-center gap-1 text-[length:calc(0.8125rem/var(--commercial-storefront-scale))] font-semibold"
          >
            Vse kategorije <span aria-hidden="true">→</span>
          </Link>
        </nav>
      </div>
    </div>
  );
}
