import type { HTMLAttributes } from 'react';

export type SkeletonProps = HTMLAttributes<HTMLDivElement>;

const classNames = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

export default function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      {...props}
      aria-hidden="true"
      className={classNames('animate-pulse rounded-md bg-slate-200/80', className)}
    />
  );
}
