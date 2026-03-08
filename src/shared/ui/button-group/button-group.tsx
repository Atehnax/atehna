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
        'inline-flex h-8 items-stretch overflow-hidden rounded-xl border border-slate-300 bg-white divide-x divide-slate-300 [&>*]:flex [&>*]:items-stretch [&_button]:rounded-none [&_button]:border-0 [&_a]:rounded-none [&_a]:border-0',
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
      className={classNames('relative flex items-stretch focus-within:z-10 focus-within:outline-none focus-within:ring-1 focus-within:ring-inset focus-within:ring-blue-500', className)}
    >
      {children}
    </div>
  );
}
