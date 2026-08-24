import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes
} from 'node:crypto';

const KEY_ENVIRONMENT_NAME = 'ORDER_ACCESS_BOOTSTRAP_KEY';
const MINIMUM_KEY_CHARACTERS = 32;
const KEY_DERIVATION_DOMAIN =
  'atehna/order-email-delivery-envelope/key/aes-256-gcm/v1';
const ADDITIONAL_AUTHENTICATED_DATA_DOMAIN =
  'atehna/order-email-delivery-envelope/aad/v1';
const INITIALIZATION_VECTOR_BYTES = 12;
const AUTHENTICATION_TAG_BYTES = 16;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/u;

export type EncryptedOrderEmailDeliveryEnvelope = {
  version: 1;
  algorithm: 'aes-256-gcm';
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

function normalizedBinding(jobId: string, orderId: number): {
  jobId: string;
  orderId: number;
} {
  const normalizedJobId = jobId.trim().toLowerCase();
  if (!UUID_PATTERN.test(normalizedJobId)) {
    throw new Error('Order email delivery job ID must be a valid UUID.');
  }
  if (!Number.isSafeInteger(orderId) || orderId <= 0) {
    throw new Error('Order email delivery order ID must be a positive safe integer.');
  }
  return { jobId: normalizedJobId, orderId };
}

function additionalAuthenticatedData(jobId: string, orderId: number): Buffer {
  const binding = normalizedBinding(jobId, orderId);
  return Buffer.from(
    `${ADDITIONAL_AUTHENTICATED_DATA_DOMAIN}\0${binding.jobId}\0${binding.orderId}`,
    'utf8'
  );
}

function decodeBase64Url(value: unknown, field: string): Buffer {
  if (typeof value !== 'string' || !BASE64URL_PATTERN.test(value)) {
    throw new Error(`Encrypted order email ${field} must be base64url encoded.`);
  }
  return Buffer.from(value, 'base64url');
}

function encryptedParts(value: unknown): {
  ciphertext: Buffer;
  initializationVector: Buffer;
  authenticationTag: Buffer;
} {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('version' in value) ||
    value.version !== 1 ||
    !('algorithm' in value) ||
    value.algorithm !== 'aes-256-gcm'
  ) {
    throw new Error('Unsupported encrypted order email envelope.');
  }

  const ciphertext = decodeBase64Url(
    'ciphertext' in value ? value.ciphertext : null,
    'ciphertext'
  );
  const initializationVector = decodeBase64Url(
    'initializationVector' in value ? value.initializationVector : null,
    'initialization vector'
  );
  const authenticationTag = decodeBase64Url(
    'authenticationTag' in value ? value.authenticationTag : null,
    'authentication tag'
  );

  if (ciphertext.length === 0) {
    throw new Error('Encrypted order email ciphertext must not be empty.');
  }
  if (initializationVector.length !== INITIALIZATION_VECTOR_BYTES) {
    throw new Error('Encrypted order email initialization vector has an invalid length.');
  }
  if (authenticationTag.length !== AUTHENTICATION_TAG_BYTES) {
    throw new Error('Encrypted order email authentication tag has an invalid length.');
  }

  return { ciphertext, initializationVector, authenticationTag };
}

export function encryptOrderEmailDeliveryEnvelope(
  serializedEnvelope: string,
  jobId: string,
  orderId: number
): EncryptedOrderEmailDeliveryEnvelope {
  if (serializedEnvelope.length === 0) {
    throw new Error('Serialized order email delivery envelope must not be empty.');
  }

  const initializationVector = randomBytes(INITIALIZATION_VECTOR_BYTES);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), initializationVector);
  cipher.setAAD(additionalAuthenticatedData(jobId, orderId));
  const ciphertext = Buffer.concat([
    cipher.update(serializedEnvelope, 'utf8'),
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

export function decryptOrderEmailDeliveryEnvelope(
  encryptedEnvelope: unknown,
  jobId: string,
  orderId: number
): string {
  const encrypted = encryptedParts(encryptedEnvelope);
  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    encrypted.initializationVector
  );
  decipher.setAAD(additionalAuthenticatedData(jobId, orderId));
  decipher.setAuthTag(encrypted.authenticationTag);

  return Buffer.concat([
    decipher.update(encrypted.ciphertext),
    decipher.final()
  ]).toString('utf8');
}
