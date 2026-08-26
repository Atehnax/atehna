import AdminNavigationPageClient from '@/admin/features/podoba/components/AdminNavigationPageClient';
import { SiteLogoProvider } from '@/commercial/components/SiteLogo';
import { getGlobalStyleConfig } from '@/shared/server/globalStyle';
import { getSiteLogoConfig } from '@/shared/server/siteLogo';
import { getSiteNavigationConfig } from '@/shared/server/siteNavigation';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Administracija navigacija'
};

export default async function AdminPodobaNavigacijaPage() {
  const [config, globalStyle, siteLogo] = await Promise.all([
    getSiteNavigationConfig(),
    getGlobalStyleConfig(),
    getSiteLogoConfig()
  ]);

  return (
    <SiteLogoProvider config={siteLogo}>
      <AdminNavigationPageClient initialConfig={config} initialGlobalStyle={globalStyle} />
    </SiteLogoProvider>
  );
}
