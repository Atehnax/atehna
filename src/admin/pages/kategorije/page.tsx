import AdminCategoriesTablePageClient from '@/admin/features/kategorije/components/AdminCategoriesTablePageClient';
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
    return <AdminCategoriesTablePageClient initialPayload={{ ...payload, payloadMode: 'partial', payloadView: 'table' }} />;
  });
}
