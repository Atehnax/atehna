'use client';

import { useEffect, useRef, type RefObject } from 'react';

type DropdownDismissRef = RefObject<HTMLElement | null>;

type UseDropdownDismissOptions = {
  open: boolean;
  onClose: () => void;
  refs?: ReadonlyArray<DropdownDismissRef>;
  ignoreSelector?: string;
  closeOnEscape?: boolean;
  closeOnNavigation?: boolean;
};

const DROPDOWN_NAVIGATION_EVENT = 'atehna:dropdown-navigation';
const EMPTY_DROPDOWN_DISMISS_REFS: ReadonlyArray<DropdownDismissRef> = [];

type DropdownDismissWindow = Window & {
  __atehnaDropdownHistoryEventsPatched?: boolean;
};

const dispatchDropdownNavigationEvent = () => {
  window.setTimeout(() => {
    window.dispatchEvent(new Event(DROPDOWN_NAVIGATION_EVENT));
  }, 0);
};

const patchHistoryNavigationEvents = () => {
  if (typeof window === 'undefined') return;

  const browserWindow = window as DropdownDismissWindow;
  if (browserWindow.__atehnaDropdownHistoryEventsPatched) return;

  browserWindow.__atehnaDropdownHistoryEventsPatched = true;

  const originalPushState = window.history.pushState.bind(window.history);
  const originalReplaceState = window.history.replaceState.bind(window.history);

  window.history.pushState = ((...args: Parameters<History['pushState']>) => {
    const result = originalPushState(...args);
    dispatchDropdownNavigationEvent();
    return result;
  }) as History['pushState'];

  window.history.replaceState = ((...args: Parameters<History['replaceState']>) => {
    const result = originalReplaceState(...args);
    dispatchDropdownNavigationEvent();
    return result;
  }) as History['replaceState'];
};

export function useDropdownDismiss({
  open,
  onClose,
  refs = EMPTY_DROPDOWN_DISMISS_REFS,
  ignoreSelector,
  closeOnEscape = true,
  closeOnNavigation = true
}: UseDropdownDismissOptions) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;

      if (target instanceof Element && ignoreSelector && target.closest(ignoreSelector)) return;
      if (refs.some((ref) => ref.current?.contains(target))) return;

      onCloseRef.current();
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (closeOnEscape && event.key === 'Escape') {
        onCloseRef.current();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [closeOnEscape, ignoreSelector, open, refs]);

  useEffect(() => {
    if (!open || !closeOnNavigation) return;

    patchHistoryNavigationEvents();

    const close = () => onCloseRef.current();

    window.addEventListener(DROPDOWN_NAVIGATION_EVENT, close);
    window.addEventListener('popstate', close);
    window.addEventListener('hashchange', close);
    return () => {
      window.removeEventListener(DROPDOWN_NAVIGATION_EVENT, close);
      window.removeEventListener('popstate', close);
      window.removeEventListener('hashchange', close);
    };
  }, [closeOnNavigation, open]);
}
