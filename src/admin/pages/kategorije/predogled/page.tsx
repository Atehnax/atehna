import AdminCategoriesPreviewPageClient from './AdminCategoriesPreviewPageClient';
import { getAdminPreviewPayloadFromDatabase } from '@/shared/server/catalogCategories';
import { instrumentAdminRouteRender, profilePayloadEstimate, profileRoutePhase } from '@/shared/server/catalogDiagnostics';

export const dynamic = 'force-dynamic';

export default async function AdminCategoriesPreviewPage() {
  return instrumentAdminRouteRender('/admin/kategorije/predogled', async () => {
    const payload = await profileRoutePhase('cache', 'AdminCategoriesPreviewPage:getCatalogDataFromDatabase', () =>
      getAdminPreviewPayloadFromDatabase('/admin/kategorije/predogled')
    );
    await profileRoutePhase('payload', 'AdminCategoriesPreviewPage:payload', async () => {
      profilePayloadEstimate('AdminCategoriesPreviewPage:payload', payload);
    });
    return <AdminCategoriesPreviewPageClient initialPayload={payload} />;
  });
}
