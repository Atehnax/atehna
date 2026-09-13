import type { ReactNode } from 'react';
import { getCatalogBrowserShellServer } from '@/commercial/catalog/catalogBrowserServer';
import CatalogBrowserShell from '@/commercial/components/storefront/CatalogBrowserShell';

export default async function ProductsLayout({ children }: { children: ReactNode }) {
  const data = await getCatalogBrowserShellServer();
  return <CatalogBrowserShell data={data}>{children}</CatalogBrowserShell>;
}
