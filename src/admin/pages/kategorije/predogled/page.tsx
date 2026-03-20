import AdminCategoriesMainTable from '@/admin/features/kategorije/components/AdminCategoriesMainTable';
import { getCatalogDataFromDatabase } from '@/shared/server/catalogCategories';
import { instrumentAdminRouteRender, profilePayloadEstimate, profileRoutePhase } from '@/shared/server/catalogDiagnostics';

export const dynamic = 'force-dynamic';

export default async function AdminCategoriesPreviewPage() {
  return instrumentAdminRouteRender('/admin/kategorije/predogled', async () => {
    const payload = await profileRoutePhase('cache', 'AdminCategoriesPreviewPage:getCatalogDataFromDatabase', () =>
      getCatalogDataFromDatabase({ includeInactive: true, includeStatuses: true, diagnosticsContext: '/admin/kategorije/predogled' })
    );
    await profileRoutePhase('payload', 'AdminCategoriesPreviewPage:payload', async () => {
      profilePayloadEstimate('AdminCategoriesPreviewPage:payload', payload);
    });
    return <AdminCategoriesMainTable initialView="preview" initialPayload={payload} />;
  });
}
