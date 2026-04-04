import AdminItemsManagerLoader from '@/admin/components/AdminItemsManagerLoader';
import {
  getCatalogCategoryItemPrice,
  getCatalogCategoryItemSku,
  getCatalogItemPrice,
  getCatalogItemSku,
  sortCatalogItems
} from '@/commercial/catalog/catalog';
import { getCatalogItemsIndexServer } from '@/commercial/catalog/catalogServer';
import { instrumentAdminRouteRender, profilePayloadEstimate, profileRoutePhase } from '@/shared/server/catalogDiagnostics';
import { AdminPageHeader } from '@/shared/ui/admin-primitives';

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
  const catalogIndex = await profileRoutePhase('cache', 'buildSeedItems:getCatalogItemsIndexServer', () =>
    getCatalogItemsIndexServer('/admin/artikli')
  );

  await profileRoutePhase('transform', 'buildSeedItems:flattenIndex', async () => {
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
  });

  profilePayloadEstimate('buildSeedItems:seedItems', items);
  return items;
}

async function AdminItemsManagerSection() {
  return instrumentAdminRouteRender('/admin/artikli', async () => {
    const seedItems = await buildSeedItems();
    return <AdminItemsManagerLoader seedItems={seedItems} />;
  });
}


export default async function AdminArtikliPage() {
  return (
    <div className="w-full space-y-4">
      <AdminPageHeader title="Artikli" description="Urejanje artiklov, statusov in prikaza v katalogu." />
      {await AdminItemsManagerSection()}
    </div>
  );
}
