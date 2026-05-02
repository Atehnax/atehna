import { getAuditFieldLabel } from './auditLabels';
import { createRedactedAuditEntry, isAuditFieldSensitive, redactAuditDiff } from './auditRedaction';
import type { AuditAction, AuditCollectionValue, AuditDiff, AuditEntityType } from './auditTypes';
import { formatEuro, formatSlNumber } from '../domain/formatting';
import { CUSTOMER_TYPE_FORM_OPTIONS } from '../domain/order/customerType';

const IGNORED_FIELDS = new Set([
  'updatedAt',
  'updated_at',
  'lastViewedAt',
  'diagnostics',
  'objectUrl',
  'previewUrl',
  'tempUploadId',
  'localPreview',
  'machineSerialOrderMatches'
]);

const CUSTOMER_TYPE_FORM_LABELS = new Map(
  CUSTOMER_TYPE_FORM_OPTIONS.map((option) => [option.value, option.label])
);
const slovenianDateTimeFormatter = new Intl.DateTimeFormat('sl-SI', {
  timeZone: 'Europe/Ljubljana',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});

type DiffOptions = {
  entityType?: AuditEntityType;
  fields?: string[];
  ignoreFields?: string[];
  labels?: Record<string, string>;
  redactedFields?: string[];
};

type CollectionDiffOptions<T> = {
  label: string;
  before: T[];
  after: T[];
  getId: (item: T, index: number) => string;
  getLabel: (item: T, index: number) => AuditCollectionValue;
  fields: string[];
  entityType?: AuditEntityType;
  labels?: Record<string, string>;
  maxUpdated?: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function normalizeValue(value: unknown): unknown {
  if (value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

function valuesEqual(left: unknown, right: unknown) {
  return stableStringify(normalizeValue(left)) === stableStringify(normalizeValue(right));
}

function isEmptyAuditValue(value: unknown) {
  return value === null || value === undefined || value === '';
}

function isZeroAuditValue(value: unknown) {
  if (typeof value === 'number') return value === 0;
  if (typeof value !== 'string') return false;
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return false;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed === 0;
}

function isEmptyZeroNormalizationChange(left: unknown, right: unknown) {
  return (isEmptyAuditValue(left) && isZeroAuditValue(right)) || (isZeroAuditValue(left) && isEmptyAuditValue(right));
}

function normalizeFieldList(before: Record<string, unknown>, after: Record<string, unknown>, options: DiffOptions) {
  const ignored = new Set([...IGNORED_FIELDS, ...(options.ignoreFields ?? [])]);
  return options.fields ?? Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))
    .filter((field) => !ignored.has(field));
}

function formatArrayValue(value: unknown[]) {
  if (value.length === 0) return '';
  if (value.length <= 5 && value.every((entry) => typeof entry !== 'object' || entry === null)) {
    return value.map((entry) => formatAuditValue(entry)).join(', ');
  }
  return `${value.length} vnosov`;
}

function formatSlovenianAuditDateTime(value: string) {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}(?:[tT]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.test(trimmed)) return null;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;

  const parts = slovenianDateTimeFormatter.formatToParts(parsed);
  const day = parts.find((part) => part.type === 'day')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const year = parts.find((part) => part.type === 'year')?.value;
  const hour = parts.find((part) => part.type === 'hour')?.value;
  const minute = parts.find((part) => part.type === 'minute')?.value;
  if (!day || !month || !year || !hour || !minute) return null;

  return `${day}.${month}.${year} ${hour}.${minute}`;
}

function isDateAuditField(fieldKey: string) {
  const normalizedKey = fieldKey.toLowerCase();
  return normalizedKey.includes('date') || normalizedKey.endsWith('_at');
}

function isCustomerTypeAuditField(fieldKey: string) {
  const normalizedKey = fieldKey.toLowerCase();
  return normalizedKey === 'customer_type' || normalizedKey === 'customertype';
}

export function formatAuditValue(value: unknown, fieldKey = ''): string {
  const normalized = normalizeValue(value);
  if (normalized === null || normalized === undefined || normalized === '') return '';
  if (typeof normalized === 'boolean') return normalized ? 'Da' : 'Ne';
  if (typeof normalized === 'number') {
    const lowerKey = fieldKey.toLowerCase();
    if (lowerKey.includes('price') || lowerKey.includes('total') || lowerKey.includes('tax') || lowerKey.includes('shipping') || lowerKey.includes('subtotal')) {
      return formatEuro(normalized);
    }
    return formatSlNumber(normalized);
  }
  if (Array.isArray(normalized)) return formatArrayValue(normalized);
  if (isRecord(normalized)) return 'spremenjen zapis';
  if (typeof normalized === 'string') {
    if (isCustomerTypeAuditField(fieldKey)) {
      return CUSTOMER_TYPE_FORM_LABELS.get(normalized as typeof CUSTOMER_TYPE_FORM_OPTIONS[number]['value']) ?? normalized;
    }

    if (isDateAuditField(fieldKey)) {
      return formatSlovenianAuditDateTime(normalized) ?? normalized;
    }
  }
  return String(normalized);
}

export function computeObjectDiff(
  beforeRaw: Record<string, unknown> | null | undefined,
  afterRaw: Record<string, unknown> | null | undefined,
  options: DiffOptions = {}
): AuditDiff {
  const before = beforeRaw ?? {};
  const after = afterRaw ?? {};
  const labels = options.labels ?? {};
  const redactedFields = new Set(options.redactedFields ?? []);
  const diff: AuditDiff = {};

  for (const field of normalizeFieldList(before, after, options)) {
    const beforeValue = before[field];
    const afterValue = after[field];
    if (valuesEqual(beforeValue, afterValue)) continue;
    if (isEmptyZeroNormalizationChange(beforeValue, afterValue)) continue;

    const label = labels[field] ?? getAuditFieldLabel(field);
    if (redactedFields.has(field) || (options.entityType && isAuditFieldSensitive(options.entityType, field))) {
      diff[field] = createRedactedAuditEntry(label);
      continue;
    }

    diff[field] = {
      label,
      before: formatAuditValue(beforeValue, field),
      after: formatAuditValue(afterValue, field)
    };
  }

  return options.entityType ? redactAuditDiff(options.entityType, diff) : diff;
}

export function computeCollectionDiff<T extends Record<string, unknown>>(options: CollectionDiffOptions<T>) {
  const beforeById = new Map(options.before.map((item, index) => [options.getId(item, index), { item, index }]));
  const afterById = new Map(options.after.map((item, index) => [options.getId(item, index), { item, index }]));
  const added = options.after
    .map((item, index) => ({ item, index, id: options.getId(item, index) }))
    .filter(({ id }) => !beforeById.has(id))
    .map(({ item, index }) => options.getLabel(item, index));
  const removed = options.before
    .map((item, index) => ({ item, index, id: options.getId(item, index) }))
    .filter(({ id }) => !afterById.has(id))
    .map(({ item, index }) => options.getLabel(item, index));
  const updated = Array.from(beforeById.entries())
    .flatMap(([id, beforeEntry]) => {
      const afterEntry = afterById.get(id);
      if (!afterEntry) return [];
      const changes = computeObjectDiff(beforeEntry.item, afterEntry.item, {
        fields: options.fields,
        entityType: options.entityType,
        labels: options.labels
      });
      if (Object.keys(changes).length === 0) return [];
      return [{
        id,
        label: options.getLabel(afterEntry.item, afterEntry.index),
        changes
      }];
    })
    .slice(0, options.maxUpdated ?? 25);

  if (added.length === 0 && removed.length === 0 && updated.length === 0) return null;
  return {
    label: options.label,
    ...(added.length > 0 ? { added } : {}),
    ...(removed.length > 0 ? { removed } : {}),
    ...(updated.length > 0 ? { updated } : {})
  };
}

export function diffHasEntries(diff: AuditDiff | null | undefined): diff is AuditDiff {
  return Boolean(diff && Object.keys(diff).length > 0);
}

export function countAuditChangedFields(diff: AuditDiff | null | undefined): number {
  if (!diff) return 0;
  return Object.values(diff).reduce((count, entry) => {
    const nestedCount = 'updated' in entry && Array.isArray(entry.updated)
      ? entry.updated.reduce((nestedTotal, nested) => nestedTotal + countAuditChangedFields(nested.changes), 0)
      : 0;
    const collectionCount = ('added' in entry && entry.added ? entry.added.length : 0) +
      ('removed' in entry && entry.removed ? entry.removed.length : 0);
    return count + 1 + nestedCount + collectionCount;
  }, 0);
}

const variantFields = [
  'variantName',
  'variantSku',
  'length',
  'width',
  'thickness',
  'weight',
  'errorTolerance',
  'price',
  'discountPct',
  'inventory',
  'minOrder',
  'unit',
  'status',
  'badge',
  'position'
];

function variantId(item: Record<string, unknown>, index: number) {
  return String(item.variantSku || item.id || item.variantName || `variant-${index}`);
}

function variantLabel(item: Record<string, unknown>, index: number) {
  return String(item.variantSku || item.variantName || item.id || `Razlicica ${index + 1}`);
}

function mediaId(item: Record<string, unknown>, index: number) {
  return String(item.blobPathname || item.blobUrl || item.externalUrl || item.filename || `media-${index}`);
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function filenameFromUrl(value: unknown) {
  const raw = stringValue(value);
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    const segment = parsed.pathname.split('/').filter(Boolean).pop();
    return segment ? decodeURIComponent(segment) : null;
  } catch {
    const segment = raw.split('/').filter(Boolean).pop();
    return segment ?? null;
  }
}

function mediaLabel(item: Record<string, unknown>, index: number): AuditCollectionValue {
  const href = stringValue(item.blobUrl) ?? stringValue(item.externalUrl);
  const label =
    stringValue(item.filename)
    ?? filenameFromUrl(item.blobPathname)
    ?? filenameFromUrl(item.blobUrl)
    ?? filenameFromUrl(item.externalUrl)
    ?? `Medij ${index + 1}`;
  return href ? { label, href } : label;
}

function normalizedDiscountIdentityValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (Array.isArray(value)) return value.map(normalizedDiscountIdentityValue).join(',');
  return String(value).trim();
}

function discountId(item: Record<string, unknown>, index: number) {
  return [
    normalizedDiscountIdentityValue(item.minQuantity),
    normalizedDiscountIdentityValue(item.appliesTo ?? 'allVariants'),
    normalizedDiscountIdentityValue(item.position ?? index)
  ].join('|');
}

function discountLabel(item: Record<string, unknown>, index: number) {
  return `${formatAuditValue(item.minQuantity)} / ${formatAuditValue(item.discountPercent)} % (${index + 1})`;
}

export function computeCatalogItemAuditDiff(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined
): AuditDiff {
  const baseDiff = computeObjectDiff(before, after, {
    entityType: 'item',
    fields: [
      'itemName',
      'productType',
      'itemType',
      'status',
      'categoryPath',
      'sku',
      'slug',
      'unit',
      'brand',
      'material',
      'colour',
      'shape',
      'description',
      'adminNotes',
      'badge',
      'position',
      'typeSpecificData'
    ],
    ignoreFields: ['variants', 'quantityDiscounts', 'media']
  });

  const beforeVariants = Array.isArray(before?.variants) ? before.variants as Record<string, unknown>[] : [];
  const afterVariants = Array.isArray(after?.variants) ? after.variants as Record<string, unknown>[] : [];
  const variantDiff = computeCollectionDiff({
    label: getAuditFieldLabel('variants'),
    before: beforeVariants,
    after: afterVariants,
    getId: variantId,
    getLabel: variantLabel,
    fields: variantFields,
    entityType: 'item'
  });
  if (variantDiff) baseDiff.variants = variantDiff;

  const beforeDiscounts = Array.isArray(before?.quantityDiscounts) ? before.quantityDiscounts as Record<string, unknown>[] : [];
  const afterDiscounts = Array.isArray(after?.quantityDiscounts) ? after.quantityDiscounts as Record<string, unknown>[] : [];
  const discountDiff = computeCollectionDiff({
    label: getAuditFieldLabel('quantityDiscounts'),
    before: beforeDiscounts,
    after: afterDiscounts,
    getId: discountId,
    getLabel: discountLabel,
    fields: ['minQuantity', 'discountPercent', 'appliesTo', 'note', 'position'],
    entityType: 'item'
  });
  if (discountDiff) baseDiff.quantityDiscounts = discountDiff;

  const beforeMedia = Array.isArray(before?.media) ? before.media as Record<string, unknown>[] : [];
  const afterMedia = Array.isArray(after?.media) ? after.media as Record<string, unknown>[] : [];
  const mediaDiff = computeCollectionDiff({
    label: getAuditFieldLabel('media'),
    before: beforeMedia,
    after: afterMedia,
    getId: mediaId,
    getLabel: mediaLabel,
    fields: ['mediaKind', 'role', 'sourceKind', 'filename', 'blobPathname', 'externalUrl', 'mimeType', 'altText', 'hidden', 'position'],
    entityType: 'item'
  });
  if (mediaDiff) baseDiff.media = mediaDiff;

  return baseDiff;
}

export function inferCatalogItemAuditAction(diff: AuditDiff, fallback: AuditAction = 'updated'): AuditAction {
  const keys = Object.keys(diff);
  if (keys.length === 0) return fallback;
  const serialized = JSON.stringify(diff);
  const hasPrice = /"price"|"unitPrice"|"discountPct"|"priceGross"|"priceNet"/.test(serialized);
  const hasStock = /"inventory"|"stock"/.test(serialized);
  const hasOnlyMedia = keys.length === 1 && keys[0] === 'media';
  if (hasOnlyMedia) {
    const media = diff.media;
    if ('added' in media && media.added && media.added.length > 0 && !('removed' in media)) return 'uploaded';
    if ('removed' in media && media.removed && media.removed.length > 0 && !('added' in media)) return 'removed';
  }
  if (hasStock && !hasPrice) return 'stock_changed';
  if (hasPrice && !hasStock) return 'price_changed';
  return fallback;
}

export function computeOrderLineItemsDiff(
  before: Array<Record<string, unknown>>,
  after: Array<Record<string, unknown>>
) {
  return computeCollectionDiff({
    label: getAuditFieldLabel('items'),
    before,
    after,
    getId: (item, index) => String(item.id || item.sku || item.name || `item-${index}`),
    getLabel: (item, index) => String(item.sku || item.name || `Postavka ${index + 1}`),
    fields: ['sku', 'name', 'unit', 'quantity', 'unitPrice', 'unit_price', 'discountPercentage', 'discount_percentage'],
    entityType: 'order'
  });
}

export function summarizeDiffKeys(diff: AuditDiff) {
  return Object.values(diff).map((entry) => entry.label).join(', ');
}
