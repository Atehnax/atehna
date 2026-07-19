import AdminLogoPageClient from '@/admin/features/podoba/components/AdminLogoPageClient';
import { getSiteLogoConfig } from '@/shared/server/siteLogo';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Administracija logotip'
};

export default async function AdminPodobaLogotipPage() {
  return <AdminLogoPageClient initialConfig={await getSiteLogoConfig()} />;
}
