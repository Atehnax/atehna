import type { HTMLAttributes } from 'react';

export default function InlineEditFocusFrame({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      {...props}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 rounded-md border border-[#3e67d6] ${className ?? ''}`.trim()}
    />
  );
}
