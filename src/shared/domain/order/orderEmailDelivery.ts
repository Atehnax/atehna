import {
  buildOrderEmailMessage,
  normalizeEmailMessageAttachment,
  type EmailMessageAttachment,
  type OrderEmailAudience,
  type OrderEmailJobPayload
} from './orderEmailTemplates';
import {
  isOrderEmailEventType,
  type OrderEmailEventType
} from './orderEmailSettings';
import {
  normalizeOrderEmailPdfDocumentReference,
  orderEmailPdfReferenceMatchesEvent,
  type OrderEmailPdfDocumentReference
} from '../emailPdfAttachment';

export const ORDER_EMAIL_DELIVERY_ENVELOPE_VERSION = 2 as const;
export const MAX_ORDER_EMAIL_DELIVERY_JSON_LENGTH = 4_000_000;
export const MAX_ORDER_EMAIL_HTML_LENGTH = 2_000_000;
export const MAX_ORDER_EMAIL_TEXT_LENGTH = 1_000_000;
export const MIN_RESEND_RETRY_AFTER_MS = 1_000;
export const MAX_RESEND_RETRY_AFTER_MS = 6 * 60 * 60 * 1_000;

export type PersistedOrderEmailMessage = Readonly<{
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  attachments?: readonly EmailMessageAttachment[];
}>;

export type OrderEmailDeliveryRecipient = Readonly<{
  email: string;
  name: string | null;
}>;

export type OrderEmailDeliveryEnvelope = Readonly<{
  version: typeof ORDER_EMAIL_DELIVERY_ENVELOPE_VERSION;
  eventType: OrderEmailEventType;
  audience: OrderEmailAudience;
  recipient: OrderEmailDeliveryRecipient;
  message: PersistedOrderEmailMessage;
  pdfDocument?: OrderEmailPdfDocumentReference;
}>;

export type RedactedOrderEmailDeliveryEnvelope = Readonly<{
  version: typeof ORDER_EMAIL_DELIVERY_ENVELOPE_VERSION;
  redacted: true;
  eventType: OrderEmailEventType;
  audience: OrderEmailAudience;
}>;

export type ResendFailure =
  | Readonly<{ kind: 'network' }>
  | Readonly<{
      kind: 'http';
      status: number;
      retryAfter?: string | null;
    }>;

export type ResendFailureCategory =
  | 'network'
  | 'request_timeout'
  | 'too_early'
  | 'rate_limited'
  | 'server_error'
  | 'permanent_http'
  | 'invalid_payload';

export type ResendFailureClassification = Readonly<{
  disposition: 'retry' | 'terminal';
  category: ResendFailureCategory;
  status: number | null;
  retryAfterMs: number | null;
}>;

export class OrderEmailDeliveryEnvelopeValidationError extends Error {
  readonly path: string;

  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'OrderEmailDeliveryEnvelopeValidationError';
    this.path = path;
  }
}

export function classifyOrderEmailDeliveryValidationFailure(
  error: unknown
): ResendFailureClassification | null {
  if (!(error instanceof OrderEmailDeliveryEnvelopeValidationError)) {
    return null;
  }
  return {
    disposition: 'terminal',
    category: 'invalid_payload',
    status: null,
    retryAfterMs: null
  };
}

type JsonRecord = Record<string, unknown>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const HEADER_CONTROLS_PATTERN = /[\u0000-\u001f\u007f]/u;
const BODY_CONTROLS_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;
const RECIPIENT_NAME_CONTROLS_PATTERN = /[\u0000-\u001f\u007f]+/gu;
const HTTP_DATE_PATTERN = /^[A-Za-z]{3}, \d{2} [A-Za-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT$/u;

function fail(path: string, message: string): never {
  throw new OrderEmailDeliveryEnvelopeValidationError(path, message);
}

function isPlainRecord(value: unknown): value is JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requireRecord(value: unknown, path: string): JsonRecord {
  if (!isPlainRecord(value)) {
    fail(path, 'must be a plain JSON object');
  }
  return value;
}

function hasOwn(record: JsonRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function requireExactKeys(
  record: JsonRecord,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[],
  path: string
): void {
  const allowed = new Set([...requiredKeys, ...optionalKeys]);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      fail(`${path}.${key}`, 'is not an allowed field');
    }
  }

  for (const key of requiredKeys) {
    if (!hasOwn(record, key)) {
      fail(`${path}.${key}`, 'is required');
    }
  }
}

function requireString(
  value: unknown,
  path: string,
  options: Readonly<{
    minLength?: number;
    maxLength: number;
    headerSafe?: boolean;
    bodySafe?: boolean;
  }>
): string {
  if (typeof value !== 'string') {
    fail(path, 'must be a string');
  }

  const minLength = options.minLength ?? 0;
  if (value.length < minLength || value.length > options.maxLength) {
    fail(
      path,
      `must contain between ${minLength} and ${options.maxLength} characters`
    );
  }
  if (options.headerSafe && HEADER_CONTROLS_PATTERN.test(value)) {
    fail(path, 'must not contain control characters');
  }
  if (options.bodySafe && BODY_CONTROLS_PATTERN.test(value)) {
    fail(path, 'must not contain unsafe control characters');
  }

  return value;
}

function requireEmail(value: unknown, path: string): string {
  const email = requireString(value, path, {
    minLength: 3,
    maxLength: 320,
    headerSafe: true
  });
  if (email !== email.trim() || !EMAIL_PATTERN.test(email)) {
    fail(path, 'must be a valid email address without surrounding whitespace');
  }
  return email;
}

function requireAudience(value: unknown, path: string): OrderEmailAudience {
  if (value !== 'customer' && value !== 'admin') {
    fail(path, 'must be either "customer" or "admin"');
  }
  return value;
}

function requireEventType(value: unknown, path: string): OrderEmailEventType {
  if (typeof value !== 'string' || !isOrderEmailEventType(value)) {
    fail(path, 'is not a supported order email event type');
  }
  return value;
}

function parseRecipient(value: unknown): OrderEmailDeliveryRecipient {
  const recipient = requireRecord(value, '$.recipient');
  requireExactKeys(recipient, ['email', 'name'], [], '$.recipient');

  const email = requireEmail(recipient.email, '$.recipient.email');
  let name: string | null = null;
  if (recipient.name !== null) {
    name = requireString(recipient.name, '$.recipient.name', {
      maxLength: 500,
      headerSafe: true
    });
  }

  return Object.freeze({ email, name });
}

function parsePdfDocument(value: unknown): OrderEmailPdfDocumentReference {
  const reference = normalizeOrderEmailPdfDocumentReference(value);
  if (!reference) {
    fail(
      '$.pdfDocument',
      'must be a strictly scoped immutable order PDF reference'
    );
  }
  return reference;
}

function parseAttachments(value: unknown): readonly EmailMessageAttachment[] {
  if (!Array.isArray(value)) {
    fail('$.message.attachments', 'must be an array');
  }
  if (value.length !== 1) {
    fail('$.message.attachments', 'must contain exactly one attachment');
  }

  const rawAttachment = requireRecord(
    value[0],
    '$.message.attachments[0]'
  );
  requireExactKeys(
    rawAttachment,
    ['path', 'filename'],
    [],
    '$.message.attachments[0]'
  );
  const path = requireString(
    rawAttachment.path,
    '$.message.attachments[0].path',
    { minLength: 1, maxLength: 4_096, headerSafe: true }
  );
  const filename = requireString(
    rawAttachment.filename,
    '$.message.attachments[0].filename',
    { minLength: 1, maxLength: 255, headerSafe: true }
  );
  const attachment = normalizeEmailMessageAttachment({ path, filename });
  if (!attachment) {
    fail(
      '$.message.attachments[0]',
      'must reference one trusted shared image attachment'
    );
  }
  return Object.freeze([attachment]);
}

function parseMessage(value: unknown): PersistedOrderEmailMessage {
  const message = requireRecord(value, '$.message');
  requireExactKeys(
    message,
    ['from', 'to', 'subject', 'html', 'text'],
    ['replyTo', 'attachments'],
    '$.message'
  );

  const from = requireString(message.from, '$.message.from', {
    minLength: 3,
    maxLength: 1_000,
    headerSafe: true
  });
  const to = requireEmail(message.to, '$.message.to');
  const replyTo = hasOwn(message, 'replyTo')
    ? requireEmail(message.replyTo, '$.message.replyTo')
    : undefined;
  const subject = requireString(message.subject, '$.message.subject', {
    minLength: 1,
    maxLength: 1_000,
    headerSafe: true
  });
  const html = requireString(message.html, '$.message.html', {
    minLength: 1,
    maxLength: MAX_ORDER_EMAIL_HTML_LENGTH,
    bodySafe: true
  });
  const text = requireString(message.text, '$.message.text', {
    minLength: 1,
    maxLength: MAX_ORDER_EMAIL_TEXT_LENGTH,
    bodySafe: true
  });
  const attachments = hasOwn(message, 'attachments')
    ? parseAttachments(message.attachments)
    : undefined;

  return Object.freeze({
    from,
    to,
    ...(replyTo ? { replyTo } : {}),
    subject,
    html,
    text,
    ...(attachments ? { attachments } : {})
  });
}

function decodeEnvelopeInput(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  if (value.length > MAX_ORDER_EMAIL_DELIVERY_JSON_LENGTH) {
    fail('$', `serialized JSON exceeds ${MAX_ORDER_EMAIL_DELIVERY_JSON_LENGTH} characters`);
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    fail('$', 'must be valid JSON');
  }
}

function snapshotRecipientName(value: string | null): string | null {
  if (value === null) return null;
  const normalized = value
    .replace(RECIPIENT_NAME_CONTROLS_PATTERN, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, 500);
  return normalized || null;
}

/**
 * Builds the provider message exactly once and wraps it in the persisted v2
 * contract. Workers must send `envelope.message` instead of rendering again.
 */
export function createOrderEmailDeliveryEnvelope(
  payload: OrderEmailJobPayload,
  options: Readonly<{
    pdfDocument?: OrderEmailPdfDocumentReference | null;
  }> = {}
): OrderEmailDeliveryEnvelope {
  const message = buildOrderEmailMessage(payload);
  return parseOrderEmailDeliveryEnvelope({
    version: ORDER_EMAIL_DELIVERY_ENVELOPE_VERSION,
    eventType: payload.eventType,
    audience: payload.audience,
    recipient: {
      email: message.to,
      name: snapshotRecipientName(payload.recipientName)
    },
    message,
    ...(options.pdfDocument ? { pdfDocument: options.pdfDocument } : {})
  });
}

/** Parses either decoded JSON/JSONB or a serialized JSON string. */
export function parseOrderEmailDeliveryEnvelope(
  value: unknown
): OrderEmailDeliveryEnvelope {
  const envelope = requireRecord(decodeEnvelopeInput(value), '$');
  requireExactKeys(
    envelope,
    ['version', 'eventType', 'audience', 'recipient', 'message'],
    ['pdfDocument'],
    '$'
  );

  if (envelope.version !== ORDER_EMAIL_DELIVERY_ENVELOPE_VERSION) {
    fail(
      '$.version',
      `must equal ${ORDER_EMAIL_DELIVERY_ENVELOPE_VERSION}`
    );
  }
  const eventType = requireEventType(envelope.eventType, '$.eventType');
  const audience = requireAudience(envelope.audience, '$.audience');
  const recipient = parseRecipient(envelope.recipient);
  const message = parseMessage(envelope.message);
  const pdfDocument = hasOwn(envelope, 'pdfDocument')
    ? parsePdfDocument(envelope.pdfDocument)
    : undefined;
  if (pdfDocument && audience !== 'customer') {
    fail('$.pdfDocument', 'is allowed only for a customer delivery');
  }
  if (pdfDocument && !orderEmailPdfReferenceMatchesEvent(eventType, pdfDocument)) {
    fail('$.pdfDocument', 'does not match the email event');
  }
  if (message.to !== recipient.email) {
    fail('$.message.to', 'must exactly match $.recipient.email');
  }

  return Object.freeze({
    version: ORDER_EMAIL_DELIVERY_ENVELOPE_VERSION,
    eventType,
    audience,
    recipient,
    message,
    ...(pdfDocument ? { pdfDocument } : {})
  });
}

export function serializeOrderEmailDeliveryEnvelope(value: unknown): string {
  return JSON.stringify(parseOrderEmailDeliveryEnvelope(value));
}

/** Produces a PII-free replacement suitable for a terminally sent job row. */
export function redactOrderEmailDeliveryEnvelope(
  value: unknown
): RedactedOrderEmailDeliveryEnvelope {
  const envelope = parseOrderEmailDeliveryEnvelope(value);
  return Object.freeze({
    version: ORDER_EMAIL_DELIVERY_ENVELOPE_VERSION,
    redacted: true,
    eventType: envelope.eventType,
    audience: envelope.audience
  });
}

function clampRetryAfterMs(value: number): number {
  if (!Number.isFinite(value)) return MAX_RESEND_RETRY_AFTER_MS;
  return Math.max(
    MIN_RESEND_RETRY_AFTER_MS,
    Math.min(MAX_RESEND_RETRY_AFTER_MS, Math.ceil(value))
  );
}

/** Parses RFC delay-seconds or IMF-fixdate without reading ambient clock state. */
export function parseResendRetryAfterMs(
  value: string | null | undefined,
  nowMs: number
): number | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return null;

  if (/^\d+$/u.test(normalized)) {
    return clampRetryAfterMs(Number(normalized) * 1_000);
  }

  if (!Number.isFinite(nowMs) || !HTTP_DATE_PATTERN.test(normalized)) {
    return null;
  }
  const retryAtMs = Date.parse(normalized);
  if (!Number.isFinite(retryAtMs)) return null;
  return clampRetryAfterMs(retryAtMs - nowMs);
}

/**
 * Pure Resend failure policy. Only transport failures, 408, 425, 429, and 5xx
 * responses are retried. In particular, every 409 is terminal.
 */
export function classifyResendFailure(
  failure: ResendFailure,
  nowMs: number
): ResendFailureClassification {
  if (failure.kind === 'network') {
    return {
      disposition: 'retry',
      category: 'network',
      status: null,
      retryAfterMs: null
    };
  }

  const status = failure.status;
  let category: ResendFailureCategory = 'permanent_http';
  if (status === 408) category = 'request_timeout';
  else if (status === 425) category = 'too_early';
  else if (status === 429) category = 'rate_limited';
  else if (Number.isInteger(status) && status >= 500 && status <= 599) {
    category = 'server_error';
  }

  if (category === 'permanent_http') {
    return {
      disposition: 'terminal',
      category,
      status,
      retryAfterMs: null
    };
  }

  return {
    disposition: 'retry',
    category,
    status,
    retryAfterMs: parseResendRetryAfterMs(failure.retryAfter, nowMs)
  };
}
