import type { PdfmeV2DocumentType } from './documentTypes';
import type { DocumentRenderData, DocumentRenderItem } from './renderData';
import { composeProductVariantDisplayName } from './renderData';

export const PDFME_V2_SAMPLE_ROW_COUNTS = [0, 1, 27, 100] as const;
export type PdfmeV2SampleRowCount = (typeof PDFME_V2_SAMPLE_ROW_COUNTS)[number];

const NOTES_SEED =
  'Dostava v tajništvo med 8.00 in 13.00. Posebni znaki: č š ž Č Š Ž. ';

export const PDFME_V2_LONG_NOTES = NOTES_SEED
  .repeat(Math.ceil(4_000 / NOTES_SEED.length))
  .slice(0, 4_000);

const SAMPLE_DOCUMENT_NUMBERS: Readonly<Record<PdfmeV2DocumentType, string>> = {
  order_summary: 'PN-2026-0042',
  dobavnica: 'D-2026-0042',
  predracun: 'P-2026-0042',
  invoice: 'R-2026-0042'
};

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function sampleItem(index: number, rowCount: PdfmeV2SampleRowCount): DocumentRenderItem {
  const lineNumber = index + 1;
  const isLong = index === 0;
  const isLarge = rowCount === 100 && index === rowCount - 1;
  const productName = isLong
    ? 'Izredno dolga oznaka izdelka za preverjanje samodejnega preloma besedila brez elipse v večvrstični celici'
    : `Aluminijasta učna plošča ${String(lineNumber).padStart(3, '0')}`;
  const variantName = isLong
    ? 'Različica 1200 × 800 × 0,75 mm, brušena površina'
    : `${100 + index * 5} × ${80 + index * 3} × 1 mm`;
  const quantity = isLarge ? 1_000_000 : (index % 7) + 1;
  const unitNet = isLarge ? 500_000 : roundMoney(3.75 + index * 0.61);
  return {
    lineNumber,
    sku: isLong
      ? `SKU-ZELO-DOLGA-OZNAKA-${'X'.repeat(120)}`
      : `ATE-${String(lineNumber).padStart(5, '0')}`,
    productName,
    variantName,
    displayName: composeProductVariantDisplayName(productName, variantName),
    unit: 'kos',
    quantity,
    unitNet,
    lineNet: roundMoney(unitNet * quantity),
    taxRate: 0.22,
    discountPercentage: index % 5 === 0 ? 7.5 : 0,
    currency: 'EUR'
  };
}

/** Deterministic shared preview/pagination fixture for the exact proof row counts. */
export function createPdfmeV2SampleRenderData(
  documentType: PdfmeV2DocumentType,
  rowCount: PdfmeV2SampleRowCount
): DocumentRenderData {
  if (!(PDFME_V2_SAMPLE_ROW_COUNTS as readonly number[]).includes(rowCount)) {
    throw new RangeError('pdfme v2 sample rowCount must be 0, 1, 27 or 100.');
  }
  const items = Array.from({ length: rowCount }, (_, index) =>
    sampleItem(index, rowCount));
  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.lineNet, 0));
  const tax = roundMoney(subtotal * 0.22);
  const shipping = rowCount === 0 ? 0 : 12.5;

  return {
    documentType,
    documentNumber: SAMPLE_DOCUMENT_NUMBERS[documentType],
    issuedAt: '2026-08-27T08:30:00.000Z',
    dueAt: '2026-09-26T08:30:00.000Z',
    orderNumber: '#42',
    orderedAt: '2026-08-25T06:15:00.000Z',
    reference: 'NAR-2026-0042',
    notes: rowCount === 100 ? PDFME_V2_LONG_NOTES : NOTES_SEED.trim(),
    customer: {
      type: 'school',
      organizationName: 'OSNOVNA ŠOLA ČRNUČE',
      contactName: 'Špela Žagar',
      email: 'narocila@example.test',
      addressLines: ['Dunajska cesta 400', 'Tajništvo, 1. nadstropje'],
      postalCode: '1231',
      city: 'Ljubljana - Črnuče',
      countryCode: 'SI'
    },
    items,
    totals: {
      subtotal,
      tax,
      shipping,
      total: roundMoney(subtotal + tax + shipping),
      currency: 'EUR'
    }
  };
}

export function createPdfmeV2SampleRenderDataFixtures(
  documentType: PdfmeV2DocumentType
): Readonly<Record<PdfmeV2SampleRowCount, DocumentRenderData>> {
  return {
    0: createPdfmeV2SampleRenderData(documentType, 0),
    1: createPdfmeV2SampleRenderData(documentType, 1),
    27: createPdfmeV2SampleRenderData(documentType, 27),
    100: createPdfmeV2SampleRenderData(documentType, 100)
  };
}
