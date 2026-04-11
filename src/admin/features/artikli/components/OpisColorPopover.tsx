'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { HexColorPicker } from 'react-colorful';
import { colord } from 'colord';

const numberInputClass = '[-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';
const compactInputClass = 'h-6 w-full rounded-md border border-slate-300 bg-white px-1.5 text-[12px] text-slate-900 outline-none transition focus:border-[#3e67d6] focus:outline-none focus:ring-0';

export default function OpisColorPopover({
  open,
  anchorRef,
  color,
  onChange,
  onClose
}: {
  open: boolean;
  anchorRef: RefObject<HTMLButtonElement>;
  color: string;
  onChange: (nextColor: string) => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const hexInputRef = useRef<HTMLInputElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [hexDraft, setHexDraft] = useState(color);

  useEffect(() => {
    setHexDraft(color);
  }, [color]);

  const rgb = useMemo(() => {
    const normalized = colord(color);
    if (!normalized.isValid()) return { r: 30, g: 41, b: 59 };
    return normalized.toRgb();
  }, [color]);

  const updatePosition = useCallback(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const width = panelRef.current?.offsetWidth ?? 228;
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    const top = Math.min(rect.bottom + 6, window.innerHeight - 8);
    setPosition({ top, left });
  }, [anchorRef]);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const frame = window.requestAnimationFrame(() => {
      updatePosition();
      hexInputRef.current?.focus();
    });

    const onDocMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      onClose();
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const onWindowChange = () => updatePosition();

    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onEscape);
    window.addEventListener('resize', onWindowChange);
    window.addEventListener('scroll', onWindowChange, true);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onEscape);
      window.removeEventListener('resize', onWindowChange);
      window.removeEventListener('scroll', onWindowChange, true);
    };
  }, [anchorRef, onClose, open, updatePosition]);

  if (!open || !position || typeof document === 'undefined') return null;

  return createPortal(
    <div ref={panelRef} className="fixed z-[100] w-[228px] rounded-md border border-slate-300 bg-white p-2 shadow-lg" style={position} onMouseDown={(event) => event.stopPropagation()}>
      <HexColorPicker color={colord(color).isValid() ? color : '#1e293b'} onChange={(next) => onChange(next.toUpperCase())} className="opis-color-picker" />
      <div className="mt-2 space-y-1.5">
        <div className="grid grid-cols-[32px_1fr] items-center gap-1.5">
          <span className="text-[12px] text-slate-500">HEX</span>
          <input
            ref={hexInputRef}
            className={compactInputClass}
            value={hexDraft}
            onChange={(event) => {
              const next = event.target.value;
              setHexDraft(next);
              const normalized = colord(next);
              if (normalized.isValid()) onChange(normalized.toHex().toUpperCase());
            }}
          />
        </div>
        <div className="grid grid-cols-[32px_1fr_1fr_1fr] items-center gap-1.5">
          <span className="text-[12px] text-slate-500">RGB</span>
          <input type="number" min={0} max={255} className={`${compactInputClass} ${numberInputClass}`} value={rgb.r} onChange={(event) => onChange(colord({ r: Math.min(255, Math.max(0, Number(event.target.value) || 0)), g: rgb.g, b: rgb.b }).toHex().toUpperCase())} />
          <input type="number" min={0} max={255} className={`${compactInputClass} ${numberInputClass}`} value={rgb.g} onChange={(event) => onChange(colord({ r: rgb.r, g: Math.min(255, Math.max(0, Number(event.target.value) || 0)), b: rgb.b }).toHex().toUpperCase())} />
          <input type="number" min={0} max={255} className={`${compactInputClass} ${numberInputClass}`} value={rgb.b} onChange={(event) => onChange(colord({ r: rgb.r, g: rgb.g, b: Math.min(255, Math.max(0, Number(event.target.value) || 0)) }).toHex().toUpperCase())} />
        </div>
      </div>
      <style jsx global>{`
        .opis-color-picker { width: 100% !important; }
        .opis-color-picker .react-colorful__saturation { border-radius: 6px; border-bottom: 0; }
        .opis-color-picker .react-colorful__hue { height: 10px; margin-top: 8px; border-radius: 999px; }
        .opis-color-picker .react-colorful__pointer { width: 12px; height: 12px; }
      `}</style>
    </div>,
    document.body
  );
}
