import { useEffect, type MouseEvent, type ReactNode, type RefObject } from 'react';

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  isDismissable?: boolean;
  initialFocusRef?: RefObject<HTMLElement>;
};

export default function Dialog({
  open,
  onOpenChange,
  title,
  children,
  footer,
  isDismissable = false,
  initialFocusRef
}: DialogProps) {
  useEffect(() => {
    if (!open) return;
    initialFocusRef?.current?.focus();
  }, [open, initialFocusRef]);

  if (!open) return null;

  const handleOverlayClick = () => {
    if (!isDismissable) return;
    onOpenChange(false);
  };

  const handleCardClick = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-900/30 px-4"
      role="dialog"
      aria-modal="true"
      onClick={handleOverlayClick}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl" onClick={handleCardClick}>
        {title ? <p className="text-sm font-semibold text-slate-900">{title}</p> : null}
        {children}
        {footer}
      </div>
    </div>
  );
}
