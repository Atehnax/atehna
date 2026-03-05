import type { CSSProperties, ReactNode } from 'react';
import { TableShell } from '@/shared/ui/table';

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
  contentClassName
}: AdminTableLayoutProps) {
  return (
    <TableShell className={classNames('overflow-hidden border-slate-200 bg-white', className)} style={style}>
      <div className="px-3 py-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-end gap-2">{headerLeft}</div>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">{headerRight}</div>
        </div>
      </div>

      <hr className="border-slate-200" />

      <div className="flex flex-wrap items-center justify-between gap-2 bg-[linear-gradient(180deg,rgba(250,251,252,0.96)_0%,rgba(242,244,247,0.96)_100%)] px-3 py-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{filterRowLeft}</div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">{filterRowRight}</div>
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
