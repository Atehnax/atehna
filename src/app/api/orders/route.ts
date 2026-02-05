export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db';
import { uploadBlob } from '@/lib/server/blob';
import { generateOrderPdf } from '@/lib/server/pdf';

const TAX_RATE = 0.22;
const DEBUG_RESPONSE = process.env.VERCEL_ENV !== 'production';

type NormalizedItem = {
  sku: string;
  name: string;
  unit: string | null;
  quantity: number;
  unitPrice: number | null;
};

function normalizeItems(itemsInput: unknown): { items: NormalizedItem[]; error?: string } {
  if (!Array.isArray(itemsInput) || itemsInput.length === 0) {
    return { items: [], error: 'Naročilo mora vsebovati vsaj en izdelek.' };
  }

  const normalizedItems = itemsInput.map((item) => {
    const itemRecord = (item ?? {}) as Record<string, unknown>;
    const parsedQuantity = Number(itemRecord.quantity ?? 0);
    const parsedUnitPriceRaw = itemRecord.unitPrice;
    const parsedUnitPrice =
      parsedUnitPriceRaw === null || parsedUnitPriceRaw === undefined || parsedUnitPriceRaw === ''
        ? null
        : Number(parsedUnitPriceRaw);

    return {
      sku: String(itemRecord.sku ?? '').trim(),
      name: String(itemRecord.name ?? '').trim(),
      unit: itemRecord.unit ? String(itemRecord.unit).trim() : null,
      quantity: Number.isFinite(parsedQuantity) ? parsedQuantity : 0,
      unitPrice:
        parsedUnitPrice === null
          ? null
          : Number.isFinite(parsedUnitPrice)
            ? parsedUnitPrice
            : null
    } satisfies NormalizedItem;
  });

  const hasInvalidItem = normalizedItems.some(
    (item) =>
      !item.sku ||
      !item.name ||
      !Number.isFinite(item.quantity) ||
      item.quantity <= 0 ||
      (item.unitPrice !== null && (!Number.isFinite(item.unitPrice) || item.unitPrice < 0))
  );

  if (hasInvalidItem) {
    return { items: [], error: 'Podatki o izdelkih niso veljavni.' };
  }

  return { items: normalizedItems };
}

function ensureFunction(value: unknown, name: string) {
  if (typeof value !== 'function') {
    throw new Error(`${name} is not a function`);
  }
}

export async function POST(request: Request) {
  let debugStep = 'start';

  try {
    debugStep = 'parse:json';
    const body = (await request.json()) as Record<string, unknown>;

    debugStep = 'parse:fields';
    const customerType = String(body.customerType ?? '').trim();
    const organizationName = body.organizationName ? String(body.organizationName).trim() : null;
    const deliveryAddress = body.deliveryAddress ? String(body.deliveryAddress).trim() : null;
    const contactName = String(body.contactName ?? '').trim();
    const email = String(body.email ?? '').trim();
    const phone = body.phone ? String(body.phone).trim() : null;
    const reference = body.reference ? String(body.reference).trim() : null;
    const notes = body.notes ? String(body.notes).trim() : null;

    if (!customerType || !contactName || !email) {
      return NextResponse.json({ message: 'Manjkajo obvezni podatki.' }, { status: 400 });
    }

    debugStep = 'validate:items';
    const normalizedItemsResult = normalizeItems(body.items);
    if (normalizedItemsResult.error) {
      return NextResponse.json({ message: normalizedItemsResult.error }, { status: 400 });
    }
    const normalizedItems = normalizedItemsResult.items;

    debugStep = 'compute:totals';
    const subtotal = normalizedItems.reduce((sum, item) => sum + (item.unitPrice ?? 0) * item.quantity, 0);
    const tax = subtotal > 0 ? subtotal * TAX_RATE : 0;
    const total = subtotal + tax;

    debugStep = 'check:imports';
    ensureFunction(getPool, 'getPool');
    ensureFunction(generateOrderPdf, 'generateOrderPdf');
    ensureFunction(uploadBlob, 'uploadBlob');

    debugStep = 'db:getPool';
    const pool = await getPool();
    if (!pool || typeof pool.connect !== 'function') {
      throw new Error('Database pool is not available.');
    }

    debugStep = 'db:connect';
    const client = await pool.connect();

    try {
      debugStep = 'tx:begin';
      await client.query('begin');

      debugStep = 'db:insert_order';
      const insertOrderQuery = `
        with next_id as (
          select nextval('orders_id_seq') as id
        )
        insert into orders (
          id,
          order_number,
          customer_type,
          organization_name,
          contact_name,
          email,
          phone,
          delivery_address,
          reference,
          notes,
          subtotal,
          tax,
          total
        )
        select
          id,
          'ORD-' || id,
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11
        from next_id
        returning id, order_number, created_at
      `;

      const orderResult = await client.query(insertOrderQuery, [
        customerType,
        organizationName,
        contactName,
        email,
        phone,
        deliveryAddress,
        reference,
        notes,
        subtotal,
        tax,
        total
      ]);

      const order = orderResult?.rows?.[0] as
        | { id: number; order_number: string; created_at: string | Date }
        | undefined;

      if (!order?.id || !order?.order_number) {
        throw new Error('Naročilo ni bilo ustvarjeno.');
      }

      debugStep = 'db:insert_items';
      const insertItemQuery = `
        insert into order_items (order_id, sku, name, unit, quantity, unit_price, total_price)
        values ($1, $2, $3, $4, $5, $6, $7)
      `;

      for (const item of normalizedItems) {
        const totalPrice = item.unitPrice === null ? null : item.unitPrice * item.quantity;
        await client.query(insertItemQuery, [
          order.id,
          item.sku,
          item.name,
          item.unit,
          item.quantity,
          item.unitPrice,
          totalPrice
        ]);
      }

      const documentType = customerType === 'school' ? 'order_summary' : 'predracun';

      debugStep = 'pdf:generate';
      const pdfBuffer = await generateOrderPdf(
        documentType === 'order_summary' ? 'Ponudba' : 'Predračun',
        {
          orderNumber: order.order_number,
          customerType,
          organizationName,
          contactName,
          email,
          phone,
          deliveryAddress,
          reference,
          notes,
          createdAt: new Date(order.created_at),
          subtotal,
          tax,
          total
        },
        normalizedItems
      );

      if (!pdfBuffer || pdfBuffer.length === 0) {
        throw new Error('PDF generation failed.');
      }

      debugStep = 'blob:upload';
      const fileName = `${order.order_number}-${documentType}.pdf`;
      const blobPath = `orders/${order.order_number}/${fileName}`;
      const blob = await uploadBlob(blobPath, pdfBuffer, 'application/pdf');

      if (!blob?.url) {
        throw new Error('Blob upload failed.');
      }

      debugStep = 'db:insert_document';
      try {
        await client.query(
          `
          insert into order_documents (order_id, type, filename, blob_url, blob_pathname)
          values ($1, $2, $3, $4, $5)
          `,
          [order.id, documentType, fileName, blob.url, blob.pathname]
        );
      } catch (insertDocumentError) {
        const postgresError = insertDocumentError as { code?: string };
        if (postgresError.code === '42703') {
          await client.query(
            `
            insert into order_documents (order_id, type, filename, blob_url)
            values ($1, $2, $3, $4)
            `,
            [order.id, documentType, fileName, blob.url]
          );
        } else {
          throw insertDocumentError;
        }
      }

      debugStep = 'tx:commit';
      await client.query('commit');

      return NextResponse.json({
        orderId: order.id,
        orderNumber: order.order_number,
        documentUrl: blob.url,
        documentType
      });
    } catch (transactionError) {
      try {
        await client.query('rollback');
      } catch {
        // ignore rollback failure, preserve original error
      }
      throw transactionError;
    } finally {
      client.release();
    }
  } catch (error) {
    const typedError = error as { message?: string; stack?: string; name?: string };

    if (DEBUG_RESPONSE) {
      return NextResponse.json(
        {
          message: typedError?.message ?? 'Napaka na strežniku.',
          debugStep,
          importTypes: {
            getPool: typeof getPool,
            generateOrderPdf: typeof generateOrderPdf,
            uploadBlob: typeof uploadBlob
          },
          stack: typedError?.stack ?? null
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Napaka na strežniku.' }, { status: 500 });
  }
}
