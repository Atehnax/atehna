import AdminArchiveTabs from '@/admin/features/arhiv/components/AdminArchiveTabs';
import AdminPodobaArchiveTable from '@/admin/features/arhiv/components/AdminPodobaArchiveTable';
import { fetchSiteNavigationChangeLog } from '@/shared/server/siteNavigation';
import { AdminPageHeader } from '@/shared/ui/admin-primitives';

export const metadata = {
  title: 'Arhiv podobe'
};

export const dynamic = 'force-dynamic';

export default async function AdminPodobaArchivePage() {
  const entries = await fetchSiteNavigationChangeLog();

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Arhiv podobe"
        description="Zadnje shranjene spremembe glavne navigacije."
      />
      <AdminArchiveTabs />
      <AdminPodobaArchiveTable entries={entries} />
    </div>
  );
}
