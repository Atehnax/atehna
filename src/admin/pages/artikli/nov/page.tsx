import AdminItemEditorPage from '@/admin/features/artikli/components/AdminItemEditorPage';
import { buildSeedItems } from '@/admin/features/artikli/lib/seedItems';
import { instrumentAdminRouteRender } from '@/shared/server/catalogDiagnostics';

export const dynamic = 'force-dynamic';

export default async function AdminNewArticlePage({
  searchParams
}: {
  searchParams?: Promise<{ tip?: string }>;
}) {
  return instrumentAdminRouteRender('/admin/artikli/nov', async () => {
    const params = (await searchParams) ?? {};
    const createType = params.tip === 'variants' ? 'variants' : 'simple';
    const seedItems = await buildSeedItems();
    return <AdminItemEditorPage seedItems={seedItems} mode="create" createType={createType} />;
  });
}
