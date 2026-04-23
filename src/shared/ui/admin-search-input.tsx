import type { InputHTMLAttributes } from 'react';
import { adminInputFocusTokenClasses } from '@/shared/ui/theme/tokens';
import {
  adminTableSearchIconClassName,
  adminTableSearchInputClassName,
  adminTableSearchWrapperClassName
} from '@/shared/ui/admin-table/standards';

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
        `relative min-w-0 w-full flex-1 overflow-hidden border transition-colors focus-within:border-[#3e67d6] ${adminTableSearchWrapperClassName}`,
        wrapperClassName
      )}
    >
      {showIcon ? (
        <svg
          viewBox="0 0 20 20"
          className={classNames(
            `pointer-events-none absolute top-1/2 z-10 -translate-y-1/2 ${adminTableSearchIconClassName}`,
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
          adminTableSearchInputClassName,
          showIcon ? '!pl-11' : '!pl-3',
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
