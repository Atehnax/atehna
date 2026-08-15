import Link from 'next/link';
import Image from 'next/image';
import { catalogCategoryHref } from '@/commercial/catalog/catalogRoutes';
import { getPageContent } from '@/commercial/content/content';
import { getCatalogCategoryCardsServer } from '@/commercial/catalog/catalogServer';
import MdxContent from '@/commercial/components/MdxContent';
import { hasDatabaseConnectionString } from '@/shared/server/db';

export const metadata = {
  title: 'Izdelki'
};
export const dynamic = 'force-static';

const getImageSrc = (value: string | null | undefined) => value?.trim() || null;

export default async function ProductsPage() {
  const page = getPageContent('products');
  const hasDatabase = hasDatabaseConnectionString();
  const categories = hasDatabase ? await getCatalogCategoryCardsServer() : [];
  if (!hasDatabase) {
    console.warn('Skipping /products catalog data because database connection string is not set.');
  }

  return (
    <div className="container-base site-section">
      <div className="w-full">
        <p className="site-eyebrow">Katalog</p>
        <h1 className="site-heading-1 mt-2">{page.title}</h1>
        <div className="mt-4">
          <MdxContent source={page.content} />
        </div>
      </div>

      {categories.length > 0 ? (
        <div className="site-gap-lg mt-10 grid sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => {
            const imageSrc = getImageSrc(category.image);
            return (
              <Link
                key={category.slug}
                href={catalogCategoryHref(category.slug)}
                prefetch={false}
                className="site-panel group overflow-hidden transition hover:-translate-y-0.5 hover:border-[color:var(--site-color-primary)]"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-[color:var(--site-color-surface-muted)]">
                  {imageSrc ? (
                    <Image
                      src={imageSrc}
                      alt={category.title}
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover transition duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <span className="flex h-full items-center justify-center px-4 text-center text-xs text-[color:var(--site-color-text-muted)]">
                      Slika kategorije še ni objavljena
                    </span>
                  )}
                </div>
                <div className="p-5">
                  <h2 className="site-heading-3 transition group-hover:text-[color:var(--site-color-primary)]">
                    {category.title}
                  </h2>
                  {category.summary ? (
                    <p className="site-paragraph mt-2">{category.summary}</p>
                  ) : null}
                  <span className="site-link mt-4 inline-flex text-sm font-semibold">
                    Poglej izdelke →
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="site-panel mt-10 border-dashed p-8 text-center">
          <h2 className="site-heading-3">Kategorije še niso objavljene</h2>
          <p className="site-paragraph mt-2">
            Za pomoč pri izbiri se obrnite na našo ekipo.
          </p>
          <Link
            href="/contact"
            className="site-button site-button--secondary mt-5 inline-flex items-center justify-center"
          >
            Kontakt
          </Link>
        </div>
      )}
    </div>
  );
}
