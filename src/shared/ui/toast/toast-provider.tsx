'use client';

import { createContext, useCallback, useMemo, useState, type ReactNode } from 'react';

export type ToastTone = 'success' | 'error' | 'info';

export type ToastItem = {
  id: string;
  message: string;
  tone: ToastTone;
  durationMs: number;
};

type ToastOptions = {
  durationMs?: number;
};

type ToastContextValue = {
  toasts: ToastItem[];
  removeToast: (id: string) => void;
  success: (message: string, options?: ToastOptions) => void;
  error: (message: string, options?: ToastOptions) => void;
  info: (message: string, options?: ToastOptions) => void;
};

export const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION_MS = 5000;

const createToastId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback((tone: ToastTone, message: string, options?: ToastOptions) => {
    const id = createToastId();
    const durationMs = options?.durationMs ?? DEFAULT_DURATION_MS;

    setToasts((currentToasts) => [...currentToasts, { id, message, tone, durationMs }]);

    window.setTimeout(() => {
      setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== id));
    }, durationMs);
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      toasts,
      removeToast,
      success: (message, options) => pushToast('success', message, options),
      error: (message, options) => pushToast('error', message, options),
      info: (message, options) => pushToast('info', message, options)
    }),
    [toasts, removeToast, pushToast]
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}
