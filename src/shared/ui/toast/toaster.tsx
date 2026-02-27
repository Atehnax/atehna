'use client';

import { useContext } from 'react';
import { createPortal } from 'react-dom';
import { ToastContext, type ToastTone } from './toast-provider';

const toneClassMap: Record<ToastTone, string> = {
  success:
    'border-emerald-500/70 bg-gradient-to-r from-slate-800 via-slate-700 to-emerald-800/70 text-emerald-100 ring-1 ring-emerald-400/55',
  error:
    'border-rose-500/75 bg-gradient-to-r from-slate-800 via-slate-700 to-rose-800/70 text-rose-100 ring-1 ring-rose-400/55',
  info:
    'border-slate-500/65 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 text-slate-100 ring-1 ring-slate-300/45'
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
            className={`pointer-events-auto flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-semibold shadow-[0_18px_34px_-16px_rgba(15,23,42,0.55)] backdrop-blur ${toneClassMap[toast.tone]}`}
          >
            <p className="leading-5">{toast.message}</p>
            <button
              type="button"
              onClick={() => context.removeToast(toast.id)}
              className="shrink-0 rounded-md px-1.5 py-0.5 text-xs font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
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
