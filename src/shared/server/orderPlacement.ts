import 'server-only';

import type { PoolClient } from 'pg';
import type { CustomerType } from '@/shared/domain/order/customerType';
import type { OrderContractStatus } from '@/shared/domain/order/contractStatus';
import { moneyToDatabaseValue } from '@/shared/server/orderCommerce';
import { isStockEnforcementEnabled } from '@/shared/server/inventoryPolicy';
import { commitOrderStockHolds } from '@/shared/server/orderStockHolds';

export type OrderPlacementCustomer = {
  customerType: CustomerType;
  organizationName: string | null;
  contactName: string;
  email: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  postalCode: string;
  countryCode: string;
  gursHouseNumberId: string | null;
  reference: string | null;
  notes: string | null;
};

export type FrozenOrderLine = {
  variantId: number;
  productId: number;
  productSlug: string;
  productName: string;
  variantName: string;
  sku: string;
  unit: string | null;
  quantity: number;
  categoryId: string | null;
  categoryPath: string | null;
  attributes: Record<string, string | number>;
  imageUrl: string | null;
  listUnitNet: number;
  discountPct: number;
  unitNet: number;
  unitTax: number;
  unitGross: number;
  lineNet: number;
  lineTax: number;
  lineGross: number;
  taxRate: number;
  snapshot: Record<string, unknown>;
};

type ContractActor = {
  type:
    | 'customer'
    | 'admin'
    | 'system'
    | 'school_purchase_order'
    | 'legacy_backfill';
  id?: string | null;
};

export type PlaceOrderInput = {
  customer: OrderPlacementCustomer;
  items: readonly FrozenOrderLine[];
  totals: {
    net: number;
    tax: number;
    shipping: number;
    gross: number;
    currency: 'EUR';
  };
  shipping: {
    automaticAmount: number | null;
    snapshot: Record<string, unknown>;
    override: Record<string, unknown> | null;
    parcelCount?: number;
  };
  pricingVersion: string;
  commitmentStatus: 'binding' | 'pending_confirmation';
  contractStatus: OrderContractStatus;
  contractActor?: ContractActor;
  contractAcceptedAt?: string;
  contractEvidence?: Record<string, unknown> | null;
  sourceQuoteOfferVersionId?: number | null;
  commitStock: boolean;
  stockEnforcementEnabled?: boolean;
  stockActor: ContractActor;
};

export type PlacedOrder = {
  orderId: number;
  orderNumber: string;
  createdAt: string;
  commitmentStatus: 'binding' | 'pending_confirmation';
  contractStatus: OrderContractStatus;
  stockNotCommitted: boolean;
};

export async function placeOrderFromFrozenSnapshot(
  client: PoolClient,
  input: PlaceOrderInput
): Promise<PlacedOrder> {
  if (input.items.length === 0) {
    throw new Error('Naročilo mora vsebovati vsaj eno postavko.');
  }
  if (!Number.isFinite(input.totals.shipping) || !Number.isFinite(input.totals.gross)) {
    throw new Error('Naročila brez dokončne poštnine ni mogoče ustvariti.');
  }
  if (input.contractStatus === 'accepted' && !input.contractActor) {
    throw new Error('Sprejeto naročilo mora vsebovati dokaz o sprejemu pogodbe.');
  }
  const taxRates = Array.from(new Set(input.items.map((item) => item.taxRate)));
  const orderTaxRate = taxRates.length === 1 ? taxRates[0] : 0.22;
  const acceptedAt =
    input.contractStatus === 'accepted'
      ? new Date(input.contractAcceptedAt ?? Date.now())
      : null;
  if (acceptedAt && Number.isNaN(acceptedAt.getTime())) {
    throw new Error('Čas sprejema pogodbe ni veljaven.');
  }
  const stockEnforcementEnabled =
    input.stockEnforcementEnabled ??
    (await isStockEnforcementEnabled(client));
  const shouldCommitStock = input.commitStock && stockEnforcementEnabled;
  const contractEvidence =
    input.contractStatus === 'accepted'
      ? {
          ...(input.contractEvidence ?? {}),
          stockEnforcementApplied: shouldCommitStock,
          stockEnforcementEnabledAtAcceptance: stockEnforcementEnabled
        }
      : null;

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
        automatic_shipping,
        shipping_snapshot_json,
        shipping_override_json,
        shipping_override_stale,
        parcel_count,
        total,
        currency,
        tax_rate,
        pricing_version,
        commitment_status,
        contract_status,
        contract_accepted_at,
        contract_accepted_actor_type,
        contract_accepted_actor_id,
        contract_acceptance_evidence_json,
        contract_state_version,
        committed_at,
        stock_enforcement_applied,
        source_quote_offer_version_id,
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
        $17::jsonb,
        $18::jsonb,
        false,
        $19,
        $20,
        'EUR',
        $21,
        $22,
        $23,
        $24,
        $25,
        $26,
        $27,
        $28::jsonb,
        1,
        $25,
        $29,
        $30,
        false
      from next_id
      returning id, order_number, created_at
    `,
    [
      input.customer.customerType,
      input.customer.organizationName,
      input.customer.contactName,
      input.customer.email,
      input.customer.addressLine1,
      input.customer.postalCode,
      input.customer.city,
      input.customer.gursHouseNumberId,
      input.customer.addressLine2,
      input.customer.countryCode,
      input.customer.reference,
      input.customer.notes,
      moneyToDatabaseValue(input.totals.net),
      moneyToDatabaseValue(input.totals.tax),
      moneyToDatabaseValue(input.totals.shipping),
      input.shipping.automaticAmount === null
        ? null
        : moneyToDatabaseValue(input.shipping.automaticAmount),
      JSON.stringify(input.shipping.snapshot),
      input.shipping.override ? JSON.stringify(input.shipping.override) : null,
      input.shipping.parcelCount ?? 1,
      moneyToDatabaseValue(input.totals.gross),
      orderTaxRate,
      input.pricingVersion,
      input.commitmentStatus,
      input.contractStatus,
      acceptedAt?.toISOString() ?? null,
      input.contractActor?.type ?? null,
      input.contractActor?.id ?? null,
      contractEvidence ? JSON.stringify(contractEvidence) : null,
      stockEnforcementEnabled,
      input.sourceQuoteOfferVersionId ?? null
    ]
  );
  const order = orderResult.rows[0] as {
    id: string | number;
    order_number: string;
    created_at: string | Date;
  };
  const orderId = Number(order.id);

  for (const [index, item] of input.items.entries()) {
    const orderItemResult = await client.query(
      `
        insert into order_items (
          order_id, sku, name, unit, quantity, catalog_item_id,
          catalog_variant_id, product_slug, variant_name, category_id,
          category_path, selected_attributes, image_url, base_unit_net,
          discount_pct, unit_net, unit_tax, unit_gross, line_net, line_tax,
          line_gross, tax_rate, currency, product_snapshot_json
        )
        values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb,
          $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, 'EUR', $23::jsonb
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
    const orderItemId = Number(orderItemResult.rows[0]?.id);

    await client.query(
      `
        insert into order_line_snapshots (
          order_id, order_item_id, line_number, catalog_item_id,
          catalog_variant_id, product_slug, product_name, variant_name, sku,
          unit, quantity, category_id, category_path, selected_attributes,
          image_url, base_unit_net, discount_pct, unit_net, unit_tax,
          unit_gross, line_net, line_tax, line_gross, tax_rate, currency,
          snapshot_json
        )
        values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
          $14::jsonb, $15, $16, $17, $18, $19, $20, $21, $22, $23,
          $24, 'EUR', $25::jsonb
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

  if (shouldCommitStock) {
    await commitOrderStockHolds(
      client,
      orderId,
      input.items.map((item) => ({
        variantId: item.variantId,
        quantity: item.quantity,
        label: `${item.productName} – ${item.variantName}`
      })),
      input.stockActor
    );
  }

  return {
    orderId,
    orderNumber: order.order_number,
    createdAt:
      order.created_at instanceof Date
        ? order.created_at.toISOString()
        : String(order.created_at),
    commitmentStatus: input.commitmentStatus,
    contractStatus: input.contractStatus,
    stockNotCommitted: !shouldCommitStock
  };
}
