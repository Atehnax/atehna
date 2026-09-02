import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import type { PoolClient } from 'pg';
import { isQuoteAdminEnabled } from '@/shared/server/quoteFeatureFlags';
import { getPool } from '@/shared/server/db';
import { insertAuditEventForRequest } from '@/shared/server/audit';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';
import { revalidateAdminQuotePaths } from '@/shared/server/revalidateAdminQuotes';
import {
  loadAuthoritativeManualQuoteCatalogSnapshot,
  normalizeOrderQuoteCustomerLabels,
  OrderCommerceError,
  type AuthoritativeOrderQuote
} from '@/shared/server/orderCommerce';
import {
  appendQuoteEvent,
  boundedText,
  hasValidQuoteAdminSession,
  positiveInteger,
  quoteAdminEvidence
} from '@/admin/api/quote-requests/quoteAdminRouteUtils';

const CUSTOMER_TYPES = new Set(['individual', 'company', 'school']);
const QUOTE_REASONS = new Set([
  'formal_offer',
  'stock_or_delivery',
  'quantity_discount_or_custom_quantity',
  'other'
]);
const INTAKE_SOURCES = new Set(['admin_email', 'admin_testing']);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const POSTAL_CODE_PATTERN = /^\d{4}$/u;

const nullableText = (value: unknown, maximum: number) =>
  boundedText(value, maximum) || null;

type ManualRequestedItem = {
  productName: string;
  quantity: number;
  unit: string;
  catalogItemId: number | null;
  catalogVariantId: number | null;
  sku: string | null;
};

const optionalPositiveInteger = (value: unknown, label: string) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = positiveInteger(value);
  if (!parsed) throw new Error(`${label} ni veljaven.`);
  return parsed;
};

function parseManualRequestedItem(value: unknown): ManualRequestedItem {
  if (!Array.isArray(value) || value.length !== 1) {
    throw new Error('Ročno povpraševanje mora vsebovati natanko en zahtevan artikel.');
  }
  const raw = value[0];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Zahtevani artikel ni veljaven.');
  }
  const item = raw as Record<string, unknown>;
  const productName = boundedText(item.productName, 300);
  const quantity = Number(item.quantity);
  const unit = boundedText(item.unit ?? 'kos', 20);
  const catalogItemId = optionalPositiveInteger(
    item.catalogItemId,
    'ID kataloškega artikla'
  );
  const catalogVariantId = optionalPositiveInteger(
    item.catalogVariantId,
    'ID kataloške različice'
  );
  const sku = nullableText(item.sku, 160);
  const hasCatalogIdentifier =
    catalogItemId !== null || catalogVariantId !== null || sku !== null;
  if (!productName) throw new Error('Vnesite naziv zahtevanega artikla.');
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1_000_000) {
    throw new Error('Količina mora biti celo število med 1 in 1.000.000.');
  }
  if (!unit) throw new Error('Vnesite enoto zahtevanega artikla.');
  if (hasCatalogIdentifier && catalogVariantId === null) {
    throw new Error('Za kataloški artikel izberite njegovo različico.');
  }
  if (!hasCatalogIdentifier && unit !== 'kos') {
    throw new Error('Pri prostem ročnem vnosu je podprta enota »kos«.');
  }
  return {
    productName,
    quantity,
    unit,
    catalogItemId,
    catalogVariantId,
    sku
  };
}

async function insertManualRequestItem(
  client: PoolClient,
  quoteRequestId: number,
  requestNumber: string,
  item: ManualRequestedItem
) {
  const snapshot = {
    source: 'manual_intake',
    pricingStatus: 'pending_admin_entry',
    requestedProductName: item.productName,
    requestedQuantity: item.quantity,
    requestedUnit: item.unit
  };
  await client.query(
    `
      insert into quote_request_items (
        quote_request_id, line_number, catalog_item_id, catalog_variant_id,
        product_slug, product_name, variant_name, sku, unit, quantity,
        min_order, available_stock_at_request, selected_attributes,
        base_unit_net, discount_pct, unit_net, unit_tax, unit_gross,
        line_net, line_tax, line_gross, tax_rate, currency, snapshot_json
      )
      values (
        $1, 1, null, null, $2, $3, 'Ročni vnos', $4, 'kos', $5,
        1, 0, $6::jsonb, 0, 0, 0, 0, 0, 0, 0, 0, 0.22, 'EUR', $7::jsonb
      )
    `,
    [
      quoteRequestId,
      `manual-intake-${quoteRequestId}-1`,
      item.productName,
      `MANUAL-${requestNumber.slice(4)}-1`,
      item.quantity,
      JSON.stringify({ manualIntake: true }),
      JSON.stringify(snapshot)
    ]
  );
}

async function insertCatalogRequestItem(
  client: PoolClient,
  quoteRequestId: number,
  estimate: AuthoritativeOrderQuote,
  requestedItem: ManualRequestedItem,
  intakeSource: 'admin_email' | 'admin_testing'
) {
  const item = estimate.items[0];
  if (!item) throw new Error('Kataloškega artikla ni bilo mogoče pripraviti.');
  await client.query(
    `
      insert into quote_request_items (
        quote_request_id, line_number, catalog_item_id, catalog_variant_id,
        product_slug, product_name, variant_name, sku, unit, quantity,
        min_order, available_stock_at_request, category_id, category_path,
        selected_attributes, image_url, base_unit_net, discount_pct,
        unit_net, unit_tax, unit_gross, line_net, line_tax, line_gross,
        tax_rate, currency, snapshot_json
      )
      values (
        $1, 1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
        $13, $14::jsonb, $15, $16, $17, $18, $19, $20, $21, $22,
        $23, $24, 'EUR', $25::jsonb
      )
    `,
    [
      quoteRequestId,
      item.productId,
      item.variantId,
      item.productSlug,
      item.productName,
      item.variantName,
      item.sku,
      item.unit,
      item.quantity,
      item.minOrder,
      item.availableStock,
      item.categoryId,
      item.categoryPath,
      JSON.stringify(item.attributes),
      item.imageUrl,
      item.listUnitNet.toFixed(2),
      item.discountPct,
      item.unitNet.toFixed(2),
      item.unitTax.toFixed(2),
      item.unitGross.toFixed(2),
      item.lineNet.toFixed(2),
      item.lineTax.toFixed(2),
      item.lineGross.toFixed(2),
      item.taxRate,
      JSON.stringify({
        ...item.snapshot,
        intake: {
          source: intakeSource,
          channel: 'admin',
          manualIntake: true,
          catalogBacked: true,
          requestedProductName: requestedItem.productName,
          requestedUnit: requestedItem.unit
        }
      })
    ]
  );
}

export async function POST(request: Request) {
  if (!isQuoteAdminEnabled()) {
    return NextResponse.json({ message: 'Ponudbe niso omogočene.' }, { status: 404 });
  }
  if (!hasValidQuoteAdminSession(request)) {
    return NextResponse.json({ message: 'Za dostop je potrebna prijava.' }, { status: 401 });
  }
  const parsed = await readRequiredJsonRecord(request);
  if (!parsed.ok) return parsed.response;

  let input: {
    customerType: string;
    organizationName: string | null;
    contactName: string;
    email: string;
    addressLine1: string | null;
    addressLine2: string | null;
    postalCode: string | null;
    city: string | null;
    countryCode: 'SI';
    reference: string | null;
    quoteReason: string;
    customerMessage: string | null;
    intakeSource: 'admin_email' | 'admin_testing';
    isDraft: boolean;
    requestedItem: ManualRequestedItem | null;
  };
  try {
    const isDraft = parsed.body.mode === 'draft';
    if (isDraft) {
      input = {
        isDraft: true,
        customerType: 'company',
        organizationName: 'Osnutek',
        contactName: 'Osnutek',
        email: 'draft@atehna.si',
        addressLine1: null,
        addressLine2: null,
        postalCode: null,
        city: null,
        countryCode: 'SI',
        reference: null,
        quoteReason: 'formal_offer',
        customerMessage: null,
        intakeSource: 'admin_email',
        requestedItem: null
      };
    } else {
      const customerType = boundedText(parsed.body.customerType, 32);
      const submittedOrganizationName = nullableText(
        parsed.body.organizationName,
        240
      );
      const organizationName = customerType === 'individual'
        ? null
        : submittedOrganizationName;
      const contactName = boundedText(parsed.body.contactName, 240);
      const email = boundedText(parsed.body.email, 320).toLowerCase();
      const addressLine1 = nullableText(parsed.body.addressLine1, 300);
      const addressLine2 = nullableText(parsed.body.addressLine2, 500);
      const postalCode = nullableText(parsed.body.postalCode, 16);
      const city = nullableText(parsed.body.city, 160);
      const countryCode = boundedText(
        parsed.body.countryCode ?? 'SI',
        2
      ).toUpperCase();
      const reference = nullableText(parsed.body.reference, 240);
      const quoteReason = boundedText(
        parsed.body.quoteReason ?? 'formal_offer',
        80
      );
      const customerMessage = nullableText(parsed.body.customerMessage, 8_000);
      const intakeSource = boundedText(
        parsed.body.intakeSource ?? 'admin_email',
        32
      );
      const requestedItem = parseManualRequestedItem(parsed.body.requestedItems);

      if (
        !CUSTOMER_TYPES.has(customerType)
        || !QUOTE_REASONS.has(quoteReason)
        || !INTAKE_SOURCES.has(intakeSource)
        || !contactName
        || !EMAIL_PATTERN.test(email)
        || (postalCode !== null && !POSTAL_CODE_PATTERN.test(postalCode))
        || countryCode !== 'SI'
      ) {
        return NextResponse.json(
          { message: 'Preverite obvezne podatke o naročniku in povpraševanju.' },
          { status: 400 }
        );
      }
      if (customerType !== 'individual' && !organizationName) {
        return NextResponse.json(
          { message: 'Vnesite naziv organizacije.' },
          { status: 400 }
        );
      }
      input = {
        isDraft: false,
        customerType,
        organizationName,
        contactName,
        email,
        addressLine1,
        addressLine2,
        postalCode,
        city,
        countryCode: 'SI',
        reference,
        quoteReason,
        customerMessage,
        intakeSource: intakeSource as 'admin_email' | 'admin_testing',
        requestedItem
      };
    }
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Podatki niso veljavni.' },
      { status: 400 }
    );
  }

  const evidence = await quoteAdminEvidence(request);
  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query('begin');
    const customerLabels = normalizeOrderQuoteCustomerLabels([
      input.organizationName,
      input.contactName
    ]);
    const requestedItem = input.requestedItem;
    const catalogEstimate = requestedItem?.catalogVariantId == null
      ? null
      : await loadAuthoritativeManualQuoteCatalogSnapshot(
          client,
          {
            variantId: requestedItem.catalogVariantId,
            quantity: requestedItem.quantity,
            catalogItemId: requestedItem.catalogItemId,
            sku: requestedItem.sku
          },
          { customerLabels }
        );
    const authoritativeItem = catalogEstimate?.items[0] ?? null;
    const numberingYear = new Date().getUTCFullYear();
    const counterResult = await client.query(
      `
        insert into quote_number_counters (year, last_request_sequence, updated_at)
        values ($1, 1, now())
        on conflict (year)
        do update set
          last_request_sequence = quote_number_counters.last_request_sequence + 1,
          updated_at = now()
        returning last_request_sequence
      `,
      [numberingYear]
    );
    const sequence = Number(counterResult.rows[0]?.last_request_sequence ?? 0);
    if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > 999_999) {
      throw new Error('Letno zaporedje povpraševanj je izčrpano.');
    }
    const requestNumber = `POV-${numberingYear}-${String(sequence).padStart(6, '0')}`;
    const billingSnapshot = {
      customerType: input.customerType,
      organizationName: input.organizationName,
      contactName: input.contactName,
      email: input.email,
      addressLine1: input.addressLine1,
      addressLine2: input.addressLine2,
      postalCode: input.postalCode,
      city: input.city,
      countryCode: input.countryCode,
      reference: input.reference
    };
    const shippingSnapshot = catalogEstimate
      ? {
          ...catalogEstimate.shipping,
          intakeSource: input.intakeSource,
          manualIntake: true
        }
      : {
          status: 'manual_quote',
          reason: 'Poštnina bo določena pri pripravi ponudbe.',
          intakeSource: input.intakeSource,
          manualIntake: true
        };
    const estimatePayload = catalogEstimate
      ? {
          ...catalogEstimate,
          shipping: shippingSnapshot,
          intake: {
            source: input.intakeSource,
            channel: 'admin',
            manualIntake: true,
            catalogBacked: true
          },
          stockReserved: false,
          nonBinding: true
        }
      : {
          version: 'manual-intake-v1',
          pricingVersion: 'manual-intake-pending-v1',
          items: requestedItem ? [requestedItem] : [],
          totals: { net: 0, tax: 0, shipping: null, gross: null, currency: 'EUR' },
          shipping: shippingSnapshot,
          intake: {
            source: input.intakeSource,
            channel: 'admin',
            manualIntake: true,
            catalogBacked: false
          },
          stockReserved: false,
          nonBinding: true
        };
    const estimateFingerprint = catalogEstimate
      ? catalogEstimate.quoteFingerprint.split(':').at(-1)
      : createHash('sha256')
          .update(JSON.stringify({ requestNumber, ...estimatePayload }), 'utf8')
          .digest('hex');
    if (!estimateFingerprint || estimateFingerprint.length !== 64) {
      throw new Error('Prstnega odtisa povpraševanja ni bilo mogoče pripraviti.');
    }
    const inserted = await client.query(
      `
        insert into quote_requests (
          request_number, status, customer_type, organization_name,
          contact_name, email, address_line1, address_line2, city, postal_code,
          country_code, reference, quote_reason, customer_message,
          billing_snapshot_json, shipping_snapshot_json, estimate_fingerprint,
          estimate_json, intake_source, state_version
        )
        values (
          $1, 'received', $2, $3, $4, $5, $6, $7, $8, $9, 'SI', $10,
          $11, $12, $13::jsonb, $14::jsonb, $15, $16::jsonb, $17, 1
        )
        returning id, request_number, created_at
      `,
      [
        requestNumber,
        input.customerType,
        input.organizationName,
        input.contactName,
        input.email,
        input.addressLine1,
        input.addressLine2,
        input.city,
        input.postalCode,
        input.reference,
        input.quoteReason,
        input.customerMessage,
        JSON.stringify(billingSnapshot),
        JSON.stringify(shippingSnapshot),
        estimateFingerprint,
        JSON.stringify(estimatePayload),
        input.intakeSource
      ]
    );
    const row = inserted.rows[0] as {
      id: string | number;
      request_number: string;
      created_at: string | Date;
    } | undefined;
    const quoteRequestId = Number(row?.id);
    if (!row || !Number.isSafeInteger(quoteRequestId)) {
      throw new Error('Povpraševanja ni bilo mogoče ustvariti.');
    }
    if (catalogEstimate && requestedItem) {
      await insertCatalogRequestItem(
        client,
        quoteRequestId,
        catalogEstimate,
        requestedItem,
        input.intakeSource
      );
    } else if (requestedItem) {
      await insertManualRequestItem(
        client,
        quoteRequestId,
        requestNumber,
        requestedItem
      );
    }
    await appendQuoteEvent(client, {
      quoteRequestId,
      eventKey: `admin-intake:${quoteRequestId}`,
      eventType: 'request_received',
      actorType: 'admin',
      actorId: evidence.actorId,
      requestId: evidence.requestId,
      metadata: {
        source: input.intakeSource,
        manualIntake: true,
        catalogBacked: catalogEstimate !== null,
        catalogItemId: authoritativeItem?.productId ?? null,
        catalogVariantId: authoritativeItem?.variantId ?? null,
        sku: authoritativeItem?.sku ?? requestedItem?.sku ?? null,
        nonBinding: true,
        itemCount: requestedItem ? 1 : 0,
        customerAccessIssued: false,
        customerEmailQueued: false
      }
    });
    await insertAuditEventForRequest(request, {
      entityType: 'system',
      entityId: `quote:${quoteRequestId}`,
      entityLabel: `Povpraševanje ${requestNumber}`,
      action: 'created',
      summary: input.isDraft
        ? `Povpraševanje ${requestNumber}: osnutek dodan`
        : `Povpraševanje ${requestNumber}: ročno dodano`,
      diff: {
        quote_status: {
          label: 'Status povpraševanja',
          before: null,
          after: 'received'
        }
      },
      metadata: {
        quote_request_id: quoteRequestId,
        request_number: requestNumber,
        intake_source: input.intakeSource,
        non_binding: true,
        draft: input.isDraft
      }
    }, client);
    await client.query('commit');
    revalidateAdminQuotePaths(quoteRequestId);
    return NextResponse.json({
      quoteRequestId,
      requestNumber,
      status: 'received',
      stateVersion: 1,
      isDraft: input.isDraft,
      message: input.isDraft
        ? 'Osnutek povpraševanja je ustvarjen.'
        : 'Povpraševanje je ustvarjeno.',
      createdAt: row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at)
    }, { status: 201 });
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    if (error instanceof OrderCommerceError) {
      return NextResponse.json(
        { code: error.code, message: error.message, issues: error.issues },
        { status: error.status }
      );
    }
    console.error('[quotes.admin-create] failed', {
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Povpraševanja ni mogoče ustvariti.' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
