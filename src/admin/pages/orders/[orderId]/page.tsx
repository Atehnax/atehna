import { notFound } from 'next/navigation';
import AdminOrderDetailClient from '@/admin/components/AdminOrderDetailClient';
import {
  fetchOrderById,
  fetchOrderDocuments,
  fetchOrderItems,
  type OrderDocumentRow,
  type OrderItemRow,
  type OrderRow
} from '@/shared/server/orders';
import { instrumentAdminRouteRender, profilePayloadEstimate, profileRoutePhase } from '@/shared/server/catalogDiagnostics';
import { getDatabaseUrl } from '@/shared/server/db';

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
    total: asNumber(order.total, 0)
  };
}

export default async function AdminOrderDetailPage(props: { params: Promise<{ orderId: string }> }) {
  const params = await props.params;
  return instrumentAdminRouteRender('/admin/orders/[orderId]', async () => {
    if (!getDatabaseUrl()) {
      const demoOrder = normalizeOrder(
        {
          id: 1,
          order_number: '#1',
          customer_type: 'school',
          organization_name: 'Osnovna šola Triglav',
          contact_name: 'Maja Kovač',
          email: 'maja.kovac@example.com',
          delivery_address: 'Šolska ulica 1, Ljubljana',
          reference: 'PO-2024-01',
          notes: 'Demo zapis brez povezave na bazo.',
          status: 'received',
          payment_status: 'paid',
          admin_order_notes: null,
          subtotal: 1220,
          tax: 268.4,
          total: 1488.4,
          created_at: new Date().toISOString()
        } as OrderRow,
        1
      );

      const demoItems: OrderItemRow[] = [
        {
          id: 1,
          order_id: 1,
          sku: 'DEMO-1',
          name: 'Demo komplet ustvarjalnega materiala',
          unit: 'kos',
          quantity: 10,
          unit_price: 122,
          total_price: 1220,
          discount_percentage: 0
        }
      ];

      const demoDocuments: OrderDocumentRow[] = [
        {
          id: 1,
          order_id: 1,
          type: 'order_summary',
          filename: '#1-order-summary-v2.pdf',
          blob_url: '#',
          blob_pathname: null,
          created_at: new Date().toISOString()
        },
        {
          id: 2,
          order_id: 1,
          type: 'order_summary',
          filename: '#1-order-summary-v1.pdf',
          blob_url: '#',
          blob_pathname: null,
          created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        }
      ];

      return (
        <AdminOrderDetailClient
          orderId={1}
          order={demoOrder}
          items={demoItems}
          documents={demoDocuments}
          showDemoBanner
        />
      );
    }

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
