import type { CSSProperties, ReactNode } from 'react';

type TableShellProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

const classNames = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

export default function TableShell({ children, className, style }: TableShellProps) {
  return (
    <div className={classNames('overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.05)]', className)} style={style}>
      {children}
    </div>
  );
}
