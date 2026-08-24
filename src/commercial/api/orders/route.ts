import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import type { PoolClient } from 'pg';
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
  issueOrderAccessToken,
  setOrderAccessSessionCookie,
  verifyOrderAccessToken
} from '@/shared/server/orderAccess';
import {
  decryptOrderAccessBootstrap,
  encryptOrderAccessBootstrap,
  type EncryptedOrderAccessBootstrap
} from '@/shared/server/orderAccessBootstrapCipher';
import {
  enqueueInitialOrderSummaryJob,
  scheduleInitialOrderSummaryJob
} from '@/shared/server/orderSummaryJobs';
import {
  enqueueOrderEmailEvent,
  scheduleOrderEmailJobs
} from '@/shared/server/orderEmailJobs';
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

function normalizeCustomer(body: Record<string, unknown>): NormalizedCustomer {
  const customerTypeValue = text(body.customerType);
  if (!isCustomerType(customerTypeValue)) {
    throw new OrderCommerceError(
      400,
      'INVALID_CUSTOMER_TYPE',
      'Izberite veljaven tip naročnika.'
    );
  }

  const addressLine1 = limited(text(body.addressLine1), 300, 'Naslov');
  const city = limited(text(body.city), 120, 'Kraj');
  const postalCode = limited(text(body.postalCode), 16, 'Poštna številka');
  const email = limited(text(body.email), 320, 'Email');
  const customerName = limited(text(body.customerName), 240, 'Naročnik');
  const organizationName = limited(text(body.organizationName), 240, 'Organizacija');
  const contactName = limited(text(body.contactName), 240, 'Kontaktna oseba');
  const reference = optionalText(body.reference);
  const notes = optionalText(body.notes);
  const addressLine2Value = optionalText(body.addressLine2);
  const gursHouseNumberIdValue =
    typeof body.gursHouseNumberId === 'string'
      ? optionalText(body.gursHouseNumberId)
      : null;

  if (!customerName) {
    throw new OrderCommerceError(400, 'CUSTOMER_NAME_REQUIRED', 'Vnesite naročnika.');
  }
  if (customerTypeValue !== 'individual' && !organizationName) {
    throw new OrderCommerceError(
      400,
      'ORGANIZATION_NAME_REQUIRED',
      'Vnesite naziv organizacije.'
    );
  }
  if (!contactName) {
    throw new OrderCommerceError(
      400,
      'CONTACT_NAME_REQUIRED',
      'Vnesite kontaktno osebo.'
    );
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

  return {
    customerType: customerTypeValue,
    customerName,
    organizationName: customerTypeValue === 'individual' ? null : organizationName,
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
    reference: reference ? limited(reference, 240, 'Referenca') : null,
    notes: notes ? limited(notes, 4_000, 'Opombe') : null
  };
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

    return {
      ...customer,
      gursHouseNumberId: address.gursHouseNumberId,
      addressLine1: address.addressLine1,
      postalCode: address.postalCode,
      city: address.postalName
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

function toCustomerOrderResponse(accessId: string) {
  return { accessId };
}

function createCustomerOrderResponse(
  session: {
    tokenId: string;
    token: string;
    expiresAt: string;
  },
  status: 200 | 201
) {
  const nextResponse = NextResponse.json(
    toCustomerOrderResponse(session.tokenId),
    {
      status,
      headers: {
        'Cache-Control': 'no-store, private',
        'Referrer-Policy': 'no-referrer'
      }
    }
  );
  setOrderAccessSessionCookie(nextResponse, session);
  return nextResponse;
}

async function reserveIdempotencyKey(
  client: PoolClient,
  keyHash: string,
  requestHash: string
): Promise<
  | { kind: 'new' }
  | {
      kind: 'replay';
      orderId: number;
      response: StoredOrderResponse;
      encryptedBootstrap: EncryptedOrderAccessBootstrap;
    }
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
      select
        keys.request_hash,
        keys.order_id,
        keys.response_json,
        keys.bootstrap_token_ciphertext,
        keys.bootstrap_token_iv,
        keys.bootstrap_token_tag
      from order_idempotency_keys keys
      where keys.key_hash = $1
    `,
    [keyHash]
  );
  const row = existing.rows[0] as
    | {
        request_hash: string;
        order_id: string | number | null;
        response_json: StoredOrderResponse | null;
        bootstrap_token_ciphertext: string | null;
        bootstrap_token_iv: string | null;
        bootstrap_token_tag: string | null;
      }
    | undefined;

  if (!row || row.request_hash !== requestHash) {
    throw new OrderCommerceError(
      409,
      'IDEMPOTENCY_KEY_CONFLICT',
      'Idempotency-Key je bil že uporabljen za drugo zahtevo.'
    );
  }
  if (
    !row.order_id ||
    !row.response_json ||
    Object.keys(row.response_json).length === 0 ||
    !row.bootstrap_token_ciphertext ||
    !row.bootstrap_token_iv ||
    !row.bootstrap_token_tag
  ) {
    throw new OrderCommerceError(
      409,
      'ORDER_REQUEST_IN_PROGRESS',
      'Naročilo s tem ključem se še obdeluje.'
    );
  }

  return {
    kind: 'replay',
    orderId: Number(row.order_id),
    response: row.response_json,
    encryptedBootstrap: {
      ciphertext: row.bootstrap_token_ciphertext,
      initializationVector: row.bootstrap_token_iv,
      authenticationTag: row.bootstrap_token_tag
    }
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
        'received',
        'unpaid',
        $13,
        $14,
        $15,
        $16,
        'EUR',
        $17,
        $18,
        $19,
        false
      from next_id
      returning id, order_number, created_at
    `,
    [
      customer.customerType,
      customer.organizationName,
      customer.contactName,
      customer.email,
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
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
          $12::jsonb, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22,
          'EUR', $23::jsonb
        )
        returning id
      `,
      [
        orderId,
        item.sku,
        `${item.productName} – ${item.variantName}`,
        item.unit,
        item.quantity,
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

    const selections = parseOrderSelections(body.items);
    const requestHash = requestFingerprint(customer, selections);
    const reservation = await reserveIdempotencyKey(client, keyHash, requestHash);

    if (reservation.kind === 'replay') {
      let accessToken: string;
      try {
        accessToken = decryptOrderAccessBootstrap(
          reservation.encryptedBootstrap,
          keyHash,
          reservation.orderId
        );
      } catch (error) {
        console.error('[orders.create] idempotent bootstrap decryption failed', {
          orderId: reservation.orderId,
          message: error instanceof Error ? error.message : 'Unknown error'
        });
        throw new OrderCommerceError(
          409,
          'ORDER_ACCESS_REPLAY_UNAVAILABLE',
          'Povezave za potrditev ni mogoče ponovno izdati. Obrnite se na podporo.'
        );
      }
      const verifiedAccess = await verifyOrderAccessToken(
        client,
        accessToken,
        'confirmation',
        reservation.orderId
      );
      if (!verifiedAccess) {
        throw new OrderCommerceError(
          409,
          'ORDER_ACCESS_REPLAY_UNAVAILABLE',
          'Povezava za potrditev je potekla ali je bila preklicana.'
        );
      }
      await client.query('commit');
      client.release();
      client = null;

      scheduleInitialOrderSummaryJob(pool, reservation.orderId);
      scheduleOrderEmailJobs(pool, reservation.orderId);
      safelyRevalidateAdminOrderPaths(reservation.orderId);

      return createCustomerOrderResponse(
        {
          tokenId: verifiedAccess.tokenId,
          token: accessToken,
          expiresAt: verifiedAccess.expiresAt
        },
        200
      );
    }

    const quote = await buildAuthoritativeOrderQuote(client, selections, {
      lockVariants: true,
      customerLabels: [
        customer.organizationName,
        customer.contactName,
        customer.customerName
      ].filter((label): label is string => Boolean(label))
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
      items: quote.items,
      totals: quote.totals,
      pricingVersion: quote.pricingVersion,
      customer
    };

    const encryptedBootstrap = encryptOrderAccessBootstrap(
      accessToken.token,
      keyHash,
      inserted.orderId
    );
    await enqueueInitialOrderSummaryJob(client, storedResponse);
    await enqueueOrderEmailEvent(client, {
      orderId: inserted.orderId,
      eventKey: `order-submitted:${inserted.orderId}`,
      eventType: 'order_submitted',
      occurredAt: inserted.createdAt,
      previousStatus: null
    });
    await client.query(
      `
        update order_idempotency_keys
        set order_id = $1,
            response_json = $2::jsonb,
            bootstrap_token_ciphertext = $3,
            bootstrap_token_iv = $4,
            bootstrap_token_tag = $5,
            completed_at = now()
        where key_hash = $6
      `,
      [
        inserted.orderId,
        JSON.stringify(storedResponse),
        encryptedBootstrap.ciphertext,
        encryptedBootstrap.initializationVector,
        encryptedBootstrap.authenticationTag,
        keyHash
      ]
    );
    await client.query('commit');
    client.release();
    client = null;

    scheduleInitialOrderSummaryJob(pool, inserted.orderId);
    scheduleOrderEmailJobs(pool, inserted.orderId);
    safelyRevalidateAdminOrderPaths(inserted.orderId);

    return createCustomerOrderResponse(accessToken, 201);
  } catch (error) {
    if (client) {
      await client.query('rollback').catch(() => undefined);
      client.release();
    }
    return errorResponse(error);
  }
}
