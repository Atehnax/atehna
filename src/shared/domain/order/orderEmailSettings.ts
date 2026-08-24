import { COMPANY_INFO } from './constants';
import { ORDER_STATUS_OPTIONS } from './orderStatus';

export const ORDER_EMAIL_EVENT_DEFINITIONS = [
  {
    value: 'order_submitted',
    label: 'Oddano naročilo',
    description: 'Ko kupec uspešno odda novo naročilo.'
  },
  ...ORDER_STATUS_OPTIONS.map((status) => ({
    value: status.value,
    label: status.label,
    description: `Ko se status naročila spremeni v »${status.label}«.`
  }))
] as const;

export type OrderEmailEventType =
  (typeof ORDER_EMAIL_EVENT_DEFINITIONS)[number]['value'];

export type OrderEmailAudienceSettings = {
  customer: boolean;
  admins: boolean;
};

export type OrderEmailSettings = {
  version: 1;
  enabled: boolean;
  senderName: string;
  fromEmail: string;
  replyToEmail: string;
  adminRecipients: string[];
  subjectPrefix: string;
  siteUrl: string;
  footerText: string;
  events: Record<OrderEmailEventType, OrderEmailAudienceSettings>;
  updatedAt?: string | null;
};

export type StoredOrderEmailSettings = Omit<OrderEmailSettings, 'updatedAt'>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const HEADER_CONTROL_PATTERN = /[\u0000-\u001f\u007f]/u;
const HEADER_CONTROLS_GLOBAL_PATTERN = /[\u0000-\u001f\u007f]+/gu;
const MAX_ADMIN_RECIPIENTS = 20;

const requestedByDefault = new Set<OrderEmailEventType>([
  'order_submitted',
  'in_progress',
  'partially_sent',
  'sent'
]);

const defaultEvents = Object.fromEntries(
  ORDER_EMAIL_EVENT_DEFINITIONS.map(({ value }) => [
    value,
    {
      customer: requestedByDefault.has(value),
      admins: requestedByDefault.has(value)
    }
  ])
) as Record<OrderEmailEventType, OrderEmailAudienceSettings>;

export const DEFAULT_ORDER_EMAIL_SETTINGS: OrderEmailSettings = {
  version: 1,
  enabled: false,
  senderName: 'Atehna',
  fromEmail: '',
  replyToEmail: COMPANY_INFO.orderEmail,
  adminRecipients: [],
  subjectPrefix: 'Atehna',
  siteUrl: 'https://www.atehna-test.site',
  footerText: `Lep pozdrav,\n${COMPANY_INFO.name}`,
  events: defaultEvents,
  updatedAt: null
};

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function asTrimmedText(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function sanitizeHeaderText(value: unknown, fallback: string): string {
  const text = typeof value === 'string' ? value : fallback;
  return text
    .replace(HEADER_CONTROLS_GLOBAL_PATTERN, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function normalizeEmail(value: unknown): string {
  return sanitizeHeaderText(value, '').toLowerCase();
}

function normalizeSiteUrl(value: unknown): string {
  const candidate = sanitizeHeaderText(value, DEFAULT_ORDER_EMAIL_SETTINGS.siteUrl);
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return DEFAULT_ORDER_EMAIL_SETTINGS.siteUrl;
    }
    parsed.hash = '';
    parsed.search = '';
    return parsed.toString().replace(/\/$/u, '');
  } catch {
    return DEFAULT_ORDER_EMAIL_SETTINGS.siteUrl;
  }
}

function normalizeAdminRecipients(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const recipients: string[] = [];
  const seen = new Set<string>();
  for (const rawRecipient of value) {
    const recipient = normalizeEmail(rawRecipient);
    if (!recipient || seen.has(recipient)) continue;
    recipients.push(recipient);
    seen.add(recipient);
    if (recipients.length === MAX_ADMIN_RECIPIENTS) break;
  }
  return recipients;
}

export function isOrderEmailEventType(value: string): value is OrderEmailEventType {
  return ORDER_EMAIL_EVENT_DEFINITIONS.some((event) => event.value === value);
}

export function cloneOrderEmailSettings(
  value: OrderEmailSettings = DEFAULT_ORDER_EMAIL_SETTINGS
): OrderEmailSettings {
  return {
    ...value,
    adminRecipients: [...value.adminRecipients],
    events: Object.fromEntries(
      ORDER_EMAIL_EVENT_DEFINITIONS.map(({ value: eventType }) => [
        eventType,
        { ...value.events[eventType] }
      ])
    ) as Record<OrderEmailEventType, OrderEmailAudienceSettings>
  };
}

export const cloneDefaultOrderEmailSettings = cloneOrderEmailSettings;

export function normalizeOrderEmailSettings(value: unknown): OrderEmailSettings {
  const record = asRecord(value);
  const rawEvents = asRecord(record.events);
  const events = Object.fromEntries(
    ORDER_EMAIL_EVENT_DEFINITIONS.map(({ value: eventType }) => {
      const rawEvent = asRecord(rawEvents[eventType]);
      const defaults = DEFAULT_ORDER_EMAIL_SETTINGS.events[eventType];
      return [
        eventType,
        {
          customer:
            typeof rawEvent.customer === 'boolean'
              ? rawEvent.customer
              : defaults.customer,
          admins:
            typeof rawEvent.admins === 'boolean'
              ? rawEvent.admins
              : defaults.admins
        }
      ];
    })
  ) as Record<OrderEmailEventType, OrderEmailAudienceSettings>;

  const updatedAt =
    typeof record.updatedAt === 'string'
      ? record.updatedAt
      : typeof record.updated_at === 'string'
        ? record.updated_at
        : null;

  return {
    version: 1,
    enabled:
      typeof record.enabled === 'boolean'
        ? record.enabled
        : DEFAULT_ORDER_EMAIL_SETTINGS.enabled,
    senderName: sanitizeHeaderText(
      record.senderName,
      DEFAULT_ORDER_EMAIL_SETTINGS.senderName
    ),
    fromEmail: normalizeEmail(record.fromEmail),
    replyToEmail:
      record.replyToEmail === undefined
        ? DEFAULT_ORDER_EMAIL_SETTINGS.replyToEmail
        : normalizeEmail(record.replyToEmail),
    adminRecipients: normalizeAdminRecipients(record.adminRecipients),
    subjectPrefix: sanitizeHeaderText(
      record.subjectPrefix,
      DEFAULT_ORDER_EMAIL_SETTINGS.subjectPrefix
    ),
    siteUrl: normalizeSiteUrl(record.siteUrl),
    footerText: asTrimmedText(
      record.footerText,
      DEFAULT_ORDER_EMAIL_SETTINGS.footerText
    ),
    events,
    updatedAt
  };
}

export function toStoredOrderEmailSettings(
  value: unknown
): StoredOrderEmailSettings {
  const normalized = normalizeOrderEmailSettings(value);
  const { updatedAt: _updatedAt, ...stored } = normalized;
  return stored;
}

function hasHeaderControls(value: unknown): boolean {
  return typeof value === 'string' && HEADER_CONTROL_PATTERN.test(value);
}

function isValidEmail(value: string): boolean {
  return value.length <= 320 && EMAIL_PATTERN.test(value);
}

function isValidSiteUrl(value: unknown): boolean {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateOrderEmailSettingsInput(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return ['Nastavitve samodejne e-pošte niso veljavne.'];
  }

  const record = asRecord(value);
  const errors: string[] = [];
  const rawHeaderFields: Array<[unknown, string]> = [
    [record.senderName, 'Ime pošiljatelja'],
    [record.fromEmail, 'E-poštni naslov pošiljatelja'],
    [record.replyToEmail, 'Naslov za odgovor'],
    [record.subjectPrefix, 'Predpona zadeve']
  ];

  for (const [fieldValue, fieldLabel] of rawHeaderFields) {
    if (hasHeaderControls(fieldValue)) {
      errors.push(`${fieldLabel} ne sme vsebovati kontrolnih znakov ali novih vrstic.`);
    }
  }

  const rawRecipients = Array.isArray(record.adminRecipients)
    ? record.adminRecipients
    : [];
  if (record.adminRecipients !== undefined && !Array.isArray(record.adminRecipients)) {
    errors.push('Seznam e-poštnih naslovov administratorjev ni veljaven.');
  }
  if (rawRecipients.length > MAX_ADMIN_RECIPIENTS) {
    errors.push(`Dodate lahko največ ${MAX_ADMIN_RECIPIENTS} administratorskih naslovov.`);
  }
  rawRecipients.forEach((recipient, index) => {
    if (hasHeaderControls(recipient)) {
      errors.push(
        `Administratorski naslov ${index + 1} ne sme vsebovati kontrolnih znakov ali novih vrstic.`
      );
      return;
    }
    const normalizedRecipient = normalizeEmail(recipient);
    if (!isValidEmail(normalizedRecipient)) {
      errors.push(`Administratorski naslov ${index + 1} ni veljaven.`);
    }
  });

  const normalized = normalizeOrderEmailSettings(record);
  if (normalized.fromEmail && !isValidEmail(normalized.fromEmail)) {
    errors.push('E-poštni naslov pošiljatelja ni veljaven.');
  }
  if (normalized.replyToEmail && !isValidEmail(normalized.replyToEmail)) {
    errors.push('Naslov za odgovor ni veljaven.');
  }
  if (!isValidSiteUrl(record.siteUrl ?? normalized.siteUrl)) {
    errors.push('Spletni naslov mora biti veljaven naslov HTTP ali HTTPS.');
  }

  if (normalized.enabled) {
    if (!normalized.senderName) {
      errors.push('Pri vključeni e-pošti je ime pošiljatelja obvezno.');
    }
    if (!normalized.fromEmail) {
      errors.push('Pri vključeni e-pošti je naslov pošiljatelja obvezen.');
    }

    const enabledAudiences = Object.values(normalized.events);
    const hasCustomerAudience = enabledAudiences.some((event) => event.customer);
    const hasAdminAudience = enabledAudiences.some((event) => event.admins);
    if (!hasCustomerAudience && !hasAdminAudience) {
      errors.push('Vključite vsaj eno občinstvo za najmanj en e-poštni dogodek.');
    }
    if (hasAdminAudience && normalized.adminRecipients.length === 0) {
      errors.push(
        'Za vključena administratorska obvestila dodajte vsaj en administratorski naslov.'
      );
    }
  }

  return Array.from(new Set(errors));
}
