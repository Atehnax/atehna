'use client';

import { useContext } from 'react';
import { createPortal } from 'react-dom';
import { ToastContext, type ToastTone } from './toast-provider';

const toneClassMap: Record<ToastTone, string> = {
  success:
    'border-emerald-500/40 bg-gradient-to-r from-emerald-50 via-white to-emerald-50/70 text-emerald-900 ring-1 ring-emerald-500/30',
  error:
    'border-rose-500/40 bg-gradient-to-r from-rose-50 via-white to-rose-50/70 text-rose-900 ring-1 ring-rose-500/30',
  info:
    'border-[#5d3ed6]/35 bg-gradient-to-r from-[#5d3ed6]/10 via-white to-[#5d3ed6]/5 text-slate-900 ring-1 ring-[#5d3ed6]/25'
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
            className={`pointer-events-auto flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-medium shadow-[0_14px_30px_-14px_rgba(15,23,42,0.6)] backdrop-blur ${toneClassMap[toast.tone]}`}
          >
            <p>{toast.message}</p>
            <button
              type="button"
              onClick={() => context.removeToast(toast.id)}
              className="shrink-0 rounded-md px-1.5 py-0.5 text-xs font-semibold text-slate-500 transition hover:bg-white/70 hover:text-slate-900"
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
