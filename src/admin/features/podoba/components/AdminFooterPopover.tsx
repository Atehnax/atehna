'use client';

import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

type AdminFooterPopoverProps = {
  anchorRef: RefObject<HTMLElement | null>;
  panelRef: RefObject<HTMLDivElement | null>;
  className?: string;
  align?: 'left' | 'right';
  children: ReactNode;
};

type PopoverPosition = {
  left: number;
  top: number;
  maxWidth: number;
  maxHeight: number;
  above: boolean;
  ready: boolean;
};

const MARGIN = 8;
const GAP = 6;
const clamp = (value: number, minimum: number, maximum: number) => Math.min(Math.max(value, minimum), Math.max(minimum, maximum));

/** Positioning only: the caller owns menu styling, labels and dismissal refs. */
export default function AdminFooterPopover({ anchorRef, panelRef, className, align = 'right', children }: AdminFooterPopoverProps) {
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<PopoverPosition>({ left: 0, top: 0, maxWidth: 0, maxHeight: 0, above: false, ready: false });
  const frame = useRef<number | null>(null);

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;
    const viewport = window.visualViewport;
    const leftEdge = (viewport?.offsetLeft ?? 0) + MARGIN;
    const topEdge = (viewport?.offsetTop ?? 0) + MARGIN;
    const maxWidth = Math.max(1, (viewport?.width ?? window.innerWidth) - MARGIN * 2);
    const viewportHeight = Math.max(1, (viewport?.height ?? window.innerHeight) - MARGIN * 2);
    const rightEdge = leftEdge + maxWidth;
    const bottomEdge = topEdge + viewportHeight;
    const anchorRect = anchor.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const width = Math.min(panelRect.width, maxWidth);
    const borderHeight = Math.max(0, panel.offsetHeight - panel.clientHeight);
    const naturalHeight = Math.max(panelRect.height, panel.scrollHeight + borderHeight);
    const below = Math.max(0, bottomEdge - anchorRect.bottom - GAP);
    const aboveSpace = Math.max(0, anchorRect.top - GAP - topEdge);
    const above = naturalHeight > below && aboveSpace > below;
    const availableHeight = above ? aboveSpace : below;
    const maxHeight = Math.max(1, Math.min(viewportHeight, availableHeight || viewportHeight));
    const height = Math.min(naturalHeight, maxHeight);
    const next = {
      left: clamp(align === 'left' ? anchorRect.left : anchorRect.right - width, leftEdge, rightEdge - width),
      top: clamp(above ? anchorRect.top - GAP - height : anchorRect.bottom + GAP, topEdge, bottomEdge - height),
      maxWidth,
      maxHeight,
      above,
      ready: true
    };
    setPosition(previous => Object.keys(next).every(key => previous[key as keyof PopoverPosition] === next[key as keyof PopoverPosition]) ? previous : next);
  }, [anchorRef, panelRef, align]);

  const schedulePosition = useCallback(() => {
    if (frame.current !== null) return;
    frame.current = window.requestAnimationFrame(() => {
      frame.current = null;
      updatePosition();
    });
  }, [updatePosition]);

  useLayoutEffect(() => { setMounted(true); }, []);

  useLayoutEffect(() => {
    if (!mounted) return;
    updatePosition();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedulePosition);
    if (anchorRef.current) observer?.observe(anchorRef.current);
    if (panelRef.current) observer?.observe(panelRef.current);
    window.addEventListener('resize', schedulePosition);
    window.addEventListener('scroll', schedulePosition, true);
    window.visualViewport?.addEventListener('resize', schedulePosition);
    window.visualViewport?.addEventListener('scroll', schedulePosition);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', schedulePosition);
      window.removeEventListener('scroll', schedulePosition, true);
      window.visualViewport?.removeEventListener('resize', schedulePosition);
      window.visualViewport?.removeEventListener('scroll', schedulePosition);
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
      frame.current = null;
    };
  }, [mounted, anchorRef, panelRef, updatePosition, schedulePosition]);

  useLayoutEffect(() => {
    if (mounted) updatePosition();
  }, [children, className, mounted, updatePosition]);

  if (!mounted) return null;
  const style: CSSProperties = {
    position: 'fixed', left: position.left, top: position.top, right: 'auto', bottom: 'auto',
    maxWidth: position.maxWidth || 'calc(100vw - 16px)',
    maxHeight: position.maxHeight || 'calc(100vh - 16px)',
    minWidth: 0, minHeight: 0, boxSizing: 'border-box', overflowY: 'auto',
    zIndex: 200, visibility: position.ready ? 'visible' : 'hidden',
    transformOrigin: `${position.above ? 'bottom' : 'top'} ${align}`
  };
  return createPortal(<div ref={panelRef} className={className} style={style} data-admin-footer-popover data-placement={position.above ? 'top' : 'bottom'}>{children}</div>, document.body);
}
