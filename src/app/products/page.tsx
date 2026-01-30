import Link from 'next/link';
import Image from 'next/image';
import { getAllCategories, getPageContent } from '@/lib/content';
import MdxContent from '@/components/MdxContent';

export const metadata = {
  title: 'Izdelki'
};

export default function ProductsPage() {
  const page = getPageContent('products');
  const categories = getAllCategories();

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
