'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import PageSizeSelect from './page-size-select';

const ElasticPagination = dynamic(() => import('@elastic/eui').then((module) => module.EuiPagination), { ssr: false });

const PAGINATION_FOOTPRINT_CLASS = 'inline-flex h-7 min-w-[140px] items-center justify-end';

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
  const [isHydrated, setIsHydrated] = useState(false);
  const safePageCount = Math.max(pageCount, 1);
  const safePage = Math.min(Math.max(page, 1), safePageCount);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  if (!isHydrated) {
    return (
      <div aria-label="Paginacija tabele" className={`admin-orders-pagination inline-flex min-h-7 items-center gap-2 whitespace-nowrap ${className ?? ''}`.trim()}>
        <span className="text-xs font-normal text-slate-600" style={{ fontFamily: '"Inter",system-ui,sans-serif' }}>Vrstic na stran</span>
        <PageSizeSelect value={itemsPerPage} options={itemsPerPageOptions} onChange={onChangeItemsPerPage} className="w-[55px]" />
        <div className={PAGINATION_FOOTPRINT_CLASS} aria-hidden="true">
          <div className="inline-flex h-7 items-center gap-0.5 text-slate-500">
            <span className="inline-flex h-7 w-[18px] items-center justify-center text-slate-400">|&lt;</span>
            <span className="inline-flex h-7 w-[18px] items-center justify-center text-slate-400">&lt;</span>
            <span className="inline-flex min-w-[54px] items-center justify-center px-1 text-xs font-semibold leading-none text-slate-700">
              {safePage} of {safePageCount}
            </span>
            <span className="inline-flex h-7 w-[18px] items-center justify-center text-slate-400">&gt;</span>
            <span className="inline-flex h-7 w-[18px] items-center justify-center text-slate-400">&gt;|</span>
          </div>
        </div>
      </div>
    );
  }

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
        <ElasticPagination
          pageCount={safePageCount}
          activePage={safePage - 1}
          onPageClick={(nextPageIndex) => onPageChange(nextPageIndex + 1)}
          compressed
        />
      </div>
    </div>
  );
}

export type { EuiTablePaginationProps };
