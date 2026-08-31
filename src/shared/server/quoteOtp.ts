import 'server-only';

import {
  createHash,
  randomInt,
  randomUUID,
  timingSafeEqual
} from 'node:crypto';
import type { PoolClient } from 'pg';

function secret(): string {
  const value = process.env.QUOTE_ACCESS_BOOTSTRAP_KEY?.trim() ?? '';
  if (value.length < 32) {
    throw new Error('QUOTE_ACCESS_BOOTSTRAP_KEY must contain at least 32 characters.');
  }
  return value;
}

function digest(...parts: string[]): string {
  return createHash('sha256')
    .update('atehna/quote-email-otp/v1\0', 'utf8')
    .update(secret(), 'utf8')
    .update('\0', 'utf8')
    .update(parts.join('\0'), 'utf8')
    .digest('hex');
}

export function quoteEmailIdentityHash(email: string): string {
  return digest('email', email.trim().toLowerCase());
}

function otpHash(id: string, emailHash: string, code: string): string {
  return digest('code', id.toLowerCase(), emailHash, code);
}

export async function issueQuoteResponseOtp(
  client: PoolClient,
  input: {
    quoteRequestId: number;
    quoteOfferVersionId: number;
    email: string;
    accessSessionHash: string;
    requestId?: string | null;
    correlationId?: string | null;
    ipHash?: string | null;
  }
): Promise<{ verificationId: string; code: string; expiresAt: string }> {
  const verificationId = randomUUID();
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const emailHash = quoteEmailIdentityHash(input.email);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1_000);
  await client.query(
    `
      update quote_email_verifications
      set status = 'expired'
      where quote_offer_version_id = $1
        and access_session_hash = $2
        and purpose = 'offer_response'
        and status in ('pending', 'verified')
        and consumed_at is null
    `,
    [input.quoteOfferVersionId, input.accessSessionHash]
  );
  await client.query(
    `
      insert into quote_email_verifications (
        id,
        quote_request_id,
        quote_offer_version_id,
        purpose,
        target_email_hash,
        code_hash,
        access_session_hash,
        status,
        attempt_count,
        max_attempts,
        expires_at,
        request_id,
        correlation_id,
        ip_hash
      )
      values (
        $1, $2, $3, 'offer_response', $4, $5, $6, 'pending', 0, 5, $7,
        $8, $9, $10
      )
    `,
    [
      verificationId,
      input.quoteRequestId,
      input.quoteOfferVersionId,
      emailHash,
      otpHash(verificationId, emailHash, code),
      input.accessSessionHash,
      expiresAt.toISOString(),
      input.requestId ?? null,
      input.correlationId ?? null,
      input.ipHash ?? null
    ]
  );
  return { verificationId, code, expiresAt: expiresAt.toISOString() };
}

function hashesEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, 'hex');
  const rightBytes = Buffer.from(right, 'hex');
  return (
    leftBytes.length === rightBytes.length &&
    leftBytes.length > 0 &&
    timingSafeEqual(leftBytes, rightBytes)
  );
}

export async function verifyQuoteResponseOtp(
  client: PoolClient,
  input: {
    verificationId: string;
    quoteRequestId: number;
    quoteOfferVersionId: number;
    accessSessionHash: string;
    code: string;
  }
): Promise<
  | { ok: true; verifiedAt: string }
  | { ok: false; code: 'INVALID' | 'EXPIRED' | 'LOCKED'; attemptsRemaining: number }
> {
  const result = await client.query(
    `
      select *
      from quote_email_verifications
      where id = $1
        and quote_request_id = $2
        and quote_offer_version_id = $3
        and access_session_hash = $4
        and purpose = 'offer_response'
      for update
    `,
    [
      input.verificationId,
      input.quoteRequestId,
      input.quoteOfferVersionId,
      input.accessSessionHash
    ]
  );
  const row = result.rows[0];
  if (!row) return { ok: false, code: 'INVALID', attemptsRemaining: 0 };
  if (row.status === 'locked' || Number(row.attempt_count) >= Number(row.max_attempts)) {
    return { ok: false, code: 'LOCKED', attemptsRemaining: 0 };
  }
  if (
    row.status === 'expired' ||
    row.status === 'consumed' ||
    new Date(String(row.expires_at)).getTime() <= Date.now()
  ) {
    if (row.status === 'pending' || row.status === 'verified') {
      await client.query(
        `update quote_email_verifications set status = 'expired' where id = $1`,
        [input.verificationId]
      );
    }
    return { ok: false, code: 'EXPIRED', attemptsRemaining: 0 };
  }
  if (row.status === 'verified') {
    return {
      ok: true,
      verifiedAt:
        row.verified_at instanceof Date
          ? row.verified_at.toISOString()
          : String(row.verified_at)
    };
  }

  const expected = otpHash(
    input.verificationId,
    String(row.target_email_hash),
    input.code
  );
  if (!hashesEqual(expected, String(row.code_hash))) {
    const attempts = Number(row.attempt_count) + 1;
    const locked = attempts >= Number(row.max_attempts);
    await client.query(
      `
        update quote_email_verifications
        set attempt_count = $2,
            last_attempt_at = now(),
            status = case when $3 then 'locked' else 'pending' end
        where id = $1
      `,
      [input.verificationId, attempts, locked]
    );
    return {
      ok: false,
      code: locked ? 'LOCKED' : 'INVALID',
      attemptsRemaining: Math.max(0, Number(row.max_attempts) - attempts)
    };
  }
  const verifiedAt = new Date().toISOString();
  await client.query(
    `
      update quote_email_verifications
      set status = 'verified',
          verified_at = $2,
          last_attempt_at = $2
      where id = $1
    `,
    [input.verificationId, verifiedAt]
  );
  return { ok: true, verifiedAt };
}

export async function consumeVerifiedQuoteOtp(
  client: PoolClient,
  input: {
    verificationId: string;
    quoteRequestId: number;
    quoteOfferVersionId: number;
    accessSessionHash: string;
  }
): Promise<{ verifiedAt: string; targetEmailHash: string } | null> {
  const result = await client.query(
    `
      update quote_email_verifications
      set status = 'consumed',
          consumed_at = now()
      where id = $1
        and quote_request_id = $2
        and quote_offer_version_id = $3
        and access_session_hash = $4
        and purpose = 'offer_response'
        and status = 'verified'
        and consumed_at is null
        and expires_at > now()
      returning verified_at, target_email_hash
    `,
    [
      input.verificationId,
      input.quoteRequestId,
      input.quoteOfferVersionId,
      input.accessSessionHash
    ]
  );
  const row = result.rows[0];
  return row
    ? {
        verifiedAt:
          row.verified_at instanceof Date
            ? row.verified_at.toISOString()
            : String(row.verified_at),
        targetEmailHash: String(row.target_email_hash)
      }
    : null;
}
