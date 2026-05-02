import 'server-only';

import { createHash, randomUUID } from 'node:crypto';
import type { QueryResult } from 'pg';
import { getPool } from '@/shared/server/db';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, type AuditAction, type AuditActor, type AuditCollectionDiff, type AuditDiff, type AuditDiffEntry, type AuditEntityType, type AuditEventFilters, type AuditEventInput, type AuditEventListResult, type AuditEventRecord, type AuditMetadata } from '@/shared/audit/auditTypes';
import { AUDIT_ACTION_LABELS } from '@/shared/audit/auditLabels';
import { getAuditRetentionUntil } from '@/shared/audit/auditRetention';

type Queryable = {
  query: (sql: string, params?: unknown[]) => Promise<QueryResult<Record<string, unknown>>>;
};

const ADMIN_SESSION_COOKIE = 'atehna_admin_session';
const MAX_PAGE_SIZE = 100;
const AUDIT_SETTINGS_KEY = 'global';
const AUDIT_RETENTION_SQL = `(
  case
    when entity_type = 'order' then occurred_at + interval '2 months'
    when entity_type in ('item', 'category', 'media', 'system') then occurred_at + interval '3 years'
    else retention_until
  end
)`;

function expectedToken(username: string, password: string) {
  return Buffer.from(`${username}:${password}`).toString('base64');
}

function parseCookies(cookieHeader: string | null) {
  const cookies = new Map<string, string>();
  if (!cookieHeader) return cookies;
  for (const part of cookieHeader.split(';')) {
    const [rawName, ...rawValueParts] = part.trim().split('=');
    if (!rawName) continue;
    cookies.set(rawName, decodeURIComponent(rawValueParts.join('=')));
  }
  return cookies;
}

function hashRequestValue(value: string | null) {
  const normalized = value?.trim();
  if (!normalized) return null;
  const salt = process.env.AUDIT_HASH_SALT ?? process.env.ADMIN_PASSWORD ?? 'atehna-audit';
  return createHash('sha256').update(`${salt}:${normalized}`).digest('hex');
}

function headerFirst(request: Request, names: string[]) {
  for (const name of names) {
    const value = request.headers.get(name);
    if (value?.trim()) return value.trim();
  }
  return null;
}

function getClientIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || headerFirst(request, ['x-real-ip', 'cf-connecting-ip', 'true-client-ip']);
}

function toDateOrNull(value: unknown) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizeJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
  return {};
}

function normalizeDiff(value: unknown): AuditDiff {
  return normalizeJsonObject(value) as AuditDiff;
}

const AUDIT_EVENT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeAuditEventIds(ids: string[]) {
  return Array.from(new Set(
    ids
      .map((id) => id.trim())
      .filter((id) => AUDIT_EVENT_ID_PATTERN.test(id))
  ));
}

export function getAuditEventIdFromChangeId(changeId: string) {
  const normalized = changeId.trim();
  const separatorIndex = normalized.indexOf(':');
  const eventId = separatorIndex === -1 ? normalized : normalized.slice(0, separatorIndex);
  return AUDIT_EVENT_ID_PATTERN.test(eventId) ? eventId : null;
}

function isCollectionDiff(entry: AuditDiffEntry): entry is AuditCollectionDiff {
  return 'added' in entry || 'removed' in entry || 'updated' in entry;
}

function isEmptyCollectionDiff(entry: AuditCollectionDiff) {
  return (!entry.added || entry.added.length === 0)
    && (!entry.removed || entry.removed.length === 0)
    && (!entry.updated || entry.updated.length === 0)
    && !entry.changed;
}

function removeAuditChangeFromDiff(diff: AuditDiff, eventId: string, changeId: string) {
  if (!changeId.startsWith(`${eventId}:`)) return false;
  const parts = changeId.slice(eventId.length + 1).split(':');
  const key = parts.shift();
  if (!key) return false;

  const entry = diff[key];
  if (!entry) return false;

  if (parts.length === 0) {
    delete diff[key];
    return true;
  }

  if (!isCollectionDiff(entry)) return false;

  if (parts[0] === 'removed') {
    if (!entry.removed?.length) return false;
    delete entry.removed;
    if (isEmptyCollectionDiff(entry)) delete diff[key];
    return true;
  }

  const updatedId = parts[0];
  const nestedKey = parts[1];
  if (!updatedId || !nestedKey || !entry.updated?.length) return false;

  const updatedEntry = entry.updated.find((candidate) => candidate.id === updatedId);
  if (!updatedEntry?.changes?.[nestedKey]) return false;

  delete updatedEntry.changes[nestedKey];
  entry.updated = entry.updated.filter((candidate) => Object.keys(candidate.changes).length > 0);
  if (entry.updated.length === 0) delete entry.updated;
  if (isEmptyCollectionDiff(entry)) delete diff[key];
  return true;
}

function mapAuditRow(row: Record<string, unknown>): AuditEventRecord {
  return {
    id: String(row.id),
    occurredAt: toDateOrNull(row.occurred_at) ?? new Date().toISOString(),
    actorId: row.actor_id === null || row.actor_id === undefined ? null : String(row.actor_id),
    actorName: row.actor_name === null || row.actor_name === undefined ? null : String(row.actor_name),
    actorEmail: row.actor_email === null || row.actor_email === undefined ? null : String(row.actor_email),
    entityType: String(row.entity_type) as AuditEntityType,
    entityId: String(row.entity_id),
    entityLabel: row.entity_label === null || row.entity_label === undefined ? null : String(row.entity_label),
    action: String(row.action) as AuditAction,
    summary: String(row.summary ?? ''),
    diff: normalizeDiff(row.diff_json),
    metadata: normalizeJsonObject(row.metadata_json),
    requestId: row.request_id === null || row.request_id === undefined ? null : String(row.request_id),
    source: String(row.source ?? 'admin'),
    retentionUntil: toDateOrNull(row.retention_until),
    createdAt: toDateOrNull(row.created_at) ?? new Date().toISOString()
  };
}

export async function ensureAuditEventsTable(db?: Queryable) {
  const target = db ?? await getPool();
  await target.query('create extension if not exists pgcrypto');
  await target.query(`
    create table if not exists audit_events (
      id uuid primary key default gen_random_uuid(),
      occurred_at timestamptz not null default now(),
      actor_id text,
      actor_name text,
      actor_email text,
      entity_type text not null,
      entity_id text not null,
      entity_label text,
      action text not null,
      summary text not null,
      diff_json jsonb not null default '{}'::jsonb,
      metadata_json jsonb not null default '{}'::jsonb,
      request_id text,
      source text not null default 'admin',
      ip_hash text,
      user_agent_hash text,
      retention_until timestamptz,
      created_at timestamptz not null default now(),
      constraint audit_events_entity_type_check check (
        entity_type in ('item', 'order', 'category', 'media', 'system')
      ),
      constraint audit_events_action_check check (
        action in (
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
        )
      )
    )
  `);
  await target.query('create index if not exists audit_events_entity_idx on audit_events (entity_type, entity_id, occurred_at desc)');
  await target.query('create index if not exists audit_events_occurred_at_idx on audit_events (occurred_at desc)');
  await target.query('create index if not exists audit_events_actor_idx on audit_events (actor_id, occurred_at desc)');
  await target.query('create index if not exists audit_events_action_idx on audit_events (action, occurred_at desc)');
  await target.query('create index if not exists audit_events_retention_idx on audit_events (retention_until) where retention_until is not null');
}

export async function ensureAuditSettingsTable(db?: Queryable) {
  const target = db ?? await getPool();
  await target.query(`
    create table if not exists audit_settings (
      key text primary key,
      is_enabled boolean not null default true,
      updated_at timestamptz not null default now()
    )
  `);
}

export async function fetchAuditLoggingSettings(db?: Queryable) {
  const target = db ?? await getPool();
  await ensureAuditSettingsTable(target);
  const result = await target.query(
    'select is_enabled, updated_at from audit_settings where key = $1 limit 1',
    [AUDIT_SETTINGS_KEY]
  );
  if (!result.rows[0]) {
    const inserted = await target.query(
      `insert into audit_settings (key, is_enabled, updated_at)
       values ($1, true, now())
       on conflict (key) do update set is_enabled = audit_settings.is_enabled
       returning is_enabled, updated_at`,
      [AUDIT_SETTINGS_KEY]
    );
    return {
      enabled: inserted.rows[0]?.is_enabled !== false,
      updatedAt: toDateOrNull(inserted.rows[0]?.updated_at)
    };
  }

  return {
    enabled: result.rows[0].is_enabled !== false,
    updatedAt: toDateOrNull(result.rows[0].updated_at)
  };
}

export async function updateAuditLoggingSettings(enabled: boolean, db?: Queryable) {
  const target = db ?? await getPool();
  await ensureAuditSettingsTable(target);
  const result = await target.query(
    `insert into audit_settings (key, is_enabled, updated_at)
     values ($1, $2, now())
     on conflict (key)
     do update set is_enabled = excluded.is_enabled, updated_at = now()
     returning is_enabled, updated_at`,
    [AUDIT_SETTINGS_KEY, enabled]
  );
  return {
    enabled: result.rows[0]?.is_enabled !== false,
    updatedAt: toDateOrNull(result.rows[0]?.updated_at)
  };
}

export async function isAuditLoggingEnabled(db?: Queryable) {
  const settings = await fetchAuditLoggingSettings(db);
  return settings.enabled;
}

export async function getAuditActor(request: Request): Promise<AuditActor> {
  const username = process.env.ADMIN_USERNAME ?? 'admin';
  const password = process.env.ADMIN_PASSWORD ?? 'admin';
  const cookieValue = parseCookies(request.headers.get('cookie')).get(ADMIN_SESSION_COOKIE);
  if (cookieValue && cookieValue === expectedToken(username, password)) {
    return {
      actor_id: `admin:${username}`,
      actor_name: username,
      actor_email: null
    };
  }

  return {
    actor_id: 'system',
    actor_name: 'System',
    actor_email: null
  };
}

export function getAuditRequestContext(request: Request) {
  const url = new URL(request.url);
  const requestId = headerFirst(request, ['x-request-id', 'x-vercel-id', 'cf-ray']) ?? randomUUID();
  return {
    requestId,
    source: 'admin',
    ipHash: hashRequestValue(getClientIp(request)),
    userAgentHash: hashRequestValue(request.headers.get('user-agent')),
    metadata: {
      route: url.pathname,
      method: request.method
    } satisfies AuditMetadata
  };
}

const auditRequestContextCache = new WeakMap<Request, ReturnType<typeof getAuditRequestContext>>();

function getCachedAuditRequestContext(request: Request) {
  const cached = auditRequestContextCache.get(request);
  if (cached) return cached;
  const context = getAuditRequestContext(request);
  auditRequestContextCache.set(request, context);
  return context;
}

export function getRetentionUntil(entityType: AuditEntityType, action: AuditAction, occurredAt = new Date()) {
  void action;
  return getAuditRetentionUntil(entityType, occurredAt);
}

export function createAuditSummary(input: {
  entityType: AuditEntityType;
  action: AuditAction;
  entityLabel?: string | null;
  orderNumber?: string | null;
}) {
  if (input.entityType === 'item') {
    if (input.action === 'created') return 'Artikel dodan';
    if (input.action === 'archived') return 'Artikel arhiviran';
    if (input.action === 'restored') return 'Artikel obnovljen';
    if (input.action === 'deleted') return 'Artikel izbrisan';
    if (input.action === 'price_changed') return 'Spremenjena cena artikla';
    if (input.action === 'stock_changed') return 'Spremenjena zaloga artikla';
    if (input.action === 'uploaded') return 'Nalozen medij artikla';
    if (input.action === 'removed') return 'Odstranjen medij artikla';
    return 'Artikel posodobljen';
  }

  if (input.entityType === 'order') {
    const prefix = input.orderNumber || input.entityLabel || 'Narocilo';
    if (input.action === 'created') return `${prefix}: dodano`;
    if (input.action === 'status_changed') return `${prefix}: status spremenjen`;
    if (input.action === 'price_changed') return `${prefix}: cena spremenjena`;
    if (input.action === 'deleted') return `${prefix}: izbrisano`;
    if (input.action === 'archived') return `${prefix}: arhivirano`;
    if (input.action === 'uploaded') return `${prefix}: dokument nalozen`;
    if (input.action === 'removed') return `${prefix}: dokument odstranjen`;
    return `${prefix}: posodobljeno`;
  }

  if (input.entityType === 'category') {
    if (input.action === 'created') return 'Kategorija dodana';
    if (input.action === 'archived') return 'Kategorija arhivirana';
    if (input.action === 'restored') return 'Kategorija obnovljena';
    if (input.action === 'deleted') return 'Kategorija izbrisana';
    if (input.action === 'reordered') return 'Spremenjen vrstni red kategorij';
    return 'Kategorija posodobljena';
  }

  return AUDIT_ACTION_LABELS[input.action] ?? 'Sprememba zabelezena';
}

export async function insertAuditEvent(input: AuditEventInput, db?: Queryable) {
  const target = db ?? await getPool();
  if (!(await isAuditLoggingEnabled(target))) return null;
  await ensureAuditEventsTable(target);
  const occurredAt = input.occurredAt ?? new Date();
  const actor = input.actor ?? {
    actor_id: input.actor_id ?? null,
    actor_name: input.actor_name ?? null,
    actor_email: input.actor_email ?? null
  };
  const summary = input.summary ?? createAuditSummary({
    entityType: input.entityType,
    action: input.action,
    entityLabel: input.entityLabel
  });
  const retentionUntil = input.retentionUntil === undefined
    ? getRetentionUntil(input.entityType, input.action, occurredAt)
    : input.retentionUntil;
  const diff = input.action === 'created' || input.action === 'uploaded' ? {} : input.diff ?? {};

  const result = await target.query(
    `
    insert into audit_events (
      occurred_at,
      actor_id,
      actor_name,
      actor_email,
      entity_type,
      entity_id,
      entity_label,
      action,
      summary,
      diff_json,
      metadata_json,
      request_id,
      source,
      ip_hash,
      user_agent_hash,
      retention_until
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13,$14,$15,$16)
    returning *
    `,
    [
      occurredAt,
      actor.actor_id,
      actor.actor_name,
      actor.actor_email,
      input.entityType,
      input.entityId,
      input.entityLabel ?? null,
      input.action,
      summary,
      JSON.stringify(diff),
      JSON.stringify(input.metadata ?? {}),
      input.requestId ?? null,
      input.source ?? 'admin',
      input.ipHash ?? null,
      input.userAgentHash ?? null,
      retentionUntil
    ]
  );

  return mapAuditRow(result.rows[0]);
}

export async function insertAuditEventForRequest(
  request: Request,
  input: Omit<AuditEventInput, 'actor' | 'requestId' | 'source' | 'ipHash' | 'userAgentHash'>,
  db?: Queryable
) {
  const actor = await getAuditActor(request);
  const context = getCachedAuditRequestContext(request);
  return insertAuditEvent({
    ...input,
    actor,
    requestId: context.requestId,
    source: context.source,
    ipHash: context.ipHash,
    userAgentHash: context.userAgentHash,
    metadata: {
      ...context.metadata,
      ...(input.metadata ?? {})
    }
  }, db);
}

function parsePage(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.floor(parsed)) : fallback;
}

export function normalizeAuditFilters(raw: Record<string, string | null | undefined>): Required<Pick<AuditEventFilters, 'page' | 'pageSize'>> & AuditEventFilters {
  const entityType = raw.entity_type && AUDIT_ENTITY_TYPES.includes(raw.entity_type as AuditEntityType)
    ? raw.entity_type as AuditEntityType
    : undefined;
  const actions = (raw.action ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter((value): value is AuditAction => AUDIT_ACTIONS.includes(value as AuditAction));
  const action = actions.length > 1 ? actions : actions[0];
  const page = parsePage(raw.page, 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, parsePage(raw.page_size ?? raw.pageSize, 25));
  return {
    q: raw.q?.trim() || undefined,
    entityType,
    entityId: raw.entity_id?.trim() || undefined,
    entityQuery: raw.entity_query?.trim() || undefined,
    action,
    actorId: raw.actor_id?.trim() || undefined,
    dateFrom: raw.date_from?.trim() || undefined,
    dateTo: raw.date_to?.trim() || undefined,
    deletionFrom: raw.deletion_from?.trim() || undefined,
    deletionTo: raw.deletion_to?.trim() || undefined,
    page,
    pageSize
  };
}

export async function fetchAuditEvents(filters: AuditEventFilters = {}): Promise<AuditEventListResult> {
  const page = parsePage(filters.page, 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, parsePage(filters.pageSize, 25));
  const offset = (page - 1) * pageSize;
  const where: string[] = [];
  const params: unknown[] = [];

  const addParam = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (filters.entityType) where.push(`entity_type = ${addParam(filters.entityType)}`);
  if (filters.entityId) where.push(`entity_id = ${addParam(filters.entityId)}`);
  if (filters.entityQuery) {
    const entitySearchParam = addParam(`%${filters.entityQuery}%`);
    where.push(`(entity_label ilike ${entitySearchParam} or entity_id ilike ${entitySearchParam})`);
  }
  if (Array.isArray(filters.action) && filters.action.length > 0) {
    where.push(`action = any(${addParam(filters.action)}::text[])`);
  } else if (filters.action) {
    where.push(`action = ${addParam(filters.action)}`);
  }
  if (filters.actorId) where.push(`actor_id = ${addParam(filters.actorId)}`);
  if (filters.dateFrom) where.push(`occurred_at >= ${addParam(filters.dateFrom)}::timestamptz`);
  if (filters.dateTo) where.push(`occurred_at <= (${addParam(filters.dateTo)}::date + interval '1 day' - interval '1 millisecond')`);
  if (filters.deletionFrom) where.push(`${AUDIT_RETENTION_SQL} >= ${addParam(filters.deletionFrom)}::timestamptz`);
  if (filters.deletionTo) where.push(`${AUDIT_RETENTION_SQL} <= (${addParam(filters.deletionTo)}::date + interval '1 day' - interval '1 millisecond')`);
  if (filters.q) {
    const searchParam = addParam(`%${filters.q}%`);
    where.push(`(
      summary ilike ${searchParam}
      or entity_label ilike ${searchParam}
      or actor_name ilike ${searchParam}
      or actor_email ilike ${searchParam}
      or entity_id ilike ${searchParam}
    )`);
  }

  const whereSql = where.length > 0 ? `where ${where.join(' and ')}` : '';
  const pool = await getPool();
  await ensureAuditEventsTable(pool);

  const limitPlaceholder = `$${params.length + 1}`;
  const offsetPlaceholder = `$${params.length + 2}`;
  const eventParams = [...params, pageSize, offset];

  const [countResult, eventsResult] = await Promise.all([
    pool.query(`select count(*)::int as total from audit_events ${whereSql}`, params),
    pool.query(
      `
      select *
      from audit_events
      ${whereSql}
      order by occurred_at desc, created_at desc
      limit ${limitPlaceholder}
      offset ${offsetPlaceholder}
      `,
      eventParams
    )
  ]);

  const total = Number(countResult.rows[0]?.total ?? 0);
  return {
    events: eventsResult.rows.map(mapAuditRow),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize))
  };
}

export async function fetchAuditEventById(id: string) {
  const normalizedId = id.trim();
  if (!normalizedId) return null;
  const pool = await getPool();
  await ensureAuditEventsTable(pool);
  const result = await pool.query('select * from audit_events where id = $1 limit 1', [normalizedId]);
  return result.rows[0] ? mapAuditRow(result.rows[0]) : null;
}

export async function fetchAuditEventsByIds(ids: string[]) {
  const normalizedIds = normalizeAuditEventIds(ids);
  if (normalizedIds.length === 0) return [];
  const pool = await getPool();
  await ensureAuditEventsTable(pool);
  const result = await pool.query(
    'select * from audit_events where id = any($1::uuid[]) order by occurred_at desc, created_at desc',
    [normalizedIds]
  );
  return result.rows.map(mapAuditRow);
}

export async function deleteAuditEventsByIds(ids: string[]) {
  const normalizedIds = normalizeAuditEventIds(ids);
  if (normalizedIds.length === 0) return { deletedEvents: 0 };

  const pool = await getPool();
  await ensureAuditEventsTable(pool);
  const result = await pool.query(
    'delete from audit_events where id = any($1::uuid[])',
    [normalizedIds]
  );
  return { deletedEvents: result.rowCount ?? 0 };
}

export async function deleteAuditChangesByIds(changeIds: string[]) {
  const normalizedChangeIds = Array.from(new Set(changeIds.map((id) => id.trim()).filter(Boolean)));
  const eventIds = normalizeAuditEventIds(
    normalizedChangeIds
      .map((id) => getAuditEventIdFromChangeId(id))
      .filter((id): id is string => Boolean(id))
  );

  if (normalizedChangeIds.length === 0 || eventIds.length === 0) {
    return { deletedChanges: 0, deletedEvents: 0, updatedEvents: 0 };
  }

  const pool = await getPool();
  await ensureAuditEventsTable(pool);
  const client = await pool.connect();

  try {
    await client.query('begin');
    const eventsResult = await client.query(
      'select * from audit_events where id = any($1::uuid[]) for update',
      [eventIds]
    );

    let deletedChanges = 0;
    let deletedEvents = 0;
    let updatedEvents = 0;

    for (const row of eventsResult.rows) {
      const event = mapAuditRow(row);
      const diff = JSON.parse(JSON.stringify(event.diff)) as AuditDiff;
      const eventChangeIds = normalizedChangeIds.filter((changeId) => getAuditEventIdFromChangeId(changeId) === event.id);
      let deletedEventChanges = 0;

      for (const changeId of eventChangeIds) {
        if (removeAuditChangeFromDiff(diff, event.id, changeId)) {
          deletedChanges += 1;
          deletedEventChanges += 1;
        }
      }

      if (deletedEventChanges === 0) continue;

      if (Object.keys(diff).length === 0) {
        await client.query('delete from audit_events where id = $1', [event.id]);
        deletedEvents += 1;
      } else {
        await client.query('update audit_events set diff_json = $1::jsonb where id = $2', [JSON.stringify(diff), event.id]);
        updatedEvents += 1;
      }
    }

    await client.query('commit');
    return { deletedChanges, deletedEvents, updatedEvents };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function pruneExpiredAuditEvents(now = new Date()) {
  const pool = await getPool();
  await ensureAuditEventsTable(pool);
  const result = await pool.query(
    `
    delete from audit_events
    where (
      case
        when entity_type = 'order' then occurred_at + interval '2 months'
        when entity_type in ('item', 'category', 'media', 'system') then occurred_at + interval '3 years'
        else retention_until
      end
    ) < $1
    returning id
    `,
    [now]
  );
  return result.rowCount ?? 0;
}
