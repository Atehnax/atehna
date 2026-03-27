import type { SVGProps } from 'react';

export function TrashCanIcon({ className = 'h-[18px] w-[18px]', ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.35"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M4.6 7.3h14.8" />
      <path d="M9.1 7.3V5.8c0-.72.58-1.3 1.3-1.3h3.2c.72 0 1.3.58 1.3 1.3v1.5" />
      <path d="M7.2 7.5 8 18.8c.08 1.02.93 1.8 1.95 1.8h4.1c1.02 0 1.87-.78 1.95-1.8l.8-11.3" />
      <path d="M9.8 10.4v6.5M12 10.4v6.5M14.2 10.4v6.5" />
    </svg>
  );
}
