import AdminCategoriesPreviewPageClient from '@/admin/features/kategorije/components/AdminCategoriesPreviewPageClient';
import { getCatalogAdminInitialPayloadFromDatabase } from '@/shared/server/catalogCategories';
import { instrumentAdminRouteRender, profilePayloadEstimate, profileRoutePhase } from '@/shared/server/diagnostics/instrumentation';

export const dynamic = 'force-dynamic';

export default async function AdminCategoriesPreviewPage() {
  return instrumentAdminRouteRender('/admin/kategorije/predogled', async () => {
    const payload = await profileRoutePhase('cache', 'AdminCategoriesPreviewPage:getCatalogAdminInitialPayloadFromDatabase', async () =>
      getCatalogAdminInitialPayloadFromDatabase('preview', '/admin/kategorije/predogled')
    );
    await profileRoutePhase('payload', 'AdminCategoriesPreviewPage:payload', async () => {
      profilePayloadEstimate('AdminCategoriesPreviewPage:payload', payload);
    });
    return (
      <AdminCategoriesPreviewPageClient
        initialPayload={{
          categories: payload.categories,
          statuses: payload.statuses,
          payloadMode: 'partial',
          payloadView: 'preview'
        }}
      />
    );
  });
}
