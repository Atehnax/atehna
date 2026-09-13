'use client';

import { useLayoutEffect } from 'react';
import type { CatalogBrowserProps } from '@/commercial/catalog/catalogBrowserTypes';
import { getCatalogPriceBounds } from '@/commercial/catalog/catalogBrowserFilters';
import { useCatalogBrowserDataContext } from './CatalogBrowserContext';
import CatalogBrowserShell from './CatalogBrowserShell';

export default function CatalogBrowser(props: CatalogBrowserProps) {
  const publishPage = useCatalogBrowserDataContext()?.publishPage;
  // Route pages supply authoritative data; the shared layout owns the DOM.
  // Publish before paint so unchanged rows survive and changed values update together.
  useLayoutEffect(() => { publishPage?.(props); }, [publishPage, props]);
  if (publishPage) return null;
  const { nodes, navigation, ...page } = props;
  return (
    <CatalogBrowserShell data={{ nodes, navigation, routes: [{ ...page, priceBounds: getCatalogPriceBounds(nodes) }] }}>
      {null}
    </CatalogBrowserShell>
  );
}
