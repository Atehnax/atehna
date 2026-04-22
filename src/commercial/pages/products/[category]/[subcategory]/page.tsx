import Image from 'next/image';
import Link from 'next/link';
import { formatCatalogPrice, getDiscountedPrice, getCatalogItemPrice, getCatalogItemSku, sortCatalogItems } from '@/commercial/catalog/catalog';
import { getCatalogCategorySlugsServer, getCatalogSubcategoryPageDataServer, getCatalogSubcategoryServer, getCatalogSubcategorySlugsServer } from '@/commercial/catalog/catalogServer';
import AddToCartButton from '@/commercial/features/products/AddToCartButton';

export async function generateStaticParams() {
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
  const subcategory = await getCatalogSubcategoryServer(params.category, params.subcategory);
  return { title: subcategory.title, description: subcategory.description };
}

export default async function SubcategoryPage(props: { params: Promise<{ category: string; subcategory: string }> }) {
  const params = await props.params;
  const { category, subcategory } = await getCatalogSubcategoryPageDataServer(params.category, params.subcategory);

  return (
    <div className="container-base py-12">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">{category.title}</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-900">{subcategory.title}</h1>
        <p className="mt-3 text-lg text-slate-600">{subcategory.description}</p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sortCatalogItems(subcategory.items).map((item) => {
          const itemSku = getCatalogItemSku(category.slug, subcategory.slug, item.slug);
          const basePrice = item.price ?? getCatalogItemPrice(category.slug, subcategory.slug, item.slug);
          const finalPrice = getDiscountedPrice(basePrice, item.discountPct);
          const price = formatCatalogPrice(finalPrice);
          const itemHref = `/products/${category.slug}/${subcategory.slug}/${item.slug}`;
          return (
            <div key={item.slug} className="flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm transition hover:border-brand-200">
              <div>
                <Link href={itemHref} className="group block">
                  {item.image && <div className="relative h-24 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50"><Image src={item.images?.[0] ?? item.image ?? ''} alt={item.name} fill className="object-contain p-3 transition duration-300 group-hover:scale-105" /></div>}
                  <p className="mt-3 text-base font-semibold text-slate-900 transition group-hover:text-brand-600">{item.name}</p>
                </Link>
                <p className="mt-2 text-sm text-slate-600">{item.description}</p>
                <p className="mt-3 text-sm font-semibold text-slate-900">{price}</p>
              </div>
              <AddToCartButton sku={itemSku} name={item.name} price={finalPrice} category={`${category.title} / ${subcategory.title}`} className="mt-4 w-full justify-center" />
            </div>
          );
        })}
      </div>

      <div className="mt-10">
        <Link href={`/products/${category.slug}`} className="text-sm font-semibold text-brand-600">← Nazaj na {category.title}</Link>
      </div>
    </div>
  );
}
