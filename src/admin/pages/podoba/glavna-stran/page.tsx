import AdminLandingPageClient from '@/admin/features/podoba/components/AdminLandingPageClient';
import { getCatalogCategoryCardsServer } from '@/commercial/catalog/catalogServer';
import { hasDatabaseConnectionString } from '@/shared/server/db';
import { getGlobalStyleConfig } from '@/shared/server/globalStyle';
import { getLandingPageConfig, getLandingPageDefaults } from '@/shared/server/landingPage';
import { getSiteNavigationConfig } from '@/shared/server/siteNavigation';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Administracija glavna stran'
};

async function getHomepageCategoriesForAdmin() {
  if (!hasDatabaseConnectionString()) return [];

  try {
    return await getCatalogCategoryCardsServer();
  } catch (error) {
    console.error('Failed to load admin homepage categories', error);
    return [];
  }
}

export default async function AdminPodobaGlavnaStranPage() {
  const [config, defaults, categories, navigation, globalStyle] = await Promise.all([
    getLandingPageConfig(),
    getLandingPageDefaults(),
    getHomepageCategoriesForAdmin(),
    getSiteNavigationConfig(),
    getGlobalStyleConfig()
  ]);

  return (
    <AdminLandingPageClient
      initialConfig={config}
      initialDefaults={defaults}
      initialCategories={categories}
      navigation={navigation}
      globalStyle={globalStyle}
    />
  );
}
