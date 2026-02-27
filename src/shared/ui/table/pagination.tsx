import type { ReactNode } from 'react';

type TablePaginationProps = {
  page: number;
  pageCount: number;
  onPrev: () => void;
  onNext: () => void;
  className?: string;
};

const classNames = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

export default function TablePagination({ page, pageCount, onPrev, onNext, className }: TablePaginationProps) {
  return (
    <div className={classNames('flex items-center justify-end gap-2', className)}>
      <button
        type="button"
        onClick={onPrev}
        disabled={page <= 1}
        className="h-8 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Prejšnja
      </button>
      <span className="text-xs text-slate-600">
        Stran {page} / {Math.max(pageCount, 1)}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={page >= pageCount}
        className="h-8 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Naslednja
      </button>
    </div>
  );
}
