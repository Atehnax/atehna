'use client';

import { useEffect, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';

type MenuPosition = {
  top: number;
  left: number;
  minWidth: number;
};

export default function OrderNumberSuggestionMenu({
  anchorRef,
  open,
  currentValue,
  suggestions,
  onSelect
}: {
  anchorRef: RefObject<HTMLInputElement | null>;
  open: boolean;
  currentValue?: string | null;
  suggestions: string[];
  onSelect: (value: string) => void;
}) {
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const currentOption = currentValue?.trim() || null;
  const visibleSuggestions = currentOption
    ? suggestions.filter((suggestion) => suggestion !== currentOption)
    : suggestions;
  const hasOptions = visibleSuggestions.length > 0 || currentOption !== null;

  useEffect(() => {
    if (!open || !hasOptions) {
      setPosition(null);
      return;
    }

    const updatePosition = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();
      const minWidth = Math.max(96, rect.width + 32);
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - minWidth - 8);
      setPosition({
        top: rect.bottom + 4,
        left,
        minWidth
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [anchorRef, hasOptions, open]);

  if (!open || !hasOptions || !position || typeof document === 'undefined') return null;

  const renderOption = (value: string) => (
    <button
      key={value}
      type="button"
      role="option"
      aria-selected="false"
      className="flex h-8 w-full items-center rounded-md px-2.5 text-left text-[12px] font-normal leading-[1.25] text-slate-700 transition hover:bg-[color:var(--hover-neutral)] hover:text-[color:var(--blue-500)] focus:bg-[color:var(--hover-neutral)] focus:text-[color:var(--blue-500)] focus:outline-none"
      onMouseDown={(event) => {
        event.preventDefault();
        onSelect(value);
      }}
    >
      {value}
    </button>
  );

  return createPortal(
    <div
      className="fixed z-[150] rounded-md border border-slate-200 bg-white p-1 shadow-[0_14px_34px_rgba(15,23,42,0.08),0_2px_6px_rgba(15,23,42,0.05)]"
      style={{ top: position.top, left: position.left, minWidth: position.minWidth }}
      role="listbox"
      aria-label="Predlogi številk naročila"
    >
      {visibleSuggestions.map((suggestion) => renderOption(suggestion))}
      {currentOption ? (
        <div className={visibleSuggestions.length > 0 ? 'mt-1 border-t border-slate-200 pt-1' : ''}>
          {renderOption(currentOption)}
        </div>
      ) : null}
    </div>,
    document.body
  );
}
