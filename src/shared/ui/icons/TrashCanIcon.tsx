import type { SVGProps } from 'react';

export function TrashCanIcon({ className = 'h-[18px] w-[18px] text-[#C43A4A]', ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M4.8 7.4h14.4" />
      <path d="M9.4 7.4V6c0-.77.63-1.4 1.4-1.4h2.4c.77 0 1.4.63 1.4 1.4v1.4" />
      <path d="M7.3 7.8 8 18.7c.08 1.03.93 1.83 1.96 1.83h4.08c1.03 0 1.88-.8 1.96-1.83l.7-10.9" />
      <path d="M9.9 10.7v6.1M12 10.7v6.1M14.1 10.7v6.1" />
    </svg>
  );
}
