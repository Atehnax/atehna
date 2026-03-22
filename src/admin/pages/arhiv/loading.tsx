import AdminArchiveTabs from '@/admin/components/AdminArchiveTabs';
import { AdminArchiveSectionSkeleton } from '@/admin/components/AdminPageSkeletons';

export default function AdminArchiveLoading() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Arhiv naročil</h1>
        <p className="mt-1 text-sm text-slate-600">Izbrisani zapisi se hranijo 60 dni, nato se trajno odstranijo.</p>
      </div>
      <AdminArchiveTabs />
      <AdminArchiveSectionSkeleton />
    </div>
  );
}
