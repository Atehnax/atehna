import AdminPodobaTabs from '@/admin/features/podoba/components/AdminPodobaTabs';
import { AdminPageHeader, AdminPlaceholderCard } from '@/shared/ui/admin-primitives';

export const metadata = {
  title: 'Administracija vizualna podoba'
};

export default function AdminPodobaVizualnoPage() {
  return (
    <div className="space-y-5">
      <AdminPageHeader title="Podoba" description="Urejanje vizualnih nastavitev." />
      <AdminPodobaTabs />
      <AdminPlaceholderCard title="Vizualna podoba" description="Ta modul je v pripravi." />
    </div>
  );
}
