import 'server-only';

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes
} from 'node:crypto';

const KEY_ENVIRONMENT_NAME = 'QUOTE_ACCESS_BOOTSTRAP_KEY';
const MINIMUM_KEY_CHARACTERS = 32;
const KEY_DERIVATION_DOMAIN = 'atehna/quote-access-bootstrap/aes-256-gcm/v1';

export type EncryptedQuoteAccessBootstrap = {
  ciphertext: string;
  initializationVector: string;
  authenticationTag: string;
};

function encryptionKey(): Buffer {
  const secret = process.env[KEY_ENVIRONMENT_NAME]?.trim() ?? '';
  if (secret.length < MINIMUM_KEY_CHARACTERS) {
    throw new Error(
      `${KEY_ENVIRONMENT_NAME} must contain at least ${MINIMUM_KEY_CHARACTERS} characters.`
    );
  }
  return createHash('sha256')
    .update(KEY_DERIVATION_DOMAIN, 'utf8')
    .update('\0', 'utf8')
    .update(secret, 'utf8')
    .digest();
}

function aad(keyHash: string, aggregateId: number): Buffer {
  return Buffer.from(
    `${KEY_DERIVATION_DOMAIN}\0${keyHash}\0${aggregateId}`,
    'utf8'
  );
}

export function encryptQuoteAccessBootstrap(
  token: string,
  keyHash: string,
  aggregateId: number
): EncryptedQuoteAccessBootstrap {
  const initializationVector = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), initializationVector);
  cipher.setAAD(aad(keyHash, aggregateId));
  const ciphertext = Buffer.concat([
    cipher.update(token, 'utf8'),
    cipher.final()
  ]);
  return {
    ciphertext: ciphertext.toString('base64url'),
    initializationVector: initializationVector.toString('base64url'),
    authenticationTag: cipher.getAuthTag().toString('base64url')
  };
}

export function decryptQuoteAccessBootstrap(
  encrypted: EncryptedQuoteAccessBootstrap,
  keyHash: string,
  aggregateId: number
): string {
  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(encrypted.initializationVector, 'base64url')
  );
  decipher.setAAD(aad(keyHash, aggregateId));
  decipher.setAuthTag(Buffer.from(encrypted.authenticationTag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, 'base64url')),
    decipher.final()
  ]).toString('utf8');
}
