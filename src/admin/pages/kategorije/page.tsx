import AdminCategoriesTablePageLoader from '@/admin/components/AdminCategoriesTablePageLoader';
import { getCatalogAdminInitialPayloadFromDatabase } from '@/shared/server/catalogCategories';

export const dynamic = 'force-dynamic';

export default async function AdminCategoriesPage() {
  const payload = await getCatalogAdminInitialPayloadFromDatabase('table', '/admin/kategorije');
  return <AdminCategoriesTablePageLoader initialPayload={{ ...payload, payloadMode: 'full', payloadView: 'table' }} />;
}
