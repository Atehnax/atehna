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

export type OrderEmailTemplate = {
  subject: string;
  body: string;
};

export type OrderEmailEventTemplates = {
  customer: OrderEmailTemplate;
  admin: OrderEmailTemplate;
  schoolCustomer?: OrderEmailTemplate;
};

export type OrderEmailTemplates = Record<
  Exclude<OrderEmailEventType, 'order_submitted'>,
  OrderEmailEventTemplates
> & {
  order_submitted: OrderEmailEventTemplates & {
    schoolCustomer: OrderEmailTemplate;
  };
};

export const ORDER_EMAIL_TEMPLATE_VARIABLES = {
  customer: [
    'customer_name',
    'organization_name',
    'contact_name',
    'reference',
    'status',
    'previous_status'
  ],
  schoolCustomer: [
    'customer_name',
    'organization_name',
    'contact_name',
    'reference',
    'status'
  ],
  admin: [
    'customer_name',
    'status',
    'previous_status',
    'order_number',
    'customer_email'
  ]
} as const;

export const ORDER_EMAIL_TEMPLATE_SUBJECT_MAX_LENGTH = 200;
export const ORDER_EMAIL_TEMPLATE_BODY_MAX_LENGTH = 5_000;

export type OrderEmailSettings = {
  version: 3;
  enabled: boolean;
  senderName: string;
  fromEmail: string;
  replyToEmail: string;
  adminRecipients: string[];
  subjectPrefix: string;
  siteUrl: string;
  footerText: string;
  events: Record<OrderEmailEventType, OrderEmailAudienceSettings>;
  templates: OrderEmailTemplates;
  updatedAt?: string | null;
};

export type StoredOrderEmailSettings = Omit<OrderEmailSettings, 'updatedAt'>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const HEADER_CONTROL_PATTERN = /[\u0000-\u001f\u007f]/u;
const HEADER_CONTROLS_GLOBAL_PATTERN = /[\u0000-\u001f\u007f]+/gu;
const BODY_CONTROL_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;
const BODY_CONTROLS_GLOBAL_PATTERN =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]+/gu;
const TEMPLATE_VARIABLE_PATTERN = /\{\{\s*([^{}]+?)\s*\}\}/gu;
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

const defaultTemplates = Object.fromEntries(
  ORDER_EMAIL_EVENT_DEFINITIONS.map(({ value, label }) => {
    if (value === 'order_submitted') {
      return [
        value,
        {
          customer: {
            subject: 'Va\u0161e naro\u010dilo je bilo prejeto',
            body: 'Va\u0161e naro\u010dilo smo uspe\u0161no prejeli. O nadaljnjih spremembah vas bomo obvestili po e-po\u0161ti.'
          },
          schoolCustomer: {
            subject: 'Va\u0161e naro\u010dilo je bilo prejeto \u2013 nalo\u017eite naro\u010dilnico',
            body: 'Na podpisani oziroma odobreni naro\u010dilnici navedite spodaj izpisane podatke o naro\u010dniku, kontaktni osebi in morebitni referenci ter naro\u010dene artikle in zneske iz povzetka naro\u010dila. Naro\u010dilnico nato nalo\u017eite v obliki PDF ali JPG (najve\u010d 10 MB) prek varne povezave v tem sporo\u010dilu. Naro\u010dilo bomo za\u010deli obdelovati po prejemu in pregledu naro\u010dilnice. Dokument se samodejno in varno pove\u017ee z va\u0161im naro\u010dilom, zato interne \u0161tevilke naro\u010dila ni treba vpisati.'
          },
          admin: {
            subject: 'Novo naro\u010dilo {{order_number}}',
            body: 'Novo naro\u010dilo {{order_number}} je pripravljeno za pregled v administraciji.'
          }
        }
      ];
    }

    return [
      value,
      {
        customer: {
          subject: `Status va\u0161ega naro\u010dila: ${label}`,
          body: 'Status va\u0161ega naro\u010dila je zdaj \u00bb{{status}}\u00ab.'
        },
        admin: {
          subject: 'Naro\u010dilo {{order_number}}: {{status}}',
          body: 'Status naro\u010dila {{order_number}} je zdaj \u00bb{{status}}\u00ab.'
        }
      }
    ];
  })
) as OrderEmailTemplates;

export const DEFAULT_ORDER_EMAIL_SETTINGS: OrderEmailSettings = {
  version: 3,
  enabled: false,
  senderName: 'Atehna',
  fromEmail: '',
  replyToEmail: COMPANY_INFO.orderEmail,
  adminRecipients: [],
  subjectPrefix: 'Atehna',
  siteUrl: 'https://www.atehna-test.site',
  footerText: `Lep pozdrav,\n${COMPANY_INFO.name}`,
  events: defaultEvents,
  templates: defaultTemplates,
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

function sanitizeBodyText(value: unknown, fallback: string): string {
  const text = typeof value === 'string' ? value : fallback;
  return text
    .replace(/\r\n?/gu, '\n')
    .replace(BODY_CONTROLS_GLOBAL_PATTERN, ' ')
    .trim();
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

function isSafeSiteUrl(parsed: URL): boolean {
  if (parsed.protocol !== 'https:') return false;
  if (parsed.username || parsed.password || !parsed.hostname) return false;
  return parsed.hostname.split('.').every((label) => label.length > 0);
}

function normalizeSiteUrl(value: unknown): string {
  const candidate = sanitizeHeaderText(value, DEFAULT_ORDER_EMAIL_SETTINGS.siteUrl);
  try {
    const parsed = new URL(candidate);
    if (!isSafeSiteUrl(parsed)) {
      return DEFAULT_ORDER_EMAIL_SETTINGS.siteUrl;
    }
    return parsed.origin;
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
    ) as Record<OrderEmailEventType, OrderEmailAudienceSettings>,
    templates: Object.fromEntries(
      ORDER_EMAIL_EVENT_DEFINITIONS.map(({ value: eventType }) => [
        eventType,
        {
          customer: { ...value.templates[eventType].customer },
          admin: { ...value.templates[eventType].admin },
          ...(value.templates[eventType].schoolCustomer
            ? {
                schoolCustomer: {
                  ...value.templates[eventType].schoolCustomer
                }
              }
            : {})
        }
      ])
    ) as OrderEmailTemplates
  };
}

export const cloneDefaultOrderEmailSettings = cloneOrderEmailSettings;

export function normalizeOrderEmailSettings(value: unknown): OrderEmailSettings {
  const record = asRecord(value);
  const rawEvents = asRecord(record.events);
  const rawTemplates = asRecord(record.templates);
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
  const templates = Object.fromEntries(
    ORDER_EMAIL_EVENT_DEFINITIONS.map(({ value: eventType }) => {
      const rawEventTemplates = asRecord(rawTemplates[eventType]);
      const defaults = DEFAULT_ORDER_EMAIL_SETTINGS.templates[eventType];
      const rawCustomer = asRecord(rawEventTemplates.customer);
      const rawAdmin = asRecord(rawEventTemplates.admin);
      const rawSchoolCustomer = asRecord(rawEventTemplates.schoolCustomer);
      return [
        eventType,
        {
          customer: {
            subject: sanitizeHeaderText(
              rawCustomer.subject,
              defaults.customer.subject
            ),
            body: sanitizeBodyText(rawCustomer.body, defaults.customer.body)
          },
          admin: {
            subject: sanitizeHeaderText(rawAdmin.subject, defaults.admin.subject),
            body: sanitizeBodyText(rawAdmin.body, defaults.admin.body)
          },
          ...(defaults.schoolCustomer
            ? {
                schoolCustomer: {
                  subject: sanitizeHeaderText(
                    rawSchoolCustomer.subject,
                    defaults.schoolCustomer.subject
                  ),
                  body: sanitizeBodyText(
                    rawSchoolCustomer.body,
                    defaults.schoolCustomer.body
                  )
                }
              }
            : {})
        }
      ];
    })
  ) as OrderEmailTemplates;

  const updatedAt =
    typeof record.updatedAt === 'string'
      ? record.updatedAt
      : typeof record.updated_at === 'string'
        ? record.updated_at
        : null;

  return {
    version: 3,
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
    templates,
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
    return isSafeSiteUrl(parsed);
  } catch {
    return false;
  }
}

function templateVariables(value: string): string[] {
  return Array.from(value.matchAll(TEMPLATE_VARIABLE_PATTERN), (match) =>
    String(match[1] ?? '').trim()
  );
}

function validateTemplate(
  value: unknown,
  eventLabel: string,
  audience: keyof typeof ORDER_EMAIL_TEMPLATE_VARIABLES,
  fallback: OrderEmailTemplate
): string[] {
  const record = asRecord(value);
  const audienceLabel =
    audience === 'admin'
      ? 'administratorja'
      : audience === 'schoolCustomer'
        ? '\u0161olo ali javni zavod'
        : 'stranko';
  const errors: string[] = [];
  if (
    value !== undefined &&
    (!value || typeof value !== 'object' || Array.isArray(value))
  ) {
    errors.push(`Predloga za ${audienceLabel} (${eventLabel}) ni veljavna.`);
    return errors;
  }
  if (record.subject !== undefined && typeof record.subject !== 'string') {
    errors.push(`Zadeva predloge za ${audienceLabel} (${eventLabel}) ni veljavna.`);
  }
  if (record.body !== undefined && typeof record.body !== 'string') {
    errors.push(`Besedilo predloge za ${audienceLabel} (${eventLabel}) ni veljavno.`);
  }

  const subject =
    typeof record.subject === 'string' ? record.subject : fallback.subject;
  const body = typeof record.body === 'string' ? record.body : fallback.body;
  if (hasHeaderControls(subject)) {
    errors.push(
      `Zadeva predloge za ${audienceLabel} (${eventLabel}) ne sme vsebovati kontrolnih znakov ali novih vrstic.`
    );
  }
  if (BODY_CONTROL_PATTERN.test(body)) {
    errors.push(
      `Besedilo predloge za ${audienceLabel} (${eventLabel}) vsebuje nedovoljene kontrolne znake.`
    );
  }
  if (!sanitizeHeaderText(subject, '')) {
    errors.push(`Zadeva predloge za ${audienceLabel} (${eventLabel}) je obvezna.`);
  }
  if (!sanitizeBodyText(body, '')) {
    errors.push(`Besedilo predloge za ${audienceLabel} (${eventLabel}) je obvezno.`);
  }
  if (subject.length > ORDER_EMAIL_TEMPLATE_SUBJECT_MAX_LENGTH) {
    errors.push(
      `Zadeva predloge za ${audienceLabel} (${eventLabel}) je lahko dolga najve\u010d ${ORDER_EMAIL_TEMPLATE_SUBJECT_MAX_LENGTH} znakov.`
    );
  }
  if (body.length > ORDER_EMAIL_TEMPLATE_BODY_MAX_LENGTH) {
    errors.push(
      `Besedilo predloge za ${audienceLabel} (${eventLabel}) je lahko dolgo najve\u010d ${ORDER_EMAIL_TEMPLATE_BODY_MAX_LENGTH} znakov.`
    );
  }

  const allowedVariables = new Set<string>(ORDER_EMAIL_TEMPLATE_VARIABLES[audience]);
  for (const variable of [...templateVariables(subject), ...templateVariables(body)]) {
    if (!allowedVariables.has(variable)) {
      errors.push(
        `Spremenljivka {{${variable}}} ni dovoljena v predlogi za ${audienceLabel} (${eventLabel}).`
      );
    }
  }
  return errors;
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
    errors.push('Spletni naslov mora biti veljaven naslov HTTPS.');
  }

  if (
    record.templates !== undefined &&
    (!record.templates ||
      typeof record.templates !== 'object' ||
      Array.isArray(record.templates))
  ) {
    errors.push('Predloge e-po\u0161tnih sporo\u010dil niso veljavne.');
  }
  const rawTemplates = asRecord(record.templates);
  for (const event of ORDER_EMAIL_EVENT_DEFINITIONS) {
    const rawEventValue = rawTemplates[event.value];
    if (
      rawEventValue !== undefined &&
      (!rawEventValue ||
        typeof rawEventValue !== 'object' ||
        Array.isArray(rawEventValue))
    ) {
      errors.push(`Predloge za dogodek »${event.label}« niso veljavne.`);
    }
    const rawEvent = asRecord(rawEventValue);
    const defaults = DEFAULT_ORDER_EMAIL_SETTINGS.templates[event.value];
    errors.push(
      ...validateTemplate(rawEvent.customer, event.label, 'customer', defaults.customer),
      ...validateTemplate(rawEvent.admin, event.label, 'admin', defaults.admin),
      ...(event.value === 'order_submitted' && defaults.schoolCustomer
        ? validateTemplate(
            rawEvent.schoolCustomer,
            'Oddano naro\u010dilo \u2013 \u0161ola / javni zavod',
            'schoolCustomer',
            defaults.schoolCustomer
          )
        : [])
    );
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
