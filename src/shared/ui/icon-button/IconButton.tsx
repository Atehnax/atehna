import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { iconButtonTokenClasses } from '@/shared/ui/theme/tokens';

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
  neutral: iconButtonTokenClasses.neutral,
  danger: iconButtonTokenClasses.danger
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
        iconButtonTokenClasses.base,
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
