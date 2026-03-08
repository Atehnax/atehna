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
        'inline-flex h-8 items-stretch overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm divide-x divide-slate-300',
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
      className={classNames(
        'relative flex items-stretch',
        isSelected && 'z-[1] ring-2 ring-[#3e67d6] ring-inset',
        className
      )}
    >
      {children}
    </div>
  );
}
