import type { HTMLAttributes, ReactNode } from 'react';

type ButtonGroupProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

type ButtonGroupItemProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

const classNames = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

export default function ButtonGroup({ children, className, ...props }: ButtonGroupProps) {
  return (
    <div
      {...props}
      className={classNames(
        'inline-flex h-8 items-stretch rounded-xl border border-slate-300 bg-white shadow-sm [&>*]:rounded-none [&>*]:border-l [&>*]:border-slate-300 [&>*:first-child]:rounded-l-xl [&>*:first-child]:border-l-0 [&>*:last-child]:rounded-r-xl',
        className
      )}
    >
      {children}
    </div>
  );
}

export function ButtonGroupItem({ children, className, ...props }: ButtonGroupItemProps) {
  return (
    <div
      {...props}
      className={classNames('flex items-stretch', className)}
    >
      {children}
    </div>
  );
}
