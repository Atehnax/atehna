import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  classifyOrderEmailDeliveryValidationFailure,
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
import { createPendingOrderEmailPdfDocumentReference } from '@/shared/domain/emailPdfAttachment';

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
    purchaseOrderUploadUrl: null,
    order: {
      orderCode: 'N-7K3M-4X9P-2D6R-8H4Q',
      createdAt: '2026-08-24T08:15:00.000Z',
      customer: {
        customerType: 'company',
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
          lineGross: 24.4,
          imageUrl: null
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
    assert.equal(envelope.version, 2);
    assert.equal(envelope.eventType, 'partially_sent');
    assert.equal(envelope.audience, 'customer');
    assert.equal(Object.isFrozen(envelope), true);
    assert.equal(Object.isFrozen(envelope.message), true);
    assert.equal(Object.isFrozen(envelope.recipient), true);

    source.order.items[0]!.name = 'Changed after enqueue';
    source.settingsSnapshot.subjectPrefix = 'Changed';
    assert.deepEqual(envelope.message, expectedMessage);
  });

  test('snapshots shared header, footer, and one image attachment while old v2 jobs remain readable', () => {
    const source = payload();
    source.settingsSnapshot.headerText = 'Skupna glava\nDruga vrstica';
    source.settingsSnapshot.footerText = 'Lep pozdrav,\nAtehna';
    source.settingsSnapshot.imageAttachment = {
      url: 'https://atehna.public.blob.vercel-storage.com/email/shared/brand-header.png',
      pathname: 'email/shared/brand-header.png',
      filename: 'brand-header.png',
      contentType: 'image/png',
      size: 1_024
    };

    const envelope = createOrderEmailDeliveryEnvelope(source);
    assert.deepEqual(envelope.message.attachments, [
      {
        path: 'https://atehna.public.blob.vercel-storage.com/email/shared/brand-header.png',
        filename: 'brand-header.png'
      }
    ]);
    assert.equal(Object.isFrozen(envelope.message.attachments), true);
    assert.equal(Object.isFrozen(envelope.message.attachments?.[0]), true);
    assert.ok(
      envelope.message.html.indexOf('Skupna glava') <
        envelope.message.html.indexOf('Pozdravljeni')
    );
    assert.ok(
      envelope.message.html.lastIndexOf('Lep pozdrav') >
        envelope.message.html.lastIndexOf('Skupaj z DDV')
    );
    assert.ok(
      envelope.message.text.startsWith(
        'Skupna glava\nDruga vrstica\n\nPozdravljeni'
      )
    );
    assert.ok(envelope.message.text.endsWith('Lep pozdrav,\nAtehna'));

    const legacyV2 = mutableJsonObject(
      serializeOrderEmailDeliveryEnvelope(envelope)
    );
    const legacyMessage = legacyV2.message as Record<string, unknown>;
    delete legacyMessage.attachments;
    const parsedLegacy = parseOrderEmailDeliveryEnvelope(legacyV2);
    assert.equal('attachments' in parsedLegacy.message, false);
  });

  test('snapshots one school upload fragment for retries and redacts it after delivery', () => {
    const source = payload() as Extract<
      OrderEmailJobPayload,
      { audience: 'customer' }
    >;
    const token = `ath_order_${'S'.repeat(43)}`;
    const uploadUrl =
      `https://www.atehna-test.site/order/narocilnica#token=${token}`;
    source.eventType = 'order_submitted';
    source.previousStatus = null;
    source.order.customer.customerType = 'school';
    source.purchaseOrderUploadUrl = uploadUrl;

    const envelope = createOrderEmailDeliveryEnvelope(source);
    const serialized = serializeOrderEmailDeliveryEnvelope(envelope);
    source.purchaseOrderUploadUrl =
      `https://www.atehna-test.site/order/narocilnica#token=ath_order_${'E'.repeat(43)}`;
    const firstAttempt = parseOrderEmailDeliveryEnvelope(serialized);
    const retryAttempt = parseOrderEmailDeliveryEnvelope(serialized);
    const output = [
      firstAttempt.message.subject,
      firstAttempt.message.html,
      firstAttempt.message.text
    ].join('\n');

    assert.equal(firstAttempt.version, 2);
    assert.deepEqual(retryAttempt.message, firstAttempt.message);
    assert.match(output, new RegExp(token, 'u'));
    assert.doesNotMatch(output, /ath_order_E{43}/u);
    assert.doesNotMatch(output, /\/order\/narocilnica\?token=/u);
    assert.doesNotMatch(
      JSON.stringify(redactOrderEmailDeliveryEnvelope(firstAttempt)),
      /ath_order_|narocilnica/u
    );
  });

  test('serializes and strictly parses JSONB without changing the message', () => {
    const envelope = createOrderEmailDeliveryEnvelope(payload());
    const serialized = serializeOrderEmailDeliveryEnvelope(envelope);
    const parsed = parseOrderEmailDeliveryEnvelope(serialized);

    assert.deepEqual(parsed, envelope);
    assert.deepEqual(parsed.message, buildOrderEmailMessage(payload()));
  });

  test('accepts only customer PDFs whose document type exactly matches the event', () => {
    const source = payload();
    source.eventType = 'order_submitted';
    source.previousStatus = null;
    const summary = createPendingOrderEmailPdfDocumentReference(
      42,
      'order_summary',
      1
    );
    const envelope = createOrderEmailDeliveryEnvelope(source, {
      pdfDocument: summary
    });
    assert.deepEqual(envelope.pdfDocument, summary);
    assert.deepEqual(
      parseOrderEmailDeliveryEnvelope(
        serializeOrderEmailDeliveryEnvelope(envelope)
      ).pdfDocument,
      summary
    );

    const adminAttachment = mutableJsonObject(
      serializeOrderEmailDeliveryEnvelope(envelope)
    );
    adminAttachment.audience = 'admin';
    assert.throws(
      () => parseOrderEmailDeliveryEnvelope(adminAttachment),
      /allowed only for a customer delivery/u
    );

    const wrongType = mutableJsonObject(
      serializeOrderEmailDeliveryEnvelope(envelope)
    );
    (wrongType.pdfDocument as Record<string, unknown>).documentType = 'invoice';
    assert.throws(
      () => parseOrderEmailDeliveryEnvelope(wrongType),
      /does not match the email event/u
    );

    const deliveryNote = createPendingOrderEmailPdfDocumentReference(
      42,
      'dobavnica',
      1
    );
    assert.throws(
      () => createOrderEmailDeliveryEnvelope(source, { pdfDocument: deliveryNote }),
      /does not match the email event/u
    );
  });

  test('rejects a seeded legacy v1 customer envelope as terminal invalid payload', () => {
    const legacyEnvelope = mutableJsonObject(
      serializeOrderEmailDeliveryEnvelope(
        createOrderEmailDeliveryEnvelope(payload())
      )
    );
    legacyEnvelope.version = 1;
    const legacyMessage = legacyEnvelope.message as Record<string, unknown>;
    legacyMessage.subject = '[Atehna] Naročilo #42 smo prejeli';
    legacyMessage.html = '<p>Prejeli smo naročilo #42.</p>';
    legacyMessage.text = 'Prejeli smo naročilo #42.';

    for (const processingPath of [
      'initial worker processing',
      'processing after manual retry'
    ]) {
      let parseError: unknown;
      try {
        parseOrderEmailDeliveryEnvelope(legacyEnvelope);
        assert.fail(`legacy v1 envelope must not pass ${processingPath}`);
      } catch (error) {
        parseError = error;
      }

      assert.ok(
        parseError instanceof OrderEmailDeliveryEnvelopeValidationError
      );
      assert.match(parseError.message, /\$\.version: must equal 2/u);
      assert.deepEqual(
        classifyOrderEmailDeliveryValidationFailure(parseError),
        {
          disposition: 'terminal',
          category: 'invalid_payload',
          status: null,
          retryAfterMs: null
        }
      );
    }
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
    futureVersion.version = 3;
    assert.throws(
      () => parseOrderEmailDeliveryEnvelope(futureVersion),
      /\$\.version: must equal 2/u
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

  test('rejects untrusted or malformed attachment snapshots', () => {
    const source = payload();
    source.settingsSnapshot.imageAttachment = {
      url: 'https://atehna.public.blob.vercel-storage.com/email/shared/header.png',
      pathname: 'email/shared/header.png',
      filename: 'header.png',
      contentType: 'image/png',
      size: 512
    };
    const serialized = serializeOrderEmailDeliveryEnvelope(
      createOrderEmailDeliveryEnvelope(source)
    );

    const untrustedHost = mutableJsonObject(serialized);
    const untrustedMessage = untrustedHost.message as Record<string, unknown>;
    const untrustedAttachments = untrustedMessage.attachments as Array<
      Record<string, unknown>
    >;
    untrustedAttachments[0]!.path = 'https://example.com/email/shared/header.png';
    assert.throws(
      () => parseOrderEmailDeliveryEnvelope(untrustedHost),
      /trusted shared image attachment/u
    );

    const unsafeFilename = mutableJsonObject(serialized);
    const unsafeMessage = unsafeFilename.message as Record<string, unknown>;
    const unsafeAttachments = unsafeMessage.attachments as Array<
      Record<string, unknown>
    >;
    unsafeAttachments[0]!.filename = '../header.png';
    assert.throws(
      () => parseOrderEmailDeliveryEnvelope(unsafeFilename),
      /trusted shared image attachment/u
    );

    const extraField = mutableJsonObject(serialized);
    const extraMessage = extraField.message as Record<string, unknown>;
    const extraAttachments = extraMessage.attachments as Array<
      Record<string, unknown>
    >;
    extraAttachments[0]!.contentId = 'inline-image';
    assert.throws(
      () => parseOrderEmailDeliveryEnvelope(extraField),
      /contentId: is not an allowed field/u
    );
  });

  test('redacts all recipient and rendered content after terminal delivery', () => {
    const envelope = createOrderEmailDeliveryEnvelope(payload());
    const redacted = redactOrderEmailDeliveryEnvelope(envelope);

    assert.deepEqual(redacted, {
      version: 2,
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
