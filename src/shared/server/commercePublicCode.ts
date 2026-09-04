import 'server-only';

import { randomBytes } from 'node:crypto';
import {
  COMMERCE_PUBLIC_CODE_ALPHABET,
  COMMERCE_PUBLIC_CODE_BASE_LENGTH
} from '@/shared/domain/commercePublicCode';

const RANDOM_BYTE_LIMIT =
  Math.floor(256 / COMMERCE_PUBLIC_CODE_ALPHABET.length) *
  COMMERCE_PUBLIC_CODE_ALPHABET.length;

export function generateCommercePublicCodeBase(): string {
  let result = '';
  while (result.length < COMMERCE_PUBLIC_CODE_BASE_LENGTH) {
    const bytes = randomBytes(COMMERCE_PUBLIC_CODE_BASE_LENGTH);
    for (const byte of bytes) {
      if (byte >= RANDOM_BYTE_LIMIT) continue;
      result += COMMERCE_PUBLIC_CODE_ALPHABET[
        byte % COMMERCE_PUBLIC_CODE_ALPHABET.length
      ];
      if (result.length === COMMERCE_PUBLIC_CODE_BASE_LENGTH) break;
    }
  }
  return result;
}

export async function insertWithGeneratedCommercePublicCodeBase<T>(
  insert: (publicCodeBase: string) => Promise<Readonly<{ rows: T[] }>>,
  maximumAttempts = 5
): Promise<Readonly<{ publicCodeBase: string; row: T }>> {
  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    const publicCodeBase = generateCommercePublicCodeBase();
    const result = await insert(publicCodeBase);
    const row = result.rows[0];
    if (row !== undefined) return { publicCodeBase, row };
  }
  throw new Error(
    'A unique commerce public code could not be allocated after repeated attempts.'
  );
}
