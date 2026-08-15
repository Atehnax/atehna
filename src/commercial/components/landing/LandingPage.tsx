import { getCatalogCategoryCardsServer } from '@/commercial/catalog/catalogServer';
import HomepageRenderer from '@/commercial/components/landing/HomepageRenderer';
import type { HomepageCategoryCardData } from '@/shared/domain/landing/landingPage';
import { hasDatabaseConnectionString } from '@/shared/server/db';
import { getLandingPageConfig } from '@/shared/server/landingPage';
import { getSiteNavigationConfig } from '@/shared/server/siteNavigation';

async function getHomepageCategories(): Promise<HomepageCategoryCardData[]> {
  if (!hasDatabaseConnectionString()) return [];

  try {
    return await getCatalogCategoryCardsServer();
  } catch (error) {
    console.error('Failed to load homepage category cards', error);
    return [];
  }
}

export default async function LandingPage() {
  const [settings, categories, navigation] = await Promise.all([
    getLandingPageConfig(),
    getHomepageCategories(),
    getSiteNavigationConfig()
  ]);

  return <HomepageRenderer settings={settings} categories={categories} canonicalFooter={navigation.footer} />;
}
