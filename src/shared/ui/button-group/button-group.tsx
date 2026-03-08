import type { HTMLAttributes, ReactNode } from 'react';

type ButtonGroupProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

type ButtonGroupItemProps = {
  children: ReactNode;
};

const classNames = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

export default function ButtonGroup({ children, className, ...props }: ButtonGroupProps) {
  return (
    <div
      {...props}
      className={classNames(
        'inline-flex h-9 items-stretch overflow-visible rounded-xl border border-slate-300 bg-white [&>*]:rounded-none [&>*+*]:border-l [&>*+*]:border-slate-300 [&>*:first-child]:rounded-l-xl [&>*:last-child]:rounded-r-xl',
        className
      )}
    >
      {children}
    </div>
  );
}

export function ButtonGroupItem({ children }: ButtonGroupItemProps) {
  return <>{children}</>;
}
