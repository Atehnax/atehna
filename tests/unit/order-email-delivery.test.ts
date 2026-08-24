import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  classifyResendFailure,
  createOrderEmailDeliveryEnvelope,
  MAX_RESEND_RETRY_AFTER_MS,
  MIN_RESEND_RETRY_AFTER_MS,
  OrderEmailDeliveryEnvelopeValidationError,
  parseOrderEmailDeliveryEnvelope,
  parseResendRetryAfterMs,
  redactOrderEmailDeliveryEnvelope,
  serializeOrderEmailDeliveryEnvelope,
  type ResendFailure
} from '@/shared/domain/order/orderEmailDelivery';
import {
  cloneOrderEmailSettings,
  toStoredOrderEmailSettings
} from '@/shared/domain/order/orderEmailSettings';
import {
  buildOrderEmailMessage,
  type OrderEmailJobPayload
} from '@/shared/domain/order/orderEmailTemplates';

function payload(): OrderEmailJobPayload {
  const settings = cloneOrderEmailSettings();
  settings.enabled = true;
  settings.fromEmail = 'orders@mail.atehna-test.site';
  settings.replyToEmail = 'narocila@atehna.si';
  settings.adminRecipients = ['admin@atehna.si'];

  return {
    eventType: 'partially_sent',
    audience: 'customer',
    recipientEmail: 'kupec@example.com',
    recipientName: 'Ana Kupec',
    occurredAt: '2026-08-24T08:30:00.000Z',
    previousStatus: 'in_progress',
    settingsSnapshot: toStoredOrderEmailSettings(settings),
    order: {
      orderId: 42,
      orderNumber: '#42',
      createdAt: '2026-08-24T08:15:00.000Z',
      customer: {
        organizationName: null,
        contactName: 'Ana Kupec',
        email: 'kupec@example.com',
        reference: null
      },
      items: [
        {
          sku: 'SKU-1',
          name: 'Varen izdelek',
          unit: 'kos',
          quantity: 2,
          lineGross: 24.4
        }
      ],
      totals: {
        net: 20,
        tax: 4.4,
        shipping: 0,
        gross: 24.4,
      }
    }
  };
}

function mutableJsonObject(serialized: string): Record<string, unknown> {
  return JSON.parse(serialized) as Record<string, unknown>;
}

describe('persisted order email delivery envelope', () => {
  test('renders once and snapshots the exact immutable provider message', () => {
    const source = payload();
    const expectedMessage = buildOrderEmailMessage(source);
    const envelope = createOrderEmailDeliveryEnvelope(source);

    assert.deepEqual(envelope.message, expectedMessage);
    assert.deepEqual(envelope.recipient, {
      email: expectedMessage.to,
      name: 'Ana Kupec'
    });
    assert.equal(envelope.version, 1);
    assert.equal(envelope.eventType, 'partially_sent');
    assert.equal(envelope.audience, 'customer');
    assert.equal(Object.isFrozen(envelope), true);
    assert.equal(Object.isFrozen(envelope.message), true);
    assert.equal(Object.isFrozen(envelope.recipient), true);

    source.order.orderNumber = '#changed-after-enqueue';
    source.settingsSnapshot.subjectPrefix = 'Changed';
    assert.deepEqual(envelope.message, expectedMessage);
  });

  test('serializes and strictly parses JSONB without changing the message', () => {
    const envelope = createOrderEmailDeliveryEnvelope(payload());
    const serialized = serializeOrderEmailDeliveryEnvelope(envelope);
    const parsed = parseOrderEmailDeliveryEnvelope(serialized);

    assert.deepEqual(parsed, envelope);
    assert.deepEqual(parsed.message, buildOrderEmailMessage(payload()));
  });

  test('rejects malformed, mismatched, injected, and forward-version payloads', () => {
    const serialized = serializeOrderEmailDeliveryEnvelope(
      createOrderEmailDeliveryEnvelope(payload())
    );

    const unknownField = mutableJsonObject(serialized);
    unknownField.unexpected = true;
    assert.throws(
      () => parseOrderEmailDeliveryEnvelope(unknownField),
      OrderEmailDeliveryEnvelopeValidationError
    );

    const futureVersion = mutableJsonObject(serialized);
    futureVersion.version = 2;
    assert.throws(
      () => parseOrderEmailDeliveryEnvelope(futureVersion),
      /\$\.version: must equal 1/u
    );

    const pluralAudience = mutableJsonObject(serialized);
    pluralAudience.audience = 'admins';
    assert.throws(
      () => parseOrderEmailDeliveryEnvelope(pluralAudience),
      /customer.*admin/u
    );

    const unknownEvent = mutableJsonObject(serialized);
    unknownEvent.eventType = 'payment_paid';
    assert.throws(
      () => parseOrderEmailDeliveryEnvelope(unknownEvent),
      /supported order email event type/u
    );

    const mismatchedRecipient = mutableJsonObject(serialized);
    const mismatchedMessage = mismatchedRecipient.message as Record<string, unknown>;
    mismatchedMessage.to = 'drugi@example.com';
    assert.throws(
      () => parseOrderEmailDeliveryEnvelope(mismatchedRecipient),
      /must exactly match/u
    );

    const injectedHeader = mutableJsonObject(serialized);
    const injectedMessage = injectedHeader.message as Record<string, unknown>;
    injectedMessage.subject = 'Naročilo\r\nBcc: victim@example.com';
    assert.throws(
      () => parseOrderEmailDeliveryEnvelope(injectedHeader),
      /control characters/u
    );

    const missingText = mutableJsonObject(serialized);
    const incompleteMessage = missingText.message as Record<string, unknown>;
    delete incompleteMessage.text;
    assert.throws(
      () => parseOrderEmailDeliveryEnvelope(missingText),
      /\$\.message\.text: is required/u
    );

    assert.throws(
      () => parseOrderEmailDeliveryEnvelope('{not-json'),
      /must be valid JSON/u
    );
  });

  test('redacts all recipient and rendered content after terminal delivery', () => {
    const envelope = createOrderEmailDeliveryEnvelope(payload());
    const redacted = redactOrderEmailDeliveryEnvelope(envelope);

    assert.deepEqual(redacted, {
      version: 1,
      redacted: true,
      eventType: 'partially_sent',
      audience: 'customer'
    });
    const serialized = JSON.stringify(redacted);
    assert.doesNotMatch(serialized, /kupec@example\.com|Ana Kupec|Varen izdelek/u);
  });
});

describe('Resend failure classification', () => {
  const nowMs = Date.parse('2026-08-24T12:00:00.000Z');

  test('retries only network, 408, 425, 429, and 5xx failures', () => {
    const retryable: ResendFailure[] = [
      { kind: 'network' },
      { kind: 'http', status: 408 },
      { kind: 'http', status: 425 },
      { kind: 'http', status: 429 },
      { kind: 'http', status: 500 },
      { kind: 'http', status: 503 },
      { kind: 'http', status: 599 }
    ];
    for (const failure of retryable) {
      assert.equal(classifyResendFailure(failure, nowMs).disposition, 'retry');
    }

    for (const status of [301, 400, 401, 403, 409, 422, 499, 600]) {
      const classification = classifyResendFailure(
        { kind: 'http', status, retryAfter: '120' },
        nowMs
      );
      assert.equal(classification.disposition, 'terminal');
      assert.equal(classification.category, 'permanent_http');
      assert.equal(classification.retryAfterMs, null);
    }
  });

  test('honors Retry-After seconds and dates within strict bounds', () => {
    assert.equal(parseResendRetryAfterMs('120', nowMs), 120_000);
    assert.equal(
      parseResendRetryAfterMs('0', nowMs),
      MIN_RESEND_RETRY_AFTER_MS
    );
    assert.equal(
      parseResendRetryAfterMs('999999999999999999999', nowMs),
      MAX_RESEND_RETRY_AFTER_MS
    );
    assert.equal(
      parseResendRetryAfterMs(
        new Date(nowMs + 120_000).toUTCString(),
        nowMs
      ),
      120_000
    );
    assert.equal(parseResendRetryAfterMs('not-a-delay', nowMs), null);

    const rateLimited = classifyResendFailure(
      { kind: 'http', status: 429, retryAfter: '120' },
      nowMs
    );
    assert.deepEqual(rateLimited, {
      disposition: 'retry',
      category: 'rate_limited',
      status: 429,
      retryAfterMs: 120_000
    });
  });
});
