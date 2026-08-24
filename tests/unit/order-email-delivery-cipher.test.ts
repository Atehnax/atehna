import assert from 'node:assert/strict';
import test from 'node:test';
import {
  decryptOrderEmailDeliveryEnvelope,
  encryptOrderEmailDeliveryEnvelope,
  type EncryptedOrderEmailDeliveryEnvelope
} from '../../src/shared/server/orderEmailDeliveryCipher';

const JOB_ID = '9c66c514-e949-45bd-b8ad-8d45834a9acc';
const OTHER_JOB_ID = '3894668a-a50f-4a3c-96d8-c4d1aacfc3aa';
const ORDER_ID = 812;
const SECRET = 'test-order-email-envelope-secret-1-234567890';
const OTHER_SECRET = 'test-order-email-envelope-secret-2-234567890';
const ACCESS_TOKEN = `ath_order_${'S'.repeat(43)}`;

function withSecret<T>(secret: string, operation: () => T): T {
  const previous = process.env.ORDER_ACCESS_BOOTSTRAP_KEY;
  process.env.ORDER_ACCESS_BOOTSTRAP_KEY = secret;
  try {
    return operation();
  } finally {
    if (previous === undefined) {
      delete process.env.ORDER_ACCESS_BOOTSTRAP_KEY;
    } else {
      process.env.ORDER_ACCESS_BOOTSTRAP_KEY = previous;
    }
  }
}

function encryptedFixture(): {
  plaintext: string;
  encrypted: EncryptedOrderEmailDeliveryEnvelope;
} {
  const plaintext = JSON.stringify({
    version: 2,
    message: {
      subject: 'Purchase order upload',
      html: `<a href="https://www.atehna-test.site/order/narocilnica#token=${ACCESS_TOKEN}">Upload</a>`,
      text: `Upload: https://www.atehna-test.site/order/narocilnica#token=${ACCESS_TOKEN}`
    }
  });
  const encrypted = withSecret(SECRET, () =>
    encryptOrderEmailDeliveryEnvelope(plaintext, JOB_ID, ORDER_ID)
  );
  return { plaintext, encrypted };
}

test('round-trips a serialized delivery envelope', () => {
  const { plaintext, encrypted } = encryptedFixture();

  assert.equal(encrypted.version, 1);
  assert.equal(encrypted.algorithm, 'aes-256-gcm');
  assert.equal(
    withSecret(SECRET, () =>
      decryptOrderEmailDeliveryEnvelope(encrypted, JOB_ID, ORDER_ID)
    ),
    plaintext
  );
});

test('binds authenticated ciphertext to both job UUID and order ID', () => {
  const { encrypted } = encryptedFixture();

  assert.throws(() =>
    withSecret(SECRET, () =>
      decryptOrderEmailDeliveryEnvelope(encrypted, OTHER_JOB_ID, ORDER_ID)
    )
  );
  assert.throws(() =>
    withSecret(SECRET, () =>
      decryptOrderEmailDeliveryEnvelope(encrypted, JOB_ID, ORDER_ID + 1)
    )
  );
});

test('rejects ciphertext tampering and a different configured key', () => {
  const { encrypted } = encryptedFixture();
  const tampered: EncryptedOrderEmailDeliveryEnvelope = {
    ...encrypted,
    ciphertext: `${encrypted.ciphertext.startsWith('A') ? 'B' : 'A'}${
      encrypted.ciphertext.slice(1)
    }`
  };

  assert.throws(() =>
    withSecret(SECRET, () =>
      decryptOrderEmailDeliveryEnvelope(tampered, JOB_ID, ORDER_ID)
    )
  );
  assert.throws(() =>
    withSecret(OTHER_SECRET, () =>
      decryptOrderEmailDeliveryEnvelope(encrypted, JOB_ID, ORDER_ID)
    )
  );
});

test('never persists an order-access token in the encrypted representation', () => {
  const { encrypted } = encryptedFixture();
  const persisted = JSON.stringify(encrypted);

  assert.doesNotMatch(persisted, /ath_order_/u);
  assert.doesNotMatch(persisted, new RegExp(ACCESS_TOKEN, 'u'));
});
