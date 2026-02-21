import Image from 'next/image';
import Link from 'next/link';
import {
  formatCatalogPrice,
  getCatalogCategory,
  getCatalogCategoryItem,
  getCatalogCategoryItemPrice,
  getCatalogCategoryItemSku,
  getCatalogCategoryItemSlugs,
  getCatalogCategorySlugs,
  getDiscountedPrice
} from '@/lib/catalog';
import AddToCartButton from '@/components/products/AddToCartButton';

export function generateStaticParams() {
  return getCatalogCategorySlugs().flatMap((category) =>
    getCatalogCategoryItemSlugs(category).map((item) => ({
      category,
      item
    }))
  );
}

export function generateMetadata({
  params
}: {
  params: { category: string; item: string };
}) {
  const item = getCatalogCategoryItem(params.category, params.item);
  return {
    title: item.name,
    description: item.description
  };
}

export default function CategoryItemPage({
  params
}: {
  params: { category: string; item: string };
}) {
  const category = getCatalogCategory(params.category);
  const item = getCatalogCategoryItem(params.category, params.item);
  const itemSku = getCatalogCategoryItemSku(category.slug, item.slug);
  const basePrice = item.price ?? getCatalogCategoryItemPrice(category.slug, item.slug);
  const effectivePrice = getDiscountedPrice(basePrice, item.discountPct);
  const images = item.images?.length ? item.images : item.image ? [item.image] : [];

  return (
    <div className="container-base py-12">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">{category.title}</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-900">{item.name}</h1>
        <p className="mt-4 text-lg text-slate-600">{item.description}</p>
        {images[0] && (
          <div className="relative mt-6 h-64 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
            <Image src={images[0]} alt={item.name} fill className="object-contain p-8" />
          </div>
        )}
        {images.length > 1 ? (
          <div className="mt-3 grid grid-cols-5 gap-2">
            {images.slice(1).map((img) => (
              <div key={img} className="relative h-14 overflow-hidden rounded border border-slate-200 bg-slate-50">
                <Image src={img} alt={`${item.name} dodatna slika`} fill className="object-cover" />
              </div>
            ))}
          </div>
        ) : null}

        <p className="mt-4 text-xl font-semibold text-slate-900">{formatCatalogPrice(effectivePrice)}</p>
        {item.discountPct && item.discountPct > 0 ? (
          <p className="mt-1 text-sm text-slate-500">
            <span className="line-through">{formatCatalogPrice(basePrice)}</span> · Popust {item.discountPct}%
          </p>
        ) : null}

        <AddToCartButton sku={itemSku} name={item.name} price={effectivePrice} category={category.title} className="mt-6" />
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          <p className="font-semibold text-slate-900">Opis izdelka</p>
          <p className="mt-2">{item.description}</p>
        </div>
      </div>

      <div className="mt-10 flex flex-wrap gap-4">
        <Link href={`/products/${category.slug}`} className="text-sm font-semibold text-brand-600">
          ← Nazaj na {category.title}
        </Link>
      </div>
    </div>
  );
}
