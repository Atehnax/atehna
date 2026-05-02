import type { AuditEntityType } from './auditTypes';

export function getAuditRetentionUntil(entityType: AuditEntityType, occurredAt: Date | string = new Date()) {
  const base = occurredAt instanceof Date ? occurredAt : new Date(occurredAt);
  const retention = Number.isNaN(base.getTime()) ? new Date() : new Date(base);

  if (entityType === 'order') {
    retention.setUTCMonth(retention.getUTCMonth() + 2);
    return retention;
  }

  retention.setUTCFullYear(retention.getUTCFullYear() + 3);
  return retention;
}
