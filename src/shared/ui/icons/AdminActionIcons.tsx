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
      <path d="M3.4 5.2h13.2" />
      <path d="M3.4 10h13.2" />
      <path d="M3.4 14.8h13.2" />
      <circle cx="7.2" cy="5.2" r="1.55" fill="currentColor" stroke="none" />
      <circle cx="12.2" cy="10" r="1.55" fill="currentColor" stroke="none" />
      <circle cx="9.1" cy="14.8" r="1.55" fill="currentColor" stroke="none" />
    </svg>
  );
}

export const FilterIcon = ActionFilterIcon;

export function OrdersTrashIcon({ className, ...props }: ActionIconProps) {
  return (
    <svg
      viewBox="0 0 640 640"
      className={iconClassName(className)}
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M262.2 48C248.9 48 236.9 56.3 232.2 68.8L216 112L120 112C106.7 112 96 122.7 96 136C96 149.3 106.7 160 120 160L520 160C533.3 160 544 149.3 544 136C544 122.7 533.3 112 520 112L424 112L407.8 68.8C403.1 56.3 391.2 48 377.8 48L262.2 48zM128 208L128 512C128 547.3 156.7 576 192 576L448 576C483.3 576 512 547.3 512 512L512 208L464 208L464 512C464 520.8 456.8 528 448 528L192 528C183.2 528 176 520.8 176 512L176 208L128 208zM288 280C288 266.7 277.3 256 264 256C250.7 256 240 266.7 240 280L240 456C240 469.3 250.7 480 264 480C277.3 480 288 469.3 288 456L288 280zM400 280C400 266.7 389.3 256 376 256C362.7 256 352 266.7 352 280L352 456C352 469.3 362.7 480 376 480C389.3 480 400 469.3 400 456L400 280z" />
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

export function HorizontalDotsIcon({ className, ...props }: ActionIconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={iconClassName(className)}
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <circle cx="4.5" cy="10" r="1.5" />
      <circle cx="10" cy="10" r="1.5" />
      <circle cx="15.5" cy="10" r="1.5" />
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
