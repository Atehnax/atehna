import type { InputHTMLAttributes } from 'react';
import { EuiFieldText } from '@elastic/eui';
import { ADMIN_CONTROL_PADDING_X } from '@/shared/ui/admin-controls/controlSizes';
import { adminEuiInputFocusTokenClasses } from '@/shared/ui/theme/tokens';

type AdminSearchInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  showIcon?: boolean;
};

export function AdminSearchInput({ className = '', showIcon = true, ...props }: AdminSearchInputProps) {
  return (
    <div className="relative min-w-0 w-full flex-1">
      {showIcon ? (
        <svg
          viewBox="0 0 20 20"
          className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-500"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <circle cx="9" cy="9" r="5.6" />
          <path d="m13 13 3.8 3.8" />
        </svg>
      ) : null}
      <EuiFieldText
        type="search"
        fullWidth
        className={`!h-7 min-w-0 w-full rounded-xl border border-slate-300 ${ADMIN_CONTROL_PADDING_X} ${showIcon ? '!pl-10' : ''} font-['Inter',system-ui,sans-serif] !text-[11px] text-slate-700 ${adminEuiInputFocusTokenClasses} ${className}`}
        aria-label={props['aria-label'] ?? props.placeholder ?? 'Iskanje'}
        {...props}
      />
    </div>
  );
}
