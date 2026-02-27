'use client';

import { useContext } from 'react';
import { createPortal } from 'react-dom';
import { ToastContext, type ToastTone } from './toast-provider';

const toneClassMap: Record<ToastTone, string> = {
  success:
    'border-emerald-500/80 bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950/60 text-emerald-200 ring-1 ring-emerald-500/60',
  error:
    'border-rose-500/85 bg-gradient-to-r from-black via-slate-950 to-rose-950/60 text-rose-200 ring-1 ring-rose-500/65',
  info:
    'border-slate-500/80 bg-gradient-to-r from-black via-slate-950 to-slate-900 text-slate-100 ring-1 ring-slate-400/45'
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
            className={`pointer-events-auto flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-semibold shadow-[0_20px_40px_-18px_rgba(2,6,23,0.9)] backdrop-blur ${toneClassMap[toast.tone]}`}
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
