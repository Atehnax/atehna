import { createHash, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { buildOrderBlobPath, deleteBlob, uploadBlob } from '@/shared/server/blob';
import { getPool } from '@/shared/server/db';
import { readBearerToken, verifyOrderAccessToken } from '@/shared/server/orderAccess';
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

function normalizeOrderLookupValue(rawValue: string): string {
  return rawValue.trim().replace(/^#+/, '').trim();
}

export async function POST(request: Request, props: { params: Promise<{ orderId: string }> }) {
  const params = await props.params;
  let uploadedPath: string | null = null;

  try {
    const normalizedOrderValue = normalizeOrderLookupValue(params.orderId);
    if (!normalizedOrderValue) {
      return NextResponse.json(
        { code: 'INVALID_ORDER_NUMBER', message: 'Neveljavna številka naročila.' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const accessToken = readBearerToken(request) ?? String(formData.get('accessToken') ?? '').trim();
    if (!accessToken) {
      return NextResponse.json(
        { code: 'ORDER_ACCESS_REQUIRED', message: 'Povezava za nalaganje ni veljavna.' },
        { status: 401 }
      );
    }
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

    const pool = await getPool();
    const orderLookupResult = await pool.query(
      `
        select id, order_number, customer_type, status, deleted_at
        from orders
        where regexp_replace(trim(coalesce(order_number, '')), '^#', '') = $1
           or id::text = $1
        order by id desc
        limit 1
      `,
      [normalizedOrderValue]
    );
    const order = orderLookupResult.rows[0] as
      | {
          id: string | number;
          order_number: string;
          customer_type: string;
          status: string;
          deleted_at: string | null;
        }
      | undefined;

    if (!order || order.deleted_at) {
      return NextResponse.json(
        { code: 'ORDER_NOT_FOUND', message: 'Naročilo ne obstaja.' },
        { status: 404 }
      );
    }

    const orderId = Number(order.id);
    const access = await verifyOrderAccessToken(
      pool,
      accessToken,
      'purchase_order',
      orderId
    );
    if (!access) {
      return NextResponse.json(
        { code: 'ORDER_ACCESS_DENIED', message: 'Povezava je potekla ali je bila preklicana.' },
        { status: 403 }
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
    const fileName = `${orderId}-purchase-order-${randomUUID()}.${detectedFormat.extension}`;
    const blobPath = buildOrderBlobPath(orderId, fileName);
    const blob = await uploadBlob(blobPath, fileBuffer, detectedFormat.contentType);
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
      const insertResult = await client.query(
        `
          insert into order_documents (
            order_id,
            type,
            filename,
            blob_url,
            blob_pathname,
            version_number,
            document_number,
            issued_at,
            content_sha256,
            legal_status,
            format_marker
          )
          values (
            $1, 'purchase_order', $2, $3, $4, $5, $6, now(), $7,
            'operational', $8
          )
          returning id, created_at, issued_at
        `,
        [
          orderId,
          fileName,
          blob.url,
          blob.pathname,
          version,
          documentNumber,
          contentHash,
          detectedFormat.formatMarker
        ]
      );
      await client.query('commit');

      revalidateAdminOrderPaths(orderId);
      return NextResponse.json(
        {
          id: Number(insertResult.rows[0].id),
          url: blob.url,
          filename: fileName,
          createdAt: insertResult.rows[0].created_at,
          issuedAt: insertResult.rows[0].issued_at,
          type: 'purchase_order',
          versionNumber: version,
          documentNumber,
          legalStatus: 'operational',
          formatMarker: detectedFormat.formatMarker
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
    if (uploadedPath) {
      await deleteBlob(uploadedPath).catch(() => undefined);
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
