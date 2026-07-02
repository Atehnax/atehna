import AdminArchiveTabs from '@/admin/features/arhiv/components/AdminArchiveTabs';
import { AdminPageHeader } from '@/shared/ui/admin-primitives';
import {
  adminTableCardClassName,
  adminTableCardStyle,
  adminTableContentClassName,
  adminTableHeaderClassName,
  AdminTableLayout
} from '@/shared/ui/admin-table';
import { Skeleton, TableSkeleton } from '@/shared/ui/loading';

export default function AdminPodobaArchiveLoading() {
  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Arhiv podobe"
        description="Zadnje shranjene spremembe glavne navigacije."
      />
      <AdminArchiveTabs />
      <AdminTableLayout
        className={`w-full ${adminTableCardClassName}`}
        style={adminTableCardStyle}
        headerClassName={adminTableHeaderClassName}
        contentClassName={`${adminTableContentClassName} overflow-y-visible`}
        showDivider={false}
        headerLeft={<Skeleton className="h-9 w-full max-w-[320px]" />}
        headerRight={<Skeleton className="h-9 w-9" />}
        filterRowRight={<Skeleton className="h-8 w-[220px]" />}
        footerRight={<Skeleton className="h-8 w-[220px]" />}
      >
        <TableSkeleton rows={8} cols={6} className="rounded-none border-0" />
      </AdminTableLayout>
    </div>
  );
}
