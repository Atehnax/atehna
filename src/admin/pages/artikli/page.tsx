import AdminItemsManagerLoader from '@/admin/components/AdminItemsManagerLoader';
import { buildSeedItems } from '@/admin/features/artikli/lib/seedItems';
import { instrumentAdminRouteRender } from '@/shared/server/catalogDiagnostics';
import { AdminPageHeader } from '@/shared/ui/admin-primitives';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Administracija artikli'
};

async function AdminItemsManagerSection() {
  return instrumentAdminRouteRender('/admin/artikli', async () => {
    const seedItems = await buildSeedItems();
    return <AdminItemsManagerLoader seedItems={seedItems} />;
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
