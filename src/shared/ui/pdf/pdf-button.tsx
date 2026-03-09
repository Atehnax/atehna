import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

export type PdfButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & {
  children: ReactNode;
  className?: string;
};

const classNames = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

const PdfButton = forwardRef<HTMLButtonElement, PdfButtonProps>(function PdfButton(
  { children, className, ...props },
  ref
) {
  return (
    <button
      {...props}
      ref={ref}
      className={classNames(
        'inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-[color:var(--hover-neutral)] hover:text-slate-700 disabled:cursor-default disabled:bg-slate-200 disabled:text-slate-400',
        className
      )}
    >
      {children}
    </button>
  );
});

export default PdfButton;
