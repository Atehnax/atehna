import 'server-only';

import { generate } from '@pdfme/generator';
import {
  PDFME_V2_LIMITS,
  compilePdfmeV2Template,
  toPdfmeV2Input,
  validateDocumentRenderData,
  validatePdfmeV2CanonicalTemplate
} from '@/shared/domain/pdfmeV2';
import { PDFME_V2_PLUGINS } from '@/shared/pdfmeV2/plugins';
import { loadPdfmeV2ServerFonts } from './fonts';

export const PDFME_V2_MAX_PDF_BYTES =
  PDFME_V2_LIMITS.MAX_GENERATED_PDF_BYTES;

export type PdfmeV2RenderErrorCode =
  | 'document-type-mismatch'
  | 'invalid-pdf-signature'
  | 'pdf-size-limit';

export class PdfmeV2RenderError extends Error {
  readonly code: PdfmeV2RenderErrorCode;

  constructor(code: PdfmeV2RenderErrorCode, message: string) {
    super(message);
    this.name = 'PdfmeV2RenderError';
    this.code = code;
  }
}

export type RenderPdfmeV2DocumentRequest = {
  canonicalTemplate: unknown;
  renderData: unknown;
};

function hasPdfSignature(bytes: Uint8Array) {
  return bytes.length >= 5
    && bytes[0] === 0x25
    && bytes[1] === 0x50
    && bytes[2] === 0x44
    && bytes[3] === 0x46
    && bytes[4] === 0x2d;
}

export function assertPdfmeV2GeneratedPdf(bytes: Uint8Array) {
  if (!hasPdfSignature(bytes)) {
    throw new PdfmeV2RenderError(
      'invalid-pdf-signature',
      'Pdfme v2 generator returned bytes without a %PDF- signature.'
    );
  }

  if (bytes.byteLength >= PDFME_V2_MAX_PDF_BYTES) {
    throw new PdfmeV2RenderError(
      'pdf-size-limit',
      `Pdfme v2 generated PDF must remain below ${PDFME_V2_MAX_PDF_BYTES} bytes.`
    );
  }
}

export async function renderPdfmeV2Document({
  canonicalTemplate: unvalidatedCanonicalTemplate,
  renderData: unvalidatedRenderData
}: RenderPdfmeV2DocumentRequest): Promise<Uint8Array<ArrayBuffer>> {
  const canonicalTemplate = validatePdfmeV2CanonicalTemplate(
    unvalidatedCanonicalTemplate
  );
  const renderData = validateDocumentRenderData(unvalidatedRenderData);

  if (canonicalTemplate.envelope.documentType !== renderData.documentType) {
    throw new PdfmeV2RenderError(
      'document-type-mismatch',
      'Pdfme v2 template and render data document types must match.'
    );
  }

  const [template, font] = await Promise.all([
    Promise.resolve(compilePdfmeV2Template(canonicalTemplate)),
    loadPdfmeV2ServerFonts()
  ]);
  const input = toPdfmeV2Input(renderData);
  const bytes = await generate({
    template,
    inputs: [input],
    plugins: PDFME_V2_PLUGINS,
    options: {
      font,
      creator: 'ATEHNA pdfme v2 renderer',
      producer: 'pdfme 6.1.12'
    }
  });

  assertPdfmeV2GeneratedPdf(bytes);
  return bytes;
}
