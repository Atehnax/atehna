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
        className="h-8 w-20 min-w-[72px] rounded-xl border border-slate-300 bg-white px-2.5 !pb-0 !pt-0 text-center text-xs font-semibold leading-5 text-slate-700 shadow-sm"
        menuClassName="w-full"
      />
    </div>
  );
}

export type { PageSizeSelectProps };
