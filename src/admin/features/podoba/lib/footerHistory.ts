import { normalizeHomepageFooterSettings, type HomepageFooterSettings } from '@/shared/domain/landing/landingPage';

export const FOOTER_HISTORY_LIMIT = 50;
export type FooterHistoryState = {
  past: readonly string[];
  present: string;
  future: readonly string[];
  resetKey: string;
};

// Canonical footer JSON makes normalization and object-key ordering invisible
// to history. Serialized snapshots cannot be mutated by a controlled parent.
const snapshot = (value: HomepageFooterSettings) => JSON.stringify(normalizeHomepageFooterSettings(value));

export function createFooterHistory(value: HomepageFooterSettings, resetKey: string): FooterHistoryState {
  return { past: [], present: snapshot(value), future: [], resetKey };
}

export function recordFooterHistory(
  history: FooterHistoryState,
  value: HomepageFooterSettings,
  resetKey: string
): FooterHistoryState {
  const present = snapshot(value);
  if (resetKey !== history.resetKey) return { past: [], present, future: [], resetKey };
  if (present === history.present) return history;
  return {
    ...history,
    past: [...history.past, history.present].slice(-FOOTER_HISTORY_LIMIT),
    present,
    future: []
  };
}

export function moveFooterHistory(history: FooterHistoryState, direction: 'undo' | 'redo'): FooterHistoryState {
  const stack = direction === 'undo' ? history.past : history.future;
  const present = stack.at(-1);
  if (present === undefined) return history;
  return direction === 'undo'
    ? { ...history, past: history.past.slice(0, -1), present, future: [...history.future, history.present].slice(-FOOTER_HISTORY_LIMIT) }
    : { ...history, past: [...history.past, history.present].slice(-FOOTER_HISTORY_LIMIT), present, future: history.future.slice(0, -1) };
}

export function restoreFooterHistoryValue(history: FooterHistoryState): HomepageFooterSettings {
  return JSON.parse(history.present) as HomepageFooterSettings;
}
