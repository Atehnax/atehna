'use client';

import { type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useDropdownDismiss } from '@/shared/ui/dropdown/use-dropdown-dismiss';

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
  useDropdownDismiss({
    open: isOpen,
    ignoreSelector: rootSelector,
    onClose
  });
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
