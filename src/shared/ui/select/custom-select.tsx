'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
  menuClassName?: string;
  valueClassName?: string;
};

const classNames = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

export default function CustomSelect({
  value,
  onChange,
  options,
  disabled = false,
  placeholder = '',
  className,
  menuClassName,
  valueClassName
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selectedLabel = useMemo(
    () => options.find((option) => option.value === value)?.label ?? placeholder,
    [options, placeholder, value]
  );

  useEffect(() => {
    if (!isOpen) return;

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

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((previousOpen) => !previousOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={classNames(
          selectTokenClasses.trigger,
          className
        )}
      >
        <span className={classNames('min-w-0 flex-1 truncate text-left leading-none', valueClassName)}>{selectedLabel}</span>
        <span className="ml-2 shrink-0 text-slate-500">▾</span>
      </button>

      {isOpen && (
        <div role="listbox" className="absolute left-0 top-11 z-30 w-full">
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
        </div>
      )}
    </div>
  );
}
