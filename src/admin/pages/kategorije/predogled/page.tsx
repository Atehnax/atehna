import AdminCategoriesPreviewPageClient from '@/admin/features/kategorije/components/AdminCategoriesPreviewPageClient';
import { getCatalogPreviewDataFromDatabase } from '@/shared/server/catalogCategories';

export const dynamic = 'force-dynamic';

export default async function AdminCategoriesPreviewPage() {
  const payload = (await getCatalogPreviewDataFromDatabase({
    includeInactive: true,
    includeStatuses: true,
    diagnosticsContext: '/admin/kategorije/predogled'
  })) as Awaited<ReturnType<typeof getCatalogPreviewDataFromDatabase>> & { statuses: Record<string, 'active' | 'inactive'> };

  return (
    <AdminCategoriesPreviewPageClient
      initialPayload={{
        categories: payload.categories,
        statuses: payload.statuses,
        payloadMode: 'full',
        payloadView: 'preview'
      }}
    />
  );
}
