import type { CSSProperties, ReactNode } from 'react';
import { ADMIN_TABLE_BG, TableShell } from '@/shared/ui/table';

type AdminTableLayoutProps = {
  headerLeft?: ReactNode;
  headerRight?: ReactNode;
  filterRowLeft?: ReactNode;
  filterRowRight?: ReactNode;
  children: ReactNode;
  footerRight?: ReactNode;
  className?: string;
  style?: CSSProperties;
  contentClassName?: string;
  headerClassName?: string;
  showDivider?: boolean;
};

const classNames = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

export default function AdminTableLayout({
  headerLeft,
  headerRight,
  filterRowLeft,
  filterRowRight,
  children,
  footerRight,
  className,
  style,
  contentClassName,
  headerClassName,
  showDivider = true
}: AdminTableLayoutProps) {
  const hasHeaderRow = Boolean(headerLeft || headerRight);
  const hasFilterRow = Boolean(filterRowLeft || filterRowRight);

  return (
    <TableShell className={classNames('overflow-hidden border-slate-200 bg-white', className)} style={style}>
      <div className={classNames(ADMIN_TABLE_BG, 'px-3 py-3', headerClassName)}>
        {hasHeaderRow ? (
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-end gap-2">{headerLeft}</div>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">{headerRight}</div>
          </div>
        ) : null}

        {hasFilterRow ? (
          <div className={classNames('flex flex-wrap items-center justify-between gap-2', hasHeaderRow ? 'mt-2' : undefined)}>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{filterRowLeft}</div>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">{filterRowRight}</div>
          </div>
        ) : null}

        {hasFilterRow && showDivider ? <hr className="mt-2 border-slate-200" /> : null}
      </div>

      <div className={contentClassName}>{children}</div>

      {footerRight ? (
        <div className="border-t border-slate-200 bg-white px-3 py-2">
          <div className="flex justify-end">{footerRight}</div>
        </div>
      ) : null}
    </TableShell>
  );
}

export type { AdminTableLayoutProps };
