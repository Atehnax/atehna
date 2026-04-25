import type { CatalogItem } from '@/shared/domain/catalog/catalogTypes';

export function getCatalogItemSku(
  categorySlug: string,
  subSlug: string,
  itemSlug: string
): string {
  return `${categorySlug}-${subSlug}-${itemSlug}`;
}

export function getCatalogCategoryItemSku(categorySlug: string, itemSlug: string): string {
  return `${categorySlug}-${itemSlug}`;
}

export function getCatalogItemPrice(
  categorySlug: string,
  subSlug: string,
  itemSlug: string
): number {
  const seed = `${categorySlug}-${subSlug}-${itemSlug}`;
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) % 1000;
  }
  return Number((4 + (hash % 80) / 10).toFixed(2));
}

export function getCatalogCategoryItemPrice(categorySlug: string, itemSlug: string): number {
  const seed = `${categorySlug}-${itemSlug}`;
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) % 1000;
  }
  return Number((4 + (hash % 80) / 10).toFixed(2));
}

export function formatCatalogPrice(price: number): string {
  return new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR' }).format(price);
}

export function sortCatalogItems(items: CatalogItem[]): CatalogItem[] {
  const nameCmp = (left: string, right: string) =>
    left.localeCompare(right, 'sl', { sensitivity: 'base' });

  return [...items].sort((leftItem, rightItem) => {
    const leftOrder = leftItem.displayOrder ?? null;
    const rightOrder = rightItem.displayOrder ?? null;

    if (leftOrder !== null && rightOrder !== null) {
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return nameCmp(leftItem.name, rightItem.name);
    }

    if (leftOrder !== null) return -1;
    if (rightOrder !== null) return 1;

    return nameCmp(leftItem.name, rightItem.name);
  });
}

export function getDiscountedPrice(price: number, discountPct?: number): number {
  const safe = Math.max(0, Math.min(100, Number(discountPct ?? 0)));
  return Number((price * (1 - safe / 100)).toFixed(2));
}
