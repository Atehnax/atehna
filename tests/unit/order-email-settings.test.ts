import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ORDER_STATUS_OPTIONS } from '@/shared/domain/order/orderStatus';
import {
  cloneOrderEmailSettings,
  DEFAULT_ORDER_EMAIL_SETTINGS,
  ORDER_EMAIL_IMAGE_ATTACHMENT_MAX_BYTES,
  ORDER_EMAIL_SHARED_TEXT_MAX_LENGTH,
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
  'order_accepted',
  'order_rejected',
  'in_progress',
  'partially_sent',
  'sent'
]);

const validImageAttachment = {
  url: 'https://atehna-test.public.blob.vercel-storage.com/email/shared/123e4567-e89b-42d3-a456-426614174003-glava.png',
  pathname: 'email/shared/123e4567-e89b-42d3-a456-426614174003-glava.png',
  filename: 'glava.png',
  contentType: 'image/png' as const,
  size: 1024
};

function configuredSettings(): OrderEmailSettings {
  const settings = cloneOrderEmailSettings();
  settings.enabled = true;
  settings.fromEmail = 'orders@mail.atehna-test.site';
  settings.adminRecipients = ['admin@atehna.si'];
  return settings;
}

function jobPayload(
  audience: OrderEmailJobPayload['audience'] = 'customer',
  eventType: OrderEmailEventType = 'order_submitted',
  customerType: 'individual' | 'company' | 'school' = 'company'
): OrderEmailJobPayload {
  const orderAccessToken = `ath_order_${'S'.repeat(43)}`;
  const order = {
    createdAt: '2026-08-24T08:15:00.000Z',
    customer: {
      customerType,
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
        order,
        purchaseOrderUploadUrl:
          customerType === 'school' && eventType === 'order_submitted'
            ? `https://www.atehna-test.site/order/narocilnica#token=${orderAccessToken}`
            : null
      };
}

describe('order email settings', () => {
  test('defines submission plus every canonical status event in stable order', () => {
    assert.deepEqual(
      ORDER_EMAIL_EVENT_DEFINITIONS.map((event) => event.value),
      [
        'order_submitted',
        'order_accepted',
        'order_rejected',
        ...ORDER_STATUS_OPTIONS.map((status) => status.value)
      ]
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
    assert.equal(DEFAULT_ORDER_EMAIL_SETTINGS.confirmCustomerEmails, true);
    assert.equal(DEFAULT_ORDER_EMAIL_SETTINGS.senderName, 'Atehna');
    assert.equal(DEFAULT_ORDER_EMAIL_SETTINGS.fromEmail, '');
    assert.equal(DEFAULT_ORDER_EMAIL_SETTINGS.replyToEmail, 'narocila@atehna.si');
    assert.deepEqual(DEFAULT_ORDER_EMAIL_SETTINGS.adminRecipients, []);
    assert.equal(DEFAULT_ORDER_EMAIL_SETTINGS.siteUrl, 'https://www.atehna-test.site');
    assert.equal(DEFAULT_ORDER_EMAIL_SETTINGS.version, 5);
    assert.equal(DEFAULT_ORDER_EMAIL_SETTINGS.headerText, '');
    assert.equal(DEFAULT_ORDER_EMAIL_SETTINGS.imageAttachment, null);
    assert.deepEqual(ORDER_EMAIL_TEMPLATE_VARIABLES.customer, [
      'customer_name',
      'organization_name',
      'contact_name',
      'reference',
      'status',
      'previous_status'
    ]);
    assert.deepEqual(ORDER_EMAIL_TEMPLATE_VARIABLES.schoolCustomer, [
      'customer_name',
      'organization_name',
      'contact_name',
      'reference',
      'status'
    ]);
    assert.equal(
      DEFAULT_ORDER_EMAIL_SETTINGS.templates.order_submitted.customer.subject,
      'Vaše naročilo je bilo prejeto'
    );
    assert.equal(
      DEFAULT_ORDER_EMAIL_SETTINGS.templates.order_submitted.schoolCustomer.subject,
      'Va\u0161e naro\u010dilo je bilo prejeto \u2013 nalo\u017eite naro\u010dilnico'
    );
    const schoolBody =
      DEFAULT_ORDER_EMAIL_SETTINGS.templates.order_submitted.schoolCustomer.body;
    assert.match(schoolBody, /podpisani oziroma odobreni naro\u010dilnici/u);
    assert.match(schoolBody, /spodaj izpisane podatke/u);
    assert.match(
      schoolBody,
      /naro\u010dene artikle in zneske iz povzetka naro\u010dila/u
    );
    assert.match(schoolBody, /PDF ali JPG/u);
    assert.match(schoolBody, /10 MB/u);
    assert.match(schoolBody, /za\u010deli obdelovati po prejemu/u);
    assert.match(schoolBody, /samodejno in varno pove\u017ee/u);
    assert.match(
      schoolBody,
      /interne \u0161tevilke naro\u010dila ni treba vpisati/u
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
    const sourceSettings = cloneOrderEmailSettings();
    sourceSettings.imageAttachment = { ...validImageAttachment };
    const clone = cloneOrderEmailSettings(sourceSettings);
    clone.events.order_submitted.customer = false;
    clone.adminRecipients.push('changed@example.com');
    clone.templates.order_submitted.customer.subject = 'Spremenjeno';
    clone.templates.order_submitted.schoolCustomer.subject = 'Spremenjeno za \u0161olo';
    assert.notStrictEqual(clone.imageAttachment, sourceSettings.imageAttachment);
    clone.imageAttachment!.filename = 'spremenjeno.png';
    assert.equal(sourceSettings.imageAttachment!.filename, 'glava.png');
    assert.equal(DEFAULT_ORDER_EMAIL_SETTINGS.events.order_submitted.customer, true);
    assert.deepEqual(DEFAULT_ORDER_EMAIL_SETTINGS.adminRecipients, []);
    assert.equal(
      DEFAULT_ORDER_EMAIL_SETTINGS.templates.order_submitted.customer.subject,
      'Vaše naročilo je bilo prejeto'
    );
    assert.equal(
      DEFAULT_ORDER_EMAIL_SETTINGS.templates.order_submitted.schoolCustomer.subject,
      'Va\u0161e naro\u010dilo je bilo prejeto \u2013 nalo\u017eite naro\u010dilnico'
    );


    const normalized = normalizeOrderEmailSettings({
      enabled: true,
      confirmCustomerEmails: false,
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
      headerText: '  Pomembno.\r\nDruga vrstica.  ',
      footerText: '  Hvala.  ',
      imageAttachment: validImageAttachment,
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
    assert.equal(normalized.confirmCustomerEmails, false);
    assert.equal(normalized.fromEmail, 'orders@mail.atehna-test.site');
    assert.equal(normalized.replyToEmail, 'narocila@atehna.si');
    assert.deepEqual(normalized.adminRecipients, [
      'admin@atehna.si',
      'drugi@atehna.si'
    ]);
    assert.equal(normalized.subjectPrefix, 'Naročila Atehna');
    assert.equal(normalized.siteUrl, 'https://www.atehna-test.site');
    assert.equal(normalized.headerText, 'Pomembno.\nDruga vrstica.');
    assert.equal(normalized.footerText, 'Hvala.');
    assert.deepEqual(normalized.imageAttachment, validImageAttachment);
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

  test('upgrades legacy version two settings with an independent default school template', () => {
    const legacy = normalizeOrderEmailSettings({
      version: 2,
      templates: {
        order_submitted: {
          customer: {
            subject: 'Legacy customer',
            body: 'Legacy customer body'
          },
          admin: {
            subject: 'Legacy admin',
            body: 'Legacy admin body'
          }
        }
      }
    });

    assert.equal(legacy.version, 5);
    assert.equal(legacy.confirmCustomerEmails, true);
    assert.equal(legacy.headerText, '');
    assert.equal(legacy.imageAttachment, null);
    assert.equal(legacy.templates.order_submitted.customer.subject, 'Legacy customer');
    assert.deepEqual(
      legacy.templates.order_submitted.schoolCustomer,
      DEFAULT_ORDER_EMAIL_SETTINGS.templates.order_submitted.schoolCustomer
    );
    legacy.templates.order_submitted.schoolCustomer.subject = 'Mutated';
    assert.notEqual(
      DEFAULT_ORDER_EMAIL_SETTINGS.templates.order_submitted.schoolCustomer.subject,
      'Mutated'
    );
  });

  test('sanitizes and bounds shared header and footer text', () => {
    const normalized = normalizeOrderEmailSettings({
      headerText: `  Glava\u0001\r\n${'x'.repeat(ORDER_EMAIL_SHARED_TEXT_MAX_LENGTH)}  `,
      footerText: `  Noga\u0002  `
    });
    assert.equal(normalized.headerText.includes('\u0001'), false);
    assert.equal(normalized.headerText.length, ORDER_EMAIL_SHARED_TEXT_MAX_LENGTH);
    assert.equal(normalized.footerText, 'Noga');

    const errors = validateOrderEmailSettingsInput({
      ...configuredSettings(),
      headerText: `Glava\u0001`,
      footerText: 'x'.repeat(ORDER_EMAIL_SHARED_TEXT_MAX_LENGTH + 1)
    });
    assert.ok(errors.some((error) => /Besedilo glave.*kontrolne znake/u.test(error)));
    assert.ok(errors.some((error) => /Besedilo noge.*1000 znakov/u.test(error)));
  });

  test('accepts only trusted immutable Vercel Blob image attachments', () => {
    const settings = configuredSettings();
    settings.imageAttachment = { ...validImageAttachment };
    assert.deepEqual(validateOrderEmailSettingsInput(settings), []);
    assert.deepEqual(
      normalizeOrderEmailSettings(settings).imageAttachment,
      validImageAttachment
    );

    const invalidAttachments: unknown[] = [
      {
        ...validImageAttachment,
        url: validImageAttachment.url.replace('https://', 'http://')
      },
      {
        ...validImageAttachment,
        url: 'https://evil.example/email/shared/123e4567-e89b-42d3-a456-426614174003-glava.png'
      },
      {
        ...validImageAttachment,
        pathname: 'email/shared/../glava.png'
      },
      {
        ...validImageAttachment,
        filename: 'glava.svg',
        contentType: 'image/svg+xml'
      },
      {
        ...validImageAttachment,
        size: ORDER_EMAIL_IMAGE_ATTACHMENT_MAX_BYTES + 1
      },
      {
        ...validImageAttachment,
        unexpected: true
      }
    ];

    for (const imageAttachment of invalidAttachments) {
      assert.equal(
        normalizeOrderEmailSettings({ imageAttachment }).imageAttachment,
        null
      );
      assert.ok(
        validateOrderEmailSettingsInput({
          ...configuredSettings(),
          imageAttachment
        }).some((error) => /Slikovna priponka/u.test(error))
      );
    }
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

  test('rejects internal identifiers in the school or public-institution template', () => {
    const settings = configuredSettings();
    settings.templates.order_submitted.schoolCustomer = {
      subject: 'Prejeto {{organization_name}}',
      body: 'Interna referenca {{order_number}} za {{contact_name}}.'
    };

    const errors = validateOrderEmailSettingsInput(settings);
    assert.ok(
      errors.some((error) =>
        /\{\{order_number\}\}.*\u0161olo ali javni zavod/u.test(error)
      )
    );
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
    settings.confirmCustomerEmails = false;
    settings.imageAttachment = { ...validImageAttachment };
    settings.updatedAt = '2026-08-24T09:00:00.000Z';
    const stored = toStoredOrderEmailSettings(settings);
    assert.equal('updatedAt' in stored, false);
    assert.equal(stored.version, 5);
    assert.equal(stored.confirmCustomerEmails, false);
    assert.notStrictEqual(stored.events, settings.events);
    assert.notStrictEqual(stored.templates, settings.templates);
    assert.notStrictEqual(stored.adminRecipients, settings.adminRecipients);
    assert.notStrictEqual(stored.imageAttachment, settings.imageAttachment);
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
      /Prejeli smo vaše naročilo\. Naročilo še ni potrjeno\. O sprejemu ali zavrnitvi vas bomo obvestili po e-pošti\./u
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

  test('renders the customized school template, fixed details, and one fragment credential', () => {
    const payload = jobPayload(
      'customer',
      'order_submitted',
      'school'
    ) as Extract<OrderEmailJobPayload, { audience: 'customer' }>;
    payload.settingsSnapshot.templates.order_submitted.schoolCustomer = {
      subject: '{{organization_name}}: nalo\u017eite naro\u010dilnico',
      body:
        'Kontakt {{contact_name}}, za naro\u010dnika {{organization_name}} uporabite referenco {{reference}}.'
    };
    Object.assign(payload.order, {
      orderId: 42,
      orderNumber: '#PRIVATE-42'
    });

    const message = buildOrderEmailMessage(payload);
    const output = `${message.subject}\n${message.html}\n${message.text}`;
    const tokenPattern = /ath_order_[A-Za-z0-9_-]{43}/gu;
    const tokens = output.match(tokenPattern) ?? [];

    assert.equal(
      message.subject,
      '[Atehna] Primer & sinovi <d.o.o.>: nalo\u017eite naro\u010dilnico'
    );
    assert.match(message.html, /Podatki za naro\u010dilnico/u);
    assert.match(
      message.html,
      /Naro\u010dnik:<\/strong> Primer &amp; sinovi &lt;d\.o\.o\.&gt;/u
    );
    assert.match(
      message.html,
      /Kontaktna oseba:<\/strong> Ana &lt;Kupec&gt;/u
    );
    assert.match(
      message.html,
      /Va\u0161a referenca:<\/strong> REF &amp; &lt;pomembno&gt;/u
    );
    assert.match(message.html, />Nalo\u017ei naro\u010dilnico<\/a>/u);
    assert.match(
      message.text,
      /Naro\u010dnik: Primer & sinovi <d\.o\.o\.>[\s\S]*Kontaktna oseba: Ana <Kupec>[\s\S]*Va\u0161a referenca: REF & <pomembno>/u
    );
    assert.match(
      output,
      /https:\/\/www\.atehna-test\.site\/order\/narocilnica#token=ath_order_[A-Za-z0-9_-]{43}/u
    );
    assert.equal(tokens.length, 2);
    assert.equal(new Set(tokens).size, 1);
    assert.doesNotMatch(output, /#PRIVATE-42|\/admin\/orders\/42|narocilnica\?/u);
  });

  test('never emits the school credential to admins, non-school customers, or status emails', () => {
    const secureUrl =
      `https://www.atehna-test.site/order/narocilnica#token=ath_order_${'S'.repeat(43)}`;
    const payloads: OrderEmailJobPayload[] = [
      jobPayload('admin', 'order_submitted', 'school'),
      jobPayload('customer', 'order_submitted', 'company'),
      jobPayload('customer', 'in_progress', 'school')
    ];

    for (const payload of payloads) {
      Object.assign(payload, { purchaseOrderUploadUrl: secureUrl });
      const message = buildOrderEmailMessage(payload);
      const output = `${message.subject}\n${message.html}\n${message.text}`;
      assert.doesNotMatch(
        output,
        /ath_order_|\/order\/narocilnica|Nalo\u017ei naro\u010dilnico/u
      );
    }
  });

  test('omits the school CTA for a foreign origin, wrong path, query, or invalid token', () => {
    const token = `ath_order_${'S'.repeat(43)}`;
    const unsafeUrls = [
      `https://evil.example/order/narocilnica#token=${token}`,
      `https://www.atehna-test.site/order/confirmation#token=${token}`,
      `https://www.atehna-test.site/order/narocilnica?token=${token}`,
      'https://www.atehna-test.site/order/narocilnica#token=invalid',
      `https://www.atehna-test.site/order/narocilnica#token=${token}&extra=1`
    ];

    for (const purchaseOrderUploadUrl of unsafeUrls) {
      const payload = jobPayload(
        'customer',
        'order_submitted',
        'school'
      ) as Extract<OrderEmailJobPayload, { audience: 'customer' }>;
      payload.purchaseOrderUploadUrl = purchaseOrderUploadUrl;
      const message = buildOrderEmailMessage(payload);
      const output = `${message.subject}\n${message.html}\n${message.text}`;
      assert.doesNotMatch(
        output,
        /href="[^"]*\/order\/narocilnica|Varna oddaja naro\u010dilnice:|ath_order_/u
      );
    }
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
