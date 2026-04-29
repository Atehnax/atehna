import AdminItemEditorPage from '@/admin/features/artikli/components/AdminItemEditorPage';
import { instrumentAdminRouteRender } from '@/shared/server/catalogDiagnostics';

export const dynamic = 'force-dynamic';

export default async function AdminNewArticlePage({
  searchParams
}: {
  searchParams?: Promise<{ tip?: string }>;
}) {
  return instrumentAdminRouteRender('/admin/artikli/nov', async () => {
    const params = (await searchParams) ?? {};
    const createType =
      params.tip === 'variants' || params.tip === 'dimensions'
        ? 'dimensions'
        : params.tip === 'weight'
          ? 'weight'
          : params.tip === 'unique_machine'
            ? 'unique_machine'
            : 'simple';
    return <AdminItemEditorPage mode="create" createType={createType} />;
  });
}
