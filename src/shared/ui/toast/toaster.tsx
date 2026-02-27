'use client';

import { useContext } from 'react';
import { ToastContext, type ToastTone } from './toast-provider';

const toneClassMap: Record<ToastTone, string> = {
  success: 'border-emerald-200 text-emerald-800',
  error: 'border-rose-200 text-rose-800',
  info: 'border-slate-200 text-slate-700'
};

export default function Toaster() {
  const context = useContext(ToastContext);
  if (!context) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[160] flex justify-center px-4">
      <div className="flex w-full max-w-xl flex-col gap-2">
        {context.toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
            className={`pointer-events-auto flex items-start justify-between gap-3 rounded-xl border bg-white px-3 py-2 text-sm shadow-lg ${toneClassMap[toast.tone]}`}
          >
            <p>{toast.message}</p>
            <button
              type="button"
              onClick={() => context.removeToast(toast.id)}
              className="shrink-0 text-xs font-semibold text-slate-500 transition hover:text-slate-800"
              aria-label="Zapri obvestilo"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
