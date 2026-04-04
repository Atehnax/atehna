import AdminDeletedArchiveTableLoader from '@/admin/components/AdminDeletedArchiveTableLoader';
import AdminArchiveTabs from '@/admin/components/AdminArchiveTabs';
import { fetchArchiveEntries } from '@/shared/server/deletedArchive';
import { instrumentAdminRouteRender, profilePayloadEstimate, profileRoutePhase } from '@/shared/server/catalogDiagnostics';
import { getDatabaseUrl } from '@/shared/server/db';
import { AdminPageHeader } from '@/shared/ui/admin-primitives';


export const metadata = {
  title: 'Arhiv naročil'
};

export const dynamic = 'force-dynamic';

async function AdminArchiveTableSection() {
  return instrumentAdminRouteRender('/admin/arhiv', async () => {
    const entries = getDatabaseUrl()
    ? await profileRoutePhase('db', 'AdminArchiveTableSection:fetchArchiveEntries', () => fetchArchiveEntries('all'))
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
    const compactEntries = entries.map((entry) => [
      entry.id,
      entry.item_type,
      entry.order_id,
      entry.document_id,
      entry.label,
      entry.deleted_at,
      entry.expires_at
    ] as const);

    await profileRoutePhase('payload', 'AdminArchiveTableSection:entries', async () => {
      profilePayloadEstimate('AdminArchiveTableSection:entries', compactEntries);
    });
    return <AdminDeletedArchiveTableLoader initialEntries={compactEntries} />;
  });
}


export default async function AdminArchivePage() {
  return (
    <div className="w-full space-y-4">
      <AdminPageHeader title="Arhiv naročil" description="Izbrisani zapisi se hranijo 60 dni, nato se trajno odstranijo." />
      <AdminArchiveTabs />
      {await AdminArchiveTableSection()}
    </div>
  );
}
