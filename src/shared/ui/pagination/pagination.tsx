import usePaginationRange, { DOTS } from './use-pagination-range';

export type PaginationProps = {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  variant?: 'topPills' | 'bottomBar';
  size?: 'sm' | 'md';
  showNumbers?: boolean;
  className?: string;
};

const classNames = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

const sizeClassMap = {
  sm: {
    button: 'h-7 px-2.5 text-xs',
    number: 'h-7 min-w-7 px-2 text-xs'
  },
  md: {
    button: 'h-8 px-3 text-xs',
    number: 'h-8 min-w-8 px-2.5 text-xs'
  }
} as const;

export default function Pagination({
  page,
  pageCount,
  onPageChange,
  variant = 'bottomBar',
  size = 'md',
  showNumbers = true,
  className
}: PaginationProps) {
  const safePageCount = Math.max(pageCount, 1);
  const safePage = Math.min(Math.max(page, 1), safePageCount);
  const range = usePaginationRange({ page: safePage, pageCount: safePageCount });

  const baseButtonClass =
    'inline-flex items-center justify-center rounded-full border border-slate-300 bg-white font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div
      className={classNames(
        'flex items-center gap-2',
        variant === 'topPills' ? 'justify-end' : 'justify-between',
        className
      )}
    >
      {variant === 'bottomBar' ? (
        <span className="text-xs text-slate-600">
          Stran {safePage} od {safePageCount}
        </span>
      ) : null}

      <div className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white p-1">
        <button
          type="button"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
          className={classNames(baseButtonClass, sizeClassMap[size].button)}
        >
          Prejšnja
        </button>

        {showNumbers
          ? range.map((item, index) =>
              item === DOTS ? (
                <span key={`dots-${index}`} className="px-1 text-xs text-slate-400">
                  {DOTS}
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => onPageChange(item)}
                  className={classNames(
                    baseButtonClass,
                    sizeClassMap[size].number,
                    item === safePage && 'border-[#5d3ed6] bg-[#f8f7fc] text-[#5d3ed6]'
                  )}
                >
                  {item}
                </button>
              )
            )
          : null}

        <button
          type="button"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= safePageCount}
          className={classNames(baseButtonClass, sizeClassMap[size].button)}
        >
          Naslednja
        </button>
      </div>
    </div>
  );
}
