import { createHash, randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  buildOrderDocumentBlobPath,
  deletePrivateOrderDocumentBlob,
  uploadPrivateOrderDocumentBlob
} from '@/shared/server/blob';
import { getPool } from '@/shared/server/db';
import {
  readOrderAccessSession,
  verifyOrderAccessToken
} from '@/shared/server/orderAccess';
import { revalidateAdminOrderPaths } from '@/shared/server/revalidateAdminOrders';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

type UploadFormat = {
  extension: 'pdf' | 'jpg';
  contentType: 'application/pdf' | 'image/jpeg';
  formatMarker: 'customer-upload-pdf-v1' | 'customer-upload-jpeg-v1';
};

function detectUploadFormat(buffer: Buffer): UploadFormat | null {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-') {
    return {
      extension: 'pdf',
      contentType: 'application/pdf',
      formatMarker: 'customer-upload-pdf-v1'
    };
  }
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return {
      extension: 'jpg',
      contentType: 'image/jpeg',
      formatMarker: 'customer-upload-jpeg-v1'
    };
  }
  return null;
}

function accessDeniedResponse() {
  return NextResponse.json(
    {
      code: 'ORDER_ACCESS_DENIED',
      message: 'Povezava je potekla ali je bila preklicana.'
    },
    {
      status: 403,
      headers: {
        'Cache-Control': 'no-store, private',
        'Referrer-Policy': 'no-referrer'
      }
    }
  );
}

export async function uploadPurchaseOrder(request: NextRequest) {
  let uploadedPath: string | null = null;
  let documentPersisted = false;

  try {
    const session = readOrderAccessSession(request);
    if (!session) {
      return accessDeniedResponse();
    }

    const pool = await getPool();
    const access = await verifyOrderAccessToken(
      pool,
      session.token,
      'purchase_order'
    );
    if (
      !access ||
      access.tokenId.toLowerCase() !== session.accessId
    ) {
      return accessDeniedResponse();
    }

    const orderLookupResult = await pool.query(
      `
        select id, customer_type, status, deleted_at
        from orders
        where id = $1
        limit 1
      `,
      [access.orderId]
    );
    const order = orderLookupResult.rows[0] as
      | {
          id: string | number;
          customer_type: string;
          status: string;
          deleted_at: string | null;
        }
      | undefined;

    if (!order || order.deleted_at) {
      return accessDeniedResponse();
    }

    const orderId = Number(order.id);
    if (access.orderId !== orderId) {
      return accessDeniedResponse();
    }
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json(
        { code: 'FILE_REQUIRED', message: 'Datoteka manjka.' },
        { status: 400 }
      );
    }
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { code: 'INVALID_FILE_SIZE', message: 'Datoteka mora biti manjša od 10 MB.' },
        { status: 400 }
      );
    }
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const detectedFormat = detectUploadFormat(fileBuffer);
    if (!detectedFormat) {
      return NextResponse.json(
        { code: 'INVALID_FILE_TYPE', message: 'Dovoljeni so veljavni PDF ali JPG dokumenti.' },
        { status: 400 }
      );
    }
    if (order.customer_type !== 'school') {
      return NextResponse.json(
        {
          code: 'PURCHASE_ORDER_NOT_SUPPORTED',
          message: 'Naročilnico je mogoče dodati samo naročilu šole ali javnega zavoda.'
        },
        { status: 409 }
      );
    }
    if (order.status === 'cancelled') {
      return NextResponse.json(
        { code: 'ORDER_CANCELLED', message: 'Preklicanemu naročilu ni mogoče dodati naročilnice.' },
        { status: 409 }
      );
    }

    const contentHash = createHash('sha256').update(fileBuffer).digest('hex');
    const documentAccessId = randomUUID();
    const fileName = `purchase-order-${randomUUID()}.${detectedFormat.extension}`;
    const blobPath = buildOrderDocumentBlobPath(
      documentAccessId,
      detectedFormat.extension
    );
    const blob = await uploadPrivateOrderDocumentBlob(blobPath, fileBuffer, detectedFormat.contentType);
    uploadedPath = blob.pathname;

    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query('select id from orders where id = $1 for update', [orderId]);
      const versionResult = await client.query(
        `
          select coalesce(max(version_number), 0)::integer + 1 as next_version
          from order_documents
          where order_id = $1
            and type = 'purchase_order'
        `,
        [orderId]
      );
      const version = Number(versionResult.rows[0]?.next_version ?? 1);
      const documentNumber = `NAROCILNICA-${orderId}-V${version}`;
      await client.query(
        `
          insert into order_documents (
            order_id,
            customer_access_id,
            type,
            filename,
            blob_pathname,
            version_number,
            document_number,
            issued_at,
            content_sha256,
            legal_status,
            format_marker
          )
          values (
            $1, $2, 'purchase_order', $3, $4, $5, $6, now(), $7,
            'operational', $8
          )
        `,
        [
          orderId,
          documentAccessId,
          fileName,
          blob.pathname,
          version,
          documentNumber,
          contentHash,
          detectedFormat.formatMarker
        ]
      );
      await client.query('commit');
      documentPersisted = true;

      try {
        revalidateAdminOrderPaths(orderId);
      } catch (error) {
        console.error('[orders.purchase-order.upload] revalidation failed', {
          orderId,
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      return NextResponse.json(
        {
          type: 'purchase_order',
          url: `/api/orders/documents/${documentAccessId}`
        },
        {
          status: 201,
          headers: { 'Cache-Control': 'no-store' }
        }
      );
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    if (uploadedPath && !documentPersisted) {
      await deletePrivateOrderDocumentBlob(uploadedPath).catch(() => undefined);
    }
    console.error('[orders.purchase-order.upload] failed', {
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      { code: 'PURCHASE_ORDER_UPLOAD_FAILED', message: 'Nalaganje naročilnice ni uspelo.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return uploadPurchaseOrder(request);
}
