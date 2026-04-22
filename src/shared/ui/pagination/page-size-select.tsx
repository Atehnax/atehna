'use client';

import { CustomSelect } from '@/shared/ui/select';

type PageSizeSelectProps = {
  value: number;
  options: number[];
  onChange: (value: number) => void;
  label?: string;
  className?: string;
  size?: 'sm' | 'md';
};

const triggerSizeClassMap = {
  sm: {
    className: '!w-full !px-[5px] !py-0',
    triggerClassName: '!pr-4',
    valueClassName: 'inline-flex h-full w-full items-center justify-center text-center leading-none tabular-nums'
  },
  md: {
    className: '!w-full !px-2 !py-0',
    triggerClassName: '!h-10 !rounded-xl !border-slate-200/90 !bg-white !pr-5',
    valueClassName:
      'inline-flex h-full w-full items-center justify-center text-center text-[13px] font-medium leading-none tabular-nums text-slate-700'
  }
} as const;

export default function PageSizeSelect({
  value,
  options,
  onChange,
  label = 'Vrstic na stran',
  className,
  size = 'sm'
}: PageSizeSelectProps) {
  const sizeClasses = triggerSizeClassMap[size];

  return (
    <div className={className}>
      <label className="sr-only">{label}</label>
      <CustomSelect
        value={String(value)}
        onChange={(next) => onChange(Number(next))}
        options={options.map((option) => ({ value: String(option), label: String(option) }))}
        className={sizeClasses.className}
        triggerClassName={sizeClasses.triggerClassName}
        valueClassName={sizeClasses.valueClassName}
        menuClassName="w-full"
      />
    </div>
  );
}

export type { PageSizeSelectProps };
