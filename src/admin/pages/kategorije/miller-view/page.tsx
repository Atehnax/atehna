import AdminCategoriesMainTable from '@/admin/features/kategorije/components/AdminCategoriesMainTable';
import { getCatalogDataFromDatabase } from '@/shared/server/catalogCategories';
import { instrumentAdminRouteRender, profilePayloadEstimate, profileRoutePhase } from '@/shared/server/catalogDiagnostics';

export const dynamic = 'force-dynamic';

export default async function AdminCategoriesMillerPage() {
  return instrumentAdminRouteRender('/admin/kategorije/miller-view', async () => {
    const payload = await profileRoutePhase('cache', 'AdminCategoriesMillerPage:getCatalogDataFromDatabase', () =>
      getCatalogDataFromDatabase({ includeInactive: true, includeStatuses: true, diagnosticsContext: '/admin/kategorije/miller-view' })
    );
    await profileRoutePhase('payload', 'AdminCategoriesMillerPage:payload', async () => {
      profilePayloadEstimate('AdminCategoriesMillerPage:payload', payload);
    });
    return <AdminCategoriesMainTable initialView="miller" initialPayload={payload} />;
  });
}
