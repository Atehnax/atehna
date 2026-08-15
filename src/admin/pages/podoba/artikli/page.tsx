import AdminProductAppearancePageClient from '@/admin/features/podoba/components/AdminProductAppearancePageClient';
import type { AdminCatalogListItem } from '@/shared/domain/catalog/catalogAdminTypes';
import {
  fetchAdminCatalogListItems,
  fetchCatalogItemEditorBySlug
} from '@/shared/server/catalogItems';
import { hasDatabaseConnectionString } from '@/shared/server/db';
import { getGlobalStyleConfig } from '@/shared/server/globalStyle';
import { getProductAppearanceConfig } from '@/shared/server/productAppearance';
import { getSiteNavigationConfig } from '@/shared/server/siteNavigation';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Administracija prikaza artiklov'
};

async function loadProductsForAppearanceEditor() {
  if (!hasDatabaseConnectionString()) {
    return [] as AdminCatalogListItem[];
  }

  try {
    return await fetchAdminCatalogListItems();
  } catch (error) {
    console.error('Failed to load products for the appearance editor', error);
    return [] as AdminCatalogListItem[];
  }
}

export default async function AdminPodobaArtikliPage({
  searchParams
}: {
  searchParams?: Promise<{ product?: string | string[] }>;
}) {
  const [config, globalStyle, navigation, productResult, resolvedSearchParams] = await Promise.all([
    getProductAppearanceConfig(),
    getGlobalStyleConfig(),
    getSiteNavigationConfig(),
    loadProductsForAppearanceEditor(),
    searchParams ?? Promise.resolve<{ product?: string | string[] }>({})
  ]);
  const requestedProduct = Array.isArray(resolvedSearchParams.product)
    ? resolvedSearchParams.product[0]
    : resolvedSearchParams.product;
  const defaultProduct = productResult.find((item) => item.status === 'active')
    ?? productResult[0]
    ?? null;
  const selectedSlug = productResult.some((item) => item.slug === requestedProduct)
    ? requestedProduct
    : defaultProduct?.slug;
  const initialProduct = selectedSlug
    ? await fetchCatalogItemEditorBySlug(selectedSlug).catch((error) => {
        console.error('Failed to load the selected product for the appearance editor', error);
        return null;
      })
    : null;

  return (
    <AdminProductAppearancePageClient
      initialConfig={config}
      initialGlobalStyle={globalStyle}
      initialSiteLayout={navigation.siteLayout}
      initialProducts={productResult}
      initialProduct={initialProduct}
    />
  );
}
