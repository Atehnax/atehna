'use client';

import Pagination from './pagination';
import PageSizeSelect from './page-size-select';

type EuiTablePaginationProps = {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  itemsPerPage: number;
  onChangeItemsPerPage: (size: number) => void;
  itemsPerPageOptions: number[];
  className?: string;
};

export default function EuiTablePagination({
  page,
  pageCount,
  onPageChange,
  itemsPerPage,
  onChangeItemsPerPage,
  itemsPerPageOptions,
  className
}: EuiTablePaginationProps) {
  return (
    <div
      aria-label="Paginacija tabele"
      className={`inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-2 py-1 ${className ?? ''}`.trim()}
    >
      <span className="text-[11px] text-slate-600">Vrstic na stran</span>
      <PageSizeSelect value={itemsPerPage} options={itemsPerPageOptions} onChange={onChangeItemsPerPage} className="[&_button]:!h-7 [&_button]:!w-[72px]" />
      <Pagination page={page} pageCount={pageCount} onPageChange={onPageChange} variant="topPills" size="sm" showNumbers={false} />
    </div>
  );
}

export type { EuiTablePaginationProps };
