'use client';

import { useEffect, useRef, useState } from 'react';

type ColumnOption = {
  key: string;
  label: string;
  disabled?: boolean;
};

export function ColumnVisibilityControl({
  options,
  visibleMap,
  onToggle,
  className
}: {
  options: ColumnOption[];
  visibleMap: Record<string, boolean>;
  onToggle: (key: string) => void;
  className?: string;
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
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        Stolpci ▾
      </button>
      {isOpen ? (
        <div className="absolute right-0 top-9 z-30 w-44 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg" role="menu">
          {options.map((option) => {
            const isChecked = visibleMap[option.key] ?? false;
            return (
              <label
                key={option.key}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
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
        </div>
      ) : null}
    </div>
  );
}
