import type { SVGProps } from 'react';

type ActionIconProps = SVGProps<SVGSVGElement>;

const classNames = (...parts: Array<string | null | undefined | false>) => parts.filter(Boolean).join(' ');
const defaultIconSizeClassName = 'h-3.5 w-3.5';

function iconClassName(className?: string) {
  return classNames(defaultIconSizeClassName, className);
}

export function DownloadIcon({ className, ...props }: ActionIconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={iconClassName(className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M10 3.2v8.1" />
      <path d="m6.6 8.8 3.4 3.4 3.4-3.4" />
      <path d="M4 12.3v2A1.7 1.7 0 0 0 5.7 16h8.6a1.7 1.7 0 0 0 1.7-1.7v-2" />
    </svg>
  );
}

export function UploadIcon({ className, ...props }: ActionIconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={iconClassName(className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M4 12.8v2A1.7 1.7 0 0 0 5.7 16h8.6a1.7 1.7 0 0 0 1.7-1.7v-2" />
      <path d="M10 4v8.3" />
      <path d="m6.6 7.3 3.4-3.3 3.4 3.3" />
    </svg>
  );
}

export function SaveIcon({ className, ...props }: ActionIconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={iconClassName(className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
      {...props}
    >
      <path d="M4 3h9l3 3v11H4z" />
      <path d="M7 3v5h6V3" />
      <path d="M7 13h6" />
    </svg>
  );
}

export function ActionFilterIcon({ className = 'h-5 w-5', ...props }: ActionIconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M3 5h14" />
      <path d="M3 10h14" />
      <path d="M3 15h14" />
      <circle cx="7" cy="5" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="12.5" cy="10" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="9" cy="15" r="1.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

export const FilterIcon = ActionFilterIcon;

export function OrdersTrashIcon({ className, ...props }: ActionIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={iconClassName(className)}
      fill="none"
      stroke="#C43A4A"
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

export function PencilIcon({ className, ...props }: ActionIconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={iconClassName(className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
      {...props}
    >
      <path d="M4 14.5l.5-3L13.5 2.5l3 3L7.5 14.5z" />
      <path d="M11.5 4.5l3 3" />
    </svg>
  );
}

export function PlusIcon({ className, ...props }: ActionIconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={iconClassName(className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
      {...props}
    >
      <path d="M10 4v12M4 10h12" />
    </svg>
  );
}

export function MoreActionsIcon({ className, ...props }: ActionIconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={iconClassName(className)}
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <circle cx="10" cy="4.5" r="1.5" />
      <circle cx="10" cy="10" r="1.5" />
      <circle cx="10" cy="15.5" r="1.5" />
    </svg>
  );
}

export function CopyIcon({ className, ...props }: ActionIconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={iconClassName(className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
      {...props}
    >
      <rect x="7" y="7" width="10" height="10" rx="2" />
      <rect x="3" y="3" width="10" height="10" rx="2" />
    </svg>
  );
}

export function ArchiveIcon({ className, ...props }: ActionIconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={iconClassName(className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
      {...props}
    >
      <path d="M3 6h14v11H3z" />
      <path d="M7 6V4h6v2" />
    </svg>
  );
}

export function CloseIcon({ className, ...props }: ActionIconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={iconClassName(className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
      {...props}
    >
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}

export function GeneratePdfIcon({ className, ...props }: ActionIconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={iconClassName(className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
      {...props}
    >
      <path d="M6 2.8h6.2l3 3V17H6z" />
      <path d="M12.2 2.8v3h3" />
      <path d="M8 10h4" />
      <path d="M10 8v4" />
    </svg>
  );
}

export const TrashCanIcon = OrdersTrashIcon;
