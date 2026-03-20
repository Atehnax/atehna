import { Suspense } from 'react';
import AdminDeletedArchiveTable from '@/admin/components/AdminDeletedArchiveTable';
import AdminArchiveTabs from '@/admin/components/AdminArchiveTabs';
import { AdminArchiveSectionSkeleton } from '@/admin/components/AdminPageSkeletons';
import { fetchArchiveEntries } from '@/shared/server/deletedArchive';
import { getDatabaseUrl } from '@/shared/server/db';
import { instrumentCatalogRouteEntry } from '@/shared/server/catalogDiagnostics';

export const metadata = {
  title: 'Arhiv naročil'
};

export const dynamic = 'force-dynamic';

async function AdminArchiveTableSection() {
  return instrumentCatalogRouteEntry('/admin/arhiv', async () => {
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

    return <AdminDeletedArchiveTable initialEntries={entries} />;
  });
}

export default function AdminArchivePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Arhiv naročil</h1>
        <p className="mt-1 text-sm text-slate-600">Izbrisani zapisi se hranijo 60 dni, nato se trajno odstranijo.</p>
      </div>
      <AdminArchiveTabs />
      <Suspense fallback={<AdminArchiveSectionSkeleton />}>
        <AdminArchiveTableSection />
      </Suspense>
    </div>
  );
}
