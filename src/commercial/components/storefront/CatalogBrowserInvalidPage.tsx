'use client';

import { useLayoutEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { toPublicCatalogSlug } from '@/commercial/catalog/catalogRoutes';
import { useCatalogBrowserDataContext } from './CatalogBrowserContext';

export default function CatalogBrowserInvalidPage() {
  const pathname = usePathname();
  const href = '/' + pathname.split('/').filter(Boolean).map(toPublicCatalogSlug).join('/');
  const invalidatePage = useCatalogBrowserDataContext()?.invalidatePage;
  const invalidatedHref = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (!invalidatePage || invalidatedHref.current === href) return;
    invalidatedHref.current = href;
    invalidatePage(href);
  }, [href, invalidatePage]);

  return null;
}
