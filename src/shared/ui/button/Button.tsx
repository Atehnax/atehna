import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { buttonTokenClasses } from '@/shared/ui/theme/tokens';

type ButtonVariant = 'primary' | 'brand' | 'outline' | 'default' | 'admin-soft' | 'danger' | 'restore' | 'archive' | 'close-x' | 'ghost';
type ButtonSize = 'xs' | 'sm' | 'md';

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & {
  children: ReactNode;
  variant: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

const classNames = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

const sizeClassMap: Record<ButtonSize, string> = {
  xs: 'px-2 py-1 text-xs',
  sm: 'px-4 py-2 text-sm',
  md: 'px-5 py-2 text-sm'
};

const variantClassMap: Record<ButtonVariant, string> = {
  primary:
    'rounded-full bg-brand-600 font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-default disabled:bg-slate-200 disabled:text-slate-400',
  brand:
    'rounded-full bg-brand-600 font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-default disabled:bg-slate-200 disabled:text-slate-400',
  outline: buttonTokenClasses.outline,
  default: buttonTokenClasses.control,
  'admin-soft': buttonTokenClasses.adminSoft,
  danger: buttonTokenClasses.danger,
  restore: buttonTokenClasses.restore,
  archive: buttonTokenClasses.archive,
  'close-x': buttonTokenClasses.closeX,
  ghost: buttonTokenClasses.ghost
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { children, variant, size = 'sm', className, ...props },
  ref
) {
  return (
    <button
      {...props}
      ref={ref}
      className={classNames(
        variantClassMap[variant],
        variant === 'admin-soft' || variant === 'danger' || variant === 'restore' || variant === 'archive' || variant === 'close-x' || variant === 'default'
          ? undefined
          : sizeClassMap[size],
        className
      )}
    >
      {children}
    </button>
  );
});

export default Button;
