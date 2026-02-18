import AdminItemsManager from '@/components/admin/AdminItemsManager';
import {
  getCatalogCategories,
  getCatalogCategoryItemPrice,
  getCatalogCategoryItemSku,
  getCatalogItemPrice,
  getCatalogItemSku
} from '@/lib/catalog';

export const metadata = {
  title: 'Administracija artikli'
};

type SeedItem = {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  unit: string;
  sku: string;
  active: boolean;
  image?: string;
  updatedAt: string;
};

function buildSeedItems(): SeedItem[] {
  const items: SeedItem[] = [];
  const now = new Date().toISOString();

  for (const category of getCatalogCategories()) {
    for (const item of category.items ?? []) {
      items.push({
        id: getCatalogCategoryItemSku(category.slug, item.slug),
        name: item.name,
        description: item.description,
        category: category.title,
        price: item.price ?? getCatalogCategoryItemPrice(category.slug, item.slug),
        unit: 'kos',
        sku: getCatalogCategoryItemSku(category.slug, item.slug),
        active: true,
        image: item.image,
        updatedAt: now
      });
    }

    for (const sub of category.subcategories) {
      for (const item of sub.items) {
        items.push({
          id: getCatalogItemSku(category.slug, sub.slug, item.slug),
          name: item.name,
          description: item.description,
          category: `${category.title} / ${sub.title}`,
          price: item.price ?? getCatalogItemPrice(category.slug, sub.slug, item.slug),
          unit: 'kos',
          sku: getCatalogItemSku(category.slug, sub.slug, item.slug),
          active: true,
          image: item.image,
          updatedAt: now
        });
      }
    }
  }

  return items;
}

export default function AdminArtikliPage() {
  const seedItems = buildSeedItems();

  return <AdminItemsManager seedItems={seedItems} />;
}
