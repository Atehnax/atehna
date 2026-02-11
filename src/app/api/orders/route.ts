import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db';
import { uploadBlob } from '@/lib/server/blob';
import { generateOrderPdf } from '@/lib/server/pdf';

export const runtime = 'nodejs';

const TAX_RATE = 0.22;
const SHIPPING_DEFAULT = 0;
const ALLOWED_CUSTOMER_TYPES = new Set(['individual', 'company', 'school'] as const);

type CustomerType = 'individual' | 'company' | 'school';

type PricedOrderItem = {
  sku: string;
  name: string;
  unit: string | null;
  quantity: number;
  unitPrice: number;
};

type OrderPayload = {
  customerType?: unknown;
  organizationName?: unknown;
  deliveryAddress?: unknown;
  contactName?: unknown;
  email?: unknown;
  phone?: unknown;
  reference?: unknown;
  notes?: unknown;
  items?: unknown;
};

const toTrimmedText = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : String(value ?? '').trim();

const toNullableText = (value: string): string | null => (value ? value : null);

const parsePricedItem = (rawValue: unknown): PricedOrderItem | null => {
  if (!rawValue || typeof rawValue !== 'object') return null;

  const rawItem = rawValue as Record<string, unknown>;

  const sku = toTrimmedText(rawItem.sku);
  const name = toTrimmedText(rawItem.name);
  const unit = toNullableText(toTrimmedText(rawItem.unit));
  const quantity = Number(rawItem.quantity);
  const unitPrice = Number(rawItem.unitPrice);

  if (!sku || !name) return null;
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  if (!Number.isFinite(unitPrice)) return null;

  return { sku, name, unit, quantity, unitPrice };
};

const parsePricedItems = (rawItems: unknown): PricedOrderItem[] | null => {
  if (!Array.isArray(rawItems) || rawItems.length === 0) return null;

  const parsedItems: PricedOrderItem[] = [];
  for (const rawItem of rawItems) {
    const parsedItem = parsePricedItem(rawItem);
    if (!parsedItem) return null;
    parsedItems.push(parsedItem);
  }

  return parsedItems;
};

const isMissingColumnError = (error: unknown, columnCode: string): boolean => {
  if (!error || typeof error !== 'object') return false;
  const databaseError = error as { code?: string };
  return databaseError.code === columnCode;
};

export async function POST(request: Request) {
  try {
    let payload: OrderPayload;
    try {
      payload = (await request.json()) as OrderPayload;
    } catch {
      return NextResponse.json({ message: 'Neveljaven JSON.' }, { status: 400 });
    }

    const customerTypeText = toTrimmedText(payload.customerType);
    const customerType = customerTypeText as CustomerType;

    const organizationName = toTrimmedText(payload.organizationName);
    const deliveryAddress = toTrimmedText(payload.deliveryAddress);
    const contactName = toTrimmedText(payload.contactName);
    const email = toTrimmedText(payload.email);
    const phone = toTrimmedText(payload.phone);
    const reference = toTrimmedText(payload.reference);
    const notes = toTrimmedText(payload.notes);

    if (!ALLOWED_CUSTOMER_TYPES.has(customerType)) {
      return NextResponse.json({ message: 'Neveljaven tip naročnika.' }, { status: 400 });
    }

    if (!contactName || !email) {
      return NextResponse.json({ message: 'Manjkajo obvezni podatki.' }, { status: 400 });
    }

    const pricedItems = parsePricedItems(payload.items);
    if (!pricedItems) {
      return NextResponse.json(
        { message: 'Podatki o izdelkih niso veljavni (SKU, naziv, količina in cena).' },
        { status: 400 }
      );
    }

    // vat-inclusive model
    const subtotal = pricedItems.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );
    const shipping = SHIPPING_DEFAULT;
    const total = subtotal + shipping;
    const tax = total - total / (1 + TAX_RATE);

    const pool = await getPool();
    const databaseClient = await pool.connect();

    try {
      await databaseClient.query('begin');

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
          '#' || id,
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

      const orderResult = await databaseClient.query(insertOrderQuery, [
        customerType,
        toNullableText(organizationName),
        contactName,
        email,
        toNullableText(phone),
        toNullableText(deliveryAddress),
        toNullableText(reference),
        toNullableText(notes),
        subtotal,
        tax,
        total
      ]);

      const orderRow = orderResult.rows[0] as
        | { id: number; order_number: string; created_at: string }
        | undefined;

      if (!orderRow) {
        throw new Error('Naročilo ni bilo ustvarjeno.');
      }

      const insertItemQuery = `
        insert into order_items (order_id, sku, name, unit, quantity, unit_price, total_price)
        values ($1, $2, $3, $4, $5, $6, $7)
      `;

      for (const item of pricedItems) {
        const totalPrice = item.unitPrice * item.quantity;

        await databaseClient.query(insertItemQuery, [
          orderRow.id,
          item.sku,
          item.name,
          item.unit,
          item.quantity,
          item.unitPrice,
          totalPrice
        ]);
      }

      const documentType = 'order_summary';
      const documentTitle = 'Povzetek';

      const pdfBuffer = await generateOrderPdf(
        documentTitle,
        {
          orderNumber: orderRow.order_number,
          customerType,
          organizationName: toNullableText(organizationName),
          contactName,
          email,
          phone: toNullableText(phone),
          deliveryAddress: toNullableText(deliveryAddress),
          reference: toNullableText(reference),
          notes: toNullableText(notes),
          createdAt: new Date(orderRow.created_at),
          subtotal,
          tax,
          total
        },
        pricedItems
      );

      const fileName = `${orderRow.order_number}-${documentType}.pdf`;
      const blobPath = `orders/${orderRow.order_number}/${fileName}`;
      const blob = await uploadBlob(blobPath, Buffer.from(pdfBuffer), 'application/pdf');

      try {
        await databaseClient.query(
          'insert into order_documents (order_id, type, filename, blob_url, blob_pathname) values ($1, $2, $3, $4, $5)',
          [orderRow.id, documentType, fileName, blob.url, blob.pathname]
        );
      } catch (error) {
        if (!isMissingColumnError(error, '42703')) throw error;

        await databaseClient.query(
          'insert into order_documents (order_id, type, filename, blob_url) values ($1, $2, $3, $4)',
          [orderRow.id, documentType, fileName, blob.url]
        );
      }

      await databaseClient.query('commit');

      return NextResponse.json({
        orderId: orderRow.id,
        orderNumber: orderRow.order_number,
        documentUrl: blob.url,
        documentType
      });
    } catch (error) {
      await databaseClient.query('rollback');
      throw error;
    } finally {
      databaseClient.release();
    }
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka na strežniku.' },
      { status: 500 }
    );
  }
}
