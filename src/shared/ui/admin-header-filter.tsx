'use client';

import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export const HEADER_FILTER_ROOT_ATTR = 'data-header-filter-root';
const HEADER_FILTER_ROOT_SELECTOR = `[${HEADER_FILTER_ROOT_ATTR}="true"]`;
export const HEADER_FILTER_BUTTON_CLASS =
  'group inline-flex h-[12px] w-[12px] shrink-0 self-center items-center justify-center text-slate-500';

type UseHeaderFilterDismissOptions = {
  isOpen: boolean;
  onClose: () => void;
  rootSelector?: string;
};

export const useHeaderFilterDismiss = ({ isOpen, onClose, rootSelector = HEADER_FILTER_ROOT_SELECTOR }: UseHeaderFilterDismissOptions) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(rootSelector)) return;
      onClose();
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose, rootSelector]);
};

export const getHeaderPopoverStyle = (
  anchorElement: HTMLElement | null,
  width: number,
  options?: { offset?: number; viewportPadding?: number; zIndex?: number }
): CSSProperties => {
  if (!anchorElement || typeof window === 'undefined') return { visibility: 'hidden' };
  const offset = options?.offset ?? 6;
  const viewportPadding = options?.viewportPadding ?? 8;
  const zIndex = options?.zIndex ?? 1200;
  const anchorRect = anchorElement.getBoundingClientRect();
  const left = Math.min(
    Math.max(viewportPadding, anchorRect.left + anchorRect.width / 2 - width / 2),
    window.innerWidth - width - viewportPadding
  );

  return {
    position: 'fixed',
    top: anchorRect.bottom + offset,
    left,
    width,
    zIndex
  };
};

export const HeaderFilterPortal = ({ open, children }: { open: boolean; children: ReactNode }) => {
  if (!open || typeof window === 'undefined') return null;

  return createPortal(<div data-header-filter-root="true">{children}</div>, document.body);
};
