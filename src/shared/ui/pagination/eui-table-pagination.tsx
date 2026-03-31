'use client';

import dynamic from 'next/dynamic';
import Pagination from './pagination';
import PageSizeSelect from './page-size-select';

const ElasticContext = dynamic(() => import('@elastic/eui').then((module) => module.EuiContext), { ssr: false });
const ElasticTablePagination = dynamic(() => import('@elastic/eui').then((module) => module.EuiTablePagination), { ssr: false });

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
        <PageSizeSelect value={itemsPerPage} options={itemsPerPageOptions} onChange={onChangeItemsPerPage} className="[&_button]:!h-7 [&_button]:!w-[72px]" />
        <Pagination page={page} pageCount={pageCount} onPageChange={onPageChange} variant="topPills" size="sm" showNumbers={false} />
      </div>
    );
  }

  return (
    <div aria-label="Paginacija tabele" className={`inline-flex items-center ${className ?? ''}`.trim()}>
      <ElasticContext
        i18n={{
          mapping: {
            'euiTablePagination.rowsPerPage': 'Vrstic na stran',
            'euiTablePagination.allRows': 'Prikazane so vse vrstice',
            'euiTablePagination.rowsPerPageOptionShowAllRows': 'Prikaži vse vrstice',
            'euiTablePagination.rowsPerPageOption': '{rowsPerPage} vrstic'
          }
        }}
      >
        <ElasticTablePagination
          activePage={page}
          itemsPerPage={itemsPerPage}
          itemsPerPageOptions={itemsPerPageOptions}
          pageCount={pageCount}
          onChangePage={onPageChange}
          onChangeItemsPerPage={onChangeItemsPerPage}
          showPerPageOptions
          aria-label="Paginacija tabele"
        />
      </ElasticContext>
    </div>
  );
}

export type { EuiTablePaginationProps };
