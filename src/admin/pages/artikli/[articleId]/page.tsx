import AdminItemEditorPage from '@/admin/features/artikli/components/AdminItemEditorPage';
import { fetchCatalogItemEditorBySlug } from '@/shared/server/catalogItems';
import { instrumentAdminRouteRender } from '@/shared/server/catalogDiagnostics';

export const dynamic = 'force-dynamic';

export default async function AdminEditArticlePage({
  params
}: {
  params: Promise<{ articleId: string }>;
}) {
  return instrumentAdminRouteRender('/admin/artikli/[articleId]', async () => {
    const { articleId } = await params;
    const slug = decodeURIComponent(articleId);
    const initialData = await fetchCatalogItemEditorBySlug(slug);
    return <AdminItemEditorPage mode="edit" articleId={slug} initialData={initialData} />;
  });
}
