import type { ButtonHTMLAttributes, ReactNode } from 'react';

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
    'rounded-full bg-brand-600 font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400',
  outline:
    'rounded-full border border-slate-200 font-semibold text-slate-700 transition hover:border-brand-200 hover:text-brand-600 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400',
  'admin-soft':
    'inline-flex h-8 items-center gap-1.5 rounded-xl border border-[#ede8ff] bg-[#f8f7fc] px-3 text-xs font-semibold text-[#5d3ed6] shadow-sm transition hover:border-[#5d3ed6] hover:bg-[#f8f7fc] focus-visible:border-[#5d3ed6] focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-400'
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
