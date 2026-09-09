'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';
import { adminControlFocusTokenClasses } from '@/shared/ui/theme/tokens';

/** Order shipping help uses the existing admin help surface outside the clipped card. */
export default function AdminOrderShippingInfo({ children }: { children: ReactNode }) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const tooltip = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const cancelClose = () => { if (closeTimer.current) clearTimeout(closeTimer.current); };
  const show = () => { cancelClose(); setOpen(true); };
  const close = () => { cancelClose(); setOpen(false); setPosition(null); };
  const leave = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => {
      if (document.activeElement !== trigger.current) { setOpen(false); setPosition(null); }
    }, 120);
  };
  const place = useCallback(() => {
    if (!trigger.current || !tooltip.current) return;
    const rect = trigger.current.getBoundingClientRect();
    const help = tooltip.current.getBoundingClientRect();
    const width = window.innerWidth, height = window.innerHeight;
    const below = rect.bottom + 8;
    const top = below + help.height <= height - 12 ? below : rect.top - help.height - 8;
    setPosition({ left: Math.max(12, Math.min(rect.left - 12, width - help.width - 12)), top: Math.max(12, Math.min(top, height - help.height - 12)) });
  }, []);
  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    const outside = (event: PointerEvent) => {
      if (!trigger.current?.contains(event.target as Node) && !tooltip.current?.contains(event.target as Node)) { setOpen(false); setPosition(null); }
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); setPosition(null); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open, place, children]);
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  return <>
    <button ref={trigger} type="button" aria-label="Informacije o poštnini" aria-describedby={open ? id : undefined}
      className={adminControlFocusTokenClasses + ' inline-flex !h-4 !w-4 min-h-0 min-w-0 shrink-0 items-center justify-center !rounded-full !border-0 !bg-transparent !p-0 text-slate-400 hover:text-[color:var(--blue-500)]'}
      onMouseEnter={show} onMouseLeave={leave} onFocus={show} onBlur={close} onClick={show} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); close(); } }}>
      <Info className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
    </button>
    {open && typeof document !== 'undefined' ? createPortal(
      <div ref={tooltip} id={id} role="tooltip" onMouseEnter={show} onMouseLeave={leave}
        className="fixed z-[2147483647] max-h-[calc(100dvh-24px)] w-80 max-w-[calc(100vw-24px)] space-y-2 overflow-auto rounded-lg border border-slate-200 bg-white p-3 text-left text-xs font-normal leading-5 text-slate-600 shadow-[0_16px_44px_rgba(15,23,42,0.16)]"
        style={{ left: position?.left ?? 12, top: position?.top ?? 12, visibility: position ? 'visible' : 'hidden' }}>
        {children}
      </div>, document.body
    ) : null}
  </>;
}
