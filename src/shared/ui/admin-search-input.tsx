import type { InputHTMLAttributes } from 'react';
import { ADMIN_CONTROL_PADDING_X } from '@/shared/ui/admin-controls/controlSizes';
import { adminInputFocusTokenClasses } from '@/shared/ui/theme/tokens';

type AdminSearchInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  showIcon?: boolean;
  wrapperClassName?: string;
  inputClassName?: string;
  iconClassName?: string;
};

const classNames = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

export function AdminSearchInput({
  className = '',
  showIcon = true,
  wrapperClassName,
  inputClassName,
  iconClassName,
  ...props
}: AdminSearchInputProps) {
  return (
    <div
      className={classNames(
        'relative min-w-0 w-full flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white transition-colors focus-within:border-[#3e67d6]',
        wrapperClassName
      )}
    >
      {showIcon ? (
        <svg
          viewBox="0 0 20 20"
          className={classNames(
            'pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-500',
            iconClassName
          )}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <circle cx="9" cy="9" r="5.6" />
          <path d="m13 13 3.8 3.8" />
        </svg>
      ) : null}

      <input
        type="search"
        className={classNames(
          `!h-7 min-w-0 w-full rounded-xl border-0 bg-transparent ${ADMIN_CONTROL_PADDING_X}`,
          showIcon ? '!pl-10' : '',
          "font-['Inter',system-ui,sans-serif] !text-[11px] text-slate-700 shadow-none",
          adminInputFocusTokenClasses,
          className,
          inputClassName
        )}
        aria-label={props['aria-label'] ?? props.placeholder ?? 'Iskanje'}
        {...props}
      />
    </div>
  );
}
