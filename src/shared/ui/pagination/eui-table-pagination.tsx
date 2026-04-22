'use client';

import PageSizeSelect from './page-size-select';
import Pagination from './pagination';

const PAGINATION_FOOTPRINT_CLASS = 'inline-flex h-7 min-w-[112px] items-center justify-end';

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
  const safePageCount = Math.max(pageCount, 1);
  const safePage = Math.min(Math.max(page, 1), safePageCount);

  return (
    <div aria-label="Paginacija tabele" className={`admin-orders-pagination inline-flex min-h-7 items-center gap-2 whitespace-nowrap ${className ?? ''}`.trim()}>
      <span className="text-xs font-normal text-slate-600" style={{ fontFamily: '"Inter",system-ui,sans-serif' }}>Vrstic na stran</span>
      <PageSizeSelect
        value={itemsPerPage}
        options={itemsPerPageOptions}
        onChange={onChangeItemsPerPage}
        className="w-[55px]"
      />
      <div className={PAGINATION_FOOTPRINT_CLASS}>
        <Pagination
          page={safePage}
          pageCount={safePageCount}
          onPageChange={onPageChange}
          size="sm"
          className="!gap-0.5"
        />
      </div>
    </div>
  );
}

export type { EuiTablePaginationProps };
