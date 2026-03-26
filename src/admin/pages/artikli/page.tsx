import AdminItemsManagerLoader from '@/admin/components/AdminItemsManagerLoader';
import {
  getCatalogCategoryItemPrice,
  getCatalogCategoryItemSku,
  getCatalogItemPrice,
  getCatalogItemSku,
  sortCatalogItems
} from '@/commercial/catalog/catalog';
import { getCatalogItemsIndexServer } from '@/commercial/catalog/catalogServer';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Administracija artikli'
};

type SeedItemTuple = [
  id: string,
  name: string,
  description: string,
  category: string,
  categoryId: string,
  subcategoryId: string | null,
  price: number,
  sku: string,
  images: string[],
  discountPct: number,
  displayOrder: number | null
];

async function buildSeedItems(): Promise<SeedItemTuple[]> {
  const items: SeedItemTuple[] = [];
  const catalogIndex = await getCatalogItemsIndexServer('/admin/artikli');

  for (const category of catalogIndex) {
    for (const item of sortCatalogItems(category.items ?? [])) {
      items.push([
        getCatalogCategoryItemSku(category.slug, item.slug),
        item.name,
        item.description,
        category.title,
        category.id,
        null,
        item.price ?? getCatalogCategoryItemPrice(category.slug, item.slug),
        getCatalogCategoryItemSku(category.slug, item.slug),
        item.images?.length ? item.images : item.image ? [item.image] : [],
        item.discountPct ?? 0,
        item.displayOrder ?? null
      ]);
    }

    for (const sub of category.subcategories) {
      for (const item of sortCatalogItems(sub.items)) {
        items.push([
          getCatalogItemSku(category.slug, sub.slug, item.slug),
          item.name,
          item.description,
          `${category.title} / ${sub.title}`,
          category.id,
          sub.id,
          item.price ?? getCatalogItemPrice(category.slug, sub.slug, item.slug),
          getCatalogItemSku(category.slug, sub.slug, item.slug),
          item.images?.length ? item.images : item.image ? [item.image] : [],
          item.discountPct ?? 0,
          item.displayOrder ?? null
        ]);
      }
    }
  }

  return items;
}

async function AdminItemsManagerSection() {
  const seedItems = await buildSeedItems();
  return <AdminItemsManagerLoader seedItems={seedItems} />;
}

export default async function AdminArtikliPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Artikli</h1>
        <p className="mt-1 text-sm text-slate-600">Urejanje artiklov, statusov in prikaza v katalogu.</p>
      </div>
      {await AdminItemsManagerSection()}
    </div>
  );
}
