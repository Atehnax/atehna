import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import type { PoolClient } from 'pg';
import { getPool } from '@/shared/server/db';
import { isQuoteAdminEnabled } from '@/shared/server/quoteFeatureFlags';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';
import { lockQuoteWorkflow } from '@/shared/server/quoteAccess';
import {
  loadAuthoritativeManualQuoteCatalogSnapshot,
  normalizeOrderQuoteCustomerLabels,
  OrderCommerceError
} from '@/shared/server/orderCommerce';
import { hasValidQuoteAdminSession } from '@/admin/api/quote-requests/quoteAdminRouteUtils';

type DraftItem = {
  lineNumber: number;
  catalogItemId: number | null;
  catalogVariantId: number | null;
  productSlug: string;
  productName: string;
  variantName: string;
  sku: string;
  unit: string | null;
  quantity: number;
  minOrder: number;
  availableStockAtRequest: number;
  categoryId: string | null;
  categoryPath: string | null;
  selectedAttributes: Record<string, unknown>;
  imageUrl: string | null;
  baseUnitNetCents: number;
  discountPct: number;
  unitNetCents: number;
  unitTaxCents: number;
  unitGrossCents: number;
  lineNetCents: number;
  lineTaxCents: number;
  lineGrossCents: number;
  taxRate: number;
  snapshot: Record<string, unknown>;
};

const EDITABLE_REQUEST_STATUSES = new Set(['received', 'in_preparation']);

function text(value: unknown, maximum: number): string {
  const normalized =
    typeof value === 'string' ? value.trim() : String(value ?? '').trim();
  if (normalized.length > maximum) throw new Error('Vrednost polja je predolga.');
  return normalized;
}

function moneyCents(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100_000_000) {
    throw new Error('Denarni znesek ni veljaven.');
  }
  return Math.round(parsed * 100);
}

function money(cents: number): string {
  return (cents / 100).toFixed(2);
}

function jsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function futureValidity(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  const parsed = /^\d{4}-\d{2}-\d{2}$/u.test(raw)
    ? new Date(`${raw}T23:59:59.999Z`)
    : new Date(raw);
  if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
    throw new Error('Datum veljavnosti mora biti v prihodnosti.');
  }
  return parsed.toISOString();
}

async function readRequestItems(
  client: PoolClient,
  quoteRequestId: number
): Promise<DraftItem[]> {
  const result = await client.query(
    `
      select *
      from quote_request_items
      where quote_request_id = $1
      order by line_number
    `,
    [quoteRequestId]
  );
  return result.rows.map((row) => ({
    lineNumber: Number(row.line_number),
    catalogItemId: row.catalog_item_id === null ? null : Number(row.catalog_item_id),
    catalogVariantId: row.catalog_variant_id === null ? null : Number(row.catalog_variant_id),
    productSlug: String(row.product_slug),
    productName: String(row.product_name),
    variantName: String(row.variant_name),
    sku: String(row.sku),
    unit: row.unit === null ? null : String(row.unit),
    quantity: Number(row.quantity),
    minOrder: Number(row.min_order),
    availableStockAtRequest: Number(row.available_stock_at_request),
    categoryId: row.category_id === null ? null : String(row.category_id),
    categoryPath: row.category_path === null ? null : String(row.category_path),
    selectedAttributes: jsonRecord(row.selected_attributes),
    imageUrl: row.image_url === null ? null : String(row.image_url),
    baseUnitNetCents: moneyCents(row.base_unit_net),
    discountPct: Number(row.discount_pct),
    unitNetCents: moneyCents(row.unit_net),
    unitTaxCents: moneyCents(row.unit_tax),
    unitGrossCents: moneyCents(row.unit_gross),
    lineNetCents: moneyCents(row.line_net),
    lineTaxCents: moneyCents(row.line_tax),
    lineGrossCents: moneyCents(row.line_gross),
    taxRate: Number(row.tax_rate),
    snapshot: jsonRecord(row.snapshot_json)
  }));
}

async function readOfferItems(
  client: PoolClient,
  quoteOfferVersionId: number
): Promise<DraftItem[]> {
  const result = await client.query(
    `
      select *
      from quote_offer_version_items
      where quote_offer_version_id = $1
      order by line_number
    `,
    [quoteOfferVersionId]
  );
  return result.rows.map((row) => ({
    lineNumber: Number(row.line_number),
    catalogItemId: row.catalog_item_id === null ? null : Number(row.catalog_item_id),
    catalogVariantId: row.catalog_variant_id === null ? null : Number(row.catalog_variant_id),
    productSlug: String(row.product_slug),
    productName: String(row.product_name),
    variantName: String(row.variant_name),
    sku: String(row.sku),
    unit: row.unit === null ? null : String(row.unit),
    quantity: Number(row.quantity),
    minOrder: Number(row.min_order),
    availableStockAtRequest: Number(row.available_stock_at_request),
    categoryId: row.category_id === null ? null : String(row.category_id),
    categoryPath: row.category_path === null ? null : String(row.category_path),
    selectedAttributes: jsonRecord(row.selected_attributes),
    imageUrl: row.image_url === null ? null : String(row.image_url),
    baseUnitNetCents: moneyCents(row.base_unit_net),
    discountPct: Number(row.discount_pct),
    unitNetCents: moneyCents(row.unit_net),
    unitTaxCents: moneyCents(row.unit_tax),
    unitGrossCents: moneyCents(row.unit_gross),
    lineNetCents: moneyCents(row.line_net),
    lineTaxCents: moneyCents(row.line_tax),
    lineGrossCents: moneyCents(row.line_gross),
    taxRate: Number(row.tax_rate),
    snapshot: jsonRecord(row.snapshot_json)
  }));
}

async function applyItemEdits(
  client: PoolClient,
  source: DraftItem[],
  requestedItems: DraftItem[],
  value: unknown,
  customerLabels: string[]
): Promise<DraftItem[]> {
  if (value === undefined) return source;
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('Ponudba mora vsebovati vsaj eno postavko.');
  }
  if (value.length > 100) {
    throw new Error('Ponudba lahko vsebuje največ 100 postavk.');
  }

  const byLineNumber = new Map(source.map((item) => [item.lineNumber, item]));
  const requestedByLineNumber = new Map(
    requestedItems.map((item) => [item.lineNumber, item])
  );
  const knownLineNumbers = new Set([
    ...byLineNumber.keys(),
    ...requestedByLineNumber.keys()
  ]);
  let nextLineNumber = Math.max(0, ...knownLineNumbers) + 1;
  const seenSubmittedLineNumbers = new Set<number>();
  const items: DraftItem[] = [];

  for (const entry of value) {
    const edit = jsonRecord(entry);
    const hasSubmittedLineNumber =
      edit.lineNumber !== undefined &&
      edit.lineNumber !== null &&
      edit.lineNumber !== '';
    const submittedLineNumber = hasSubmittedLineNumber
      ? Number(edit.lineNumber)
      : 0;
    if (
      hasSubmittedLineNumber &&
      (!Number.isSafeInteger(submittedLineNumber) ||
        submittedLineNumber <= 0 ||
        submittedLineNumber > 2_147_483_647 ||
        seenSubmittedLineNumbers.has(submittedLineNumber))
    ) {
      throw new Error('Številke postavk ponudbe niso veljavne.');
    }
    if (hasSubmittedLineNumber) {
      seenSubmittedLineNumbers.add(submittedLineNumber);
    }

    const isKnownLine = knownLineNumbers.has(submittedLineNumber);
    if (!isKnownLine && nextLineNumber > 2_147_483_647) {
      throw new Error('Ponudbi ni mogoče dodati nove postavke.');
    }
    const lineNumber = isKnownLine ? submittedLineNumber : nextLineNumber++;
    const original =
      byLineNumber.get(lineNumber) ?? requestedByLineNumber.get(lineNumber);
    const quantity = Number(edit.quantity ?? original?.quantity ?? 1);
    if (
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      quantity > 1_000_000
    ) {
      throw new Error('Količina postavke ni veljavna.');
    }

    const catalogVariantId = Number(
      edit.catalogVariantId ?? edit.variantId ?? original?.catalogVariantId
    );
    if (!Number.isSafeInteger(catalogVariantId) || catalogVariantId <= 0) {
      throw new Error('Za vsako ponujeno postavko izberite kataloški artikel.');
    }
    const rawCatalogItemId = Number(edit.catalogItemId ?? original?.catalogItemId);
    const catalogItemId =
      Number.isSafeInteger(rawCatalogItemId) && rawCatalogItemId > 0
        ? rawCatalogItemId
        : null;
    const catalogEstimate = await loadAuthoritativeManualQuoteCatalogSnapshot(
      client,
      {
        variantId: catalogVariantId,
        quantity,
        catalogItemId,
        sku: null
      },
      { customerLabels }
    );
    const catalogItem = catalogEstimate.items[0];
    if (!catalogItem) {
      throw new Error('Izbranega kataloškega artikla ni bilo mogoče pripraviti.');
    }

    const baseUnitNetCents = moneyCents(catalogItem.listUnitNet);
    const unitNetCents = moneyCents(
      edit.unitNet ?? edit.unitPrice ?? catalogItem.unitNet
    );
    const lineNetCents = unitNetCents * quantity;
    const taxRate = catalogItem.taxRate;
    const lineTaxCents = Math.round(lineNetCents * taxRate);
    const unitTaxCents = Math.round(unitNetCents * taxRate);
    const unitGrossCents = unitNetCents + unitTaxCents;
    const derivedDiscountPct =
      baseUnitNetCents > 0
        ? Math.max(
            0,
            Math.min(
              100,
              Math.round(
                (1 - unitNetCents / baseUnitNetCents) * 10_000
              ) / 100
            )
          )
        : 0;
    const submittedDiscountPct = Number(edit.discountPct);
    const normalizedSubmittedDiscountPct =
      Number.isFinite(submittedDiscountPct) &&
      submittedDiscountPct >= 0 &&
      submittedDiscountPct <= 100
        ? Math.round(submittedDiscountPct * 100) / 100
        : null;
    const submittedDiscountUnitNetCents =
      normalizedSubmittedDiscountPct !== null && baseUnitNetCents > 0
        ? Math.round(
            baseUnitNetCents * (1 - normalizedSubmittedDiscountPct / 100)
          )
        : null;
    const discountPct =
      submittedDiscountUnitNetCents === unitNetCents
        ? normalizedSubmittedDiscountPct ?? derivedDiscountPct
        : derivedDiscountPct;

    items.push({
      lineNumber,
      catalogItemId: catalogItem.productId,
      catalogVariantId: catalogItem.variantId,
      productSlug: catalogItem.productSlug,
      productName: catalogItem.productName,
      variantName: catalogItem.variantName,
      sku: catalogItem.sku,
      unit: catalogItem.unit,
      quantity,
      minOrder: catalogItem.minOrder,
      availableStockAtRequest: catalogItem.availableStock,
      categoryId: catalogItem.categoryId,
      categoryPath: catalogItem.categoryPath,
      selectedAttributes: catalogItem.attributes,
      imageUrl: catalogItem.imageUrl,
      baseUnitNetCents,
      discountPct,
      unitNetCents,
      unitTaxCents,
      unitGrossCents,
      lineNetCents,
      lineTaxCents,
      lineGrossCents: lineNetCents + lineTaxCents,
      taxRate,
      snapshot: {
        ...catalogItem.snapshot,
        quoteDraft: {
          source: 'admin_catalog_selection',
          catalogItemId: catalogItem.productId,
          catalogVariantId: catalogItem.variantId,
          quantity,
          unitNet: money(unitNetCents),
          taxRate
        }
      }
    });
  }

  return items.sort((left, right) => left.lineNumber - right.lineNumber);
}
async function replaceDraftItems(
  client: PoolClient,
  offerVersionId: number,
  items: DraftItem[]
) {
  await client.query(
    'delete from quote_offer_version_items where quote_offer_version_id = $1',
    [offerVersionId]
  );
  for (const item of items) {
    await client.query(
      `
        insert into quote_offer_version_items (
          quote_offer_version_id, line_number, catalog_item_id,
          catalog_variant_id, product_slug, product_name, variant_name, sku,
          unit, quantity, min_order, available_stock_at_request, category_id,
          category_path, selected_attributes, image_url, base_unit_net,
          discount_pct, unit_net, unit_tax, unit_gross, line_net, line_tax,
          line_gross, tax_rate, currency, snapshot_json
        )
        values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
          $14, $15::jsonb, $16, $17, $18, $19, $20, $21, $22, $23,
          $24, $25, 'EUR', $26::jsonb
        )
      `,
      [
        offerVersionId,
        item.lineNumber,
        item.catalogItemId,
        item.catalogVariantId,
        item.productSlug,
        item.productName,
        item.variantName,
        item.sku,
        item.unit,
        item.quantity,
        item.minOrder,
        item.availableStockAtRequest,
        item.categoryId,
        item.categoryPath,
        JSON.stringify(item.selectedAttributes),
        item.imageUrl,
        money(item.baseUnitNetCents),
        item.discountPct,
        money(item.unitNetCents),
        money(item.unitTaxCents),
        money(item.unitGrossCents),
        money(item.lineNetCents),
        money(item.lineTaxCents),
        money(item.lineGrossCents),
        item.taxRate,
        JSON.stringify(item.snapshot)
      ]
    );
  }
}

function customerSnapshot(row: Record<string, unknown>) {
  return {
    customerType: row.customer_type,
    organizationName: row.organization_name,
    contactName: row.contact_name,
    email: row.email,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    postalCode: row.postal_code,
    countryCode: row.country_code,
    gursHouseNumberId: row.gurs_house_number_id,
    reference: row.reference
  };
}

export async function PUT(
  request: Request,
  props: { params: Promise<{ quoteRequestId: string }> }
) {
  if (!isQuoteAdminEnabled()) {
    return NextResponse.json({ message: 'Ponudbe niso omogočene.' }, { status: 404 });
  }
  if (!hasValidQuoteAdminSession(request)) {
    return NextResponse.json({ message: 'Za dostop je potrebna prijava.' }, { status: 401 });
  }
  const { quoteRequestId: rawId } = await props.params;
  const quoteRequestId = Number(rawId);
  if (!Number.isSafeInteger(quoteRequestId) || quoteRequestId <= 0) {
    return NextResponse.json({ message: 'Neveljaven ID povpraševanja.' }, { status: 400 });
  }
  const parsed = await readRequiredJsonRecord(request);
  if (!parsed.ok) return parsed.response;

  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query('begin');
    await lockQuoteWorkflow(client, quoteRequestId);
    const requestResult = await client.query(
      'select * from quote_requests where id = $1 for update',
      [quoteRequestId]
    );
    const quoteRequest = requestResult.rows[0] as Record<string, unknown> | undefined;
    if (!quoteRequest) {
      await client.query('rollback');
      return NextResponse.json({ message: 'Povpraševanje ne obstaja.' }, { status: 404 });
    }
    if (quoteRequest.voided_at) {
      await client.query('rollback');
      return NextResponse.json(
        {
          code: 'QUOTE_REQUEST_VOIDED',
          message: 'Povpraševanje je odstranjeno in osnutka ni več mogoče urejati.'
        },
        { status: 409 }
      );
    }
    if (!EDITABLE_REQUEST_STATUSES.has(String(quoteRequest.status))) {
      await client.query('rollback');
      return NextResponse.json(
        { message: 'Zaključenega povpraševanja ni mogoče urejati.' },
        { status: 409 }
      );
    }

    const existingResult = await client.query(
      `
        select *
        from quote_offer_versions
        where quote_request_id = $1
          and status = 'draft'
        order by version_number desc
        limit 1
        for update
      `,
      [quoteRequestId]
    );
    const existingDraftId = Number(existingResult.rows[0]?.id ?? 0);
    const requestedItems = await readRequestItems(client, quoteRequestId);
    const sourceItems = existingDraftId
      ? await readOfferItems(client, existingDraftId)
      : requestedItems;
    const customerLabels = normalizeOrderQuoteCustomerLabels([
      quoteRequest.organization_name,
      quoteRequest.contact_name
    ]);
    const items = await applyItemEdits(
      client,
      sourceItems,
      requestedItems,
      parsed.body.items,
      customerLabels
    );
    const subtotalCents = items.reduce((sum, item) => sum + item.lineNetCents, 0);
    const taxCents = items.reduce((sum, item) => sum + item.lineTaxCents, 0);
    const estimate = jsonRecord(quoteRequest.estimate_json);
    const estimateTotals = jsonRecord(estimate.totals);
    const shippingCents = moneyCents(
      parsed.body.shipping ?? estimateTotals.shipping ?? 0
    );
    const totalCents = subtotalCents + taxCents + shippingCents;
    const customer = customerSnapshot(quoteRequest);
    const billing =
      Object.keys(jsonRecord(quoteRequest.billing_snapshot_json)).length > 0
        ? jsonRecord(quoteRequest.billing_snapshot_json)
        : customer;
    const sellerMessage = text(parsed.body.sellerMessage, 4_000) || null;
    const customerVisibleNotes =
      text(parsed.body.customerVisibleNotes, 4_000) || null;
    const adminNotes = text(parsed.body.adminNotes, 8_000) || null;
    const deliveryTerms = text(parsed.body.deliveryTerms, 4_000) || null;
    const paymentTerms = text(parsed.body.paymentTerms, 4_000) || null;
    const termsText = text(parsed.body.termsText, 20_000) || null;
    const termsVersion = text(parsed.body.termsVersion, 120) || null;
    const acceptanceMethodValue = text(parsed.body.acceptanceMethod, 64);
    const acceptanceMethod =
      quoteRequest.customer_type === 'school' ? 'purchase_order' : 'online';
    if (
      acceptanceMethodValue.length > 0 &&
      acceptanceMethodValue !== acceptanceMethod
    ) {
      await client.query('rollback');
      return NextResponse.json(
        {
          code: 'QUOTE_ACCEPTANCE_METHOD_INVALID',
          message:
            quoteRequest.customer_type === 'school'
              ? 'Šolska ponudba se v tej različici sprejme z uradno naročilnico.'
              : 'Ponudba za posameznika ali podjetje se v tej različici sprejme prek spleta.'
        },
        { status: 400 }
      );
    }

    let offerVersionId: number;
    let versionNumber: number;
    const existing = existingResult.rows[0] as
      | {
          id: string | number;
          version_number: string | number;
          state_version: string | number;
        }
      | undefined;
    const requestedOfferVersionId = Number(parsed.body.offerVersionId ?? 0);
    const expectedStateVersion = Number(parsed.body.expectedStateVersion);
    if (
      !Number.isSafeInteger(expectedStateVersion) ||
      expectedStateVersion <= 0
    ) {
      await client.query('rollback');
      return NextResponse.json(
        { message: 'Osvežite stran in znova shranite osnutek.' },
        { status: 409 }
      );
    }
    if (
      existing &&
      (requestedOfferVersionId !== Number(existing.id) ||
        expectedStateVersion !== Number(existing.state_version))
    ) {
      await client.query('rollback');
      return NextResponse.json(
        {
          code: 'QUOTE_DRAFT_STALE',
          message: 'Osnutek je bil medtem spremenjen. Osvežite stran.'
        },
        { status: 409 }
      );
    }
    if (
      !existing &&
      (requestedOfferVersionId !== 0 ||
        expectedStateVersion !== Number(quoteRequest.state_version))
    ) {
      await client.query('rollback');
      return NextResponse.json(
        {
          code: 'QUOTE_DRAFT_STALE',
          message: 'Povpraševanje je bilo medtem spremenjeno. Osvežite stran.'
        },
        { status: 409 }
      );
    }
    const validUntil = futureValidity(parsed.body.validUntil);
    const confirmFreeShipping = parsed.body.confirmFreeShipping === true;
    if (shippingCents === 0 && !confirmFreeShipping) {
      await client.query('rollback');
      return NextResponse.json(
        {
          code: 'FREE_SHIPPING_CONFIRMATION_REQUIRED',
          message: 'Brezplačno dostavo morate izrecno potrditi.'
        },
        { status: 409 }
      );
    }
    const shippingConfirmation =
      shippingCents === 0
        ? {
            decision: 'free_shipping',
            confirmed: true,
            confirmed_at: new Date().toISOString(),
            confirmed_by_actor_type: 'admin',
            reason: 'Administrator je izrecno potrdil brezplačno dostavo.'
          }
        : null;
    if (existing) {
      offerVersionId = Number(existing.id);
      versionNumber = Number(existing.version_number);
      await client.query(
        `
          update quote_offer_versions
          set customer_snapshot_json = $2::jsonb,
              billing_snapshot_json = $3::jsonb,
              seller_message = $4,
              customer_visible_notes = $5,
              admin_notes = $6,
              delivery_terms = $7,
              payment_terms = $8,
              acceptance_method = $9,
              subtotal = $10,
              tax = $11,
              shipping = $12,
              total = $13,
              shipping_snapshot_json = $14::jsonb,
              shipping_confirmation_json = $15::jsonb,
              valid_until = $16,
              terms_text = $17,
              terms_version = $18,
              state_version = state_version + 1,
              updated_at = now()
          where id = $1
        `,
        [
          offerVersionId,
          JSON.stringify(customer),
          JSON.stringify(billing),
          sellerMessage,
          customerVisibleNotes,
          adminNotes,
          deliveryTerms,
          paymentTerms,
          acceptanceMethod,
          money(subtotalCents),
          money(taxCents),
          money(shippingCents),
          money(totalCents),
          JSON.stringify(quoteRequest.shipping_snapshot_json),
          shippingConfirmation ? JSON.stringify(shippingConfirmation) : null,
          validUntil,
          termsText,
          termsVersion
        ]
      );
    } else {
      const created = await client.query(
        `
          insert into quote_offer_versions (
            quote_request_id,
            version_number,
            status,
            is_current,
            customer_snapshot_json,
            billing_snapshot_json,
            seller_message,
            customer_visible_notes,
            admin_notes,
            delivery_terms,
            payment_terms,
            acceptance_method,
            subtotal,
            tax,
            shipping,
            total,
            currency,
            tax_rate,
            shipping_snapshot_json,
            shipping_confirmation_json,
            valid_until,
            terms_text,
            terms_version,
            created_by_actor_type
          )
          select
            $1,
            coalesce(max(version_number), 0) + 1,
            'draft',
            false,
            $2::jsonb,
            $3::jsonb,
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
            'EUR',
            $14,
            $15::jsonb,
            $16::jsonb,
            $17,
            $18,
            $19,
            'admin'
          from quote_offer_versions
          where quote_request_id = $1
          returning id, version_number
        `,
        [
          quoteRequestId,
          JSON.stringify(customer),
          JSON.stringify(billing),
          sellerMessage,
          customerVisibleNotes,
          adminNotes,
          deliveryTerms,
          paymentTerms,
          acceptanceMethod,
          money(subtotalCents),
          money(taxCents),
          money(shippingCents),
          money(totalCents),
          items.length === 1 ? items[0].taxRate : 0.22,
          JSON.stringify(quoteRequest.shipping_snapshot_json),
          shippingConfirmation ? JSON.stringify(shippingConfirmation) : null,
          validUntil,
          termsText,
          termsVersion
        ]
      );
      offerVersionId = Number(created.rows[0]?.id);
      versionNumber = Number(created.rows[0]?.version_number);
    }

    await replaceDraftItems(client, offerVersionId, items);
    const updatedRequest = await client.query(
      `
        update quote_requests
        set status = 'in_preparation',
            state_version = state_version + 1,
            updated_at = now()
        where id = $1
        returning state_version
      `,
      [quoteRequestId]
    );
    const requestStateVersion = Number(updatedRequest.rows[0]?.state_version);
    const eventType = existing ? 'draft_changed' : 'draft_created';
    await client.query(
      `
        insert into quote_events (
          quote_request_id,
          quote_offer_version_id,
          event_key,
          event_type,
          actor_type,
          occurred_at,
          metadata_json
        )
        values ($1, $2, $3, $4, 'admin', now(), $5::jsonb)
      `,
      [
        quoteRequestId,
        offerVersionId,
        `${eventType}:${offerVersionId}:${Date.now()}`,
        eventType,
        JSON.stringify({
          versionNumber,
          itemCount: items.length,
          contentDraftHash: createHash('sha256')
            .update(
              JSON.stringify({
                items,
                subtotalCents,
                taxCents,
                shippingCents,
                deliveryTerms,
                paymentTerms,
                termsText,
                termsVersion
              })
            )
            .digest('hex')
        })
      ]
    );
    await client.query('commit');
    return NextResponse.json({
      quoteOfferVersionId: offerVersionId,
      versionNumber,
      status: 'draft',
      validUntil,
      stateVersion: existing
        ? Number(existing.state_version) + 1
        : 1,
      requestStateVersion,
      totals: {
        net: subtotalCents / 100,
        tax: taxCents / 100,
        shipping: shippingCents / 100,
        gross: totalCents / 100,
        currency: 'EUR'
      }
    });
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : 'Osnutka ni mogoče shraniti.'
      },
      { status: error instanceof OrderCommerceError ? error.status : 400 }
    );
  } finally {
    client.release();
  }
}
