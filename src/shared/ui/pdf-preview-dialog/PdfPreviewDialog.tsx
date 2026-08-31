'use client';

import { useEffect, useRef, type MouseEvent, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { adminTableNeutralIconButtonClassName } from '@/shared/ui/admin-table';
import { CloseIcon } from '@/shared/ui/icons/AdminActionIcons';

type PdfPreviewDialogProps = {
  url: string | null;
  title: string;
  description: string;
  frameTitle: string;
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
};

export default function PdfPreviewDialog({
  url,
  title,
  description,
  frameTitle,
  onClose,
  returnFocusRef
}: PdfPreviewDialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const focusTargetRef = useRef<HTMLElement | null>(null);
  const open = Boolean(url);

  useEffect(() => {
    if (!open) return;
    const activeElement = document.activeElement;
    focusTargetRef.current = returnFocusRef?.current
      ?? (activeElement instanceof HTMLElement ? activeElement : null);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusFrame = requestAnimationFrame(() => closeButtonRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === 'Tab') {
        event.preventDefault();
        closeButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      focusTargetRef.current?.focus();
      focusTargetRef.current = null;
    };
  }, [onClose, open, returnFocusRef]);

  if (!url || typeof document === 'undefined') return null;

  const handlePanelClick = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/65 p-2 backdrop-blur-[2px] sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quote-offer-preview-title"
      data-testid="quote-offer-preview-dialog"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="flex h-[min(92dvh,980px)] w-[min(1180px,calc(100vw-1rem))] min-h-0 flex-col overflow-hidden rounded-2xl border border-white/60 bg-white shadow-2xl sm:w-[min(1180px,calc(100vw-2rem))]"
        onClick={handlePanelClick}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 id="quote-offer-preview-title" className="truncate text-base font-semibold text-slate-950">
                {title}
              </h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                PDF
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{description}</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Zapri predogled"
            data-testid="quote-offer-preview-close"
            className={`${adminTableNeutralIconButtonClassName} !h-8 !w-8 shrink-0`}
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 bg-slate-200 p-2 sm:p-3">
          <iframe
            src={url}
            title={frameTitle}
            className="h-full min-h-[520px] w-full rounded-lg border border-slate-300 bg-white"
            data-testid="quote-offer-preview-frame"
          />
        </div>
      </section>
    </div>,
    document.body
  );
}
