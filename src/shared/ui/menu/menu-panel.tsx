import type { ReactNode } from 'react';

type MenuPanelProps = {
  className?: string;
  children: ReactNode;
};

const classNames = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

export default function MenuPanel({ className, children }: MenuPanelProps) {
  return <div className={classNames('rounded-xl border border-slate-300 bg-white p-1 shadow-sm', className)}>{children}</div>;
}
