import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import Button from '../button/Button';
import { adminTablePrimaryButtonClassName } from './standards';

type AdminTablePrimaryActionButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'className'
> & {
  children: ReactNode;
  className?: string;
};

const classNames = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

const AdminTablePrimaryActionButton = forwardRef<
  HTMLButtonElement,
  AdminTablePrimaryActionButtonProps
>(function AdminTablePrimaryActionButton({ children, className, ...props }, ref) {
  return (
    <Button
      {...props}
      ref={ref}
      variant="primary"
      size="toolbar"
      className={classNames(adminTablePrimaryButtonClassName, className)}
    >
      {children}
    </Button>
  );
});

export default AdminTablePrimaryActionButton;
