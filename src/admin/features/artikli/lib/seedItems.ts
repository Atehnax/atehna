import { fetchCatalogItemSeeds } from '@/shared/server/catalogItems';
import { profilePayloadEstimate, profileRoutePhase } from '@/shared/server/catalogDiagnostics';
import type { SeedItemTuple } from './familyModel';

export async function buildSeedItems(): Promise<SeedItemTuple[]> {
  const rows = await profileRoutePhase('db', 'buildSeedItems:fetchCatalogItemSeeds', () => fetchCatalogItemSeeds());
  const items: SeedItemTuple[] = rows.map((row) => [
    `${row.id}-${row.variant_id}`,
    row.item_name,
    row.description,
    row.category_path,
    row.category_id,
    row.parent_category_id,
    row.price,
    row.sku,
    row.images,
    row.discount_pct,
    row.item_position
  ]);

  profilePayloadEstimate('buildSeedItems:seedItems', items);
  return items;
}
