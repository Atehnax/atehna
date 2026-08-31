import {
  useEffect,
  useId,
  useRef,
  type MouseEvent,
  type ReactNode,
  type RefObject
} from 'react';
import { createPortal } from 'react-dom';

export const dialogOverlayClassName =
  'fixed inset-0 z-[130] flex items-center justify-center bg-slate-900/34 px-4 py-6 backdrop-blur-[1px]';
export const dialogPanelBaseClassName =
  'w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_24px_60px_rgba(15,23,42,0.16),0_8px_24px_rgba(15,23,42,0.08)] sm:p-5';
export const dialogTitleClassName = 'text-[20px] font-semibold leading-7 tracking-tight text-slate-900';
export const dialogFooterClassName = 'mt-4 flex items-center justify-end gap-2';
export const dialogActionButtonClassName = '!h-8 !rounded-lg !px-3 !text-xs !font-semibold !tracking-[0]';
export const dialogDescriptionClassName = 'mt-2 text-[13px] leading-5 text-slate-600';

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  isDismissable?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  panelClassName?: string;
};

const focusableSelectors = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])'
];

const focusableSelector = focusableSelectors.join(',');
const portaledFocusableSelector = ['[role="listbox"]', '[role="menu"]']
  .flatMap((rootSelector) =>
    focusableSelectors.map((selector) => rootSelector + ' ' + selector)
  )
  .join(',');

let bodyScrollLockCount = 0;
let bodyOverflowBeforeLock = '';
const openDialogStack: symbol[] = [];

const focusableElements = (panel: HTMLElement) => {
  const panelElements = Array.from(
    panel.querySelectorAll<HTMLElement>(focusableSelector)
  );
  const portaledControls = Array.from(
    document.querySelectorAll<HTMLElement>(portaledFocusableSelector)
  );

  return Array.from(new Set([...panelElements, ...portaledControls])).filter(
    (element) =>
      !element.hasAttribute('disabled') &&
      element.getAttribute('aria-hidden') !== 'true'
  );
};

export default function Dialog({
  open,
  onOpenChange,
  title,
  children,
  footer,
  isDismissable = false,
  initialFocusRef,
  panelClassName
}: DialogProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const dialogTokenRef = useRef(Symbol('dialog'));
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return;
    const dialogToken = dialogTokenRef.current;
    previousActiveElementRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    openDialogStack.push(dialogToken);

    if (bodyScrollLockCount === 0) {
      bodyOverflowBeforeLock = document.body.style.overflow;
    }
    bodyScrollLockCount += 1;
    document.body.style.overflow = 'hidden';

    return () => {
      const stackIndex = openDialogStack.lastIndexOf(dialogToken);
      if (stackIndex >= 0) openDialogStack.splice(stackIndex, 1);

      bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1);
      if (bodyScrollLockCount === 0) {
        document.body.style.overflow = bodyOverflowBeforeLock;
      }

      const previousActiveElement = previousActiveElementRef.current;
      previousActiveElementRef.current = null;
      if (previousActiveElement?.isConnected) {
        window.requestAnimationFrame(() => {
          const anotherDialogIsOpen = openDialogStack.length > 0;
          const focusWasInsideDialog = Boolean(
            previousActiveElement.closest('[role="dialog"][aria-modal="true"]')
          );
          if (!anotherDialogIsOpen || focusWasInsideDialog) {
            previousActiveElement.focus();
          }
        });
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    const frame = window.requestAnimationFrame(() => {
      const requestedTarget = initialFocusRef?.current;
      const target =
        requestedTarget && !requestedTarget.hasAttribute('disabled')
          ? requestedTarget
          : panelRef.current
            ? focusableElements(panelRef.current)[0] ?? panelRef.current
            : null;
      target?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [open, initialFocusRef]);

  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    const dialogToken = dialogTokenRef.current;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        openDialogStack[openDialogStack.length - 1] !== dialogToken
      ) {
        return;
      }

      if (event.key === 'Escape') {
        if (!isDismissable) return;
        event.preventDefault();
        event.stopPropagation();
        onOpenChange(false);
        return;
      }
      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;
      const elements = focusableElements(panel);
      if (elements.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const firstElement = elements[0];
      const lastElement = elements[elements.length - 1];
      const activeElement = document.activeElement;
      const activeIndex =
        activeElement instanceof HTMLElement
          ? elements.indexOf(activeElement)
          : -1;

      if (event.shiftKey && activeIndex <= 0) {
        event.preventDefault();
        lastElement.focus();
      } else if (
        !event.shiftKey &&
        (activeIndex === -1 || activeIndex === elements.length - 1)
      ) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDismissable, onOpenChange, open]);

  if (!open || typeof document === 'undefined') return null;

  const handleOverlayClick = () => {
    if (!isDismissable) return;
    onOpenChange(false);
  };

  const handleCardClick = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  return createPortal(
    <div
      className={dialogOverlayClassName}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      onClick={handleOverlayClick}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={
          (dialogPanelBaseClassName + ' ' + (panelClassName ?? '')).trim()
        }
        onClick={handleCardClick}
      >
        {title ? (
          <p id={titleId} className={dialogTitleClassName}>
            {title}
          </p>
        ) : null}
        {children}
        {footer}
      </div>
    </div>,
    document.body
  );
}
