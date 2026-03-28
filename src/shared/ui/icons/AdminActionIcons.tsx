import type { SVGProps } from 'react';

type ActionIconProps = SVGProps<SVGSVGElement> & {
  className?: string;
};

export function ActionDownloadIcon({ className = 'h-3.5 w-3.5', ...props }: ActionIconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M3.5 13.5v2.5h13v-2.5" />
      <path d="M10 4v8" />
      <path d="M6.5 8.5 10 12l3.5-3.5" />
    </svg>
  );
}

export function ActionSaveIcon({ className = 'h-3.5 w-3.5', ...props }: ActionIconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M4 3h9l3 3v11H4z" />
      <path d="M7 3v5h6V3" />
      <path d="M7 13h6" />
    </svg>
  );
}

export function ActionUploadIcon({ className = 'h-3.5 w-3.5', ...props }: ActionIconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M3.5 13.5v2.5h13v-2.5" />
      <path d="M10 4v8" />
      <path d="M6.5 7.5L10 4l3.5 3.5" />
    </svg>
  );
}

export function ActionFilterIcon({ className = 'h-3.5 w-3.5', ...props }: ActionIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
      <circle cx="15" cy="6" r="2.5" fill="white" />
      <circle cx="8" cy="12" r="2.5" fill="white" />
      <circle cx="13" cy="18" r="2.5" fill="white" />
    </svg>
  );
}

export function OrdersTrashIcon({ className = 'h-3.5 w-3.5', ...props }: ActionIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M8 5.75h8" />
      <path d="M9.25 5.75c.28-1.15 1.11-1.75 2.75-1.75s2.47.6 2.75 1.75" />
      <path d="M5.75 7.5h12.5" />
      <path d="M7.6 7.5 8.5 19a1.7 1.7 0 0 0 1.7 1.55h3.6A1.7 1.7 0 0 0 15.5 19l.9-11.5" />
      <path d="M10 10.2v7.2" />
      <path d="M12 10.2v7.2" />
      <path d="M14 10.2v7.2" />
    </svg>
  );
}
