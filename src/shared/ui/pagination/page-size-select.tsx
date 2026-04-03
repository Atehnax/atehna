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
        className="!w-full !bg-white !px-[5px] !py-0 !active:bg-white !hover:bg-white"
        triggerClassName="!pr-4 !bg-white !active:bg-white !hover:bg-white"
        valueClassName="inline-flex h-full w-full items-center justify-center text-center leading-none tabular-nums"
        menuClassName="w-full"
        forceWhiteBackground
      />
    </div>
  );
}

export type { PageSizeSelectProps };
