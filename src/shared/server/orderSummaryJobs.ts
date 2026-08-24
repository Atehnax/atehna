import 'server-only';

import { createHash, randomUUID } from 'node:crypto';
import { after } from 'next/server';
import type { Pool, PoolClient } from 'pg';
import {
  buildOrderDocumentBlobPath,
  deletePrivateOrderDocumentBlob,
  uploadPrivateOrderDocumentBlob
} from '@/shared/server/blob';
import { formatStructuredOrderAddress } from '@/shared/domain/order/orderAddress';
import { generateOrderPdf } from '@/shared/server/pdf';
import { revalidateAdminOrderPaths } from '@/shared/server/revalidateAdminOrders';

const DOCUMENT_TYPE = 'order_summary';
const STALE_CLAIM_INTERVAL = '5 minutes';

export type InitialOrderSummaryJobPayload = {
  orderId: number;
  orderNumber: string;
  createdAt: string;
  commitmentStatus: 'binding' | 'pending_confirmation';
  customer: {
    customerType: 'individual' | 'company' | 'school';
    organizationName: string | null;
    contactName: string;
    email: string;
    addressLine1: string;
    addressLine2: string | null;
    postalCode: string;
    city: string;
    countryCode: string;
    reference: string | null;
    notes: string | null;
  };
  items: Array<{
    sku: string;
    productName: string;
    variantName: string;
    unit: string | null;
    quantity: number;
    unitNet: number;
  }>;
  totals: {
    net: number;
    tax: number;
    shipping: number;
    gross: number;
  };
};

type ClaimedJob = {
  id: number;
  claimId: string;
  payload: InitialOrderSummaryJobPayload;
};

export type OrderSummaryJobResult =
  | 'completed'
  | 'deferred'
  | 'missing'
  | 'failed';

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

export async function enqueueInitialOrderSummaryJob(
  client: PoolClient,
  payload: InitialOrderSummaryJobPayload
): Promise<void> {
  await client.query(
    `
      insert into order_document_jobs (
        order_id,
        document_type,
        payload_json
      )
      values ($1, $2, $3::jsonb)
      on conflict (order_id, document_type) do nothing
    `,
    [payload.orderId, DOCUMENT_TYPE, JSON.stringify(payload)]
  );
}

async function claimInitialOrderSummaryJob(
  pool: Pool,
  orderId: number
): Promise<ClaimedJob | OrderSummaryJobResult> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await client.query(
      `
        select
          id,
          payload_json,
          status,
          (
            (status = 'pending' and next_attempt_at <= now())
            or (
              status = 'processing'
              and locked_at <= now() - $2::interval
            )
          ) as claimable
        from order_document_jobs
        where order_id = $1
          and document_type = 'order_summary'
        for update
      `,
      [orderId, STALE_CLAIM_INTERVAL]
    );
    const row = result.rows[0] as
      | {
          id: string | number;
          payload_json: InitialOrderSummaryJobPayload;
          status: string;
          claimable: boolean;
        }
      | undefined;
    if (!row) {
      await client.query('commit');
      return 'missing';
    }
    if (row.status === 'completed') {
      await client.query('commit');
      return 'completed';
    }

    const documentResult = await client.query(
      `
        select 1
        from order_documents
        where order_id = $1
          and type = 'order_summary'
          and deleted_at is null
        limit 1
      `,
      [orderId]
    );
    if ((documentResult.rowCount ?? 0) > 0) {
      await client.query(
        `
          update order_document_jobs
          set status = 'completed',
              claim_id = null,
              locked_at = null,
              last_error = null,
              completed_at = coalesce(completed_at, now()),
              updated_at = now()
          where id = $1
        `,
        [row.id]
      );
      await client.query('commit');
      return 'completed';
    }

    if (!row.claimable) {
      await client.query('commit');
      return 'deferred';
    }

    const claimId = randomUUID();
    await client.query(
      `
        update order_document_jobs
        set status = 'processing',
            attempts = attempts + 1,
            claim_id = $2,
            locked_at = now(),
            updated_at = now()
        where id = $1
      `,
      [row.id, claimId]
    );
    await client.query('commit');
    return {
      id: Number(row.id),
      claimId,
      payload: row.payload_json
    };
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function markJobForRetry(
  pool: Pool,
  job: ClaimedJob,
  error: unknown
): Promise<void> {
  await pool.query(
    `
      update order_document_jobs
      set status = 'pending',
          claim_id = null,
          locked_at = null,
          next_attempt_at = now() + (
            least(300, 5 * power(2, least(attempts, 6))) * interval '1 second'
          ),
          last_error = left($3, 2000),
          updated_at = now()
      where id = $1
        and claim_id = $2
    `,
    [job.id, job.claimId, messageFromError(error)]
  );
}

async function markJobCompleted(
  client: PoolClient,
  jobId: number,
  lastError: string | null = null
): Promise<void> {
  await client.query(
    `
      update order_document_jobs
      set status = 'completed',
          claim_id = null,
          locked_at = null,
          last_error = $2,
          completed_at = coalesce(completed_at, now()),
          updated_at = now()
      where id = $1
    `,
    [jobId, lastError]
  );
}

export async function processInitialOrderSummaryJob(
  pool: Pool,
  orderId: number
): Promise<OrderSummaryJobResult> {
  const claimed = await claimInitialOrderSummaryJob(pool, orderId);
  if (typeof claimed === 'string') return claimed;

  let uploadedPath: string | null = null;
  try {
    const { payload } = claimed;
    const pdfBuffer = await generateOrderPdf(
      'Povzetek naročila',
      {
        orderNumber: payload.orderNumber,
        customerType: payload.customer.customerType,
        organizationName: payload.customer.organizationName,
        contactName: payload.customer.contactName,
        email: payload.customer.email,
        deliveryAddress: formatStructuredOrderAddress(payload.customer),
        reference: payload.customer.reference,
        notes: payload.customer.notes,
        createdAt: new Date(payload.createdAt),
        subtotal: payload.totals.net,
        tax: payload.totals.tax,
        shipping: payload.totals.shipping,
        commitmentStatus: payload.commitmentStatus,
        total: payload.totals.gross
      },
      payload.items.map((item) => ({
        sku: item.sku,
        name: `${item.productName} – ${item.variantName}`,
        unit: item.unit,
        quantity: item.quantity,
        unitPrice: item.unitNet
      }))
    );
    const buffer = Buffer.from(pdfBuffer);
    const contentHash = sha256(buffer);
    const documentAccessId = randomUUID();
    const fileName = `order-summary-${randomUUID()}.pdf`;
    const requestedPath = buildOrderDocumentBlobPath(documentAccessId, 'pdf');
    const blob = await uploadPrivateOrderDocumentBlob(
      requestedPath,
      buffer,
      'application/pdf'
    );
    uploadedPath = blob.pathname;

    const client = await pool.connect();
    let keepUploadedBlob = false;
    try {
      await client.query('begin');
      const orderResult = await client.query(
        'select deleted_at from orders where id = $1 for update',
        [orderId]
      );
      const order = orderResult.rows[0] as { deleted_at: string | null } | undefined;
      if (!order || order.deleted_at) {
        await markJobCompleted(client, claimed.id, 'Order unavailable; summary skipped.');
        await client.query('commit');
        return 'completed';
      }

      const existingResult = await client.query(
        `
          select 1
          from order_documents
          where order_id = $1
            and type = 'order_summary'
            and deleted_at is null
          order by version_number asc, id asc
          limit 1
        `,
        [orderId]
      );
      if ((existingResult.rowCount ?? 0) > 0) {
        await markJobCompleted(client, claimed.id);
        await client.query('commit');
        return 'completed';
      }

      const versionResult = await client.query(
        `
          select coalesce(max(version_number), 0)::integer + 1 as next_version
          from order_documents
          where order_id = $1
            and type = 'order_summary'
        `,
        [orderId]
      );
      const version = Number(versionResult.rows[0]?.next_version ?? 1);
      const documentNumber = `POVZETEK-${orderId}-V${version}`;

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
            $1, $2, 'order_summary', $3, $4, $5, $6, now(), $7,
            'operational', 'atehna-order-summary-pdf-v2'
          )
        `,
        [
          orderId,
          documentAccessId,
          fileName,
          blob.pathname,
          version,
          documentNumber,
          contentHash
        ]
      );
      await markJobCompleted(client, claimed.id);
      await client.query('commit');
      keepUploadedBlob = true;
      return 'completed';
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      client.release();
      if (!keepUploadedBlob && uploadedPath) {
        await deletePrivateOrderDocumentBlob(uploadedPath).catch(() => undefined);
        uploadedPath = null;
      }
    }
  } catch (error) {
    if (uploadedPath) {
      await deletePrivateOrderDocumentBlob(uploadedPath).catch(() => undefined);
    }
    await markJobForRetry(pool, claimed, error).catch((retryError) => {
      console.error('[orders.summary-job] retry persistence failed', {
        orderId,
        message: messageFromError(retryError)
      });
    });
    console.error('[orders.summary-job] processing failed', {
      orderId,
      message: messageFromError(error)
    });
    return 'failed';
  }
}

function safelyRevalidateAdminOrderPaths(orderId: number): void {
  try {
    revalidateAdminOrderPaths(orderId);
  } catch (error) {
    console.error('[orders.summary-job] admin order revalidation failed', {
      orderId,
      message: messageFromError(error)
    });
  }
}

export function scheduleInitialOrderSummaryJob(pool: Pool, orderId: number): void {
  try {
    after(async () => {
      const result = await processInitialOrderSummaryJob(pool, orderId);
      if (result === 'completed') safelyRevalidateAdminOrderPaths(orderId);
    });
  } catch (error) {
    console.error('[orders.summary-job] scheduling failed', {
      orderId,
      message: messageFromError(error)
    });
  }
}
