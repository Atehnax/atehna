import { NextResponse } from 'next/server';
import { getPool } from '@/shared/server/db';
import { readPrivateOrderDocumentBlob } from '@/shared/server/blob';
import { isQuoteAdminEnabled } from '@/shared/server/quoteFeatureFlags';
import {
  hasValidQuoteAdminSession,
  positiveInteger
} from '@/admin/api/quote-requests/quoteAdminRouteUtils';

const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
const PRIVATE_HEADERS = {
  'Cache-Control': 'no-store, private',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff'
};

function notFound() {
  return NextResponse.json(
    { message: 'Dokument ne obstaja.' },
    { status: 404, headers: PRIVATE_HEADERS }
  );
}

export async function GET(
  request: Request,
  props: {
    params: Promise<{ quoteRequestId: string; documentId: string }>;
  }
) {
  if (!isQuoteAdminEnabled()) return notFound();
  if (!hasValidQuoteAdminSession(request)) {
    return NextResponse.json(
      { message: 'Za dostop je potrebna prijava.' },
      { status: 401, headers: PRIVATE_HEADERS }
    );
  }
  const params = await props.params;
  const quoteRequestId = positiveInteger(params.quoteRequestId);
  const documentId = positiveInteger(params.documentId);
  if (!quoteRequestId || !documentId) return notFound();

  try {
    const pool = await getPool();
    const result = await pool.query(
      `
        select located.filename, located.blob_pathname, located.document_type
        from (
          select
            document.id,
            document.filename,
            document.blob_pathname,
            document.document_type,
            offer.quote_request_id
          from quote_documents document
          join quote_offer_versions offer
            on offer.id = document.quote_offer_version_id
          union all
          select
            manual.id,
            manual.filename,
            manual.blob_pathname,
            manual.document_type,
            manual.quote_request_id
          from quote_manual_documents manual
        ) located
        where located.id = $1
          and located.quote_request_id = $2
        limit 1
      `,
      [documentId, quoteRequestId]
    );
    const document = result.rows[0] as
      | {
          filename: string;
          blob_pathname: string;
          document_type: string;
        }
      | undefined;
    if (!document) return notFound();

    const blob = await readPrivateOrderDocumentBlob(document.blob_pathname);
    if (!blob) return notFound();
    if (blob.size <= 0 || blob.size > MAX_DOCUMENT_BYTES) {
      throw new Error('Quote document has an invalid size.');
    }
    const contentType = blob.contentType.split(';', 1)[0].trim().toLowerCase();
    if (contentType !== 'application/pdf' && contentType !== 'image/jpeg') {
      throw new Error('Quote document has an unsupported content type.');
    }
    const extension = contentType === 'application/pdf' ? 'pdf' : 'jpg';
    const safeFilename = document.filename
      .replace(/[^\x20-\x7e]/gu, '_')
      .replace(/["\r\n]/gu, '_')
      .trim()
      || `${document.document_type}.${extension}`;
    return new NextResponse(blob.stream, {
      status: 200,
      headers: {
        ...PRIVATE_HEADERS,
        'Content-Type': contentType,
        'Content-Length': String(blob.size),
        'Content-Disposition': `inline; filename="${safeFilename}"`
      }
    });
  } catch (error) {
    console.error('[quotes.documents.download] failed', {
      quoteRequestId,
      documentId,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      { message: 'Dokumenta trenutno ni mogoče odpreti.' },
      { status: 500, headers: PRIVATE_HEADERS }
    );
  }
}
