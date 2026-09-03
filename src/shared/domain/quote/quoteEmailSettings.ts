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
  greeting?: string;
  heading?: string;
  body: string;
};
export type QuoteEmailEventTemplates = {
  customer: QuoteEmailTemplate;
  admin: QuoteEmailTemplate;
};

export const QUOTE_STOCK_ACCEPTANCE_MODES = ['manual', 'automatic'] as const;
export type QuoteStockAcceptanceMode =
  (typeof QUOTE_STOCK_ACCEPTANCE_MODES)[number];

export type QuoteEmailSettings = {
  enabled: boolean;
  stockAcceptanceMode: QuoteStockAcceptanceMode;
  events: Record<QuoteEmailEventType, QuoteEmailAudienceSettings>;
  templates: Record<QuoteEmailEventType, QuoteEmailEventTemplates>;
  updatedAt: string;
};

export const QUOTE_EMAIL_TEMPLATE_SUBJECT_MAX_LENGTH = 240;
export const QUOTE_EMAIL_TEMPLATE_GREETING_MAX_LENGTH = 300;
export const QUOTE_EMAIL_TEMPLATE_HEADING_MAX_LENGTH = 300;
export const QUOTE_EMAIL_TEMPLATE_BODY_MAX_LENGTH = 12_000;
export const QUOTE_EMAIL_DEFAULT_GREETING =
  'Pozdravljeni, {{recipient_name}},';
export const QUOTE_EMAIL_DEFAULT_ADMIN_GREETING = 'Pozdravljeni,';

export function quoteEmailEventSupportsAdminAudience(
  eventType: QuoteEmailEventType
): boolean {
  return eventType !== 'quote_access_otp';
}

export const QUOTE_EMAIL_EVENT_DEFAULTS: Record<
  QuoteEmailEventType,
  { customer: boolean; admin: boolean; subject: string; body: string }
> = {
  quote_request_submitted: {
    customer: true,
    admin: true,
    subject: 'Prejeli smo vaše povpraševanje {{request_number}}',
    body:
      'Povpraševanje ni naročilo in ne povzroči obveznosti plačila. Obvestili vas bomo, ko bo ponudba pripravljena.'
  },
  quote_clarification_requested: {
    customer: true,
    admin: false,
    subject: 'Potrebujemo pojasnilo za {{offer_number}}',
    body:
      'Za nadaljevanje obravnave vašega povpraševanja potrebujemo naslednje pojasnilo:'
  },
  quote_issued: {
    customer: true,
    admin: false,
    subject: 'Ponudba {{offer_number}} je pripravljena',
    body: 'Ponudbo odprite prek varne povezave. Sam klik ponudbe ne sprejme.'
  },
  quote_access_otp: {
    customer: true,
    admin: false,
    subject: 'Varnostna koda za ponudbo {{offer_number}}',
    body: 'Vaša enkratna varnostna koda je {{otp_code}}.'
  },
  quote_accepted: {
    customer: true,
    admin: true,
    subject: 'Ponudba {{offer_number}} je sprejeta',
    body: 'Sprejem ponudbe smo zabeležili in ustvarili povezano naročilo.'
  },
  quote_declined: {
    customer: true,
    admin: true,
    subject: 'Ponudba {{offer_number}} je zavrnjena',
    body: 'Vašo odločitev smo zabeležili.'
  },
  quote_withdrawn: {
    customer: true,
    admin: false,
    subject: 'Ponudba {{offer_number}} je umaknjena',
    body: 'Ponudba ni več veljavna. Za pomoč nam odgovorite na to sporočilo.'
  },
  quote_expired: {
    customer: true,
    admin: false,
    subject: 'Ponudba {{offer_number}} je potekla',
    body: 'Rok veljavnosti ponudbe je potekel.'
  },
  quote_request_closed: {
    customer: true,
    admin: false,
    subject: 'Povpraševanje {{request_number}} je zaključeno',
    body: 'Povpraševanje smo zaključili brez izdaje ponudbe.'
  },
  quote_acceptance_blocked_stock: {
    customer: true,
    admin: true,
    subject: 'Ponudbe {{offer_number}} trenutno ni mogoče sprejeti',
    body:
      'Razpoložljiva zaloga se je spremenila. Povpraševanje ostaja odprto, da lahko pripravimo novo različico ponudbe.'
  },
  quote_delivery_failed: {
    customer: false,
    admin: true,
    subject: 'Dostava e-pošte za {{offer_number}} ni uspela',
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
        return [
          eventType,
          {
            customer: {
              subject: defaults.subject,
              greeting: QUOTE_EMAIL_DEFAULT_GREETING,
              heading: defaults.subject,
              body: defaults.body
            },
            admin: {
              subject: defaults.subject,
              greeting: QUOTE_EMAIL_DEFAULT_ADMIN_GREETING,
              heading: defaults.subject,
              body: defaults.body
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

export function normalizeQuoteEmailSettings(value: unknown): QuoteEmailSettings {
  const defaults = cloneDefaultQuoteEmailSettings();
  const source = record(value);
  const sourceEvents = record(source.events);
  const sourceTemplates = record(source.templates);
  for (const eventType of QUOTE_EMAIL_EVENT_TYPES) {
    const event = record(sourceEvents[eventType]);
    const templates = record(sourceTemplates[eventType]);
    const customerTemplate = record(templates.customer);
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
      customer: {
        subject: headerTemplateText(
          customerTemplate.subject,
          defaults.templates[eventType].customer.subject
        ),
        greeting: headerTemplateText(
          customerTemplate.greeting,
          defaults.templates[eventType].customer.greeting ??
            QUOTE_EMAIL_DEFAULT_GREETING
        ),
        heading:
          customerTemplate.heading === undefined
            ? headerTemplateText(
                customerTemplate.subject,
                defaults.templates[eventType].customer.subject
              )
            : headerTemplateText(
                customerTemplate.heading,
                defaults.templates[eventType].customer.heading ??
                  defaults.templates[eventType].customer.subject
              ),
        body: templateText(
          customerTemplate.body,
          defaults.templates[eventType].customer.body
        )
      },
      admin: {
        subject: headerTemplateText(
          adminTemplate.subject,
          defaults.templates[eventType].admin.subject
        ),
        greeting: headerTemplateText(
          adminTemplate.greeting,
          defaults.templates[eventType].admin.greeting ??
            QUOTE_EMAIL_DEFAULT_ADMIN_GREETING
        ),
        heading:
          adminTemplate.heading === undefined
            ? headerTemplateText(
                adminTemplate.subject,
                defaults.templates[eventType].admin.subject
              )
            : headerTemplateText(
                adminTemplate.heading,
                defaults.templates[eventType].admin.heading ??
                  defaults.templates[eventType].admin.subject
              ),
        body: templateText(
          adminTemplate.body,
          defaults.templates[eventType].admin.body
        )
      }
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
    for (const audience of ['customer', 'admin'] as const) {
      if (
        audience === 'admin' &&
        !quoteEmailEventSupportsAdminAudience(eventType)
      ) {
        continue;
      }
      const rawTemplate = record(record(sourceTemplates[eventType])[audience]);
      for (const [field, label] of [
        ['subject', 'zadeva'],
        ['greeting', 'pozdrav'],
        ['heading', 'naslov']
      ] as const) {
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
        rawTemplate.body !== undefined &&
        typeof rawTemplate.body !== 'string'
      ) {
        errors.push(`${eventType}/${audience}: vsebina ni veljavna.`);
      }
      const template = normalized.templates[eventType][audience];
      const greeting = template.greeting ?? '';
      const heading = template.heading ?? template.subject;
      if (!template.subject.trim()) {
        errors.push(`${eventType}/${audience}: zadeva ne sme biti prazna.`);
      } else if (template.subject.length > QUOTE_EMAIL_TEMPLATE_SUBJECT_MAX_LENGTH) {
        errors.push(`${eventType}/${audience}: zadeva je predolga.`);
      }
      if (!template.body.trim()) {
        errors.push(`${eventType}/${audience}: vsebina ne sme biti prazna.`);
      } else if (template.body.length > QUOTE_EMAIL_TEMPLATE_BODY_MAX_LENGTH) {
        errors.push(`${eventType}/${audience}: vsebina je predolga.`);
      }
      if (!greeting.trim()) {
        errors.push(`${eventType}/${audience}: pozdrav ne sme biti prazen.`);
      } else if (greeting.length > QUOTE_EMAIL_TEMPLATE_GREETING_MAX_LENGTH) {
        errors.push(`${eventType}/${audience}: pozdrav je predolg.`);
      }
      if (!heading.trim()) {
        errors.push(`${eventType}/${audience}: naslov ne sme biti prazen.`);
      } else if (heading.length > QUOTE_EMAIL_TEMPLATE_HEADING_MAX_LENGTH) {
        errors.push(`${eventType}/${audience}: naslov je predolg.`);
      }
    }
  }
  return errors;
}
