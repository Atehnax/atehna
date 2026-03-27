import type { SVGProps } from 'react';

export function TrashCanIcon({ className = 'h-4 w-4', ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M4.8 7.1h14.4" />
      <path d="M9 7.1V5.9c0-.66.54-1.2 1.2-1.2h3.6c.66 0 1.2.54 1.2 1.2v1.2" />
      <path d="M7.2 7.3 8 18.7c.07.93.85 1.65 1.79 1.65h4.42c.94 0 1.72-.72 1.79-1.65l.8-11.4" />
      <path d="M10 10.3v6.7M12 10.3v6.7M14 10.3v6.7" />
    </svg>
  );
}
