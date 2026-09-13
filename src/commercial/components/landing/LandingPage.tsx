import { preventCachingPublicFallback } from '@/shared/server/publicCacheFallback';
import { withRuntimeTiming } from '@/shared/server/diagnostics/runtimeTiming';
import { getCatalogCategoryCardsServer } from '@/commercial/catalog/catalogServer';
import HomepageRenderer from '@/commercial/components/landing/HomepageRenderer';
import type { HomepageCategoryCardData } from '@/shared/domain/landing/landingPage';
import { hasDatabaseConnectionString } from '@/shared/server/db';
import { getLandingPageConfig } from '@/shared/server/landingPage';
import { getSiteNavigationConfig } from '@/shared/server/siteNavigation';

async function getHomepageCategories(): Promise<HomepageCategoryCardData[]> {
  if (!hasDatabaseConnectionString()) {
    preventCachingPublicFallback();
    return [];
  }

  try {
    return await getCatalogCategoryCardsServer();
  } catch (error) {
    preventCachingPublicFallback();
    console.error('Failed to load homepage category cards', error);
    return [];
  }
}

export default async function LandingPage() {
  const [settings, categories, navigation] = await Promise.all([
    withRuntimeTiming('app.dependency', 'homepage.settings', () => getLandingPageConfig()),
    withRuntimeTiming('app.dependency', 'homepage.categories', () => getHomepageCategories()),
    withRuntimeTiming('app.dependency', 'homepage.navigation', () => getSiteNavigationConfig())
  ]);

  return <HomepageRenderer settings={settings} categories={categories} canonicalFooter={navigation.footer} />;
}
