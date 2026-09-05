import {
  emailTemplateRichTextToPlainText,
  emailTemplateVariables,
  createEmailTemplateContentHtml,
  sanitizeEmailTemplateRichText
} from '../emailTemplateRichText';
import {
  normalizeEmailTemplatePresentation,
  validateEmailTemplatePresentation,
  type EmailTemplatePresentation
} from '../emailTemplateLayout';

export const QUOTE_EMAIL_EVENT_TYPES = [
  'quote_request_submitted',
  'quote_clarification_requested',
  'quote_issued',
  'quote_access_otp',
  'quote_accepted',
  'quote_declined',
  'quote_withdrawn',
  'quote_expired',
  'quote_request_closed',
  'quote_acceptance_blocked_stock',
  'quote_delivery_failed'
] as const;

export type QuoteEmailEventType = (typeof QUOTE_EMAIL_EVENT_TYPES)[number];
export type QuoteEmailAudienceSettings = { customer: boolean; admins: boolean };
export type QuoteEmailTemplate = {
  subject: string;
  contentHtml: string;
  presentation?: EmailTemplatePresentation;
};
export type QuoteEmailTemplateAudience =
  | 'customer'
  | 'companyCustomer'
  | 'schoolCustomer'
  | 'admin';
export type QuoteEmailEventTemplates = {
  customer: QuoteEmailTemplate;
  companyCustomer: QuoteEmailTemplate;
  schoolCustomer: QuoteEmailTemplate;
  admin: QuoteEmailTemplate;
};

export const QUOTE_STOCK_ACCEPTANCE_MODES = ['manual', 'automatic'] as const;
export type QuoteStockAcceptanceMode =
  (typeof QUOTE_STOCK_ACCEPTANCE_MODES)[number];

export type QuoteEmailSettings = {
  version: 2;
  enabled: boolean;
  stockAcceptanceMode: QuoteStockAcceptanceMode;
  events: Record<QuoteEmailEventType, QuoteEmailAudienceSettings>;
  templates: Record<QuoteEmailEventType, QuoteEmailEventTemplates>;
  updatedAt: string;
};

export const QUOTE_EMAIL_TEMPLATE_SUBJECT_MAX_LENGTH = 240;
export const QUOTE_EMAIL_TEMPLATE_CONTENT_HTML_MAX_LENGTH = 24_000;
export const QUOTE_EMAIL_DEFAULT_GREETING =
  'Pozdravljeni, {{recipient_name}},';
export const QUOTE_EMAIL_DEFAULT_ADMIN_GREETING = 'Pozdravljeni,';
export const QUOTE_EMAIL_SETTINGS_VERSION = 2 as const;

export function quoteEmailEventSupportsAdminAudience(
  eventType: QuoteEmailEventType
): boolean {
  return eventType !== 'quote_access_otp';
}

const QUOTE_EMAIL_PUBLIC_VARIABLES_BY_EVENT: Readonly<
  Record<QuoteEmailEventType, readonly string[]>
> = {
  quote_request_submitted: ['quote_code'],
  quote_clarification_requested: ['quote_code'],
  quote_issued: ['offer_code'],
  quote_access_otp: ['offer_code', 'otp_code'],
  quote_accepted: ['offer_code', 'order_code'],
  quote_declined: ['offer_code'],
  quote_withdrawn: ['offer_code'],
  quote_expired: ['offer_code'],
  quote_request_closed: ['quote_code'],
  quote_acceptance_blocked_stock: ['offer_code'],
  quote_delivery_failed: ['quote_code', 'offer_code']
};

const QUOTE_EMAIL_INTERNAL_VARIABLES_BY_EVENT: Readonly<
  Record<QuoteEmailEventType, readonly string[]>
> = {
  quote_request_submitted: ['request_number'],
  quote_clarification_requested: ['request_number'],
  quote_issued: ['request_number', 'offer_number'],
  quote_access_otp: [],
  quote_accepted: ['request_number', 'offer_number', 'order_number'],
  quote_declined: ['request_number', 'offer_number'],
  quote_withdrawn: ['request_number', 'offer_number'],
  quote_expired: ['request_number', 'offer_number'],
  quote_request_closed: ['request_number'],
  quote_acceptance_blocked_stock: ['request_number', 'offer_number'],
  quote_delivery_failed: ['request_number', 'offer_number']
};

export function quoteEmailTemplateInternalVariables(
  eventType: QuoteEmailEventType,
  audience: QuoteEmailTemplateAudience
): readonly string[] {
  return audience === 'admin'
    ? QUOTE_EMAIL_INTERNAL_VARIABLES_BY_EVENT[eventType]
    : [];
}

export function quoteEmailTemplateVariables(
  eventType: QuoteEmailEventType,
  audience: QuoteEmailTemplateAudience
): readonly string[] {
  const recipientVariables = audience === 'admin' ? [] : ['recipient_name'];
  return [
    ...recipientVariables,
    ...QUOTE_EMAIL_PUBLIC_VARIABLES_BY_EVENT[eventType],
    ...quoteEmailTemplateInternalVariables(eventType, audience)
  ];
}

export const QUOTE_EMAIL_EVENT_DEFAULTS: Record<
  QuoteEmailEventType,
  {
    customer: boolean;
    admin: boolean;
    subject: string;
    body: string;
    adminSubject?: string;
    adminBody?: string;
  }
> = {
  quote_request_submitted: {
    customer: true,
    admin: true,
    subject: 'Prejeli smo vaše povpraševanje {{quote_code}}',
    adminSubject: 'Novo povpraševanje {{request_number}}',
    body:
      'Povpraševanje ni naročilo in ne povzroči obveznosti plačila. Obvestili vas bomo, ko bo ponudba pripravljena.'
  },
  quote_clarification_requested: {
    customer: true,
    admin: false,
    subject: 'Potrebujemo pojasnilo za {{quote_code}}',
    adminSubject: 'Potrebujemo pojasnilo za {{request_number}}',
    body:
      'Za nadaljevanje obravnave vašega povpraševanja potrebujemo naslednje pojasnilo:'
  },
  quote_issued: {
    customer: true,
    admin: false,
    subject: 'Ponudba {{offer_code}} je pripravljena',
    adminSubject: 'Ponudba {{offer_number}} je pripravljena',
    body: 'Ponudbo odprite prek varne povezave. Sam klik ponudbe ne sprejme.'
  },
  quote_access_otp: {
    customer: true,
    admin: false,
    subject: 'Varnostna koda za ponudbo {{offer_code}}',
    body: 'Vaša enkratna varnostna koda je {{otp_code}}.'
  },
  quote_accepted: {
    customer: true,
    admin: true,
    subject: 'Ponudba {{offer_code}} je sprejeta',
    adminSubject: 'Ponudba {{offer_number}} je sprejeta',
    body:
      'Sprejem ponudbe smo zabeležili in ustvarili povezano naročilo {{order_code}}.',
    adminBody:
      'Sprejem ponudbe smo zabeležili in ustvarili povezano naročilo {{order_number}}.'
  },
  quote_declined: {
    customer: true,
    admin: true,
    subject: 'Ponudba {{offer_code}} je zavrnjena',
    adminSubject: 'Ponudba {{offer_number}} je zavrnjena',
    body: 'Vašo odločitev smo zabeležili.'
  },
  quote_withdrawn: {
    customer: true,
    admin: false,
    subject: 'Ponudba {{offer_code}} je umaknjena',
    adminSubject: 'Ponudba {{offer_number}} je umaknjena',
    body: 'Ponudba ni več veljavna. Za pomoč nam odgovorite na to sporočilo.'
  },
  quote_expired: {
    customer: true,
    admin: false,
    subject: 'Ponudba {{offer_code}} je potekla',
    adminSubject: 'Ponudba {{offer_number}} je potekla',
    body: 'Rok veljavnosti ponudbe je potekel.'
  },
  quote_request_closed: {
    customer: true,
    admin: false,
    subject: 'Povpraševanje {{quote_code}} je zaključeno',
    adminSubject: 'Povpraševanje {{request_number}} je zaključeno',
    body: 'Povpraševanje smo zaključili brez izdaje ponudbe.'
  },
  quote_acceptance_blocked_stock: {
    customer: true,
    admin: true,
    subject: 'Ponudbe {{offer_code}} trenutno ni mogoče sprejeti',
    adminSubject: 'Ponudbe {{offer_number}} trenutno ni mogoče sprejeti',
    body:
      'Razpoložljiva zaloga se je spremenila. Povpraševanje ostaja odprto, da lahko pripravimo novo različico ponudbe.'
  },
  quote_delivery_failed: {
    customer: false,
    admin: true,
    subject: 'Dostava e-pošte za {{offer_code}} ni uspela',
    adminSubject: 'Dostava e-pošte za {{offer_number}} ni uspela',
    body:
      'Dostava sporočila o ponudbi ni uspela po vseh samodejnih poskusih. Preverite stanje v administraciji in opravilo po potrebi ponovite.'
  }
};

export const QUOTE_EMAIL_EDITABLE_EVENT_DEFINITIONS = [
  {
    value: 'quote_request_submitted',
    label: 'Povpraševanje prejeto',
    description: 'Ko stranka uspešno odda novo povpraševanje.'
  },
  {
    value: 'quote_clarification_requested',
    label: 'Zahteva za pojasnilo',
    description:
      'Ko administrator od stranke zahteva dodatne podatke ali pojasnilo.'
  },
  {
    value: 'quote_issued',
    label: 'Ponudba izdana',
    description: 'Ko administrator izda ponudbo in jo pošlje stranki.'
  },
  {
    value: 'quote_accepted',
    label: 'Ponudba sprejeta',
    description:
      'Ko stranka sprejme ponudbo in se ustvari povezano naročilo.'
  },
  {
    value: 'quote_declined',
    label: 'Ponudba zavrnjena',
    description: 'Ko stranka zavrne izdano ponudbo.'
  },
  {
    value: 'quote_withdrawn',
    label: 'Ponudba umaknjena',
    description: 'Ko administrator umakne izdano ponudbo.'
  },
  {
    value: 'quote_expired',
    label: 'Ponudba potekla',
    description: 'Ko izdani ponudbi poteče rok veljavnosti.'
  },
  {
    value: 'quote_request_closed',
    label: 'Povpraševanje zaključeno',
    description:
      'Ko administrator zaključi povpraševanje brez izdaje ponudbe.'
  },
  {
    value: 'quote_acceptance_blocked_stock',
    label: 'Sprejem blokiran zaradi zaloge',
    description:
      'Samodejni dogodek v samodejnem načinu, ko sprejema ponudbe ni mogoče dokončati zaradi spremenjene zaloge.'
  },
  {
    value: 'quote_delivery_failed',
    label: 'Dostava e-pošte ni uspela',
    description:
      'Ko dostava poslovne e-pošte po vseh poskusih ni uspela.'
  }
] as const satisfies ReadonlyArray<{
  value: Exclude<QuoteEmailEventType, 'quote_access_otp'>;
  label: string;
  description: string;
}>;

export function cloneDefaultQuoteEmailSettings(): QuoteEmailSettings {
  return {
    version: QUOTE_EMAIL_SETTINGS_VERSION,
    enabled: false,
    stockAcceptanceMode: 'manual',
    events: Object.fromEntries(
      QUOTE_EMAIL_EVENT_TYPES.map((eventType) => [
        eventType,
        {
          customer: QUOTE_EMAIL_EVENT_DEFAULTS[eventType].customer,
          admins: QUOTE_EMAIL_EVENT_DEFAULTS[eventType].admin
        }
      ])
    ) as QuoteEmailSettings['events'],
    templates: Object.fromEntries(
      QUOTE_EMAIL_EVENT_TYPES.map((eventType) => {
        const defaults = QUOTE_EMAIL_EVENT_DEFAULTS[eventType];
        const adminSubject = defaults.adminSubject ?? defaults.subject;
        const adminBody = defaults.adminBody ?? defaults.body;
        const customerTemplate: QuoteEmailTemplate = {
          subject: defaults.subject,
          contentHtml: createEmailTemplateContentHtml({
            greeting: QUOTE_EMAIL_DEFAULT_GREETING,
            heading: defaults.subject,
            body: defaults.body
          })
        };
        return [
          eventType,
          {
            customer: { ...customerTemplate },
            companyCustomer: { ...customerTemplate },
            schoolCustomer: { ...customerTemplate },
            admin: {
              subject: adminSubject,
              contentHtml: createEmailTemplateContentHtml({
                greeting: QUOTE_EMAIL_DEFAULT_ADMIN_GREETING,
                heading: adminSubject,
                body: adminBody
              })
            }
          }
        ];
      })
    ) as QuoteEmailSettings['templates'],
    updatedAt: ''
  };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function templateText(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

const HEADER_CONTROL_PATTERN = /[\u0000-\u001f\u007f]/u;
const HEADER_CONTROLS_GLOBAL_PATTERN = /[\u0000-\u001f\u007f]+/gu;

function headerTemplateText(value: unknown, fallback: string): string {
  return templateText(value, fallback)
    .replace(HEADER_CONTROLS_GLOBAL_PATTERN, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function normalizeQuoteTemplate(
  source: Record<string, unknown>,
  defaults: QuoteEmailTemplate
): QuoteEmailTemplate {
  const subject = headerTemplateText(source.subject, defaults.subject);
  const contentHtml =
    typeof source.contentHtml === 'string'
      ? sanitizeEmailTemplateRichText(source.contentHtml)
      : defaults.contentHtml;
  const presentation = normalizeEmailTemplatePresentation(
    source.presentation
  );
  return {
    subject,
    contentHtml: contentHtml || defaults.contentHtml || '',
    ...(presentation ? { presentation } : {})
  };
}

export function normalizeQuoteEmailSettings(value: unknown): QuoteEmailSettings {
  const defaults = cloneDefaultQuoteEmailSettings();
  const source = record(value);
  const sourceEvents = record(source.events);
  const sourceTemplates = record(source.templates);
  for (const eventType of QUOTE_EMAIL_EVENT_TYPES) {
    const event = record(sourceEvents[eventType]);
    const templates = record(sourceTemplates[eventType]);
    const customerTemplate = record(templates.customer);
    const companyCustomerTemplate = Object.prototype.hasOwnProperty.call(
      templates,
      'companyCustomer'
    )
      ? record(templates.companyCustomer)
      : customerTemplate;
    const schoolCustomerTemplate = Object.prototype.hasOwnProperty.call(
      templates,
      'schoolCustomer'
    )
      ? record(templates.schoolCustomer)
      : customerTemplate;
    const adminTemplate = record(templates.admin);
    defaults.events[eventType] = {
      customer:
        eventType === 'quote_access_otp'
          ? true
          : typeof event.customer === 'boolean'
            ? event.customer
            : defaults.events[eventType].customer,
      admins:
        eventType !== 'quote_access_otp' && typeof event.admins === 'boolean'
          ? event.admins
          : eventType !== 'quote_access_otp'
            ? defaults.events[eventType].admins
            : false
    };
    defaults.templates[eventType] = {
      customer: normalizeQuoteTemplate(
        customerTemplate,
        defaults.templates[eventType].customer
      ),
      companyCustomer: normalizeQuoteTemplate(
        companyCustomerTemplate,
        defaults.templates[eventType].companyCustomer
      ),
      schoolCustomer: normalizeQuoteTemplate(
        schoolCustomerTemplate,
        defaults.templates[eventType].schoolCustomer
      ),
      admin: normalizeQuoteTemplate(
        adminTemplate,
        defaults.templates[eventType].admin
      )
    };
  }
  defaults.enabled =
    typeof source.enabled === 'boolean' ? source.enabled : defaults.enabled;
  defaults.stockAcceptanceMode =
    source.stockAcceptanceMode === 'automatic' ? 'automatic' : 'manual';
  defaults.updatedAt =
    typeof source.updatedAt === 'string' ? source.updatedAt : '';
  return defaults;
}

export function validateQuoteEmailSettings(value: unknown): string[] {
  const source = record(value);
  const sourceTemplates = record(source.templates);
  const normalized = normalizeQuoteEmailSettings(value);
  const errors: string[] = [];
  for (const eventType of QUOTE_EMAIL_EVENT_TYPES) {
    for (const audience of [
      'customer',
      'companyCustomer',
      'schoolCustomer',
      'admin'
    ] as const satisfies ReadonlyArray<QuoteEmailTemplateAudience>) {
      if (
        audience === 'admin' &&
        !quoteEmailEventSupportsAdminAudience(eventType)
      ) {
        continue;
      }
      const rawTemplate = record(record(sourceTemplates[eventType])[audience]);
      if (Object.keys(rawTemplate).some((key) => !['subject', 'contentHtml', 'presentation'].includes(key))) {
        errors.push(`${eventType}/${audience}: predloga vsebuje nepodprta polja.`);
      }
      for (const [field, label] of [['subject', 'zadeva']] as const) {
        const rawValue = rawTemplate[field];
        if (rawValue === undefined) continue;
        if (typeof rawValue !== 'string') {
          errors.push(`${eventType}/${audience}: ${label} ni veljaven.`);
        } else if (HEADER_CONTROL_PATTERN.test(rawValue)) {
          errors.push(
            `${eventType}/${audience}: ${label} ne sme vsebovati kontrolnih znakov ali novih vrstic.`
          );
        }
      }
      if (
        rawTemplate.contentHtml !== undefined &&
        typeof rawTemplate.contentHtml !== 'string'
      ) {
        errors.push(`${eventType}/${audience}: vsebina ni veljavna.`);
      }
      if (
        validateEmailTemplatePresentation(rawTemplate.presentation).length > 0
      ) {
        errors.push(`${eventType}/${audience}: postavitev ni veljavna.`);
      }
      const template = normalized.templates[eventType][audience];
      if (!template.subject.trim()) {
        errors.push(`${eventType}/${audience}: zadeva ne sme biti prazna.`);
      } else if (template.subject.length > QUOTE_EMAIL_TEMPLATE_SUBJECT_MAX_LENGTH) {
        errors.push(`${eventType}/${audience}: zadeva je predolga.`);
      }
      if (!emailTemplateRichTextToPlainText(template.contentHtml)) {
        errors.push(`${eventType}/${audience}: vsebina ne sme biti prazna.`);
      } else if (
        (template.contentHtml?.length ?? 0) >
        QUOTE_EMAIL_TEMPLATE_CONTENT_HTML_MAX_LENGTH
      ) {
        errors.push(`${eventType}/${audience}: vsebina je predolga.`);
      }
      const allowedVariables = new Set(
        quoteEmailTemplateVariables(eventType, audience)
      );
      for (const variable of [
        ...emailTemplateVariables(template.subject),
        ...emailTemplateVariables(template.contentHtml)
      ]) {
        if (!allowedVariables.has(variable)) {
          errors.push(
            eventType +
              '/' +
              audience +
              ': spremenljivka {{' +
              variable +
              '}} ni dovoljena.'
          );
        }
      }
    }
  }
  return errors;
}
