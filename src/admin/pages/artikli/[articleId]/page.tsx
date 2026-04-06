import AdminItemEditorPage from '@/admin/features/artikli/components/AdminItemEditorPage';
import { buildSeedItems } from '@/admin/features/artikli/lib/seedItems';
import { instrumentAdminRouteRender } from '@/shared/server/catalogDiagnostics';

export const dynamic = 'force-dynamic';

export default async function AdminEditArticlePage({
  params
}: {
  params: Promise<{ articleId: string }>;
}) {
  return instrumentAdminRouteRender('/admin/artikli/[articleId]', async () => {
    const { articleId } = await params;
    const seedItems = await buildSeedItems();
    return <AdminItemEditorPage seedItems={seedItems} mode="edit" articleId={decodeURIComponent(articleId)} />;
  });
}
