import AdminCategoriesMainTable from '@/admin/features/kategorije/components/AdminCategoriesMainTable';
import { getCatalogDataFromDatabase } from '@/shared/server/catalogCategories';
import { instrumentAdminRouteRender, profilePayloadEstimate, profileRoutePhase } from '@/shared/server/catalogDiagnostics';

export const dynamic = 'force-dynamic';

export default async function AdminCategoriesPage() {
  return instrumentAdminRouteRender('/admin/kategorije', async () => {
    const payload = await profileRoutePhase('cache', 'AdminCategoriesPage:getCatalogDataFromDatabase', () =>
      getCatalogDataFromDatabase({ includeInactive: true, includeStatuses: true, diagnosticsContext: '/admin/kategorije' })
    );
    await profileRoutePhase('payload', 'AdminCategoriesPage:payload', async () => {
      profilePayloadEstimate('AdminCategoriesPage:payload', payload);
    });
    return <AdminCategoriesMainTable initialView="table" initialPayload={payload} />;
  });
}
