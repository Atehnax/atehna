'use client';

import type { MouseEventHandler, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import AdminTablePrimaryActionButton from './primary-action-button';
import RowActionsDropdown, { type RowActionItem } from '../table/row-actions-dropdown';

type Props = {
  label: string;
  children: ReactNode;
  menuLabel: string;
  items: RowActionItem[];
  onClick: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  buttonClassName?: string;
  menuWidth?: number;
};

export default function AdminTablePrimarySplitActionButton({
  label, children, menuLabel, items, onClick, disabled = false, buttonClassName, menuWidth = 224
}: Props) {
  return (
    <div role="group" aria-label={label} className="inline-flex shrink-0 items-center [&&>button]:!rounded-r-none [&&>button]:!border-r-0">
      <AdminTablePrimaryActionButton
        type="button"
        aria-label={label}
        className={buttonClassName}
        onClick={onClick}
        disabled={disabled}
      >
        {children}
      </AdminTablePrimaryActionButton>
      <RowActionsDropdown
        label={menuLabel}
        className="inline-flex"
        menuWidth={menuWidth}
        items={items.map(item => ({ ...item, disabled: disabled || item.disabled, className: `whitespace-nowrap ${item.className ?? ''}` }))}
        renderTrigger={props => (
          <AdminTablePrimaryActionButton
            {...props}
            disabled={disabled}
            className="[&&]:!w-7 [&&]:!rounded-l-none [&&]:!border-l-white/30 [&&]:!px-0"
          >
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </AdminTablePrimaryActionButton>
        )}
      />
    </div>
  );
}
