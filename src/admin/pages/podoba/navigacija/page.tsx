import AdminNavigationPageClient from '@/admin/features/podoba/components/AdminNavigationPageClient';
import { SiteLogoProvider } from '@/commercial/components/SiteLogo';
import { getGlobalStyleConfig } from '@/shared/server/globalStyle';
import { getPublishedSiteLogos } from '@/shared/server/logoLibrary';
import { getSiteNavigationConfig } from '@/shared/server/siteNavigation';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Administracija navigacija'
};

export default async function AdminPodobaNavigacijaPage() {
  const siteLogo = await getPublishedSiteLogos();
  const [config, globalStyle] = await Promise.all([
    getSiteNavigationConfig(),
    getGlobalStyleConfig()
  ]);

  return (
    <SiteLogoProvider config={siteLogo}>
      <AdminNavigationPageClient initialConfig={config} initialGlobalStyle={globalStyle} />
    </SiteLogoProvider>
  );
}
