import { Suspense, type ReactNode } from 'react';
import { getCatalogBrowserShellServer } from '@/commercial/catalog/catalogBrowserServer';
import CatalogBrowserShell from '@/commercial/components/storefront/CatalogBrowserShell';
import CatalogBrowserSkeleton from '@/commercial/components/storefront/CatalogBrowserSkeleton';

async function CatalogShellContent({ children }: { children: ReactNode }) {
  const data = await getCatalogBrowserShellServer();
  return <CatalogBrowserShell data={data}>{children}</CatalogBrowserShell>;
}

export default function ProductsLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<CatalogBrowserSkeleton />}>
      <CatalogShellContent>{children}</CatalogShellContent>
    </Suspense>
  );
}
