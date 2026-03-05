import type { HTMLAttributes } from 'react';

export type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
export type BadgeSize = 'sm' | 'md';

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
  size?: BadgeSize;
};

const classNames = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

const variantClassMap: Record<BadgeVariant, string> = {
  neutral: 'border-slate-200 bg-slate-50 text-slate-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-yellow-200 bg-yellow-50 text-yellow-800',
  danger: 'border-orange-300 bg-orange-100 text-orange-900',
  info: 'border-blue-200 bg-blue-50 text-blue-700',
  purple: 'border-violet-200 bg-violet-50 text-violet-700'
};

const sizeClassMap: Record<BadgeSize, string> = {
  sm: 'h-6 min-w-[104px] px-2 text-[11px]',
  md: 'h-7 min-w-[112px] px-2.5 text-xs'
};

export default function Badge({ variant = 'neutral', size = 'sm', className, children, ...props }: BadgeProps) {
  return (
    <span
      {...props}
      className={classNames(
        'inline-flex items-center justify-center rounded-full border font-semibold leading-none',
        sizeClassMap[size],
        variantClassMap[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
