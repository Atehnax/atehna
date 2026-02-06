import Image from 'next/image';
import Link from 'next/link';
import {
  formatCatalogPrice,
  getCatalogCategory,
  getCatalogCategoryItem,
  getCatalogCategoryItemPrice,
  getCatalogCategoryItemSku,
  getCatalogCategoryItemSlugs,
  getCatalogCategorySlugs
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
  const price = formatCatalogPrice(
    item.price ?? getCatalogCategoryItemPrice(category.slug, item.slug)
  );

  return (
    <div className="container-base py-12">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
          {category.title}
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-900">{item.name}</h1>
        <p className="mt-4 text-lg text-slate-600">{item.description}</p>
        {item.image && (
          <div className="relative mt-6 h-64 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
            <Image src={item.image} alt={item.name} fill className="object-contain p-8" />
          </div>
        )}
        <p className="mt-4 text-xl font-semibold text-slate-900">{price}</p>
        <AddToCartButton
          sku={itemSku}
          name={item.name}
          price={item.price ?? getCatalogCategoryItemPrice(category.slug, item.slug)}
          category={category.title}
          className="mt-6"
        />
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
