'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from '@/shared/ui/icon-button';
import { MoreActionsIcon } from '@/shared/ui/icons/AdminActionIcons';
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
  editScope?: string;
};

export default function RowActionsDropdown({
  label,
  items,
  className,
  triggerClassName,
  menuClassName,
  editScope
}: RowActionsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setIsOpen(false);
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

  const getMenuStyle = (): CSSProperties => {
    if (!triggerRef.current || typeof window === 'undefined') return { visibility: 'hidden' };
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const menuWidth = 112;
    const left = Math.min(Math.max(8, triggerRect.right - menuWidth), window.innerWidth - menuWidth - 8);

    return {
      position: 'fixed',
      top: triggerRect.bottom + 4,
      left,
      width: menuWidth,
      zIndex: 70
    };
  };

  return (
    <div ref={rootRef} className={`relative ${className ?? ''}`.trim()} data-edit-scope={editScope}>
      <div ref={triggerRef} className="inline-flex">
        <IconButton
          type="button"
          tone="neutral"
          className={`h-8 w-8 border-0 bg-transparent text-slate-600 shadow-none hover:border-transparent hover:bg-transparent hover:text-slate-600 active:bg-transparent ${triggerClassName ?? ''}`.trim()}
          aria-label={label}
          title={label}
          onClick={() => setIsOpen((previousOpen) => !previousOpen)}
        >
          <MoreActionsIcon />
        </IconButton>
      </div>

      {isOpen ? (
        createPortal(
          <div ref={menuRef} style={getMenuStyle()} data-edit-scope={editScope}>
            <MenuPanel className={`w-28 ${menuClassName ?? ''}`.trim()}>
              {items.map((item) => (
                <MenuItem
                  key={item.key}
                  className={item.className}
                  disabled={item.disabled}
                  onClick={() => {
                    if (item.disabled) return;
                    setIsOpen(false);
                    item.onSelect();
                  }}
                >
                  <span className="inline-flex items-center gap-1.5 leading-none">
                    {item.icon ? <span className="inline-flex h-[11px] w-[11px] items-center justify-center text-[11px] [&_svg]:h-[11px] [&_svg]:w-[11px]">{item.icon}</span> : null}
                    <span className="inline-flex items-center">{item.label}</span>
                  </span>
                </MenuItem>
              ))}
            </MenuPanel>
          </div>,
          document.body
        )
      ) : null}
    </div>
  );
}
