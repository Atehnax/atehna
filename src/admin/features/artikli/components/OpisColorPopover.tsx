'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useDropdownDismiss } from '@/shared/ui/dropdown/use-dropdown-dismiss';
import { CompactHexColorField } from '@/shared/ui/admin-controls/CompactHexColorField';

export default function OpisColorPopover({
  open,
  anchorRef,
  color,
  onChange,
  onClose
}: {
  open: boolean;
  anchorRef: RefObject<HTMLButtonElement | null>;
  color: string;
  onChange: (nextColor: string) => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const dismissRefs = useMemo(() => [anchorRef, panelRef], [anchorRef]);

  const updatePosition = useCallback(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const width = panelRef.current?.offsetWidth ?? 228;
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    const top = Math.min(rect.bottom + 6, window.innerHeight - 8);
    setPosition({ top, left });
  }, [anchorRef]);

  useDropdownDismiss({
    open,
    refs: dismissRefs,
    ignoreSelector: '[data-admin-color-palette-portal]',
    ignoreEscapeSelector: '[data-admin-color-palette-portal]',
    onClose
  });

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const frame = window.requestAnimationFrame(updatePosition);

    const onWindowChange = () => updatePosition();

    window.addEventListener('resize', onWindowChange);
    window.addEventListener('scroll', onWindowChange, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', onWindowChange);
      window.removeEventListener('scroll', onWindowChange, true);
    };
  }, [anchorRef, onClose, open, updatePosition]);

  if (!open || !position || typeof document === 'undefined') return null;

  return createPortal(
    <div ref={panelRef} className="fixed z-[100] w-[248px] rounded-md border border-slate-300 bg-white p-2 shadow-lg" style={position} onMouseDown={(event) => event.stopPropagation()}>
      <CompactHexColorField
        label="Barva besedila"
        value={color}
        marker="article-description-text-color"
        tone="light"
        onChange={onChange}
        inputAttributes={{ 'aria-label': 'Barva besedila HEX' }}
        className="w-full"
      />
    </div>,
    document.body
  );
}
