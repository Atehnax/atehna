import AdminLandingPageClient from '@/admin/features/podoba/components/AdminLandingPageClient';
import { getCatalogCategoryCardsServer } from '@/commercial/catalog/catalogServer';
import { DEFAULT_HOMEPAGE_CATEGORY_CARDS } from '@/shared/domain/landing/landingPage';
import { hasDatabaseConnectionString } from '@/shared/server/db';
import { getGlobalStyleConfig } from '@/shared/server/globalStyle';
import { getLandingPageConfig, getLandingPageDefaults } from '@/shared/server/landingPage';
import { getSiteNavigationConfig } from '@/shared/server/siteNavigation';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Administracija glavna stran'
};

async function getHomepageCategoriesForAdmin() {
  if (!hasDatabaseConnectionString()) return DEFAULT_HOMEPAGE_CATEGORY_CARDS;

  try {
    const categories = await getCatalogCategoryCardsServer();
    return categories.length > 0 ? categories : DEFAULT_HOMEPAGE_CATEGORY_CARDS;
  } catch (error) {
    console.error('Failed to load admin homepage categories', error);
    return DEFAULT_HOMEPAGE_CATEGORY_CARDS;
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
