'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MenuItem, MenuPanel } from '@/shared/ui/menu';

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
};

const classNames = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

export default function CustomSelect({
  value,
  onChange,
  options,
  disabled = false,
  placeholder = '',
  className,
  menuClassName
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
          'h-10 w-full overflow-visible rounded-xl border-0 bg-transparent px-2.5 pb-0 pt-4 text-left text-xs leading-6 text-slate-900 outline-none ring-0 transition focus:border-0 focus:outline-none focus:ring-0 focus-visible:border-0 focus-visible:shadow-none focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-60',
          className
        )}
      >
        <span className="block truncate">{selectedLabel}</span>
      </button>
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500">▾</span>

      {isOpen && (
        <div role="listbox" className="absolute left-0 top-11 z-30 w-full">
          <MenuPanel className={classNames('w-full', menuClassName)}>
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
