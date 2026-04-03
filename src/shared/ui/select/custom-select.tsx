'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MenuItem, MenuPanel } from '@/shared/ui/menu';
import { selectTokenClasses } from '@/shared/ui/theme/tokens';

type CustomSelectOption = {
  value: string;
  label: string;
};

type CustomSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<CustomSelectOption>;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
  valueClassName?: string;
  onOpenChange?: (isOpen: boolean) => void;
};

const classNames = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

export default function CustomSelect({
  value,
  onChange,
  options,
  disabled = false,
  placeholder = '',
  className,
  triggerClassName,
  menuClassName,
  valueClassName,
  onOpenChange
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [menuRect, setMenuRect] = useState<{ top: number; left: number; width: number } | null>(null);

  const selectedLabel = useMemo(
    () => options.find((option) => option.value === value)?.label ?? placeholder,
    [options, placeholder, value]
  );

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

    const handleOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', updateMenuRect);
    window.addEventListener('scroll', updateMenuRect, true);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', updateMenuRect);
      window.removeEventListener('scroll', updateMenuRect, true);
    };
  }, [isOpen, onOpenChange]);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((previousOpen) => !previousOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={classNames(
          'relative pr-5',
          selectTokenClasses.trigger,
          className,
          triggerClassName
        )}
      >
        <span className={classNames('min-w-0 flex-1 truncate pb-px text-left leading-[1.3]', valueClassName)}>{selectedLabel}</span>
        <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-500">▾</span>
      </button>

      {isOpen && menuRect && typeof document !== 'undefined'
        ? createPortal(
            <div
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
