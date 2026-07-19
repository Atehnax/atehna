'use client';

export type CategoryDataChangeScope = 'catalog' | 'showcase';

export type CategoryDataChangeMessage = {
  type: 'category-data-saved';
  scope: CategoryDataChangeScope;
  revision: string;
  sourceId: string;
  sentAt: number;
};

const CATEGORY_DATA_CHANNEL = 'atehna:category-data';

function createRevision() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const CATEGORY_DATA_SOURCE_ID = createRevision();

export function publishCategoryDataChange(scope: CategoryDataChangeScope) {
  if (typeof BroadcastChannel === 'undefined') return null;

  const message: CategoryDataChangeMessage = {
    type: 'category-data-saved',
    scope,
    revision: createRevision(),
    sourceId: CATEGORY_DATA_SOURCE_ID,
    sentAt: Date.now()
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
    listener(message as CategoryDataChangeMessage);
  };

  channel.addEventListener('message', handleMessage);
  return () => {
    channel.removeEventListener('message', handleMessage);
    channel.close();
  };
}
