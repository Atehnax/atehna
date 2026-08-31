import 'server-only';

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes
} from 'node:crypto';

const KEY_ENVIRONMENT_NAME = 'QUOTE_ACCESS_BOOTSTRAP_KEY';
const KEY_DOMAIN = 'atehna/quote-email-envelope/key/aes-256-gcm/v1';
const AAD_DOMAIN = 'atehna/quote-email-envelope/aad/v1';

export type EncryptedQuoteEmailEnvelope = {
  version: 1;
  algorithm: 'aes-256-gcm';
  ciphertext: string;
  initializationVector: string;
  authenticationTag: string;
};

function key(): Buffer {
  const secret = process.env[KEY_ENVIRONMENT_NAME]?.trim() ?? '';
  if (secret.length < 32) {
    throw new Error(`${KEY_ENVIRONMENT_NAME} must contain at least 32 characters.`);
  }
  return createHash('sha256')
    .update(KEY_DOMAIN, 'utf8')
    .update('\0', 'utf8')
    .update(secret, 'utf8')
    .digest();
}

function aad(jobId: string, requestId: number, offerVersionId: number | null): Buffer {
  return Buffer.from(
    `${AAD_DOMAIN}\0${jobId.toLowerCase()}\0${requestId}\0${offerVersionId ?? ''}`,
    'utf8'
  );
}

export function encryptQuoteEmailEnvelope(
  serialized: string,
  binding: { jobId: string; requestId: number; offerVersionId: number | null }
): EncryptedQuoteEmailEnvelope {
  const initializationVector = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), initializationVector);
  cipher.setAAD(aad(binding.jobId, binding.requestId, binding.offerVersionId));
  const ciphertext = Buffer.concat([
    cipher.update(serialized, 'utf8'),
    cipher.final()
  ]);
  return {
    version: 1,
    algorithm: 'aes-256-gcm',
    ciphertext: ciphertext.toString('base64url'),
    initializationVector: initializationVector.toString('base64url'),
    authenticationTag: cipher.getAuthTag().toString('base64url')
  };
}

export function decryptQuoteEmailEnvelope(
  value: unknown,
  binding: { jobId: string; requestId: number; offerVersionId: number | null }
): string {
  if (
    !value ||
    typeof value !== 'object' ||
    !('version' in value) ||
    value.version !== 1 ||
    !('algorithm' in value) ||
    value.algorithm !== 'aes-256-gcm' ||
    !('ciphertext' in value) ||
    !('initializationVector' in value) ||
    !('authenticationTag' in value) ||
    typeof value.ciphertext !== 'string' ||
    typeof value.initializationVector !== 'string' ||
    typeof value.authenticationTag !== 'string'
  ) {
    throw new Error('Invalid encrypted quote email envelope.');
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key(),
    Buffer.from(value.initializationVector, 'base64url')
  );
  decipher.setAAD(aad(binding.jobId, binding.requestId, binding.offerVersionId));
  decipher.setAuthTag(Buffer.from(value.authenticationTag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(value.ciphertext, 'base64url')),
    decipher.final()
  ]).toString('utf8');
}
