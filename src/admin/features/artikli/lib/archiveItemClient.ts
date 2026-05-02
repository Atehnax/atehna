'use client';

import type { CatalogItemEditorHydration, CatalogItemEditorPayload } from '@/shared/domain/catalog/catalogAdminTypes';

const ARCHIVED_ITEMS_STORAGE_KEY = 'admin-items-crud-v2';

type ArchivedItemRecordInput = {
  id: string;
  name: string;
  category: string;
  sku: string;
  price: number;
  discountPct: number;
  active: boolean;
  restorePayload?: CatalogItemEditorPayload | null;
};

export type ArchivedItemRecord = ArchivedItemRecordInput & {
  archivedAt: string;
};

function createCatalogItemRestorePayload(item: CatalogItemEditorHydration): CatalogItemEditorPayload {
  return {
    itemName: item.itemName,
    itemType: item.itemType,
    productType: item.productType,
    typeSpecificData: item.typeSpecificData,
    badge: item.badge,
    status: item.status,
    categoryPath: item.categoryPath,
    sku: item.sku,
    slug: item.slug,
    unit: item.unit,
    brand: item.brand,
    material: item.material,
    colour: item.colour,
    shape: item.shape,
    description: item.description,
    adminNotes: item.adminNotes,
    position: item.position,
    variants: item.variants.map(({ id: _id, ...variant }) => variant),
    quantityDiscounts: item.quantityDiscounts.map(({ id: _id, ...rule }) => rule),
    media: item.media.map(({ id: _id, ...media }) => media)
  };
}

export function createArchivedItemRecord({
  id,
  name,
  category,
  sku,
  price,
  discountPct,
  active,
  restorePayload = null
}: ArchivedItemRecordInput) {
  return {
    id,
    name: name.trim() || 'Artikel',
    category,
    sku,
    price,
    discountPct,
    active,
    restorePayload,
    archivedAt: new Date().toISOString()
  };
}

export async function fetchCatalogItemRestorePayload(identifier: string) {
  const response = await fetch(`/api/admin/artikli/${encodeURIComponent(identifier)}`, { cache: 'no-store' });
  if (!response.ok) return null;
  const item = (await response.json()) as CatalogItemEditorHydration;
  return createCatalogItemRestorePayload(item);
}

export function readArchivedItemStorage(): ArchivedItemRecord[] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(ARCHIVED_ITEMS_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as ArchivedItemRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeArchivedItemStorage(items: ArchivedItemRecord[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ARCHIVED_ITEMS_STORAGE_KEY, JSON.stringify(items));
}
