import Image from 'next/image';
import Link from 'next/link';
import { getAllCategories, getCategoryContent, getCategorySlugs } from '@/lib/content';
import MdxContent from '@/components/MdxContent';

export function generateStaticParams() {
  return getCategorySlugs().map((slug) => ({ slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const category = getCategoryContent(params.slug);
  return {
    title: category.title,
    description: category.summary
  };
}

export default function CategoryPage({ params }: { params: { slug: string } }) {
  const category = getCategoryContent(params.slug);
  const categories = getAllCategories();

  return (
    <div className="container-base py-12">
      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">{category.title}</h1>
          <p className="mt-3 text-lg text-slate-600">{category.summary}</p>
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <MdxContent source={category.content} />
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
