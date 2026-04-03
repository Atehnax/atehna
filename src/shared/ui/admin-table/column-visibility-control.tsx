'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MenuPanel } from '@/shared/ui/menu';
import { selectTokenClasses } from '@/shared/ui/theme/tokens';

type ColumnOption = {
  key: string;
  label: string;
  disabled?: boolean;
};

export function ColumnVisibilityControl({
  options,
  visibleMap,
  onToggle,
  className,
  showLabel = true,
  icon,
  menuClassName
}: {
  options: ColumnOption[];
  visibleMap: Record<string, boolean>;
  onToggle: (key: string) => void;
  className?: string;
  showLabel?: boolean;
  icon?: ReactNode;
  menuClassName?: string;
}) {
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
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className={`relative ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className={`${selectTokenClasses.trigger} justify-center ${showLabel ? 'min-w-[92px] gap-2 px-2.5 pr-5' : 'w-8 !p-0'} ${isOpen ? 'bg-[color:var(--hover-neutral)]' : ''}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
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
      {isOpen ? (
        <div className="absolute right-0 top-9 z-30" role="menu">
          <MenuPanel className={`w-52 ${selectTokenClasses.menu} ${menuClassName ?? ''}`}>
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
                <span className={option.disabled ? 'opacity-60' : ''}>{option.label}</span>
              </label>
            );
          })}
          </MenuPanel>
        </div>
      ) : null}
    </div>
  );
}
