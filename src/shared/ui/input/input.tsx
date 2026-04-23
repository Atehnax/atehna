import { forwardRef, type InputHTMLAttributes } from 'react';
import { adminInputFocusTokenClasses, adminPlaceholderTokenClasses } from '@/shared/ui/theme/tokens';

type InputProps = InputHTMLAttributes<HTMLInputElement>;

const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      {...props}
      aria-label={props['aria-label'] ?? props.placeholder ?? 'Vnosno polje'}
      className={[
        `w-full rounded-md border border-slate-300 bg-white font-['Inter',system-ui,sans-serif] text-slate-900 outline-none transition-[border-color,box-shadow,color,opacity] disabled:cursor-default disabled:opacity-60 disabled:!bg-[color:var(--field-locked-bg)] read-only:!bg-[color:var(--field-locked-bg)] ${adminInputFocusTokenClasses} ${adminPlaceholderTokenClasses}`,
        className
      ]
        .filter(Boolean)
        .join(' ')}
    />
  );
});

export default Input;
