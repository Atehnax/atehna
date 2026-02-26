import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & {
  children: ReactNode;
  className?: string;
  shape?: 'rounded' | 'square';
  size?: 'sm' | 'md';
  tone?: 'neutral' | 'danger';
};

const classNames = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

const shapeClassMap = {
  rounded: 'rounded-full',
  square: 'rounded-md'
} as const;

const sizeClassMap = {
  sm: 'h-7 w-7',
  md: 'h-8 w-8'
} as const;

const toneClassMap = {
  neutral:
    'border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300',
  danger: 'border border-rose-300 text-xs font-semibold leading-none text-rose-600 hover:bg-rose-50'
} as const;

export default function IconButton({
  children,
  className,
  shape = 'square',
  size = 'sm',
  tone = 'neutral',
  ...props
}: IconButtonProps) {
  return (
    <button
      {...props}
      className={classNames(
        'inline-flex items-center justify-center',
        shapeClassMap[shape],
        sizeClassMap[size],
        toneClassMap[tone],
        className
      )}
    >
      {children}
    </button>
  );
}
