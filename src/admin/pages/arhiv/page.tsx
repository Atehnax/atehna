import AdminDeletedArchiveTableLoader from '@/admin/features/arhiv/components/AdminDeletedArchiveTableLoader';
import AdminArchiveTabs from '@/admin/features/arhiv/components/AdminArchiveTabs';
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


export default async function AdminArchivePage() {
  return (
    <div className="w-full space-y-4">
      <AdminPageHeader title="Arhiv naročil" description="Izbrisani zapisi se hranijo 90 dni, nato se trajno odstranijo." />
      <AdminArchiveTabs />
      {await AdminArchiveTableSection()}
    </div>
  );
}
