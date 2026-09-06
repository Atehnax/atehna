import AdminLogoPageClient from '@/admin/features/podoba/components/AdminLogoPageClient';
import { getLogoLibrary, getPublishedSiteLogos } from '@/shared/server/logoLibrary';
import { getSiteNavigationConfig } from '@/shared/server/siteNavigation';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Administracija logotipi' };
export default async function AdminPodobaLogotipPage() {
  const initialLibrary = await getLogoLibrary();
  const [initialPublished, navigation] = await Promise.all([getPublishedSiteLogos(), getSiteNavigationConfig()]);
  return <AdminLogoPageClient initialLibrary={initialLibrary} initialPublished={initialPublished} navigation={navigation} />;
}
