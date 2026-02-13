import type { Pool } from 'pg';
import type { PdfItem, PdfOrder } from '@/lib/server/pdf';

type RawOrder = Record<string, unknown>;

type BuildPdfContextSuccess = {
  ok: true;
  order: RawOrder;
  orderForPdf: PdfOrder;
  itemsForPdf: PdfItem[];
  orderToken: string;
};

type BuildPdfContextFailure = {
  ok: false;
  status: number;
  message: string;
};

export type BuildPdfContextResult = BuildPdfContextSuccess | BuildPdfContextFailure;

const asString = (value: unknown, fallback = '') => (typeof value === 'string' ? value.trim() : fallback);
const asNullableString = (value: unknown) => (typeof value === 'string' ? value.trim() : null);
const asNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const toOrderToken = (orderNumber: string, orderId: number) => {
  const normalized = orderNumber.trim() || `order-${orderId}`;
  const cleaned = normalized.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return cleaned || `order-${orderId}`;
};

export async function buildPdfContext(pool: Pool, orderId: number): Promise<BuildPdfContextResult> {
  const orderResult = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
  const order = (orderResult.rows[0] ?? null) as RawOrder | null;

  if (!order) {
    return { ok: false, status: 404, message: 'Naročilo ne obstaja.' };
  }

  const contactName = asString(order.contact_name);
  const email = asString(order.email);
  const orderNumber = asString(order.order_number, `#${orderId}`);
  const customerType = asString(order.customer_type, 'company');

  if (!contactName || !email) {
    return {
      ok: false,
      status: 400,
      message:
        'Za generiranje PDF izpolnite vsaj Kontakt in E-pošta v razdelku »Uredi naročilo«, nato kliknite »Shrani spremembe«.'
    };
  }

  const itemsResult = await pool.query(
    'SELECT sku, name, unit, quantity, unit_price as "unitPrice" FROM order_items WHERE order_id = $1 ORDER BY id',
    [orderId]
  );

  const itemsForPdf = (itemsResult.rows as Record<string, unknown>[]).map((row) => ({
    sku: asString(row.sku, '-'),
    name: asString(row.name, 'Artikel'),
    unit: asNullableString(row.unit),
    quantity: Math.max(1, Math.floor(asNumber(row.quantity) || 1)),
    unitPrice: asNumber(row.unitPrice)
  }));

  if (itemsForPdf.length === 0) {
    return {
      ok: false,
      status: 400,
      message: 'Za generiranje PDF dodajte vsaj eno postavko in shranite spremembe.'
    };
  }

  const subtotal = asNumber(order.subtotal);
  const tax = asNumber(order.tax);
  const total = asNumber(order.total);

  return {
    ok: true,
    order,
    itemsForPdf,
    orderToken: toOrderToken(orderNumber, orderId),
    orderForPdf: {
      orderNumber,
      customerType,
      organizationName: asNullableString(order.organization_name),
      contactName,
      email,
      phone: asNullableString(order.phone),
      deliveryAddress: asNullableString(order.delivery_address),
      reference: asNullableString(order.reference),
      notes: asNullableString(order.notes),
      createdAt: new Date(),
      subtotal,
      tax,
      total
    }
  };
}
