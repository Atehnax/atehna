import 'server-only';

import type { PoolClient } from 'pg';
import {
  type CatalogCategoryActivityRow,
  catalogCategoryId,
  indexCatalogCategoryActivity
} from '@/shared/domain/catalog/catalogOrderability';

export type LockedCatalogVariant = {
  id: number;
  itemId: number;
  inventory: number;
  variantStatus: string;
  productStatus: string;
  categoryId: string | null;
  categoryIsActive: boolean;
};

export function isCatalogSerializationFailure(error: unknown): boolean {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';
  return code === '40001' || code === '40P01';
}

export async function lockCatalogOrderability(
  client: PoolClient,
  requestedVariantIds: number[]
): Promise<Map<number, LockedCatalogVariant>> {
  const variantIds = Array.from(
    new Set(
      requestedVariantIds.filter(
        (variantId) => Number.isSafeInteger(variantId) && variantId > 0
      )
    )
  ).sort((left, right) => left - right);
  if (variantIds.length === 0) return new Map();

  const ownerResult = await client.query(
    `
      select id, item_id
      from catalog_item_variants
      where id = any($1::bigint[])
      order by id
    `,
    [variantIds]
  );
  const productIds = Array.from(
    new Set(ownerResult.rows.map((row) => Number(row.item_id)))
  ).sort((left, right) => left - right);

  const productResult = await client.query(
    `
      select id, status, category_id
      from catalog_items
      where id = any($1::bigint[])
      order by id
    `,
    [productIds]
  );
  const variantResult = await client.query(
    `
      select id, item_id, inventory, status
      from catalog_item_variants
      where id = any($1::bigint[])
      order by id
      for update
    `,
    [variantIds]
  );
  // Callers use SERIALIZABLE transactions. Product/category orderability is
  // therefore read from one stable serialization snapshot, while only variants
  // require deterministic row locks before their inventory is decremented.
  const categoryResult = await client.query<CatalogCategoryActivityRow>(
    `
      with recursive category_paths as (
        select id, parent_id, status = 'active' as ancestors_active
        from catalog_categories
        where parent_id is null

        union all

        select
          child.id,
          child.parent_id,
          parent.ancestors_active and child.status = 'active'
        from catalog_categories child
        join category_paths parent on parent.id = child.parent_id
      )
      select id, ancestors_active
      from category_paths
    `
  );

  const products = new Map(
    productResult.rows.map((row) => [
      Number(row.id),
      {
        status: String(row.status),
        categoryId: catalogCategoryId(row.category_id)
      }
    ])
  );
  const activeCategories = indexCatalogCategoryActivity(categoryResult.rows);
  const locked = new Map<number, LockedCatalogVariant>();
  for (const row of variantResult.rows) {
    const itemId = Number(row.item_id);
    const product = products.get(itemId);
    locked.set(Number(row.id), {
      id: Number(row.id),
      itemId,
      inventory: Number(row.inventory),
      variantStatus: String(row.status),
      productStatus: product?.status ?? '',
      categoryId: product?.categoryId ?? null,
      categoryIsActive:
        product?.categoryId !== null && product?.categoryId !== undefined
          ? activeCategories.get(product.categoryId) === true
          : false
    });
  }
  return locked;
}
