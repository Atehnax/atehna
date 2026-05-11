import Image from 'next/image';
import Link from 'next/link';
import {
  formatCatalogPrice,
  getCatalogCategoryItemPrice,
  getCatalogCategoryItemSku,
  getDiscountedPrice,
  sortCatalogItems
} from '@/commercial/catalog/catalogUtils';
import {
  getCatalogCategoryPageDataServer,
  getCatalogCategoryServer,
  getCatalogCategorySlugsServer
} from '@/commercial/catalog/catalogServer';
import AddToCartButton from '@/commercial/features/products/AddToCartButton';
import { hasDatabaseConnectionString } from '@/shared/server/db';

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
  const category = await getCatalogCategoryServer(params.category);
  return {
    title: category.title,
    description: category.summary
  };
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
  const { category, categories } = await getCatalogCategoryPageDataServer(params.category);
  const categoryImageSrc = getImageSrc(category.image);

  return <div>
    <div className="container-base py-12">
      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">{category.title}</h1>
          <p className="mt-3 text-lg text-slate-600">{category.summary}</p>
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-600">{category.description}</p>
          </div>
          <div className="mt-8">
            {category.subcategories.length > 0 ? (
              <>
                <h2 className="text-xl font-semibold text-slate-900">Podkategorije</h2>
                <p className="mt-2 text-sm text-slate-600">Izberite podkategorijo za ogled razpoložljivih artiklov.</p>
                <div className="mt-4 space-y-3">
                  {category.subcategories.map((subcategory) => (
                    <Link key={subcategory.slug} href={`/products/${category.slug}/${subcategory.slug}`} prefetch={false} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm transition hover:border-brand-200">
                      <span className="font-semibold text-slate-900">{subcategory.title}</span>
                      <span className="text-xs text-slate-500">{subcategory.itemCount} {getArticleLabel(subcategory.itemCount)}</span>
                    </Link>
                  ))}
                </div>
              </>
            ) : (
              <>
                <h2 className="text-xl font-semibold text-slate-900">Izdelki</h2>
                <p className="mt-2 text-sm text-slate-600">Izberite izdelek in ga dodajte v košarico.</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {sortCatalogItems(category.items ?? []).map((item) => {
                    const basePrice = item.price ?? getCatalogCategoryItemPrice(category.slug, item.slug);
                    const finalPrice = getDiscountedPrice(basePrice, item.discountPct);
                    const price = formatCatalogPrice(finalPrice);
                    const itemSku = getCatalogCategoryItemSku(category.slug, item.slug);
                    const itemHref = `/products/${category.slug}/items/${item.slug}`;
                    const itemImageSrc = getImageSrc(item.images?.[0]) ?? getImageSrc(item.image);
                    return <div key={item.slug} className="flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm transition hover:border-brand-200">
                      <div>
                        <Link href={itemHref} prefetch={false} className="group block">
                          {itemImageSrc ? <div className="relative h-24 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50"><Image src={itemImageSrc} alt={item.name} fill sizes="(min-width: 640px) 50vw, 100vw" className="object-contain p-3 transition duration-300 group-hover:scale-105" /></div> : null}
                          <p className="mt-3 text-base font-semibold text-slate-900 transition group-hover:text-brand-600">{item.name}</p>
                        </Link>
                        <p className="mt-2 text-sm text-slate-600">{item.description}</p>
                        <p className="mt-3 text-sm font-semibold text-slate-900">{price}</p>
                      </div>
                      <AddToCartButton sku={itemSku} name={item.name} unitPrice={finalPrice} category={category.title} className="mt-4 w-full justify-center" />
                    </div>;
                  })}
                </div>
              </>
            )}
          </div>
        </div>
        <aside className="space-y-4">
          <div className="relative h-52 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">{categoryImageSrc ? <Image src={categoryImageSrc} alt={category.title} fill sizes="(min-width: 1024px) 33vw, 100vw" className="object-cover" /> : null}</div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm"><p className="font-semibold text-slate-900">Druge kategorije</p><ul className="mt-3 space-y-2">{categories.filter((item) => item.slug !== category.slug).map((item) => <li key={item.slug}><Link href={`/products/${item.slug}`} prefetch={false} className="hover:text-brand-600">{item.title}</Link></li>)}</ul></div>
        </aside>
      </div>
    </div>
  </div>;
}
