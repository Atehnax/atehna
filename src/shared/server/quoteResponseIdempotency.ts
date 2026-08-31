import 'server-only';

import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { EncryptedOrderAccessBootstrap } from '@/shared/server/orderAccessBootstrapCipher';

export type QuoteResponseAction = 'accept' | 'decline' | 'purchase_order';

export type StoredQuoteResponse = {
  httpStatus: number;
  code?: string;
  message?: string;
  orderId?: number;
  orderAccessId?: string;
  status?: string;
};

export class QuoteResponseIdempotencyError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'QuoteResponseIdempotencyError';
    this.code = code;
  }
}

export function quoteResponseSha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function readQuoteResponseIdempotencyKey(
  request: Request,
  body?: Record<string, unknown>
): string {
  const value = String(
    request.headers.get('idempotency-key') ?? body?.idempotencyKey ?? ''
  ).trim();
  if (
    value.length < 8 ||
    value.length > 200 ||
    /[\s\u0000-\u001f\u007f]/u.test(value)
  ) {
    throw new QuoteResponseIdempotencyError(
      'IDEMPOTENCY_KEY_REQUIRED',
      'Zahteva mora vsebovati veljaven Idempotency-Key.'
    );
  }
  return value;
}

export async function reserveQuoteResponseIdempotency(
  client: PoolClient,
  input: {
    keyHash: string;
    requestHash: string;
    quoteOfferVersionId: number;
    action: QuoteResponseAction;
  }
): Promise<
  | { kind: 'new' }
  | {
      kind: 'replay';
      response: StoredQuoteResponse;
      bootstrap: EncryptedOrderAccessBootstrap | null;
    }
> {
  const inserted = await client.query(
    `
      insert into quote_response_idempotency_keys (
        key_hash,
        request_hash,
        quote_offer_version_id,
        response_action
      )
      values ($1, $2, $3, $4)
      on conflict (key_hash) do nothing
      returning id
    `,
    [
      input.keyHash,
      input.requestHash,
      input.quoteOfferVersionId,
      input.action
    ]
  );
  if (inserted.rowCount === 1) return { kind: 'new' };
  const existing = await client.query(
    `
      select *
      from quote_response_idempotency_keys
      where key_hash = $1
      for update
    `,
    [input.keyHash]
  );
  const row = existing.rows[0];
  if (
    !row ||
    row.request_hash !== input.requestHash ||
    Number(row.quote_offer_version_id) !== input.quoteOfferVersionId ||
    row.response_action !== input.action
  ) {
    throw new QuoteResponseIdempotencyError(
      'IDEMPOTENCY_KEY_CONFLICT',
      'Idempotency-Key je bil že uporabljen za drugo dejanje.'
    );
  }
  if (!row.completed_at || !row.response_json) {
    throw new QuoteResponseIdempotencyError(
      'QUOTE_RESPONSE_IN_PROGRESS',
      'Odgovor s tem ključem se še obdeluje.'
    );
  }
  const hasBootstrap =
    row.bootstrap_token_ciphertext &&
    row.bootstrap_token_iv &&
    row.bootstrap_token_tag;
  return {
    kind: 'replay',
    response: row.response_json as StoredQuoteResponse,
    bootstrap: hasBootstrap
      ? {
          ciphertext: String(row.bootstrap_token_ciphertext),
          initializationVector: String(row.bootstrap_token_iv),
          authenticationTag: String(row.bootstrap_token_tag)
        }
      : null
  };
}

export async function completeQuoteResponseIdempotency(
  client: PoolClient,
  input: {
    keyHash: string;
    response: StoredQuoteResponse;
    bootstrap?: EncryptedOrderAccessBootstrap | null;
  }
): Promise<void> {
  await client.query(
    `
      update quote_response_idempotency_keys
      set response_json = $2::jsonb,
          bootstrap_token_ciphertext = $3,
          bootstrap_token_iv = $4,
          bootstrap_token_tag = $5,
          completed_at = now()
      where key_hash = $1
    `,
    [
      input.keyHash,
      JSON.stringify(input.response),
      input.bootstrap?.ciphertext ?? null,
      input.bootstrap?.initializationVector ?? null,
      input.bootstrap?.authenticationTag ?? null
    ]
  );
}
