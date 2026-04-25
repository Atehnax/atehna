'use client';

const ARCHIVED_ITEMS_STORAGE_KEY = 'admin-items-crud-v2';

type ArchivedItemRecordInput = {
  id: string;
  name: string;
  category: string;
  sku: string;
  price: number;
  discountPct: number;
  active: boolean;
};

export function createArchivedItemRecord({
  id,
  name,
  category,
  sku,
  price,
  discountPct,
  active
}: ArchivedItemRecordInput) {
  return {
    id,
    name: name.trim() || 'Artikel',
    category,
    sku,
    price,
    discountPct,
    active,
    archivedAt: new Date().toISOString()
  };
}

export function readArchivedItemStorage() {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(ARCHIVED_ITEMS_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeArchivedItemStorage(items: Array<Record<string, unknown>>) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ARCHIVED_ITEMS_STORAGE_KEY, JSON.stringify(items));
}
