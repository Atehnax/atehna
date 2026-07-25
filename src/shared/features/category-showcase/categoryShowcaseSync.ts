'use client';

import {
  normalizeCategoryShowcaseMediaSettings,
  type CategoryShowcaseMediaSettings
} from './categoryShowcaseSchema';

export type CategoryDataChangeScope = 'catalog' | 'showcase';

export type CategoryDataChangeMessage = {
  type: 'category-data-saved';
  scope: CategoryDataChangeScope;
  revision: string;
  sourceId: string;
  sentAt: number;
  changedSlugs: string[];
};

export type CategoryShowcaseRemoteUpdate = {
  categoryId?: string;
  categorySlug: string;
  image?: string | null;
  presentation: CategoryShowcaseMediaSettings;
  revision?: string;
};

const CATEGORY_DATA_CHANNEL = 'atehna:category-data';

function createRevision() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const CATEGORY_DATA_SOURCE_ID = createRevision();

function normalizeChangedSlugs(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean)))
    .slice(0, 24);
}

export function mergeCategoryDataChangeMessages(
  current: CategoryDataChangeMessage | null,
  incoming: CategoryDataChangeMessage
): CategoryDataChangeMessage {
  if (!current) return incoming;

  if (current.scope === 'catalog' || incoming.scope === 'catalog') {
    return {
      ...incoming,
      scope: 'catalog',
      changedSlugs: []
    };
  }

  return {
    ...incoming,
    changedSlugs: normalizeChangedSlugs([
      ...current.changedSlugs,
      ...incoming.changedSlugs
    ])
  };
}

export function publishCategoryDataChange(scope: CategoryDataChangeScope, changedSlugs: string[] = []) {
  if (typeof BroadcastChannel === 'undefined') return null;

  const message: CategoryDataChangeMessage = {
    type: 'category-data-saved',
    scope,
    revision: createRevision(),
    sourceId: CATEGORY_DATA_SOURCE_ID,
    sentAt: Date.now(),
    changedSlugs: normalizeChangedSlugs(changedSlugs)
  };
  const channel = new BroadcastChannel(CATEGORY_DATA_CHANNEL);
  channel.postMessage(message);
  channel.close();
  return message.revision;
}

export function subscribeToCategoryDataChanges(
  listener: (message: CategoryDataChangeMessage) => void
) {
  if (typeof BroadcastChannel === 'undefined') return () => undefined;

  const channel = new BroadcastChannel(CATEGORY_DATA_CHANNEL);
  const handleMessage = (event: MessageEvent<unknown>) => {
    const message = event.data as Partial<CategoryDataChangeMessage> | null;
    if (
      message?.type !== 'category-data-saved' ||
      (message.scope !== 'catalog' && message.scope !== 'showcase') ||
      typeof message.revision !== 'string' ||
      typeof message.sourceId !== 'string' ||
      typeof message.sentAt !== 'number'
    ) {
      return;
    }

    if (message.sourceId === CATEGORY_DATA_SOURCE_ID) return;
    listener({
      ...(message as Omit<CategoryDataChangeMessage, 'changedSlugs'>),
      changedSlugs: normalizeChangedSlugs(message.changedSlugs)
    });
  };

  channel.addEventListener('message', handleMessage);
  return () => {
    channel.removeEventListener('message', handleMessage);
    channel.close();
  };
}

export async function fetchCategoryShowcaseUpdates(
  categorySlugs: string[]
): Promise<CategoryShowcaseRemoteUpdate[]> {
  const slugs = normalizeChangedSlugs(categorySlugs);
  if (slugs.length === 0) return [];

  const search = new URLSearchParams({ slugs: slugs.join(',') });
  const response = await fetch(`/api/admin/categories/images?${search.toString()}`, {
    cache: 'no-store'
  });
  const body = await response.json().catch(() => ({})) as { message?: string; updates?: unknown[] };
  if (!response.ok) {
    throw new Error(body.message || 'Osveževanje videza kategorij ni uspelo.');
  }

  return (body.updates ?? []).flatMap((value): CategoryShowcaseRemoteUpdate[] => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    const record = value as Record<string, unknown>;
    const categorySlug = typeof record.categorySlug === 'string'
      ? record.categorySlug
      : typeof record.slug === 'string'
        ? record.slug
        : '';
    if (!categorySlug) return [];
    return [{
      ...(typeof record.categoryId === 'string'
        ? { categoryId: record.categoryId }
        : typeof record.id === 'string' ? { categoryId: record.id } : {}),
      categorySlug,
      ...(Object.prototype.hasOwnProperty.call(record, 'image')
        ? { image: record.image === null ? null : typeof record.image === 'string' ? record.image : undefined }
        : {}),
      presentation: normalizeCategoryShowcaseMediaSettings(record.presentation),
      ...(typeof record.revision === 'string' ? { revision: record.revision } : {})
    }];
  });
}
