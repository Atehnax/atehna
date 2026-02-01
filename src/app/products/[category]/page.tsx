import Image from 'next/image';
import Link from 'next/link';
import {
  getCatalogCategories,
  getCatalogCategory,
  getCatalogCategorySlugs,
  getCatalogCategoryItemPrice,
  getCatalogCategoryItemSku,
  formatCatalogPrice
} from '@/lib/catalog';
import AddToCartButton from '@/components/products/AddToCartButton';

export function generateStaticParams() {
  return getCatalogCategorySlugs().map((category) => ({ category }));
}

export function generateMetadata({ params }: { params: { category: string } }) {
  const category = getCatalogCategory(params.category);
  return {
    title: category.title,
    description: category.summary
  };
}

const getArticleLabel = (count: number) => {
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 14) return 'artiklov';
  switch (count % 10) {
    case 1:
      return 'artikel';
    case 2:
      return 'artikla';
    case 3:
    case 4:
      return 'artikli';
    default:
      return 'artiklov';
  }
};

export default function CategoryPage({ params }: { params: { category: string } }) {
  const category = getCatalogCategory(params.category);
  const categories = getCatalogCategories();

  return (
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
                <p className="mt-2 text-sm text-slate-600">
                  Izberite podkategorijo za ogled razpoložljivih artiklov.
                </p>
                <div className="mt-4 space-y-3">
                  {category.subcategories.map((subcategory) => (
                    <Link
                      key={subcategory.slug}
                      href={`/products/${category.slug}/${subcategory.slug}`}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm transition hover:border-brand-200"
                    >
                      <span className="font-semibold text-slate-900">{subcategory.title}</span>
                      <span className="text-xs text-slate-500">
                        {subcategory.items.length} {getArticleLabel(subcategory.items.length)}
                      </span>
                    </Link>
                  ))}
                </div>
              </>
            ) : (
              <>
                <h2 className="text-xl font-semibold text-slate-900">Izdelki</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Izberite izdelek in ga dodajte v košarico.
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {(category.items ?? []).map((item) => {
                    const price = formatCatalogPrice(
                      item.price ?? getCatalogCategoryItemPrice(category.slug, item.slug)
                    );
                    const itemSku = getCatalogCategoryItemSku(category.slug, item.slug);
                    return (
                      <div
                        key={item.slug}
                        className="flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm transition hover:border-brand-200"
                      >
                        <div>
                          <p className="text-base font-semibold text-slate-900">{item.name}</p>
                          <p className="mt-2 text-sm text-slate-600">{item.description}</p>
                          <p className="mt-3 text-sm font-semibold text-slate-900">{price}</p>
                          <Link
                            href={`/products/${category.slug}/items/${item.slug}`}
                            className="mt-3 inline-flex text-sm font-semibold text-brand-600"
                          >
                            Več o izdelku →
                          </Link>
                        </div>
                        <AddToCartButton
                          sku={itemSku}
                          name={item.name}
                          price={
                            item.price ?? getCatalogCategoryItemPrice(category.slug, item.slug)
                          }
                          category={category.title}
                          className="mt-4 w-full justify-center"
                        />
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
        <aside className="space-y-4">
          <div className="relative h-52 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <Image src={category.image} alt={category.title} fill className="object-cover" />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
            <p className="font-semibold text-slate-900">Potrebujete ponudbo?</p>
            <p className="mt-2">
              Pišite nam podrobnosti o količinah in rokih, pripravili bomo prilagojeno ponudbo.
            </p>
            <Link
              href="/contact"
              className="mt-4 inline-flex items-center text-sm font-semibold text-brand-600"
            >
              Kontaktirajte nas →
            </Link>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
            <p className="font-semibold text-slate-900">Druge kategorije</p>
            <ul className="mt-3 space-y-2">
              {categories
                .filter((item) => item.slug !== category.slug)
                .map((item) => (
                  <li key={item.slug}>
                    <Link href={`/products/${item.slug}`} className="hover:text-brand-600">
                      {item.title}
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
