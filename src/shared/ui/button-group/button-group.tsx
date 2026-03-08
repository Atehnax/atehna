import type { HTMLAttributes, ReactNode } from 'react';

type ButtonGroupProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

type ButtonGroupItemProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  isSelected?: boolean;
};

const classNames = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

export default function ButtonGroup({ children, className, ...props }: ButtonGroupProps) {
  return (
    <div
      {...props}
      className={classNames(
        'inline-flex h-8 items-stretch overflow-visible rounded-xl border border-slate-300 bg-white shadow-sm divide-x divide-slate-300 [&>[data-button-group-item]:first-child]:rounded-l-xl [&>[data-button-group-item]:first-child]:rounded-r-none [&>[data-button-group-item]:last-child]:rounded-r-xl [&>[data-button-group-item]:last-child]:rounded-l-none [&>[data-button-group-item]:not(:first-child):not(:last-child)]:rounded-none',
        className
      )}
    >
      {children}
    </div>
  );
}

export function ButtonGroupItem({ children, isSelected = false, className, ...props }: ButtonGroupItemProps) {
  return (
    <div
      {...props}
      data-button-group-item
      data-selected={isSelected ? 'true' : 'false'}
      className={classNames(
        'relative z-0 flex items-stretch [&_button]:!rounded-none [&_a]:!rounded-none focus-within:z-10 focus-within:shadow-[inset_0_0_0_1px_#3e67d6] has-[:active]:z-10 has-[:active]:shadow-[inset_0_0_0_1px_#3e67d6] data-[selected=true]:z-10 data-[selected=true]:shadow-[inset_0_0_0_1px_#3e67d6]',
        className
      )}
    >
      {children}
    </div>
  );
}
