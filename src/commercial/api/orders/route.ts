import { createHash, randomUUID } from 'node:crypto';
import { after, NextResponse } from 'next/server';
import type { Pool, PoolClient } from 'pg';
import { buildOrderBlobPath, deleteBlob, uploadBlob } from '@/shared/server/blob';
import { getPool } from '@/shared/server/db';
import { getGursAddressById } from '@/shared/server/gursAddresses';
import { isCustomerType, type CustomerType } from '@/shared/domain/order/customerType';
import {
  buildAuthoritativeOrderQuote,
  moneyToDatabaseValue,
  ORDER_DEFAULT_TAX_RATE,
  OrderCommerceError,
  parseOrderSelections,
  type AuthoritativeOrderLine,
  type AuthoritativeOrderQuote,
  type OrderSelection
} from '@/shared/server/orderCommerce';
import {
  buildOrderConfirmationAccessUrl,
  issueOrderAccessToken,
  revokeOrderAccessTokens
} from '@/shared/server/orderAccess';
import { generateOrderPdf } from '@/shared/server/pdf';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';
import { revalidateAdminOrderPaths } from '@/shared/server/revalidateAdminOrders';

export const runtime = 'nodejs';

type NormalizedCustomer = {
  customerType: CustomerType;
  customerName: string;
  organizationName: string | null;
  contactName: string;
  email: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  postalCode: string;
  gursHouseNumberId: string | null;
  countryCode: 'SI';
  deliveryAddress: string;
  reference: string | null;
  notes: string | null;
};

type StoredOrderResponse = {
  orderId: number;
  orderNumber: string;
  status: 'received';
  paymentStatus: 'unpaid';
  commitmentStatus: 'binding' | 'pending_confirmation';
  stockNotCommitted: boolean;
  createdAt: string;
  documentUrl: string | null;
  documentType: 'order_summary';
  items: AuthoritativeOrderLine[];
  totals: AuthoritativeOrderQuote['totals'];
  pricingVersion: AuthoritativeOrderQuote['pricingVersion'];
  customer: NormalizedCustomer;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const POSTAL_CODE_PATTERN = /^\d{4}$/;
const MAX_IDEMPOTENCY_KEY_LENGTH = 200;
const MIN_IDEMPOTENCY_KEY_LENGTH = 8;

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
}

function optionalText(value: unknown): string | null {
  const normalized = text(value);
  return normalized || null;
}

function limited(value: string, maxLength: number, fieldName: string): string {
  if (value.length > maxLength) {
    throw new OrderCommerceError(
      400,
      'FIELD_TOO_LONG',
      `${fieldName} je predolg.`
    );
  }
  return value;
}

function buildDeliveryAddress({
  addressLine1,
  addressLine2,
  postalCode,
  city
}: Pick<
  NormalizedCustomer,
  'addressLine1' | 'addressLine2' | 'postalCode' | 'city'
>): string {
  return [addressLine1, addressLine2, `${postalCode} ${city}`]
    .filter(Boolean)
    .join(', ');
}

function parseLegacyDeliveryAddress(value: unknown): {
  addressLine1: string;
  city: string;
  postalCode: string;
} {
  const normalized = text(value);
  if (!normalized) return { addressLine1: '', city: '', postalCode: '' };

  const segments = normalized.split(',').map((segment) => segment.trim()).filter(Boolean);
  const locality = segments.at(-1)?.match(/^(\d{4})\s+(.+)$/);
  if (!locality) return { addressLine1: normalized, city: '', postalCode: '' };

  return {
    addressLine1: segments.slice(0, -1).join(', '),
    postalCode: locality[1],
    city: locality[2].trim()
  };
}

function normalizeCustomer(body: Record<string, unknown>): NormalizedCustomer {
  const customerTypeValue = text(body.customerType);
  if (!isCustomerType(customerTypeValue)) {
    throw new OrderCommerceError(
      400,
      'INVALID_CUSTOMER_TYPE',
      'Izberite veljaven tip naročnika.'
    );
  }

  const legacyAddress = parseLegacyDeliveryAddress(body.deliveryAddress);
  const addressLine1 = limited(
    text(body.addressLine1) || legacyAddress.addressLine1,
    300,
    'Naslov'
  );
  const city = limited(text(body.city) || legacyAddress.city, 120, 'Kraj');
  const postalCode = limited(
    text(body.postalCode) || legacyAddress.postalCode,
    16,
    'Poštna številka'
  );
  const email = limited(text(body.email), 320, 'Email');
  const organizationName = limited(
    text(body.customerName) || text(body.organizationName),
    240,
    'Naročnik'
  );
  const fallbackIndividualName = [text(body.firstName), text(body.lastName)]
    .filter(Boolean)
    .join(' ');
  const contactName = limited(
    text(body.contactName) || fallbackIndividualName || organizationName,
    240,
    'Kontaktna oseba'
  );
  const customerName =
    customerTypeValue === 'individual'
      ? limited(text(body.customerName) || contactName, 240, 'Naročnik')
      : organizationName;
  const reference = optionalText(body.reference ?? body.purchaseOrderNumber);
  const notes = optionalText(body.notes);
  const addressLine2Value = optionalText(body.addressLine2);
  const gursHouseNumberIdValue =
    typeof body.gursHouseNumberId === 'string'
      ? optionalText(body.gursHouseNumberId)
      : null;

  if (!customerName) {
    throw new OrderCommerceError(400, 'CUSTOMER_NAME_REQUIRED', 'Vnesite naročnika.');
  }
  if (!EMAIL_PATTERN.test(email)) {
    throw new OrderCommerceError(400, 'INVALID_EMAIL', 'Vnesite veljaven email naslov.');
  }
  if (!addressLine1) {
    throw new OrderCommerceError(400, 'ADDRESS_REQUIRED', 'Vnesite ulico in hišno številko.');
  }
  if (!city) {
    throw new OrderCommerceError(400, 'CITY_REQUIRED', 'Vnesite kraj.');
  }
  if (!POSTAL_CODE_PATTERN.test(postalCode)) {
    throw new OrderCommerceError(
      400,
      'INVALID_POSTAL_CODE',
      'Poštna številka mora vsebovati štiri številke.'
    );
  }

  const customer: NormalizedCustomer = {
    customerType: customerTypeValue,
    customerName,
    organizationName: customerTypeValue === 'individual' ? null : customerName,
    contactName,
    email,
    addressLine1,
    addressLine2: addressLine2Value
      ? limited(addressLine2Value, 500, 'Dodatni podatki naslova')
      : null,
    city,
    postalCode,
    gursHouseNumberId: gursHouseNumberIdValue
      ? limited(gursHouseNumberIdValue, 100, 'GURS ID naslova')
      : null,
    countryCode: 'SI',
    deliveryAddress: '',
    reference: reference ? limited(reference, 240, 'Referenca') : null,
    notes: notes ? limited(notes, 4_000, 'Opombe') : null
  };
  customer.deliveryAddress = buildDeliveryAddress(customer);
  return customer;
}

async function canonicalizeGursAddress(
  client: PoolClient,
  customer: NormalizedCustomer
): Promise<NormalizedCustomer> {
  if (!customer.gursHouseNumberId) return customer;

  await client.query('savepoint gurs_address_lookup');
  try {
    const address = await getGursAddressById(
      customer.gursHouseNumberId,
      client
    );
    await client.query('release savepoint gurs_address_lookup');

    if (!address) {
      return { ...customer, gursHouseNumberId: null };
    }

    const canonical = {
      ...customer,
      gursHouseNumberId: address.gursHouseNumberId,
      addressLine1: address.addressLine1,
      postalCode: address.postalCode,
      city: address.postalName
    };
    return {
      ...canonical,
      deliveryAddress: buildDeliveryAddress(canonical)
    };
  } catch (error) {
    await client
      .query('rollback to savepoint gurs_address_lookup')
      .catch(() => undefined);
    await client
      .query('release savepoint gurs_address_lookup')
      .catch(() => undefined);
    console.warn('[orders.create] GURS address lookup failed; using manual address', {
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return { ...customer, gursHouseNumberId: null };
  }
}

function readIdempotencyKey(request: Request, body: Record<string, unknown>): string {
  const key = text(request.headers.get('idempotency-key') ?? body.idempotencyKey);
  if (
    key.length < MIN_IDEMPOTENCY_KEY_LENGTH ||
    key.length > MAX_IDEMPOTENCY_KEY_LENGTH ||
    /[\s\u0000-\u001f\u007f]/.test(key)
  ) {
    throw new OrderCommerceError(
      400,
      'IDEMPOTENCY_KEY_REQUIRED',
      'Zahteva mora vsebovati veljaven Idempotency-Key.'
    );
  }
  return key;
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function requestFingerprint(
  customer: NormalizedCustomer,
  selections: OrderSelection[]
): string {
  return sha256(JSON.stringify({ customer, items: selections }));
}

function confirmationFields(token: string) {
  return {
    confirmationToken: token,
    confirmationUrl: buildOrderConfirmationAccessUrl(token)
  };
}

async function reserveIdempotencyKey(
  client: PoolClient,
  keyHash: string,
  requestHash: string
): Promise<
  | { kind: 'new' }
  | { kind: 'replay'; orderId: number; response: StoredOrderResponse }
> {
  const inserted = await client.query(
    `
      insert into order_idempotency_keys (key_hash, request_hash)
      values ($1, $2)
      on conflict (key_hash) do nothing
      returning id
    `,
    [keyHash, requestHash]
  );
  if (inserted.rowCount === 1) return { kind: 'new' };

  const existing = await client.query(
    `
      select request_hash, order_id, response_json
      from order_idempotency_keys
      where key_hash = $1
    `,
    [keyHash]
  );
  const row = existing.rows[0] as
    | {
        request_hash: string;
        order_id: string | number | null;
        response_json: StoredOrderResponse | null;
      }
    | undefined;

  if (!row || row.request_hash !== requestHash) {
    throw new OrderCommerceError(
      409,
      'IDEMPOTENCY_KEY_CONFLICT',
      'Idempotency-Key je bil že uporabljen za drugo zahtevo.'
    );
  }
  if (!row.order_id || !row.response_json || Object.keys(row.response_json).length === 0) {
    throw new OrderCommerceError(
      409,
      'ORDER_REQUEST_IN_PROGRESS',
      'Naročilo s tem ključem se še obdeluje.'
    );
  }

  return {
    kind: 'replay',
    orderId: Number(row.order_id),
    response: row.response_json
  };
}

async function decrementBindingStock(
  client: PoolClient,
  items: AuthoritativeOrderLine[]
) {
  for (const item of items) {
    const result = await client.query(
      `
        update catalog_item_variants
        set inventory = inventory - $1,
            updated_at = now()
        where id = $2
          and inventory >= $1
        returning id
      `,
      [item.quantity, item.variantId]
    );
    if (result.rowCount !== 1) {
      throw new OrderCommerceError(
        409,
        'STOCK_CHANGED',
        `Zaloga za ${item.productName} – ${item.variantName} se je spremenila.`,
        [
          {
            code: 'STOCK_CHANGED',
            message: 'Ponovno preverite košarico.',
            variantId: item.variantId
          }
        ]
      );
    }
  }
}

async function insertOrder(
  client: PoolClient,
  customer: NormalizedCustomer,
  quote: AuthoritativeOrderQuote
) {
  const commitmentStatus: 'binding' | 'pending_confirmation' =
    customer.customerType === 'school' ? 'pending_confirmation' : 'binding';
  const stockNotCommitted = commitmentStatus === 'pending_confirmation';
  const pricingVersion = stockNotCommitted
    ? `${quote.pricingVersion}-school-uncommitted`
    : `${quote.pricingVersion}-stock-committed`;
  const taxRates = Array.from(new Set(quote.items.map((item) => item.taxRate)));
  const orderTaxRate = taxRates.length === 1 ? taxRates[0] : ORDER_DEFAULT_TAX_RATE;

  if (!stockNotCommitted) {
    await decrementBindingStock(client, quote.items);
  }

  const orderResult = await client.query(
    `
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
        delivery_address,
        address_line1,
        postal_code,
        city,
        gurs_house_number_id,
        address_line2,
        country_code,
        reference,
        notes,
        status,
        payment_status,
        subtotal,
        tax,
        shipping,
        total,
        currency,
        tax_rate,
        pricing_version,
        commitment_status,
        is_draft
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
        $11,
        $12,
        $13,
        'received',
        'unpaid',
        $14,
        $15,
        $16,
        $17,
        'EUR',
        $18,
        $19,
        $20,
        false
      from next_id
      returning id, order_number, created_at
    `,
    [
      customer.customerType,
      customer.organizationName,
      customer.contactName,
      customer.email,
      customer.deliveryAddress,
      customer.addressLine1,
      customer.postalCode,
      customer.city,
      customer.gursHouseNumberId,
      customer.addressLine2,
      customer.countryCode,
      customer.reference,
      customer.notes,
      moneyToDatabaseValue(quote.totals.net),
      moneyToDatabaseValue(quote.totals.tax),
      moneyToDatabaseValue(quote.totals.shipping),
      moneyToDatabaseValue(quote.totals.gross),
      orderTaxRate,
      pricingVersion,
      commitmentStatus
    ]
  );
  const order = orderResult.rows[0] as {
    id: string | number;
    order_number: string;
    created_at: string | Date;
  };
  const orderId = Number(order.id);

  for (const [index, item] of quote.items.entries()) {
    const orderItemResult = await client.query(
      `
        insert into order_items (
          order_id,
          sku,
          name,
          unit,
          quantity,
          unit_price,
          total_price,
          catalog_item_id,
          catalog_variant_id,
          product_slug,
          variant_name,
          category_id,
          category_path,
          selected_attributes,
          image_url,
          base_unit_net,
          discount_pct,
          unit_net,
          unit_tax,
          unit_gross,
          line_net,
          line_tax,
          line_gross,
          tax_rate,
          currency,
          product_snapshot_json
        )
        values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
          $14::jsonb, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24,
          'EUR', $25::jsonb
        )
        returning id
      `,
      [
        orderId,
        item.sku,
        `${item.productName} – ${item.variantName}`,
        item.unit,
        item.quantity,
        moneyToDatabaseValue(item.unitNet),
        moneyToDatabaseValue(item.lineNet),
        item.productId,
        item.variantId,
        item.productSlug,
        item.variantName,
        item.categoryId,
        item.categoryPath,
        JSON.stringify(item.attributes),
        item.imageUrl,
        moneyToDatabaseValue(item.listUnitNet),
        item.discountPct,
        moneyToDatabaseValue(item.unitNet),
        moneyToDatabaseValue(item.unitTax),
        moneyToDatabaseValue(item.unitGross),
        moneyToDatabaseValue(item.lineNet),
        moneyToDatabaseValue(item.lineTax),
        moneyToDatabaseValue(item.lineGross),
        item.taxRate,
        JSON.stringify(item.snapshot)
      ]
    );
    const orderItemId = Number(orderItemResult.rows[0].id);

    await client.query(
      `
        insert into order_line_snapshots (
          order_id,
          order_item_id,
          line_number,
          catalog_item_id,
          catalog_variant_id,
          product_slug,
          product_name,
          variant_name,
          sku,
          unit,
          quantity,
          category_id,
          category_path,
          selected_attributes,
          image_url,
          base_unit_net,
          discount_pct,
          unit_net,
          unit_tax,
          unit_gross,
          line_net,
          line_tax,
          line_gross,
          tax_rate,
          currency,
          snapshot_json
        )
        values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
          $14::jsonb, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24,
          'EUR', $25::jsonb
        )
      `,
      [
        orderId,
        orderItemId,
        index + 1,
        item.productId,
        item.variantId,
        item.productSlug,
        item.productName,
        item.variantName,
        item.sku,
        item.unit,
        item.quantity,
        item.categoryId,
        item.categoryPath,
        JSON.stringify(item.attributes),
        item.imageUrl,
        moneyToDatabaseValue(item.listUnitNet),
        item.discountPct,
        moneyToDatabaseValue(item.unitNet),
        moneyToDatabaseValue(item.unitTax),
        moneyToDatabaseValue(item.unitGross),
        moneyToDatabaseValue(item.lineNet),
        moneyToDatabaseValue(item.lineTax),
        moneyToDatabaseValue(item.lineGross),
        item.taxRate,
        JSON.stringify(item.snapshot)
      ]
    );
  }

  await client.query(
    `
      insert into order_status_logs (order_id, previous_status, new_status)
      values ($1, null, 'received')
    `,
    [orderId]
  );

  return {
    orderId,
    orderNumber: order.order_number,
    createdAt:
      order.created_at instanceof Date
        ? order.created_at.toISOString()
        : String(order.created_at),
    commitmentStatus,
    stockNotCommitted
  };
}

async function createInitialOrderSummary(
  pool: Pool,
  response: StoredOrderResponse,
  keyHash: string
): Promise<StoredOrderResponse> {
  let uploadedPath: string | null = null;
  let documentPersisted = false;
  try {
    const pdfBuffer = await generateOrderPdf(
      'Povzetek naročila',
      {
        orderNumber: response.orderNumber,
        customerType: response.customer.customerType,
        organizationName: response.customer.organizationName,
        contactName: response.customer.contactName,
        email: response.customer.email,
        deliveryAddress: response.customer.deliveryAddress,
        reference: response.customer.reference,
        notes: response.customer.notes,
        createdAt: new Date(response.createdAt),
        subtotal: response.totals.net,
        tax: response.totals.tax,
        shipping: response.totals.shipping,
        commitmentStatus: response.commitmentStatus,
        total: response.totals.gross
      },
      response.items.map((item) => ({
        sku: item.sku,
        name: `${item.productName} – ${item.variantName}`,
        unit: item.unit,
        quantity: item.quantity,
        unitPrice: item.unitNet
      }))
    );
    const buffer = Buffer.from(pdfBuffer);
    const contentHash = sha256(buffer);
    const fileName = `order-summary-${response.orderId}-${randomUUID()}.pdf`;
    const blobPath = buildOrderBlobPath(response.orderId, fileName);
    const blob = await uploadBlob(blobPath, buffer, 'application/pdf');
    uploadedPath = blob.pathname;

    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query('select id from orders where id = $1 for update', [response.orderId]);
      const existingResult = await client.query(
        `
          select blob_url
          from order_documents
          where order_id = $1
            and type = 'order_summary'
            and deleted_at is null
          order by version_number asc, id asc
          limit 1
        `,
        [response.orderId]
      );
      const existingBlobUrl = existingResult.rows[0]?.blob_url;

      if (typeof existingBlobUrl === 'string' && existingBlobUrl) {
        const withDocument: StoredOrderResponse = {
          ...response,
          documentUrl: existingBlobUrl
        };
        await client.query(
          `
            update order_idempotency_keys
            set response_json = $1::jsonb
            where key_hash = $2
          `,
          [JSON.stringify(withDocument), keyHash]
        );
        await client.query('commit');
        documentPersisted = true;
        await deleteBlob(blob.pathname).catch((error) => {
          console.error('[orders.create] redundant summary cleanup failed', {
            orderId: response.orderId,
            message: error instanceof Error ? error.message : 'Unknown error'
          });
        });
        return withDocument;
      }

      const versionResult = await client.query(
        `
          select coalesce(max(version_number), 0)::integer + 1 as next_version
          from order_documents
          where order_id = $1
            and type = 'order_summary'
        `,
        [response.orderId]
      );
      const version = Number(versionResult.rows[0]?.next_version ?? 1);
      const documentNumber = `POVZETEK-${response.orderId}-V${version}`;

      await client.query(
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
            $1, 'order_summary', $2, $3, $4, $5, $6, now(), $7,
            'operational', 'atehna-order-summary-pdf-v1'
          )
        `,
        [
          response.orderId,
          fileName,
          blob.url,
          blob.pathname,
          version,
          documentNumber,
          contentHash
        ]
      );

      const withDocument: StoredOrderResponse = {
        ...response,
        documentUrl: blob.url
      };
      await client.query(
        `
          update order_idempotency_keys
          set response_json = $1::jsonb
          where key_hash = $2
        `,
        [JSON.stringify(withDocument), keyHash]
      );
      await client.query('commit');
      documentPersisted = true;
      return withDocument;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    if (uploadedPath && !documentPersisted) {
      await deleteBlob(uploadedPath).catch(() => undefined);
    }
    console.error('[orders.create] summary generation failed', {
      orderId: response.orderId,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return response;
  }
}

function safelyRevalidateAdminOrderPaths(orderId: number) {
  try {
    revalidateAdminOrderPaths(orderId);
  } catch (error) {
    console.error('[orders.create] admin order revalidation failed', {
      orderId,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

function scheduleInitialOrderSummary(
  pool: Pool,
  response: StoredOrderResponse,
  keyHash: string
) {
  try {
    after(async () => {
      await createInitialOrderSummary(pool, response, keyHash);
      safelyRevalidateAdminOrderPaths(response.orderId);
    });
  } catch (error) {
    console.error('[orders.create] summary scheduling failed', {
      orderId: response.orderId,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

function errorResponse(error: unknown) {
  if (error instanceof OrderCommerceError) {
    return NextResponse.json(
      {
        code: error.code,
        message: error.message,
        issues: error.issues
      },
      {
        status: error.status,
        headers: { 'Cache-Control': 'no-store' }
      }
    );
  }

  console.error('[orders.create] failed', {
    message: error instanceof Error ? error.message : 'Unknown error'
  });
  return NextResponse.json(
    { code: 'ORDER_CREATE_FAILED', message: 'Naročila trenutno ni mogoče oddati.' },
    {
      status: 500,
      headers: { 'Cache-Control': 'no-store' }
    }
  );
}

export async function POST(request: Request) {
  const bodyResult = await readRequiredJsonRecord(request);
  if (!bodyResult.ok) return bodyResult.response;

  let client: PoolClient | null = null;
  try {
    const body = bodyResult.body;
    let customer = normalizeCustomer(body);
    const idempotencyKey = readIdempotencyKey(request, body);
    const keyHash = sha256(idempotencyKey);
    const pool = await getPool();
    client = await pool.connect();
    await client.query('begin');
    customer = await canonicalizeGursAddress(client, customer);

    const selections = await parseOrderSelections(client, body.items, {
      allowLegacySku: true
    });
    const requestHash = requestFingerprint(customer, selections);
    const reservation = await reserveIdempotencyKey(client, keyHash, requestHash);

    if (reservation.kind === 'replay') {
      const revokedTokenCount = await revokeOrderAccessTokens(client, reservation.orderId);
      const accessToken = await issueOrderAccessToken(client, reservation.orderId, {
        scopes:
          reservation.response.customer?.customerType === 'school'
            ? ['confirmation', 'purchase_order']
            : ['confirmation']
      });
      await client.query('commit');
      client.release();
      client = null;

      if (!reservation.response.documentUrl) {
        scheduleInitialOrderSummary(pool, reservation.response, keyHash);
      }
      safelyRevalidateAdminOrderPaths(reservation.orderId);

      return NextResponse.json(
        {
          ...reservation.response,
          ...confirmationFields(accessToken.token),
          tokenExpiresAt: accessToken.expiresAt,
          idempotentReplay: true,
          replacedAccessTokenCount: revokedTokenCount
        },
        {
          status: 200,
          headers: { 'Cache-Control': 'no-store' }
        }
      );
    }

    const quote = await buildAuthoritativeOrderQuote(client, selections, {
      lockVariants: true
    });
    const inserted = await insertOrder(client, customer, quote);
    const accessToken = await issueOrderAccessToken(client, inserted.orderId, {
      scopes:
        customer.customerType === 'school'
          ? ['confirmation', 'purchase_order']
          : ['confirmation']
    });
    const storedResponse: StoredOrderResponse = {
      orderId: inserted.orderId,
      orderNumber: inserted.orderNumber,
      status: 'received',
      paymentStatus: 'unpaid',
      commitmentStatus: inserted.commitmentStatus,
      stockNotCommitted: inserted.stockNotCommitted,
      createdAt: inserted.createdAt,
      documentUrl: null,
      documentType: 'order_summary',
      items: quote.items,
      totals: quote.totals,
      pricingVersion: quote.pricingVersion,
      customer
    };

    await client.query(
      `
        update order_idempotency_keys
        set order_id = $1,
            response_json = $2::jsonb,
            completed_at = now()
        where key_hash = $3
      `,
      [inserted.orderId, JSON.stringify(storedResponse), keyHash]
    );
    await client.query('commit');
    client.release();
    client = null;

    scheduleInitialOrderSummary(pool, storedResponse, keyHash);
    safelyRevalidateAdminOrderPaths(inserted.orderId);

    return NextResponse.json(
      {
        ...storedResponse,
        ...confirmationFields(accessToken.token),
        tokenExpiresAt: accessToken.expiresAt,
        idempotentReplay: false
      },
      {
        status: 201,
        headers: { 'Cache-Control': 'no-store' }
      }
    );
  } catch (error) {
    if (client) {
      await client.query('rollback').catch(() => undefined);
      client.release();
    }
    return errorResponse(error);
  }
}
