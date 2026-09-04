import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/shared/server/db';
import { verifyQuoteAccessSession } from '@/shared/server/quoteAccess';
import { generateQuoteRequestConfirmationPdf } from '@/shared/server/quoteRequestConfirmationPdf';

export const runtime = 'nodejs';

const PRIVATE_HEADERS = {
  'Cache-Control': 'no-store, private',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow, noarchive'
};

function notFoundResponse() {
  return NextResponse.json(
    { code: 'DOCUMENT_NOT_FOUND', message: 'Dokument ni na voljo.' },
    { status: 404, headers: PRIVATE_HEADERS }
  );
}

export async function GET(request: NextRequest) {
  try {
    const pool = await getPool();
    const access = await verifyQuoteAccessSession(pool, request, {
      scope: 'request_confirmation',
      bindToSelectedAccessId: true
    });
    if (!access) return notFoundResponse();

    const document = await generateQuoteRequestConfirmationPdf(
      pool,
      access.quoteRequestId
    );
    if (!document || document.bytes.length === 0) return notFoundResponse();

    return new NextResponse(Buffer.from(document.bytes), {
      status: 200,
      headers: {
        ...PRIVATE_HEADERS,
        'Content-Type': 'application/pdf',
        'Content-Length': String(document.bytes.length),
        'Content-Disposition': `attachment; filename="${document.filename}"`
      }
    });
  } catch (error) {
    console.error('[quote.confirmation.pdf] failed', {
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      {
        code: 'DOCUMENT_DOWNLOAD_FAILED',
        message: 'Dokumenta trenutno ni mogoče pripraviti.'
      },
      { status: 500, headers: PRIVATE_HEADERS }
    );
  }
}
