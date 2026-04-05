import type { CSSProperties, HTMLAttributes } from 'react';

const CUT_CORNER_STYLE: CSSProperties = {
  clipPath:
    'polygon(8px 0,calc(100% - 8px) 0,100% 8px,100% calc(100% - 8px),calc(100% - 8px) 100%,8px 100%,0 calc(100% - 8px),0 8px)'
};

export default function InlineEditFocusFrame({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      {...props}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-px border border-[#3e67d6] ${className ?? ''}`.trim()}
      style={CUT_CORNER_STYLE}
    />
  );
}
