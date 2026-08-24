import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ORDER_STATUS_OPTIONS } from '@/shared/domain/order/orderStatus';
import {
  cloneOrderEmailSettings,
  DEFAULT_ORDER_EMAIL_SETTINGS,
  isOrderEmailEventType,
  normalizeOrderEmailSettings,
  ORDER_EMAIL_EVENT_DEFINITIONS,
  toStoredOrderEmailSettings,
  validateOrderEmailSettingsInput,
  type OrderEmailEventType,
  type OrderEmailSettings
} from '@/shared/domain/order/orderEmailSettings';
import {
  buildOrderEmailMessage,
  type OrderEmailJobPayload
} from '@/shared/domain/order/orderEmailTemplates';

const requestedEvents = new Set<OrderEmailEventType>([
  'order_submitted',
  'in_progress',
  'partially_sent',
  'sent'
]);

function configuredSettings(): OrderEmailSettings {
  const settings = cloneOrderEmailSettings();
  settings.enabled = true;
  settings.fromEmail = 'orders@mail.atehna-test.site';
  settings.adminRecipients = ['admin@atehna.si'];
  return settings;
}

function jobPayload(
  audience: OrderEmailJobPayload['audience'] = 'customer',
  eventType: OrderEmailEventType = 'order_submitted'
): OrderEmailJobPayload {
  return {
    eventType,
    audience,
    recipientEmail:
      audience === 'customer' ? 'kupec@example.com' : 'admin@atehna.si',
    recipientName: audience === 'customer' ? 'Ana <Kupec>' : 'Skrbnik',
    occurredAt: '2026-08-24T08:30:00.000Z',
    previousStatus: eventType === 'order_submitted' ? null : 'in_progress',
    settingsSnapshot: toStoredOrderEmailSettings(configuredSettings()),
    order: {
      orderId: 42,
      orderNumber: '#42 <script>alert(1)</script>',
      createdAt: '2026-08-24T08:15:00.000Z',
      customer: {
        organizationName: 'Primer & sinovi <d.o.o.>',
        contactName: 'Ana <Kupec>',
        email: 'kupec@example.com',
        reference: 'REF & <pomembno>'
      },
      items: [
        {
          sku: 'SKU-<1>',
          name: 'Izdelek <img src=x onerror=alert(1)> – Modra & velika',
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

describe('order email settings', () => {
  test('defines submission plus every canonical status event in stable order', () => {
    assert.deepEqual(
      ORDER_EMAIL_EVENT_DEFINITIONS.map((event) => event.value),
      ['order_submitted', ...ORDER_STATUS_OPTIONS.map((status) => status.value)]
    );
    assert.ok(
      ORDER_EMAIL_EVENT_DEFINITIONS.every(
        (event) => event.label.length > 0 && event.description.length > 0
      )
    );
    assert.equal(isOrderEmailEventType('partially_sent'), true);
    assert.equal(isOrderEmailEventType('payment_paid'), false);
  });

  test('uses safe disabled defaults and enables only the requested event matrix', () => {
    assert.equal(DEFAULT_ORDER_EMAIL_SETTINGS.enabled, false);
    assert.equal(DEFAULT_ORDER_EMAIL_SETTINGS.senderName, 'Atehna');
    assert.equal(DEFAULT_ORDER_EMAIL_SETTINGS.fromEmail, '');
    assert.equal(DEFAULT_ORDER_EMAIL_SETTINGS.replyToEmail, 'narocila@atehna.si');
    assert.deepEqual(DEFAULT_ORDER_EMAIL_SETTINGS.adminRecipients, []);
    assert.equal(DEFAULT_ORDER_EMAIL_SETTINGS.siteUrl, 'https://www.atehna-test.site');

    for (const event of ORDER_EMAIL_EVENT_DEFINITIONS) {
      const expected = requestedEvents.has(event.value);
      assert.deepEqual(DEFAULT_ORDER_EMAIL_SETTINGS.events[event.value], {
        customer: expected,
        admins: expected
      });
    }
  });

  test('clones nested settings and normalizes header fields and recipient addresses', () => {
    const clone = cloneOrderEmailSettings();
    clone.events.order_submitted.customer = false;
    clone.adminRecipients.push('changed@example.com');
    assert.equal(DEFAULT_ORDER_EMAIL_SETTINGS.events.order_submitted.customer, true);
    assert.deepEqual(DEFAULT_ORDER_EMAIL_SETTINGS.adminRecipients, []);

    const normalized = normalizeOrderEmailSettings({
      enabled: true,
      senderName: '  Atehna\r\n Bcc  ',
      fromEmail: ' ORDERS@MAIL.ATEHNA-TEST.SITE ',
      replyToEmail: ' NAROCILA@ATEHNA.SI ',
      adminRecipients: [
        ' ADMIN@ATEHNA.SI ',
        'admin@atehna.si',
        'drugi@atehna.si'
      ],
      subjectPrefix: '  Naročila\n Atehna ',
      siteUrl: 'https://www.atehna-test.site/?preview=1',
      footerText: '  Hvala.  ',
      events: {
        order_submitted: { customer: false, admins: true }
      },
      updated_at: '2026-08-24T09:00:00.000Z'
    });

    assert.equal(normalized.senderName, 'Atehna Bcc');
    assert.equal(normalized.fromEmail, 'orders@mail.atehna-test.site');
    assert.equal(normalized.replyToEmail, 'narocila@atehna.si');
    assert.deepEqual(normalized.adminRecipients, [
      'admin@atehna.si',
      'drugi@atehna.si'
    ]);
    assert.equal(normalized.subjectPrefix, 'Naročila Atehna');
    assert.equal(normalized.siteUrl, 'https://www.atehna-test.site');
    assert.equal(normalized.footerText, 'Hvala.');
    assert.deepEqual(normalized.events.order_submitted, {
      customer: false,
      admins: true
    });
    assert.deepEqual(
      normalized.events.in_progress,
      DEFAULT_ORDER_EMAIL_SETTINGS.events.in_progress
    );
    assert.equal(normalized.updatedAt, '2026-08-24T09:00:00.000Z');
  });

  test('limits normalized administrator recipients to twenty', () => {
    const normalized = normalizeOrderEmailSettings({
      adminRecipients: Array.from(
        { length: 25 },
        (_, index) => `admin-${index}@example.com`
      )
    });
    assert.equal(normalized.adminRecipients.length, 20);
  });

  test('validates activation, audiences, addresses, and header injection', () => {
    assert.deepEqual(validateOrderEmailSettingsInput(configuredSettings()), []);

    const missingDeliveryConfig = configuredSettings();
    missingDeliveryConfig.fromEmail = '';
    missingDeliveryConfig.adminRecipients = [];
    const missingErrors = validateOrderEmailSettingsInput(missingDeliveryConfig);
    assert.ok(missingErrors.some((error) => /pošiljatelja obvezen/u.test(error)));
    assert.ok(missingErrors.some((error) => /administratorsk.*naslov/iu.test(error)));

    const noAudience = configuredSettings();
    for (const event of ORDER_EMAIL_EVENT_DEFINITIONS) {
      noAudience.events[event.value] = { customer: false, admins: false };
    }
    assert.ok(
      validateOrderEmailSettingsInput(noAudience).some((error) =>
        /vsaj eno občinstvo/iu.test(error)
      )
    );

    const injected = configuredSettings();
    injected.senderName = 'Atehna\r\nBcc: victim@example.com';
    injected.fromEmail = 'orders@example.com\r\nBcc: victim@example.com';
    injected.adminRecipients = ['ni-email', 'admin@example.com\nCc: x@example.com'];
    const injectedErrors = validateOrderEmailSettingsInput(injected);
    assert.ok(injectedErrors.filter((error) => /kontrolnih znakov|novih vrstic/u.test(error)).length >= 3);
    assert.ok(injectedErrors.some((error) => /ni veljaven/u.test(error)));
  });

  test('removes runtime metadata from the stored settings snapshot', () => {
    const settings = configuredSettings();
    settings.updatedAt = '2026-08-24T09:00:00.000Z';
    const stored = toStoredOrderEmailSettings(settings);
    assert.equal('updatedAt' in stored, false);
    assert.equal(stored.version, 1);
    assert.notStrictEqual(stored.events, settings.events);
    assert.notStrictEqual(stored.adminRecipients, settings.adminRecipients);
  });
});

describe('order email templates', () => {
  test('renders a safe customer submission email without privileged links', () => {
    const message = buildOrderEmailMessage(jobPayload());

    assert.equal(message.from, '"Atehna" <orders@mail.atehna-test.site>');
    assert.equal(message.to, 'kupec@example.com');
    assert.equal(message.replyTo, 'narocila@atehna.si');
    assert.match(message.subject, /^\[Atehna\] Naročilo #42/u);
    assert.doesNotMatch(message.subject, /[\r\n]/u);
    assert.match(message.html, /Hvala za vaše naročilo/u);
    assert.match(message.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/u);
    assert.match(message.html, /&lt;img src=x onerror=alert\(1\)&gt;/u);
    assert.doesNotMatch(message.html, /<script>|<img src=x/iu);
    assert.match(message.text, /Prejeli smo vaše naročilo/u);
    assert.match(message.text, /Vmesna vsota brez DDV/u);
    assert.doesNotMatch(
      `${message.html}\n${message.text}`,
      /order\/confirmation|access[_-]?token|blob_pathname|private.*document/iu
    );
    assert.doesNotMatch(message.html, /\/admin\/orders\/42/u);
  });

  test('renders status-specific admin wording and a safe admin order link', () => {
    const message = buildOrderEmailMessage(
      jobPayload('admin', 'partially_sent')
    );

    assert.match(message.subject, /Delno poslano/u);
    assert.match(message.html, /Status naročila: Delno poslano/u);
    assert.match(message.text, /iz »V obdelavi« v »Delno poslano«/u);
    assert.match(
      message.html,
      /https:\/\/www\.atehna-test\.site\/admin\/orders\/42/u
    );
    assert.match(message.text, /Administracija: https:\/\/www\.atehna-test\.site\/admin\/orders\/42/u);
    assert.match(message.html, /Primer &amp; sinovi &lt;d\.o\.o\.&gt;/u);
    assert.doesNotMatch(message.html, /<d\.o\.o\.>/u);
  });

  test('rejects unsafe recipient headers instead of sending them', () => {
    const payload = jobPayload();
    payload.recipientEmail = 'kupec@example.com\r\nBcc: victim@example.com';
    assert.throws(
      () => buildOrderEmailMessage(payload),
      /recipientEmail is not a valid email address/u
    );
  });
});
