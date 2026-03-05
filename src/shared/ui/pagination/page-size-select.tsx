'use client';

import { CustomSelect } from '@/shared/ui/select';

type PageSizeSelectProps = {
  value: number;
  options: number[];
  onChange: (value: number) => void;
  label?: string;
  className?: string;
};

export default function PageSizeSelect({
  value,
  options,
  onChange,
  label = 'Vrstic na stran',
  className
}: PageSizeSelectProps) {
  return (
    <div className={className}>
      <label className="sr-only">{label}</label>
      <CustomSelect
        value={String(value)}
        onChange={(next) => onChange(Number(next))}
        options={options.map((option) => ({ value: String(option), label: String(option) }))}
        className="flex h-8 min-w-[72px] items-center rounded-xl border border-slate-300 bg-white px-3 pr-7 pt-0 text-center text-xs font-semibold leading-none text-slate-700 shadow-sm"
        menuClassName="w-full"
      />
    </div>
  );
}

export type { PageSizeSelectProps };
