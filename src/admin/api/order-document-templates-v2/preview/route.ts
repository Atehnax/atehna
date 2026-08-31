import 'server-only';

import { PdfmeV2ValidationError } from '@/shared/domain/pdfmeV2';
import {
  PdfmeV2RenderError,
  renderPdfmeV2Document
} from '@/shared/server/pdfmeV2';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const PDFME_V2_PREVIEW_MAX_REQUEST_BYTES = 4 * 1024 * 1024;

export const PDFME_V2_PREVIEW_RESPONSE_HEADERS = {
  'Cache-Control': 'no-store, private, max-age=0',
  'X-Content-Type-Options': 'nosniff'
} as const;

class PdfmeV2PreviewRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'PdfmeV2PreviewRequestError';
    this.status = status;
  }
}

function errorResponse(message: string, status: number) {
  return Response.json(
    { message },
    {
      status,
      headers: PDFME_V2_PREVIEW_RESPONSE_HEADERS
    }
  );
}

async function readBoundedJson(request: Request): Promise<unknown> {
  const contentLength = request.headers.get('content-length');
  if (contentLength) {
    const declaredLength = Number(contentLength);
    if (
      Number.isFinite(declaredLength)
      && declaredLength > PDFME_V2_PREVIEW_MAX_REQUEST_BYTES
    ) {
      throw new PdfmeV2PreviewRequestError(
        413,
        'Zahteva za predogled PDF je prevelika.'
      );
    }
  }

  if (!request.body) {
    throw new PdfmeV2PreviewRequestError(400, 'Manjkajo podatki za predogled PDF.');
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteLength += value.byteLength;
    if (byteLength > PDFME_V2_PREVIEW_MAX_REQUEST_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new PdfmeV2PreviewRequestError(
        413,
        'Zahteva za predogled PDF je prevelika.'
      );
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const json = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return JSON.parse(json) as unknown;
  } catch {
    throw new PdfmeV2PreviewRequestError(400, 'Neveljaven JSON za predogled PDF.');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  try {
    const payload = await readBoundedJson(request);
    if (!isRecord(payload)) {
      throw new PdfmeV2PreviewRequestError(
        400,
        'Podatki za predogled PDF niso veljavni.'
      );
    }

    const bytes = await renderPdfmeV2Document({
      canonicalTemplate: payload.canonicalTemplate,
      renderData: payload.renderData
    });

    return new Response(Buffer.from(bytes), {
      status: 200,
      headers: {
        ...PDFME_V2_PREVIEW_RESPONSE_HEADERS,
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="pdfme-v2-preview.pdf"',
        'Content-Length': String(bytes.byteLength)
      }
    });
  } catch (error) {
    if (error instanceof PdfmeV2PreviewRequestError) {
      return errorResponse(error.message, error.status);
    }
    if (error instanceof PdfmeV2ValidationError) {
      return errorResponse(
        'Predloga ali podatki dokumenta za predogled PDF niso veljavni.',
        400
      );
    }
    if (
      error instanceof PdfmeV2RenderError
      && error.code === 'document-type-mismatch'
    ) {
      return errorResponse(
        'Vrsti predloge in podatkov dokumenta se ne ujemata.',
        400
      );
    }

    console.error('Failed to render pdfme v2 preview', error);
    return errorResponse('Predogleda PDF ni bilo mogoče ustvariti.', 500);
  }
}
