'use client';

import { BUSINESS_PERIOD_PRESETS } from '@/shared/domain/analytics/period';

export type AdminPeriodOption = { value: string; label: string; ariaLabel?: string };
export const ADMIN_PERIOD_OPTIONS: readonly AdminPeriodOption[] = BUSINESS_PERIOD_PRESETS.map(value => ({
  value, label: value.endsWith('D') ? value.toLowerCase() : value, ariaLabel: value
}));

type Props = {
  value: string;
  onChange: (value: string) => void;
  options?: readonly AdminPeriodOption[];
  ariaLabel?: string;
};

/** Shared compact range control, using the established order-list treatment. */
export default function AdminPeriodSelector({ value, onChange, options = ADMIN_PERIOD_OPTIONS, ariaLabel = 'Obdobje' }: Props) {
  return <div role="group" aria-label={ariaLabel} data-admin-period-selector className="inline-flex h-8 max-w-full items-center gap-1 overflow-x-auto rounded-md border border-slate-300 bg-white px-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
    {options.map(option => <button
      key={option.value}
      type="button"
      aria-label={option.ariaLabel}
      aria-pressed={value.toUpperCase() === option.value.toUpperCase()}
      onClick={() => onChange(option.value)}
      className={`shrink-0 whitespace-nowrap rounded-md border border-transparent px-3 py-1 text-xs font-semibold tracking-[0] transition focus-visible:border-[#3e67d6] focus-visible:outline-none focus-visible:ring-0 ${value.toUpperCase() === option.value.toUpperCase() ? 'bg-[color:var(--blue-500)] text-white' : 'text-slate-700 hover:bg-[color:var(--hover-neutral)]'}`}
    >{option.label}</button>)}
  </div>;
}
