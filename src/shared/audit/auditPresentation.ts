import type { AuditAction, AuditCollectionValue, AuditDiff, AuditDiffEntry, AuditEntityType, AuditEventRecord, AuditScalarDiff } from './auditTypes';
import { CUSTOMER_TYPE_FORM_OPTIONS } from '../domain/order/customerType';
import { getStatusLabel as getOrderStatusLabel, isOrderStatus } from '../domain/order/orderStatus';
import { getPaymentLabel, isPaymentStatus } from '../domain/order/paymentStatus';

export type AuditActionFilterValue = '' | 'created' | 'updated' | 'archived' | 'restored' | 'removed';

export type AuditChangeRow = {
  id: string;
  eventId: string;
  eventSummary: string;
  eventOccurredAt: string;
  field: string;
  before: string;
  after: string;
  beforeHref?: string | null;
  afterHref?: string | null;
  action: AuditAction;
  redacted: boolean;
};

export type AuditEventGroup = {
  id: string;
  events: AuditEventRecord[];
  changes: AuditChangeRow[];
  occurredAt: string;
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  entityType: AuditEntityType;
  entityId: string;
  entityLabel: string | null;
  action: AuditAction;
  actionLabel: string;
  summary: string;
};

export const AUDIT_ACTION_FILTERS: Record<Exclude<AuditActionFilterValue, ''>, AuditAction[]> = {
  created: ['created', 'uploaded'],
  updated: ['updated', 'status_changed', 'reordered', 'price_changed', 'stock_changed'],
  archived: ['archived'],
  restored: ['restored'],
  removed: ['deleted', 'removed']
};

export const AUDIT_ACTION_FILTER_LABELS: Record<AuditActionFilterValue, string> = {
  '': 'Vsa dejanja',
  created: 'Dodano',
  updated: 'Spremenjeno',
  archived: 'Arhivirano',
  restored: 'Obnovljeno',
  removed: 'Odstranjeno'
};

const DERIVED_CHANGE_KEYS = new Set([
  'subtotal',
  'tax',
  'total',
  'shipping',
  'totalprice',
  'total_price'
]);

const DERIVED_CHANGE_LABELS = new Set([
  'ddv',
  'vmesni znesek',
  'skupaj',
  'postnina',
  'totalprice',
  'total price'
]);

const CATEGORY_MOVE_PARENT_KEYS = new Set(['parentId', 'parent_id']);
const CATEGORY_MOVE_SUPPRESSED_KEYS = new Set([
  'parentId',
  'parent_id',
  'position',
  'summary',
  'description',
  'image',
  'bannerImage',
  'adminNotes'
]);

const CUSTOMER_TYPE_FORM_LABELS = new Map(
  CUSTOMER_TYPE_FORM_OPTIONS.map((option) => [option.value, option.label])
);

const PRODUCT_TYPE_LABELS = new Map<string, string>([
  ['dimensions', 'Po dimenzijah'],
  ['weight', 'Po teži'],
  ['simple', 'Osnovni artikel'],
  ['unique_machine', 'Stroj / unikaten']
]);

const CATALOG_ITEM_TYPE_PRODUCT_EQUIVALENTS = new Map<string, string>([
  ['sheet', 'dimensions'],
  ['bulk', 'weight'],
  ['unit', 'simple']
]);

const STATUS_LABELS: Record<string, Record<AuditEntityType | 'default', string>> = {
  active: {
    category: 'Aktivna',
    item: 'Aktiven',
    order: 'Aktivno',
    media: 'Aktivni',
    system: 'Aktiven',
    default: 'Aktivna'
  },
  inactive: {
    category: 'Neaktivna',
    item: 'Neaktiven',
    order: 'Neaktivno',
    media: 'Neaktivni',
    system: 'Neaktiven',
    default: 'Neaktivna'
  },
  archived: {
    category: 'Arhivirana',
    item: 'Arhiviran',
    order: 'Arhivirano',
    media: 'Arhivirani',
    system: 'Arhiviran',
    default: 'Arhivirano'
  },
  arhivirano: {
    category: 'Arhivirana',
    item: 'Arhiviran',
    order: 'Arhivirano',
    media: 'Arhivirani',
    system: 'Arhiviran',
    default: 'Arhivirano'
  },
  restored: {
    category: 'Obnovljena',
    item: 'Obnovljen',
    order: 'Obnovljeno',
    media: 'Obnovljeni',
    system: 'Obnovljen',
    default: 'Obnovljeno'
  },
  deleted: {
    category: 'Izbrisana',
    item: 'Izbrisan',
    order: 'Izbrisano',
    media: 'Izbrisani',
    system: 'Izbrisan',
    default: 'Izbrisano'
  },
  removed: {
    category: 'Odstranjena',
    item: 'Odstranjen',
    order: 'Odstranjeno',
    media: 'Odstranjeni',
    system: 'Odstranjen',
    default: 'Odstranjeno'
  }
};

const GENERAL_ENUM_VALUE_LABELS = new Map<string, string>([
  ['created', 'Ustvarjeno'],
  ['updated', 'Spremenjeno'],
  ['uploaded', 'Naloženo'],
  ['restored', 'Obnovljeno'],
  ['draft', 'Osnutek'],
  ['published', 'Objavljeno'],
  ['visible', 'Vidno'],
  ['hidden', 'Skrito'],
  ['enabled', 'Vklopljeno'],
  ['disabled', 'Izklopljeno'],
  ['true', 'Da'],
  ['false', 'Ne']
]);

const SLOVENIAN_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('sl-SI', {
  timeZone: 'Europe/Ljubljana',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});

export function getAuditDisplayAction(action: AuditAction): Exclude<AuditActionFilterValue, ''> {
  if (action === 'created' || action === 'uploaded') return 'created';
  if (action === 'archived') return 'archived';
  if (action === 'restored') return 'restored';
  if (action === 'deleted' || action === 'removed') return 'removed';
  return 'updated';
}

export function getAuditDisplayActionLabel(action: AuditAction) {
  return AUDIT_ACTION_FILTER_LABELS[getAuditDisplayAction(action)];
}

export function getAuditActionsForFilter(value: AuditActionFilterValue) {
  return value ? AUDIT_ACTION_FILTERS[value] : [];
}

function parseTime(value: string) {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function sameAuditMoment(current: AuditEventRecord, previous: AuditEventRecord, windowMs: number) {
  const sameActor = (current.actorId ?? current.actorName ?? '') === (previous.actorId ?? previous.actorName ?? '');
  const closeTogether = Math.abs(parseTime(previous.occurredAt) - parseTime(current.occurredAt)) <= windowMs;
  if (!sameActor || !closeTogether || current.entityType !== previous.entityType) return false;

  const sameEntity = current.entityId === previous.entityId;
  const sameRequest = Boolean(current.requestId && previous.requestId && current.requestId === previous.requestId);
  const sameCategoryReorder = current.entityType === 'category'
    && previous.entityType === 'category'
    && current.action === 'reordered'
    && previous.action === 'reordered';

  return sameEntity || sameRequest || sameCategoryReorder;
}

function isEmptyAuditDisplayToken(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized === '' || normalized === 'prazno' || normalized === '—' || normalized === 'ni bilo';
}

function formatSlovenianAuditDateTime(value: string) {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}(?:[tT]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.test(trimmed)) return null;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;

  const parts = SLOVENIAN_DATE_TIME_FORMATTER.formatToParts(parsed);
  const day = parts.find((part) => part.type === 'day')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const year = parts.find((part) => part.type === 'year')?.value;
  const hour = parts.find((part) => part.type === 'hour')?.value;
  const minute = parts.find((part) => part.type === 'minute')?.value;
  if (!day || !month || !year || !hour || !minute) return null;

  return `${day}.${month}.${year}, ${hour}:${minute}`;
}

function isDateAuditField(fieldKey: string, label: string) {
  const normalizedKey = fieldKey.toLowerCase();
  const normalizedLabel = label.toLowerCase();
  return normalizedKey.includes('date') || normalizedKey.endsWith('_at') || normalizedLabel.includes('datum');
}

function isCustomerTypeAuditField(fieldKey: string, label: string) {
  const normalizedKey = fieldKey.toLowerCase();
  const normalizedLabel = label.toLowerCase();
  return normalizedKey === 'customer_type' || normalizedKey === 'customerType'.toLowerCase() || normalizedLabel === 'tip naročnika';
}

function isProductTypeAuditField(fieldKey: string, label: string) {
  const normalizedKey = fieldKey.toLowerCase();
  const normalizedLabel = label.toLowerCase();
  return normalizedKey === 'producttype' || normalizedLabel === 'tip artikla';
}

function isStatusAuditField(fieldKey: string, label: string) {
  const normalizedKey = fieldKey.toLowerCase();
  const normalizedLabel = label.toLowerCase();
  return normalizedKey === 'status'
    || normalizedKey.endsWith('_status')
    || normalizedKey.endsWith('status')
    || normalizedLabel === 'status'
    || normalizedLabel.includes('status');
}

function isPaymentAuditField(fieldKey: string, label: string) {
  const normalizedKey = fieldKey.toLowerCase();
  const normalizedLabel = label.toLowerCase();
  return normalizedKey === 'payment_status'
    || normalizedKey === 'paymentstatus'
    || normalizedLabel.includes('plačil')
    || normalizedLabel.includes('placil');
}

function statusDisplayValue(value: string, entityType?: AuditEntityType) {
  const normalizedStatus = value.trim().toLowerCase();
  if (isOrderStatus(normalizedStatus)) return getOrderStatusLabel(normalizedStatus);
  if (isPaymentStatus(normalizedStatus)) return getPaymentLabel(normalizedStatus);

  const labels = STATUS_LABELS[normalizedStatus];
  return labels ? labels[entityType ?? 'default'] ?? labels.default ?? value : null;
}

function generalEnumDisplayValue(value: string) {
  return GENERAL_ENUM_VALUE_LABELS.get(value.trim().toLowerCase()) ?? null;
}

function productTypeDisplayValue(value: string) {
  return PRODUCT_TYPE_LABELS.get(value.trim().toLowerCase()) ?? null;
}

function displayValue(value: unknown, fieldKey = '', label = '', entityType?: AuditEntityType) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (isEmptyAuditDisplayToken(text)) return '';

  if (isProductTypeAuditField(fieldKey, label)) {
    return productTypeDisplayValue(text) ?? generalEnumDisplayValue(text) ?? text;
  }

  if (isStatusAuditField(fieldKey, label)) {
    return statusDisplayValue(text, entityType) ?? generalEnumDisplayValue(text) ?? text;
  }

  if (isPaymentAuditField(fieldKey, label)) {
    const normalizedPayment = text.trim().toLowerCase();
    return isPaymentStatus(normalizedPayment)
      ? getPaymentLabel(normalizedPayment)
      : generalEnumDisplayValue(text) ?? text;
  }

  if (isCustomerTypeAuditField(fieldKey, label)) {
    return CUSTOMER_TYPE_FORM_LABELS.get(text as typeof CUSTOMER_TYPE_FORM_OPTIONS[number]['value']) ?? text;
  }

  if (isDateAuditField(fieldKey, label)) {
    return formatSlovenianAuditDateTime(text) ?? text;
  }

  return generalEnumDisplayValue(text) ?? text;
}

function displayCollectionValue(value: AuditCollectionValue) {
  return typeof value === 'string'
    ? { text: value, href: null }
    : { text: value.label, href: value.href ?? null };
}

function displayCollectionValues(values: AuditCollectionValue[]) {
  const displayed = values.map(displayCollectionValue);
  return {
    text: displayed.map((value) => value.text).join(', '),
    href: displayed.length === 1 ? displayed[0]?.href ?? null : null
  };
}

function splitCategoryPath(value: string) {
  return value
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function formatCategoryPath(parentPath: string, categoryLabel: string) {
  const category = categoryLabel.trim();
  const segments = [...splitCategoryPath(parentPath), ...(category ? [category] : [])];
  if (segments.length === 0) return '';
  return `/${segments.join('/')}`;
}

function getCategoryMoveMarkers(beforeParentPath: string, afterParentPath: string) {
  const beforeDepth = splitCategoryPath(beforeParentPath).length;
  const afterDepth = splitCategoryPath(afterParentPath).length;

  if (beforeDepth > afterDepth) return { before: '[child]', after: '[parent]' };
  if (afterDepth > beforeDepth) return { before: '[parent]', after: '[child]' };
  return { before: '[cross-category]', after: '[cross-category]' };
}

function getScalarSideText(entry: AuditDiffEntry, side: 'before' | 'after') {
  if (side === 'before') {
    return 'before' in entry ? displayValue(entry.before, '', '', 'category') : '';
  }
  return 'after' in entry ? displayValue(entry.after, '', '', 'category') : '';
}

function categoryMoveRow(
  event: AuditEventRecord,
  collectionKey: string,
  updatedId: string,
  updatedLabel: string,
  changes: AuditDiff
): AuditChangeRow | null {
  if (event.entityType !== 'category' || event.action !== 'reordered') return null;
  const parentKey = Object.keys(changes).find((key) => CATEGORY_MOVE_PARENT_KEYS.has(key));
  if (!parentKey) return null;

  const parentEntry = changes[parentKey];
  const beforeParentPath = getScalarSideText(parentEntry, 'before');
  const afterParentPath = getScalarSideText(parentEntry, 'after');
  if (beforeParentPath.trim() === afterParentPath.trim()) return null;

  const markers = getCategoryMoveMarkers(beforeParentPath, afterParentPath);
  const beforePath = formatCategoryPath(beforeParentPath, updatedLabel);
  const afterPath = formatCategoryPath(afterParentPath, updatedLabel);

  return {
    id: `${event.id}:${collectionKey}:${updatedId}:categoryPath`,
    eventId: event.id,
    eventSummary: event.summary,
    eventOccurredAt: event.occurredAt,
    field: `${updatedLabel} / Lokacija kategorije`,
    before: `${beforePath} ${markers.before}`.trim(),
    after: `${afterPath} ${markers.after}`.trim(),
    action: event.action,
    redacted: false
  };
}

function countCategoryMoveEntries(event: AuditEventRecord) {
  if (event.entityType !== 'category' || event.action !== 'reordered') return 0;

  return Object.values(event.diff).reduce((count, entry) => {
    if (!('updated' in entry) || !entry.updated) return count;
    return count + entry.updated.filter((updated) =>
      Object.keys(updated.changes).some((key) => CATEGORY_MOVE_PARENT_KEYS.has(key))
    ).length;
  }, 0);
}

function formatCategoryMoveSummary(count: number) {
  return count === 1 ? 'Premaknjena kategorija' : `Premaknjenih kategorij: ${count}`;
}

function normalizeComparableValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s/g, '')
    .replace(',', '.')
    .replace(/[€%]/g, '');
}

function isDisplayedZero(value: string) {
  const normalized = normalizeComparableValue(value);
  if (!normalized || normalized === 'prazno' || normalized === '—') return false;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed === 0;
}

function isDisplayedEmpty(value: string) {
  return isEmptyAuditDisplayToken(value);
}

function shouldSuppressChange(fieldKey: string, label: string, before: string, after: string) {
  const normalizedKey = fieldKey.trim().toLowerCase();
  const normalizedLabel = label.trim().toLowerCase();
  if (DERIVED_CHANGE_KEYS.has(normalizedKey) || DERIVED_CHANGE_LABELS.has(normalizedLabel)) return true;
  if (normalizeComparableValue(before) === normalizeComparableValue(after)) return true;
  return (isDisplayedEmpty(before) && isDisplayedZero(after)) || (isDisplayedZero(before) && isDisplayedEmpty(after));
}

function scalarRow(event: AuditEventRecord, id: string, fieldKey: string, field: string, entry: AuditDiffEntry): AuditChangeRow | null {
  if (!('before' in entry) && !('after' in entry) && !entry.changed) return null;
  const redacted = Boolean(entry.redacted);
  const before = redacted ? entry.message ?? '[skrito]' : displayValue('before' in entry ? entry.before : null, fieldKey, field, event.entityType);
  const after = redacted ? entry.message ?? '[skrito]' : displayValue('after' in entry ? entry.after : null, fieldKey, field, event.entityType);
  if (shouldSuppressChange(fieldKey, field, before, after)) return null;
  return {
    id,
    eventId: event.id,
    eventSummary: event.summary,
    eventOccurredAt: event.occurredAt,
    field,
    before,
    after,
    beforeHref: 'beforeHref' in entry ? entry.beforeHref ?? null : null,
    afterHref: 'afterHref' in entry ? entry.afterHref ?? null : null,
    action: event.action,
    redacted
  };
}

function isScalarDiffEntry(entry: AuditDiffEntry | undefined): entry is AuditScalarDiff {
  if (!entry) return false;
  return !('added' in entry) && !('removed' in entry) && !('updated' in entry);
}

function normalizeProductTypeConcept(value: string) {
  const normalized = value.trim().toLowerCase();
  return CATALOG_ITEM_TYPE_PRODUCT_EQUIVALENTS.get(normalized) ?? normalized;
}

function getRawScalarSide(entry: AuditScalarDiff, side: 'before' | 'after') {
  const value = side === 'before' ? entry.before : entry.after;
  return value === null || value === undefined ? '' : String(value).trim().toLowerCase();
}

function findScalarDiffEntry(diff: AuditDiff, keys: string[]) {
  const entry = Object.entries(diff).find(([key, value]) => keys.includes(key.toLowerCase()) && isScalarDiffEntry(value));
  return entry?.[1] as AuditScalarDiff | undefined;
}

function shouldSuppressMirroredCatalogItemType(diff: AuditDiff) {
  const productTypeEntry = findScalarDiffEntry(diff, ['producttype', 'product_type']);
  const itemTypeEntry = findScalarDiffEntry(diff, ['itemtype', 'item_type']);
  if (!productTypeEntry || !itemTypeEntry) return false;

  const productBefore = normalizeProductTypeConcept(getRawScalarSide(productTypeEntry, 'before'));
  const productAfter = normalizeProductTypeConcept(getRawScalarSide(productTypeEntry, 'after'));
  const itemBefore = normalizeProductTypeConcept(getRawScalarSide(itemTypeEntry, 'before'));
  const itemAfter = normalizeProductTypeConcept(getRawScalarSide(itemTypeEntry, 'after'));

  return Boolean(productBefore || productAfter || itemBefore || itemAfter)
    && productBefore === itemBefore
    && productAfter === itemAfter;
}

function isCatalogItemTypeKey(key: string) {
  const normalized = key.toLowerCase();
  return normalized === 'itemtype' || normalized === 'item_type';
}

export function flattenAuditEventChanges(event: AuditEventRecord): AuditChangeRow[] {
  const rows: AuditChangeRow[] = [];
  if (event.action === 'created') return rows;
  const suppressMirroredCatalogType = shouldSuppressMirroredCatalogItemType(event.diff);

  Object.entries(event.diff).forEach(([key, entry]) => {
    if (suppressMirroredCatalogType && isCatalogItemTypeKey(key)) return;
    const label = entry.label || key;

    if ('added' in entry || 'removed' in entry || 'updated' in entry) {
      if (entry.added?.length) {
        const afterValue = displayCollectionValues(entry.added);
        rows.push({
          id: `${event.id}:${key}:added`,
          eventId: event.id,
          eventSummary: event.summary,
          eventOccurredAt: event.occurredAt,
          field: `${label}: dodano`,
          before: '',
          after: afterValue.text,
          afterHref: afterValue.href,
          action: event.action,
          redacted: Boolean(entry.redacted)
        });
      }
      if (entry.removed?.length) {
        const beforeValue = displayCollectionValues(entry.removed);
        const after = 'Odstranjeno';
        rows.push({
          id: `${event.id}:${key}:removed`,
          eventId: event.id,
          eventSummary: event.summary,
          eventOccurredAt: event.occurredAt,
          field: `${label}: odstranjeno`,
          before: beforeValue.text,
          beforeHref: beforeValue.href,
          after,
          action: event.action,
          redacted: Boolean(entry.redacted)
        });
      }

      entry.updated?.forEach((updated) => {
        const updatedLabel = displayCollectionValue(updated.label ?? updated.id).text;
        const moveRow = categoryMoveRow(event, key, updated.id, updatedLabel, updated.changes);
        if (moveRow) rows.push(moveRow);

        Object.entries(updated.changes).forEach(([nestedKey, nestedEntry]) => {
          if (moveRow && CATEGORY_MOVE_SUPPRESSED_KEYS.has(nestedKey)) return;
          const nestedLabel = nestedEntry.label || nestedKey;
          const collectionLabel = key === 'categories' || label.toLowerCase() === 'kategorije'
            ? updatedLabel
            : `${label} / ${updatedLabel}`;
          const row = scalarRow(
            event,
            `${event.id}:${key}:${updated.id}:${nestedKey}`,
            nestedKey,
            `${collectionLabel} / ${nestedLabel}`,
            nestedEntry
          );
          if (row) rows.push(row);
        });
      });
      return;
    }

    const row = scalarRow(event, `${event.id}:${key}`, key, label, entry);
    if (row) rows.push(row);
  });

  return rows;
}

function chooseGroupAction(events: AuditEventRecord[]) {
  const displayActions = new Set(events.map((event) => getAuditDisplayAction(event.action)));
  if (displayActions.size === 1) return events[0]?.action ?? 'updated';
  if (displayActions.has('updated')) return 'updated';
  if (displayActions.has('removed')) return 'removed';
  if (displayActions.has('restored')) return 'restored';
  if (displayActions.has('archived')) return 'archived';
  return 'created';
}

function groupSummary(events: AuditEventRecord[], changeCount: number) {
  const first = events[0];
  const label = first?.entityLabel || first?.entityId || 'Objekt';
  const movedCategoryCount = events.reduce((count, event) => count + countCategoryMoveEntries(event), 0);
  if (movedCategoryCount > 0) return formatCategoryMoveSummary(movedCategoryCount);
  if (events.length === 1) return first.summary;
  if (events.every((event) => event.entityType === 'category' && event.action === 'reordered')) {
    const changedCount = new Set(events.map((event) => event.entityId)).size;
    if (changedCount === 1) return 'Spremenjen vrstni red: 1 kategorija';
    if (changedCount === 2) return 'Spremenjen vrstni red: 2 kategoriji';
    if (changedCount === 3 || changedCount === 4) return `Spremenjen vrstni red: ${changedCount} kategorije`;
    return `Spremenjen vrstni red: ${changedCount} kategorij`;
  }
  const suffix = changeCount === 1 ? 'sprememba' : changeCount === 2 ? 'spremembi' : 'sprememb';
  return `${label}: ${changeCount} ${suffix}`;
}

function groupEntityIdentity(events: AuditEventRecord[]) {
  const first = events[0];
  if (!first) {
    return {
      entityId: '',
      entityLabel: null as string | null
    };
  }

  const entityIds = new Set(events.map((event) => event.entityId));
  if (entityIds.size > 1 && events.every((event) => event.entityType === 'category' && event.action === 'reordered')) {
    return {
      entityId: 'catalog_categories',
      entityLabel: 'Kategorije'
    };
  }

  return {
    entityId: first.entityId,
    entityLabel: first.entityLabel
  };
}

function makeGroup(events: AuditEventRecord[]): AuditEventGroup {
  const ordered = [...events].sort((a, b) => parseTime(b.occurredAt) - parseTime(a.occurredAt));
  const first = ordered[0];
  const prefixCategoryChangeFields = ordered.length > 1
    && ordered.every((event) => event.entityType === 'category' && event.action === 'reordered');
  const changes = ordered.flatMap((event) => {
    const eventChanges = flattenAuditEventChanges(event);
    if (!prefixCategoryChangeFields) return eventChanges;
    const label = event.entityLabel || event.entityId;
    return eventChanges.map((change) => ({
      ...change,
      field: `${label} / ${change.field}`
    }));
  });
  const action = chooseGroupAction(ordered);
  const identity = groupEntityIdentity(ordered);
  return {
    id: ordered.map((event) => event.id).join(':'),
    events: ordered,
    changes,
    occurredAt: first.occurredAt,
    actorId: first.actorId,
    actorName: first.actorName,
    actorEmail: first.actorEmail,
    entityType: first.entityType,
    entityId: identity.entityId,
    entityLabel: identity.entityLabel,
    action,
    actionLabel: getAuditDisplayActionLabel(action),
    summary: groupSummary(ordered, changes.length || ordered.length)
  };
}

export function groupAuditEvents(events: AuditEventRecord[], windowMs = 10000): AuditEventGroup[] {
  const sorted = [...events].sort((a, b) => parseTime(b.occurredAt) - parseTime(a.occurredAt));
  const groups: AuditEventRecord[][] = [];

  for (const event of sorted) {
    const lastGroup = groups[groups.length - 1];
    const lastEvent = lastGroup?.[lastGroup.length - 1];
    if (lastGroup && lastEvent && sameAuditMoment(event, lastEvent, windowMs)) {
      lastGroup.push(event);
      continue;
    }
    groups.push([event]);
  }

  return groups.map(makeGroup);
}
