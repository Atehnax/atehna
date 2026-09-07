import AdminDeletedArchiveTableLoader from '@/admin/features/arhiv/components/AdminDeletedArchiveTableLoader';
import AdminArchivedItemsTable from '@/admin/features/arhiv/components/AdminArchivedItemsTable';
import AdminTrashTabs from '@/admin/features/arhiv/components/AdminTrashTabs';
import { fetchArchiveEntries } from '@/shared/server/deletedArchive';
import { instrumentAdminRouteRender, profilePayloadEstimate, profileRoutePhase } from '@/shared/server/diagnostics/instrumentation';
import { getDatabaseUrl } from '@/shared/server/db';
import { AdminPageHeader } from '@/shared/ui/admin-primitives';


export const metadata = {
  title: 'Koš'
};

export const dynamic = 'force-dynamic';

async function AdminArchiveTableSection() {
  return instrumentAdminRouteRender('/admin/trash', async () => {
    const entries = getDatabaseUrl()
      ? await profileRoutePhase('db', 'AdminArchiveTableSection:fetchArchiveEntries', () => fetchArchiveEntries('all'))
      : [];
    const compactEntries = entries.map((entry) => [
      entry.id,
      entry.item_type,
      entry.order_id,
      entry.document_id,
      entry.label,
      entry.order_created_at,
      entry.customer_name,
      entry.address,
      entry.customer_type,
      entry.deleted_at,
      entry.expires_at
    ] as const);

    await profileRoutePhase('payload', 'AdminArchiveTableSection:entries', async () => {
      profilePayloadEstimate('AdminArchiveTableSection:entries', compactEntries);
    });
    return <AdminDeletedArchiveTableLoader initialEntries={compactEntries} />;
  });
}


export default async function AdminTrashPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const view = (await searchParams).view === 'articles' ? 'articles' : 'orders';
  return (
    <div className="w-full space-y-4">
      <AdminPageHeader title="Koš" description={view === 'articles' ? 'Izbrisani artikli z možnostjo obnove v obstoječem obdobju hrambe.' : 'Izbrisana naročila in dokumenti ostanejo na voljo za obnovo.'} />
      <AdminTrashTabs />
      {view === 'articles' ? <AdminArchivedItemsTable /> : await AdminArchiveTableSection()}
    </div>
  );
}
