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
  size?: 'sm' | 'md';
};

const paginationSizeClassMap = {
  sm: {
    root: 'min-h-7 gap-2',
    label: 'text-xs',
    footprint: PAGINATION_FOOTPRINT_CLASS,
    pageSizeClassName: 'w-[55px]'
  },
  md: {
    root: 'min-h-10 gap-3',
    label: 'text-[13px]',
    footprint: 'inline-flex h-10 min-w-[172px] items-center justify-end',
    pageSizeClassName: 'w-[72px]'
  }
} as const;

export default function EuiTablePagination({
  page,
  pageCount,
  onPageChange,
  itemsPerPage,
  onChangeItemsPerPage,
  itemsPerPageOptions,
  className,
  size = 'sm'
}: EuiTablePaginationProps) {
  const safePageCount = Math.max(pageCount, 1);
  const safePage = Math.min(Math.max(page, 1), safePageCount);
  const sizeClasses = paginationSizeClassMap[size];

  return (
    <div
      aria-label="Paginacija tabele"
      className={`admin-orders-pagination inline-flex items-center whitespace-nowrap ${sizeClasses.root} ${className ?? ''}`.trim()}
    >
      <span className={`${sizeClasses.label} font-normal text-slate-600`} style={{ fontFamily: '"Inter",system-ui,sans-serif' }}>
        Vrstic na stran
      </span>
      <PageSizeSelect
        value={itemsPerPage}
        options={itemsPerPageOptions}
        onChange={onChangeItemsPerPage}
        className={sizeClasses.pageSizeClassName}
        size={size}
      />
      <div className={sizeClasses.footprint}>
        <Pagination
          page={safePage}
          pageCount={safePageCount}
          onPageChange={onPageChange}
          size={size}
          className="!gap-0.5"
        />
      </div>
    </div>
  );
}

export type { EuiTablePaginationProps };
