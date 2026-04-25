import type { CSSProperties, ReactNode } from 'react';
import { AdminTableLayout } from '@/shared/ui/admin-table';
import Skeleton from '@/shared/ui/loading/skeleton';
import TableSkeleton from '@/shared/ui/loading/table-skeleton';
import { columnWidths } from '@/admin/components/adminOrdersTableUtils';

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
          {title ? <h1 className="text-2xl font-semibold leading-8 text-slate-900">{title}</h1> : null}
          {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

function AdminOrdersSectionSkeleton() {
  return (
    <AdminTableLayout
      className="border"
      style={{
        background: 'linear-gradient(180deg, rgba(250,251,252,0.96) 0%, rgba(242,244,247,0.96) 100%)',
        borderColor: '#e2e8f0',
        boxShadow: '0 10px 24px rgba(15,23,42,0.06)'
      }}
      contentClassName="overflow-x-auto"
      headerLeft={
        <>
          <Skeleton className="h-8 min-w-[175px] rounded-xl" />
          <Skeleton className="h-8 min-w-[260px] flex-1 rounded-xl" />
          <Skeleton className="h-8 min-w-[260px] rounded-xl" />
        </>
      }
      headerRight={
        <>
          <Skeleton className="h-8 w-[76px] rounded-xl" />
          <Skeleton className="h-8 w-[140px] rounded-xl" />
        </>
      }
      filterRowLeft={<Skeleton className="h-8 w-[220px] rounded-xl" />}
      filterRowRight={
        <>
          <Skeleton className="h-8 w-[130px] rounded-xl" />
          <Skeleton className="h-8 w-[90px] rounded-xl" />
        </>
      }
      footerRight={<Skeleton className="h-8 w-[90px] rounded-xl" />}
    >
      <table className="min-w-[1250px] w-full border-collapse">
        <colgroup>
          <col style={{ width: columnWidths.selectAndDelete }} />
          <col style={{ width: columnWidths.order }} />
          <col style={{ width: columnWidths.date }} />
          <col style={{ width: columnWidths.customer }} />
          <col />
          <col style={{ width: columnWidths.type }} />
          <col style={{ width: columnWidths.status }} />
          <col style={{ width: columnWidths.payment }} />
          <col style={{ width: columnWidths.total }} />
          <col style={{ width: columnWidths.documents }} />
          <col style={{ width: columnWidths.edit }} />
        </colgroup>
        <thead>
          <tr className="h-11 border-b border-slate-200 bg-[color:var(--admin-table-header-bg)]">
            {Array.from({ length: 11 }).map((_, index) => (
              <th key={`orders-head-${index}`} className="px-2 text-center">
                <Skeleton className={index === 0 ? 'mx-auto h-4 w-4 rounded-sm' : 'mx-auto h-3 w-16'} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 10 }).map((_, rowIndex) => (
            <tr key={`orders-row-${rowIndex}`} className="h-[58px] border-b border-slate-200 bg-white">
              {Array.from({ length: 11 }).map((_, cellIndex) => (
                <td key={`orders-cell-${rowIndex}-${cellIndex}`} className="px-2 py-2">
                  <Skeleton className={cellIndex === 0 ? 'mx-auto h-4 w-4 rounded-sm' : 'h-4 w-full'} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </AdminTableLayout>
  );
}

function AdminArchiveSectionSkeleton() {
  return (
    <AdminTableLayout
      className="border-slate-200 bg-white"
      headerLeft={<Skeleton className="h-8 min-w-[140px] w-[140px] rounded-lg" />}
      headerRight={
        <>
          <Skeleton className="h-8 w-[92px] rounded-xl" />
          <Skeleton className="h-8 w-[118px] rounded-xl" />
        </>
      }
      contentClassName="overflow-x-auto"
    >
      <table className="w-full table-fixed border-collapse text-sm">
        <thead>
          <tr className="h-11 border-b border-slate-200 bg-[color:var(--admin-table-header-bg)]">
            <th className="w-10 px-2 text-center"><Skeleton className="mx-auto h-4 w-4 rounded-sm" /></th>
            <th className="w-28 px-2 text-left"><Skeleton className="h-3.5 w-12" /></th>
            <th className="px-2 text-left"><Skeleton className="h-3.5 w-14" /></th>
            <th className="w-44 px-2 text-left"><Skeleton className="h-3.5 w-16" /></th>
            <th className="w-44 px-2 text-left"><Skeleton className="h-3.5 w-12" /></th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 10 }).map((_, index) => (
            <tr key={`archive-row-${index}`} className="h-[41px] border-b border-slate-100 bg-white">
              <td className="px-0 py-2 text-center"><Skeleton className="mx-auto h-4 w-4 rounded-sm" /></td>
              <td className="px-0 py-2"><Skeleton className="h-3.5 w-16" /></td>
              <td className="px-0 py-2"><Skeleton className={`h-3.5 ${index % 2 === 0 ? 'w-52' : 'w-64'}`} /></td>
              <td className="px-0 py-2"><Skeleton className="h-3.5 w-28" /></td>
              <td className="px-0 py-2"><Skeleton className="h-3.5 w-28" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </AdminTableLayout>
  );
}

function AdminItemsSectionSkeleton() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Artikli</h1>
      </div>
      <AdminTableLayout
        className="border shadow-sm"
        style={{
          background: 'linear-gradient(180deg, rgba(250,251,252,0.96) 0%, rgba(242,244,247,0.96) 100%)',
          borderColor: '#e2e8f0',
          boxShadow: '0 10px 24px rgba(15,23,42,0.06)'
        }}
        headerLeft={
          <>
            <Skeleton className="h-8 min-w-[240px] flex-1 rounded-xl" />
            <Skeleton className="h-8 min-w-[220px] w-[220px] rounded-xl" />
          </>
        }
        headerRight={
          <>
            <Skeleton className="h-8 w-[74px] rounded-xl" />
            <Skeleton className="h-8 w-[84px] rounded-xl" />
          </>
        }
        filterRowLeft={<Skeleton className="h-8 w-[240px] rounded-full" />}
        filterRowRight={
          <>
            <Skeleton className="h-8 w-[64px] rounded-xl" />
            <Skeleton className="h-8 w-[82px] rounded-xl" />
          </>
        }
        contentClassName="overflow-x-auto"
        footerRight={<Skeleton className="h-8 w-[82px] rounded-xl" />}
      >
        <table className="min-w-[1000px] w-full border-collapse text-sm">
          <thead>
            <tr className="h-11 border-b border-slate-200 bg-[color:var(--admin-table-header-bg)]">
              {Array.from({ length: 9 }).map((_, index) => (
                <th key={`items-head-${index}`} className="px-3 text-center">
                  <Skeleton className={index === 0 ? 'mx-auto h-4 w-4 rounded-sm' : 'mx-auto h-3.5 w-16'} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 10 }).map((_, rowIndex) => (
              <tr key={`items-row-${rowIndex}`} className="h-[41px] border-t border-slate-200 bg-white">
                {Array.from({ length: 9 }).map((_, cellIndex) => (
                  <td key={`items-cell-${rowIndex}-${cellIndex}`} className="px-3 py-2">
                    {cellIndex === 8 ? (
                      <div className="flex items-center justify-center gap-1.5">
                        <Skeleton className="h-8 w-8 rounded-xl" />
                        <Skeleton className="h-8 w-8 rounded-xl" />
                        <Skeleton className="h-8 w-8 rounded-xl" />
                      </div>
                    ) : (
                      <Skeleton className={cellIndex === 0 ? 'mx-auto h-4 w-4 rounded-sm' : 'h-3.5 w-full'} />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </AdminTableLayout>
    </div>
  );
}

function AdminAnalyticsSectionSkeleton() {
  return (
    <div className="min-h-full rounded-2xl border border-slate-200 p-4 text-slate-900">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <Skeleton className="h-7 w-52" />
          <Skeleton className="mt-1 h-3.5 w-36" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-[230px] rounded-lg" />
          <Skeleton className="h-8 w-[86px] rounded-md" />
          <Skeleton className="h-8 w-[90px] rounded-md" />
          <Skeleton className="h-8 w-[78px] rounded-md" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-slate-200 bg-white p-4">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="mt-2 h-3.5 w-64" />
            <div className="mt-4 h-[312px] w-full rounded-xl border border-slate-100 p-3">
              <Skeleton className="h-full w-full rounded-lg" />
            </div>
          </div>
        ))}
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
    <div className="relative inline-flex items-end gap-5">
      <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-slate-300" />
      <Skeleton className={`relative z-10 h-7 ${initialView === 'table' ? 'w-20' : 'w-16'}`} />
      <Skeleton className={`relative z-10 h-7 ${initialView === 'preview' ? 'w-20' : 'w-16'}`} />
      <Skeleton className={`relative z-10 h-7 ${initialView === 'miller' ? 'w-24' : 'w-20'}`} />
    </div>
  );
}

function AdminCategoriesTableContentSkeleton() {
  return (
    <AdminTableLayout
      className="border"
      contentClassName="overflow-x-auto"
      headerLeft={<Skeleton className="h-7 min-w-[260px] flex-1 rounded-md" />}
      headerRight={
        <>
          <Skeleton className="h-7 w-7 rounded-md" />
          <Skeleton className="h-7 w-7 rounded-md" />
          <Skeleton className="h-7 w-7 rounded-md" />
          <Skeleton className="h-7 w-[52px] rounded-md" />
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

function AdminCategoriesPreviewContentSkeleton() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <Skeleton className="h-5 w-16" />
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-[92px] flex-col justify-center gap-[9px]">
            <Skeleton className="h-[10px] w-20" />
            <Skeleton className="h-1 w-[92px] rounded-full" />
          </div>
          <Skeleton className="h-7 w-7 rounded-md" />
          <Skeleton className="h-7 w-[52px] rounded-md" />
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

function AdminCategoriesMillerContentSkeleton() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="ml-[30px] min-w-0 flex-1">
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-[320px] max-w-[36vw] rounded-md" />
          <Skeleton className="h-7 w-7 rounded-md" />
          <Skeleton className="h-7 w-7 rounded-md" />
          <Skeleton className="h-7 w-7 rounded-md" />
          <Skeleton className="h-7 w-7 rounded-md" />
          <Skeleton className="h-7 w-[52px] rounded-md" />
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
    <AdminSectionShell title="Kategorije">
      <CategoryTabsSkeleton initialView={initialView} />
      {initialView === 'table' ? <AdminCategoriesTableContentSkeleton /> : null}
      {initialView === 'preview' ? <AdminCategoriesPreviewContentSkeleton /> : null}
      {initialView === 'miller' ? <AdminCategoriesMillerContentSkeleton /> : null}
    </AdminSectionShell>
  );
}
