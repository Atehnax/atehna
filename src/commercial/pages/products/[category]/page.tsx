import Image from 'next/image';
import Link from 'next/link';
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
import ProductListing from '@/commercial/components/storefront/ProductListing';
import {
  buildStorefrontProductFromCatalogItem,
  toStorefrontProductSummary
} from '@/commercial/features/products/storefrontProduct';
import { hasDatabaseConnectionString } from '@/shared/server/db';
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

export async function generateMetadata(props: { params: Promise<{ category: string }> }) {
  const params = await props.params;
  try {
    const category = await getCatalogCategoryServer(params.category);
    return {
      title: category.title,
      description: category.summary
    };
  } catch (error) {
    if (isCatalogRouteNotFoundError(error)) return {};
    throw error;
  }
}

const getArticleLabel = (count: number) => {
  if (count === 1) return 'artikel';
  if (count === 2) return 'artikla';
  if (count >= 3 && count <= 4) return 'artikli';
  return 'artiklov';
};

const getImageSrc = (value: string | null | undefined) => value?.trim() || null;

export default async function CategoryPage(props: { params: Promise<{ category: string }> }) {
  const params = await props.params;
  let pageData: Awaited<ReturnType<typeof getCatalogCategoryPageDataServer>>;
  try {
    pageData = await getCatalogCategoryPageDataServer(params.category);
  } catch (error) {
    if (isCatalogRouteNotFoundError(error)) notFound();
    throw error;
  }
  const { category, categories } = pageData;
  const categoryImageSrc = getImageSrc(category.image);
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
    return toStorefrontProductSummary(product, category.title);
  });

  return (
    <div className="container-base site-section">
      <nav aria-label="Drobtinice" className="mb-5 text-sm">
        <Link href="/products" className="site-link">
          Izdelki
        </Link>
        <span className="mx-2 text-[color:var(--site-color-text-muted)]">/</span>
        <span
          aria-current="page"
          className="text-[color:var(--site-color-text-muted)]"
        >
          {category.title}
        </span>
      </nav>

      <header
        className={`grid items-center gap-8 ${
          categoryImageSrc ? 'lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.6fr)]' : ''
        }`}
      >
        <div className="site-content-measure">
          <p className="site-eyebrow">Kategorija</p>
          <h1 className="site-heading-1 mt-2">{category.title}</h1>
          {category.summary ? (
            <p className="site-paragraph mt-4 text-lg">{category.summary}</p>
          ) : null}
          {category.description ? (
            <p className="site-paragraph mt-4">{category.description}</p>
          ) : null}
        </div>
        {categoryImageSrc ? (
          <div className="site-panel relative aspect-[4/3] overflow-hidden bg-[color:var(--site-color-surface-muted)]">
            <Image
              src={categoryImageSrc}
              alt={category.title}
              fill
              sizes="(min-width: 1024px) 33vw, 100vw"
              className="object-cover"
            />
          </div>
        ) : null}
      </header>

      {category.subcategories.length > 0 ? (
        <section className="mt-12" aria-labelledby="subcategories-title">
          <div className="mb-5">
            <h2 id="subcategories-title" className="site-heading-2">
              Podkategorije
            </h2>
            <p className="site-paragraph mt-2">
              Izberite področje in poiščite ustrezne artikle.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {category.subcategories.map((subcategory) => (
              <Link
                key={subcategory.slug}
                href={catalogSubcategoryHref(category.slug, subcategory.slug)}
                prefetch={false}
                className="site-panel group flex min-h-32 items-end justify-between gap-5 overflow-hidden p-5 transition hover:-translate-y-0.5 hover:border-[color:var(--site-color-primary)]"
              >
                <div>
                  <h3 className="font-semibold text-[color:var(--site-color-text)] transition group-hover:text-[color:var(--site-color-primary)]">
                    {subcategory.title}
                  </h3>
                  {subcategory.description ? (
                    <p className="mt-2 line-clamp-2 text-sm text-[color:var(--site-color-text-muted)]">
                      {subcategory.description}
                    </p>
                  ) : null}
                  <p className="mt-3 text-xs text-[color:var(--site-color-text-muted)]">
                    {subcategory.itemCount}{' '}
                    {getArticleLabel(subcategory.itemCount)}
                  </p>
                </div>
                <span
                  aria-hidden="true"
                  className="text-xl text-[color:var(--site-color-primary)]"
                >
                  →
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {products.length > 0 || category.subcategories.length === 0 ? (
        <div className="mt-12">
          <ProductListing
            products={products}
            title={
              category.subcategories.length > 0
                ? 'Izdelki v kategoriji'
                : 'Izdelki'
            }
            description="Cene so prikazane z in brez DDV. Dobavljivost potrdimo pred obdelavo naročila."
          />
        </div>
      ) : null}

      {categories.length > 1 ? (
        <nav
          aria-label="Druge kategorije"
          className="mt-12 border-t border-[color:var(--site-divider-color)] pt-6"
        >
          <p className="mb-3 text-sm font-semibold text-[color:var(--site-color-text)]">
            Druge kategorije
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {categories
              .filter((item) => item.slug !== category.slug)
              .map((item) => (
                <li key={item.slug}>
                  <Link
                    href={catalogCategoryHref(item.slug)}
                    prefetch={false}
                    className="site-link text-sm"
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
