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

const PDF_CODE_BY_TYPE: Record<string, string> = {
  order_summary: 'PN',
  purchase_order: 'N',
  dobavnica: 'D',
  predracun: 'P',
  invoice: 'R'
};

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

const toDateStamp = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

const randomSuffix = (length = 30) => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
};

export async function buildGeneratedPdfFileName(pool: Pool, orderId: number, type: string) {
  const documentCode = PDF_CODE_BY_TYPE[type] ?? 'DOC';
  const versionResult = await pool.query(
    'select count(*)::int as count from order_documents where order_id = $1 and type = $2',
    [orderId, type]
  );
  const currentCount = Number(versionResult.rows[0]?.count ?? 0);
  const nextVersion = currentCount + 1;
  const dateStamp = toDateStamp(new Date());
  const suffix = randomSuffix();

  return `${documentCode}-${orderId}-${nextVersion}-${dateStamp}-${suffix}.pdf`;
}

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
      createdAt: order.created_at ? new Date(String(order.created_at)) : new Date(),
      subtotal,
      tax,
      total
    }
  };
}
