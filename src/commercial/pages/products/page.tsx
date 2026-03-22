import Link from 'next/link';
import Image from 'next/image';
import { getPageContent } from '@/commercial/content/content';
import { getCatalogCategoryCardsServer } from '@/commercial/catalog/catalogServer';
import MdxContent from '@/commercial/components/MdxContent';

export const metadata = {
  title: 'Izdelki'
};
export const dynamic = 'force-static';

export default async function ProductsPage() {
  const page = getPageContent('products');
  const categories = await getCatalogCategoryCardsServer();

  return (
    <div className="container-base py-12">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-semibold text-slate-900">{page.title}</h1>
        <div className="mt-4">
          <MdxContent source={page.content} />
        </div>
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <Link
            key={category.slug}
            href={`/products/${category.slug}`}
            prefetch={false}
            className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:border-brand-200"
          >
            <div className="relative h-40">
              <Image
                src={category.image}
                alt={category.title}
                fill
                className="object-cover transition duration-300 group-hover:scale-105"
              />
            </div>
            <div className="p-5">
              <h3 className="text-lg font-semibold text-slate-900">{category.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{category.summary}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
