import Link from 'next/link';
import {
  getCatalogCategory,
  getCatalogCategorySlugs,
  getCatalogItem,
  getCatalogItemSku,
  getCatalogItemSlugs,
  getCatalogSubcategory,
  getCatalogSubcategorySlugs
} from '@/lib/catalog';
import AddToCartButton from '@/components/products/AddToCartButton';

export function generateStaticParams() {
  return getCatalogCategorySlugs().flatMap((category) =>
    getCatalogSubcategorySlugs(category).flatMap((subcategory) =>
      getCatalogItemSlugs(category, subcategory).map((item) => ({
        category,
        subcategory,
        item
      }))
    )
  );
}

export function generateMetadata({
  params
}: {
  params: { category: string; subcategory: string; item: string };
}) {
  const item = getCatalogItem(params.category, params.subcategory, params.item);
  return {
    title: item.name,
    description: item.description
  };
}

export default function ItemPage({
  params
}: {
  params: { category: string; subcategory: string; item: string };
}) {
  const category = getCatalogCategory(params.category);
  const subcategory = getCatalogSubcategory(params.category, params.subcategory);
  const item = getCatalogItem(params.category, params.subcategory, params.item);
  const itemSku = getCatalogItemSku(category.slug, subcategory.slug, item.slug);

  return (
    <div className="container-base py-12">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
          {category.title} · {subcategory.title}
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-900">{item.name}</h1>
        <p className="mt-4 text-lg text-slate-600">{item.description}</p>
        <AddToCartButton
          sku={itemSku}
          name={item.name}
          category={`${category.title} / ${subcategory.title}`}
          className="mt-6"
        />
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          <p className="font-semibold text-slate-900">Opis izdelka</p>
          <p className="mt-2">{item.description}</p>
        </div>
      </div>

      <div className="mt-10 flex flex-wrap gap-4">
        <Link
          href={`/products/${category.slug}/${subcategory.slug}`}
          className="text-sm font-semibold text-brand-600"
        >
          ← Nazaj na {subcategory.title}
        </Link>
        <Link href={`/products/${category.slug}`} className="text-sm font-semibold text-brand-600">
          {category.title}
        </Link>
      </div>
    </div>
  );
}
