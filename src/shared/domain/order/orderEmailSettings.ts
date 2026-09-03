import { COMPANY_INFO } from './constants';
import { ORDER_STATUS_OPTIONS } from './orderStatus';

export const ORDER_EMAIL_EVENT_DEFINITIONS = [
  {
    value: 'order_submitted',
    label: 'Naročilo prejeto',
    description: 'Ko kupec uspešno odda novo naročilo; to še ni sprejem prodajalca.'
  },
  {
    value: 'order_accepted',
    label: 'Neposredno naročilo samodejno sprejeto',
    description:
      'Ko sistem ob oddaji samodejno sprejme neposredno naročilo. Spremembo statusa na »V obdelavi« upravlja ločeni dogodek.'
  },
  {
    value: 'order_rejected',
    label: 'Naročilo pogodbeno zavrnjeno',
    description:
      'Ko administrator izrecno zavrne pogodbeni sprejem. Spremembo statusa na »Preklicano« upravlja ločeni dogodek.'
  },
  {
    value: 'predracun_issued',
    label: 'Predračun poslan',
    description:
      'Ko administrator izrecno pošlje izbrano različico predračuna stranki.'
  },
  {
    value: 'invoice_issued',
    label: 'Račun poslan',
    description:
      'Ko administrator izrecno pošlje izbrano različico računa stranki.'
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
  greeting?: string;
  heading?: string;
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
    'recipient_name',
    'customer_name',
    'organization_name',
    'contact_name',
    'reference',
    'status',
    'previous_status'
  ],
  schoolCustomer: [
    'recipient_name',
    'customer_name',
    'organization_name',
    'contact_name',
    'reference',
    'status'
  ],
  admin: [
    'recipient_name',
    'customer_name',
    'status',
    'previous_status',
    'order_number',
    'customer_email'
  ]
} as const;

export const ORDER_EMAIL_TEMPLATE_SUBJECT_MAX_LENGTH = 200;
export const ORDER_EMAIL_TEMPLATE_GREETING_MAX_LENGTH = 300;
export const ORDER_EMAIL_TEMPLATE_HEADING_MAX_LENGTH = 300;
export const ORDER_EMAIL_TEMPLATE_BODY_MAX_LENGTH = 5_000;
export const ORDER_EMAIL_SHARED_TEXT_MAX_LENGTH = 1_000;
export const ORDER_EMAIL_IMAGE_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
export const ORDER_EMAIL_IMAGE_ATTACHMENT_CONTENT_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif'
] as const;

export type OrderEmailImageAttachment = {
  url: string;
  pathname: string;
  filename: string;
  contentType: (typeof ORDER_EMAIL_IMAGE_ATTACHMENT_CONTENT_TYPES)[number];
  size: number;
};

export type OrderEmailSettings = {
  version: 5;
  enabled: boolean;
  confirmCustomerEmails: boolean;
  senderName: string;
  fromEmail: string;
  replyToEmail: string;
  adminRecipients: string[];
  subjectPrefix: string;
  siteUrl: string;
  headerText: string;
  footerText: string;
  imageAttachment: OrderEmailImageAttachment | null;
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
const VERCEL_PUBLIC_BLOB_HOST_PATTERN =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.public\.blob\.vercel-storage\.com$/u;
const EMAIL_IMAGE_ATTACHMENT_PATH_PATTERN =
  /^email\/shared\/[A-Za-z0-9][A-Za-z0-9._-]{0,254}\.(?:png|jpg|webp|gif)$/u;
const EMAIL_IMAGE_ATTACHMENT_EXTENSIONS: Record<
  OrderEmailImageAttachment['contentType'],
  ReadonlySet<string>
> = {
  'image/png': new Set(['png']),
  'image/jpeg': new Set(['jpg', 'jpeg']),
  'image/webp': new Set(['webp']),
  'image/gif': new Set(['gif'])
};
const EMAIL_IMAGE_ATTACHMENT_FIELDS = new Set([
  'url',
  'pathname',
  'filename',
  'contentType',
  'size'
]);

const requestedByDefault = new Set<OrderEmailEventType>([
  'order_submitted',
  'order_accepted',
  'order_rejected',
  'predracun_issued',
  'invoice_issued',
  'in_progress',
  'partially_sent',
  'sent'
]);

const customerOnlyByDefault = new Set<OrderEmailEventType>([
  'predracun_issued',
  'invoice_issued'
]);

const defaultEvents = Object.fromEntries(
  ORDER_EMAIL_EVENT_DEFINITIONS.map(({ value }) => [
    value,
    {
      customer: requestedByDefault.has(value),
      admins:
        requestedByDefault.has(value) && !customerOnlyByDefault.has(value)
    }
  ])
) as Record<OrderEmailEventType, OrderEmailAudienceSettings>;

const DEFAULT_ORDER_EMAIL_TEMPLATE_GREETING =
  'Pozdravljeni, {{recipient_name}},';

const legacyDefaultTemplates = Object.fromEntries(
  ORDER_EMAIL_EVENT_DEFINITIONS.map(({ value, label }) => {
    if (value === 'order_submitted') {
      return [
        value,
        {
          customer: {
            subject: 'Va\u0161e naro\u010dilo je bilo prejeto',
            body: 'Prejeli smo va\u0161e naro\u010dilo. Naro\u010dilo \u0161e ni potrjeno. O sprejemu ali zavrnitvi vas bomo obvestili po e-po\u0161ti.'
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

    if (value === 'order_accepted') {
      return [
        value,
        {
          customer: {
            subject: 'Va\u0161e naro\u010dilo je potrjeno',
            body: 'Atehna je sprejela va\u0161e naro\u010dilo. Va\u0161e naro\u010dilo je potrjeno.'
          },
          admin: {
            subject: 'Naro\u010dilo {{order_number}} je sprejeto',
            body: 'Naro\u010dilo {{order_number}} je bilo pogodbeno sprejeto.'
          }
        }
      ];
    }

    if (value === 'order_rejected') {
      return [
        value,
        {
          customer: {
            subject: 'Va\u0161e naro\u010dilo ni bilo sprejeto',
            body: 'Atehna va\u0161ega naro\u010dila ni sprejela. Naro\u010dilo zato ni potrjeno in ne bo izpolnjeno. Za dodatna pojasnila odgovorite na to sporo\u010dilo.'
          },
          admin: {
            subject: 'Naro\u010dilo {{order_number}} je zavrnjeno',
            body: 'Naro\u010dilo {{order_number}} je bilo pogodbeno zavrnjeno.'
          }
        }
      ];
    }

    if (value === 'predracun_issued') {
      return [
        value,
        {
          customer: {
            subject: 'Vaš predračun je pripravljen',
            body: 'V priponki vam pošiljamo predračun za vaše naročilo.'
          },
          admin: {
            subject: 'Predračun za naročilo {{order_number}} je poslan',
            body: 'Predračun za naročilo {{order_number}} je bil poslan stranki.'
          }
        }
      ];
    }

    if (value === 'invoice_issued') {
      return [
        value,
        {
          customer: {
            subject: 'Vaš račun je pripravljen',
            body: 'V priponki vam pošiljamo račun za vaše naročilo.'
          },
          admin: {
            subject: 'Račun za naročilo {{order_number}} je poslan',
            body: 'Račun za naročilo {{order_number}} je bil poslan stranki.'
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

const defaultTemplates = Object.fromEntries(
  ORDER_EMAIL_EVENT_DEFINITIONS.map(({ value: eventType }) => {
    const eventTemplates = legacyDefaultTemplates[eventType];
    const completeTemplate = (template: OrderEmailTemplate): OrderEmailTemplate => ({
      ...template,
      greeting: DEFAULT_ORDER_EMAIL_TEMPLATE_GREETING,
      heading: template.subject
    });
    return [
      eventType,
      {
        customer: completeTemplate(eventTemplates.customer),
        admin: completeTemplate(eventTemplates.admin),
        ...(eventTemplates.schoolCustomer
          ? { schoolCustomer: completeTemplate(eventTemplates.schoolCustomer) }
          : {})
      }
    ];
  })
) as OrderEmailTemplates;

export const DEFAULT_ORDER_EMAIL_SETTINGS: OrderEmailSettings = {
  version: 5,
  enabled: false,
  confirmCustomerEmails: true,
  senderName: 'Atehna',
  fromEmail: '',
  replyToEmail: COMPANY_INFO.orderEmail,
  adminRecipients: [],
  subjectPrefix: 'Atehna',
  siteUrl: 'https://www.atehna-test.site',
  headerText: '',
  footerText: `Lep pozdrav,\n${COMPANY_INFO.name}`,
  imageAttachment: null,
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

function imageAttachmentExtension(value: string): string {
  return value.split('.').pop()?.toLowerCase() ?? '';
}

function isSafeImageAttachmentFilename(
  value: string,
  contentType: OrderEmailImageAttachment['contentType']
): boolean {
  return (
    value === value.trim() &&
    value.length > 0 &&
    value.length <= 255 &&
    value !== '.' &&
    value !== '..' &&
    !/[\\/]/u.test(value) &&
    !HEADER_CONTROL_PATTERN.test(value) &&
    EMAIL_IMAGE_ATTACHMENT_EXTENSIONS[contentType].has(
      imageAttachmentExtension(value)
    )
  );
}

function isTrustedImageAttachmentUrl(url: string, pathname: string): boolean {
  if (url !== url.trim() || !EMAIL_IMAGE_ATTACHMENT_PATH_PATTERN.test(pathname)) {
    return false;
  }
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      !parsed.username &&
      !parsed.password &&
      !parsed.port &&
      !parsed.search &&
      !parsed.hash &&
      VERCEL_PUBLIC_BLOB_HOST_PATTERN.test(parsed.hostname.toLowerCase()) &&
      parsed.pathname === `/${pathname}`
    );
  } catch {
    return false;
  }
}

function normalizeOrderEmailImageAttachment(
  value: unknown
): OrderEmailImageAttachment | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as UnknownRecord;
  if (Object.keys(record).some((key) => !EMAIL_IMAGE_ATTACHMENT_FIELDS.has(key))) {
    return null;
  }
  const url = typeof record.url === 'string' ? record.url.trim() : '';
  const pathname =
    typeof record.pathname === 'string' ? record.pathname.trim() : '';
  const filename =
    typeof record.filename === 'string' ? record.filename.trim() : '';
  const contentType =
    typeof record.contentType === 'string' ? record.contentType : '';
  const size = record.size;
  if (
    !ORDER_EMAIL_IMAGE_ATTACHMENT_CONTENT_TYPES.includes(
      contentType as OrderEmailImageAttachment['contentType']
    ) ||
    typeof size !== 'number' ||
    !Number.isSafeInteger(size) ||
    size <= 0 ||
    size > ORDER_EMAIL_IMAGE_ATTACHMENT_MAX_BYTES
  ) {
    return null;
  }
  const safeContentType = contentType as OrderEmailImageAttachment['contentType'];
  if (
    !isSafeImageAttachmentFilename(filename, safeContentType) ||
    !EMAIL_IMAGE_ATTACHMENT_EXTENSIONS[safeContentType].has(
      imageAttachmentExtension(pathname)
    ) ||
    !isTrustedImageAttachmentUrl(url, pathname)
  ) {
    return null;
  }
  return { url, pathname, filename, contentType: safeContentType, size };
}

function validateOrderEmailImageAttachment(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return ['Slikovna priponka skupne e-pošte ni veljavna.'];
  }
  const record = value as UnknownRecord;
  const errors: string[] = [];
  if (Object.keys(record).some((key) => !EMAIL_IMAGE_ATTACHMENT_FIELDS.has(key))) {
    errors.push('Slikovna priponka vsebuje nedovoljena polja.');
  }
  const contentType =
    typeof record.contentType === 'string' ? record.contentType : '';
  if (
    !ORDER_EMAIL_IMAGE_ATTACHMENT_CONTENT_TYPES.includes(
      contentType as OrderEmailImageAttachment['contentType']
    )
  ) {
    errors.push('Slikovna priponka mora biti datoteka PNG, JPEG, WebP ali GIF.');
    return errors;
  }
  const safeContentType = contentType as OrderEmailImageAttachment['contentType'];
  const filename = typeof record.filename === 'string' ? record.filename : '';
  const pathname = typeof record.pathname === 'string' ? record.pathname : '';
  const url = typeof record.url === 'string' ? record.url : '';
  if (!isSafeImageAttachmentFilename(filename, safeContentType)) {
    errors.push('Ime slikovne priponke ni veljavno ali se ne ujema z vrsto datoteke.');
  }
  if (
    !EMAIL_IMAGE_ATTACHMENT_EXTENSIONS[safeContentType].has(
      imageAttachmentExtension(pathname)
    ) ||
    !isTrustedImageAttachmentUrl(url, pathname)
  ) {
    errors.push(
      'Slikovna priponka mora uporabljati zaupanja vreden javni naslov Vercel Blob in pot email/shared.'
    );
  }
  if (
    typeof record.size !== 'number' ||
    !Number.isSafeInteger(record.size) ||
    record.size <= 0 ||
    record.size > ORDER_EMAIL_IMAGE_ATTACHMENT_MAX_BYTES
  ) {
    errors.push('Slikovna priponka je prazna ali večja od 5 MB.');
  }
  return errors;
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
    imageAttachment: value.imageAttachment
      ? { ...value.imageAttachment }
      : null,
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

function normalizeTemplate(
  rawTemplate: UnknownRecord,
  defaults: OrderEmailTemplate
): OrderEmailTemplate {
  const subject = sanitizeHeaderText(rawTemplate.subject, defaults.subject);
  return {
    subject,
    greeting: sanitizeHeaderText(
      rawTemplate.greeting,
      defaults.greeting ?? DEFAULT_ORDER_EMAIL_TEMPLATE_GREETING
    ),
    heading:
      rawTemplate.heading === undefined
        ? subject
        : sanitizeHeaderText(
            rawTemplate.heading,
            defaults.heading ?? subject
          ),
    body: sanitizeBodyText(rawTemplate.body, defaults.body)
  };
}

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
          customer: normalizeTemplate(rawCustomer, defaults.customer),
          admin: normalizeTemplate(rawAdmin, defaults.admin),
          ...(defaults.schoolCustomer
            ? {
                schoolCustomer: normalizeTemplate(
                  rawSchoolCustomer,
                  defaults.schoolCustomer
                )
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
    version: 5,
    enabled:
      typeof record.enabled === 'boolean'
        ? record.enabled
        : DEFAULT_ORDER_EMAIL_SETTINGS.enabled,
    confirmCustomerEmails:
      typeof record.confirmCustomerEmails === 'boolean'
        ? record.confirmCustomerEmails
        : DEFAULT_ORDER_EMAIL_SETTINGS.confirmCustomerEmails,
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
    headerText: sanitizeBodyText(
      record.headerText,
      DEFAULT_ORDER_EMAIL_SETTINGS.headerText
    ).slice(0, ORDER_EMAIL_SHARED_TEXT_MAX_LENGTH),
    footerText: sanitizeBodyText(
      record.footerText,
      DEFAULT_ORDER_EMAIL_SETTINGS.footerText
    ).slice(0, ORDER_EMAIL_SHARED_TEXT_MAX_LENGTH),
    imageAttachment: normalizeOrderEmailImageAttachment(record.imageAttachment),
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
  if (record.greeting !== undefined && typeof record.greeting !== 'string') {
    errors.push(`Pozdrav predloge za ${audienceLabel} (${eventLabel}) ni veljaven.`);
  }
  if (record.heading !== undefined && typeof record.heading !== 'string') {
    errors.push(`Naslov predloge za ${audienceLabel} (${eventLabel}) ni veljaven.`);
  }

  const subject =
    typeof record.subject === 'string' ? record.subject : fallback.subject;
  const greeting =
    typeof record.greeting === 'string'
      ? record.greeting
      : fallback.greeting ?? DEFAULT_ORDER_EMAIL_TEMPLATE_GREETING;
  const heading =
    typeof record.heading === 'string' ? record.heading : subject;
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
  if (hasHeaderControls(greeting)) {
    errors.push(
      `Pozdrav predloge za ${audienceLabel} (${eventLabel}) ne sme vsebovati kontrolnih znakov ali novih vrstic.`
    );
  }
  if (hasHeaderControls(heading)) {
    errors.push(
      `Naslov predloge za ${audienceLabel} (${eventLabel}) ne sme vsebovati kontrolnih znakov ali novih vrstic.`
    );
  }
  if (!sanitizeHeaderText(subject, '')) {
    errors.push(`Zadeva predloge za ${audienceLabel} (${eventLabel}) je obvezna.`);
  }
  if (!sanitizeBodyText(body, '')) {
    errors.push(`Besedilo predloge za ${audienceLabel} (${eventLabel}) je obvezno.`);
  }
  if (!sanitizeHeaderText(greeting, '')) {
    errors.push(`Pozdrav predloge za ${audienceLabel} (${eventLabel}) je obvezen.`);
  }
  if (!sanitizeHeaderText(heading, '')) {
    errors.push(`Naslov predloge za ${audienceLabel} (${eventLabel}) je obvezen.`);
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
  if (greeting.length > ORDER_EMAIL_TEMPLATE_GREETING_MAX_LENGTH) {
    errors.push(
      `Pozdrav predloge za ${audienceLabel} (${eventLabel}) je lahko dolg največ ${ORDER_EMAIL_TEMPLATE_GREETING_MAX_LENGTH} znakov.`
    );
  }
  if (heading.length > ORDER_EMAIL_TEMPLATE_HEADING_MAX_LENGTH) {
    errors.push(
      `Naslov predloge za ${audienceLabel} (${eventLabel}) je lahko dolg največ ${ORDER_EMAIL_TEMPLATE_HEADING_MAX_LENGTH} znakov.`
    );
  }

  const allowedVariables = new Set<string>(ORDER_EMAIL_TEMPLATE_VARIABLES[audience]);
  for (const variable of [
    ...templateVariables(subject),
    ...templateVariables(greeting),
    ...templateVariables(heading),
    ...templateVariables(body)
  ]) {
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

  const rawSharedTextFields: Array<[unknown, string]> = [
    [record.headerText, 'Besedilo glave'],
    [record.footerText, 'Besedilo noge']
  ];
  for (const [fieldValue, fieldLabel] of rawSharedTextFields) {
    if (fieldValue === undefined) continue;
    if (typeof fieldValue !== 'string') {
      errors.push(`${fieldLabel} ni veljavno.`);
      continue;
    }
    if (BODY_CONTROL_PATTERN.test(fieldValue)) {
      errors.push(`${fieldLabel} vsebuje nedovoljene kontrolne znake.`);
    }
    if (fieldValue.length > ORDER_EMAIL_SHARED_TEXT_MAX_LENGTH) {
      errors.push(
        `${fieldLabel} je lahko dolgo največ ${ORDER_EMAIL_SHARED_TEXT_MAX_LENGTH} znakov.`
      );
    }
  }
  errors.push(...validateOrderEmailImageAttachment(record.imageAttachment));

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
