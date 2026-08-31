import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import type { NextRequest, NextResponse } from 'next/server';
import type { Pool, PoolClient } from 'pg';

type Queryable = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;

export type QuoteAccessScope =
  | 'request_confirmation'
  | 'offer_review'
  | 'offer_response'
  | 'purchase_order';

export type IssuedQuoteAccessToken = {
  tokenId: string;
  token: string;
  tokenPrefix: string;
  quoteRequestId: number;
  quoteOfferVersionId: number | null;
  createdAt: string;
  expiresAt: string;
};

export type VerifiedQuoteAccess = {
  tokenId: string;
  quoteRequestId: number;
  quoteOfferVersionId: number | null;
  scopes: QuoteAccessScope[];
  expiresAt: string;
  accessSessionHash: string | null;
};

const TOKEN_PREFIX = 'ath_quote_';
const TOKEN_PATTERN = /^ath_quote_[A-Za-z0-9_-]{43}$/u;
const ACCESS_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const COOKIE_PREFIX = 'ath_quote_access_';
const DEFAULT_TTL_DAYS = 45;
const QUOTE_WORKFLOW_LOCK_PREFIX = 'atehna:quote-workflow:';

export async function lockQuoteWorkflow(
  database: Queryable,
  quoteRequestId: number
): Promise<void> {
  if (!Number.isSafeInteger(quoteRequestId) || quoteRequestId <= 0) {
    throw new Error('Invalid quote request workflow lock id.');
  }
  await database.query(
    `select pg_advisory_xact_lock(hashtextextended($1, 0))`,
    [`${QUOTE_WORKFLOW_LOCK_PREFIX}${quoteRequestId}`]
  );
}

export function hashQuoteSecret(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function isQuoteAccessToken(value: unknown): value is string {
  return typeof value === 'string' && TOKEN_PATTERN.test(value.trim());
}

export function normalizeQuoteAccessId(value: unknown): string | null {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return ACCESS_ID_PATTERN.test(normalized) ? normalized : null;
}

function cookieName(accessId: string): string | null {
  const normalized = normalizeQuoteAccessId(accessId);
  return normalized ? `${COOKIE_PREFIX}${normalized.replaceAll('-', '')}` : null;
}

function accessIdFromCookieName(value: string): string | null {
  if (!value.startsWith(COOKIE_PREFIX)) return null;
  const compact = value.slice(COOKIE_PREFIX.length);
  if (!/^[0-9a-f]{32}$/iu.test(compact)) return null;
  return normalizeQuoteAccessId(
    `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`
  );
}

export function setQuoteAccessSessionCookie(
  response: NextResponse,
  session: Pick<IssuedQuoteAccessToken, 'tokenId' | 'token' | 'expiresAt'>
): void {
  const name = cookieName(session.tokenId);
  if (!name || !isQuoteAccessToken(session.token)) {
    throw new Error('Invalid quote access session credentials.');
  }
  const expires = new Date(session.expiresAt);
  if (Number.isNaN(expires.getTime())) {
    throw new Error('Invalid quote access session expiry.');
  }
  response.cookies.set({
    name,
    value: session.token.trim(),
    expires,
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/quote-requests'
  });
}

function quoteSessions(request: NextRequest): Array<{ accessId: string; token: string }> {
  const selectedId = normalizeQuoteAccessId(
    request.headers.get('x-quote-access-id')
  );
  const candidates = new Map<string, string>();
  if (selectedId) {
    const selectedName = cookieName(selectedId);
    const token = selectedName
      ? request.cookies.get(selectedName)?.value?.trim() ?? ''
      : '';
    if (isQuoteAccessToken(token)) candidates.set(selectedId, token);
  }
  for (const cookie of request.cookies.getAll()) {
    const accessId = accessIdFromCookieName(cookie.name);
    if (
      !accessId ||
      candidates.has(accessId) ||
      !isQuoteAccessToken(cookie.value)
    ) {
      continue;
    }
    candidates.set(accessId, cookie.value.trim());
  }
  return Array.from(candidates, ([accessId, token]) => ({ accessId, token }));
}

function validScopes(value: unknown): QuoteAccessScope[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (scope): scope is QuoteAccessScope =>
      scope === 'request_confirmation' ||
      scope === 'offer_review' ||
      scope === 'offer_response' ||
      scope === 'purchase_order'
  );
}

export async function issueQuoteAccessToken(
  database: Queryable,
  input: {
    quoteRequestId: number;
    quoteOfferVersionId?: number | null;
    scopes: QuoteAccessScope[];
    ttlDays?: number;
  }
): Promise<IssuedQuoteAccessToken> {
  const token = `${TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
  const createdAt = new Date();
  const expiresAt = new Date(createdAt);
  const ttlDays = Math.min(
    180,
    Math.max(1, Math.floor(input.ttlDays ?? DEFAULT_TTL_DAYS))
  );
  expiresAt.setUTCDate(expiresAt.getUTCDate() + ttlDays);
  const scopes = Array.from(new Set(input.scopes));
  if (scopes.length === 0) throw new Error('Quote access requires a scope.');

  const result = await database.query(
    `
      insert into quote_access_tokens (
        quote_request_id,
        quote_offer_version_id,
        token_hash,
        token_prefix,
        scopes,
        created_at,
        expires_at
      )
      values ($1, $2, $3, $4, $5::text[], $6, $7)
      returning id
    `,
    [
      input.quoteRequestId,
      input.quoteOfferVersionId ?? null,
      hashQuoteSecret(token),
      token.slice(0, 16),
      scopes,
      createdAt.toISOString(),
      expiresAt.toISOString()
    ]
  );
  const tokenId = String(result.rows[0]?.id ?? '');
  if (!normalizeQuoteAccessId(tokenId)) {
    throw new Error('Quote access insert did not return a valid id.');
  }
  return {
    tokenId,
    token,
    tokenPrefix: token.slice(0, 16),
    quoteRequestId: input.quoteRequestId,
    quoteOfferVersionId: input.quoteOfferVersionId ?? null,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString()
  };
}

export async function exchangeQuoteAccessToken(
  database: Queryable,
  token: string,
  requiredScope: QuoteAccessScope
): Promise<(VerifiedQuoteAccess & { csrfToken: string }) | null> {
  if (!isQuoteAccessToken(token)) return null;
  const csrfToken = randomBytes(32).toString('base64url');
  const result = await database.query(
    `
      with candidate as materialized (
        select id, quote_request_id
        from quote_access_tokens
        where token_hash = $1
          and $2 = any(scopes)
          and revoked_at is null
          and expires_at > now()
        limit 1
      ), workflow_lock as materialized (
        select
          candidate.id,
          pg_advisory_xact_lock(
            hashtextextended('${QUOTE_WORKFLOW_LOCK_PREFIX}' || candidate.quote_request_id::text, 0)
          ) as acquired
        from candidate
      )
      update quote_access_tokens
      set last_used_at = now(),
          csrf_token_hash = $3
      from workflow_lock
      where quote_access_tokens.id = workflow_lock.id
      returning
        quote_access_tokens.id,
        quote_access_tokens.quote_request_id,
        quote_access_tokens.quote_offer_version_id,
        quote_access_tokens.scopes,
        quote_access_tokens.expires_at
    `,
    [hashQuoteSecret(token.trim()), requiredScope, hashQuoteSecret(csrfToken)]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    tokenId: String(row.id),
    quoteRequestId: Number(row.quote_request_id),
    quoteOfferVersionId:
      row.quote_offer_version_id === null
        ? null
        : Number(row.quote_offer_version_id),
    scopes: validScopes(row.scopes),
    expiresAt:
      row.expires_at instanceof Date
        ? row.expires_at.toISOString()
        : String(row.expires_at),
    accessSessionHash: hashQuoteSecret(csrfToken),
    csrfToken
  };
}

export async function verifyQuoteAccessSession(
  database: Queryable,
  request: NextRequest,
  input: {
    scope: QuoteAccessScope;
    quoteRequestId?: number;
    quoteOfferVersionId?: number;
    requireCsrf?: boolean;
  }
): Promise<VerifiedQuoteAccess | null> {
  const sessions = quoteSessions(request);
  if (sessions.length === 0) return null;
  const csrfToken = request.headers.get('x-quote-csrf-token')?.trim() ?? '';
  if (input.requireCsrf && !/^[A-Za-z0-9_-]{43}$/u.test(csrfToken)) return null;

  const params: unknown[] = [
    sessions.map((entry) => hashQuoteSecret(entry.token)),
    sessions.map((entry) => entry.accessId),
    input.scope,
    input.requireCsrf ? hashQuoteSecret(csrfToken) : null
  ];
  const requestClause =
    input.quoteRequestId === undefined
      ? ''
      : `and access.quote_request_id = $${params.push(input.quoteRequestId)}`;
  const versionClause =
    input.quoteOfferVersionId === undefined
      ? ''
      : `and access.quote_offer_version_id = $${params.push(
          input.quoteOfferVersionId
        )}`;
  const result = await database.query(
    `
      with candidates as (
        select token_hash, access_id, position
        from unnest($1::text[], $2::uuid[])
          with ordinality as candidate(token_hash, access_id, position)
      ), matched as (
        select access.id, access.quote_request_id
        from candidates candidate
        join quote_access_tokens access
          on access.token_hash = candidate.token_hash
         and access.id = candidate.access_id
        where $3 = any(access.scopes)
          and access.revoked_at is null
          and access.expires_at > now()
          and ($4::text is null or access.csrf_token_hash = $4)
          ${requestClause}
          ${versionClause}
        order by candidate.position
        limit 1
      ), workflow_lock as materialized (
        select
          matched.id,
          pg_advisory_xact_lock(
            hashtextextended('${QUOTE_WORKFLOW_LOCK_PREFIX}' || matched.quote_request_id::text, 0)
          ) as acquired
        from matched
      )
      update quote_access_tokens access
      set last_used_at = now()
      from workflow_lock
      where access.id = workflow_lock.id
      returning
        access.id,
        access.quote_request_id,
        access.quote_offer_version_id,
        access.scopes,
        access.expires_at
    `,
    params
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    tokenId: String(row.id),
    quoteRequestId: Number(row.quote_request_id),
    quoteOfferVersionId:
      row.quote_offer_version_id === null
        ? null
        : Number(row.quote_offer_version_id),
    scopes: validScopes(row.scopes),
    expiresAt:
      row.expires_at instanceof Date
        ? row.expires_at.toISOString()
        : String(row.expires_at),
    accessSessionHash: input.requireCsrf
      ? hashQuoteSecret(csrfToken)
      : null
  };
}

export async function revokeQuoteAccessForOffer(
  database: Queryable,
  quoteOfferVersionId: number
): Promise<number> {
  const result = await database.query(
    `
      update quote_access_tokens
      set revoked_at = now()
      where quote_offer_version_id = $1
        and revoked_at is null
    `,
    [quoteOfferVersionId]
  );
  return result.rowCount ?? 0;
}

export function buildQuoteRequestConfirmationUrl(token: string): string {
  if (!isQuoteAccessToken(token)) throw new Error('Invalid quote access token.');
  return `/quote-request/confirmation#token=${encodeURIComponent(token.trim())}`;
}

export function buildQuoteOfferReviewUrl(token: string): string {
  if (!isQuoteAccessToken(token)) throw new Error('Invalid quote access token.');
  return `/quote/offer#token=${encodeURIComponent(token.trim())}`;
}
