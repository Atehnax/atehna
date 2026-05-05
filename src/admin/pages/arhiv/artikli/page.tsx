import AdminArchiveTabs from '@/admin/features/arhiv/components/AdminArchiveTabs';
import AdminArchivedItemsTable from '@/admin/features/arhiv/components/AdminArchivedItemsTable';

export const metadata = {
  title: 'Arhiv artiklov'
};

export default function AdminArchiveItemsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Arhiv artiklov</h1>
        <p className="mt-1 text-sm text-slate-600">Seznam arhiviranih artiklov z možnostjo obnovitve ali trajnega izbrisa.</p>
      </div>
      <AdminArchiveTabs />
      <AdminArchivedItemsTable />
    </div>
  );
}
