import type { InputHTMLAttributes } from 'react';

export type QuantityInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'> & {
  className?: string;
};

const classNames = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

export default function QuantityInput({ className, ...props }: QuantityInputProps) {
  return (
    <input
      {...props}
      type="number"
      aria-label={props['aria-label'] ?? 'Količina'}
      className={classNames(
        "h-7 w-14 appearance-none rounded-md border border-slate-200 px-0 py-0 text-center font-['Inter',system-ui,sans-serif] text-sm font-semibold leading-7 text-slate-700 outline-none transition [appearance:textfield] focus:border-[#3e67d6] focus:ring-0 focus:ring-[#3e67d6] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
        className
      )}
    />
  );
}
