import type { HTMLAttributes, ReactNode } from 'react';
import { ADMIN_CONTROL_HEIGHT } from '@/shared/ui/admin-controls/controlSizes';

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
        `inline-flex ${ADMIN_CONTROL_HEIGHT} items-stretch overflow-visible rounded-xl border border-slate-300 bg-white divide-x divide-slate-300 [&>*]:h-full [&>*]:rounded-none [&>*]:border-0 [&>*]:bg-transparent [&>*:first-child]:rounded-l-xl [&>*:last-child]:rounded-r-xl`,
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
