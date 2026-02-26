import type { ButtonHTMLAttributes, ReactNode } from 'react';

type MenuItemProps = {
  className?: string;
  children: ReactNode;
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>['onClick'];
  disabled?: boolean;
  isActive?: boolean;
};

const classNames = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

export default function MenuItem({ className, children, onClick, disabled = false, isActive = false }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={classNames(
        'flex h-8 w-full items-center rounded-lg px-3 text-left text-xs font-semibold leading-none transition disabled:cursor-not-allowed disabled:text-slate-300',
        isActive ? 'bg-[#f8f7fc] text-[#5d3ed6]' : 'text-slate-700 hover:bg-[#ede8ff]',
        className
      )}
    >
      {children}
    </button>
  );
}
