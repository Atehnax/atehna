'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import IconButton from '../icon-button/IconButton';
import { MoreActionsIcon } from '@/shared/ui/icons/AdminActionIcons';
import MenuItem from '../menu/menu-item';
import MenuPanel from '../menu/menu-panel';
import { useDropdownDismiss } from '@/shared/ui/dropdown/use-dropdown-dismiss';

export type RowActionItem = {
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
  renderTrigger?: (props: ButtonHTMLAttributes<HTMLButtonElement>) => ReactNode;
  menuClassName?: string;
  menuWidth?: number;
  menuZIndex?: number;
  menuTestId?: string;
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
  renderTrigger,
  menuClassName,
  menuWidth = 112,
  menuZIndex = 70,
  menuTestId,
  editScope
}: RowActionsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuId = useId();
  const focusLastItemRef = useRef(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({ visibility: 'hidden' });
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeMenu = useCallback(() => setIsOpen(false), []);
  const dismissRefs = useMemo(() => [rootRef, menuRef], []);

  const updateMenuPosition = useCallback(() => {
    if (!triggerRef.current || typeof window === 'undefined') {
      setMenuStyle({ visibility: 'hidden' });
      return;
    }

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const menuHeight = menuRef.current?.getBoundingClientRect().height ?? 0;
    const maxLeft = document.documentElement.clientWidth - menuWidth - VIEWPORT_MARGIN_PX;
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
      zIndex: menuZIndex,
      transformOrigin: shouldFlipAbove ? 'bottom right' : 'top right',
      visibility: 'visible'
    });
  }, [menuWidth, menuZIndex]);

  useDropdownDismiss({
    open: isOpen,
    refs: dismissRefs,
    onClose: closeMenu
  });

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

  useEffect(() => {
    if (!isOpen) return;
    const frame = window.requestAnimationFrame(() => {
      const enabledItems = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)');
      if (enabledItems?.length) enabledItems[focusLastItemRef.current ? enabledItems.length - 1 : 0].focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen]);

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const enabledItems = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []);
    if (event.key === 'Tab') {
      setIsOpen(false);
      triggerRef.current?.querySelector('button')?.focus();
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) || !enabledItems.length) return;
    event.preventDefault();
    const currentIndex = enabledItems.findIndex(item => item === document.activeElement);
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? enabledItems.length - 1
      : (currentIndex + (event.key === 'ArrowDown' ? 1 : -1) + enabledItems.length) % enabledItems.length;
    enabledItems[nextIndex]?.focus();
  };
  const triggerProps: ButtonHTMLAttributes<HTMLButtonElement> = {
    type: 'button',
    'aria-label': label,
    title: label,
    'aria-haspopup': 'menu',
    'aria-expanded': isOpen,
    'aria-controls': isOpen ? menuId : undefined,
    onClick: () => { focusLastItemRef.current = false; setIsOpen(previousOpen => !previousOpen); },
    onKeyDown: event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        focusLastItemRef.current = event.key === 'ArrowUp';
        setIsOpen(true);
      }
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className ?? ''}`.trim()} data-edit-scope={editScope}>
      <div ref={triggerRef} className="inline-flex">
        {renderTrigger ? renderTrigger(triggerProps) : <IconButton
          {...triggerProps}
          tone="neutral"
          className={`h-8 w-8 border-0 bg-transparent text-slate-600 shadow-none hover:border-transparent hover:bg-transparent hover:text-slate-600 active:bg-transparent ${triggerClassName ?? ''}`.trim()}
        >
          <MoreActionsIcon />
        </IconButton>}
      </div>

      {isOpen ? (
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            onKeyDown={handleMenuKeyDown}
            aria-label={label}
            style={menuStyle}
            data-edit-scope={editScope}
            data-testid={menuTestId}
          >
            <MenuPanel className={`w-full ${menuClassName ?? ''}`.trim()}>
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
