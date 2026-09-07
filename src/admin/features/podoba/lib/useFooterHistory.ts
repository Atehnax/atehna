'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { HomepageFooterSettings } from '@/shared/domain/landing/landingPage';
import { createFooterHistory, moveFooterHistory, recordFooterHistory, restoreFooterHistoryValue } from './footerHistory';

/**
 * Each committed controlled footer value is one edit. Restoring a snapshot does
 * not add an edit when the parent echoes its normalized value back. Change
 * resetKey with an external/server reset; this discards history without calling
 * onRestore. The parent owns merging restored footer settings into its config.
 */
export function useFooterHistory(
  value: HomepageFooterSettings,
  onRestore: (next: HomepageFooterSettings) => void,
  resetKey: string
) {
  const [history, setHistory] = useState(() => createFooterHistory(value, resetKey));
  const current = useRef(history);

  useLayoutEffect(() => {
    const next = recordFooterHistory(current.current, value, resetKey);
    if (next !== current.current) {
      current.current = next;
      setHistory(next);
    }
  }, [value, resetKey]);

  const move = useCallback((direction: 'undo' | 'redo') => {
    const next = moveFooterHistory(current.current, direction);
    if (next === current.current) return false;
    current.current = next;
    setHistory(next);
    onRestore(restoreFooterHistoryValue(next));
    return true;
  }, [onRestore]);
  const undo = useCallback(() => move('undo'), [move]);
  const redo = useCallback(() => move('redo'), [move]);
  const clear = useCallback(() => {
    if (!current.current.past.length && !current.current.future.length) return;
    const next = { ...current.current, past: [], future: [] };
    current.current = next;
    setHistory(next);
  }, []);

  return { canUndo: history.past.length > 0, canRedo: history.future.length > 0, undo, redo, clear };
}
