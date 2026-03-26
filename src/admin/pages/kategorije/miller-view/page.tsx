import AdminCategoriesMillerPageClient from '@/admin/features/kategorije/components/AdminCategoriesMillerPageClient';
import { getCatalogAdminInitialPayloadFromDatabase } from '@/shared/server/catalogCategories';

export const dynamic = 'force-dynamic';

export default async function AdminCategoriesMillerPage() {
  const payload = await getCatalogAdminInitialPayloadFromDatabase('miller', '/admin/kategorije/miller-view');
  return <AdminCategoriesMillerPageClient initialPayload={{ ...payload, payloadMode: 'full', payloadView: 'miller' }} />;
}
