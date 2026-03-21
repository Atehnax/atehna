'use client';

import { useEffect, useState } from 'react';
import type { CatalogSearchItem } from '@/commercial/catalog/catalog';
import ItemSearch from './ItemSearch';

let searchItemsCache: CatalogSearchItem[] | null = null;
let searchItemsPromise: Promise<CatalogSearchItem[]> | null = null;

async function loadSearchItems(): Promise<CatalogSearchItem[]> {
  if (searchItemsCache) return searchItemsCache;

  if (!searchItemsPromise) {
    searchItemsPromise = fetch('/api/catalog/search', { cache: 'force-cache' })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load catalog search items: ${response.status}`);
        }

        const payload = (await response.json()) as { items?: CatalogSearchItem[] };
        searchItemsCache = Array.isArray(payload.items) ? payload.items : [];
        return searchItemsCache;
      })
      .catch((error) => {
        searchItemsPromise = null;
        throw error;
      });
  }

  return searchItemsPromise;
}

export default function CatalogSearch({ placeholder }: { placeholder?: string }) {
  const [items, setItems] = useState<CatalogSearchItem[]>(() => searchItemsCache ?? []);

  useEffect(() => {
    if (searchItemsCache) {
      setItems(searchItemsCache);
      return;
    }

    void loadSearchItems()
      .then((nextItems) => setItems(nextItems))
      .catch(() => setItems([]));
  }, []);

  return <ItemSearch items={items} placeholder={placeholder} />;
}
