import type { ReactNode } from 'react';

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
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-900/30 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        {description ? <p className="mt-2 text-xs text-slate-600">{description}</p> : null}
        {children}
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
            className={isDanger
              ? 'h-8 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-50'
              : 'h-8 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50'}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
