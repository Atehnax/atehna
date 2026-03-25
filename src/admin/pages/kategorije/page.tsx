import AdminCategoriesRuntimeGate from '@/admin/features/kategorije/components/AdminCategoriesRuntimeGate';
import { getCatalogAdminInitialPayloadFromDatabase } from '@/shared/server/catalogCategories';
import { instrumentAdminRouteRender, profilePayloadEstimate, profileRoutePhase } from '@/shared/server/catalogDiagnostics';

export const dynamic = 'force-dynamic';

export default async function AdminCategoriesPage() {
  return instrumentAdminRouteRender('/admin/kategorije', async () => {
    const payload = await profileRoutePhase('cache', 'AdminCategoriesPage:getCatalogAdminInitialPayloadFromDatabase', () =>
      getCatalogAdminInitialPayloadFromDatabase('table', '/admin/kategorije')
    );
    await profileRoutePhase('payload', 'AdminCategoriesPage:payload', async () => {
      profilePayloadEstimate('AdminCategoriesPage:payload', payload);
    });
    return <AdminCategoriesRuntimeGate initialView="table" initialPayload={{ ...payload, payloadMode: 'partial', payloadView: 'table' }} />;
  });
}
