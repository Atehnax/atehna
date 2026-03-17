import type { InputHTMLAttributes } from 'react';
import { ADMIN_CONTROL_HEIGHT, ADMIN_CONTROL_PADDING_X } from '@/shared/ui/admin-controls/controlSizes';

type AdminSearchInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

export function AdminSearchInput({ className = '', ...props }: AdminSearchInputProps) {
  return (
    <input
      type="search"
      className={`${ADMIN_CONTROL_HEIGHT} min-w-[260px] flex-1 rounded-xl border border-slate-300 ${ADMIN_CONTROL_PADDING_X} text-xs text-slate-700 outline-none focus:border-[#3e67d6] focus:ring-0 focus:ring-[#3e67d6] ${className}`}
      {...props}
    />
  );
}
