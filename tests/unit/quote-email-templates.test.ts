import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  buildQuoteEmailMessage,
  type BuildQuoteEmailMessageInput
} from '@/shared/domain/quote/quoteEmailTemplates';
import {
  cloneDefaultQuoteEmailSettings,
  normalizeQuoteEmailSettings,
  validateQuoteEmailSettings
} from '@/shared/domain/quote/quoteEmailSettings';
import {
  TRANSACTIONAL_EMAIL_BODY_STYLE,
  TRANSACTIONAL_EMAIL_CARD_STYLE,
  TRANSACTIONAL_EMAIL_FONT_FAMILY,
  TRANSACTIONAL_EMAIL_HEADING_STYLE
} from '@/shared/domain/transactionalEmailHtml';

function input(
  overrides: Partial<BuildQuoteEmailMessageInput> = {}
): BuildQuoteEmailMessageInput {
  return {
    eventType: 'quote_issued',
    audience: 'customer',
    recipientEmail: 'kupec@example.com',
    recipientName: 'Ana Novak',
    quoteCode: 'PV-7K3M-4X9P-2D6R-8H4Q',
    offerCode: 'PN-7K3M-4X9P-2D6R-8H4Q-V2',
    orderCode: 'N-7K3M-4X9P-2D6R-8H4Q',
    requestNumber: 'P-2026-001',
    offerNumber: 'PO-2026-001',
    orderNumber: '#42',
    offerUrl: 'https://www.atehna-test.site/offer/review#token=ath_quote_test',
    otpCode: null,
    detail: 'Dodatna podrobnost <interno>.',
    sharedSettings: {
      senderName: 'Atehna',
      fromEmail: 'ponudbe@mail.atehna-test.site',
      replyToEmail: 'ponudbe@atehna.si',
      subjectPrefix: 'Atehna',
      headerText: 'Skupna glava\nDruga vrstica',
      footerText: 'Lep pozdrav,\nAtehna d.o.o.',
      imageAttachment: null
    },
    quoteSettings: cloneDefaultQuoteEmailSettings(),
    ...overrides
  };
}

describe('quote email templates', () => {
  test('selects an independent customer template from the quote customer type', () => {
    const cases = [
      ['individual', 'customer', 'Fizična ponudba'],
      ['company', 'companyCustomer', 'Ponudba podjetju'],
      ['school', 'schoolCustomer', 'Ponudba zavodu']
    ] as const;

    for (const [customerType, templateAudience, expectedSubject] of cases) {
      const value = input({ customerType });
      const templates = value.quoteSettings.templates.quote_issued;
      templates.customer.subject = 'Fizična ponudba';
      templates.companyCustomer.subject = 'Ponudba podjetju';
      templates.schoolCustomer.subject = 'Ponudba zavodu';

      const message = buildQuoteEmailMessage(value);

      assert.equal(message.subject, `[Atehna] ${expectedSubject}`);
      assert.equal(templates[templateAudience].subject, expectedSubject);
    }
  });

  test('renders configured content with shared explicit typography', () => {
    const value = input();
    value.quoteSettings.templates.quote_issued.customer = {
      subject: 'Ponudba {{offer_code}}',
      contentHtml: '<p>Pozdravljeni, {{recipient_name}}.</p><h1>Vaša ponudba {{offer_code}}</h1><p>Odprite ponudbo {{offer_code}}.</p>'
    };

    const message = buildQuoteEmailMessage(value);

    assert.equal(message.from, '"Atehna" <ponudbe@mail.atehna-test.site>');
    assert.equal(message.to, 'kupec@example.com');
    assert.equal(message.replyTo, 'ponudbe@atehna.si');
    assert.equal(
      message.subject,
      '[Atehna] Ponudba PN-7K3M-4X9P-2D6R-8H4Q-V2'
    );
    assert.match(
      message.text,
      /Skupna glava[\s\S]*Odprite ponudbo PN-7K3M-4X9P-2D6R-8H4Q-V2\.[\s\S]*Dodatna podrobnost <interno>\.[\s\S]*Preglej ponudbo: https:\/\/www\.atehna-test\.site/u
    );
    assert.match(message.html, /Dodatna podrobnost &lt;interno&gt;\./u);
    assert.match(message.html, /Pozdravljeni, Ana Novak\./u);
    assert.match(
      message.html,
      /<h1[^>]*>Vaša ponudba PN-7K3M-4X9P-2D6R-8H4Q-V2<\/h1>/u
    );
    assert.match(message.html, />Preglej ponudbo<\/a>/u);
    assert.match(message.html, new RegExp(`<body style="${TRANSACTIONAL_EMAIL_BODY_STYLE}`, 'u'));
    assert.match(message.html, new RegExp(`<div style="${TRANSACTIONAL_EMAIL_CARD_STYLE}`, 'u'));
    assert.match(message.html, new RegExp(`<h1 style="${TRANSACTIONAL_EMAIL_HEADING_STYLE}`, 'u'));

    const styledTags = message.html.match(
      /<(?:body|div|p|h1|a)\b[^>]*>/gu
    ) ?? [];
    assert.ok(styledTags.length > 0);
    for (const tag of styledTags) {
      assert.match(
        tag,
        new RegExp(`font-family:${TRANSACTIONAL_EMAIL_FONT_FAMILY}`, 'u'),
        `missing canonical font stack on ${tag}`
      );
    }
    assert.doesNotMatch(message.html, /font-family:Arial,sans-serif/u);
  });

  test('renderer never reads retired fields when rich text is missing', () => {
    const value = input();
    Object.assign(value.quoteSettings.templates.quote_issued.customer, {
      contentHtml: '',
      greeting: 'RETIRED GREETING',
      heading: 'RETIRED HEADING',
      body: 'RETIRED BODY'
    });
    const message = buildQuoteEmailMessage(value);
    assert.doesNotMatch(message.html + message.text, /RETIRED/u);
    assert.match(message.text, /Ponudbo odprite prek varne povezave/u);
  });

  test('uses the admin template without adding the customer offer action', () => {
    const value = input({
      audience: 'admin',
      recipientEmail: 'admin@atehna.si'
    });
    value.quoteSettings.templates.quote_issued.admin = {
      subject: 'Interna ponudba {{offer_number}}',
      contentHtml: '<p>Pozdravljeni,</p><h1>Ponudba za pregled</h1><p>Administratorsko obvestilo za {{request_number}}.</p>'
    };

    const message = buildQuoteEmailMessage(value);

    assert.equal(message.subject, '[Atehna] Interna ponudba PO-2026-001');
    assert.match(message.html, /<h1[^>]*>Ponudba za pregled<\/h1>/u);
    assert.match(message.html, /Administratorsko obvestilo za P-2026-001\./u);
    assert.doesNotMatch(message.html, />Preglej ponudbo<\/a>/u);
    assert.doesNotMatch(message.text, /Preglej ponudbo:/u);
  });

  test('never exposes internal quote or order numbers to a customer template', () => {
    const value = input();
    value.quoteSettings.templates.quote_accepted.customer = {
      subject:
        '{{quote_code}} {{offer_code}} {{order_code}} {{request_number}} {{offer_number}} {{order_number}}',
      contentHtml:
        '<p>{{quote_code}} {{offer_code}} {{order_code}} {{request_number}} {{offer_number}} {{order_number}}</p>'
    };
    const message = buildQuoteEmailMessage({
      ...value,
      eventType: 'quote_accepted',
      detail: null
    });
    const output = message.subject + '\n' + message.text;
    assert.match(output, /PV-7K3M-4X9P-2D6R-8H4Q/u);
    assert.match(output, /PN-7K3M-4X9P-2D6R-8H4Q-V2/u);
    assert.match(output, /N-7K3M-4X9P-2D6R-8H4Q/u);
    assert.doesNotMatch(output, /P-2026-001|PO-2026-001|#42/u);
  });

  test('includes the related public order code in the accepted customer default', () => {
    const message = buildQuoteEmailMessage({
      ...input(),
      eventType: 'quote_accepted',
      detail: null
    });
    assert.match(message.text, /N-7K3M-4X9P-2D6R-8H4Q/u);
    assert.doesNotMatch(message.text, /#42/u);
  });

  test('preserves the safe fallback sender and shared attachment behavior', () => {
    const value = input({
      sharedSettings: {
        ...input().sharedSettings,
        fromEmail: '',
        imageAttachment: {
          url: 'https://atehna-test.public.blob.vercel-storage.com/email/shared/quote-header.png',
          pathname: 'email/shared/quote-header.png',
          filename: 'quote-header.png',
          contentType: 'image/png',
          size: 1_024
        }
      }
    });

    const message = buildQuoteEmailMessage(value);

    assert.equal(
      message.from,
      '"Atehna" <delivery-profile-pending@invalid.local>'
    );
    assert.deepEqual(message.attachments, [
      {
        path: 'https://atehna-test.public.blob.vercel-storage.com/email/shared/quote-header.png',
        filename: 'quote-header.png'
      }
    ]);
  });

  test('removes header control characters at the final delivery boundary', () => {
    const value = input({
      sharedSettings: {
        ...input().sharedSettings,
        subjectPrefix: 'Atehna\r\nBcc: prefix@example.com'
      }
    });
    value.quoteSettings.templates.quote_issued.customer.subject =
      'Ponudba {{offer_code}}\r\nBcc: victim@example.com';

    const message = buildQuoteEmailMessage(value);

    assert.doesNotMatch(message.subject, /[\r\n]/u);
    assert.match(
      message.subject,
      /Ponudba PN-7K3M-4X9P-2D6R-8H4Q-V2 Bcc:/u
    );
  });

  test('normalizes and validates sparse quote presentation settings', () => {
    const settings = cloneDefaultQuoteEmailSettings();
    settings.templates.quote_issued.customer.presentation = {
      verticalSpacingPx: 15,
      blockSpacingPx: {
        sharedHeader: 7,
        primaryAction: 9
      }
    };
    const normalized = normalizeQuoteEmailSettings(settings);
    assert.deepEqual(
      normalized.templates.quote_issued.customer.presentation,
      settings.templates.quote_issued.customer.presentation
    );
    assert.deepEqual(validateQuoteEmailSettings(normalized), []);

    settings.templates.quote_issued.customer.presentation = {
      verticalSpacingPx: 65
    };
    assert.ok(
      validateQuoteEmailSettings(settings).some((error) =>
        /postavitev/iu.test(error)
      )
    );
  });

  test('applies quote spacing and emits editor markers only in preview', () => {
    const value = input();
    value.quoteSettings.templates.quote_issued.customer.presentation = {
      verticalSpacingPx: 11,
      blockSpacingPx: {
        sharedHeader: 7,
        primaryAction: 9,
        sharedFooter: 13
      }
    };

    const production = buildQuoteEmailMessage(value);
    const preview = buildQuoteEmailMessage(value, { editorPreview: true });

    assert.doesNotMatch(production.html, /data-email-editor-id/u);
    for (const marker of [
      'sharedHeader',
      'templateContent',
      'audienceDetails',
      'primaryAction',
      'sharedFooter'
    ]) {
      assert.match(
        preview.html,
        new RegExp(`data-email-editor-id="${marker}"`, 'u')
      );
    }
    assert.match(production.html, /margin:0 0 7px;white-space/u);
    assert.match(production.html, /margin:0 0 9px/u);
    assert.match(production.html, /margin:13px 0 0;white-space/u);
    assert.equal(preview.subject, production.subject);
    assert.equal(preview.text, production.text);
    assert.deepEqual(preview.attachments, production.attachments);
  });
});
