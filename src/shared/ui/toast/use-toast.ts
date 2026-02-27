'use client';

import { useContext } from 'react';
import { ToastContext } from './toast-provider';

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }

  return {
    toast: {
      success: context.success,
      error: context.error,
      info: context.info
    }
  };
}
