import type { HTMLAttributes, ReactNode } from 'react';

type ButtonGroupProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

const classNames = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

export default function ButtonGroup({ children, className, ...props }: ButtonGroupProps) {
  return (
    <div
      {...props}
      className={classNames(
        'inline-flex h-8 items-stretch overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm [&>*:not(:first-child)]:border-l [&>*:not(:first-child)]:border-slate-300',
        className
      )}
    >
      {children}
    </div>
  );
}
