import type { SVGProps } from 'react';

export function TrashCanIcon({ className = 'h-4 w-4', ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M4.5 7h15" />
      <path d="M8.2 7 9 4.5h6L15.8 7" />
      <path d="M7.2 7.2 8 19a2 2 0 0 0 2 1.9h4a2 2 0 0 0 2-1.9l.8-11.8" />
      <path d="M10 10v7M12 10v7M14 10v7" />
    </svg>
  );
}
