import AdminCategoriesMainTable from '@/admin/features/kategorije/components/AdminCategoriesMainTable';
import { getCatalogDataFromDatabase } from '@/shared/server/catalogCategories';
import { instrumentCatalogRouteEntry } from '@/shared/server/catalogDiagnostics';

export const dynamic = 'force-dynamic';

export default async function AdminCategoriesMillerPage() {
  return instrumentCatalogRouteEntry('/admin/kategorije/miller-view', async () => {
    const payload = await getCatalogDataFromDatabase({ includeInactive: true, includeStatuses: true, diagnosticsContext: '/admin/kategorije/miller-view' });
    return <AdminCategoriesMainTable initialView="miller" initialPayload={payload} />;
  });
}
