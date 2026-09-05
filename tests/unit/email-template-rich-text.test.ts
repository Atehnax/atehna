import assert from 'node:assert/strict';
import test from 'node:test';
import {
  emailTemplateRichTextToPlainText,
  emailTemplateVariables,
  createEmailTemplateContentHtml,
  renderEmailTemplateRichText,
  sanitizeEmailTemplateRichText
} from '../../src/shared/domain/emailTemplateRichText';

test('email rich text preserves formatting but removes active and remote content', () => {
  const sanitized = sanitizeEmailTemplateRichText(
    '<h1 style="text-align:center;color:#123456">Naslov</h1>' +
      '<p><strong>Besedilo</strong> <a href="javascript:alert(1)">povezava</a></p>' +
      '<img src="https://tracker.example/pixel.png"><script>alert(1)</script>'
  );

  assert.match(sanitized, /<h1 style="text-align:center;color:#123456">Naslov<\/h1>/u);
  assert.match(sanitized, /<strong>Besedilo<\/strong>/u);
  assert.doesNotMatch(sanitized, /javascript|tracker|script/iu);
});

test('default email copy composes one escaped semantic rich-text document', () => {
  const content = createEmailTemplateContentHtml({
    greeting: 'Pozdravljeni, {{recipient_name}},',
    heading: 'Vaše naročilo je pripravljeno',
    body: 'Prva vrstica.\nDruga vrstica.\n\nHvala.'
  });

  assert.equal(
    content,
    '<p>Pozdravljeni, {{recipient_name}},</p><h1>Vaše naročilo je pripravljeno</h1><p>Prva vrstica.<br />Druga vrstica.</p><p>Hvala.</p>'
  );
});

test('email rich text safely interpolates variables and creates multipart text', () => {
  const rendered = renderEmailTemplateRichText(
    '<p>Pozdravljeni, <strong>{{recipient_name}}</strong>.</p><h1>{{status}}</h1>',
    {
      recipient_name: '<Ana & Miha>',
      status: 'Pripravljeno'
    }
  );

  assert.match(rendered.html, /&lt;Ana &amp; Miha&gt;/u);
  assert.match(rendered.html, /<strong>/u);
  assert.doesNotMatch(rendered.html, /<Ana/u);
  assert.equal(
    rendered.text,
    'Pozdravljeni, <Ana & Miha>.\nPripravljeno'
  );
});

test('email rich-text helpers retain paragraph boundaries and list markers', () => {
  assert.equal(
    emailTemplateRichTextToPlainText(
      '<p>Uvod</p><ul><li>Prva</li><li>Druga</li></ul><p>Konec</p>'
    ),
    'Uvod\n- Prva\n- Druga\n\nKonec'
  );
  assert.deepEqual(
    emailTemplateVariables('<p>{{recipient_name}} / {{ status }}</p>'),
    ['recipient_name', 'status']
  );
});

test('preserves the legacy empty-recipient salutation without a doubled comma', () => {
  const rendered = renderEmailTemplateRichText(
    '<p>Pozdravljeni, {{recipient_name}},</p>',
    { recipient_name: '' }
  );

  assert.match(rendered.html, />Pozdravljeni,<\/p>/u);
  assert.equal(rendered.text, 'Pozdravljeni,');
  assert.doesNotMatch(rendered.html, /,\s*,/u);
});
