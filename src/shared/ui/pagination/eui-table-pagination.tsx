'use client';

import dynamic from 'next/dynamic';
import Pagination from './pagination';
import PageSizeSelect from './page-size-select';

const ElasticPagination = dynamic(() => import('@elastic/eui').then((module) => module.EuiPagination), { ssr: false });

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
  if (typeof window === 'undefined') {
    return (
      <div aria-label="Paginacija tabele" className={`inline-flex items-center gap-2 ${className ?? ''}`.trim()}>
        <span className="text-[11px] text-slate-600">Vrstic na stran</span>
        <PageSizeSelect value={itemsPerPage} options={itemsPerPageOptions} onChange={onChangeItemsPerPage} className="w-[40px]" />
        <Pagination page={page} pageCount={pageCount} onPageChange={onPageChange} variant="topPills" size="sm" showNumbers={false} />
      </div>
    );
  }

  return (
    <div aria-label="Paginacija tabele" className={`admin-orders-pagination inline-flex items-center gap-2 ${className ?? ''}`.trim()}>
      <span className="text-xs font-normal text-slate-600" style={{ fontFamily: '"Inter",system-ui,sans-serif' }}>Vrstic na stran</span>
      <PageSizeSelect
        value={itemsPerPage}
        options={itemsPerPageOptions}
        onChange={onChangeItemsPerPage}
        className="w-[40px]"
      />
      <ElasticPagination
        pageCount={Math.max(pageCount, 1)}
        activePage={Math.min(Math.max(page, 1), Math.max(pageCount, 1)) - 1}
        onPageClick={(nextPageIndex) => onPageChange(nextPageIndex + 1)}
        compressed
      />
    </div>
  );
}

export type { EuiTablePaginationProps };
