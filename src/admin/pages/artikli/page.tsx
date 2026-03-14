import AdminItemsManager from '@/admin/features/artikli/components/AdminItemsManager';
import {
  getCatalogCategoryItemPrice,
  getCatalogCategoryItemSku,
  getCatalogItemPrice,
  getCatalogItemSku,
  sortCatalogItems
} from '@/commercial/catalog/catalog';
import { getCatalogCategoriesServer } from '@/commercial/catalog/catalogServer';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Administracija artikli'
};

type SeedItem = {
  id: string;
  name: string;
  description: string;
  category: string;
  categoryId: string;
  subcategoryId: string | null;
  price: number;
  unit: string;
  sku: string;
  active: boolean;
  images: string[];
  discountPct: number;
  displayOrder: number | null;
  updatedAt: string;
  archivedAt: string | null;
};

async function buildSeedItems(): Promise<SeedItem[]> {
  const items: SeedItem[] = [];
  const now = new Date().toISOString();

  for (const category of await getCatalogCategoriesServer()) {
    for (const item of sortCatalogItems(category.items ?? [])) {
      items.push({
        id: getCatalogCategoryItemSku(category.slug, item.slug),
        name: item.name,
        description: item.description,
        category: category.title,
        categoryId: category.id,
        subcategoryId: null,
        price: item.price ?? getCatalogCategoryItemPrice(category.slug, item.slug),
        unit: 'kos',
        sku: getCatalogCategoryItemSku(category.slug, item.slug),
        active: true,
        images: item.images?.length ? item.images : item.image ? [item.image] : [],
        discountPct: item.discountPct ?? 0,
        displayOrder: item.displayOrder ?? null,
        updatedAt: now,
        archivedAt: null
      });
    }

    for (const sub of category.subcategories) {
      for (const item of sortCatalogItems(sub.items)) {
        items.push({
          id: getCatalogItemSku(category.slug, sub.slug, item.slug),
          name: item.name,
          description: item.description,
          category: `${category.title} / ${sub.title}`,
          categoryId: category.id,
          subcategoryId: sub.id,
          price: item.price ?? getCatalogItemPrice(category.slug, sub.slug, item.slug),
          unit: 'kos',
          sku: getCatalogItemSku(category.slug, sub.slug, item.slug),
          active: true,
          images: item.images?.length ? item.images : item.image ? [item.image] : [],
          discountPct: item.discountPct ?? 0,
          displayOrder: item.displayOrder ?? null,
          updatedAt: now,
          archivedAt: null
        });
      }
    }
  }

  return items;
}

export default async function AdminArtikliPage() {
  const seedItems = await buildSeedItems();
  return <AdminItemsManager seedItems={seedItems} />;
}
