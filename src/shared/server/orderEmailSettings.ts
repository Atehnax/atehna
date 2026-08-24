import 'server-only';

import { unstable_noStore as noStore } from 'next/cache';
import type { PoolClient, QueryResult } from 'pg';
import {
  ORDER_EMAIL_EVENT_DEFINITIONS,
  cloneDefaultOrderEmailSettings,
  normalizeOrderEmailSettings,
  toStoredOrderEmailSettings,
  validateOrderEmailSettingsInput,
  type OrderEmailSettings
} from '@/shared/domain/order/orderEmailSettings';
import { insertAuditEventForRequest } from '@/shared/server/audit';
import { getPool } from '@/shared/server/db';

const ORDER_EMAIL_SETTINGS_KEY = 'order-email-notifications';

type Queryable = {
  query: (sql: string, params?: unknown[]) => Promise<QueryResult<Record<string, unknown>>>;
};

export type OrderEmailDeliveryStatus = {
  provider: 'Resend';
  schemaReady: boolean;
  apiKeyConfigured: boolean;
  e2eDisabled: boolean;
  ready: boolean;
};

export type OrderEmailQueueStats = {
  pending: number;
  processing: number;
  sent: number;
  failed: number;
  recentFailures: Array<{
    id: string;
    eventType: string;
    recipientEmail: string;
    attempts: number;
    lastError: string | null;
    updatedAt: string;
  }>;
};

export type OrderEmailAdminState = {
  config: OrderEmailSettings;
  delivery: OrderEmailDeliveryStatus;
  queue: OrderEmailQueueStats;
};

export class OrderEmailSettingsValidationError extends Error {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(errors[0] ?? 'Nastavitve samodejne e-pošte niso veljavne.');
    this.name = 'OrderEmailSettingsValidationError';
    this.errors = errors;
  }
}

export class OrderEmailSchemaNotReadyError extends Error {
  constructor() {
    super('Kanonična podatkovna shema za samodejno e-pošto še ni nameščena.');
    this.name = 'OrderEmailSchemaNotReadyError';
  }
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function isUndefinedTableError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: unknown }).code === '42P01'
  );
}

export function isOrderEmailTransportDisabledForE2e(): boolean {
  return process.env.E2E_MODE === '1';
}

export function isResendApiKeyConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export function getOrderEmailDeliveryStatus(
  config: OrderEmailSettings,
  schemaReady = true
): OrderEmailDeliveryStatus {
  const apiKeyConfigured = isResendApiKeyConfigured();
  const e2eDisabled = isOrderEmailTransportDisabledForE2e();
  return {
    provider: 'Resend',
    schemaReady,
    apiKeyConfigured,
    e2eDisabled,
    ready:
      schemaReady &&
      apiKeyConfigured &&
      !e2eDisabled &&
      Boolean(config.senderName.trim()) &&
      Boolean(config.fromEmail.trim())
  };
}

export async function getOrderEmailSettings(
  db?: Queryable
): Promise<OrderEmailSettings> {
  noStore();
  const target = db ?? (await getPool());
  if (!(await isOrderEmailSchemaReady(target))) {
    return { ...cloneDefaultOrderEmailSettings(), enabled: false };
  }

  const result = await target.query(
    'select config_json, updated_at from order_email_settings where key = $1 limit 1',
    [ORDER_EMAIL_SETTINGS_KEY]
  );
  const row = result.rows[0] as
    | { config_json?: unknown; updated_at?: unknown }
    | undefined;
  if (!row) return cloneDefaultOrderEmailSettings();
  return {
    ...normalizeOrderEmailSettings(row.config_json),
    updatedAt: toIso(row.updated_at)
  };
}

function numericCount(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

export async function getOrderEmailQueueStats(
  db?: Queryable
): Promise<OrderEmailQueueStats> {
  noStore();
  const target = db ?? (await getPool());
  try {
    const [countsResult, failuresResult] = await Promise.all([
      target.query(
        `
          select status, count(*)::integer as count
          from order_email_jobs
          group by status
        `
      ),
      target.query(
        `
          select id, event_type, recipient_email, attempts, last_error, updated_at
          from order_email_jobs
          where status = 'failed'
          order by updated_at desc, created_at desc
          limit 10
        `
      )
    ]);
    const counts = new Map(
      countsResult.rows.map((row) => [String(row.status), numericCount(row.count)])
    );
    return {
      pending: counts.get('pending') ?? 0,
      processing: counts.get('processing') ?? 0,
      sent: counts.get('sent') ?? 0,
      failed: counts.get('failed') ?? 0,
      recentFailures: failuresResult.rows.map((row) => ({
        id: String(row.id),
        eventType: String(row.event_type ?? ''),
        recipientEmail: String(row.recipient_email ?? ''),
        attempts: numericCount(row.attempts),
        lastError: row.last_error ? String(row.last_error) : null,
        updatedAt: toIso(row.updated_at) ?? new Date(0).toISOString()
      }))
    };
  } catch (error) {
    if (isUndefinedTableError(error)) {
      return {
        pending: 0,
        processing: 0,
        sent: 0,
        failed: 0,
        recentFailures: []
      };
    }
    throw error;
  }
}

export async function isOrderEmailSchemaReady(db?: Queryable): Promise<boolean> {
  const target = db ?? (await getPool());
  const result = await target.query(
    `
      select (
        to_regclass('public.order_email_settings') is not null
        and to_regclass('public.order_email_jobs') is not null
      ) as schema_ready
    `
  );
  return result.rows[0]?.schema_ready === true;
}

export async function getOrderEmailAdminState(): Promise<OrderEmailAdminState> {
  const pool = await getPool();
  const schemaReady = await isOrderEmailSchemaReady(pool);
  if (!schemaReady) {
    const config = {
      ...cloneDefaultOrderEmailSettings(),
      enabled: false
    };
    return {
      config,
      delivery: getOrderEmailDeliveryStatus(config, false),
      queue: {
        pending: 0,
        processing: 0,
        sent: 0,
        failed: 0,
        recentFailures: []
      }
    };
  }

  const [config, queue] = await Promise.all([
    getOrderEmailSettings(pool),
    getOrderEmailQueueStats(pool)
  ]);
  return {
    config,
    delivery: getOrderEmailDeliveryStatus(config, schemaReady),
    queue
  };
}

function summarizeConfig(config: OrderEmailSettings) {
  return {
    enabled: config.enabled,
    senderConfigured: Boolean(config.fromEmail),
    replyToConfigured: Boolean(config.replyToEmail),
    adminRecipientCount: config.adminRecipients.length,
    enabledEvents: ORDER_EMAIL_EVENT_DEFINITIONS.flatMap((event) => {
      const audiences = config.events[event.value];
      return [
        audiences.customer ? `${event.value}:customer` : null,
        audiences.admins ? `${event.value}:admins` : null
      ].filter((value): value is string => Boolean(value));
    })
  };
}

export async function updateOrderEmailSettings(
  input: unknown,
  options: { request?: Request } = {}
): Promise<{ config: OrderEmailSettings; changed: boolean }> {
  noStore();
  const validationErrors = validateOrderEmailSettingsInput(input);
  if (validationErrors.length > 0) {
    throw new OrderEmailSettingsValidationError(validationErrors);
  }

  const config = toStoredOrderEmailSettings(input);
  if (
    config.enabled &&
    !isOrderEmailTransportDisabledForE2e() &&
    !isResendApiKeyConfigured()
  ) {
    throw new OrderEmailSettingsValidationError([
      'Pred vklopom dodajte RESEND_API_KEY med občutljive spremenljivke okolja v Vercelu.'
    ]);
  }

  const pool = await getPool();
  if (!(await isOrderEmailSchemaReady(pool))) {
    throw new OrderEmailSchemaNotReadyError();
  }

  const client = await pool.connect();
  const serialized = JSON.stringify(config);
  try {
    await client.query('begin');
    const previousResult = await client.query(
      'select config_json, updated_at from order_email_settings where key = $1 for update',
      [ORDER_EMAIL_SETTINGS_KEY]
    );
    const previousRow = previousResult.rows[0] as
      | { config_json?: unknown; updated_at?: unknown }
      | undefined;
    const previousConfig = previousRow
      ? toStoredOrderEmailSettings(previousRow.config_json)
      : toStoredOrderEmailSettings(cloneDefaultOrderEmailSettings());

    if (previousRow && JSON.stringify(previousConfig) === serialized) {
      await client.query('commit');
      return {
        config: {
          ...previousConfig,
          updatedAt: toIso(previousRow.updated_at)
        },
        changed: false
      };
    }

    const result = await client.query(
      `
        insert into order_email_settings (key, config_json, updated_at)
        values ($1, $2::jsonb, now())
        on conflict (key)
        do update set config_json = excluded.config_json, updated_at = now()
        returning updated_at
      `,
      [ORDER_EMAIL_SETTINGS_KEY, serialized]
    );

    if (options.request) {
      const beforeSummary = summarizeConfig(previousConfig);
      const afterSummary = summarizeConfig(config);
      await insertAuditEventForRequest(
        options.request,
        {
          entityType: 'system',
          entityId: ORDER_EMAIL_SETTINGS_KEY,
          entityLabel: 'Samodejna e-pošta',
          action: 'updated',
          summary: 'Nastavitve samodejne e-pošte posodobljene',
          metadata: {
            area: 'order_email',
            source: 'admin-order-email-settings',
            enabled: config.enabled,
            admin_recipient_count: config.adminRecipients.length
          },
          diff: {
            configuration: {
              label: 'Nastavitve samodejne e-pošte',
              before: JSON.stringify(beforeSummary),
              after: JSON.stringify(afterSummary),
              changed: JSON.stringify(beforeSummary) !== JSON.stringify(afterSummary)
            }
          }
        },
        client as PoolClient
      );
    }

    await client.query('commit');
    return {
      config: {
        ...config,
        updatedAt: toIso(result.rows[0]?.updated_at)
      },
      changed: true
    };
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
