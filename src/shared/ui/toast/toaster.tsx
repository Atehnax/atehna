'use client';

import { useContext } from 'react';
import { createPortal } from 'react-dom';
import { ToastContext, type ToastTone } from './toast-provider';

const toneClassMap: Record<ToastTone, string> = {
  success:
    'border-emerald-400/70 bg-slate-700 text-emerald-100 ring-1 ring-emerald-300/45',
  error:
    'border-rose-400/70 bg-slate-700 text-rose-100 ring-1 ring-rose-300/45',
  info:
    'border-slate-400/65 bg-slate-700 text-slate-100 ring-1 ring-slate-300/35'
};

export default function Toaster() {
  const context = useContext(ToastContext);
  if (!context) return null;

  const content = (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[160] flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 flex-col gap-2">
        {context.toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
            className={`pointer-events-auto flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-semibold shadow-[0_14px_26px_-14px_rgba(15,23,42,0.45)] backdrop-blur ${toneClassMap[toast.tone]}`}
          >
            <p className="leading-5">{toast.message}</p>
            <button
              type="button"
              onClick={() => context.removeToast(toast.id)}
              className="shrink-0 rounded-md px-1.5 py-0.5 text-xs font-semibold text-slate-200 transition hover:bg-white/15 hover:text-white"
              aria-label="Zapri obvestilo"
            >
              ✕
            </button>
          </div>
        ))}
    </div>
  );

  if (typeof document === 'undefined') return content;
  return createPortal(content, document.body);
}
