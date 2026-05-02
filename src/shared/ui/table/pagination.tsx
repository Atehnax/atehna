import Pagination from '../pagination/pagination';

type TablePaginationProps = {
  page: number;
  pageCount: number;
  onPrev: () => void;
  onNext: () => void;
  className?: string;
};

export default function TablePagination({ page, pageCount, onPrev, onNext, className }: TablePaginationProps) {
  return (
    <Pagination
      page={page}
      pageCount={pageCount}
      onPageChange={(nextPage) => {
        if (nextPage < page) onPrev();
        if (nextPage > page) onNext();
      }}
      variant="bottomBar"
      showNumbers={false}
      className={className}
    />
  );
}
