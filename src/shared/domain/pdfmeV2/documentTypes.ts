export const PDFME_V2_DOCUMENT_TYPES = [
  'order_summary',
  'dobavnica',
  'predracun',
  'invoice'
] as const;

export type PdfmeV2DocumentType = (typeof PDFME_V2_DOCUMENT_TYPES)[number];

export const PDFME_V2_DOCUMENT_TYPE_LABELS: Readonly<
  Record<PdfmeV2DocumentType, string>
> = {
  order_summary: 'Potrditev naročila',
  dobavnica: 'Dobavnica',
  predracun: 'Predračun',
  invoice: 'Račun'
};

export function isPdfmeV2DocumentType(value: unknown): value is PdfmeV2DocumentType {
  return typeof value === 'string'
    && (PDFME_V2_DOCUMENT_TYPES as readonly string[]).includes(value);
}

export function assertPdfmeV2DocumentType(value: unknown): PdfmeV2DocumentType {
  if (isPdfmeV2DocumentType(value)) return value;
  throw new TypeError(`Unsupported pdfme v2 document type: ${String(value)}`);
}
