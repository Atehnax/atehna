import { useId, type SVGProps } from 'react';

type ActionIconProps = SVGProps<SVGSVGElement>;

const classNames = (...parts: Array<string | null | undefined | false>) => parts.filter(Boolean).join(' ');
const defaultIconSizeClassName = 'h-[18px] w-[18px] shrink-0';

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
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M10 2.9v9.6" />
      <path d="m6.5 9.2 3.5 3.6 3.5-3.6" />
      <path d="M2.8 12.2v2.2c0 1.5 1 2.6 2.4 2.6h9.6c1.4 0 2.4-1.1 2.4-2.6v-2.2" />
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
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M2.8 12.2v2.2c0 1.5 1 2.6 2.4 2.6h9.6c1.4 0 2.4-1.1 2.4-2.6v-2.2" />
      <path d="M10 12.5V2.9" />
      <path d="m6.5 6.4 3.5-3.5 3.5 3.5" />
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
      strokeWidth="1.5"
      aria-hidden="true"
      {...props}
    >
      <path d="M4 3h9l3 3v11H4z" />
      <path d="M7 3v5h6V3" />
      <path d="M7 13h6" />
    </svg>
  );
}

export function ActionFilterIcon({ className, ...props }: ActionIconProps) {
  const iconId = useId().replace(/:/g, '');
  const cutMaskId = `filter-cut-${iconId}`;

  return (
    <svg
      viewBox="0 0 20 20"
      className={iconClassName(className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <defs>
        <mask id={cutMaskId}>
          <rect fill="white" x="0" y="0" width="20" height="20" />
          {/* hide front funnel + gap */}
          <path
            fill="black"
            stroke="black"
            strokeWidth={4.0}
            strokeLinejoin="round"
            strokeLinecap="round"
            d="M 8.0,2.0 L 18.5,2.0 L 14.5,8.5 L 14.5,14.0 L 11.8,11.3 L 11.8,8.5 Z"
          />
        </mask>
      </defs>
      {/* back/left funnel */}
      <path
        mask={`url(#${cutMaskId})`}
        d="M 2.5,5.5 L 13.0,5.5 L 9.0,12.0 L 9.0,17.5 L 6.3,14.8 L 6.3,12.0 Z"
      />
      {/* front/right funnel */}
      <path d="M 8.0,2.0 L 18.5,2.0 L 14.5,8.5 L 14.5,14.0 L 11.8,11.3 L 11.8,8.5 Z" />
    </svg>
  );
}

export const FilterIcon = ActionFilterIcon;

export function PanelAddRemoveIcon({ className, ...props }: ActionIconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={iconClassName(classNames('scale-[0.81]', className))}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect x="1.5" y="1.5" width="17" height="17" rx="3" />
      <line x1="1.5" y1="6.5" x2="18.5" y2="6.5" />
      <line x1="10" y1="6.5" x2="10" y2="18.5" />
    </svg>
  );
}

export const PdfFilterActionIcon = PanelAddRemoveIcon;

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

export function ActionRestoreIcon({ className, ...props }: ActionIconProps) {
  return (
    <svg
      viewBox="0 0 640 640"
      className={iconClassName(className)}
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M262.2 48C248.9 48 236.9 56.3 232.2 68.8L216 112L120 112C106.7 112 96 122.7 96 136C96 149.3 106.7 160 120 160L520 160C533.3 160 544 149.3 544 136C544 122.7 533.3 112 520 112L424 112L407.8 68.8C403.1 56.3 391.2 48 377.8 48L262.2 48zM128 208L128 512C128 547.3 156.7 576 192 576L448 576C483.3 576 512 547.3 512 512L512 208L464 208L464 512C464 520.8 456.8 528 448 528L192 528C183.2 528 176 520.8 176 512L176 208L128 208z" />
      <path d="M337 267C327.6 257.6 312.4 257.6 303.1 267L231.1 339C221.7 348.4 221.7 363.6 231.1 372.9C240.5 382.2 255.7 382.3 265 372.9L296 341.9L296 444C296 457.3 306.7 468 320 468C333.3 468 344 457.3 344 444L344 341.9L375 372.9C384.4 382.3 399.6 382.3 408.9 372.9C418.2 363.5 418.3 348.3 408.9 339L336.9 267z" />
    </svg>
  );
}

export function ActionUndoIcon({ className, ...props }: ActionIconProps) {
  return (
    <svg
      viewBox="0 0 640 640"
      className={iconClassName(className)}
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M320 128C263.2 128 212.1 152.7 176.9 192L224 192C241.7 192 256 206.3 256 224C256 241.7 241.7 256 224 256L96 256C78.3 256 64 241.7 64 224L64 96C64 78.3 78.3 64 96 64C113.7 64 128 78.3 128 96L128 150.7C174.9 97.6 243.5 64 320 64C461.4 64 576 178.6 576 320C576 461.4 461.4 576 320 576C233 576 156.1 532.6 109.9 466.3C99.8 451.8 103.3 431.9 117.8 421.7C132.3 411.5 152.2 415.1 162.4 429.6C197.2 479.4 254.8 511.9 320 511.9C426 511.9 512 425.9 512 319.9C512 213.9 426 128 320 128z" />
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
      strokeWidth="1.5"
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
      strokeWidth="1.5"
      aria-hidden="true"
      {...props}
    >
      <path d="M10 4v12M4 10h12" />
    </svg>
  );
}

export function CheckCircleIcon({ className, ...props }: ActionIconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={iconClassName(className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="10" cy="10" r="7" />
      <path d="m6.8 10.2 2.2 2.2 4.2-4.3" />
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
      strokeWidth="1.5"
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
      strokeWidth="1.5"
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
      strokeWidth="1.5"
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
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M5 2.5h7.2L15.8 6v10.3c0 .9-.7 1.7-1.7 1.7H5c-.9 0-1.7-.7-1.7-1.7V4.2c0-.9.7-1.7 1.7-1.7z" />
      <path d="M12.2 2.5V5c0 .6.5 1 1 1h2.6" />
      <path d="M6.2 9.3h7.6" />
      <path d="M6.2 11.4h7.6" />
      <path d="M6.2 13.5h7.6" />
      <path d="M6.2 15.6h3.6" />
    </svg>
  );
}

export const TrashCanIcon = OrdersTrashIcon;
