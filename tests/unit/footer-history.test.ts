import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeHomepageFooterSettings, type HomepageFooterSettings } from '@/shared/domain/landing/landingPage';
import { createFooterHistory, FOOTER_HISTORY_LIMIT, moveFooterHistory, recordFooterHistory, restoreFooterHistoryValue } from '@/admin/features/podoba/lib/footerHistory';

const footer = () => normalizeHomepageFooterSettings({});
const withDescription = (description: string) => ({ ...footer(), description });

test('footer text and visibility edits undo and redo in order without mutating source or returned snapshots', () => {
  const initial = footer();
  let history = createFooterHistory(initial, 'server-1');
  const edited = { ...initial, description: 'Nova predstavitev' };
  history = recordFooterHistory(history, edited, 'server-1');
  edited.description = 'Parent mutation';
  history = recordFooterHistory(history, { ...restoreFooterHistoryValue(history), upperSectionVisible: false }, 'server-1');
  history = moveFooterHistory(history, 'undo');
  assert.equal(restoreFooterHistoryValue(history).description, 'Nova predstavitev');
  assert.equal(restoreFooterHistoryValue(history).upperSectionVisible, initial.upperSectionVisible);
  history = moveFooterHistory(history, 'undo');
  assert.deepEqual(restoreFooterHistoryValue(history), initial);
  history = moveFooterHistory(history, 'redo');
  const restored = restoreFooterHistoryValue(history);
  restored.contact.email = 'changed@example.test';
  assert.equal(restoreFooterHistoryValue(history).contact.email, initial.contact.email);
  history = moveFooterHistory(history, 'redo');
  assert.equal(restoreFooterHistoryValue(history).upperSectionVisible, false);
  assert.deepEqual(initial, footer());
});

test('equivalent normalized values and restoration echoes do not add entries or discard redo', () => {
  const initial = footer();
  const empty = createFooterHistory(initial, 'server-1');
  const reordered = Object.fromEntries(Object.entries(initial).reverse()) as HomepageFooterSettings;
  assert.equal(recordFooterHistory(empty, reordered, 'server-1'), empty);
  const edited = recordFooterHistory(empty, { ...initial, description: 'New description' }, 'server-1');
  const undone = moveFooterHistory(edited, 'undo');
  assert.equal(recordFooterHistory(undone, normalizeHomepageFooterSettings(restoreFooterHistoryValue(undone)), 'server-1'), undone);
  assert.equal(recordFooterHistory(undone, { ...initial, layoutColumns: 0 }, 'server-1').future.length, 0, 'A changed normalized value is still a real edit');
  const clamp = createFooterHistory({ ...initial, layoutColumns: 1 }, 'server-1');
  assert.equal(recordFooterHistory(clamp, { ...initial, layoutColumns: 0 }, 'server-1'), clamp, 'Equivalent clamped values do not add history');
  assert.equal(moveFooterHistory(undone, 'redo').present, edited.present);
});

test('a new edit after undo creates a new branch and cannot redo discarded edits', () => {
  let history = createFooterHistory(withDescription('Initial'), 'server-1');
  history = recordFooterHistory(history, withDescription('First'), 'server-1');
  history = recordFooterHistory(history, withDescription('Second'), 'server-1');
  history = moveFooterHistory(history, 'undo');
  history = recordFooterHistory(history, withDescription('New branch'), 'server-1');
  assert.equal(history.future.length, 0);
  assert.equal(moveFooterHistory(history, 'redo'), history);
  assert.equal(restoreFooterHistoryValue(moveFooterHistory(history, 'undo')).description, 'First');
});

test('history retains at most 50 edits and redo remains bounded after reaching the oldest retained state', () => {
  let history = createFooterHistory(withDescription('0'), 'server-1');
  for (let index = 1; index <= 75; index += 1) history = recordFooterHistory(history, withDescription(String(index)), 'server-1');
  assert.equal(history.past.length, FOOTER_HISTORY_LIMIT);
  for (let index = 0; index < 60; index += 1) history = moveFooterHistory(history, 'undo');
  assert.equal(restoreFooterHistoryValue(history).description, '25');
  assert.equal(history.past.length, 0);
  assert.equal(history.future.length, FOOTER_HISTORY_LIMIT);
  for (let index = 0; index < 60; index += 1) history = moveFooterHistory(history, 'redo');
  assert.equal(restoreFooterHistoryValue(history).description, '75');
  assert.equal(history.past.length, FOOTER_HISTORY_LIMIT);
  assert.equal(history.future.length, 0);
});

test('external server reset replaces the baseline and clears both branches even when footer content is equal', () => {
  let history = createFooterHistory(withDescription('Initial'), 'server-1');
  history = recordFooterHistory(history, withDescription('Edited'), 'server-1');
  history = moveFooterHistory(history, 'undo');
  history = recordFooterHistory(history, withDescription('Server value'), 'server-2');
  assert.equal(restoreFooterHistoryValue(history).description, 'Server value');
  assert.equal(history.past.length, 0);
  assert.equal(history.future.length, 0);
  history = recordFooterHistory(history, withDescription('Edited again'), 'server-2');
  const reset = recordFooterHistory(history, restoreFooterHistoryValue(history), 'server-3');
  assert.equal(reset.past.length, 0);
  assert.equal(reset.future.length, 0);
  assert.equal(moveFooterHistory(reset, 'undo'), reset);
});
