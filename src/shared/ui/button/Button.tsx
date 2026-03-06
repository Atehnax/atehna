import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { buttonTokenClasses } from '@/shared/ui/theme/tokens';

type ButtonVariant = 'brand' | 'outline' | 'admin-soft';
type ButtonSize = 'sm' | 'md';

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & {
  children: ReactNode;
  variant: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

const classNames = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

const sizeClassMap: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-5 py-2 text-sm'
};

const variantClassMap: Record<ButtonVariant, string> = {
  brand:
    'rounded-full bg-brand-600 font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-default disabled:bg-slate-200 disabled:text-slate-400',
  outline: buttonTokenClasses.outline,
  'admin-soft': buttonTokenClasses.adminSoft
};

export default function Button({ children, variant, size = 'sm', className, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={classNames(
        variantClassMap[variant],
        variant === 'admin-soft' ? undefined : sizeClassMap[size],
        className
      )}
    >
      {children}
    </button>
  );
}
