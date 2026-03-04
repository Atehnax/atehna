import type { HTMLAttributes } from 'react';

export type SpinnerProps = HTMLAttributes<HTMLSpanElement> & {
  size?: 'sm' | 'md' | 'lg';
};

const classNames = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

const sizeClassMap = {
  sm: 'h-3.5 w-3.5 border-[1.5px]',
  md: 'h-4 w-4 border-2',
  lg: 'h-5 w-5 border-2'
} as const;

export default function Spinner({ size = 'md', className, ...props }: SpinnerProps) {
  return (
    <span
      {...props}
      aria-hidden="true"
      className={classNames(
        'inline-block animate-spin rounded-full border-current border-r-transparent align-middle',
        sizeClassMap[size],
        className
      )}
    />
  );
}
