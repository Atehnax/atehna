import { getCatalogCategoryCardsServer } from '@/commercial/catalog/catalogServer';
import { catalogCategoryHref } from '@/commercial/catalog/catalogRoutes';
import CategoryCard from '@/commercial/components/landing/CategoryCard';
import { hasDatabaseConnectionString } from '@/shared/server/db';

export default async function CategoryGrid() {
  const categories = hasDatabaseConnectionString()
    ? await getCatalogCategoryCardsServer()
    : [];

  if (categories.length === 0) return null;

  return (
    <section className="mx-auto max-w-[1840px] px-5 pb-6 pt-1 sm:px-8 lg:px-16">
      <div className="grid auto-rows-fr gap-4 md:grid-cols-2 xl:grid-cols-4">
        {categories.map((category) => (
          <CategoryCard
            key={category.slug}
            title={category.title}
            href={catalogCategoryHref(category.slug)}
            image={category.image}
          />
        ))}
      </div>
    </section>
  );
}
