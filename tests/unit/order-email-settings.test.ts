import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ORDER_STATUS_OPTIONS } from '@/shared/domain/order/orderStatus';
import {
  cloneOrderEmailSettings,
  DEFAULT_ORDER_EMAIL_SETTINGS,
  ORDER_EMAIL_TEMPLATE_VARIABLES,
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
  const order = {
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
        lineGross: 24.4,
        imageUrl: '/images/categories/materiali.png'
      }
    ],
    totals: {
      net: 20,
      tax: 4.4,
      shipping: 0,
      gross: 24.4
    }
  };
  const payloadBase = {
    eventType,
    recipientEmail:
      audience === 'customer' ? 'kupec@example.com' : 'admin@atehna.si',
    recipientName: audience === 'customer' ? 'Ana <Kupec>' : 'Skrbnik',
    occurredAt: '2026-08-24T08:30:00.000Z',
    previousStatus: eventType === 'order_submitted' ? null : 'in_progress',
    settingsSnapshot: toStoredOrderEmailSettings(configuredSettings())
  };
  return audience === 'admin'
    ? {
        ...payloadBase,
        audience: 'admin',
        order: {
          ...order,
          orderId: 42,
          orderNumber: '#42 <script>alert(1)</script>'
        }
      }
    : {
        ...payloadBase,
        audience: 'customer',
        order
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
    assert.equal(DEFAULT_ORDER_EMAIL_SETTINGS.version, 2);
    assert.deepEqual(ORDER_EMAIL_TEMPLATE_VARIABLES.customer, [
      'customer_name',
      'status',
      'previous_status'
    ]);
    assert.equal(
      DEFAULT_ORDER_EMAIL_SETTINGS.templates.order_submitted.customer.subject,
      'Vaše naročilo je bilo prejeto'
    );


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
    clone.templates.order_submitted.customer.subject = 'Spremenjeno';
    assert.equal(DEFAULT_ORDER_EMAIL_SETTINGS.events.order_submitted.customer, true);
    assert.deepEqual(DEFAULT_ORDER_EMAIL_SETTINGS.adminRecipients, []);
    assert.equal(
      DEFAULT_ORDER_EMAIL_SETTINGS.templates.order_submitted.customer.subject,
      'Vaše naročilo je bilo prejeto'
    );

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
      templates: {
        order_submitted: {
          customer: {
            subject: '  Prejeto {{customer_name}}  ',
            body: '  Prva vrstica.\r\nDruga vrstica.  '
          }
        }
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
    assert.deepEqual(normalized.templates.order_submitted.customer, {
      subject: 'Prejeto {{customer_name}}',
      body: 'Prva vrstica.\nDruga vrstica.'
    });
    assert.deepEqual(
      normalized.templates.order_submitted.admin,
      DEFAULT_ORDER_EMAIL_SETTINGS.templates.order_submitted.admin
    );
    assert.equal(normalized.updatedAt, '2026-08-24T09:00:00.000Z');
  });

  test('requires HTTPS and falls back safely for malformed stored site URLs', () => {
    for (const invalidUrl of [
      'https://updates..atehna-test.site',
      'http://www.atehna-test.site'
    ]) {
      assert.equal(
        normalizeOrderEmailSettings({ siteUrl: invalidUrl }).siteUrl,
        DEFAULT_ORDER_EMAIL_SETTINGS.siteUrl
      );
      assert.ok(
        validateOrderEmailSettingsInput({ siteUrl: invalidUrl }).some(
          (error) => /Spletni naslov.*HTTPS/u.test(error)
        )
      );
    }
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


  test('allows only audience-scoped variables in editable templates', () => {
    const settings = configuredSettings();
    settings.templates.order_submitted.customer = {
      subject: 'Prejeto {{order_number}}',
      body: 'Pozdravljeni, {{customer_name}}. {{unknown_value}}'
    };
    const errors = validateOrderEmailSettingsInput(settings);
    assert.ok(errors.some((error) => /\{\{order_number\}\}/u.test(error)));
    assert.ok(errors.some((error) => /\{\{unknown_value\}\}/u.test(error)));

    settings.templates.order_submitted.customer = {
      subject: 'Prejeto za {{customer_name}}',
      body: 'Status: {{status}}; prej: {{previous_status}}'
    };
    assert.deepEqual(validateOrderEmailSettingsInput(settings), []);
  });

  test('rejects explicit malformed event and audience template containers', () => {
    const malformedContainers: unknown[] = ['invalid', null, []];
    for (const malformed of malformedContainers) {
      const settings = configuredSettings();
      const invalidEventSettings = {
        ...settings,
        templates: {
          ...settings.templates,
          order_submitted: malformed
        }
      };
      assert.ok(
        validateOrderEmailSettingsInput(invalidEventSettings).some((error) =>
          /Predloge za dogodek/u.test(error)
        )
      );

      for (const audience of ['customer', 'admin'] as const) {
        const invalidAudienceSettings = {
          ...settings,
          templates: {
            ...settings.templates,
            order_submitted: {
              ...settings.templates.order_submitted,
              [audience]: malformed
            }
          }
        };
        assert.ok(
          validateOrderEmailSettingsInput(invalidAudienceSettings).some(
            (error) => /Predloga za (stranko|administratorja)/u.test(error)
          )
        );
      }
    }

    const legacyPartialSettings = {
      ...configuredSettings(),
      templates: { order_submitted: {} }
    };
    assert.deepEqual(
      validateOrderEmailSettingsInput(legacyPartialSettings),
      []
    );
  });

  test('removes runtime metadata from the stored settings snapshot', () => {
    const settings = configuredSettings();
    settings.updatedAt = '2026-08-24T09:00:00.000Z';
    const stored = toStoredOrderEmailSettings(settings);
    assert.equal('updatedAt' in stored, false);
    assert.equal(stored.version, 2);
    assert.notStrictEqual(stored.events, settings.events);
    assert.notStrictEqual(stored.templates, settings.templates);
    assert.notStrictEqual(stored.adminRecipients, settings.adminRecipients);
  });
});

describe('order email templates', () => {
  test('renders the editable customer submission content without internal identifiers', () => {
    const payload = jobPayload();
    Object.assign(payload.order, {
      orderId: 42,
      orderNumber: '#PRIVATE-42'
    });
    const message = buildOrderEmailMessage(payload);

    assert.equal(message.from, '"Atehna" <orders@mail.atehna-test.site>');
    assert.equal(message.to, 'kupec@example.com');
    assert.equal(message.replyTo, 'narocila@atehna.si');
    assert.equal(message.subject, '[Atehna] Vaše naročilo je bilo prejeto');
    assert.doesNotMatch(message.subject, /[\r\n]/u);
    assert.match(
      message.html,
      /<h1[^>]*>Vaše naročilo je bilo prejeto<\/h1>/u
    );
    assert.match(
      message.html,
      /Vaše naročilo smo uspešno prejeli\. O nadaljnjih spremembah vas bomo obvestili po e-pošti\./u
    );
    assert.match(message.html, /&lt;img src=x onerror=alert\(1\)&gt;/u);
    assert.doesNotMatch(message.html, /<script>|<img src=x/iu);
    assert.match(
      message.html,
      /<img src="https:\/\/www\.atehna-test\.site\/images\/categories\/materiali\.png"/u
    );
    assert.match(message.text, /Vaše naročilo je bilo prejeto/u);
    assert.match(message.text, /Vmesna vsota brez DDV/u);
    assert.doesNotMatch(
      `${message.subject}\n${message.html}\n${message.text}`,
      /#PRIVATE-42|\/admin\/orders\/42|order\/confirmation|access[_-]?token|blob_pathname|private.*document/iu
    );
  });

  test('never reads an internal order number for any customer event', () => {
    for (const event of ORDER_EMAIL_EVENT_DEFINITIONS) {
      const payload = jobPayload('customer', event.value);
      Object.assign(payload.order, {
        orderId: 42,
        orderNumber: '#PRIVATE-42'
      });
      const message = buildOrderEmailMessage(payload);
      assert.doesNotMatch(
        `${message.subject}\n${message.html}\n${message.text}`,
        /#PRIVATE-42|\/admin\/orders\/42/u,
        `customer output leaked an internal identifier for ${event.value}`
      );
    }
  });

  test('renders editable admin content and a safe admin order link', () => {
    const payload = jobPayload(
      'admin',
      'partially_sent'
    ) as Extract<OrderEmailJobPayload, { audience: 'admin' }>;
    payload.settingsSnapshot.templates.partially_sent.admin = {
      subject: 'Uredi {{order_number}}: {{status}}',
      body:
        'Status {{order_number}} iz {{previous_status}} v {{status}} za {{customer_email}}.'
    };
    const message = buildOrderEmailMessage(payload);

    assert.equal(
      message.subject,
      '[Atehna] Uredi #42 <script>alert(1)</script>: Delno poslano'
    );
    assert.match(
      message.html,
      /<h1[^>]*>Uredi #42 &lt;script&gt;alert\(1\)&lt;\/script&gt;: Delno poslano<\/h1>/u
    );
    assert.match(
      message.text,
      /Status #42 <script>alert\(1\)<\/script> iz V obdelavi v Delno poslano za kupec@example\.com\./u
    );
    assert.match(
      message.html,
      /https:\/\/www\.atehna-test\.site\/admin\/orders\/42/u
    );
    assert.match(message.text, /Administracija: https:\/\/www\.atehna-test\.site\/admin\/orders\/42/u);
    assert.match(message.html, /Primer &amp; sinovi &lt;d\.o\.o\.&gt;/u);
    assert.doesNotMatch(message.html, /<d\.o\.o\.>/u);
  });

  test('falls back to the canonical HTTPS host for an unsafe HTTP admin base', () => {
    const payload = jobPayload(
      'admin'
    ) as Extract<OrderEmailJobPayload, { audience: 'admin' }>;
    payload.settingsSnapshot.siteUrl = 'http://updates.atehna-test.site';
    const message = buildOrderEmailMessage(payload);
    assert.match(
      `${message.html}\n${message.text}`,
      /https:\/\/www\.atehna-test\.site\/admin\/orders\/42/u
    );
    assert.doesNotMatch(
      `${message.html}\n${message.text}`,
      /http:\/\/updates\.atehna-test\.site/u
    );
  });

  test('omits item images that do not resolve to HTTPS', () => {
    const payload = jobPayload();
    payload.order.items[0]!.imageUrl = 'http://images.example.com/item.png';
    const httpMessage = buildOrderEmailMessage(payload);
    assert.doesNotMatch(httpMessage.html, /<img src=/u);
    assert.doesNotMatch(httpMessage.html, /images\.example\.com/u);

    payload.order.items[0]!.imageUrl = '//images.example.com/item.png';
    const protocolRelativeMessage = buildOrderEmailMessage(payload);
    assert.doesNotMatch(protocolRelativeMessage.html, /<img src=/u);
    assert.doesNotMatch(protocolRelativeMessage.html, /images\.example\.com/u);
  });

  test('suppresses the admin action link for a nonpositive test order ID', () => {
    const payload = jobPayload(
      'admin'
    ) as Extract<OrderEmailJobPayload, { audience: 'admin' }>;
    payload.order.orderId = 0;
    const message = buildOrderEmailMessage(payload);
    assert.doesNotMatch(
      `${message.html}\n${message.text}`,
      /\/admin\/orders\/0|Odpri naročilo v administraciji|Administracija:/u
    );
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
