'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { CatalogSearchItem } from '@/commercial/catalog/catalog';
import { markRouteEvent, measureRouteDuration } from '@/shared/client/routePerformance';
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
  const pathname = usePathname();
  const [items, setItems] = useState<CatalogSearchItem[]>(() => searchItemsCache ?? []);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!pathname?.startsWith('/products/')) return;
    markRouteEvent('/products/[category]', 'search-ready', { cachedItems: searchItemsCache?.length ?? 0 });
    measureRouteDuration('/products/[category]', 'primary-content-to-search-ready', 'primary-content-visible', 'search-ready');
  }, [pathname]);

  const ensureItemsLoaded = useCallback(() => {
    if (searchItemsCache) {
      setItems(searchItemsCache);
      return;
    }

    setLoading(true);
    void loadSearchItems()
      .then((nextItems) => setItems(nextItems))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <ItemSearch
      items={items}
      placeholder={placeholder}
      loading={loading && items.length === 0}
      onOpen={ensureItemsLoaded}
    />
  );
}
