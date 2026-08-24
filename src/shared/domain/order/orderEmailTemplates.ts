import { formatEuro } from '../formatting';
import {
  DEFAULT_ORDER_EMAIL_SETTINGS,
  type OrderEmailEventType,
  type StoredOrderEmailSettings
} from './orderEmailSettings';
import { getStatusLabel } from './orderStatus';

export type OrderEmailAudience = 'customer' | 'admin';

export type OrderEmailCustomerSnapshot = {
  organizationName: string | null;
  contactName: string;
  email: string;
  reference: string | null;
};

export type OrderEmailOrderLineSnapshot = {
  sku: string;
  name: string;
  unit: string | null;
  quantity: number;
  lineGross: number;
  imageUrl: string | null;
};

export type OrderEmailCustomerOrderSnapshot = {
  createdAt: string;
  customer: OrderEmailCustomerSnapshot;
  items: OrderEmailOrderLineSnapshot[];
  totals: {
    net: number;
    tax: number;
    shipping: number;
    gross: number;
  };
};

export type OrderEmailOrderSnapshot = OrderEmailCustomerOrderSnapshot & {
  orderId: number;
  orderNumber: string;
};

type OrderEmailJobPayloadBase = {
  eventType: OrderEmailEventType;
  recipientEmail: string;
  recipientName: string | null;
  occurredAt: string;
  previousStatus: string | null;
  settingsSnapshot: StoredOrderEmailSettings;
};

export type OrderEmailCustomerJobPayload = OrderEmailJobPayloadBase & {
  audience: 'customer';
  order: OrderEmailCustomerOrderSnapshot;
};

export type OrderEmailAdminJobPayload = OrderEmailJobPayloadBase & {
  audience: 'admin';
  order: OrderEmailOrderSnapshot;
};

export type OrderEmailJobPayload =
  | OrderEmailCustomerJobPayload
  | OrderEmailAdminJobPayload;

export type OrderEmailMessage = {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const HEADER_CONTROLS_PATTERN = /[\u0000-\u001f\u007f]+/gu;
const BODY_CONTROLS_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]+/gu;
const slDateFormatter = new Intl.DateTimeFormat('sl-SI', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'Europe/Ljubljana'
});

function safeHeaderText(value: unknown): string {
  return String(value ?? '')
    .replace(HEADER_CONTROLS_PATTERN, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function safeBodyText(value: unknown): string {
  return String(value ?? '')
    .replace(/\r\n?/gu, '\n')
    .replace(BODY_CONTROLS_PATTERN, ' ')
    .trim();
}

function escapeHtml(value: unknown): string {
  return safeBodyText(value)
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#39;');
}

function multilineHtml(value: unknown): string {
  return escapeHtml(value).replace(/\n/gu, '<br>');
}

function requireSafeEmail(value: unknown, field: string): string {
  const email = safeHeaderText(value).toLowerCase();
  if (email.length > 320 || !EMAIL_PATTERN.test(email)) {
    throw new Error(`${field} is not a valid email address.`);
  }
  return email;
}

function formatFromHeader(senderNameValue: unknown, fromEmailValue: unknown): string {
  const email = requireSafeEmail(fromEmailValue, 'fromEmail');
  const senderName = safeHeaderText(senderNameValue)
    .replace(/[<>]/gu, '')
    .replace(/\\/gu, '\\\\')
    .replace(/"/gu, '\\"');
  return senderName ? `"${senderName}" <${email}>` : email;
}

function finiteNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: unknown): string {
  return formatEuro(finiteNumber(value));
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? safeBodyText(value) : slDateFormatter.format(date);
}

function orderStatusLabel(eventType: OrderEmailEventType): string {
  return eventType === 'order_submitted'
    ? 'Prejeto'
    : getStatusLabel(eventType);
}

function hasSafeUrlHost(value: URL): boolean {
  return (
    !value.username &&
    !value.password &&
    Boolean(value.hostname) &&
    value.hostname.split('.').every((label) => label.length > 0)
  );
}

function safeAdminOrderUrl(siteUrlValue: unknown, orderId: number): string | null {
  if (!Number.isSafeInteger(orderId) || orderId <= 0) return null;
  try {
    const baseUrl = new URL(String(siteUrlValue ?? ''));
    if (
      baseUrl.protocol !== 'https:' || !hasSafeUrlHost(baseUrl)
    ) {
      throw new Error('Unsupported protocol');
    }
    return new URL(
      `/admin/orders/${encodeURIComponent(String(orderId))}`,
      baseUrl
    ).toString();
  } catch {
    return new URL(
      `/admin/orders/${encodeURIComponent(String(orderId))}`,
      DEFAULT_ORDER_EMAIL_SETTINGS.siteUrl
    ).toString();
  }
}

function customerDisplayName(customer: OrderEmailCustomerSnapshot): string {
  return safeBodyText(customer.organizationName) || safeBodyText(customer.contactName);
}

function lineDisplayName(item: OrderEmailOrderLineSnapshot): string {
  return safeBodyText(item.name);
}

function quantityLabel(item: OrderEmailOrderLineSnapshot): string {
  const quantity = new Intl.NumberFormat('sl-SI').format(finiteNumber(item.quantity));
  const unit = safeBodyText(item.unit);
  return unit ? `${quantity} ${unit}` : quantity;
}

function safeItemImageUrl(
  imageUrlValue: unknown,
  siteUrlValue: unknown
): string | null {
  const imageUrl = safeBodyText(imageUrlValue);
  if (
    !imageUrl ||
    (!imageUrl.startsWith('/') && !/^https:\/\//iu.test(imageUrl)) ||
    imageUrl.startsWith('//')
  ) {
    return null;
  }
  try {
    const baseUrl = new URL(String(siteUrlValue ?? ''));
    const parsed = new URL(imageUrl, baseUrl);
    if (parsed.protocol !== 'https:' || !hasSafeUrlHost(parsed)) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

type TemplateValues = Record<string, string>;

function buildTemplateValues(payload: OrderEmailJobPayload): TemplateValues {
  const values: TemplateValues = {
    customer_name: customerDisplayName(payload.order.customer),
    status: orderStatusLabel(payload.eventType),
    previous_status: payload.previousStatus
      ? getStatusLabel(payload.previousStatus)
      : ''
  };
  if (payload.audience === 'admin') {
    values.order_number = safeBodyText(payload.order.orderNumber);
    values.customer_email = safeBodyText(payload.order.customer.email);
  }
  return values;
}

function renderTemplate(value: unknown, variables: TemplateValues): string {
  return String(value ?? '').replace(
    /\{\{\s*([a-z_]+)\s*\}\}/gu,
    (_match, variable: string) => variables[variable] ?? ''
  );
}

function buildTemplateContent(payload: OrderEmailJobPayload): {
  subject: string;
  heading: string;
  body: string;
  greeting: string;
} {
  const audience = payload.audience === 'admin' ? 'admin' : 'customer';
  const defaults =
    DEFAULT_ORDER_EMAIL_SETTINGS.templates[payload.eventType][audience];
  const configured =
    payload.settingsSnapshot.templates?.[payload.eventType]?.[audience] ??
    defaults;
  const variables = buildTemplateValues(payload);
  const heading =
    safeHeaderText(renderTemplate(configured.subject, variables)) ||
    safeHeaderText(renderTemplate(defaults.subject, variables));
  const body =
    safeBodyText(renderTemplate(configured.body, variables)) ||
    safeBodyText(renderTemplate(defaults.body, variables));
  const prefix = safeHeaderText(payload.settingsSnapshot.subjectPrefix);
  const prefixText = prefix ? `[${prefix}] ` : '';
  const recipientName = safeBodyText(payload.recipientName);
  const greeting = recipientName ? `Pozdravljeni, ${recipientName},` : 'Pozdravljeni,';
  return {
    subject: `${prefixText}${heading}`,
    heading,
    body,
    greeting,
  };
}

function buildHtmlItems(
  items: OrderEmailOrderLineSnapshot[],
  siteUrl: string
): string {
  if (items.length === 0) {
    return '<p style="margin:0;color:#64748b;">Naročilo nima postavk.</p>';
  }

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
      <thead>
        <tr>
          <th align="left" style="border-bottom:1px solid #dbe4ee;padding:8px 0;font-size:12px;color:#64748b;">Artikel</th>
          <th align="right" style="border-bottom:1px solid #dbe4ee;padding:8px 0;font-size:12px;color:#64748b;">Količina</th>
          <th align="right" style="border-bottom:1px solid #dbe4ee;padding:8px 0;font-size:12px;color:#64748b;">Znesek</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((item) => {
          const imageUrl = safeItemImageUrl(item.imageUrl, siteUrl);
          return `
          <tr>
            <td style="border-bottom:1px solid #edf2f7;padding:10px 8px 10px 0;vertical-align:top;">
              <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                <tr>
                  ${imageUrl ? `<td width="72" style="width:72px;padding:0 12px 0 0;vertical-align:top;"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(lineDisplayName(item))}" width="72" height="72" style="display:block;width:72px;height:72px;border:0;border-radius:8px;object-fit:cover;"></td>` : ''}
                  <td style="vertical-align:top;">
                    <div style="font-weight:600;color:#0f172a;">${escapeHtml(lineDisplayName(item))}</div>
                    ${safeBodyText(item.sku) ? `<div style="margin-top:2px;font-size:12px;color:#64748b;">SKU: ${escapeHtml(item.sku)}</div>` : ''}
                  </td>
                </tr>
              </table>
            </td>
            <td align="right" style="border-bottom:1px solid #edf2f7;padding:10px 8px;vertical-align:top;color:#334155;">${escapeHtml(quantityLabel(item))}</td>
            <td align="right" style="border-bottom:1px solid #edf2f7;padding:10px 0 10px 8px;vertical-align:top;white-space:nowrap;color:#0f172a;">${escapeHtml(formatMoney(item.lineGross))}</td>
          </tr>
        `}).join('')}
      </tbody>
    </table>
  `;
}

function buildTextItems(items: OrderEmailOrderLineSnapshot[]): string {
  if (items.length === 0) return 'Naročilo nima postavk.';
  return items.map((item) => {
    const sku = safeBodyText(item.sku);
    return `- ${sku ? `${sku} · ` : ''}${lineDisplayName(item)} · ${quantityLabel(item)} · ${formatMoney(item.lineGross)}`;
  }).join('\n');
}

function buildHtmlTotals(order: OrderEmailCustomerOrderSnapshot): string {
  const rows: Array<[string, number, boolean?]> = [
    ['Vmesna vsota brez DDV', order.totals.net],
    ['DDV', order.totals.tax],
    ['Dostava', order.totals.shipping],
    ['Skupaj', order.totals.gross, true]
  ];
  return rows.map(([label, amount, emphasized]) => `
    <tr>
      <td style="padding:4px 12px 4px 0;color:${emphasized ? '#0f172a' : '#64748b'};font-weight:${emphasized ? '700' : '400'};">${escapeHtml(label)}</td>
      <td align="right" style="padding:4px 0;color:#0f172a;font-weight:${emphasized ? '700' : '500'};white-space:nowrap;">${escapeHtml(formatMoney(amount))}</td>
    </tr>
  `).join('');
}

function buildTextTotals(order: OrderEmailCustomerOrderSnapshot): string {
  return [
    `Vmesna vsota brez DDV: ${formatMoney(order.totals.net)}`,
    `DDV: ${formatMoney(order.totals.tax)}`,
    `Dostava: ${formatMoney(order.totals.shipping)}`,
    `Skupaj: ${formatMoney(order.totals.gross)}`
  ].join('\n');
}

export function buildOrderEmailMessage(payload: OrderEmailJobPayload): OrderEmailMessage {
  const from = formatFromHeader(
    payload.settingsSnapshot.senderName,
    payload.settingsSnapshot.fromEmail
  );
  const to = requireSafeEmail(payload.recipientEmail, 'recipientEmail');
  const replyTo = payload.settingsSnapshot.replyToEmail
    ? requireSafeEmail(payload.settingsSnapshot.replyToEmail, 'replyToEmail')
    : undefined;
  const content = buildTemplateContent(payload);
  const order = payload.order;
  const customerName = customerDisplayName(order.customer);
  const adminOrderUrl =
    payload.audience === 'admin'
      ? safeAdminOrderUrl(payload.settingsSnapshot.siteUrl, payload.order.orderId)
      : null;
  const footer = safeBodyText(payload.settingsSnapshot.footerText);
  const adminCustomerDetails = payload.audience === 'admin'
    ? `
      <div style="margin:20px 0;padding:14px 16px;border-radius:8px;background:#f8fafc;color:#334155;">
        <strong style="color:#0f172a;">Naročnik:</strong> ${escapeHtml(customerName || order.customer.contactName)}<br>
        <strong style="color:#0f172a;">E-pošta:</strong> ${escapeHtml(order.customer.email)}
        ${order.customer.reference ? `<br><strong style="color:#0f172a;">Referenca:</strong> ${escapeHtml(order.customer.reference)}` : ''}
      </div>
    `
    : '';
  const adminOrderNumber = payload.audience === 'admin'
    ? `<strong style="color:#0f172a;">Naročilo:</strong> ${escapeHtml(payload.order.orderNumber)}<br>`
    : '';
  const adminAction = payload.audience === 'admin' && adminOrderUrl
    ? `
      <p style="margin:24px 0;">
        <a href="${escapeHtml(adminOrderUrl)}" style="display:inline-block;border-radius:7px;background:#0f172a;padding:11px 16px;color:#ffffff;text-decoration:none;font-weight:600;">Odpri naročilo v administraciji</a>
      </p>
    `
    : '';

  const html = `<!doctype html>
<html lang="sl">
  <body style="margin:0;background:#f1f5f9;padding:24px;font-family:Arial,sans-serif;color:#0f172a;">
    <div style="max-width:680px;margin:0 auto;border:1px solid #dbe4ee;border-radius:12px;background:#ffffff;padding:28px;">
      <p style="margin:0 0 16px;color:#334155;">${escapeHtml(content.greeting)}</p>
      <h1 style="margin:0 0 10px;font-size:24px;line-height:1.3;">${escapeHtml(content.heading)}</h1>
      <p style="margin:0 0 20px;line-height:1.6;color:#334155;">${multilineHtml(content.body)}</p>
      ${adminCustomerDetails}
      <div style="margin:20px 0 12px;font-size:14px;color:#64748b;">
        ${adminOrderNumber}
        <strong style="color:#0f172a;">Datum:</strong> ${escapeHtml(formatDate(order.createdAt))}<br>
        <strong style="color:#0f172a;">Status:</strong> ${escapeHtml(orderStatusLabel(payload.eventType))}
      </div>
      ${buildHtmlItems(order.items, payload.settingsSnapshot.siteUrl)}
      <table role="presentation" cellspacing="0" cellpadding="0" style="margin:18px 0 0 auto;border-collapse:collapse;">
        ${buildHtmlTotals(order)}
      </table>
      ${adminAction}
      ${footer ? `<p style="margin:28px 0 0;border-top:1px solid #e2e8f0;padding-top:18px;line-height:1.6;color:#64748b;">${multilineHtml(footer)}</p>` : ''}
    </div>
  </body>
</html>`;

  const adminText = payload.audience === 'admin'
    ? [
        `Naročnik: ${customerName || safeBodyText(order.customer.contactName)}`,
        `E-pošta: ${safeBodyText(order.customer.email)}`,
        order.customer.reference
          ? `Referenca: ${safeBodyText(order.customer.reference)}`
          : null
      ].filter((line): line is string => Boolean(line)).join('\n')
    : '';
  const text = [
    content.greeting,
    '',
    content.heading,
    content.body,
    adminText ? `\n${adminText}` : '',
    '',
    payload.audience === 'admin'
      ? `Naročilo: ${safeBodyText(payload.order.orderNumber)}`
      : '',
    `Datum: ${formatDate(order.createdAt)}`,
    `Status: ${orderStatusLabel(payload.eventType)}`,
    '',
    buildTextItems(order.items),
    '',
    buildTextTotals(order),
    payload.audience === 'admin' && adminOrderUrl
      ? `\nAdministracija: ${adminOrderUrl}`
      : '',
    footer ? `\n${footer}` : ''
  ].join('\n').replace(/\n{3,}/gu, '\n\n').trim();

  return {
    from,
    to,
    ...(replyTo ? { replyTo } : {}),
    subject: content.subject,
    html,
    text
  };
}
