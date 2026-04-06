import {
  getCatalogCategoryItemPrice,
  getCatalogCategoryItemSku,
  getCatalogItemPrice,
  getCatalogItemSku,
  sortCatalogItems
} from '@/commercial/catalog/catalog';
import { getCatalogItemsIndexServer } from '@/commercial/catalog/catalogServer';
import { profilePayloadEstimate, profileRoutePhase } from '@/shared/server/catalogDiagnostics';
import type { SeedItemTuple } from './familyModel';

export async function buildSeedItems(): Promise<SeedItemTuple[]> {
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
