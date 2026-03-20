import type { ReactNode } from 'react';
import Skeleton from '@/shared/ui/loading/skeleton';
import TableSkeleton from '@/shared/ui/loading/table-skeleton';

type SectionProps = {
  title?: string;
  description?: string;
  children: ReactNode;
};

function AdminSectionShell({ title, description, children }: SectionProps) {
  return (
    <div className="space-y-4">
      {(title || description) ? (
        <div>
          {title ? <h1 className="text-2xl font-semibold text-slate-900">{title}</h1> : null}
          {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

export function AdminOrdersSectionSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-10 w-44 rounded-xl" />
          <Skeleton className="h-10 w-36 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
        <Skeleton className="h-10 w-44 rounded-xl" />
      </div>
      <TableSkeleton rows={8} cols={8} hasActions className="border-0" />
    </div>
  );
}

export function AdminArchiveSectionSkeleton() {
  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
        <Skeleton className="h-9 w-36 rounded-lg" />
        <Skeleton className="ml-1 h-9 w-36 rounded-lg" />
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap gap-2">
          <Skeleton className="h-10 w-40 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
        <TableSkeleton rows={8} cols={5} className="border-0" />
      </div>
    </div>
  );
}

export function AdminItemsSectionSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-10 w-56 rounded-xl" />
          <Skeleton className="h-10 w-40 rounded-xl" />
          <Skeleton className="h-10 w-28 rounded-xl" />
        </div>
        <Skeleton className="h-10 w-40 rounded-xl" />
      </div>
      <TableSkeleton rows={8} cols={6} hasActions className="border-0" />
    </div>
  );
}

export function AdminAnalyticsSectionSkeleton() {
  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
        <Skeleton className="h-9 w-24 rounded-lg" />
        <Skeleton className="ml-1 h-9 w-20 rounded-lg" />
        <Skeleton className="ml-1 h-9 w-28 rounded-lg" />
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-9 w-16 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-2xl border border-slate-200 bg-white p-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-3 h-8 w-28" />
              <Skeleton className="mt-6 h-40 w-full rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AdminCategoriesRouteSkeleton({ initialView }: { initialView: 'table' | 'miller' }) {
  return (
    <AdminSectionShell
      title="Kategorije"
      description="Top: povezano drevo levo → desno. Bottom: vsebina izbrane kategorije v storefront admin pogledu."
    >
      <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
        <Skeleton className={`h-9 rounded-lg ${initialView === 'table' ? 'w-28' : 'w-24'}`} />
        <Skeleton className={`ml-1 h-9 rounded-lg ${initialView === 'miller' ? 'w-32' : 'w-28'}`} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap gap-2">
            <Skeleton className="h-10 w-52 rounded-xl" />
            <Skeleton className="h-10 w-32 rounded-xl" />
            <Skeleton className="h-10 w-28 rounded-xl" />
          </div>
          <TableSkeleton rows={8} cols={initialView === 'table' ? 5 : 3} className="border-0" />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-4 h-10 w-full rounded-xl" />
          <Skeleton className="mt-3 h-10 w-full rounded-xl" />
          <Skeleton className="mt-6 h-48 w-full rounded-xl" />
        </div>
      </div>
    </AdminSectionShell>
  );
}
