'use client';

import { useSyncExternalStore } from 'react';
import { DEFAULT_ARTICLE_NOTE_TAGS, normalizeArticleNoteTags, type ArticleNoteTagDefinition } from '@/shared/domain/catalog/articleNotes';

let currentTags: readonly ArticleNoteTagDefinition[] = DEFAULT_ARTICLE_NOTE_TAGS;
let loaded = false;
let pending: Promise<void> | null = null;
const listeners = new Set<() => void>();

export function getArticleNoteTagsSnapshot() { return currentTags; }
const getServerSnapshot = () => DEFAULT_ARTICLE_NOTE_TAGS;

export function publishArticleNoteTags(value: unknown) {
  const next = normalizeArticleNoteTags(value);
  loaded = true;
  if (JSON.stringify(next) === JSON.stringify(currentTags)) return;
  currentTags = next;
  for (const notify of listeners) notify();
}

function refreshArticleNoteTags() {
  if (pending) return pending;
  pending = fetch('/api/admin/product-appearance', { cache: 'no-store' })
    .then(async (response) => {
      if (!response.ok) return;
      const body = await response.json();
      if (body.config?.articleNotes?.tags) publishArticleNoteTags(body.config.articleNotes.tags);
    })
    .catch(() => { /* Retain the last saved settings when temporarily offline. */ })
    .finally(() => { pending = null; });
  return pending;
}

function onFocus() { void refreshArticleNoteTags(); }
function subscribe(listener: () => void) {
  const first = listeners.size === 0;
  listeners.add(listener);
  if (first) {
    window.addEventListener('focus', onFocus);
    void refreshArticleNoteTags();
  } else if (!loaded) {
    void refreshArticleNoteTags();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('focus', onFocus);
  };
}

/** All admin note chips share one request and update together after an appearance save. */
export function useArticleNoteTags() {
  return useSyncExternalStore(subscribe, getArticleNoteTagsSnapshot, getServerSnapshot);
}
