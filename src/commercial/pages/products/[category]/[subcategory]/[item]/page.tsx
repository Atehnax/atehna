import Image from 'next/image';
import Link from 'next/link';
import { formatCatalogPrice, getDiscountedPrice, getCatalogItemPrice, getCatalogItemSku } from '@/commercial/catalog/catalogUtils';
import { getCatalogCategorySlugsServer, getCatalogItemPageDataServer, getCatalogItemServer, getCatalogItemSlugsServer, getCatalogSubcategorySlugsServer } from '@/commercial/catalog/catalogServer';
import AddToCartButton from '@/commercial/features/products/AddToCartButton';
import { hasDatabaseConnectionString } from '@/shared/server/db';

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
  const item = await getCatalogItemServer(params.category, params.subcategory, params.item);
  return { title: item.name, description: item.description };
}

export default async function ItemPage(
  props: { params: Promise<{ category: string; subcategory: string; item: string }> }
) {
  const params = await props.params;
  const { category, subcategory, item } = await getCatalogItemPageDataServer(params.category, params.subcategory, params.item);
  const itemSku = getCatalogItemSku(category.slug, subcategory.slug, item.slug);
  const basePrice = item.price ?? getCatalogItemPrice(category.slug, subcategory.slug, item.slug);
  const effectivePrice = getDiscountedPrice(basePrice, item.discountPct);
  const images = item.images?.length ? item.images : item.image ? [item.image] : [];

  return (
    <div className="container-base py-12">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">{category.title} · {subcategory.title}</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-900">{item.name}</h1>
        <p className="mt-4 text-lg text-slate-600">{item.description}</p>
        {images[0] && <div className="relative mt-6 h-64 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"><Image src={images[0]} alt={item.name} fill className="object-contain p-8" /></div>}
        <p className="mt-4 text-xl font-semibold text-slate-900">{formatCatalogPrice(effectivePrice)}</p>
        <AddToCartButton sku={itemSku} name={item.name} unitPrice={effectivePrice} category={`${category.title} / ${subcategory.title}`} className="mt-6" />
      </div>
      <div className="mt-10 flex flex-wrap gap-4">
        <Link href={`/products/${category.slug}/${subcategory.slug}`} className="text-sm font-semibold text-brand-600">← Nazaj na {subcategory.title}</Link>
        <Link href={`/products/${category.slug}`} className="text-sm font-semibold text-brand-600">{category.title}</Link>
      </div>
    </div>
  );
}
