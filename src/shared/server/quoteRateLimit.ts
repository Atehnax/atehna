import 'server-only';

import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';

type Queryable = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;

export type QuoteRateLimitScope =
  | 'quote_request'
  | 'access_exchange'
  | 'otp_issue'
  | 'otp_verify'
  | 'offer_response'
  | 'purchase_order';

export function quoteRateSubjectHash(...parts: unknown[]): string {
  const pepper =
    process.env.QUOTE_RATE_LIMIT_PEPPER?.trim() ||
    process.env.QUOTE_ACCESS_BOOTSTRAP_KEY?.trim() ||
    'atehna-development-rate-limit-pepper';
  return createHash('sha256')
    .update('atehna/quote-rate-limit/v1\0', 'utf8')
    .update(pepper, 'utf8')
    .update('\0', 'utf8')
    .update(parts.map((part) => String(part ?? '')).join('\0'), 'utf8')
    .digest('hex');
}

export function requestNetworkSubject(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = request.headers.get('x-real-ip')?.trim();
  return quoteRateSubjectHash(forwarded || realIp || 'unknown');
}

export async function consumeQuoteRateLimit(
  database: Queryable,
  input: {
    scope: QuoteRateLimitScope;
    subjectHash: string;
    maximumAttempts: number;
    windowSeconds: number;
    blockSeconds?: number;
  }
): Promise<{ allowed: boolean; retryAfterSeconds: number; attemptCount: number }> {
  const maximumAttempts = Math.max(1, Math.floor(input.maximumAttempts));
  const windowSeconds = Math.max(1, Math.floor(input.windowSeconds));
  const blockSeconds = Math.max(
    windowSeconds,
    Math.floor(input.blockSeconds ?? windowSeconds)
  );
  const result = await database.query(
    `
      insert into quote_rate_limits (
        scope,
        subject_hash,
        window_started_at,
        window_seconds,
        attempt_count,
        blocked_until,
        created_at,
        updated_at
      )
      values (
        $1,
        $2,
        to_timestamp(floor(extract(epoch from now()) / $3) * $3),
        $3,
        1,
        null,
        now(),
        now()
      )
      on conflict (scope, subject_hash, window_started_at)
      do update
      set attempt_count = quote_rate_limits.attempt_count + 1,
          blocked_until = case
            when quote_rate_limits.attempt_count + 1 > $4
              then greatest(
                coalesce(quote_rate_limits.blocked_until, now()),
                now() + make_interval(secs => $5)
              )
            else quote_rate_limits.blocked_until
          end,
          updated_at = now()
      returning
        attempt_count,
        blocked_until,
        greatest(
          0,
          ceil(extract(epoch from (coalesce(blocked_until, now()) - now())))
        )::integer as retry_after_seconds
    `,
    [
      input.scope,
      input.subjectHash,
      windowSeconds,
      maximumAttempts,
      blockSeconds
    ]
  );
  const row = result.rows[0] as {
    attempt_count: string | number;
    blocked_until: string | Date | null;
    retry_after_seconds: string | number;
  };
  const attemptCount = Number(row.attempt_count);
  return {
    allowed: attemptCount <= maximumAttempts && row.blocked_until === null,
    retryAfterSeconds: Math.max(1, Number(row.retry_after_seconds) || windowSeconds),
    attemptCount
  };
}
