'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import MenuItem from '../menu/menu-item';
import MenuPanel from '../menu/menu-panel';
import { useDropdownDismiss } from '@/shared/ui/dropdown/use-dropdown-dismiss';
import { selectTokenClasses } from '@/shared/ui/theme/tokens';

type CustomSelectOption<Value extends string> = {
  value: Value;
  label: string;
};

type CustomSelectProps<Value extends string> = {
  value: Value;
  onChange: (value: Value) => void;
  options: ReadonlyArray<CustomSelectOption<Value>>;
  disabled?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  containerClassName?: string;
  triggerClassName?: string;
  triggerStyle?: CSSProperties;
  menuClassName?: string;
  valueClassName?: string;
  valueStyle?: CSSProperties;
  showArrow?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
};

type MenuRect = {
  top: number;
  left: number;
  width: number;
  maxHeight?: number;
};

const MENU_GAP = 4;
const VIEWPORT_PADDING = 8;

const classNames = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

export default function CustomSelect<Value extends string = string>({
  value,
  onChange,
  options,
  disabled = false,
  placeholder = '',
  ariaLabel,
  className,
  containerClassName,
  triggerClassName,
  triggerStyle,
  menuClassName,
  valueClassName,
  valueStyle,
  showArrow = true,
  onOpenChange
}: CustomSelectProps<Value>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);
  const [menuRect, setMenuRect] = useState<MenuRect | null>(null);
  const closeSelect = useCallback(() => setIsOpen(false), []);
  const dismissRefs = useMemo(() => [containerRef, menuContainerRef], []);

  const selectedLabel = useMemo(
    () => options.find((option) => option.value === value)?.label ?? placeholder,
    [options, placeholder, value]
  );

  useDropdownDismiss({
    open: isOpen,
    refs: dismissRefs,
    onClose: closeSelect
  });

  useEffect(() => {
    onOpenChange?.(isOpen);
    if (!isOpen) return;

    const updateMenuRect = () => {
      const triggerBounds = triggerRef.current?.getBoundingClientRect();
      if (!triggerBounds) return;
      setMenuRect({
        top: triggerBounds.bottom + MENU_GAP,
        left: triggerBounds.left,
        width: triggerBounds.width
      });
    };

    updateMenuRect();

    window.addEventListener('resize', updateMenuRect);
    window.addEventListener('scroll', updateMenuRect, true);

    return () => {
      window.removeEventListener('resize', updateMenuRect);
      window.removeEventListener('scroll', updateMenuRect, true);
    };
  }, [isOpen, onOpenChange]);

  useLayoutEffect(() => {
    if (!isOpen || !menuRect) return;

    const triggerBounds = triggerRef.current?.getBoundingClientRect();
    const menuBounds = menuContainerRef.current?.getBoundingClientRect();
    if (!triggerBounds || !menuBounds || menuBounds.height <= 0) return;

    const spaceBelow = Math.max(0, window.innerHeight - triggerBounds.bottom - MENU_GAP - VIEWPORT_PADDING);
    const spaceAbove = Math.max(0, triggerBounds.top - MENU_GAP - VIEWPORT_PADDING);
    const opensAbove = menuBounds.height > spaceBelow && spaceAbove > spaceBelow;
    const availableHeight = opensAbove ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(0, availableHeight);
    const renderedHeight = Math.min(menuBounds.height, maxHeight);
    const top = opensAbove
      ? Math.max(VIEWPORT_PADDING, triggerBounds.top - MENU_GAP - renderedHeight)
      : triggerBounds.bottom + MENU_GAP;

    setMenuRect((currentRect) => {
      if (!currentRect) return currentRect;
      if (currentRect.top === top && currentRect.maxHeight === maxHeight) return currentRect;
      return { ...currentRect, top, maxHeight };
    });
  }, [isOpen, menuRect]);

  return (
    <div ref={containerRef} className={classNames('relative', containerClassName)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((previousOpen) => !previousOpen)}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        style={triggerStyle}
        className={classNames(
          'relative',
          showArrow && 'pr-5',
          selectTokenClasses.trigger,
          className,
          triggerClassName
        )}
      >
        <span className={classNames('min-w-0 flex-1 truncate pb-px text-left leading-[1.3]', valueClassName)} style={valueStyle}>{selectedLabel}</span>
        {showArrow ? (
          <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-500">▾</span>
        ) : null}
      </button>

      {isOpen && menuRect && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuContainerRef}
              role="listbox"
              className="fixed z-[140] overflow-y-auto"
              style={{
                top: `${menuRect.top}px`,
                left: `${menuRect.left}px`,
                width: `${menuRect.width}px`,
                maxHeight: menuRect.maxHeight === undefined ? undefined : `${menuRect.maxHeight}px`
              }}
            >
              <MenuPanel className={classNames(selectTokenClasses.menu, menuClassName)}>
                {options.map((option) => (
                  <MenuItem
                    key={option.value}
                    role="option"
                    ariaSelected={option.value === value}
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                  >
                    {option.label}
                  </MenuItem>
                ))}
              </MenuPanel>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
