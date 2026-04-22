import AdminItemsManagerLoader from '@/admin/components/AdminItemsManagerLoader';
import { fetchAdminCatalogListItems } from '@/shared/server/catalogItems';
import { instrumentAdminRouteRender } from '@/shared/server/catalogDiagnostics';
import { getDatabaseUrl, isDatabaseUnavailableError } from '@/shared/server/db';
import { AdminPageHeader } from '@/shared/ui/admin-primitives';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Administracija artikli'
};

async function AdminItemsManagerSection() {
  return instrumentAdminRouteRender('/admin/artikli', async () => {
    let warningMessage: string | null = null;

    if (!getDatabaseUrl()) {
      warningMessage = 'Povezava z bazo ni nastavljena. Prikazan je prazen pogled artiklov.';
      return (
        <div className="space-y-4">
          <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50 p-6 text-sm text-amber-700">
            {warningMessage}
          </div>
          <AdminItemsManagerLoader items={[]} />
        </div>
      );
    }

    try {
      const items = await fetchAdminCatalogListItems();
      return <AdminItemsManagerLoader items={items} />;
    } catch (error) {
      if (!isDatabaseUnavailableError(error)) throw error;

      console.error('Failed to load /admin/artikli data', error);
      warningMessage =
        'Podatkov trenutno ni mogoče naložiti. Prikazan je prazen pogled artiklov, dokler povezava z bazo ne deluje.';

      return (
        <div className="space-y-4">
          <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50 p-6 text-sm text-amber-700">
            {warningMessage}
          </div>
          <AdminItemsManagerLoader items={[]} />
        </div>
      );
    }
  });
}


export default async function AdminArtikliPage() {
  return (
    <div className="w-full space-y-4">
      <AdminPageHeader title="Artikli" description="Urejanje artiklov, statusov in prikaza v katalogu." />
      {await AdminItemsManagerSection()}
    </div>
  );
}
