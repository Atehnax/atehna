import type { AuditDiff, AuditDiffEntry, AuditEntityType } from './auditTypes';

const ORDER_SENSITIVE_FIELDS = new Set([
  'phone',
  'billing_address',
  'address',
  'personal_note'
]);

const GENERIC_SENSITIVE_FIELD_PATTERNS = [/phone/i, /address/i, /objectUrl/i, /previewUrl/i, /tempUploadId/i, /localPreview/i];
const TECHNICAL_SENSITIVE_FIELD_PATTERNS = [/objectUrl/i, /previewUrl/i, /tempUploadId/i, /localPreview/i];

export const REDACTED_SHORT_VALUE = '[skrito]';
export const REDACTED_LONG_VALUE = 'Vrednost skrita zaradi osebnih podatkov';

export function isAuditFieldSensitive(entityType: AuditEntityType, fieldKey: string) {
  if (entityType === 'order') {
    return ORDER_SENSITIVE_FIELDS.has(fieldKey) || TECHNICAL_SENSITIVE_FIELD_PATTERNS.some((pattern) => pattern.test(fieldKey));
  }
  return GENERIC_SENSITIVE_FIELD_PATTERNS.some((pattern) => pattern.test(fieldKey));
}

export function createRedactedAuditEntry(label: string): AuditDiffEntry {
  return {
    label,
    before: REDACTED_SHORT_VALUE,
    after: REDACTED_SHORT_VALUE,
    changed: true,
    redacted: true,
    message: REDACTED_LONG_VALUE
  };
}

export function redactAuditDiff(entityType: AuditEntityType, diff: AuditDiff): AuditDiff {
  return Object.fromEntries(
    Object.entries(diff).map(([fieldKey, entry]) => {
      if (isAuditFieldSensitive(entityType, fieldKey)) {
        return [fieldKey, createRedactedAuditEntry(entry.label)];
      }

      const nestedUpdated = 'updated' in entry && Array.isArray(entry.updated)
        ? entry.updated.map((updatedEntry) => ({
            ...updatedEntry,
            changes: redactAuditDiff(entityType, updatedEntry.changes)
          }))
        : undefined;

      return [
        fieldKey,
        nestedUpdated
          ? {
              ...entry,
              updated: nestedUpdated
            }
          : entry
      ];
    })
  );
}
