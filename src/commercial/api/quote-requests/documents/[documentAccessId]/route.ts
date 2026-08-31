import { NextRequest, NextResponse } from 'next/server';
import { readPrivateOrderDocumentBlob } from '@/shared/server/blob';
import { getPool } from '@/shared/server/db';
import { verifyQuoteAccessSession } from '@/shared/server/quoteAccess';

export const runtime = 'nodejs';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const headers = {
  'Cache-Control': 'no-store, private',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff'
};

function notFound() {
  return NextResponse.json(
    { code: 'DOCUMENT_NOT_FOUND', message: 'Dokument ni na voljo.' },
    { status: 404, headers }
  );
}

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ documentAccessId: string }> }
) {
  try {
    const { documentAccessId: rawId } = await props.params;
    const documentAccessId = rawId.trim().toLowerCase();
    if (!UUID_PATTERN.test(documentAccessId)) return notFound();
    const pool = await getPool();
    const access = await verifyQuoteAccessSession(pool, request, {
      scope: 'offer_review'
    });
    if (!access || !access.quoteOfferVersionId) return notFound();
    const result = await pool.query(
      `
        select document.blob_pathname, document.filename
        from quote_documents document
        join quote_offer_versions offer
          on offer.id = document.quote_offer_version_id
        where document.customer_access_id = $1
          and document.quote_offer_version_id = $2
          and offer.quote_request_id = $3
          and document.document_type = 'offer'
        limit 1
      `,
      [
        documentAccessId,
        access.quoteOfferVersionId,
        access.quoteRequestId
      ]
    );
    const document = result.rows[0];
    if (!document) return notFound();
    const blob = await readPrivateOrderDocumentBlob(String(document.blob_pathname));
    if (
      !blob ||
      blob.size < 1 ||
      blob.size > 20 * 1024 * 1024 ||
      blob.contentType.split(';', 1)[0].trim().toLowerCase() !== 'application/pdf'
    ) {
      return notFound();
    }
    const filename = String(document.filename)
      .replace(/["\r\n\\/]/gu, '-')
      .slice(0, 180);
    return new NextResponse(blob.stream, {
      headers: {
        ...headers,
        'Content-Type': 'application/pdf',
        'Content-Length': String(blob.size),
        'Content-Disposition': `inline; filename="${filename || 'ponudba.pdf'}"`
      }
    });
  } catch (error) {
    console.error('[quote.documents] failed', {
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      { code: 'DOCUMENT_DOWNLOAD_FAILED', message: 'Dokumenta trenutno ni mogoče odpreti.' },
      { status: 500, headers }
    );
  }
}
