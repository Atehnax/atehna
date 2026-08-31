export const PDFME_V2_DATA_BINDINGS = [
  'documentTitle',
  'documentType',
  'documentNumber',
  'issueDate',
  'dueDate',
  'orderNumber',
  'orderDate',
  'reference',
  'customerType',
  'customerName',
  'customerContactName',
  'customerEmail',
  'customerAddress',
  'notes',
  'currency',
  'itemsTable',
  'subtotal',
  'tax',
  'shipping',
  'total'
] as const;

export const PDFME_V2_INTERNAL_PAGE_BINDINGS = [
  'currentPage',
  'totalPages'
] as const;

export const PDFME_V2_ALLOWED_BINDINGS = [
  ...PDFME_V2_DATA_BINDINGS,
  ...PDFME_V2_INTERNAL_PAGE_BINDINGS
] as const;

export type PdfmeV2DataBinding = (typeof PDFME_V2_DATA_BINDINGS)[number];
export type PdfmeV2InternalPageBinding =
  (typeof PDFME_V2_INTERNAL_PAGE_BINDINGS)[number];
export type PdfmeV2BindingName = (typeof PDFME_V2_ALLOWED_BINDINGS)[number];

export function isPdfmeV2AllowedBinding(value: unknown): value is PdfmeV2BindingName {
  return typeof value === 'string'
    && (PDFME_V2_ALLOWED_BINDINGS as readonly string[]).includes(value);
}
