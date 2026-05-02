import { notFound } from 'next/navigation';
import AdminOrderDetailClient from '@/admin/components/AdminOrderDetailClient';
import {
  fetchOrderById,
  fetchOrderDocuments,
  fetchOrderItems
} from '@/shared/server/orders';
import type { OrderRow } from '@/shared/domain/order/orderTypes';
import { instrumentAdminRouteRender, profilePayloadEstimate, profileRoutePhase } from '@/shared/server/catalogDiagnostics';

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

function normalizeOrder(order: OrderRow, orderId: number) {
  return {
    ...order,
    order_number: asText(order.order_number, `#${orderId}`),
    customer_type: asText(order.customer_type, 'company'),
    organization_name: asText(order.organization_name),
    contact_name: asText(order.contact_name, ''),
    email: asText(order.email, ''),
    delivery_address: asText(order.delivery_address),
    postal_code: asText((order as Record<string, unknown>).postal_code),
    reference: asText(order.reference),
    notes: asText(order.notes),
    status: asText(order.status, 'received'),
    payment_status: asText(order.payment_status, 'unpaid'),
    admin_order_notes: asText(order.admin_order_notes),
    created_at: asText(order.created_at, new Date().toISOString()),
    subtotal: asNumber(order.subtotal, 0),
    tax: asNumber(order.tax, 0),
    shipping: asNumber(order.shipping, 0),
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

    const orderPromise = profileRoutePhase('db', 'AdminOrderDetailPage:fetchOrderById', () => fetchOrderById(orderId));
    const itemsPromise = profileRoutePhase('db', 'AdminOrderDetailPage:fetchOrderItems', () => fetchOrderItems(orderId));
    const documentsPromise = profileRoutePhase('db', 'AdminOrderDetailPage:fetchOrderDocuments', () => fetchOrderDocuments(orderId));

    const [order, items, documents] = await Promise.all([orderPromise, itemsPromise, documentsPromise]);
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
