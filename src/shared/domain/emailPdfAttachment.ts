import type { GenerateOrderPdfType } from './order/orderTypes';

export const EMAIL_PDF_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const PDF_FILENAME_PATTERN = /\.pdf$/iu;
const HEADER_CONTROL_PATTERN = /[\u0000-\u001f\u007f]/u;

type DocumentPin = Readonly<{
  documentId: number | null;
  contentSha256: string | null;
  filename: string | null;
}>;

export type OrderEmailPdfDocumentReference = Readonly<{
  source: 'order_document';
  orderId: number;
  documentType: GenerateOrderPdfType;
  versionNumber: number;
}> & DocumentPin;

export type QuoteEmailPdfDocumentReference = Readonly<{
  source: 'quote_document';
  quoteRequestId: number;
  quoteOfferVersionId: number;
  documentType: 'offer';
  versionNumber: 1;
}> & DocumentPin;

export type TransactionalEmailPdfDocumentReference =
  | OrderEmailPdfDocumentReference
  | QuoteEmailPdfDocumentReference;

export type EmailProviderPdfAttachment = Readonly<{
  content: string;
  filename: string;
}>;

type JsonRecord = Record<string, unknown>;

function isPlainRecord(value: unknown): value is JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function isSafePdfFilename(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value === value.trim() &&
    value.length > 0 &&
    value.length <= 255 &&
    value !== '.' &&
    value !== '..' &&
    !/[\\/]/u.test(value) &&
    !HEADER_CONTROL_PATTERN.test(value) &&
    PDF_FILENAME_PATTERN.test(value)
  );
}

function hasExactKeys(record: JsonRecord, keys: readonly string[]): boolean {
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function normalizePin(record: JsonRecord): DocumentPin | null {
  const documentId = record.documentId;
  const contentSha256 = record.contentSha256;
  const filename = record.filename;
  if (documentId !== null && !isPositiveInteger(documentId)) return null;
  if (
    contentSha256 !== null &&
    (typeof contentSha256 !== 'string' || !SHA256_PATTERN.test(contentSha256))
  ) {
    return null;
  }
  if (filename !== null && !isSafePdfFilename(filename)) return null;
  if (documentId !== null && (contentSha256 === null || filename === null)) {
    return null;
  }
  if (contentSha256 === null && filename !== null) return null;
  return Object.freeze({ documentId, contentSha256, filename });
}

const ORDER_REFERENCE_KEYS = [
  'source',
  'orderId',
  'documentType',
  'versionNumber',
  'documentId',
  'contentSha256',
  'filename'
] as const;

const QUOTE_REFERENCE_KEYS = [
  'source',
  'quoteRequestId',
  'quoteOfferVersionId',
  'documentType',
  'versionNumber',
  'documentId',
  'contentSha256',
  'filename'
] as const;

const ORDER_DOCUMENT_TYPES = new Set<GenerateOrderPdfType>([
  'order_summary',
  'dobavnica',
  'predracun',
  'invoice'
]);

export function normalizeOrderEmailPdfDocumentReference(
  value: unknown
): OrderEmailPdfDocumentReference | null {
  if (!isPlainRecord(value) || !hasExactKeys(value, ORDER_REFERENCE_KEYS)) {
    return null;
  }
  if (
    value.source !== 'order_document' ||
    !isPositiveInteger(value.orderId) ||
    typeof value.documentType !== 'string' ||
    !ORDER_DOCUMENT_TYPES.has(value.documentType as GenerateOrderPdfType) ||
    !isPositiveInteger(value.versionNumber)
  ) {
    return null;
  }
  const pin = normalizePin(value);
  if (!pin) return null;
  return Object.freeze({
    source: 'order_document',
    orderId: value.orderId,
    documentType: value.documentType as GenerateOrderPdfType,
    versionNumber: value.versionNumber,
    ...pin
  });
}

export function normalizeQuoteEmailPdfDocumentReference(
  value: unknown
): QuoteEmailPdfDocumentReference | null {
  if (!isPlainRecord(value) || !hasExactKeys(value, QUOTE_REFERENCE_KEYS)) {
    return null;
  }
  if (
    value.source !== 'quote_document' ||
    !isPositiveInteger(value.quoteRequestId) ||
    !isPositiveInteger(value.quoteOfferVersionId) ||
    value.documentType !== 'offer' ||
    value.versionNumber !== 1
  ) {
    return null;
  }
  const pin = normalizePin(value);
  if (!pin) return null;
  return Object.freeze({
    source: 'quote_document',
    quoteRequestId: value.quoteRequestId,
    quoteOfferVersionId: value.quoteOfferVersionId,
    documentType: 'offer',
    versionNumber: 1,
    ...pin
  });
}

export function createPendingOrderEmailPdfDocumentReference(
  orderId: number,
  documentType: GenerateOrderPdfType,
  versionNumber: number
): OrderEmailPdfDocumentReference {
  const normalized = normalizeOrderEmailPdfDocumentReference({
    source: 'order_document',
    orderId,
    documentType,
    versionNumber,
    documentId: null,
    contentSha256: null,
    filename: null
  });
  if (!normalized) throw new Error('Invalid order email PDF document reference.');
  return normalized;
}

export function createPendingQuoteEmailPdfDocumentReference(input: {
  quoteRequestId: number;
  quoteOfferVersionId: number;
  contentSha256?: string | null;
  filename?: string | null;
}): QuoteEmailPdfDocumentReference {
  const normalized = normalizeQuoteEmailPdfDocumentReference({
    source: 'quote_document',
    quoteRequestId: input.quoteRequestId,
    quoteOfferVersionId: input.quoteOfferVersionId,
    documentType: 'offer',
    versionNumber: 1,
    documentId: null,
    contentSha256: input.contentSha256 ?? null,
    filename: input.filename ?? null
  });
  if (!normalized) throw new Error('Invalid quote email PDF document reference.');
  return normalized;
}

export function isPinnedEmailPdfDocumentReference(
  value: TransactionalEmailPdfDocumentReference
): boolean {
  return (
    value.documentId !== null &&
    value.contentSha256 !== null &&
    value.filename !== null
  );
}

export function pinEmailPdfDocumentReference<T extends TransactionalEmailPdfDocumentReference>(
  reference: T,
  pin: Readonly<{ documentId: number; contentSha256: string; filename: string }>
): T {
  const candidate = { ...reference, ...pin };
  const normalized = reference.source === 'order_document'
    ? normalizeOrderEmailPdfDocumentReference(candidate)
    : normalizeQuoteEmailPdfDocumentReference(candidate);
  if (!normalized) throw new Error('Invalid pinned email PDF document reference.');
  return normalized as T;
}

export function isSafeEmailPdfFilename(value: unknown): value is string {
  return isSafePdfFilename(value);
}

export function isEmailPdfSha256(value: unknown): value is string {
  return typeof value === 'string' && SHA256_PATTERN.test(value);
}

export function orderEmailPdfDocumentTypeForEvent(
  eventType: string
): GenerateOrderPdfType | null {
  if (eventType === 'order_submitted' || eventType === 'order_accepted') {
    return 'order_summary';
  }
  if (eventType === 'predracun_issued') return 'predracun';
  if (eventType === 'invoice_issued') return 'invoice';
  return null;
}

export function orderEmailPdfReferenceMatchesEvent(
  eventType: string,
  reference: OrderEmailPdfDocumentReference
): boolean {
  return orderEmailPdfDocumentTypeForEvent(eventType) === reference.documentType;
}

export function quoteEmailPdfReferenceMatchesEvent(
  eventType: string,
  reference: QuoteEmailPdfDocumentReference
): boolean {
  return eventType === 'quote_issued' && reference.documentType === 'offer';
}
