'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
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
  menuWidth?: number;
  editScope?: string;
};

const VIEWPORT_MARGIN_PX = 8;
const MENU_GAP_PX = 6;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export default function RowActionsDropdown({
  label,
  items,
  className,
  triggerClassName,
  menuClassName,
  menuWidth = 112,
  editScope
}: RowActionsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({ visibility: 'hidden' });
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updateMenuPosition = useCallback(() => {
    if (!triggerRef.current || typeof window === 'undefined') {
      setMenuStyle({ visibility: 'hidden' });
      return;
    }

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const menuHeight = menuRef.current?.getBoundingClientRect().height ?? 0;
    const maxLeft = window.innerWidth - menuWidth - VIEWPORT_MARGIN_PX;
    const left = clamp(triggerRect.right - menuWidth, VIEWPORT_MARGIN_PX, Math.max(VIEWPORT_MARGIN_PX, maxLeft));

    const bottomTop = triggerRect.bottom + MENU_GAP_PX;
    const topTop = triggerRect.top - menuHeight - MENU_GAP_PX;
    const fitsBelow = menuHeight === 0 || bottomTop + menuHeight <= window.innerHeight - VIEWPORT_MARGIN_PX;
    const fitsAbove = menuHeight > 0 && topTop >= VIEWPORT_MARGIN_PX;
    const shouldFlipAbove = !fitsBelow && fitsAbove;
    const maxTop = menuHeight > 0 ? window.innerHeight - menuHeight - VIEWPORT_MARGIN_PX : window.innerHeight - VIEWPORT_MARGIN_PX;
    const top = menuHeight > 0
      ? clamp(shouldFlipAbove ? topTop : bottomTop, VIEWPORT_MARGIN_PX, Math.max(VIEWPORT_MARGIN_PX, maxTop))
      : bottomTop;

    setMenuStyle({
      position: 'fixed',
      top,
      left,
      width: menuWidth,
      zIndex: 70,
      transformOrigin: shouldFlipAbove ? 'bottom right' : 'top right',
      visibility: 'visible'
    });
  }, [menuWidth]);

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

  useLayoutEffect(() => {
    if (!isOpen) {
      setMenuStyle({ visibility: 'hidden' });
      return;
    }

    updateMenuPosition();
  }, [isOpen, items.length, updateMenuPosition]);

  useEffect(() => {
    if (!isOpen) return;

    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);

    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateMenuPosition);
    if (resizeObserver) {
      if (triggerRef.current) resizeObserver.observe(triggerRef.current);
      if (menuRef.current) resizeObserver.observe(menuRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
      resizeObserver?.disconnect();
    };
  }, [isOpen, updateMenuPosition]);

  return (
    <div ref={rootRef} className={`relative ${className ?? ''}`.trim()} data-edit-scope={editScope}>
      <div ref={triggerRef} className="inline-flex">
        <IconButton
          type="button"
          tone="neutral"
          className={`h-8 w-8 border-0 bg-transparent text-slate-600 shadow-none hover:border-transparent hover:bg-transparent hover:text-slate-600 active:bg-transparent ${triggerClassName ?? ''}`.trim()}
          aria-label={label}
          title={label}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((previousOpen) => !previousOpen)}
        >
          <MoreActionsIcon />
        </IconButton>
      </div>

      {isOpen ? (
        createPortal(
          <div ref={menuRef} role="menu" style={menuStyle} data-edit-scope={editScope}>
            <MenuPanel className={`w-28 ${menuClassName ?? ''}`.trim()}>
              {items.map((item) => (
                <MenuItem
                  key={item.key}
                  className={`!text-[12px] ${item.className ?? ''}`.trim()}
                  disabled={item.disabled}
                  onClick={() => {
                    if (item.disabled) return;
                    setIsOpen(false);
                    item.onSelect();
                  }}
                >
                  <span className="inline-flex items-center gap-1.5 leading-none">
                    {item.icon ? <span className="inline-flex h-3 w-3 items-center justify-center text-[12px] [&_svg]:h-3 [&_svg]:w-3">{item.icon}</span> : null}
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
