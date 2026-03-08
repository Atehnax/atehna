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
        'inline-flex h-8 items-stretch overflow-hidden rounded-xl border border-slate-300 bg-white divide-x divide-slate-300 [&>*]:flex [&>*]:items-stretch [&_button]:rounded-none [&_button]:border-0 [&_button:focus]:relative [&_button:focus]:z-10 [&_button:focus]:outline-none [&_button:focus]:ring-1 [&_button:focus]:ring-blue-500 [&_button:focus]:ring-inset [&_a]:rounded-none [&_a]:border-0 [&_a:focus]:relative [&_a:focus]:z-10 [&_a:focus]:outline-none [&_a:focus]:ring-1 [&_a:focus]:ring-blue-500 [&_a:focus]:ring-inset',
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
