import AdminCategoriesRuntimeGate from '@/admin/features/kategorije/components/AdminCategoriesRuntimeGate';
import { getCatalogPreviewDataFromDatabase } from '@/shared/server/catalogCategories';
import { instrumentAdminRouteRender, profilePayloadEstimate, profileRoutePhase } from '@/shared/server/catalogDiagnostics';

export const dynamic = 'force-dynamic';

export default async function AdminCategoriesPreviewPage() {
  return instrumentAdminRouteRender('/admin/kategorije/predogled', async () => {
    const payload = await profileRoutePhase('cache', 'AdminCategoriesPreviewPage:getCatalogAdminInitialPayloadFromDatabase', async () =>
      (await getCatalogPreviewDataFromDatabase({
        includeInactive: true,
        includeStatuses: true,
        diagnosticsContext: '/admin/kategorije/predogled'
      })) as Awaited<ReturnType<typeof getCatalogPreviewDataFromDatabase>> & { statuses: Record<string, 'active' | 'inactive'> }
    );
    await profileRoutePhase('payload', 'AdminCategoriesPreviewPage:payload', async () => {
      profilePayloadEstimate('AdminCategoriesPreviewPage:payload', payload);
    });
    return (
      <AdminCategoriesRuntimeGate
        initialView="preview"
        initialPayload={{
          categories: payload.categories.map((category) => ({
            id: category.id,
            slug: category.slug,
            title: category.title,
            summary: category.summary,
            description: category.description,
            image: category.image,
            items: [],
            subcategories: []
          })),
          statuses: payload.statuses,
          payloadMode: 'partial',
          payloadView: 'preview'
        }}
      />
    );
  });
}
