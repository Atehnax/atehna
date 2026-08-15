import AdminArchiveTabs from '@/admin/features/arhiv/components/AdminArchiveTabs';
import AdminArchivedItemsTable from '@/admin/features/arhiv/components/AdminArchivedItemsTable';

export const metadata = {
  title: 'Izbrisani artikli'
};

export default function AdminArchiveItemsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Izbrisani artikli</h1>
        <p className="mt-1 text-sm text-slate-600">
          Izbrisane artikle lahko obnovite 90 dni; trajni izbris je na voljo po poteku hrambe.
        </p>
      </div>
      <AdminArchiveTabs />
      <AdminArchivedItemsTable />
    </div>
  );
}
