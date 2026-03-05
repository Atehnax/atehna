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
        className="h-8 w-[72px] rounded-md border border-slate-300 bg-white pl-2 pr-6 text-xs font-semibold leading-none text-slate-700 shadow-none"
        valueClassName="inline-flex h-full w-full items-center justify-center text-center leading-none"
        menuClassName="w-full"
      />
    </div>
  );
}

export type { PageSizeSelectProps };
