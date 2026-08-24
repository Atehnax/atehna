import 'server-only';

import { createHash, randomBytes } from 'crypto';
import type { NextRequest, NextResponse } from 'next/server';
import type { Pool, PoolClient } from 'pg';

export type OrderAccessScope = 'confirmation' | 'purchase_order';

type Queryable = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;

export type IssuedOrderAccessToken = {
  tokenId: string;
  token: string;
  tokenPrefix: string;
  createdAt: string;
  expiresAt: string;
};

export type VerifiedOrderAccess = {
  tokenId: string;
  orderId: number;
  scopes: OrderAccessScope[];
  expiresAt: string;
};

const TOKEN_PREFIX = 'ath_order_';
const TOKEN_PATTERN = /^ath_order_[A-Za-z0-9_-]{43}$/u;
const ACCESS_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const ACCESS_SESSION_COOKIE_PREFIX = 'ath_order_access_';
const DEFAULT_TOKEN_TTL_DAYS = 90;
const MIN_TOKEN_TTL_DAYS = 1;
const MAX_TOKEN_TTL_DAYS = 365;

export function hashOrderAccessToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function isOrderAccessToken(token: string): boolean {
  return TOKEN_PATTERN.test(token.trim());
}

export function normalizeOrderAccessId(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase() ?? '';
  return ACCESS_ID_PATTERN.test(normalized) ? normalized : null;
}

export function orderAccessSessionCookieName(accessId: string): string | null {
  const normalizedAccessId = normalizeOrderAccessId(accessId);
  if (!normalizedAccessId) return null;
  return `${ACCESS_SESSION_COOKIE_PREFIX}${normalizedAccessId.replaceAll('-', '')}`;
}

export function setOrderAccessSessionCookie(
  response: NextResponse,
  session: Pick<IssuedOrderAccessToken, 'tokenId' | 'token' | 'expiresAt'>
): void {
  const cookieName = orderAccessSessionCookieName(session.tokenId);
  if (!cookieName || !isOrderAccessToken(session.token)) {
    throw new Error('Cannot create an order access session from invalid credentials.');
  }

  const expires = new Date(session.expiresAt);
  if (Number.isNaN(expires.getTime())) {
    throw new Error('Cannot create an order access session with an invalid expiry.');
  }

  response.cookies.set({
    name: cookieName,
    value: session.token.trim(),
    expires,
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/orders'
  });
}

export function readOrderAccessSession(
  request: NextRequest
): { accessId: string; token: string } | null {
  const accessId = normalizeOrderAccessId(request.headers.get('x-order-access-id'));
  if (!accessId) return null;
  const cookieName = orderAccessSessionCookieName(accessId);
  if (!cookieName) return null;
  const token = request.cookies.get(cookieName)?.value?.trim() ?? '';
  return isOrderAccessToken(token) ? { accessId, token } : null;
}

function accessIdFromSessionCookieName(cookieName: string): string | null {
  if (!cookieName.startsWith(ACCESS_SESSION_COOKIE_PREFIX)) return null;
  const compactId = cookieName.slice(ACCESS_SESSION_COOKIE_PREFIX.length);
  if (!/^[0-9a-f]{32}$/iu.test(compactId)) return null;
  return normalizeOrderAccessId(
    `${compactId.slice(0, 8)}-${compactId.slice(8, 12)}-${compactId.slice(12, 16)}-${compactId.slice(16, 20)}-${compactId.slice(20)}`
  );
}

export async function verifyOrderAccessSessionForOrder(
  database: Queryable,
  request: NextRequest,
  requiredScope: OrderAccessScope,
  expectedOrderId: number
): Promise<VerifiedOrderAccess | null> {
  const selectedSession = readOrderAccessSession(request);
  const candidates = new Map<string, string>();
  if (selectedSession) {
    candidates.set(selectedSession.accessId, selectedSession.token);
  }

  for (const cookie of request.cookies.getAll()) {
    const accessId = accessIdFromSessionCookieName(cookie.name);
    const token = cookie.value.trim();
    if (!accessId || !isOrderAccessToken(token) || candidates.has(accessId)) continue;
    candidates.set(accessId, token);
  }

  if (candidates.size === 0) return null;

  const candidateEntries = Array.from(candidates, ([accessId, token]) => ({
    accessId,
    tokenHash: hashOrderAccessToken(token)
  }));
  const result = await database.query(
    `
      with candidates as (
        select token_hash, access_id, candidate_position
        from unnest($1::text[], $2::uuid[])
          with ordinality as candidate(token_hash, access_id, candidate_position)
      ), matched as (
        select access.id
        from candidates candidate
        join order_access_tokens access
          on access.token_hash = candidate.token_hash
         and access.id = candidate.access_id
        where access.order_id = $3
          and $4 = any(access.scopes)
          and access.revoked_at is null
          and access.expires_at > now()
        order by candidate.candidate_position
        limit 1
      )
      update order_access_tokens access
      set last_used_at = now()
      from matched
      where access.id = matched.id
      returning access.id, access.order_id, access.scopes, access.expires_at
    `,
    [
      candidateEntries.map((candidate) => candidate.tokenHash),
      candidateEntries.map((candidate) => candidate.accessId),
      expectedOrderId,
      requiredScope
    ]
  );
  const row = result.rows[0] as
    | { id: string; order_id: string | number; scopes: string[]; expires_at: string | Date }
    | undefined;
  if (!row) return null;

  return {
    tokenId: String(row.id),
    orderId: Number(row.order_id),
    scopes: row.scopes.filter(
      (scope): scope is OrderAccessScope => scope === 'confirmation' || scope === 'purchase_order'
    ),
    expiresAt:
      row.expires_at instanceof Date ? row.expires_at.toISOString() : String(row.expires_at)
  };
}

export function buildOrderConfirmationAccessUrl(token: string): string {
  if (!isOrderAccessToken(token)) {
    throw new Error('Cannot build an order confirmation URL from an invalid access token.');
  }
  return `/order/confirmation#token=${encodeURIComponent(token.trim())}`;
}

export function buildPurchaseOrderAccessUrl(token: string): string {
  if (!isOrderAccessToken(token)) {
    throw new Error('Cannot build a purchase-order URL from an invalid access token.');
  }
  return `/order/narocilnica#token=${encodeURIComponent(token.trim())}`;
}

function normalizeTtlDays(value?: number): number {
  if (!Number.isFinite(value)) return DEFAULT_TOKEN_TTL_DAYS;
  return Math.min(MAX_TOKEN_TTL_DAYS, Math.max(MIN_TOKEN_TTL_DAYS, Math.floor(value!)));
}

function buildExpiry(ttlDays?: number): Date {
  const expiresAt = new Date();
  expiresAt.setUTCDate(expiresAt.getUTCDate() + normalizeTtlDays(ttlDays));
  return expiresAt;
}

export async function issueOrderAccessToken(
  database: Queryable,
  orderId: number,
  options?: {
    ttlDays?: number;
    scopes?: OrderAccessScope[];
  }
): Promise<IssuedOrderAccessToken> {
  const token = `${TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
  const tokenHash = hashOrderAccessToken(token);
  const tokenPrefix = token.slice(0, 16);
  const createdAt = new Date();
  const expiresAt = buildExpiry(options?.ttlDays);
  const scopes = options?.scopes?.length
    ? Array.from(new Set(options.scopes))
    : ['confirmation'];

  const result = await database.query(
    `
      insert into order_access_tokens (
        order_id,
        token_hash,
        token_prefix,
        scopes,
        created_at,
        expires_at
      )
      values ($1, $2, $3, $4::text[], $5, $6)
      returning id
    `,
    [
      orderId,
      tokenHash,
      tokenPrefix,
      scopes,
      createdAt.toISOString(),
      expiresAt.toISOString()
    ]
  );
  const tokenId = String(result.rows[0]?.id ?? '');
  if (!normalizeOrderAccessId(tokenId)) {
    throw new Error('Order access token insert did not return a valid id.');
  }

  return {
    tokenId,
    token,
    tokenPrefix,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString()
  };
}

export async function verifyOrderAccessToken(
  database: Queryable,
  token: string,
  requiredScope: OrderAccessScope,
  expectedOrderId?: number
): Promise<VerifiedOrderAccess | null> {
  const normalizedToken = token.trim();
  if (!isOrderAccessToken(normalizedToken)) return null;

  const tokenHash = hashOrderAccessToken(normalizedToken);
  const params: unknown[] = [tokenHash, requiredScope];
  const expectedOrderClause = Number.isFinite(expectedOrderId)
    ? `and order_id = $${params.push(expectedOrderId)}`
    : '';

  const result = await database.query(
    `
      update order_access_tokens
      set last_used_at = now()
      where token_hash = $1
        and $2 = any(scopes)
        and revoked_at is null
        and expires_at > now()
        ${expectedOrderClause}
      returning id, order_id, scopes, expires_at
    `,
    params
  );

  const row = result.rows[0] as
    | { id: string; order_id: string | number; scopes: string[]; expires_at: string | Date }
    | undefined;
  if (!row) return null;

  return {
    tokenId: String(row.id),
    orderId: Number(row.order_id),
    scopes: row.scopes.filter(
      (scope): scope is OrderAccessScope => scope === 'confirmation' || scope === 'purchase_order'
    ),
    expiresAt:
      row.expires_at instanceof Date ? row.expires_at.toISOString() : String(row.expires_at)
  };
}

export async function revokeOrderAccessTokens(
  database: Queryable,
  orderId: number
): Promise<number> {
  const result = await database.query(
    `
      update order_access_tokens
      set revoked_at = now()
      where order_id = $1
        and revoked_at is null
      returning id
    `,
    [orderId]
  );

  return result.rowCount ?? 0;
}
