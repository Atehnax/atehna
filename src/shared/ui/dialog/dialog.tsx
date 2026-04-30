import { useEffect, type MouseEvent, type ReactNode, type RefObject } from 'react';
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
  useEffect(() => {
    if (!open) return;
    initialFocusRef?.current?.focus();
  }, [open, initialFocusRef]);

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
      onClick={handleOverlayClick}
    >
      <div className={`${dialogPanelBaseClassName} ${panelClassName ?? ''}`.trim()} onClick={handleCardClick}>
        {title ? <p className={dialogTitleClassName}>{title}</p> : null}
        {children}
        {footer}
      </div>
    </div>,
    document.body
  );
}
