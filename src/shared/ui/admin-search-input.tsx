import type { InputHTMLAttributes } from 'react';
import { EuiFieldText } from '@elastic/eui';
import { ADMIN_CONTROL_PADDING_X } from '@/shared/ui/admin-controls/controlSizes';

type AdminSearchInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  showIcon?: boolean;
};

export function AdminSearchInput({ className = '', showIcon = true, ...props }: AdminSearchInputProps) {
  return (
    <div className="relative min-w-0 w-full flex-1">
      {showIcon ? (
        <svg
          viewBox="0 0 20 20"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <circle cx="9" cy="9" r="5.6" />
          <path d="m13 13 3.8 3.8" />
        </svg>
      ) : null}
      <EuiFieldText
        type="search"
        fullWidth
        className={`!h-7 min-w-0 w-full rounded-xl border border-slate-300 ${ADMIN_CONTROL_PADDING_X} ${showIcon ? 'pl-9' : ''} font-['Inter',system-ui,sans-serif] !text-[11px] text-slate-700 outline-none focus:border-[#3e67d6] focus:ring-0 focus:ring-[#3e67d6] ${className}`}
        aria-label={props['aria-label'] ?? props.placeholder ?? 'Iskanje'}
        {...props}
      />
    </div>
  );
}
