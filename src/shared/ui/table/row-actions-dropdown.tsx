'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { IconButton } from '@/shared/ui/icon-button';
import { HorizontalDotsIcon } from '@/shared/ui/icons/AdminActionIcons';
import { MenuItem, MenuPanel } from '@/shared/ui/menu';

type RowActionItem = {
  key: string;
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  className?: string;
};

type RowActionsDropdownProps = {
  label: string;
  items: RowActionItem[];
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
};

export default function RowActionsDropdown({
  label,
  items,
  className,
  triggerClassName,
  menuClassName
}: RowActionsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className={`relative ${className ?? ''}`.trim()}>
      <IconButton
        type="button"
        tone="neutral"
        className={`h-8 w-8 border-0 bg-transparent text-slate-600 shadow-none hover:text-slate-800 active:bg-transparent ${triggerClassName ?? ''}`.trim()}
        aria-label={label}
        title={label}
        onClick={() => setIsOpen((previousOpen) => !previousOpen)}
      >
        <HorizontalDotsIcon />
      </IconButton>

      {isOpen ? (
        <MenuPanel className={`absolute right-0 top-8 z-20 w-28 ${menuClassName ?? ''}`.trim()}>
          {items.map((item) => (
            <MenuItem
              key={item.key}
              disabled={item.disabled}
              onClick={() => {
                if (item.disabled) return;
                setIsOpen(false);
                item.onSelect();
              }}
            >
              <span className={`inline-flex items-center gap-1.5 leading-none ${item.className ?? ''}`.trim()}>
                {item.icon ? <span className="inline-flex h-4 w-4 items-center justify-center">{item.icon}</span> : null}
                <span className="inline-flex items-center">{item.label}</span>
              </span>
            </MenuItem>
          ))}
        </MenuPanel>
      ) : null}
    </div>
  );
}
