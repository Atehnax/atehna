import type { PdfmeV2DocumentType } from '../../../src/shared/domain/pdfmeV2/documentTypes';
import type {
  DocumentRenderData,
  DocumentRenderItem
} from '../../../src/shared/domain/pdfmeV2/renderData';

export const PDFME_V2_RENDERER_SCENARIOS = [
  { documentType: 'order_summary', rowCount: 0 },
  { documentType: 'dobavnica', rowCount: 1 },
  { documentType: 'predracun', rowCount: 27 },
  { documentType: 'invoice', rowCount: 100 }
] as const satisfies readonly {
  documentType: PdfmeV2DocumentType;
  rowCount: number;
}[];

export const PDFME_V2_RENDERER_SLOVENE_GLYPHS = 'č š ž Č Š Ž';
export const PDFME_V2_RENDERER_NOTES_MARKER = 'V2-NOTES-ONLY-ONCE';
export const PDFME_V2_RENDERER_LONG_NOTES = (
  `${PDFME_V2_RENDERER_NOTES_MARKER} ${PDFME_V2_RENDERER_SLOVENE_GLYPHS} `
  + 'Razširljivo besedilo za preverjanje preloma strani. '.repeat(100)
).slice(0, 4000).padEnd(4000, 'N');

export function createPdfmeV2RendererItems(count: number): DocumentRenderItem[] {
  return Array.from({ length: count }, (_, index) => {
    const lineNumber = index + 1;
    const marker = `V2-ROW-${String(lineNumber).padStart(3, '0')}`;
    const longSku = index === 0 && count >= 27
      ? `${marker}-${'SKU'.repeat(40)}`
      : marker;
    const longProductName = index === 1 && count >= 27
      ? `${PDFME_V2_RENDERER_SLOVENE_GLYPHS} ${'Zelo dolg naziv izdelka z zavijanjem '.repeat(16)}`.trim()
      : `Učni pripomoček številka ${lineNumber}`;
    const variantName = index === 1 && count >= 27
      ? 'Različica – modra, velika in odporna'
      : `Različica ${lineNumber}`;
    const quantity = index === count - 1 && count >= 27 ? 999_999 : (index % 7) + 1;
    const unitNet = index === count - 1 && count >= 27 ? 123_456.78 : 12.5 + index;

    return {
      lineNumber,
      sku: longSku,
      productName: longProductName,
      variantName,
      displayName: `${longProductName} – ${variantName}`,
      unit: 'kos',
      quantity,
      unitNet,
      lineNet: quantity * unitNet,
      taxRate: 22,
      discountPercentage: index % 5,
      currency: 'EUR'
    };
  });
}

export function createPdfmeV2RendererData(
  documentType: PdfmeV2DocumentType,
  rowCount: number
): DocumentRenderData {
  return {
    documentType,
    documentNumber: `V2-${documentType.toUpperCase()}-2026-0042`,
    issuedAt: '2026-08-27T08:00:00.000Z',
    dueAt: '2026-09-10T08:00:00.000Z',
    orderNumber: 'N-2026-0042',
    orderedAt: '2026-08-25T08:00:00.000Z',
    reference: `SKLIC-${PDFME_V2_RENDERER_SLOVENE_GLYPHS}`,
    notes: rowCount === 100
      ? PDFME_V2_RENDERER_LONG_NOTES
      : `Kratke opombe ${PDFME_V2_RENDERER_SLOVENE_GLYPHS}`,
    customer: {
      type: 'school',
      organizationName: 'Osnovna šola Franceta Prešerna Črnomelj',
      contactName: 'Špela Žagar',
      email: 'spela.zagar@example.test',
      addressLines: ['Čopova ulica 8', 'Oddelek č, š in ž'],
      postalCode: '1000',
      city: 'Ljubljana',
      countryCode: 'SI'
    },
    items: createPdfmeV2RendererItems(rowCount),
    totals: {
      subtotal: 7_654_321.09,
      tax: 1_683_950.64,
      shipping: 12_345.67,
      total: 9_350_617.4,
      currency: 'EUR'
    }
  };
}

export function createPathologicalPdfmeV2RendererData(): DocumentRenderData {
  const base = createPdfmeV2RendererData('invoice', 1);
  const pathologicalText = `PATHOLOGICAL-${'X'.repeat(100_000)}`;
  return {
    ...base,
    items: [{
      ...base.items[0],
      productName: pathologicalText,
      displayName: pathologicalText
    }]
  };
}
