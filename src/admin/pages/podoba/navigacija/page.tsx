import AdminNavigationPageClient from '@/admin/features/podoba/components/AdminNavigationPageClient';
import { getSiteNavigationConfig } from '@/shared/server/siteNavigation';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Administracija navigacija'
};

export default async function AdminPodobaNavigacijaPage() {
  const config = await getSiteNavigationConfig();
  return <AdminNavigationPageClient initialConfig={config} />;
}
