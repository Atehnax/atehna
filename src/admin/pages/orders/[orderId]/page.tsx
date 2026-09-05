import { notFound } from 'next/navigation';
import AdminOrderDetailClient from '@/admin/features/orders/components/AdminOrderDetailClient';
import { fetchOrderDetailSnapshot } from '@/shared/server/orders';
import type { OrderRow } from '@/shared/domain/order/orderTypes';
import { instrumentAdminRouteRender, profilePayloadEstimate, profileRoutePhase } from '@/shared/server/diagnostics/instrumentation';

export const metadata = {
  title: 'Podrobnosti naročila'
};

export const dynamic = 'force-dynamic';

const asText = (value: unknown, fallback = '') => (typeof value === 'string' ? value : fallback);
const asNumber = (value: unknown, fallback = 0) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};
const asNullableText = (value: unknown) => value === null || value === undefined ? null : String(value);

function normalizeOrder(order: OrderRow, orderId: number) {
  return {
    ...order,
    order_number: asText(order.order_number, `#${orderId}`),
    order_code: asText(order.order_code),
    customer_type: asText(order.customer_type, 'company'),
    organization_name: asText(order.organization_name),
    contact_name: asText(order.contact_name, ''),
    email: asText(order.email, ''),
    address_line1: asText(order.address_line1),
    address_line2: asText(order.address_line2),
    postal_code: asText(order.postal_code),
    city: asText(order.city),
    gurs_house_number_id: asText(order.gurs_house_number_id),
    country_code: asText(order.country_code, 'SI'),
    commitment_status: asText(
      (order as Record<string, unknown>).commitment_status,
      order.customer_type === 'school' ? 'pending_confirmation' : 'binding'
    ) as 'binding' | 'pending_confirmation' | 'rejected',
    contract_status: (
      order.contract_status === 'accepted'
      || order.contract_status === 'rejected'
      || order.contract_status === 'pending_seller_acceptance'
        ? order.contract_status
        : order.source_quote_offer_version_id
          ? 'accepted'
          : 'pending_seller_acceptance'
    ),
    contract_accepted_at: asNullableText(order.contract_accepted_at),
    contract_accepted_actor_type: asNullableText(order.contract_accepted_actor_type),
    contract_accepted_actor_id: asNullableText(order.contract_accepted_actor_id),
    contract_accepted_evidence_json: order.contract_accepted_evidence_json ?? null,
    contract_rejected_at: asNullableText(order.contract_rejected_at),
    contract_rejected_actor_type: asNullableText(order.contract_rejected_actor_type),
    contract_rejected_actor_id: asNullableText(order.contract_rejected_actor_id),
    contract_rejected_evidence_json: order.contract_rejected_evidence_json ?? null,
    contract_rejected_reason: asNullableText(order.contract_rejected_reason),
    committed_at: asNullableText(order.committed_at),
    source_quote_offer_version_id: order.source_quote_offer_version_id ?? null,
    source_quote_request_id: order.source_quote_request_id ?? null,
    source_quote_request_number: order.source_quote_request_number ?? null,
    source_quote_offer_number: order.source_quote_offer_number ?? null,
    source_quote_code: order.source_quote_code ?? null,
    source_quote_offer_code: order.source_quote_offer_code ?? null,
    reference: asText(order.reference),
    notes: asText(order.notes),
    status: asText(order.status, 'received'),
    payment_status: asText(order.payment_status, 'unpaid'),
    admin_order_notes: asText(order.admin_order_notes),
    created_at: asText(order.created_at, new Date().toISOString()),
    subtotal: asNumber(order.subtotal, 0),
    tax: asNumber(order.tax, 0),
    tax_rate: asNumber(order.tax_rate, 0.22),
    shipping: asNumber(order.shipping, 0),
    automatic_shipping: order.automatic_shipping === null ? null : asNumber(order.automatic_shipping, 0),
    shipping_snapshot_json: order.shipping_snapshot_json ?? null,
    shipping_override_json: order.shipping_override_json ?? null,
    shipping_override_stale: Boolean(order.shipping_override_stale),
    parcel_count: Math.max(1, Math.trunc(asNumber(order.parcel_count, 1))),
    pricing_revision: Math.max(1, Math.trunc(asNumber(order.pricing_revision, 1))),
    total: asNumber(order.total, 0)
  };
}

export default async function AdminOrderDetailPage(props: { params: Promise<{ orderId: string }> }) {
  const params = await props.params;
  return instrumentAdminRouteRender('/admin/orders/[orderId]', async () => {
    const orderId = Number(params.orderId);
    if (!Number.isFinite(orderId)) {
      notFound();
    }

    const { order, items, documents } = await profileRoutePhase(
      'db',
      'AdminOrderDetailPage:fetchOrderDetailSnapshot',
      () => fetchOrderDetailSnapshot(orderId)
    );
    if (!order) {
      notFound();
    }

    const safeOrder = normalizeOrder(order, orderId);

    await profileRoutePhase('payload', 'AdminOrderDetailPage:order', async () => {
      profilePayloadEstimate('AdminOrderDetailPage:order', safeOrder);
    });

    return (
      <AdminOrderDetailClient
        orderId={orderId}
        order={safeOrder}
        items={items}
        documents={documents}
      />
    );
  });
}
