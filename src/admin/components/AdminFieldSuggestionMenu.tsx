'use client';

import { useEffect, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';

type MenuPosition = {
  top: number;
  left: number;
  minWidth: number;
};

export default function AdminFieldSuggestionMenu({
  anchorRef,
  open,
  suggestions,
  ariaLabel,
  onSelect
}: {
  anchorRef: RefObject<HTMLInputElement | null>;
  open: boolean;
  suggestions: string[];
  ariaLabel: string;
  onSelect: (value: string) => void;
}) {
  const [position, setPosition] = useState<MenuPosition | null>(null);

  useEffect(() => {
    if (!open || suggestions.length === 0) {
      setPosition(null);
      return;
    }

    const updatePosition = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();
      const minWidth = Math.max(160, rect.width);
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
  }, [anchorRef, open, suggestions.length]);

  if (!open || suggestions.length === 0 || !position || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed z-[150] rounded-md border border-slate-200 bg-white p-1 shadow-[0_14px_34px_rgba(15,23,42,0.08),0_2px_6px_rgba(15,23,42,0.05)]"
      style={{ top: position.top, left: position.left, minWidth: position.minWidth }}
      role="listbox"
      aria-label={ariaLabel}
    >
      {suggestions.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          role="option"
          aria-selected="false"
          className="flex h-8 w-full items-center rounded-md px-2.5 text-left text-[12px] font-normal leading-[1.25] text-slate-700 transition hover:bg-[color:var(--hover-neutral)] hover:text-[color:var(--blue-500)] focus:bg-[color:var(--hover-neutral)] focus:text-[color:var(--blue-500)] focus:outline-none"
          onMouseDown={(event) => {
            event.preventDefault();
            onSelect(suggestion);
          }}
        >
          {suggestion}
        </button>
      ))}
    </div>,
    document.body
  );
}
