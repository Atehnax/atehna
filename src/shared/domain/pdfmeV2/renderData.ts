import type { PdfmeV2DataBinding } from './bindings';
import {
  PDFME_V2_DOCUMENT_TYPE_LABELS,
  type PdfmeV2DocumentType
} from './documentTypes';

type NumericSource = number | string | null | undefined;
type DateSource = Date | string | null | undefined;

export type DocumentRenderItem = Readonly<{
  lineNumber: number;
  sku: string;
  productName: string;
  variantName: string;
  displayName: string;
  unit: string;
  quantity: number;
  unitNet: number;
  lineNet: number;
  taxRate: number;
  discountPercentage: number;
  currency: string;
}>;

export type DocumentRenderCustomer = Readonly<{
  type: string;
  organizationName: string;
  contactName: string;
  email: string;
  addressLines: readonly string[];
  postalCode: string;
  city: string;
  countryCode: string;
}>;

export type DocumentRenderTotals = Readonly<{
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  currency: string;
}>;

/**
 * The sole v2 rendering DTO. It deliberately contains no database handles,
 * template state, asset bytes, URLs, or v1 renderer fields.
 */
export type DocumentRenderData = Readonly<{
  documentType: PdfmeV2DocumentType;
  documentNumber: string;
  issuedAt: string;
  dueAt: string | null;
  orderNumber: string;
  orderedAt: string;
  reference: string;
  notes: string;
  customer: DocumentRenderCustomer;
  items: readonly DocumentRenderItem[];
  totals: DocumentRenderTotals;
}>;

export type DatabaseOrderRecord = Readonly<{
  id?: number | string;
  order_number: string;
  customer_type?: string | null;
  organization_name?: string | null;
  contact_name?: string | null;
  email?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country_code?: string | null;
  reference?: string | null;
  notes?: string | null;
  subtotal?: NumericSource;
  tax?: NumericSource;
  shipping?: NumericSource;
  total?: NumericSource;
  currency?: string | null;
  created_at: DateSource;
}>;

export type DatabaseOrderItemRecord = Readonly<{
  id?: number | string;
  line_number?: NumericSource;
  sku?: string | null;
  name?: string | null;
  product_name?: string | null;
  variant_name?: string | null;
  unit?: string | null;
  quantity?: NumericSource;
  base_unit_net?: NumericSource;
  unit_net?: NumericSource;
  line_net?: NumericSource;
  tax_rate?: NumericSource;
  discount_pct?: NumericSource;
  discount_percentage?: NumericSource;
  currency?: string | null;
  product_snapshot_json?: unknown;
}>;

export type CheckoutSnapshotOrderRecord = DatabaseOrderRecord;

export type CheckoutSnapshotItemRecord = Readonly<{
  line_number?: NumericSource;
  product_name?: string | null;
  variant_name?: string | null;
  sku?: string | null;
  unit?: string | null;
  quantity?: NumericSource;
  base_unit_net?: NumericSource;
  unit_net?: NumericSource;
  line_net?: NumericSource;
  tax_rate?: NumericSource;
  discount_pct?: NumericSource;
  currency?: string | null;
  snapshot_json?: unknown;
}>;

export type DocumentRenderAdapterOptions = Readonly<{
  documentType: PdfmeV2DocumentType;
  documentNumber?: string;
  issuedAt?: DateSource;
  dueAt?: DateSource;
}>;

export type DatabaseOrderRenderSource = Readonly<{
  order: DatabaseOrderRecord;
  items: readonly DatabaseOrderItemRecord[];
}>;

export type CheckoutSnapshotRenderSource = Readonly<{
  order: CheckoutSnapshotOrderRecord;
  items: readonly CheckoutSnapshotItemRecord[];
}>;

export type PdfmeV2Input = Record<PdfmeV2DataBinding, string>;

export const PDFME_V2_ITEM_TABLE_HEADERS = [
  'SKU',
  'Naziv',
  'Količina',
  'Enota',
  'Cena/enoto',
  'Skupaj'
] as const;

export const PDFME_V2_ITEM_TABLE_WIDTH_PERCENTAGES = [
  16,
  38,
  10,
  9,
  13,
  14
] as const;

function cleanText(value: unknown): string {
  return typeof value === 'string'
    ? value.replace(/\r\n?/gu, '\n').replace(/[\t\f\v]+/gu, ' ').trim()
    : '';
}

function finiteNumber(value: NumericSource): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value !== 'string') return 0;
  const parsed = Number(value.trim().replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function finiteNumberOr(value: NumericSource, fallback: number): number {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string' && value.trim() === '') return fallback;
  const parsed = typeof value === 'string' ? Number(value.trim().replace(',', '.')) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : fallback;
}

function positiveInteger(value: NumericSource, fallback: number): number {
  const parsed = Math.trunc(finiteNumber(value));
  return parsed > 0 ? parsed : fallback;
}

function objectValue(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return objectValue(parsed);
    } catch {
      return {};
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function stringProperty(record: Record<string, unknown>, key: string): string {
  return cleanText(record[key]);
}

function timestamp(value: DateSource, fallback: DateSource): string {
  const candidate = value ?? fallback;
  const date = candidate instanceof Date ? candidate : new Date(String(candidate ?? ''));
  return Number.isFinite(date.getTime()) ? date.toISOString() : '1970-01-01T00:00:00.000Z';
}

function stripExistingVariantSuffix(product: string, variant: string): string | null {
  const normalizedProduct = product.toLocaleLowerCase('sl-SI');
  const normalizedVariant = variant.toLocaleLowerCase('sl-SI');
  for (const separator of [' – ', ' - ', ' — ']) {
    const suffix = separator + normalizedVariant;
    if (normalizedProduct.endsWith(suffix)) {
      return product.slice(0, product.length - suffix.length).trim();
    }
  }
  return null;
}

/** Uses one canonical separator and never appends a variant twice. */
export function composeProductVariantDisplayName(
  productName: unknown,
  variantName: unknown
): string {
  const product = cleanText(productName);
  const variant = cleanText(variantName);
  if (!product) return variant;
  if (!variant || product.toLocaleLowerCase('sl-SI') === variant.toLocaleLowerCase('sl-SI')) {
    return product;
  }
  const productWithoutVariant = stripExistingVariantSuffix(product, variant);
  return `${productWithoutVariant ?? product} – ${variant}`;
}

function databaseItemIdentity(item: DatabaseOrderItemRecord) {
  const snapshot = objectValue(item.product_snapshot_json);
  const variantName = cleanText(item.variant_name)
    || stringProperty(snapshot, 'variantName');
  const storedName = cleanText(item.name);
  const explicitProductName = cleanText(item.product_name)
    || stringProperty(snapshot, 'productName');
  const productName = explicitProductName
    || stripExistingVariantSuffix(storedName, variantName)
    || storedName;
  return {
    productName,
    variantName,
    displayName: composeProductVariantDisplayName(productName, variantName)
  };
}

function snapshotItemIdentity(item: CheckoutSnapshotItemRecord) {
  const snapshot = objectValue(item.snapshot_json);
  const productName = cleanText(item.product_name)
    || stringProperty(snapshot, 'productName');
  const variantName = cleanText(item.variant_name)
    || stringProperty(snapshot, 'variantName');
  return {
    productName,
    variantName,
    displayName: composeProductVariantDisplayName(productName, variantName)
  };
}

function customerFromOrder(order: DatabaseOrderRecord): DocumentRenderCustomer {
  return {
    type: cleanText(order.customer_type),
    organizationName: cleanText(order.organization_name),
    contactName: cleanText(order.contact_name),
    email: cleanText(order.email),
    addressLines: [cleanText(order.address_line1), cleanText(order.address_line2)]
      .filter(Boolean),
    postalCode: cleanText(order.postal_code),
    city: cleanText(order.city),
    countryCode: cleanText(order.country_code)
  };
}

function totalsFromOrder(
  order: DatabaseOrderRecord,
  fallbackCurrency: string
): DocumentRenderTotals {
  return {
    subtotal: finiteNumber(order.subtotal),
    tax: finiteNumber(order.tax),
    shipping: finiteNumber(order.shipping),
    total: finiteNumber(order.total),
    currency: cleanText(order.currency) || fallbackCurrency || 'EUR'
  };
}

function baseRenderData(
  order: DatabaseOrderRecord,
  options: DocumentRenderAdapterOptions,
  items: readonly DocumentRenderItem[]
): DocumentRenderData {
  const fallbackCurrency = items[0]?.currency || 'EUR';
  const orderedAt = timestamp(order.created_at, options.issuedAt);
  return {
    documentType: options.documentType,
    documentNumber: cleanText(options.documentNumber) || cleanText(order.order_number),
    issuedAt: timestamp(options.issuedAt, order.created_at),
    dueAt: options.dueAt == null ? null : timestamp(options.dueAt, options.issuedAt),
    orderNumber: cleanText(order.order_number),
    orderedAt,
    reference: cleanText(order.reference),
    notes: cleanText(order.notes),
    customer: customerFromOrder(order),
    items,
    totals: totalsFromOrder(order, fallbackCurrency)
  };
}

export function adaptDatabaseOrderToDocumentRenderData(
  source: DatabaseOrderRenderSource,
  options: DocumentRenderAdapterOptions
): DocumentRenderData {
  const items = source.items.map((item, index): DocumentRenderItem => {
    const identity = databaseItemIdentity(item);
    const quantity = positiveInteger(item.quantity, 1);
    const unitNet = finiteNumber(item.unit_net ?? item.base_unit_net);
    return {
      lineNumber: positiveInteger(item.line_number, index + 1),
      sku: cleanText(item.sku),
      ...identity,
      unit: cleanText(item.unit),
      quantity,
      unitNet,
      lineNet: finiteNumberOr(item.line_net, unitNet * quantity),
      taxRate: finiteNumber(item.tax_rate),
      discountPercentage: finiteNumber(
        item.discount_pct ?? item.discount_percentage
      ),
      currency: cleanText(item.currency) || cleanText(source.order.currency) || 'EUR'
    };
  });
  return baseRenderData(source.order, options, items);
}

export function adaptCheckoutSnapshotToDocumentRenderData(
  source: CheckoutSnapshotRenderSource,
  options: DocumentRenderAdapterOptions
): DocumentRenderData {
  const items = source.items.map((item, index): DocumentRenderItem => {
    const identity = snapshotItemIdentity(item);
    const quantity = positiveInteger(item.quantity, 1);
    const unitNet = finiteNumber(item.unit_net ?? item.base_unit_net);
    return {
      lineNumber: positiveInteger(item.line_number, index + 1),
      sku: cleanText(item.sku),
      ...identity,
      unit: cleanText(item.unit),
      quantity,
      unitNet,
      lineNet: finiteNumberOr(item.line_net, unitNet * quantity),
      taxRate: finiteNumber(item.tax_rate),
      discountPercentage: finiteNumber(item.discount_pct),
      currency: cleanText(item.currency) || cleanText(source.order.currency) || 'EUR'
    };
  });
  return baseRenderData(source.order, options, items);
}

export const documentRenderDataFromDatabaseOrder =
  adaptDatabaseOrderToDocumentRenderData;
export const documentRenderDataFromCheckoutSnapshot =
  adaptCheckoutSnapshotToDocumentRenderData;

export function formatPdfmeV2Date(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Ljubljana',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? '';
  return `${part('day')}. ${part('month')}. ${part('year')}`;
}

export function formatPdfmeV2Currency(value: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('sl-SI', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function customerTypeLabel(value: string): string {
  if (value === 'school') return 'Šola / javni zavod';
  if (value === 'company') return 'Podjetje';
  if (value === 'individual') return 'Fizična oseba';
  return value;
}

function customerAddress(customer: DocumentRenderCustomer): string {
  const locality = [customer.postalCode, customer.city].filter(Boolean).join(' ');
  return [...customer.addressLines, locality, customer.countryCode]
    .filter(Boolean)
    .join('\n');
}

/**
 * Converts the structured DTO to pdfme's flat input object. Page variables are
 * intentionally absent: generator 6.1.12 supplies currentPage/totalPages itself.
 */
export function toPdfmeV2Input(data: DocumentRenderData): PdfmeV2Input {
  const currency = data.totals.currency || 'EUR';
  const customerName = data.customer.organizationName || data.customer.contactName;
  return {
    documentTitle: PDFME_V2_DOCUMENT_TYPE_LABELS[data.documentType],
    documentType: data.documentType,
    documentNumber: data.documentNumber,
    issueDate: formatPdfmeV2Date(data.issuedAt),
    dueDate: formatPdfmeV2Date(data.dueAt),
    orderNumber: data.orderNumber,
    orderDate: formatPdfmeV2Date(data.orderedAt),
    reference: data.reference,
    customerType: customerTypeLabel(data.customer.type),
    customerName,
    customerContactName: data.customer.organizationName
      ? data.customer.contactName
      : '',
    customerEmail: data.customer.email,
    customerAddress: customerAddress(data.customer),
    notes: data.notes,
    currency,
    itemsTable: JSON.stringify(data.items.map((item) => [
      item.sku || '-',
      item.displayName,
      String(item.quantity),
      item.unit || '-',
      formatPdfmeV2Currency(item.unitNet, item.currency || currency),
      formatPdfmeV2Currency(item.lineNet, item.currency || currency)
    ])),
    subtotal: formatPdfmeV2Currency(data.totals.subtotal, currency),
    tax: formatPdfmeV2Currency(data.totals.tax, currency),
    shipping: formatPdfmeV2Currency(data.totals.shipping, currency),
    total: formatPdfmeV2Currency(data.totals.total, currency)
  };
}
