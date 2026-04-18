import Skeleton from './skeleton';

export type TableSkeletonProps = {
  rows: number;
  cols: number;
  hasActions?: boolean;
  className?: string;
};

const classNames = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

export default function TableSkeleton({ rows, cols, hasActions = false, className }: TableSkeletonProps) {
  const totalColumns = hasActions ? cols + 1 : cols;

  return (
    <div className={classNames('overflow-hidden rounded-xl border border-slate-200 bg-white', className)}>
      <div
        className="grid gap-3 border-b border-slate-100 bg-[color:var(--admin-table-header-bg)] px-4 py-3"
        style={{ gridTemplateColumns: `repeat(${totalColumns}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: totalColumns }).map((_, index) => (
          <Skeleton key={`head-${index}`} className="h-3.5 w-full" />
        ))}
      </div>
      <div className="space-y-3 px-4 py-3">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={`row-${rowIndex}`}
            className="grid gap-3"
            style={{ gridTemplateColumns: `repeat(${totalColumns}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: totalColumns }).map((_, colIndex) => (
              <Skeleton key={`cell-${rowIndex}-${colIndex}`} className="h-4 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
