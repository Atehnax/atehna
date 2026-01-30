import Link from 'next/link';
import Image from 'next/image';
import { getAllCategories, getPageContent } from '@/lib/content';
import MdxContent from '@/components/MdxContent';

export default function HomePage() {
  const page = getPageContent('home');
  const categories = getAllCategories();

  return (
    <div>
      <section className="bg-white">
        <div className="container-base grid gap-10 py-16 md:grid-cols-[1.2fr_0.8fr] md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
              Oprema za tehnični pouk
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl">
              Zanesljiva dobava materialov in opreme po Sloveniji
            </h1>
            <p className="mt-4 text-lg text-slate-600">
              Atehna je zanesljiv dobavitelj za šole, podjetja in posameznike, ki potrebujejo
              kakovostne tehnične materiale, varno delavniško opremo in celovito podporo pri
              naročilih.
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
              <Link
                href="/how-schools-order"
                className="rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
              >
                Kako naročiti
              </Link>
              <Link
                href="/contact"
                className="rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-brand-600 hover:text-brand-600"
              >
                Kontakt
              </Link>
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 shadow-sm">
            <MdxContent source={page.content} />
          </div>
        </div>
      </section>

      <section className="container-base py-14">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-slate-900">Kategorije izdelkov</h2>
          <Link href="/products" className="text-sm font-semibold text-brand-600">
            Vsi izdelki →
          </Link>
        </div>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
      </section>
    </div>
  );
}
