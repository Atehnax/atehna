'use client';

import { Eye, X } from 'lucide-react';
import {
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties
} from 'react';
import { createPortal } from 'react-dom';
import { useDropdownDismiss } from '@/shared/ui/dropdown/use-dropdown-dismiss';

type FlagPosition = {
  ready: boolean;
  side: 'left' | 'right';
  x: number;
  y: number;
};

const initialPosition: FlagPosition = {
  ready: false,
  side: 'right',
  x: 0,
  y: 0
};

function HiddenEyeIcon({ className }: { className: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M2.5 12s3.5-5.5 9.5-5.5 9.5 5.5 9.5 5.5-3.5 5.5-9.5 5.5S2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.75" />
      <path d="m4 4 16 16" />
    </svg>
  );
}

export default function CanvasHiddenElementFlag({
  elementId,
  label,
  kind,
  markerStyle,
  onRestore
}: {
  elementId: string;
  label: string;
  kind: 'product' | 'homepage';
  markerStyle?: CSSProperties;
  onRestore: () => void;
}) {
  const markerRef = useRef<HTMLSpanElement | null>(null);
  const flagRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const panelId = useId();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<FlagPosition>(initialPosition);
  const dismissRefs = useMemo(() => [flagRef], []);
  const portalRefs = useMemo(() => [panelRef], []);

  useDropdownDismiss({
    open,
    refs: dismissRefs,
    portalRefs,
    returnFocusRef: flagRef,
    dismissGroup: 'canvas-hidden-element',
    onClose: () => setOpen(false)
  });

  const updatePosition = useCallback(() => {
    const marker = markerRef.current;
    const owner = marker?.parentElement;
    if (!marker || !owner) return;

    const ownerRect = owner.getBoundingClientRect();
    const markerRect = marker.getBoundingClientRect();
    const hiddenMarkers = Array.from(
      owner.querySelectorAll<HTMLElement>(':scope > [data-canvas-hidden-placeholder]')
    );
    const markerIndex = Math.max(0, hiddenMarkers.indexOf(marker));
    const ownerChildren = Array.from(owner.children);
    const markerChildIndex = ownerChildren.indexOf(marker);
    const previousVisibleSibling = ownerChildren
      .slice(0, markerChildIndex)
      .reverse()
      .find((element) => !element.hasAttribute('data-canvas-hidden-placeholder'));
    const nextVisibleSibling = ownerChildren
      .slice(markerChildIndex + 1)
      .find((element) => !element.hasAttribute('data-canvas-hidden-placeholder'));
    const previousRect = previousVisibleSibling?.getBoundingClientRect();
    const nextRect = nextVisibleSibling?.getBoundingClientRect();
    const minimumY = Math.max(14, Math.min(window.innerHeight - 14, ownerRect.top + 14));
    const maximumY = Math.max(
      minimumY,
      Math.min(window.innerHeight - 14, ownerRect.bottom - 14)
    );
    const staticY = nextRect?.top
      ?? previousRect?.bottom
      ?? (Number.isFinite(markerRect.top) ? markerRect.top : ownerRect.top);
    const y = Math.max(
      minimumY,
      Math.min(maximumY, staticY + markerIndex * 24)
    );
    const roomOnRight = window.innerWidth - ownerRect.right;
    const roomOnLeft = ownerRect.left;
    const side = roomOnRight >= 148 || roomOnRight >= roomOnLeft
      ? 'right'
      : 'left';

    setPosition({
      ready: true,
      side,
      x: side === 'right' ? ownerRect.right : ownerRect.left,
      y
    });
  }, []);

  useLayoutEffect(() => {
    setMounted(true);
    updatePosition();
    const marker = markerRef.current;
    const owner = marker?.parentElement;
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(updatePosition);
    if (marker) resizeObserver?.observe(marker);
    if (owner) resizeObserver?.observe(owner);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    const frame = window.requestAnimationFrame(updatePosition);

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [updatePosition]);

  const flagTransform = position.side === 'right'
    ? 'translateY(-50%)'
    : 'translate(-100%, -50%)';
  const panelWidth = 272;
  const viewportWidth = typeof window === 'undefined' ? 0 : window.innerWidth;
  const viewportHeight = typeof window === 'undefined' ? 0 : window.innerHeight;
  const panelLeft = position.side === 'right'
    ? Math.min(viewportWidth - panelWidth - 12, position.x + 8)
    : Math.max(12, position.x - panelWidth - 8);
  const panelTop = Math.max(12, Math.min(viewportHeight - 176, position.y + 18));
  const flagMaxWidth = Math.max(
    64,
    Math.min(
      148,
      position.side === 'right'
        ? viewportWidth - position.x - 12
        : position.x - 12
    )
  );

  return (
    <span
      ref={markerRef}
      data-canvas-hidden-placeholder
      data-canvas-hidden-element-id={elementId}
      data-product-canvas-element={kind === 'product' ? elementId : undefined}
      data-product-canvas-hidden={kind === 'product' ? 'true' : undefined}
      data-homepage-canvas-element={kind === 'homepage' ? true : undefined}
      data-canvas-element-id={kind === 'homepage' ? elementId : undefined}
      data-canvas-element-hidden={kind === 'homepage' ? 'true' : undefined}
      className="pointer-events-none absolute h-0 w-0 overflow-visible"
      style={markerStyle}
    >
      {mounted && position.ready ? createPortal(
        <>
          <button
            ref={flagRef}
            type="button"
            data-canvas-hidden-flag={elementId}
            aria-label={`Skriti element: ${label}`}
            aria-expanded={open}
            aria-controls={panelId}
            className={`fixed z-[220] inline-flex h-6 max-w-36 items-center gap-1 border border-amber-300 bg-amber-50 px-1.5 text-[10px] font-semibold leading-none text-amber-900 shadow-[0_2px_8px_rgba(15,23,42,0.14)] transition hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 ${
              position.side === 'right'
                ? 'rounded-r-md border-l-0'
                : 'rounded-l-md border-r-0'
            }`}
            style={{
              left: position.x,
              maxWidth: flagMaxWidth,
              top: position.y,
              transform: flagTransform
            }}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setOpen((current) => !current);
            }}
          >
            <HiddenEyeIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{label}</span>
          </button>

          {open ? (
            <div
              ref={panelRef}
              id={panelId}
              role="dialog"
              aria-label={`Skriti element: ${label}`}
              data-canvas-hidden-popover={elementId}
              className="fixed z-[221] w-[272px] rounded-xl border border-slate-200 bg-white p-3 text-left text-slate-700 shadow-[0_18px_48px_rgba(15,23,42,0.2)]"
              style={{ left: panelLeft, top: panelTop }}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start gap-2">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-700">
                  <HiddenEyeIcon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-900">Skriti element</p>
                  <p className="mt-0.5 break-words text-[11px] font-semibold text-slate-700">{label}</p>
                </div>
                <button
                  type="button"
                  aria-label="Zapri razlago"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  onClick={() => setOpen(false)}
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-2 text-[11px] leading-4 text-slate-500">
                Element je odstranjen iz postavitve, zato se vsebina za njim samodejno premakne.
              </p>
              <button
                type="button"
                className="mt-3 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-3 text-xs font-semibold text-white transition hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
                onClick={() => {
                  setOpen(false);
                  onRestore();
                }}
              >
                <Eye aria-hidden="true" className="h-4 w-4" />
                Prikaži znova
              </button>
            </div>
          ) : null}
        </>,
        document.body
      ) : null}
    </span>
  );
}
