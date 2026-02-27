import type { HTMLAttributes, ReactNode, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';

type BaseProps = {
  children: ReactNode;
  className?: string;
};

const classNames = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

export function Table({ children, className, ...props }: BaseProps & TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table className={classNames('w-full table-auto text-left text-[13px]', className)} {...props}>
      {children}
    </table>
  );
}

export function THead({ children, className, ...props }: BaseProps & HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={classNames('text-[12px] uppercase text-slate-600', className)} {...props}>
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
    <tr className={className} {...props}>
      {children}
    </tr>
  );
}

export function TH({ children, className, ...props }: BaseProps & ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={classNames('px-2 py-2', className)} {...props}>
      {children}
    </th>
  );
}

export function TD({ children, className, ...props }: BaseProps & TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={classNames('px-2 py-2 align-middle', className)} {...props}>
      {children}
    </td>
  );
}

export function RowActions({ children, className }: BaseProps) {
  return <div className={classNames('flex items-center justify-center gap-1', className)}>{children}</div>;
}
