import { createHash, randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  SCHOOL_PURCHASE_ORDER_UPLOAD_CLOSED,
  schoolPurchaseOrderUploadBlock,
  type SchoolOrderWorkflowBlock
} from '@/shared/domain/order/schoolOrderWorkflow';
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
import { validateLockedOrderShippingReadiness } from '@/shared/server/orderShippingReadiness';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const QUOTE_PURCHASE_ORDER_WORKFLOW_REQUIRED = {
  code: 'QUOTE_PURCHASE_ORDER_WORKFLOW_REQUIRED',
  message:
    'Naročilnico za ponudbo je mogoče oddati samo prek varnega postopka ponudbe.'
} as const;

type UploadFormat = {
  extension: 'pdf' | 'jpg';
  contentType: 'application/pdf' | 'image/jpeg';
  formatMarker: 'customer-upload-pdf-v1' | 'customer-upload-jpeg-v1';
};

class PurchaseOrderWorkflowConflict extends Error {
  constructor(
    readonly block:
      | SchoolOrderWorkflowBlock
      | typeof QUOTE_PURCHASE_ORDER_WORKFLOW_REQUIRED
  ) {
    super(block.message);
    this.name = 'PurchaseOrderWorkflowConflict';
  }
}

class PurchaseOrderShippingConflict extends Error {
  readonly code = 'PURCHASE_ORDER_SHIPPING_NOT_READY';
}

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
        select id, customer_type, status, commitment_status, contract_status, deleted_at,
               source_quote_offer_version_id
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
          commitment_status: string | null;
          contract_status: string | null;
          deleted_at: string | null;
          source_quote_offer_version_id: string | number | null;
        }
      | undefined;

    if (!order || order.deleted_at) {
      return accessDeniedResponse();
    }
    if (order.source_quote_offer_version_id !== null) {
      return NextResponse.json(QUOTE_PURCHASE_ORDER_WORKFLOW_REQUIRED, {
        status: 409
      });
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
    const initialUploadBlock = schoolPurchaseOrderUploadBlock(
      order.customer_type,
      order.status,
      order.contract_status,
      false
    );
    if (initialUploadBlock) {
      return NextResponse.json(initialUploadBlock, { status: 409 });
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
      const lockedOrderResult = await client.query(
        `
          select
            id,
            customer_type,
            status,
            commitment_status,
            contract_status,
            source_quote_offer_version_id,
            deleted_at,
            is_draft,
            subtotal,
            tax,
            shipping,
            automatic_shipping,
            shipping_snapshot_json,
            shipping_override_json,
            shipping_override_stale,
            parcel_count,
            total
          from orders
          where id = $1
          for update
        `,
        [orderId]
      );
      const lockedOrder = lockedOrderResult.rows[0] as
        | {
            id: string | number;
            customer_type: string;
            status: string;
            commitment_status: string | null;
            contract_status: string | null;
            source_quote_offer_version_id: string | number | null;
            deleted_at: string | null;
            is_draft: boolean;
            subtotal: unknown;
            tax: unknown;
            shipping: unknown;
            automatic_shipping: unknown;
            shipping_snapshot_json: unknown;
            shipping_override_json: unknown;
            shipping_override_stale: unknown;
            parcel_count: unknown;
            total: unknown;
          }
        | undefined;
      if (
        lockedOrder &&
        lockedOrder.source_quote_offer_version_id !== null
      ) {
        throw new PurchaseOrderWorkflowConflict(
          QUOTE_PURCHASE_ORDER_WORKFLOW_REQUIRED
        );
      }
      const lockedUploadBlock = lockedOrder
        ? schoolPurchaseOrderUploadBlock(
            lockedOrder.customer_type,
            lockedOrder.status,
            lockedOrder.contract_status,
            Boolean(lockedOrder.deleted_at)
          )
        : SCHOOL_PURCHASE_ORDER_UPLOAD_CLOSED;
      if (lockedUploadBlock) {
        throw new PurchaseOrderWorkflowConflict(lockedUploadBlock);
      }
      const shippingReadiness = await validateLockedOrderShippingReadiness(
        client,
        orderId,
        lockedOrder as unknown as Record<string, unknown>
      );
      if (!shippingReadiness.ok) {
        throw new PurchaseOrderShippingConflict(shippingReadiness.message);
      }
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
            order_pricing_revision,
            document_number,
            issued_at,
            content_sha256,
            legal_status,
            format_marker
          )
          values (
            $1, $2, 'purchase_order', $3, $4, $5,
            (select pricing_revision from orders where id = $1), $6, now(), $7,
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
    if (error instanceof PurchaseOrderWorkflowConflict) {
      return NextResponse.json(error.block, { status: 409 });
    }
    if (error instanceof PurchaseOrderShippingConflict) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: 409 }
      );
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
