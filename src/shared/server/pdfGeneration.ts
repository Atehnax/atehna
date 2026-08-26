import { randomBytes } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { formatOrderRowAddress } from '@/shared/domain/order/orderAddress';
import type { PdfItem, PdfOrder } from '@/shared/server/pdf';

type RawOrder = Record<string, unknown>;

type BuildPdfContextSuccess = {
  ok: true;
  order: RawOrder;
  orderNumber: string;
  orderForPdf: PdfOrder;
  itemsForPdf: PdfItem[];
};

type BuildPdfContextFailure = {
  ok: false;
  status: number;
  message: string;
};

type BuildPdfContextResult = BuildPdfContextSuccess | BuildPdfContextFailure;

const PDF_CODE_BY_TYPE: Record<string, string> = {
  order_summary: 'PN',
  purchase_order: 'N',
  dobavnica: 'D',
  predracun: 'P',
  invoice: 'R'
};

const asString = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value.trim() : fallback;
const asNullableString = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : null;
const asNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const ljubljanaDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Ljubljana',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

const toLjubljanaDateParts = (value: Date) => {
  const parts = ljubljanaDateFormatter.formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? '';
  return {
    year: part('year'),
    month: part('month'),
    day: part('day')
  };
};

const toDateStamp = (value: Date) => {
  const { year, month, day } = toLjubljanaDateParts(value);
  return `${year}${month}${day}`;
};

const randomSuffix = (length = 18) =>
  randomBytes(Math.ceil(length * 0.75))
    .toString('base64url')
    .slice(0, length)
    .toUpperCase();

export function buildGeneratedPdfFileName(type: string, issuedAt = new Date()) {
  const documentCode = PDF_CODE_BY_TYPE[type] ?? 'DOC';
  return `${documentCode}-${toDateStamp(issuedAt)}-${randomSuffix(18)}.pdf`;
}

export function buildOrderDocumentNumber(
  type: string,
  version: number,
  opaqueSeed: string,
  issuedAt = new Date()
) {
  const documentCode = PDF_CODE_BY_TYPE[type] ?? 'DOC';
  const safeSeed = opaqueSeed.replace(/[^a-zA-Z0-9]/gu, '').slice(0, 8).toUpperCase();
  const suffix = safeSeed || randomSuffix(8);
  return `${documentCode}-${toDateStamp(issuedAt)}-${suffix}-V${Math.max(1, Math.floor(version))}`;
}

export async function allocateOrderDocumentNumber(
  client: PoolClient,
  type: string,
  issuedAt = new Date()
) {
  const { year } = toLjubljanaDateParts(issuedAt);
  const yearNumber = Number(year);
  const shortYear = year.slice(-2);
  await client.query('select pg_advisory_xact_lock(hashtext($1))', [
    `order-document-number:${type}:${year}`
  ]);
  const result = await client.query(
    `select document_number
     from order_documents
     where type = $1
       and extract(year from issued_at at time zone 'Europe/Ljubljana') = $2`,
    [type, yearNumber]
  );
  let highest = 0;
  for (const row of result.rows as Array<{ document_number?: unknown }>) {
    if (typeof row.document_number !== 'string') continue;
    const match = row.document_number.trim().match(/^(\d+)\/(\d{2})$/u);
    if (!match || match[2] !== shortYear) continue;
    highest = Math.max(highest, Number(match[1]));
  }
  const next = highest + 1;
  const sequence = type === 'invoice' ? String(next).padStart(3, '0') : String(next);
  return `${sequence}/${shortYear}`;
}

export async function buildPdfContext(pool: Pool, orderId: number): Promise<BuildPdfContextResult> {
  const orderResult = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
  const order = (orderResult.rows[0] ?? null) as RawOrder | null;

  if (!order) return { ok: false, status: 404, message: 'Naročilo ne obstaja.' };

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
    `select
       sku,
       name,
       unit,
       quantity,
       unit_net as "unitPrice",
       line_net as "lineTotal",
       tax_rate as "taxRate",
       discount_pct as "discountPercentage"
     from order_items
     where order_id = $1
     order by id`,
    [orderId]
  );

  const itemsForPdf = (itemsResult.rows as Record<string, unknown>[]).map((row) => ({
    sku: asString(row.sku, '-'),
    name: asString(row.name, 'Artikel'),
    unit: asNullableString(row.unit),
    quantity: Math.max(1, Math.floor(asNumber(row.quantity) || 1)),
    unitPrice: asNumber(row.unitPrice),
    lineTotal: asNumber(row.lineTotal),
    taxRate: asNumber(row.taxRate),
    discountPercentage: asNumber(row.discountPercentage)
  }));

  if (itemsForPdf.length === 0) {
    return {
      ok: false,
      status: 400,
      message: 'Za generiranje PDF dodajte vsaj eno postavko in shranite spremembe.'
    };
  }

  return {
    ok: true,
    order,
    orderNumber,
    itemsForPdf,
    orderForPdf: {
      customerType,
      organizationName: asNullableString(order.organization_name),
      contactName,
      email,
      deliveryAddress: formatOrderRowAddress(order) || null,
      reference: asNullableString(order.reference),
      notes: asNullableString(order.notes),
      createdAt: order.created_at ? new Date(String(order.created_at)) : new Date(),
      subtotal: asNumber(order.subtotal),
      tax: asNumber(order.tax),
      taxRate: asNumber(order.tax_rate),
      shipping: asNumber(order.shipping),
      total: asNumber(order.total),
      commitmentStatus: asNullableString(order.commitment_status)
    }
  };
}
