import AdminDeletedArchiveTable from '@/admin/features/arhiv/components/AdminDeletedArchiveTable';
import type { ArchiveEntryTuple } from '@/shared/domain/archive/archiveTypes';

export default function AdminDeletedArchiveTableLoader({ initialEntries }: { initialEntries: ArchiveEntryTuple[] }) {
  return <AdminDeletedArchiveTable initialEntries={initialEntries} />;
}
