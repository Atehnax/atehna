import type { PoolClient } from 'pg';
import {
  ADMIN_SESSION_COOKIE,
  getAdminAuthConfig,
  verifyAdminSessionToken
} from '@/shared/auth/adminSession';
import {
  getAuditActor,
  getAuditRequestContext,
  insertAuditEventForRequest
} from '@/shared/server/audit';
import {
  enqueueQuoteEmailEvent,
  type QuoteEmailEventType
} from '@/shared/server/quoteEmailJobs';

export type QuoteAdminEvidence = {
  actorId: string | null;
  requestId: string;
};

export function hasValidQuoteAdminSession(request: Request): boolean {
  const cookieHeader = request.headers.get('cookie') ?? '';
  let sessionToken: string | null = null;
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    if (name !== ADMIN_SESSION_COOKIE) continue;
    const value = part.slice(separator + 1).trim();
    try {
      sessionToken = decodeURIComponent(value);
    } catch {
      sessionToken = value;
    }
    break;
  }
  return verifyAdminSessionToken(sessionToken, getAdminAuthConfig());
}

export function positiveInteger(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function boundedText(
  value: unknown,
  maximum: number,
  fallback = ''
): string {
  const normalized =
    typeof value === 'string' ? value.trim() : String(value ?? fallback).trim();
  if (normalized.length > maximum) {
    throw new Error('Vrednost polja je predolga.');
  }
  return normalized;
}

export function expectedVersion(value: unknown): number | null {
  return positiveInteger(value);
}

export async function quoteAdminEvidence(
  request: Request
): Promise<QuoteAdminEvidence> {
  const [actor, context] = await Promise.all([
    getAuditActor(request),
    Promise.resolve(getAuditRequestContext(request))
  ]);
  return {
    actorId: actor.actor_id,
    requestId: context.requestId
  };
}

export async function appendQuoteEvent(
  client: PoolClient,
  input: {
    quoteRequestId: number;
    quoteOfferVersionId?: number | null;
    eventKey: string;
    eventType: string;
    actorType?: 'admin' | 'system';
    actorId?: string | null;
    requestId?: string | null;
    correlationId?: string | null;
    reason?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await client.query(
    `
      insert into quote_events (
        quote_request_id,
        quote_offer_version_id,
        event_key,
        event_type,
        actor_type,
        actor_id,
        occurred_at,
        request_id,
        correlation_id,
        reason,
        metadata_json
      )
      values (
        $1, $2, $3, $4, $5, $6, now(), $7,
        coalesce($8, $7, gen_random_uuid()::text), $9, $10::jsonb
      )
      on conflict (event_key) where event_key is not null do nothing
    `,
    [
      input.quoteRequestId,
      input.quoteOfferVersionId ?? null,
      input.eventKey,
      input.eventType,
      input.actorType ?? 'admin',
      input.actorId ?? null,
      input.requestId ?? null,
      input.correlationId ?? input.requestId ?? null,
      input.reason ?? null,
      JSON.stringify(input.metadata ?? {})
    ]
  );
}

export async function lockPendingQuotePurchaseOrder(
  client: PoolClient,
  quoteRequestId: number
): Promise<{ orderId: number; orderNumber: string } | null> {
  const result = await client.query(
    `
      select orders.id, orders.order_number
      from orders
      join quote_offer_versions source_offer
        on source_offer.id = orders.source_quote_offer_version_id
      where source_offer.quote_request_id = $1
        and orders.commitment_status = 'pending_confirmation'
        and orders.contract_status = 'pending_seller_acceptance'
        and orders.deleted_at is null
      order by orders.id
      limit 1
      for update of orders
    `,
    [quoteRequestId]
  );
  if (!result.rows[0]) return null;
  return {
    orderId: Number(result.rows[0].id),
    orderNumber: String(result.rows[0].order_number)
  };
}

export async function mirrorQuoteAdminAudit(
  request: Request,
  client: PoolClient,
  input: {
    quoteRequestId: number;
    requestNumber: string;
    action?: 'updated' | 'status_changed';
    summary: string;
    beforeStatus?: string | null;
    afterStatus?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await insertAuditEventForRequest(
    request,
    {
      entityType: 'system',
      entityId: `quote:${input.quoteRequestId}`,
      entityLabel: `Povpraševanje ${input.requestNumber}`,
      action: input.action ?? 'status_changed',
      summary: input.summary,
      diff:
        input.beforeStatus === undefined && input.afterStatus === undefined
          ? {
              quote: {
                label: 'Povpraševanje',
                changed: true
              }
            }
          : {
              quote_status: {
                label: 'Status povpraševanja',
                before: input.beforeStatus ?? null,
                after: input.afterStatus ?? null
              }
            },
      metadata: {
        quote_request_id: input.quoteRequestId,
        request_number: input.requestNumber,
        ...(input.metadata ?? {})
      }
    },
    client
  );
}

function safeError(error: unknown): string {
  return String(error instanceof Error ? error.message : 'Unknown error')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, '[email]')
    .replace(/ath_quote_[A-Za-z0-9_-]{43}/gu, '[quote-token]')
    .slice(0, 500);
}

export async function enqueueQuoteEmailIsolated(
  client: PoolClient,
  input: {
    quoteRequestId: number;
    quoteOfferVersionId?: number | null;
    eventKey: string;
    eventType: QuoteEmailEventType;
    detail?: string | null;
    forceCustomer?: boolean;
    suppressAdmin?: boolean;
    requestId?: string | null;
  }
): Promise<boolean> {
  await client.query('savepoint quote_admin_email');
  try {
    const jobs = await enqueueQuoteEmailEvent(client, {
      quoteRequestId: input.quoteRequestId,
      quoteOfferVersionId: input.quoteOfferVersionId ?? null,
      eventKey: input.eventKey,
      eventType: input.eventType,
      detail: input.detail ?? null,
      forceCustomer: input.forceCustomer,
      suppressAdmin: input.suppressAdmin
    });
    if (jobs.length > 0) {
      await appendQuoteEvent(client, {
        quoteRequestId: input.quoteRequestId,
        quoteOfferVersionId: input.quoteOfferVersionId ?? null,
        eventKey: `${input.eventKey}:queued`,
        eventType: 'quote_email_queued',
        actorType: 'system',
        requestId: input.requestId ?? null,
        metadata: {
          emailEventType: input.eventType,
          jobCount: jobs.length
        }
      });
    }
    await client.query('release savepoint quote_admin_email');
    return jobs.length > 0;
  } catch (error) {
    await client.query('rollback to savepoint quote_admin_email');
    await client.query('release savepoint quote_admin_email');
    await appendQuoteEvent(client, {
      quoteRequestId: input.quoteRequestId,
      quoteOfferVersionId: input.quoteOfferVersionId ?? null,
      eventKey: `${input.eventKey}:enqueue-failed`,
      eventType: 'quote_email_provider_failed',
      actorType: 'system',
      requestId: input.requestId ?? null,
      reason: 'E-poštnega opravila ni bilo mogoče varno ustvariti.',
      metadata: {
        stage: 'enqueue',
        emailEventType: input.eventType,
        message: safeError(error)
      }
    });
    return false;
  }
}
