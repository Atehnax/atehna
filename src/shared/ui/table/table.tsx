import type { HTMLAttributes, ReactNode, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';

type BaseProps = {
  children: ReactNode;
  className?: string;
};

const classNames = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

const ADMIN_TABLE_BG = 'bg-slate-50/85';

export function Table({ children, className, ...props }: BaseProps & TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table className={classNames('w-full table-auto text-left text-[13px] text-slate-700', className)} {...props}>
      {children}
    </table>
  );
}

export function THead({ children, className, ...props }: BaseProps & HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={classNames(className)} {...props}>
      {children}
    </thead>
  );
}

export function TBody({ children, className, ...props }: BaseProps & HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={className} {...props}>
      {children}
    </tbody>
  );
}

export function TR({ children, className, ...props }: BaseProps & HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={classNames('transition-colors duration-150 hover:bg-slate-50', className)} {...props}>
      {children}
    </tr>
  );
}

export function TH({ children, className, ...props }: BaseProps & ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={classNames(`${ADMIN_TABLE_BG} border-b border-slate-200/90 px-3 py-2.5 text-left text-[11px] font-semibold tracking-wide text-slate-500 align-middle`, className)} {...props}>
      {children}
    </th>
  );
}

export function TD({ children, className, ...props }: BaseProps & TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={classNames('px-2.5 py-2.5 align-middle', className)} {...props}>
      {children}
    </td>
  );
}

export function RowActions({ children, className }: BaseProps) {
  return <div className={classNames('flex items-center justify-center gap-1', className)}>{children}</div>;
}

export { ADMIN_TABLE_BG };
