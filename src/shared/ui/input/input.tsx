import { forwardRef, type InputHTMLAttributes } from 'react';
import { EuiFieldText } from '@elastic/eui';
import { adminEuiInputFocusTokenClasses } from '@/shared/ui/theme/tokens';

type InputProps = InputHTMLAttributes<HTMLInputElement>;

const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, ...props }, ref) {
  return (
    <EuiFieldText
      inputRef={ref}
      {...props}
      fullWidth
      aria-label={props['aria-label'] ?? props.placeholder ?? 'Vnosno polje'}
      className={[
        `rounded-md border border-slate-300 bg-white font-['Inter',system-ui,sans-serif] text-slate-900 outline-none transition disabled:cursor-default disabled:opacity-60 ${adminEuiInputFocusTokenClasses}`,
        className
      ]
        .filter(Boolean)
        .join(' ')}
    />
  );
});

export default Input;
