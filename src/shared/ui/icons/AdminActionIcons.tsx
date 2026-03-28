import type { SVGProps } from 'react';
import { TrashCanIcon } from '@/shared/ui/icons/TrashCanIcon';

type ActionIconProps = SVGProps<SVGSVGElement> & {
  className?: string;
};

const ADMIN_ACTION_ICON_SIZE = 'h-[18px] w-[18px]';

export function ActionDownloadIcon({ className = ADMIN_ACTION_ICON_SIZE, ...props }: ActionIconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M3.5 13.5v2.5h13v-2.5" />
      <path d="M10 4v8" />
      <path d="M6.5 8.5 10 12l3.5-3.5" />
    </svg>
  );
}

export function ActionSaveIcon({ className = ADMIN_ACTION_ICON_SIZE, ...props }: ActionIconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M4 3h9l3 3v11H4z" />
      <path d="M7 3v5h6V3" />
      <path d="M7 13h6" />
    </svg>
  );
}

export function ActionUploadIcon({ className = ADMIN_ACTION_ICON_SIZE, ...props }: ActionIconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M3.5 13.5v2.5h13v-2.5" />
      <path d="M10 4v8" />
      <path d="M6.5 7.5L10 4l3.5 3.5" />
    </svg>
  );
}

export function ActionFilterIcon({ className = ADMIN_ACTION_ICON_SIZE, ...props }: ActionIconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <line x1="2.5" y1="4.5" x2="17.5" y2="4.5" />
      <line x1="2.5" y1="10" x2="17.5" y2="10" />
      <line x1="2.5" y1="15.5" x2="17.5" y2="15.5" />
      <circle cx="12.8" cy="4.5" r="2.1" fill="white" />
      <circle cx="6.7" cy="10" r="2.1" fill="white" />
      <circle cx="11.2" cy="15.5" r="2.1" fill="white" />
    </svg>
  );
}

export function ActionPencilIcon({ className = ADMIN_ACTION_ICON_SIZE, ...props }: ActionIconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M4 14.5l.5-3L13.5 2.5l3 3L7.5 14.5z" />
      <path d="M11.5 4.5l3 3" />
    </svg>
  );
}

export function ActionGeneratePdfIcon({ className = ADMIN_ACTION_ICON_SIZE, ...props }: ActionIconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M6 2.8h6.2l3 3V17H6z" />
      <path d="M12.2 2.8v3h3" />
      <path d="M8 10h4" />
      <path d="M10 8v4" />
    </svg>
  );
}

export function AdminTrashIcon({ className = ADMIN_ACTION_ICON_SIZE, ...props }: ActionIconProps) {
  return <TrashCanIcon className={className} {...props} />;
}
