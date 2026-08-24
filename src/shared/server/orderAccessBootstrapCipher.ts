import 'server-only';

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes
} from 'node:crypto';

const KEY_ENVIRONMENT_NAME = 'ORDER_ACCESS_BOOTSTRAP_KEY';
const MINIMUM_KEY_CHARACTERS = 32;
const KEY_DERIVATION_DOMAIN = 'atehna/order-access-bootstrap/aes-256-gcm/v1';

export type EncryptedOrderAccessBootstrap = {
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

function additionalAuthenticatedData(keyHash: string, orderId: number): Buffer {
  return Buffer.from(`${KEY_DERIVATION_DOMAIN}\0${keyHash}\0${orderId}`, 'utf8');
}

export function encryptOrderAccessBootstrap(
  token: string,
  keyHash: string,
  orderId: number
): EncryptedOrderAccessBootstrap {
  const initializationVector = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), initializationVector);
  cipher.setAAD(additionalAuthenticatedData(keyHash, orderId));
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

export function decryptOrderAccessBootstrap(
  encrypted: EncryptedOrderAccessBootstrap,
  keyHash: string,
  orderId: number
): string {
  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(encrypted.initializationVector, 'base64url')
  );
  decipher.setAAD(additionalAuthenticatedData(keyHash, orderId));
  decipher.setAuthTag(Buffer.from(encrypted.authenticationTag, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, 'base64url')),
    decipher.final()
  ]).toString('utf8');
}
