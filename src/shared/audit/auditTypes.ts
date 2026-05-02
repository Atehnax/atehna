export const AUDIT_ENTITY_TYPES = ['item', 'order', 'category', 'media', 'system'] as const;
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

export const AUDIT_ACTIONS = [
  'created',
  'updated',
  'deleted',
  'archived',
  'restored',
  'uploaded',
  'removed',
  'status_changed',
  'reordered',
  'price_changed',
  'stock_changed'
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditScalarDiff = {
  label: string;
  before?: string | null;
  after?: string | null;
  beforeHref?: string | null;
  afterHref?: string | null;
  changed?: boolean;
  redacted?: boolean;
  message?: string;
};

export type AuditCollectionUpdatedEntry = {
  id: string;
  label?: string | AuditLinkedValue;
  changes: AuditDiff;
};

export type AuditLinkedValue = {
  label: string;
  href?: string | null;
};

export type AuditCollectionValue = string | AuditLinkedValue;

export type AuditCollectionDiff = {
  label: string;
  added?: AuditCollectionValue[];
  removed?: AuditCollectionValue[];
  updated?: AuditCollectionUpdatedEntry[];
  changed?: boolean;
  redacted?: boolean;
  message?: string;
};

export type AuditDiffEntry = AuditScalarDiff | AuditCollectionDiff;
export type AuditDiff = Record<string, AuditDiffEntry>;

export type AuditActor = {
  actor_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
};

export type AuditMetadata = Record<string, unknown>;

export type AuditEventInput = {
  occurredAt?: Date;
  actor?: AuditActor;
  actor_id?: string | null;
  actor_name?: string | null;
  actor_email?: string | null;
  entityType: AuditEntityType;
  entityId: string;
  entityLabel?: string | null;
  action: AuditAction;
  summary?: string;
  diff?: AuditDiff;
  metadata?: AuditMetadata;
  requestId?: string | null;
  source?: string;
  ipHash?: string | null;
  userAgentHash?: string | null;
  retentionUntil?: Date | null;
};

export type AuditEventRecord = {
  id: string;
  occurredAt: string;
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  entityType: AuditEntityType;
  entityId: string;
  entityLabel: string | null;
  action: AuditAction;
  summary: string;
  diff: AuditDiff;
  metadata: AuditMetadata;
  requestId: string | null;
  source: string;
  retentionUntil: string | null;
  createdAt: string;
};

export type AuditEventFilters = {
  q?: string;
  entityType?: AuditEntityType;
  entityId?: string;
  entityQuery?: string;
  action?: AuditAction | AuditAction[];
  actorId?: string;
  dateFrom?: string;
  dateTo?: string;
  deletionFrom?: string;
  deletionTo?: string;
  page?: number;
  pageSize?: number;
};

export type AuditEventListResult = {
  events: AuditEventRecord[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};
