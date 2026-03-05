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
      className={classNames(
        'w-16 rounded-lg border border-slate-200 px-2 py-1 text-center text-sm font-semibold text-slate-700 outline-none transition focus:border-[#5d3ed6] focus:ring-0 focus:ring-[#5d3ed6]',
        className
      )}
    />
  );
}
