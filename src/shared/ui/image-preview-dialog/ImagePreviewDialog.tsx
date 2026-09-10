'use client';

import Image from 'next/image';
import { X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type ImagePreviewDialogProps = {
  open: boolean;
  src: string;
  alt: string;
  aspectRatio?: number;
  onClose: () => void;
};

type PreviewImage = { src: string; alt: string; aspectRatio: number };
type PreviewKeyEvent = Pick<KeyboardEvent, 'key' | 'preventDefault' | 'stopPropagation'>;

const classNames = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

const lightboxCloseControlClassName =
  'absolute right-3 top-3 z-20 inline-grid h-11 w-11 place-items-center rounded-full border border-white/70 bg-white/95 text-slate-800 shadow-[0_4px_14px_rgba(15,23,42,0.16)] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950/65';

/** Keep mounted while closing so the same preview animation can serve every image trigger. */
export default function ImagePreviewDialog({
  open,
  src,
  alt,
  aspectRatio,
  onClose
}: ImagePreviewDialogProps) {
  const [image, setImage] = useState<PreviewImage | null>(null);
  const [isZoomVisible, setIsZoomVisible] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const isMounted = image !== null;

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  const closeZoom = useCallback(() => onCloseRef.current(), []);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (open && src) {
      setImage((current) => ({
        src,
        alt,
        aspectRatio: typeof aspectRatio === 'number' && Number.isFinite(aspectRatio) && aspectRatio > 0
          ? aspectRatio
          : current?.src === src ? current.aspectRatio : 4 / 3
      }));
      if (reduceMotion) {
        setIsZoomVisible(true);
        return;
      }
      const frame = requestAnimationFrame(() => setIsZoomVisible(true));
      return () => cancelAnimationFrame(frame);
    }
    setIsZoomVisible(false);
    const timer = setTimeout(() => setImage(null), reduceMotion ? 0 : 280);
    return () => clearTimeout(timer);
  }, [open, src, alt, aspectRatio]);

  const onPreviewKeyDown = useCallback((event: PreviewKeyEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeZoom();
    } else if (event.key === 'Tab') {
      event.preventDefault();
      event.stopPropagation();
      closeButtonRef.current?.focus();
    }
  }, [closeZoom]);

  useEffect(() => {
    if (!isMounted) return;
    const activeElement = document.activeElement;
    const returnFocus = activeElement instanceof HTMLElement ? activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusFrame = requestAnimationFrame(() => closeButtonRef.current?.focus());
    const onFocusIn = (event: FocusEvent) => {
      if (event.target instanceof Node && !dialogRef.current?.contains(event.target)) {
        closeButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onPreviewKeyDown);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onPreviewKeyDown);
      document.removeEventListener('focusin', onFocusIn);
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    };
  }, [isMounted, onPreviewKeyDown]);

  if (!image || typeof document === 'undefined') return null;
  const selectedImageAspectRatio = image.aspectRatio;

  return createPortal(
    <div
      ref={dialogRef}
      className={classNames(
        'fixed inset-0 z-[1000] flex cursor-zoom-out items-center justify-center bg-slate-950/65 p-2 backdrop-blur-[2px] transition-opacity duration-300 ease-out motion-reduce:transition-none sm:p-3',
        isZoomVisible ? 'opacity-100' : 'opacity-0'
      )}
      role="dialog"
      aria-modal="true"
      aria-label={`Povečana slika: ${image.alt}`}
      data-image-preview-dialog
      data-storefront-gallery-lightbox
      data-state={isZoomVisible ? 'open' : 'closing'}
      onPointerDown={(event) => {
        // Portal events must not reach editor drag handlers or image triggers.
        event.stopPropagation();
      }}
      onKeyDown={(event) => {
        onPreviewKeyDown(event);
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) closeZoom();
      }}
    >
      <button
        ref={closeButtonRef}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          closeZoom();
        }}
        data-gallery-control="lightbox-close"
        className={lightboxCloseControlClassName}
        aria-label="Zapri povečano sliko"
      >
        <X aria-hidden="true" className="h-5 w-5" />
      </button>
      <div
        className={classNames(
          'relative max-h-[72dvh] max-w-[72vw] overflow-hidden rounded-[var(--site-radius-sm)] bg-white shadow-2xl transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
          isZoomVisible
            ? 'translate-y-0 scale-100 opacity-100'
            : 'translate-y-2 scale-[0.98] opacity-0'
        )}
        style={{
          aspectRatio: selectedImageAspectRatio,
          width: `min(72vw, calc(72dvh * ${selectedImageAspectRatio}))`
        }}
        data-storefront-gallery-lightbox-content
      >
        <Image
          src={image.src}
          alt={image.alt}
          fill
          loading="eager"
          sizes="72vw"
          className="object-contain"
          onLoad={(event) => {
            const { naturalWidth, naturalHeight } = event.currentTarget;
            if (naturalWidth > 0 && naturalHeight > 0) {
              setImage((current) => current?.src === image.src
                ? { ...current, aspectRatio: naturalWidth / naturalHeight }
                : current);
            }
          }}
        />
      </div>
    </div>,
    document.body
  );
}
