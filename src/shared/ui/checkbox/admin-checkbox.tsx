import { forwardRef, type InputHTMLAttributes } from 'react';

type AdminCheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

const classNames = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

const AdminCheckbox = forwardRef<HTMLInputElement, AdminCheckboxProps>(function AdminCheckbox({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      type="checkbox"
      className={classNames(
        'h-3.5 w-3.5 rounded-[3px] border border-slate-300 bg-white align-middle accent-[color:var(--blue-500)]',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#3e67d6]/35',
        className
      )}
      {...props}
    />
  );
});

export default AdminCheckbox;
