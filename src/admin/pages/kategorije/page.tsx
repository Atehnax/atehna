import AdminCategoriesMainTable from '@/admin/features/kategorije/components/AdminCategoriesMainTable';
import { getCatalogDataFromDatabase } from '@/shared/server/catalogCategories';
import { instrumentAdminRouteRender } from '@/shared/server/catalogDiagnostics';

export const dynamic = 'force-dynamic';

export default async function AdminCategoriesPage() {
  return instrumentAdminRouteRender('/admin/kategorije', async () => {
    const payload = await getCatalogDataFromDatabase({ includeInactive: true, includeStatuses: true, diagnosticsContext: '/admin/kategorije' });
    return <AdminCategoriesMainTable initialView="table" initialPayload={payload} />;
  });
}
