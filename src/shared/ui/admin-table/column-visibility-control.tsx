'use client';

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from 'react';
import { createPortal } from 'react-dom';
import MenuPanel from '../menu/menu-panel';
import { useDropdownDismiss } from '@/shared/ui/dropdown/use-dropdown-dismiss';
import { selectTokenClasses } from '@/shared/ui/theme/tokens';

type ColumnOption = {
  key: string;
  label: string;
  disabled?: boolean;
};

type MenuPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  transformOrigin: 'bottom right' | 'top right';
};

const MENU_GAP_PX = 6;
const VIEWPORT_MARGIN_PX = 8;
const MENU_Z_INDEX = 1200;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export function ColumnVisibilityControl({
  options,
  visibleMap,
  onToggle,
  className,
  triggerClassName,
  showLabel = true,
  icon,
  menuClassName,
  menuWidth = 208
}: {
  options: ColumnOption[];
  visibleMap: Record<string, boolean>;
  onToggle: (key: string) => void;
  className?: string;
  triggerClassName?: string;
  showLabel?: boolean;
  icon?: ReactNode;
  menuClassName?: string;
  menuWidth?: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const closeMenu = useCallback(() => {
    setIsOpen(false);
    setMenuPosition(null);
  }, []);
  const dismissRefs = useMemo(() => [rootRef, menuContainerRef], []);

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    const menuPanel = menuPanelRef.current;
    if (!trigger || !menuPanel || typeof window === 'undefined') return;

    const triggerRect = trigger.getBoundingClientRect();
    const menuRect = menuPanel.getBoundingClientRect();
    const naturalMenuHeight = Math.max(menuPanel.scrollHeight, menuRect.height);
    const visualViewport = window.visualViewport;
    const viewportTop = visualViewport?.offsetTop ?? 0;
    const viewportLeft = visualViewport?.offsetLeft ?? 0;
    const viewportWidth = visualViewport?.width ?? window.innerWidth;
    const viewportHeight = visualViewport?.height ?? window.innerHeight;
    const viewportRight = viewportLeft + viewportWidth;
    const viewportBottom = viewportTop + viewportHeight;
    const renderedMenuWidth = Math.min(menuWidth, Math.max(0, viewportWidth - VIEWPORT_MARGIN_PX * 2));
    const spaceBelow = Math.max(
      0,
      viewportBottom - triggerRect.bottom - MENU_GAP_PX - VIEWPORT_MARGIN_PX
    );
    const spaceAbove = Math.max(
      0,
      triggerRect.top - viewportTop - MENU_GAP_PX - VIEWPORT_MARGIN_PX
    );
    const opensAbove = naturalMenuHeight > spaceBelow && spaceAbove > spaceBelow;
    const maxHeight = opensAbove ? spaceAbove : spaceBelow;
    const renderedHeight = Math.min(naturalMenuHeight, maxHeight);
    const top = opensAbove
      ? Math.max(viewportTop + VIEWPORT_MARGIN_PX, triggerRect.top - MENU_GAP_PX - renderedHeight)
      : triggerRect.bottom + MENU_GAP_PX;
    const left = clamp(
      triggerRect.right - renderedMenuWidth,
      viewportLeft + VIEWPORT_MARGIN_PX,
      Math.max(
        viewportLeft + VIEWPORT_MARGIN_PX,
        viewportRight - renderedMenuWidth - VIEWPORT_MARGIN_PX
      )
    );
    const nextPosition: MenuPosition = {
      top,
      left,
      width: renderedMenuWidth,
      maxHeight,
      transformOrigin: opensAbove ? 'bottom right' : 'top right'
    };

    setMenuPosition((current) => current
      && current.top === nextPosition.top
      && current.left === nextPosition.left
      && current.width === nextPosition.width
      && current.maxHeight === nextPosition.maxHeight
      && current.transformOrigin === nextPosition.transformOrigin
        ? current
        : nextPosition);
  }, [menuWidth]);

  useDropdownDismiss({
    open: isOpen,
    refs: dismissRefs,
    onClose: closeMenu
  });

  useLayoutEffect(() => {
    if (!isOpen) return;
    updateMenuPosition();
  }, [isOpen, menuClassName, options.length, updateMenuPosition]);

  useEffect(() => {
    if (!isOpen) return;

    const focusFrameId = window.requestAnimationFrame(() => {
      menuPanelRef.current?.querySelector<HTMLInputElement>('input:not(:disabled)')?.focus();
    });

    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    window.visualViewport?.addEventListener('resize', updateMenuPosition);
    window.visualViewport?.addEventListener('scroll', updateMenuPosition);

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(updateMenuPosition);
    if (resizeObserver) {
      if (triggerRef.current) resizeObserver.observe(triggerRef.current);
      if (menuPanelRef.current) resizeObserver.observe(menuPanelRef.current);
    }

    return () => {
      window.cancelAnimationFrame(focusFrameId);
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
      window.visualViewport?.removeEventListener('resize', updateMenuPosition);
      window.visualViewport?.removeEventListener('scroll', updateMenuPosition);
      resizeObserver?.disconnect();
    };
  }, [isOpen, updateMenuPosition]);

  const floatingMenuStyle: CSSProperties = menuPosition
    ? {
      position: 'fixed',
      top: menuPosition.top,
      left: menuPosition.left,
      width: menuPosition.width,
      zIndex: MENU_Z_INDEX,
      transformOrigin: menuPosition.transformOrigin,
      visibility: 'visible'
    }
    : {
      position: 'fixed',
      top: 0,
      left: 0,
      width: menuWidth,
      zIndex: MENU_Z_INDEX,
      visibility: 'hidden'
    };

  return (
    <div ref={rootRef} className={`relative ${className ?? ''}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (isOpen) {
            closeMenu();
            return;
          }
          setIsOpen(true);
        }}
        className={`${selectTokenClasses.trigger} justify-center ${showLabel ? 'min-w-[92px] gap-2 px-2.5 pr-5' : 'w-8 !p-0'} ${isOpen ? 'bg-[color:var(--hover-neutral)]' : ''} ${triggerClassName ?? ''}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        aria-label="Filtriraj stolpce"
        title="Filtriraj stolpce"
      >
        {showLabel ? <span>Stolpci</span> : null}
        {icon ?? (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
            <circle cx="15" cy="6" r="2.5" fill="white" />
            <circle cx="8" cy="12" r="2.5" fill="white" />
            <circle cx="13" cy="18" r="2.5" fill="white" />
          </svg>
        )}
      </button>
      {isOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuContainerRef}
              id={menuId}
              role="menu"
              aria-label="Filtriraj stolpce"
              style={floatingMenuStyle}
              onKeyDown={(event) => {
                if (event.key !== 'Escape') return;
                event.preventDefault();
                event.stopPropagation();
                closeMenu();
                window.requestAnimationFrame(() => triggerRef.current?.focus());
              }}
            >
              <MenuPanel
                ref={menuPanelRef}
                className={`w-full max-w-full overflow-y-auto ${selectTokenClasses.menu} ${menuClassName ?? ''}`}
                style={{
                  width: '100%',
                  maxWidth: '100%',
                  maxHeight: menuPosition?.maxHeight
                }}
              >
                {options.map((option) => {
                  const isChecked = visibleMap[option.key] ?? false;
                  return (
                    <label
                      key={option.key}
                      className={`${selectTokenClasses.menuItem} cursor-pointer gap-2`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={option.disabled}
                        onChange={() => onToggle(option.key)}
                        className="h-3.5 w-3.5"
                      />
                      <span className={`whitespace-nowrap ${option.disabled ? 'opacity-60' : ''}`}>
                        {option.label}
                      </span>
                    </label>
                  );
                })}
              </MenuPanel>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
