import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  buildQuoteEmailMessage,
  type BuildQuoteEmailMessageInput
} from '@/shared/domain/quote/quoteEmailTemplates';
import { cloneDefaultQuoteEmailSettings } from '@/shared/domain/quote/quoteEmailSettings';
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
    requestNumber: 'P-2026-001',
    offerNumber: 'PO-2026-001',
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
  test('renders configured content with shared explicit typography', () => {
    const value = input();
    value.quoteSettings.templates.quote_issued.customer = {
      subject: 'Ponudba {{offer_number}} za {{request_number}}',
      body: 'Odprite ponudbo {{offer_number}}.'
    };

    const message = buildQuoteEmailMessage(value);

    assert.equal(message.from, '"Atehna" <ponudbe@mail.atehna-test.site>');
    assert.equal(message.to, 'kupec@example.com');
    assert.equal(message.replyTo, 'ponudbe@atehna.si');
    assert.equal(
      message.subject,
      '[Atehna] Ponudba PO-2026-001 za P-2026-001'
    );
    assert.match(
      message.text,
      /Skupna glava[\s\S]*Odprite ponudbo PO-2026-001\.[\s\S]*Dodatna podrobnost <interno>\.[\s\S]*Preglej ponudbo: https:\/\/www\.atehna-test\.site/u
    );
    assert.match(message.html, /Dodatna podrobnost &lt;interno&gt;\./u);
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

  test('uses the admin template without adding the customer offer action', () => {
    const value = input({
      audience: 'admin',
      recipientEmail: 'admin@atehna.si'
    });
    value.quoteSettings.templates.quote_issued.admin = {
      subject: 'Interna ponudba {{offer_number}}',
      body: 'Administratorsko obvestilo za {{request_number}}.'
    };

    const message = buildQuoteEmailMessage(value);

    assert.equal(message.subject, '[Atehna] Interna ponudba PO-2026-001');
    assert.match(message.html, /Administratorsko obvestilo za P-2026-001\./u);
    assert.doesNotMatch(message.html, />Preglej ponudbo<\/a>/u);
    assert.doesNotMatch(message.text, /Preglej ponudbo:/u);
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
});
