import AdminNavigationPageClient from '@/admin/features/podoba/components/AdminNavigationPageClient';
import { getGlobalStyleConfig } from '@/shared/server/globalStyle';
import { getSiteNavigationConfig } from '@/shared/server/siteNavigation';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Administracija navigacija'
};

export default async function AdminPodobaNavigacijaPage() {
  const [config, globalStyle] = await Promise.all([
    getSiteNavigationConfig(),
    getGlobalStyleConfig()
  ]);

  return <AdminNavigationPageClient initialConfig={config} initialGlobalStyle={globalStyle} />;
}
