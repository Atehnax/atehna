'use client';

import CatalogBrowserSkeleton from './CatalogBrowserSkeleton';
import { useCatalogBrowserContext } from './CatalogBrowserContext';

export default function CatalogBrowserLoading() {
  const catalog = useCatalogBrowserContext();
  // Keep existing results on screen while the next route payload streams in.
  return catalog ? null : <CatalogBrowserSkeleton />;
}
