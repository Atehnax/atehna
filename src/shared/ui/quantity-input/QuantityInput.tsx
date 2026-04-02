import type { InputHTMLAttributes } from 'react';
import { EuiFieldText } from '@elastic/eui';

export type QuantityInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'> & {
  className?: string;
};

const classNames = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

export default function QuantityInput({ className, ...props }: QuantityInputProps) {
  return (
    <EuiFieldText
      {...props}
      type="number"
      aria-label={props['aria-label'] ?? 'Količina'}
      className={classNames(
        'w-16 rounded-lg border border-slate-200 px-2 py-1 text-center text-sm font-semibold text-slate-700 outline-none transition focus:border-[#3e67d6] focus:ring-0 focus:ring-[#3e67d6]',
        className
      )}
    />
  );
}
