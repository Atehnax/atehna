'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
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
  const [menuRect, setMenuRect] = useState<{ top: number; left: number; width: number } | null>(null);
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
        top: triggerBounds.bottom + 4,
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
              className="fixed z-[140]"
              style={{ top: `${menuRect.top}px`, left: `${menuRect.left}px`, width: `${menuRect.width}px` }}
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
