import Link from 'next/link';
import {
  AdminOrderDocumentsSectionSkeleton,
  AdminOrderItemsSectionSkeleton
} from '@/admin/components/AdminPageSkeletons';
import Skeleton from '@/shared/ui/loading/skeleton';

export default function AdminOrderDetailLoading() {
  return (
    <div className="w-full">
      <div className="mx-auto max-w-7xl">
        <Link href="/admin/orders" className="text-sm font-semibold text-[color:var(--blue-500)] hover:text-[color:var(--blue-600)]">
          ← Nazaj na seznam
        </Link>

        <div className="mt-4 grid items-start gap-6 lg:grid-cols-[2fr_1.5fr]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-3">
                  <Skeleton className="h-8 w-40" />
                  <div className="flex flex-wrap gap-2">
                    <Skeleton className="h-7 w-24 rounded-full" />
                    <Skeleton className="h-7 w-24 rounded-full" />
                    <Skeleton className="h-7 w-28 rounded-full" />
                  </div>
                </div>
                <Skeleton className="h-10 w-36 rounded-xl" />
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-4 w-full max-w-xs" />
                  </div>
                ))}
              </div>
            </section>

            <AdminOrderItemsSectionSkeleton />
          </div>

          <aside className="w-full min-w-0 space-y-5">
            <AdminOrderDocumentsSectionSkeleton />
          </aside>
        </div>
      </div>
    </div>
  );
}
