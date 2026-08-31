import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/shared/server/db';
import { verifyOrderAccessSessionForOrder } from '@/shared/server/orderAccess';
import { readPrivateOrderDocumentBlob } from '@/shared/server/blob';

export const runtime = 'nodejs';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
const PRIVATE_HEADERS = {
  'Cache-Control': 'no-store, private',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff'
};

const DOWNLOAD_NAME_BY_TYPE: Record<string, string> = {
  order_summary: 'potrditev-narocila',
  purchase_order: 'narocilnica',
  dobavnica: 'dobavnica',
  predracun: 'predracun',
  invoice: 'racun'
};

function notFoundResponse() {
  return NextResponse.json(
    {
      code: 'DOCUMENT_NOT_FOUND',
      message: 'Dokument ne obstaja ali ni več na voljo.'
    },
    { status: 404, headers: PRIVATE_HEADERS }
  );
}

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ documentAccessId: string }> }
) {
  try {
    const { documentAccessId: rawDocumentAccessId } = await props.params;
    const documentAccessId = rawDocumentAccessId.trim().toLowerCase();
    if (!UUID_PATTERN.test(documentAccessId)) return notFoundResponse();

    const pool = await getPool();
    const documentResult = await pool.query(
      `
        select d.order_id, d.type, d.blob_pathname
        from order_documents d
        join orders o on o.id = d.order_id
        where d.customer_access_id = $1
          and d.deleted_at is null
          and o.deleted_at is null
          and d.order_pricing_revision = o.pricing_revision
        limit 1
      `,
      [documentAccessId]
    );
    const document = documentResult.rows[0] as
      | { order_id: string | number; type: string; blob_pathname: string }
      | undefined;
    if (!document) return notFoundResponse();

    const orderId = Number(document.order_id);
    const access = await verifyOrderAccessSessionForOrder(
      pool,
      request,
      'confirmation',
      orderId
    );
    if (!access) return notFoundResponse();

    const blob = await readPrivateOrderDocumentBlob(document.blob_pathname);
    if (!blob) return notFoundResponse();
    if (blob.size <= 0 || blob.size > MAX_DOCUMENT_BYTES) {
      throw new Error('Order document has an invalid size.');
    }

    const normalizedContentType = blob.contentType.split(';', 1)[0].trim().toLowerCase();
    const isPdf = normalizedContentType === 'application/pdf';
    const isJpeg = normalizedContentType === 'image/jpeg';
    if (!isPdf && !isJpeg) {
      throw new Error('Order document has an unsupported content type.');
    }

    const extension = isPdf ? 'pdf' : 'jpg';
    const contentType = isPdf ? 'application/pdf' : 'image/jpeg';
    const downloadBaseName = DOWNLOAD_NAME_BY_TYPE[document.type] ?? 'dokument';

    return new NextResponse(blob.stream, {
      status: 200,
      headers: {
        ...PRIVATE_HEADERS,
        'Content-Type': contentType,
        'Content-Length': String(blob.size),
        'Content-Disposition': `inline; filename="${downloadBaseName}.${extension}"`
      }
    });
  } catch (error) {
    console.error('[orders.documents.download] failed', {
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      {
        code: 'DOCUMENT_DOWNLOAD_FAILED',
        message: 'Dokumenta trenutno ni mogoče odpreti.'
      },
      { status: 500, headers: PRIVATE_HEADERS }
    );
  }
}
