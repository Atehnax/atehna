import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import Link from 'next/link';
import type { LinkProps } from 'next/link';
import { iconButtonTokenClasses } from '@/shared/ui/theme/tokens';

type SharedIconButtonProps = {
  children: ReactNode;
  className?: string;
  shape?: 'rounded' | 'square';
  size?: 'sm' | 'md';
  tone?: 'neutral' | 'neutralStatus' | 'success' | 'warning' | 'danger' | 'add';
};

type IconButtonAsButtonProps = SharedIconButtonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children' | 'href'> & {
    href?: never;
  };

type IconButtonAsLinkProps = SharedIconButtonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'children' | 'href'> & {
    href: string;
    prefetch?: LinkProps['prefetch'];
  };

export type IconButtonProps = IconButtonAsButtonProps | IconButtonAsLinkProps;

const classNames = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

const shapeClassMap = {
  rounded: 'rounded-xl',
  square: 'rounded-md'
} as const;

const sizeClassMap = {
  sm: 'h-7 w-7',
  md: 'h-8 w-8'
} as const;

const toneClassMap = {
  neutral: iconButtonTokenClasses.neutral,
  neutralStatus: iconButtonTokenClasses.neutralStatus,
  success: iconButtonTokenClasses.success,
  warning: iconButtonTokenClasses.warning,
  danger: iconButtonTokenClasses.danger,
  add: iconButtonTokenClasses.add
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
