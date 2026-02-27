import type { ButtonHTMLAttributes, ReactNode } from 'react';

type MenuItemProps = {
  className?: string;
  children: ReactNode;
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>['onClick'];
  disabled?: boolean;
  isActive?: boolean;
  role?: 'menuitem' | 'option';
  ariaSelected?: boolean;
};

const classNames = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

export default function MenuItem({
  className,
  children,
  onClick,
  disabled = false,
  isActive = false,
  role = 'menuitem',
  ariaSelected
}: MenuItemProps) {
  return (
    <button
      type="button"
      role={role}
      aria-selected={role === 'option' ? ariaSelected : undefined}
      onClick={onClick}
      disabled={disabled}
      className={classNames(
        'flex h-8 w-full items-center rounded-lg px-3 text-left text-xs font-semibold leading-none transition disabled:cursor-not-allowed disabled:text-slate-300',
        isActive ? 'text-slate-700 hover:bg-slate-50 hover:text-brand-600' : 'text-slate-700 hover:bg-slate-50 hover:text-brand-600',
        className
      )}
    >
      {children}
    </button>
  );
}
