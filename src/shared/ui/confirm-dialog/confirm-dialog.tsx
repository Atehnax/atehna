import type { ReactNode } from 'react';
import { Dialog } from '@/shared/ui/dialog';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDanger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  confirmDisabled?: boolean;
  children?: ReactNode;
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Potrdi',
  cancelLabel = 'Prekliči',
  isDanger = false,
  onConfirm,
  onCancel,
  confirmDisabled = false,
  children
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onCancel();
      }}
      title={title}
      isDismissable={false}
      footer={
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled}
            className={
              isDanger
                ? 'h-8 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-50'
                : 'h-8 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50'
            }
          >
            {confirmLabel}
          </button>
        </div>
      }
    >
      {description ? <p className="mt-2 text-xs text-slate-600">{description}</p> : null}
      {children}
    </Dialog>
  );
}
