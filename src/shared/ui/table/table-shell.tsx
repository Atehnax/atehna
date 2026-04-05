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
    <div className={classNames('overflow-hidden rounded-2xl border shadow-sm', className)} style={style}>
      {children}
    </div>
  );
}
