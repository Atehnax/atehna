import {
  normalizeEmailMessageAttachment,
  type EmailMessageAttachment
} from '../order/orderEmailTemplates';
import type { OrderEmailImageAttachment } from '../order/orderEmailSettings';
import type { CustomerType } from '../order/customerType';
import {
  TRANSACTIONAL_EMAIL_BODY_STYLE,
  TRANSACTIONAL_EMAIL_CARD_STYLE,
  TRANSACTIONAL_EMAIL_COPY_STYLE
} from '../transactionalEmailHtml';
import {
  legacyEmailTemplateContentHtml,
  renderEmailTemplateRichText,
  sanitizeEmailTemplateRichText
} from '../emailTemplateRichText';
import {
  QUOTE_EMAIL_DEFAULT_ADMIN_GREETING,
  QUOTE_EMAIL_DEFAULT_GREETING,
  QUOTE_EMAIL_EVENT_DEFAULTS,
  type QuoteEmailEventType,
  type QuoteEmailSettings
} from './quoteEmailSettings';

export type QuoteEmailAudience = 'customer' | 'admin';

export type QuoteEmailMessage = {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  attachments?: readonly EmailMessageAttachment[];
};

export type QuoteEmailSharedSettings = Readonly<{
  senderName: string;
  fromEmail: string;
  replyToEmail: string;
  subjectPrefix: string;
  headerText: string;
  footerText: string;
  imageAttachment: OrderEmailImageAttachment | null;
}>;

export type BuildQuoteEmailMessageInput = Readonly<{
  eventType: QuoteEmailEventType;
  audience: QuoteEmailAudience;
  customerType?: CustomerType;
  recipientEmail: string;
  recipientName?: string | null;
  requestNumber: string;
  offerNumber?: string | null;
  offerUrl?: string | null;
  otpCode?: string | null;
  detail?: string | null;
  sharedSettings: QuoteEmailSharedSettings;
  quoteSettings: Pick<QuoteEmailSettings, 'templates'>;
}>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const FALLBACK_SENDER_EMAIL = 'delivery-profile-pending@invalid.local';

function safeHeaderText(value: unknown): string {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#39;');
}

function fromHeader(name: string, email: string): string {
  const safeName = name.replace(/[\r\n<>]/gu, ' ').trim();
  return safeName ? `"${safeName}" <${email}>` : email;
}

function render(value: string, variables: Record<string, string>): string {
  return value.replace(/\{\{\s*([a-z_]+)\s*\}\}/gu, (_match, key: string) =>
    variables[key] ?? ''
  );
}

export function buildQuoteEmailMessage(
  input: BuildQuoteEmailMessageInput
): QuoteEmailMessage {
  const shared = input.sharedSettings;
  const defaults = QUOTE_EMAIL_EVENT_DEFAULTS[input.eventType];
  const templateAudience =
    input.audience === 'admin'
      ? 'admin'
      : input.customerType === 'school'
        ? 'schoolCustomer'
        : input.customerType === 'company'
          ? 'companyCustomer'
          : 'customer';
  const configuredTemplates = input.quoteSettings.templates[input.eventType];
  const audienceTemplate = configuredTemplates[templateAudience] ??
    configuredTemplates.customer;
  const variables = {
    recipient_name: (input.recipientName ?? '').replace(/\s+/gu, ' ').trim(),
    request_number: input.requestNumber,
    offer_number: input.offerNumber ?? input.requestNumber,
    otp_code: input.otpCode ?? ''
  };
  const templateSubject =
    typeof audienceTemplate.subject === 'string'
      ? audienceTemplate.subject
      : defaults.subject;
  const subject =
    safeHeaderText(render(templateSubject, variables)) ||
    safeHeaderText(render(defaults.subject, variables));
  const defaultGreeting =
    input.audience === 'admin'
      ? QUOTE_EMAIL_DEFAULT_ADMIN_GREETING
      : QUOTE_EMAIL_DEFAULT_GREETING;
  const configuredContent =
    typeof audienceTemplate.contentHtml === 'string'
      ? sanitizeEmailTemplateRichText(audienceTemplate.contentHtml)
      : '';
  const legacyContent = legacyEmailTemplateContentHtml({
    greeting:
      typeof audienceTemplate.greeting === 'string'
        ? audienceTemplate.greeting
        : defaultGreeting,
    heading:
      typeof audienceTemplate.heading === 'string'
        ? audienceTemplate.heading
        : templateSubject,
    body:
      typeof audienceTemplate.body === 'string'
        ? audienceTemplate.body
        : defaults.body
  });
  const content = renderEmailTemplateRichText(
    configuredContent || legacyContent,
    variables
  );
  const detail = input.detail?.trim() || '';
  const detailContent = detail
    ? renderEmailTemplateRichText(
        legacyEmailTemplateContentHtml({ body: detail }),
        {}
      )
    : { html: '', text: '' };
  const eventContentHtml = `${content.html}${detailContent.html}`;
  const eventContentText = [content.text, detailContent.text]
    .filter(Boolean)
    .join('\n\n');
  const headerText = shared.headerText.trim();
  const footerText = shared.footerText.trim();
  const action =
    input.offerUrl && input.audience === 'customer'
      ? `Preglej ponudbo: ${input.offerUrl}`
      : '';
  const text = [headerText, eventContentText, action, footerText]
    .filter(Boolean)
    .join('\n\n');
  const actionHtml =
    input.offerUrl && input.audience === 'customer'
      ? `<p style="${TRANSACTIONAL_EMAIL_COPY_STYLE}margin:0 0 20px;"><a href="${escapeHtml(input.offerUrl)}" style="${TRANSACTIONAL_EMAIL_COPY_STYLE}color:#2563eb;text-decoration:underline;">Preglej ponudbo</a></p>`
      : '';
  const attachment = normalizeEmailMessageAttachment(shared.imageAttachment);
  const senderEmail = EMAIL_PATTERN.test(shared.fromEmail)
    ? shared.fromEmail
    : FALLBACK_SENDER_EMAIL;
  const html = `<!doctype html>
<html lang="sl">
  <body style="${TRANSACTIONAL_EMAIL_BODY_STYLE}">
    <div style="${TRANSACTIONAL_EMAIL_CARD_STYLE}">
      ${headerText ? `<p style="${TRANSACTIONAL_EMAIL_COPY_STYLE}margin:0 0 18px;white-space:pre-line;color:#334155;">${escapeHtml(headerText)}</p>` : ''}
      ${eventContentHtml}
      ${actionHtml}
      ${footerText ? `<p style="${TRANSACTIONAL_EMAIL_COPY_STYLE}margin:28px 0 0;white-space:pre-line;border-top:1px solid #e2e8f0;padding-top:18px;color:#64748b;">${escapeHtml(footerText)}</p>` : ''}
    </div>
  </body>
</html>`;

  return {
    from: fromHeader(shared.senderName, senderEmail),
    to: input.recipientEmail,
    ...(shared.replyToEmail ? { replyTo: shared.replyToEmail } : {}),
    subject: `[${safeHeaderText(shared.subjectPrefix) || 'Atehna'}] ${subject}`,
    html,
    text,
    ...(attachment ? { attachments: [attachment] } : {})
  };
}
