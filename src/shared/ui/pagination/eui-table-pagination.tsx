'use client';

import PageSizeSelect from './page-size-select';
import Pagination from './pagination';
import type { PageSizeValue } from '@/shared/domain/pagination';

const PAGINATION_FOOTPRINT_CLASS = 'inline-flex h-7 min-w-[112px] items-center justify-end';

type EuiTablePaginationBaseProps = {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  itemsPerPageOptions: readonly number[];
  className?: string;
  size?: 'sm' | 'md';
};

type EuiTablePaginationProps = EuiTablePaginationBaseProps & (
  | {
      allowAll: true;
      itemsPerPage: PageSizeValue;
      onChangeItemsPerPage: (size: PageSizeValue) => void;
    }
  | {
      allowAll?: false;
      itemsPerPage: number;
      onChangeItemsPerPage: (size: number) => void;
    }
);

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

export default function EuiTablePagination(props: EuiTablePaginationProps) {
  const {
    page,
    pageCount,
    onPageChange,
    itemsPerPage,
    itemsPerPageOptions,
    className,
    size = 'sm'
  } = props;
  const safePageCount = Math.max(pageCount, 1);
  const safePage = Math.min(Math.max(page, 1), safePageCount);
  const sizeClasses = paginationSizeClassMap[size];
  const handleItemsPerPageChange = (nextPageSize: PageSizeValue) => {
    if (props.allowAll) {
      props.onChangeItemsPerPage(nextPageSize);
      return;
    }
    if (typeof nextPageSize === 'number') props.onChangeItemsPerPage(nextPageSize);
  };

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
        onChange={handleItemsPerPageChange}
        includeAll={props.allowAll === true}
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
