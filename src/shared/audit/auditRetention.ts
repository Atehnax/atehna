import type { AuditEntityType, AuditMetadata } from './auditTypes';

export function isDurableOrderAudit(entityType: AuditEntityType, metadata?: AuditMetadata) {
  return entityType === 'order' || (entityType === 'media' && metadata?.item_type === 'pdf');
}

export function getAuditRetentionUntil(entityType: AuditEntityType, occurredAt: Date | string = new Date(), metadata?: AuditMetadata) {
  const base = occurredAt instanceof Date ? occurredAt : new Date(occurredAt);
  const retention = Number.isNaN(base.getTime()) ? new Date() : new Date(base);

  // Order history remains available for archived and recoverable deleted orders.
  if (isDurableOrderAudit(entityType, metadata)) return null;

  retention.setUTCFullYear(retention.getUTCFullYear() + 3);
  return retention;
}
