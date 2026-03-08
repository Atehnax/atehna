import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import Link from 'next/link';
import { iconButtonTokenClasses } from '@/shared/ui/theme/tokens';

type SharedIconButtonProps = {
  children: ReactNode;
  className?: string;
  shape?: 'rounded' | 'square';
  size?: 'sm' | 'md';
  tone?: 'neutral' | 'warning' | 'danger';
};

type IconButtonAsButtonProps = SharedIconButtonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children' | 'href'> & {
    href?: never;
  };

type IconButtonAsLinkProps = SharedIconButtonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'children' | 'href'> & {
    href: string;
  };

export type IconButtonProps = IconButtonAsButtonProps | IconButtonAsLinkProps;

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
  warning: iconButtonTokenClasses.warning,
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
  const sharedClassName = classNames(
    iconButtonTokenClasses.base,
    shapeClassMap[shape],
    sizeClassMap[size],
    toneClassMap[tone],
    className
  );

  if ('href' in props && typeof props.href === 'string') {
    const { href, ...linkProps } = props;
    return (
      <Link href={href} className={sharedClassName} {...linkProps}>
        {children}
      </Link>
    );
  }

  return (
    <button {...props} className={sharedClassName}>
      {children}
    </button>
  );
}
