import 'server-only';

import { createHash, randomBytes } from 'crypto';
import type { Pool, PoolClient } from 'pg';

export type OrderAccessScope = 'confirmation' | 'purchase_order';

type Queryable = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;

export type IssuedOrderAccessToken = {
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
const DEFAULT_TOKEN_TTL_DAYS = 90;
const MIN_TOKEN_TTL_DAYS = 1;
const MAX_TOKEN_TTL_DAYS = 365;

export function hashOrderAccessToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
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
    : ['confirmation', 'purchase_order'];

  await database.query(
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

  return {
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
  if (!normalizedToken.startsWith(TOKEN_PREFIX) || normalizedToken.length < 40) return null;

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

export function readBearerToken(request: Request): string | null {
  const authorization = request.headers.get('authorization')?.trim() ?? '';
  if (!authorization.toLowerCase().startsWith('bearer ')) return null;
  const token = authorization.slice(7).trim();
  return token || null;
}
