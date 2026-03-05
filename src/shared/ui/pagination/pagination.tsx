import { IconButton } from '@/shared/ui/icon-button';
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
    icon: 'h-7 w-7',
    number: 'h-7 min-w-7 px-2 text-xs',
    label: 'text-xs'
  },
  md: {
    icon: 'h-8 w-8',
    number: 'h-8 min-w-8 px-2.5 text-xs',
    label: 'text-sm'
  }
} as const;

function NavIcon({ direction }: { direction: 'first' | 'prev' | 'next' | 'last' }) {
  if (direction === 'first') return <span aria-hidden="true">«</span>;
  if (direction === 'prev') return <span aria-hidden="true">‹</span>;
  if (direction === 'next') return <span aria-hidden="true">›</span>;
  return <span aria-hidden="true">»</span>;
}

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

  return (
    <div
      className={classNames(
        'flex items-center gap-2',
        variant === 'topPills' ? 'justify-end' : 'justify-between',
        className
      )}
    >
      <span className={classNames('text-slate-600', sizeClassMap[size].label)}>
        Stran {safePage} od {safePageCount}
      </span>

      <div className="inline-flex items-center gap-0.5">
        <IconButton
          type="button"
          tone="neutral"
          shape="square"
          size={size === 'sm' ? 'sm' : 'md'}
          onClick={() => onPageChange(1)}
          disabled={safePage <= 1}
          className={classNames(
            'border-0 text-slate-600 hover:bg-slate-100 disabled:opacity-50',
            sizeClassMap[size].icon
          )}
          aria-label="Prva stran"
          title="Prva stran"
        >
          <NavIcon direction="first" />
        </IconButton>

        <IconButton
          type="button"
          tone="neutral"
          shape="square"
          size={size === 'sm' ? 'sm' : 'md'}
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
          className={classNames(
            'border-0 text-slate-600 hover:bg-slate-100 disabled:opacity-50',
            sizeClassMap[size].icon
          )}
          aria-label="Prejšnja stran"
          title="Prejšnja stran"
        >
          <NavIcon direction="prev" />
        </IconButton>

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
                    'inline-flex items-center justify-center rounded-md font-semibold text-slate-600 transition hover:bg-slate-100',
                    sizeClassMap[size].number,
                    item === safePage && 'bg-[#f8f7fc] text-[#5d3ed6]'
                  )}
                >
                  {item}
                </button>
              )
            )
          : null}

        <IconButton
          type="button"
          tone="neutral"
          shape="square"
          size={size === 'sm' ? 'sm' : 'md'}
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= safePageCount}
          className={classNames(
            'border-0 text-slate-600 hover:bg-slate-100 disabled:opacity-50',
            sizeClassMap[size].icon
          )}
          aria-label="Naslednja stran"
          title="Naslednja stran"
        >
          <NavIcon direction="next" />
        </IconButton>

        <IconButton
          type="button"
          tone="neutral"
          shape="square"
          size={size === 'sm' ? 'sm' : 'md'}
          onClick={() => onPageChange(safePageCount)}
          disabled={safePage >= safePageCount}
          className={classNames(
            'border-0 text-slate-600 hover:bg-slate-100 disabled:opacity-50',
            sizeClassMap[size].icon
          )}
          aria-label="Zadnja stran"
          title="Zadnja stran"
        >
          <NavIcon direction="last" />
        </IconButton>
      </div>
    </div>
  );
}
