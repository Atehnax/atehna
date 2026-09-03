import {
  normalizeEmailMessageAttachment,
  type EmailMessageAttachment
} from '../order/orderEmailTemplates';
import type { OrderEmailImageAttachment } from '../order/orderEmailSettings';
import {
  TRANSACTIONAL_EMAIL_BODY_STYLE,
  TRANSACTIONAL_EMAIL_CARD_STYLE,
  TRANSACTIONAL_EMAIL_COPY_STYLE,
  TRANSACTIONAL_EMAIL_HEADING_STYLE
} from '../transactionalEmailHtml';
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
  const configuredTemplate = input.quoteSettings.templates[
    input.eventType
  ] as unknown as Record<string, unknown>;
  const audienceTemplate =
    configuredTemplate[input.audience] &&
    typeof configuredTemplate[input.audience] === 'object'
      ? (configuredTemplate[input.audience] as Record<string, unknown>)
      : {};
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
  const greeting = (
    safeHeaderText(
      render(
        typeof audienceTemplate.greeting === 'string'
          ? audienceTemplate.greeting
          : defaultGreeting,
        variables
      )
    ) || safeHeaderText(render(defaultGreeting, variables))
  ).replace(/,\s*,/gu, ',');
  const heading =
    safeHeaderText(
      render(
        typeof audienceTemplate.heading === 'string'
          ? audienceTemplate.heading
          : templateSubject,
        variables
      )
    ) || subject;
  const baseBody = render(
    typeof audienceTemplate.body === 'string'
      ? audienceTemplate.body
      : defaults.body,
    variables
  );
  const detail = input.detail?.trim() || '';
  const eventBody = `${baseBody}${detail ? `\n\n${detail}` : ''}`;
  const headerText = shared.headerText.trim();
  const footerText = shared.footerText.trim();
  const action =
    input.offerUrl && input.audience === 'customer'
      ? `Preglej ponudbo: ${input.offerUrl}`
      : '';
  const text = [headerText, greeting, heading, eventBody, action, footerText]
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
      ${greeting ? `<p style="${TRANSACTIONAL_EMAIL_COPY_STYLE}margin:0 0 16px;color:#334155;">${escapeHtml(greeting)}</p>` : ''}
      <h1 style="${TRANSACTIONAL_EMAIL_HEADING_STYLE}margin:0 0 10px;">${escapeHtml(heading)}</h1>
      <p style="${TRANSACTIONAL_EMAIL_COPY_STYLE}margin:0 0 20px;white-space:pre-line;color:#334155;">${escapeHtml(eventBody)}</p>
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
