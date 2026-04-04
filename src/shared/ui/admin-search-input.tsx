import type { InputHTMLAttributes } from 'react';
import { EuiFieldText } from '@elastic/eui';
import { ADMIN_CONTROL_PADDING_X } from '@/shared/ui/admin-controls/controlSizes';
import { adminInputFocusTokenClasses } from '@/shared/ui/theme/tokens';

type AdminSearchInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  showIcon?: boolean;
};

export function AdminSearchInput({ className = '', showIcon = true, ...props }: AdminSearchInputProps) {
  return (
    <div
      className={`relative min-w-0 w-full flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white transition-colors focus-within:border-[#3e67d6] ${className}`}
    >
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
        className={`!m-0 !h-full min-w-0 w-full !border-0 !bg-transparent !shadow-none focus:!border-0 focus:!shadow-none focus-visible:!border-0 focus-visible:!shadow-none ${showIcon ? '!pl-10' : '!pl-3'} !pr-3 font-['Inter',system-ui,sans-serif] !text-[11px] text-slate-700 placeholder:text-slate-400 ${ADMIN_CONTROL_PADDING_X} ${adminInputFocusTokenClasses}`}
        aria-label={props['aria-label'] ?? props.placeholder ?? 'Iskanje'}
        {...props}
      />
    </div>
  );
}
