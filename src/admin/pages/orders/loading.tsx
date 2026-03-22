import { AdminOrdersSectionSkeleton } from '@/admin/components/AdminPageSkeletons';

export default function AdminOrdersLoading() {
  return (
    <div className="w-full">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Pregled naročil</h1>
            <p className="mt-1 text-sm text-slate-500">Pregled in urejanje naročil.</p>
          </div>
        </div>
        <AdminOrdersSectionSkeleton />
      </div>
    </div>
  );
}
