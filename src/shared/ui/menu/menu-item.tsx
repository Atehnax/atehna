import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { selectTokenClasses } from '@/shared/ui/theme/tokens';

type MenuItemProps = {
  className?: string;
  children: ReactNode;
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>['onClick'];
  disabled?: boolean;
  isActive?: boolean;
  role?: 'menuitem' | 'option';
  ariaSelected?: boolean;
  ariaDisabled?: boolean;
  ariaDescribedBy?: string;
};

const classNames = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

export default function MenuItem({
  className,
  children,
  onClick,
  disabled = false,
  isActive = false,
  role = 'menuitem',
  ariaSelected,
  ariaDisabled = false,
  ariaDescribedBy
}: MenuItemProps) {
  return (
    <button
      type="button"
      role={role}
      aria-selected={role === 'option' ? ariaSelected : undefined}
      aria-disabled={ariaDisabled || disabled || undefined}
      aria-describedby={ariaDescribedBy}
      data-menu-item-active={isActive ? 'true' : undefined}
      onClick={onClick}
      disabled={disabled}
      className={classNames(
        selectTokenClasses.menuItem,
        isActive && 'text-slate-700',
        className
      )}
    >
      {children}
    </button>
  );
}
