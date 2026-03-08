import { forwardRef, type InputHTMLAttributes } from 'react';

type InputProps = InputHTMLAttributes<HTMLInputElement>;

const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      {...props}
      className={[
        'rounded-md border border-slate-300 bg-white text-slate-900 outline-none transition focus:border-[#3e67d6] focus:ring-0 disabled:cursor-default disabled:opacity-60',
        className
      ]
        .filter(Boolean)
        .join(' ')}
    />
  );
});

export default Input;
