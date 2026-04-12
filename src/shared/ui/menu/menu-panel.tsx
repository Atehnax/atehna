import type { CSSProperties } from 'react';
import { forwardRef, type ReactNode } from 'react';

type MenuPanelProps = {
  className?: string;
  children: ReactNode;
  style?: CSSProperties;
};

const classNames = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

const MenuPanel = forwardRef<HTMLDivElement, MenuPanelProps>(function MenuPanel({ className, children, style }, ref) {
  return <div ref={ref} style={style} className={classNames('rounded-md border border-slate-300 bg-white p-1 shadow-sm', className)}>{children}</div>;
});

export default MenuPanel;
