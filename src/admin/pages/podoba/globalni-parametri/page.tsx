import AdminGlobalStylePageClient from '@/admin/features/podoba/components/AdminGlobalStylePageClient';
import { getGlobalStyleConfig } from '@/shared/server/globalStyle';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Administracija globalni parametri'
};

export default async function AdminPodobaGlobalniParametriPage() {
  return <AdminGlobalStylePageClient initialConfig={await getGlobalStyleConfig()} />;
}
