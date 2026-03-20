import type { ReactNode } from 'react';
import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import AdminOrderItemsEditor from '@/admin/components/AdminOrderItemsEditor';
import {
  AdminOrderDocumentsSectionSkeleton,
  AdminOrderItemsSectionSkeleton
} from '@/admin/components/AdminPageSkeletons';
import AdminOrderPdfManager from '@/admin/components/AdminOrderPdfManager';
import AdminOrderHeaderChips from '@/admin/components/AdminOrderHeaderChips';
import { toDisplayOrderNumber } from '@/admin/components/adminOrdersTableUtils';
import {
  fetchOrderById,
  fetchOrderDocuments,
  fetchOrderItems,
  type OrderDocumentRow,
  type OrderItemRow,
  type OrderRow
} from '@/shared/server/orders';
import { getDatabaseUrl } from '@/shared/server/db';
import { instrumentCatalogRouteEntry } from '@/shared/server/catalogDiagnostics';

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
    phone: asText(order.phone),
    delivery_address: asText(order.delivery_address),
    reference: asText(order.reference),
    notes: asText(order.notes),
    status: asText(order.status, 'received'),
    payment_status: asText(order.payment_status, 'unpaid'),
    payment_notes: asText(order.payment_notes),
    created_at: asText(order.created_at, new Date().toISOString()),
    subtotal: asNumber(order.subtotal, 0),
    tax: asNumber(order.tax, 0),
    total: asNumber(order.total, 0)
  };
}

function AdminOrderDetailShell({
  orderId,
  order,
  itemsSection,
  documentsSection,
  showDemoBanner = false
}: {
  orderId: number;
  order: ReturnType<typeof normalizeOrder>;
  itemsSection: ReactNode;
  documentsSection: ReactNode;
  showDemoBanner?: boolean;
}) {
  return (
    <div className="w-full">
      <div className="mx-auto max-w-7xl">
        {showDemoBanner ? (
          <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50 p-6 text-sm text-amber-700">
            DATABASE_URL ni nastavljen — prikazan je demo pogled.
          </div>
        ) : null}

        {!showDemoBanner ? (
          <Link href="/admin/orders" className="text-sm font-semibold text-[color:var(--blue-500)] hover:text-[color:var(--blue-600)]">
            ← Nazaj na seznam
          </Link>
        ) : null}

        {order.is_draft ? (
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            To naročilo je osnutek. Izpolnite podatke in shranite, da bo vidno na seznamu naročil.
          </div>
        ) : null}

        {order.deleted_at ? (
          <div className="mt-3 rounded-lg border border-rose-300/80 bg-rose-100/70 px-3 py-2 text-sm font-semibold text-rose-800">
            To naročilo je bilo izbrisano.
          </div>
        ) : null}

        <div className={showDemoBanner ? 'mt-6' : 'mt-4'}>
          <div className="grid items-start gap-6 lg:grid-cols-[2fr_1.5fr]">
            <div className="space-y-6">
              <AdminOrderHeaderChips
                orderId={orderId}
                orderNumber={toDisplayOrderNumber(order.order_number)}
                status={order.status}
                paymentStatus={order.payment_status ?? null}
                customerType={order.customer_type}
                organizationName={order.organization_name}
                contactName={order.contact_name}
                email={order.email}
                deliveryAddress={order.delivery_address}
                notes={order.notes}
                createdAt={order.created_at}
              />

              {itemsSection}
            </div>

            <aside className="w-full min-w-0 space-y-5">
              {documentsSection}
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

async function AdminOrderItemsSection({
  orderId,
  itemsPromise,
  initialSubtotal,
  initialTax,
  initialTotal
}: {
  orderId: number;
  itemsPromise: Promise<OrderItemRow[]>;
  initialSubtotal: number;
  initialTax: number;
  initialTotal: number;
}) {
  const items = await itemsPromise;

  return (
    <AdminOrderItemsEditor
      orderId={orderId}
      items={items}
      initialSubtotal={initialSubtotal}
      initialTax={initialTax}
      initialTotal={initialTotal}
    />
  );
}

async function AdminOrderDocumentsSection({
  orderId,
  documentsPromise,
  paymentStatus,
  paymentNotes
}: {
  orderId: number;
  documentsPromise: Promise<OrderDocumentRow[]>;
  paymentStatus?: string | null;
  paymentNotes?: string | null;
}) {
  const documents = await documentsPromise;

  return <AdminOrderPdfManager orderId={orderId} documents={documents} paymentStatus={paymentStatus} paymentNotes={paymentNotes} />;
}

export default async function AdminOrderDetailPage({
  params
}: {
  params: { orderId: string };
}) {
  return instrumentCatalogRouteEntry('/admin/orders/[orderId]', async () => {
    if (!getDatabaseUrl()) {
      const demoOrder = normalizeOrder(
        {
          id: 1,
          order_number: '#1',
          status: 'received',
          organization_name: 'Osnovna šola Triglav',
          contact_name: 'Maja Kovač',
          customer_type: 'school',
          email: 'maja.kovac@example.com',
          phone: '041 555 123',
          delivery_address: 'Šolska ulica 1, Ljubljana',
          reference: 'PO-2024-01',
          notes: 'Prosimo za dobavo do konca meseca.',
          payment_status: 'paid',
          payment_notes: 'Plačano ob prevzemu.',
          is_draft: false,
          deleted_at: params.orderId === '1' ? new Date().toISOString() : null,
          created_at: new Date().toISOString(),
          subtotal: 19,
          tax: 4.18,
          total: 23.18
        },
        1
      );

      const demoItems: OrderItemRow[] = [
        {
          id: 1,
          order_id: 1,
          name: 'Tehnični svinčnik 0,5 mm',
          sku: 'RT-TS-01',
          quantity: 10,
          unit: 'kos',
          unit_price: 1.9,
          total_price: 19,
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
        <AdminOrderDetailShell
          orderId={1}
          order={demoOrder}
          showDemoBanner
          itemsSection={
            <AdminOrderItemsEditor
              orderId={1}
              items={demoItems}
              initialSubtotal={demoOrder.subtotal}
              initialTax={demoOrder.tax}
              initialTotal={demoOrder.total}
            />
          }
          documentsSection={
            <AdminOrderPdfManager
              orderId={1}
              documents={demoDocuments}
              paymentStatus={demoOrder.payment_status}
              paymentNotes={demoOrder.payment_notes}
            />
          }
        />
      );
    }

    const orderId = Number(params.orderId);
    if (!Number.isFinite(orderId)) {
      notFound();
    }

    const orderPromise = fetchOrderById(orderId);
    const itemsPromise = fetchOrderItems(orderId);
    const documentsPromise = fetchOrderDocuments(orderId);

    const order = await orderPromise;
    if (!order) {
      notFound();
    }

    const safeOrder = normalizeOrder(order, orderId);

    return (
      <AdminOrderDetailShell
        orderId={orderId}
        order={safeOrder}
        itemsSection={
          <Suspense fallback={<AdminOrderItemsSectionSkeleton />}>
            <AdminOrderItemsSection
              orderId={orderId}
              itemsPromise={itemsPromise}
              initialSubtotal={safeOrder.subtotal}
              initialTax={safeOrder.tax}
              initialTotal={safeOrder.total}
            />
          </Suspense>
        }
        documentsSection={
          <Suspense fallback={<AdminOrderDocumentsSectionSkeleton />}>
            <AdminOrderDocumentsSection
              orderId={orderId}
              documentsPromise={documentsPromise}
              paymentStatus={safeOrder.payment_status}
              paymentNotes={safeOrder.payment_notes}
            />
          </Suspense>
        }
      />
    );
  });
}
