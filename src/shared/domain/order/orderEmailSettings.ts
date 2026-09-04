import {
  emailTemplateRichTextToPlainText,
  emailTemplateVariables,
  legacyEmailTemplateContentHtml,
  sanitizeEmailTemplateRichText
} from '../emailTemplateRichText';
import {
  EMAIL_TEMPLATE_SPACING_MAX_PX,
  EMAIL_TEMPLATE_SPACING_MIN_PX,
  cloneEmailTemplatePresentation,
  normalizeEmailTemplatePresentation,
  validateEmailTemplatePresentation,
  type EmailTemplatePresentation
} from '../emailTemplateLayout';
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

export const ORDER_EMAIL_SYSTEM_FIELD_IDS = [
  'orderCreatedAt',
  'eventStatus',
  'customerName',
  'customerContact',
  'customerAddress',
  'customerEmail',
  'customerReference',
  'orderNumber'
] as const;

export type OrderEmailSystemFieldId =
  (typeof ORDER_EMAIL_SYSTEM_FIELD_IDS)[number];

export type OrderEmailSystemLine = {
  field: OrderEmailSystemFieldId;
  label: string;
  /** Optional vertical gap immediately before this individual line. */
  spacingBeforePx?: number;
};

export type OrderEmailTemplatePresentation = EmailTemplatePresentation & {
  /**
   * Ordered renderer-owned values. Missing keeps the legacy audience defaults;
   * an explicit empty array intentionally hides every system line.
   */
  systemLines?: OrderEmailSystemLine[];
};

export type OrderEmailTemplate = {
  subject: string;
  contentHtml?: string;
  presentation?: OrderEmailTemplatePresentation;
  /** Legacy read compatibility for stored v5 settings and queued snapshots. */
  greeting?: string;
  /** Legacy read compatibility for stored v5 settings and queued snapshots. */
  heading?: string;
  /** Legacy read compatibility for stored v5 settings and queued snapshots. */
  body?: string;
};

export type OrderEmailEventTemplates = {
  customer: OrderEmailTemplate;
  companyCustomer: OrderEmailTemplate;
  schoolCustomer: OrderEmailTemplate;
  admin: OrderEmailTemplate;
};

export type OrderEmailTemplates = Record<
  OrderEmailEventType,
  OrderEmailEventTemplates
>;

const ORDER_EMAIL_CUSTOMER_TEMPLATE_VARIABLES = [
  'recipient_name',
  'customer_name',
  'organization_name',
  'contact_name',
  'reference',
  'status',
  'previous_status'
] as const;

export const ORDER_EMAIL_TEMPLATE_VARIABLES = {
  customer: ORDER_EMAIL_CUSTOMER_TEMPLATE_VARIABLES,
  companyCustomer: ORDER_EMAIL_CUSTOMER_TEMPLATE_VARIABLES,
  schoolCustomer: ORDER_EMAIL_CUSTOMER_TEMPLATE_VARIABLES,
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
export const ORDER_EMAIL_TEMPLATE_CONTENT_HTML_MAX_LENGTH = 20_000;
export const ORDER_EMAIL_SHARED_TEXT_MAX_LENGTH = 1_000;
export const ORDER_EMAIL_SYSTEM_LINE_LABEL_MAX_LENGTH = 80;
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
  version: 7;
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

type LegacyOrderEmailTemplate = {
  subject: string;
  greeting?: string;
  heading?: string;
  body: string;
};

type LegacyOrderEmailEventTemplates = {
  customer: LegacyOrderEmailTemplate;
  admin: LegacyOrderEmailTemplate;
  schoolCustomer?: LegacyOrderEmailTemplate;
};

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
) as Record<OrderEmailEventType, LegacyOrderEmailEventTemplates>;

const defaultTemplates = Object.fromEntries(
  ORDER_EMAIL_EVENT_DEFINITIONS.map(({ value: eventType }) => {
    const eventTemplates = legacyDefaultTemplates[eventType];
    const completeTemplate = (
      template: LegacyOrderEmailTemplate
    ): OrderEmailTemplate => ({
      subject: template.subject,
      contentHtml: legacyEmailTemplateContentHtml({
        greeting: template.greeting ?? DEFAULT_ORDER_EMAIL_TEMPLATE_GREETING,
        heading: template.heading ?? template.subject,
        body: template.body
      })
    });
    return [
      eventType,
      {
        customer: completeTemplate(eventTemplates.customer),
        companyCustomer: completeTemplate(eventTemplates.customer),
        schoolCustomer: completeTemplate(
          eventTemplates.schoolCustomer ?? eventTemplates.customer
        ),
        admin: completeTemplate(eventTemplates.admin),
      }
    ];
  })
) as OrderEmailTemplates;

export const DEFAULT_ORDER_EMAIL_SETTINGS: OrderEmailSettings = {
  version: 7,
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

export type OrderEmailSystemLineAudience = 'customer' | 'admin';

export const DEFAULT_ORDER_EMAIL_SYSTEM_LINES: Readonly<
  Record<OrderEmailSystemLineAudience, readonly OrderEmailSystemLine[]>
> = {
  customer: [
    { field: 'orderCreatedAt', label: 'Datum' },
    { field: 'eventStatus', label: 'Status' }
  ],
  admin: [
    { field: 'customerName', label: 'Naročnik' },
    { field: 'customerAddress', label: 'Naslov' },
    { field: 'customerEmail', label: 'E-pošta' },
    { field: 'customerReference', label: 'Referenca' },
    { field: 'orderNumber', label: 'Naročilo' },
    { field: 'orderCreatedAt', label: 'Datum' },
    { field: 'eventStatus', label: 'Status' }
  ]
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

const orderEmailSystemFieldIds = new Set<string>(
  ORDER_EMAIL_SYSTEM_FIELD_IDS
);
const customerOrderEmailSystemFieldIds =
  new Set<OrderEmailSystemFieldId>(
    ORDER_EMAIL_SYSTEM_FIELD_IDS.filter((field) => field !== 'orderNumber')
  );
const defaultOrderEmailSystemLineLabels: Record<
  OrderEmailSystemFieldId,
  string
> = {
  orderCreatedAt: 'Datum',
  eventStatus: 'Status',
  customerName: 'Naročnik',
  customerContact: 'Kontakt',
  customerAddress: 'Naslov',
  customerEmail: 'E-pošta',
  customerReference: 'Referenca',
  orderNumber: 'Naročilo'
};

export function isOrderEmailSystemFieldId(
  value: unknown
): value is OrderEmailSystemFieldId {
  return typeof value === 'string' && orderEmailSystemFieldIds.has(value);
}

function normalizeOrderEmailSystemLineSpacingBeforePx(
  value: unknown
): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.min(
    EMAIL_TEMPLATE_SPACING_MAX_PX,
    Math.max(EMAIL_TEMPLATE_SPACING_MIN_PX, Math.round(value))
  );
}

function normalizeOrderEmailSystemLines(
  value: unknown,
  audience: OrderEmailSystemLineAudience
): OrderEmailSystemLine[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return undefined;
  const lines: OrderEmailSystemLine[] = [];
  const seen = new Set<OrderEmailSystemFieldId>();
  for (const rawLine of value) {
    const line = asRecord(rawLine);
    if (
      !isOrderEmailSystemFieldId(line.field) ||
      seen.has(line.field) ||
      (audience === 'customer' &&
        !customerOrderEmailSystemFieldIds.has(line.field))
    ) {
      continue;
    }
    const sanitizedLabel = sanitizeHeaderText(
      line.label,
      defaultOrderEmailSystemLineLabels[line.field]
    ).slice(0, ORDER_EMAIL_SYSTEM_LINE_LABEL_MAX_LENGTH);
    const label = sanitizedLabel || defaultOrderEmailSystemLineLabels[line.field];
    const spacingBeforePx = normalizeOrderEmailSystemLineSpacingBeforePx(
      line.spacingBeforePx
    );
    lines.push({
      field: line.field,
      label,
      ...(spacingBeforePx === undefined ? {} : { spacingBeforePx })
    });
    seen.add(line.field);
  }
  return lines;
}

export function resolveOrderEmailSystemLines(
  template: Pick<OrderEmailTemplate, 'presentation'> | undefined,
  audience: OrderEmailSystemLineAudience
): OrderEmailSystemLine[] {
  const configured = normalizeOrderEmailSystemLines(
    template?.presentation?.systemLines,
    audience
  );
  return (configured ?? DEFAULT_ORDER_EMAIL_SYSTEM_LINES[audience]).map(
    (line) => ({ ...line })
  );
}

function cloneOrderEmailTemplate(
  value: OrderEmailTemplate
): OrderEmailTemplate {
  const basePresentation = cloneEmailTemplatePresentation(value.presentation);
  const systemLines = value.presentation?.systemLines?.map((line) => ({
    ...line
  }));
  const presentation =
    basePresentation || systemLines !== undefined
      ? {
          ...basePresentation,
          ...(systemLines === undefined ? {} : { systemLines })
        }
      : undefined;
  return {
    ...value,
    ...(presentation ? { presentation } : {})
  };
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
          customer: cloneOrderEmailTemplate(
            value.templates[eventType].customer
          ),
          companyCustomer: cloneOrderEmailTemplate(
            value.templates[eventType].companyCustomer
          ),
          schoolCustomer: cloneOrderEmailTemplate(
            value.templates[eventType].schoolCustomer
          ),
          admin: cloneOrderEmailTemplate(value.templates[eventType].admin),
        }
      ])
    ) as OrderEmailTemplates
  };
}

export const cloneDefaultOrderEmailSettings = cloneOrderEmailSettings;

function normalizeTemplate(
  rawTemplate: UnknownRecord,
  defaults: OrderEmailTemplate,
  audience: OrderEmailSystemLineAudience
): OrderEmailTemplate {
  const subject = sanitizeHeaderText(rawTemplate.subject, defaults.subject);
  const hasLegacyContent = ['greeting', 'heading', 'body'].some((field) =>
    Object.prototype.hasOwnProperty.call(rawTemplate, field)
  );
  const legacyContent = hasLegacyContent
    ? legacyEmailTemplateContentHtml({
        greeting: sanitizeHeaderText(
          rawTemplate.greeting,
          DEFAULT_ORDER_EMAIL_TEMPLATE_GREETING
        ),
        heading: sanitizeHeaderText(rawTemplate.heading, subject),
        body: sanitizeBodyText(rawTemplate.body, '')
      })
    : '';
  const contentHtml =
    typeof rawTemplate.contentHtml === 'string'
      ? sanitizeEmailTemplateRichText(rawTemplate.contentHtml)
      : legacyContent;
  const rawPresentation = asRecord(rawTemplate.presentation);
  const basePresentation = normalizeEmailTemplatePresentation(
    rawTemplate.presentation
  );
  const systemLines = normalizeOrderEmailSystemLines(
    rawPresentation.systemLines,
    audience
  );
  const presentation =
    basePresentation || systemLines !== undefined
      ? {
          ...basePresentation,
          ...(systemLines === undefined ? {} : { systemLines })
        }
      : undefined;
  return {
    subject,
    contentHtml: contentHtml || defaults.contentHtml,
    ...(presentation ? { presentation } : {})
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
      const rawCompanyCustomer = asRecord(rawEventTemplates.companyCustomer);
      const rawAdmin = asRecord(rawEventTemplates.admin);
      const rawSchoolCustomer = asRecord(rawEventTemplates.schoolCustomer);
      const companyCustomerSource = Object.prototype.hasOwnProperty.call(
        rawEventTemplates,
        'companyCustomer'
      )
        ? rawCompanyCustomer
        : rawCustomer;
      const schoolCustomerSource = Object.prototype.hasOwnProperty.call(
        rawEventTemplates,
        'schoolCustomer'
      )
        ? rawSchoolCustomer
        : eventType === 'order_submitted'
          ? {}
          : rawCustomer;
      return [
        eventType,
        {
          customer: normalizeTemplate(
            rawCustomer,
            defaults.customer,
            'customer'
          ),
          companyCustomer: normalizeTemplate(
            companyCustomerSource,
            defaults.companyCustomer,
            'customer'
          ),
          schoolCustomer: normalizeTemplate(
            schoolCustomerSource,
            defaults.schoolCustomer,
            'customer'
          ),
          admin: normalizeTemplate(rawAdmin, defaults.admin, 'admin'),
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
    version: 7,
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

function validateOrderEmailTemplatePresentation(
  value: unknown,
  audience: OrderEmailSystemLineAudience,
  templateLabel: string
): string[] {
  const errors = validateEmailTemplatePresentation(value).map(
    (error) => `Postavitev predloge za ${templateLabel} ni veljavna: ${error}.`
  );
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return errors;
  }
  const presentation = value as UnknownRecord;
  if (presentation.systemLines === undefined) return errors;
  if (!Array.isArray(presentation.systemLines)) {
    errors.push(
      `Sistemske vrstice predloge za ${templateLabel} niso veljavne.`
    );
    return errors;
  }
  if (presentation.systemLines.length > ORDER_EMAIL_SYSTEM_FIELD_IDS.length) {
    errors.push(
      `Predloga za ${templateLabel} ima preveč sistemskih vrstic.`
    );
  }
  const seen = new Set<OrderEmailSystemFieldId>();
  presentation.systemLines.forEach((rawLine, index) => {
    if (!rawLine || typeof rawLine !== 'object' || Array.isArray(rawLine)) {
      errors.push(
        `Sistemska vrstica ${index + 1} predloge za ${templateLabel} ni veljavna.`
      );
      return;
    }
    const line = rawLine as UnknownRecord;
    if (!isOrderEmailSystemFieldId(line.field)) {
      errors.push(
        `Sistemska vrstica ${index + 1} predloge za ${templateLabel} nima veljavnega polja.`
      );
      return;
    }
    if (
      audience === 'customer' &&
      !customerOrderEmailSystemFieldIds.has(line.field)
    ) {
      errors.push(
        `Polje »${line.field}« ni dovoljeno v predlogi za ${templateLabel}.`
      );
    }
    if (seen.has(line.field)) {
      errors.push(
        `Polje »${line.field}« je v predlogi za ${templateLabel} podvojeno.`
      );
    }
    seen.add(line.field);
    if (
      typeof line.label !== 'string' ||
      !line.label.trim() ||
      HEADER_CONTROL_PATTERN.test(line.label) ||
      line.label.length > ORDER_EMAIL_SYSTEM_LINE_LABEL_MAX_LENGTH
    ) {
      errors.push(
        `Oznaka sistemske vrstice ${index + 1} predloge za ${templateLabel} ni veljavna.`
      );
    }
    if (line.spacingBeforePx !== undefined) {
      const spacing = line.spacingBeforePx;
      if (
        typeof spacing !== 'number' ||
        !Number.isSafeInteger(spacing) ||
        spacing < EMAIL_TEMPLATE_SPACING_MIN_PX ||
        spacing > EMAIL_TEMPLATE_SPACING_MAX_PX
      ) {
        errors.push(
          `Razmik pred sistemsko vrstico ${index + 1} predloge za ${templateLabel} mora biti celo število od ${EMAIL_TEMPLATE_SPACING_MIN_PX} do ${EMAIL_TEMPLATE_SPACING_MAX_PX}.`
        );
      }
    }
  });
  return errors;
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
      : audience === 'companyCustomer'
        ? 'podjetje'
      : audience === 'schoolCustomer'
        ? '\u0161olo ali javni zavod'
        : 'fizi\u010dno osebo';
  const errors: string[] = [];
  if (
    value !== undefined &&
    (!value || typeof value !== 'object' || Array.isArray(value))
  ) {
    errors.push(`Predloga za ${audienceLabel} (${eventLabel}) ni veljavna.`);
    return errors;
  }
  errors.push(
    ...validateOrderEmailTemplatePresentation(
      record.presentation,
      audience === 'admin' ? 'admin' : 'customer',
      `${audienceLabel} (${eventLabel})`
    )
  );
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
  if (
    record.contentHtml !== undefined &&
    typeof record.contentHtml !== 'string'
  ) {
    errors.push(
      `Vsebina predloge za ${audienceLabel} (${eventLabel}) ni veljavna.`
    );
  }

  const subject =
    typeof record.subject === 'string' ? record.subject : fallback.subject;
  const greeting =
    typeof record.greeting === 'string'
      ? record.greeting
      : fallback.greeting ?? DEFAULT_ORDER_EMAIL_TEMPLATE_GREETING;
  const heading =
    typeof record.heading === 'string' ? record.heading : subject;
  const body = typeof record.body === 'string' ? record.body : '';
  const hasLegacyContent = ['greeting', 'heading', 'body'].some((field) =>
    Object.prototype.hasOwnProperty.call(record, field)
  );
  const contentHtml =
    typeof record.contentHtml === 'string'
      ? record.contentHtml
      : hasLegacyContent
        ? legacyEmailTemplateContentHtml({ greeting, heading, body })
        : fallback.contentHtml ?? '';
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
  if (BODY_CONTROL_PATTERN.test(contentHtml)) {
    errors.push(
      `Vsebina predloge za ${audienceLabel} (${eventLabel}) vsebuje nedovoljene kontrolne znake.`
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
  if (!emailTemplateRichTextToPlainText(contentHtml)) {
    errors.push(`Vsebina predloge za ${audienceLabel} (${eventLabel}) je obvezna.`);
  }
  if (subject.length > ORDER_EMAIL_TEMPLATE_SUBJECT_MAX_LENGTH) {
    errors.push(
      `Zadeva predloge za ${audienceLabel} (${eventLabel}) je lahko dolga najve\u010d ${ORDER_EMAIL_TEMPLATE_SUBJECT_MAX_LENGTH} znakov.`
    );
  }
  if (contentHtml.length > ORDER_EMAIL_TEMPLATE_CONTENT_HTML_MAX_LENGTH) {
    errors.push(
      `Vsebina predloge za ${audienceLabel} (${eventLabel}) je lahko dolga največ ${ORDER_EMAIL_TEMPLATE_CONTENT_HTML_MAX_LENGTH} znakov.`
    );
  }

  const allowedVariables = new Set<string>(ORDER_EMAIL_TEMPLATE_VARIABLES[audience]);
  for (const variable of [
    ...emailTemplateVariables(subject),
    ...emailTemplateVariables(contentHtml)
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
      ...validateTemplate(
        rawEvent.companyCustomer,
        event.label,
        'companyCustomer',
        defaults.companyCustomer
      ),
      ...validateTemplate(
        rawEvent.schoolCustomer,
        event.label,
        'schoolCustomer',
        defaults.schoolCustomer
      ),
      ...validateTemplate(rawEvent.admin, event.label, 'admin', defaults.admin),
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
