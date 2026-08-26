'use client';

import { useEffect, useRef, type RefObject } from 'react';

type DropdownDismissRef = RefObject<HTMLElement | null>;

type UseDropdownDismissOptions = {
  open: boolean;
  onClose: () => void;
  refs?: ReadonlyArray<DropdownDismissRef>;
  portalRefs?: ReadonlyArray<DropdownDismissRef>;
  returnFocusRef?: DropdownDismissRef;
  dismissGroup?: string;
  ignoreSelector?: string;
  ignoreEscapeSelector?: string;
  closeOnEscape?: boolean;
  closeOnNavigation?: boolean;
};

const DROPDOWN_NAVIGATION_EVENT = 'atehna:dropdown-navigation';
const DROPDOWN_PEER_OPEN_EVENT = 'atehna:dropdown-peer-open';
const EMPTY_DROPDOWN_DISMISS_REFS: ReadonlyArray<DropdownDismissRef> = [];
let dropdownDismissLayers: readonly symbol[] = [];

type DropdownPeerOpenDetail = { group: string; layer: symbol };
type SelectorMatchTarget = EventTarget & { matches?: (selector: string) => boolean };

export const appendDropdownDismissLayer = (layers: readonly symbol[], layer: symbol) =>
  [...layers.filter((candidate) => candidate !== layer), layer];
export const removeDropdownDismissLayer = (layers: readonly symbol[], layer: symbol) =>
  layers.filter((candidate) => candidate !== layer);
export const isTopmostDropdownDismissLayer = (layers: readonly symbol[], layer: symbol) =>
  layers.at(-1) === layer;
export const dropdownDismissPathMatchesSelector = (
  path: readonly EventTarget[], selector?: string
) => Boolean(selector && path.some((candidate) => {
  const matches = (candidate as SelectorMatchTarget | null)?.matches;
  return typeof matches === 'function' && matches.call(candidate, selector);
}));
export const shouldDismissDropdownPointer = (
  path: readonly EventTarget[], roots: readonly (HTMLElement | null)[], ignoreSelector?: string
) => {
  if (dropdownDismissPathMatchesSelector(path, ignoreSelector)) return false;
  return !roots.some((root) => Boolean(root) && path.includes(root as HTMLElement));
};

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
  portalRefs = EMPTY_DROPDOWN_DISMISS_REFS,
  returnFocusRef,
  dismissGroup,
  ignoreSelector,
  ignoreEscapeSelector,
  closeOnEscape = true,
  closeOnNavigation = true
}: UseDropdownDismissOptions) {
  const onCloseRef = useRef(onClose);
  const dismissLayerRef = useRef(Symbol('dropdown-dismiss-layer'));
  const focusOriginRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const layer = dismissLayerRef.current;
    const currentRoots = () => [...refs, ...portalRefs]
      .map((ref) => ref.current)
      .filter((root): root is HTMLElement => Boolean(root));
    focusOriginRef.current = returnFocusRef?.current
      ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    dropdownDismissLayers = appendDropdownDismissLayer(dropdownDismissLayers, layer);

    const handlePointerDown = (event: PointerEvent) => {
      if (!isTopmostDropdownDismissLayer(dropdownDismissLayers, layer)) return;
      const roots = currentRoots();
      const path = event.composedPath();
      const target = event.target;
      const targetInsideRoot = roots.some((root) => {
        const NodeConstructor = root.ownerDocument.defaultView?.Node;
        return Boolean(NodeConstructor && target instanceof NodeConstructor && root.contains(target as Node));
      });
      if (targetInsideRoot || !shouldDismissDropdownPointer(path, roots, ignoreSelector)) return;

      onCloseRef.current();
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (!closeOnEscape || event.key !== 'Escape'
        || !isTopmostDropdownDismissLayer(dropdownDismissLayers, layer)
        || dropdownDismissPathMatchesSelector(event.composedPath(), ignoreEscapeSelector)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onCloseRef.current();
      const returnFocusTarget = returnFocusRef?.current ?? focusOriginRef.current;
      if (returnFocusTarget) window.requestAnimationFrame(() => {
        if (returnFocusTarget.isConnected) returnFocusTarget.focus();
      });
    };

    const closePeer = (event: Event) => {
      if (!dismissGroup) return;
      const detail = (event as CustomEvent<DropdownPeerOpenDetail>).detail;
      if (detail?.group === dismissGroup && detail.layer !== layer) onCloseRef.current();
    };

    window.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('keydown', handleEscape, true);
    window.addEventListener(DROPDOWN_PEER_OPEN_EVENT, closePeer);
    if (dismissGroup) window.dispatchEvent(new CustomEvent<DropdownPeerOpenDetail>(DROPDOWN_PEER_OPEN_EVENT, {
      detail: { group: dismissGroup, layer }
    }));
    return () => {
      dropdownDismissLayers = removeDropdownDismissLayer(dropdownDismissLayers, layer);
      window.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('keydown', handleEscape, true);
      window.removeEventListener(DROPDOWN_PEER_OPEN_EVENT, closePeer);
    };
  }, [closeOnEscape, dismissGroup, ignoreEscapeSelector, ignoreSelector, open, portalRefs, refs, returnFocusRef]);

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
