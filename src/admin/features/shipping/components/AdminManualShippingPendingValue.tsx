'use client';

import {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent
} from 'react';
import { createPortal } from 'react-dom';

const MANUAL_SHIPPING_TOOLTIP_TEXT = 'Za poštnino je potreben ročni vnos';

type TooltipPosition = {
  left: number;
  top: number;
  placeBelow: boolean;
};

export default function AdminManualShippingPendingValue({
  className = ''
}: {
  className?: string;
}) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();
  const [isFocused, setIsFocused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);
  const isOpen = isFocused || isHovered;

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger || typeof window === 'undefined') return;

    const rect = trigger.getBoundingClientRect();
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
    const tooltipWidth = Math.min(232, Math.max(0, viewportWidth - 24));
    const viewportInset = 12;
    const left = Math.min(
      Math.max(rect.left + rect.width / 2 - tooltipWidth / 2, viewportInset),
      viewportWidth - tooltipWidth - viewportInset
    );
    const placeBelow = rect.top < 52;

    setPosition({
      left,
      top: placeBelow ? rect.bottom + 8 : rect.top - 8,
      placeBelow
    });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return;

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  const openForFocus = () => {
    updatePosition();
    setIsFocused(true);
  };

  const openForHover = () => {
    updatePosition();
    setIsHovered(true);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    setIsFocused(false);
    setIsHovered(false);
  };

  const tooltip = isOpen && position && typeof document !== 'undefined'
    ? createPortal(
        <span
          id={tooltipId}
          role="tooltip"
          className="pointer-events-none fixed z-[2147483647] w-[232px] max-w-[calc(100vw-24px)] rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-center text-[11px] font-medium leading-4 text-white shadow-lg"
          style={{
            left: position.left,
            top: position.top,
            transform: position.placeBelow ? undefined : 'translateY(-100%)'
          }}
        >
          {MANUAL_SHIPPING_TOOLTIP_TEXT}
        </span>,
        document.body
      )
    : null;

  return (
    <span
      ref={triggerRef}
      tabIndex={0}
      aria-label={`N/A. ${MANUAL_SHIPPING_TOOLTIP_TEXT}`}
      aria-describedby={isOpen ? tooltipId : undefined}
      className={`inline-flex cursor-help items-center justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--blue-500)] focus-visible:ring-offset-1 ${className}`.trim()}
      onBlur={() => setIsFocused(false)}
      onFocus={openForFocus}
      onKeyDown={onKeyDown}
      onMouseEnter={openForHover}
      onMouseLeave={() => setIsHovered(false)}
    >
      N/A
      {tooltip}
    </span>
  );
}

export { MANUAL_SHIPPING_TOOLTIP_TEXT };
