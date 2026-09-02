import 'server-only';

import {
  cloneDefaultQuoteEmailSettings,
  normalizeQuoteEmailSettings,
  validateQuoteEmailSettings,
  type QuoteEmailSettings,
  type QuoteStockAcceptanceMode
} from '@/shared/domain/quote/quoteEmailSettings';
import type { PoolClient } from 'pg';
import { getPool } from '@/shared/server/db';
import {
  getQuoteFeatureFlags,
  type QuoteFeatureFlags
} from '@/shared/server/quoteFeatureFlags';
import { insertAuditEventForRequest } from '@/shared/server/audit';
import { getOrderEmailSettings } from '@/shared/server/orderEmailSettings';
import { getQuoteEmailRetryEligibility } from '@/shared/domain/quote/quoteEmailRetryEligibility';

export type QuoteEmailRecentFailure = {
  id: string;
  eventType: string;
  audience: string;
  recipientEmail: string;
  attempts: number;
  lastError: string | null;
  updatedAt: string;
  retryEligible: boolean;
  retryIneligibleReason: string | null;
};

export type QuoteEmailPendingJob = {
  id: string;
  eventType: string;
  audience: string;
  recipientEmail: string;
  attempts: number;
  nextAttemptAt: string;
  createdAt: string;
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
    pendingJobs: QuoteEmailPendingJob[];
    recentFailures: QuoteEmailRecentFailure[];
  };
};

export class QuoteEmailSchemaNotReadyError extends Error {}

export class QuoteEmailSettingsValidationError extends Error {
  constructor(public readonly errors: string[]) {
    super(errors[0] ?? 'Nastavitve e-pošte za ponudbe niso veljavne.');
  }
}

export async function getQuoteStockAcceptanceMode(
  client: PoolClient
): Promise<QuoteStockAcceptanceMode> {
  const readiness = await client.query(
    `select to_regclass('public.quote_email_settings') is not null as ready`
  );
  if (readiness.rows[0]?.ready !== true) return 'manual';
  const result = await client.query(
    `select config_json from quote_email_settings where key = 'default'`
  );
  return normalizeQuoteEmailSettings(
    result.rows[0]?.config_json
  ).stockAcceptanceMode;
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
      pendingJobs: [],
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

  const [
    settingsResult,
    pendingJobsResult,
    countsResult,
    failuresResult,
    orderEmailSettings
  ] = await Promise.all([
    pool.query(
      `select config_json, updated_at from quote_email_settings where key = 'default'`
    ),
    pool.query(
      `
        select id, event_type, audience, recipient_email, attempts,
               next_attempt_at, created_at
        from quote_email_jobs
        where status = 'pending'
        order by next_attempt_at asc, created_at asc, id asc
        limit 100
      `
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
        select job.id, job.quote_offer_version_id, job.event_type, job.audience,
               job.recipient_email, job.attempts, job.last_error, job.updated_at,
               request.email as request_email, request.status as request_status,
               request.voided_at as request_voided_at,
               offer.status as offer_status, offer.is_current as offer_is_current,
               offer.valid_until,
               exists (
                 select 1
                 from quote_offer_versions newer_offer
                 where newer_offer.quote_request_id = job.quote_request_id
                   and newer_offer.version_number > offer.version_number
                   and newer_offer.status <> 'draft'
               ) as has_newer_non_draft_offer_version
        from quote_email_jobs job
        join quote_requests request on request.id = job.quote_request_id
        left join quote_offer_versions offer
          on offer.id = job.quote_offer_version_id
         and offer.quote_request_id = job.quote_request_id
        where job.status = 'failed'
        order by job.updated_at desc, job.created_at desc
        limit 20
      `
    ),
    getOrderEmailSettings(pool)
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
      pendingJobs: pendingJobsResult.rows.map((row) => ({
        id: String(row.id),
        eventType: String(row.event_type),
        audience: String(row.audience),
        recipientEmail: String(row.recipient_email),
        attempts: Number(row.attempts),
        nextAttemptAt: iso(row.next_attempt_at),
        createdAt: iso(row.created_at)
      })),
      recentFailures: failuresResult.rows.map((row) => {
        const retry = getQuoteEmailRetryEligibility({
          settings: config,
          emailDeliveryEnabled: flags.emailDelivery,
          job: {
            eventType: String(row.event_type),
            audience: String(row.audience),
            recipientEmail: String(row.recipient_email),
            requestStatus: String(row.request_status),
            requestVoided: Boolean(row.request_voided_at),
            offerVersionId: row.quote_offer_version_id === null
              ? null
              : Number(row.quote_offer_version_id),
            offerStatus: row.offer_status === null ? null : String(row.offer_status),
            offerIsCurrent: row.offer_is_current === true,
            hasNewerNonDraftOfferVersion:
              row.has_newer_non_draft_offer_version === true,
            validUntil: row.valid_until === null ? null : iso(row.valid_until),
            currentCustomerEmail: String(row.request_email ?? ''),
            currentAdminRecipients: orderEmailSettings.adminRecipients
          }
        });
        return {
          id: String(row.id),
          eventType: String(row.event_type),
          audience: String(row.audience),
          recipientEmail: String(row.recipient_email),
          attempts: Number(row.attempts),
          lastError: row.last_error === null ? null : String(row.last_error),
          updatedAt: iso(row.updated_at),
          ...retry
        };
      })
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
          stock_acceptance_mode: normalized.stockAcceptanceMode,
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
