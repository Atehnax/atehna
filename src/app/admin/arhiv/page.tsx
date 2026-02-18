import AdminDeletedArchiveTable from '@/components/admin/AdminDeletedArchiveTable';
import { fetchArchiveEntries } from '@/lib/server/deletedArchive';
import { getDatabaseUrl } from '@/lib/server/db';

export const metadata = {
  title: 'Arhiv'
};

export const dynamic = 'force-dynamic';

export default async function AdminArchivePage() {
  const entries = getDatabaseUrl()
    ? await fetchArchiveEntries('all')
    : [
        {
          id: 1,
          item_type: 'order' as const,
          order_id: 1,
          document_id: null,
          label: '#1 · Demo naročilo',
          deleted_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 2,
          item_type: 'pdf' as const,
          order_id: 1,
          document_id: 17,
          label: '#1-order-summary-v2.pdf',
          deleted_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()
        }
      ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Arhiv</h1>
        <p className="mt-1 text-sm text-slate-600">Izbrisani zapisi se hranijo 60 dni, nato se trajno odstranijo.</p>
      </div>
      <AdminDeletedArchiveTable initialEntries={entries} />
    </div>
  );
}
