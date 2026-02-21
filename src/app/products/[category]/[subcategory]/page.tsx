import Image from 'next/image';
import Link from 'next/link';
import {
  getCatalogCategory,
  getCatalogCategorySlugs,
  getCatalogItemSku,
  getCatalogItemPrice,
  formatCatalogPrice,
  getDiscountedPrice,
  getCatalogSubcategory,
  getCatalogSubcategorySlugs
} from '@/lib/catalog';
import AddToCartButton from '@/components/products/AddToCartButton';

export function generateStaticParams() {
  return getCatalogCategorySlugs().flatMap((category) =>
    getCatalogSubcategorySlugs(category).map((subcategory) => ({
      category,
      subcategory
    }))
  );
}

export function generateMetadata({
  params
}: {
  params: { category: string; subcategory: string };
}) {
  const subcategory = getCatalogSubcategory(params.category, params.subcategory);
  return {
    title: subcategory.title,
    description: subcategory.description
  };
}

export default function SubcategoryPage({
  params
}: {
  params: { category: string; subcategory: string };
}) {
  const category = getCatalogCategory(params.category);
  const subcategory = getCatalogSubcategory(params.category, params.subcategory);
  return (
    <div className="container-base py-12">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
          {category.title}
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-900">{subcategory.title}</h1>
        <p className="mt-3 text-lg text-slate-600">{subcategory.description}</p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {subcategory.items.map((item) => {
          const itemSku = getCatalogItemSku(category.slug, subcategory.slug, item.slug);
          const basePrice = item.price ?? getCatalogItemPrice(category.slug, subcategory.slug, item.slug);
          const finalPrice = getDiscountedPrice(basePrice, item.discountPct);
          const price = formatCatalogPrice(finalPrice);
          const itemHref = `/products/${category.slug}/${subcategory.slug}/${item.slug}`;
          return (
            <div
              key={item.slug}
              className="flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm transition hover:border-brand-200"
            >
              <div>
                <Link href={itemHref} className="group block">
                  {item.image && (
                    <div className="relative h-24 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                      <Image
                        src={item.images?.[0] ?? item.image ?? ''}
                        alt={item.name}
                        fill
                        className="object-contain p-3 transition duration-300 group-hover:scale-105"
                      />
                    </div>
                  )}
                  <p className="mt-3 text-base font-semibold text-slate-900 transition group-hover:text-brand-600">
                    {item.name}
                  </p>
                </Link>
                <p className="mt-2 text-sm text-slate-600">{item.description}</p>
                <p className="mt-3 text-sm font-semibold text-slate-900">{price}</p>
                {item.discountPct && item.discountPct > 0 ? (
                  <p className="mt-1 text-xs text-slate-500"><span className="line-through">{formatCatalogPrice(basePrice)}</span> · Popust {item.discountPct}%</p>
                ) : null}
              </div>
              <AddToCartButton
                sku={itemSku}
                name={item.name}
                price={finalPrice}
                category={`${category.title} / ${subcategory.title}`}
                className="mt-4 w-full justify-center"
              />
            </div>
          );
        })}
      </div>

      <div className="mt-10">
        <Link href={`/products/${category.slug}`} className="text-sm font-semibold text-brand-600">
          ← Nazaj na {category.title}
        </Link>
      </div>
    </div>
  );
}
