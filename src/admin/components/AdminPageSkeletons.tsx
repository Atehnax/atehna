import type { CSSProperties, ReactNode } from 'react';
import { AdminTableLayout } from '@/shared/ui/admin-table';
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

export function AdminDiagnosticsSectionSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-2 h-3 w-full max-w-2xl" />
        <div className="mt-3 flex flex-wrap gap-3">
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-3 w-36" />
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="rounded-xl border border-slate-200 bg-white p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-8 w-16" />
            <Skeleton className="mt-2 h-3 w-24" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="rounded-xl border border-slate-200 bg-white p-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-2 h-3 w-full max-w-sm" />
            <Skeleton className="mt-4 h-40 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminOrderItemsSectionSkeleton() {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <Skeleton className="h-6 w-36" />
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <Skeleton className="h-4 w-24" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-8 rounded-xl" />
            <Skeleton className="h-8 w-8 rounded-xl" />
            <Skeleton className="h-8 w-8 rounded-xl" />
          </div>
        </div>
        <TableSkeleton rows={6} cols={5} hasActions className="border-0" />
      </div>
    </section>
  );
}

export function AdminOrderDocumentsSectionSkeleton() {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-8 w-20 rounded-xl" />
      </div>
      <div className="mt-5 space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="mt-2 h-3 w-full max-w-[220px]" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-8 w-8 rounded-xl" />
                <Skeleton className="h-8 w-8 rounded-xl" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}


const categoryTableColumnSkeletonWidths = ['24px', '180px', 'minmax(240px, 1fr)', '80px', '80px', '96px', '96px'];

function CategoryTabsSkeleton({ initialView }: { initialView: 'table' | 'preview' | 'miller' }) {
  return (
    <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
      <Skeleton className={`h-9 rounded-lg ${initialView === 'table' ? 'w-28' : 'w-24'}`} />
      <Skeleton className={`ml-1 h-9 rounded-lg ${initialView === 'preview' ? 'w-28' : 'w-24'}`} />
      <Skeleton className={`ml-1 h-9 rounded-lg ${initialView === 'miller' ? 'w-32' : 'w-28'}`} />
    </div>
  );
}

function CategoryTableSkeleton() {
  return (
    <AdminTableLayout
      className="border"
      contentClassName="overflow-x-auto"
      headerLeft={<Skeleton className="h-10 min-w-[260px] flex-1 rounded-xl" />}
      headerRight={
        <>
          <Skeleton className="h-10 w-24 rounded-xl" />
          <Skeleton className="h-10 w-36 rounded-xl" />
          <Skeleton className="h-10 w-10 rounded-xl" />
        </>
      }
    >
      <div className="overflow-hidden">
        <div
          className="grid min-w-[1324px] border-x border-b border-slate-200 bg-slate-50/90"
          style={{ gridTemplateColumns: categoryTableColumnSkeletonWidths.join(' ') }}
        >
          {['', 'Kategorija', 'Opis', 'Podkategorije', 'Izdelki', 'Vidnost', 'Uredi'].map((label, index) => (
            <div key={`head-${index}`} className="border-b border-slate-200 px-3 py-3">
              {label ? <Skeleton className="h-3.5 w-20" /> : <Skeleton className="mx-auto h-4 w-4 rounded-sm" />}
            </div>
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, rowIndex) => (
          <div
            key={`row-${rowIndex}`}
            className="grid min-w-[1324px] border-x border-b border-slate-200 bg-white"
            style={{ gridTemplateColumns: categoryTableColumnSkeletonWidths.join(' ') }}
          >
            <div className="flex items-center justify-center px-3 py-3">
              <Skeleton className="h-4 w-4 rounded-sm" />
            </div>
            <div className="flex items-center gap-3 px-3 py-3">
              <Skeleton className="h-4 w-4 rounded-sm" />
              <Skeleton className={`h-4 ${rowIndex % 3 === 0 ? 'w-40' : rowIndex % 3 === 1 ? 'w-32' : 'w-48'}`} />
            </div>
            <div className="px-3 py-3">
              <Skeleton className="h-4 w-full" />
            </div>
            <div className="flex items-center justify-center px-3 py-3">
              <Skeleton className="h-4 w-10" />
            </div>
            <div className="flex items-center justify-center px-3 py-3">
              <Skeleton className="h-4 w-10" />
            </div>
            <div className="flex items-center justify-center px-3 py-3">
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <div className="flex items-center justify-center gap-2 px-3 py-3">
              <Skeleton className="h-8 w-8 rounded-xl" />
              <Skeleton className="h-8 w-8 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </AdminTableLayout>
  );
}

function CategoryPreviewCardSkeleton({ showAddButton = false }: { showAddButton?: boolean }) {
  return (
    <div className="flex h-full min-h-[280px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="aspect-[4/3] border-b border-slate-200 bg-slate-50 p-3">
        <Skeleton className="h-full w-full rounded-xl" />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="mt-2 h-3.5 w-full" />
            <Skeleton className="mt-1.5 h-3.5 w-2/3" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-8 rounded-xl" />
            <Skeleton className="h-8 w-8 rounded-xl" />
          </div>
        </div>
        <div className="mt-auto pt-4">
          {showAddButton ? <Skeleton className="h-10 w-full rounded-xl" /> : <Skeleton className="h-9 w-24 rounded-xl" />}
        </div>
      </div>
    </div>
  );
}

function CategoryPreviewSkeleton() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <Skeleton className="h-5 w-24" />
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-4 w-28 rounded-full" />
            <Skeleton className="h-4 w-4" />
          </div>
          <Skeleton className="h-9 w-9 rounded-xl" />
          <Skeleton className="h-10 w-36 rounded-xl" />
        </div>
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' } as CSSProperties}>
        {Array.from({ length: 10 }).map((_, index) => (
          <CategoryPreviewCardSkeleton key={index} showAddButton={index === 9} />
        ))}
      </div>
    </section>
  );
}

function CategoryMillerSkeleton() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="ml-[30px] min-w-0 flex-1">
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-[280px] rounded-xl" />
          <Skeleton className="h-10 w-36 rounded-xl" />
          <Skeleton className="h-10 w-10 rounded-xl" />
          <Skeleton className="h-10 w-10 rounded-xl" />
          <Skeleton className="h-10 w-10 rounded-xl" />
        </div>
      </div>
      <div className="flex items-stretch gap-0 overflow-hidden pb-1">
        {Array.from({ length: 4 }).map((_, columnIndex) => (
          <div key={columnIndex} className="min-w-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-white px-2.5 py-2">
              <Skeleton className="h-3.5 w-20" />
            </div>
            <div className="h-[520px] space-y-2 p-1.5">
              {Array.from({ length: 9 }).map((_, rowIndex) => (
                <div key={rowIndex} className="rounded-lg border border-slate-200 px-3 py-2.5">
                  <div className="grid grid-cols-3 items-center gap-x-3">
                    <Skeleton className="col-span-2 h-4 w-24" />
                    <Skeleton className="justify-self-end h-3.5 w-14" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function AdminCategoriesRouteSkeleton({ initialView }: { initialView: 'table' | 'preview' | 'miller' }) {
  return (
    <AdminSectionShell
      title="Kategorije"
      description="Top: povezano drevo levo → desno. Bottom: vsebina izbrane kategorije v storefront admin pogledu."
    >
      <CategoryTabsSkeleton initialView={initialView} />
      {initialView === 'table' ? <CategoryTableSkeleton /> : null}
      {initialView === 'preview' ? <CategoryPreviewSkeleton /> : null}
      {initialView === 'miller' ? <CategoryMillerSkeleton /> : null}
    </AdminSectionShell>
  );
}
