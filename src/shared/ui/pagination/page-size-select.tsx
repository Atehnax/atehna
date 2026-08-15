'use client';

import CustomSelect from '../select/custom-select';
import {
  ALL_PAGE_SIZE,
  normalizePageSizeOptions,
  parsePageSizeValue,
  type PageSizeValue
} from '@/shared/domain/pagination';

type PageSizeSelectProps = {
  value: PageSizeValue;
  options: readonly number[];
  onChange: (value: PageSizeValue) => void;
  includeAll?: boolean;
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
  includeAll = true,
  label = 'Vrstic na stran',
  className,
  size = 'sm'
}: PageSizeSelectProps) {
  const sizeClasses = triggerSizeClassMap[size];
  const normalizedOptions = normalizePageSizeOptions(options);
  const selectOptions = [
    ...normalizedOptions.map((option) => ({ value: String(option), label: String(option) })),
    ...(includeAll ? [{ value: ALL_PAGE_SIZE, label: 'Vse' }] : [])
  ];

  return (
    <div className={className}>
      <label className="sr-only">{label}</label>
      <CustomSelect
        value={String(value)}
        onChange={(next) => {
          const parsedValue = parsePageSizeValue(next, normalizedOptions);
          if (parsedValue !== null) onChange(parsedValue);
        }}
        options={selectOptions}
        className={sizeClasses.className}
        triggerClassName={sizeClasses.triggerClassName}
        valueClassName={sizeClasses.valueClassName}
        menuClassName="w-full"
      />
    </div>
  );
}

export type { PageSizeSelectProps };
