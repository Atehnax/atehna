import type { CSSProperties } from 'react';
import { forwardRef, type ReactNode } from 'react';

type MenuPanelProps = {
  className?: string;
  children: ReactNode;
  style?: CSSProperties;
};

const classNames = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

const MenuPanel = forwardRef<HTMLDivElement, MenuPanelProps>(function MenuPanel({ className, children, style }, ref) {
  return (
    <div
      ref={ref}
      style={style}
      className={classNames(
        'rounded-md border border-slate-200 bg-white p-1 shadow-[0_14px_34px_rgba(15,23,42,0.08),0_2px_6px_rgba(15,23,42,0.05)]',
        className
      )}
    >
      {children}
    </div>
  );
});

export default MenuPanel;
