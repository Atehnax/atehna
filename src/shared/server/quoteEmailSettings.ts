import 'server-only';

import {
  cloneDefaultQuoteEmailSettings,
  normalizeQuoteEmailSettings,
  validateQuoteEmailSettings,
  type QuoteEmailSettings
} from '@/shared/domain/quote/quoteEmailSettings';
import { getPool } from '@/shared/server/db';
import {
  getQuoteFeatureFlags,
  type QuoteFeatureFlags
} from '@/shared/server/quoteFeatureFlags';
import { insertAuditEventForRequest } from '@/shared/server/audit';

export type QuoteEmailRecentFailure = {
  id: string;
  eventType: string;
  audience: string;
  recipientEmail: string;
  attempts: number;
  lastError: string | null;
  updatedAt: string;
};

export type QuoteEmailAdminState = {
  config: QuoteEmailSettings;
  schemaReady: boolean;
  flags: Pick<QuoteFeatureFlags, 'admin' | 'emailDelivery'>;
  queue: {
    pending: number;
    processing: number;
    sent: number;
    failed: number;
    recentFailures: QuoteEmailRecentFailure[];
  };
};

export class QuoteEmailSchemaNotReadyError extends Error {}

export class QuoteEmailSettingsValidationError extends Error {
  constructor(public readonly errors: string[]) {
    super(errors[0] ?? 'Nastavitve e-pošte za ponudbe niso veljavne.');
  }
}

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value ?? ''));
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

function emptyState(schemaReady: boolean): QuoteEmailAdminState {
  const flags = getQuoteFeatureFlags();
  return {
    config: cloneDefaultQuoteEmailSettings(),
    schemaReady,
    flags: { admin: flags.admin, emailDelivery: flags.emailDelivery },
    queue: {
      pending: 0,
      processing: 0,
      sent: 0,
      failed: 0,
      recentFailures: []
    }
  };
}

export async function getQuoteEmailAdminState(): Promise<QuoteEmailAdminState> {
  const pool = await getPool();
  const readiness = await pool.query(
    `
      select
        to_regclass('public.quote_email_settings') is not null as settings_ready,
        to_regclass('public.quote_email_jobs') is not null as jobs_ready
    `
  );
  const schemaReady =
    readiness.rows[0]?.settings_ready === true &&
    readiness.rows[0]?.jobs_ready === true;
  if (!schemaReady) return emptyState(false);

  const [settingsResult, countsResult, failuresResult] = await Promise.all([
    pool.query(
      `select config_json, updated_at from quote_email_settings where key = 'default'`
    ),
    pool.query(
      `
        select
          count(*) filter (where status = 'pending')::int as pending,
          count(*) filter (where status = 'processing')::int as processing,
          count(*) filter (where status = 'sent')::int as sent,
          count(*) filter (where status = 'failed')::int as failed
        from quote_email_jobs
      `
    ),
    pool.query(
      `
        select id, event_type, audience, recipient_email, attempts,
               last_error, updated_at
        from quote_email_jobs
        where status = 'failed'
        order by updated_at desc, created_at desc
        limit 20
      `
    )
  ]);
  const settingsRow = settingsResult.rows[0];
  const config = normalizeQuoteEmailSettings(settingsRow?.config_json);
  config.updatedAt = iso(settingsRow?.updated_at);
  const counts = countsResult.rows[0] ?? {};
  const flags = getQuoteFeatureFlags();
  return {
    config,
    schemaReady: true,
    flags: { admin: flags.admin, emailDelivery: flags.emailDelivery },
    queue: {
      pending: Number(counts.pending ?? 0),
      processing: Number(counts.processing ?? 0),
      sent: Number(counts.sent ?? 0),
      failed: Number(counts.failed ?? 0),
      recentFailures: failuresResult.rows.map((row) => ({
        id: String(row.id),
        eventType: String(row.event_type),
        audience: String(row.audience),
        recipientEmail: String(row.recipient_email),
        attempts: Number(row.attempts),
        lastError: row.last_error === null ? null : String(row.last_error),
        updatedAt: iso(row.updated_at)
      }))
    }
  };
}

export async function updateQuoteEmailSettings(
  value: unknown,
  options: { request: Request }
): Promise<QuoteEmailSettings> {
  const errors = validateQuoteEmailSettings(value);
  if (errors.length > 0) throw new QuoteEmailSettingsValidationError(errors);
  const normalized = normalizeQuoteEmailSettings(value);
  const { updatedAt: _updatedAt, ...stored } = normalized;
  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query('begin');
    const readiness = await client.query(
      `select to_regclass('public.quote_email_settings') is not null as ready`
    );
    if (readiness.rows[0]?.ready !== true) {
      throw new QuoteEmailSchemaNotReadyError(
        'Podatkovna shema e-pošte za ponudbe ni nameščena.'
      );
    }
    const result = await client.query(
      `
        insert into quote_email_settings (key, config_json, updated_at)
        values ('default', $1::jsonb, now())
        on conflict (key)
        do update set config_json = excluded.config_json, updated_at = now()
        returning updated_at
      `,
      [JSON.stringify(stored)]
    );
    await insertAuditEventForRequest(
      options.request,
      {
        entityType: 'system',
        entityId: 'quote-email-settings',
        entityLabel: 'E-pošta za ponudbe',
        action: 'updated',
        summary: 'Posodobljene nastavitve e-pošte za ponudbe',
        diff: {
          quote_email_settings: {
            label: 'E-pošta za ponudbe',
            changed: true
          }
        },
        metadata: {
          enabled: normalized.enabled,
          shared_sender_profile: true
        }
      },
      client
    );
    await client.query('commit');
    normalized.updatedAt = iso(result.rows[0]?.updated_at);
    return normalized;
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
