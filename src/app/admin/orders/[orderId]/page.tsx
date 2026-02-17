import Link from 'next/link';
import { notFound } from 'next/navigation';
import AdminOrderItemsEditor from '@/components/admin/AdminOrderItemsEditor';
import AdminOrderPdfManager from '@/components/admin/AdminOrderPdfManager';
import AdminOrderHeaderChips from '@/components/admin/AdminOrderHeaderChips';
import { toDisplayOrderNumber } from '@/components/admin/adminOrdersTableUtils';
import {
  fetchOrderById,
  fetchOrderDocuments,
  fetchOrderItems
} from '@/lib/server/orders';

export const metadata = {
  title: 'Podrobnosti naročila'
};

export const dynamic = 'force-dynamic';


const asText = (value: unknown, fallback = '') => (typeof value === 'string' ? value : fallback);

export default async function AdminOrderDetailPage({
  params
}: {
  params: { orderId: string };
}) {
  if (!process.env.DATABASE_URL) {
    const order = {
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
      created_at: new Date().toISOString()
    };

    const items = [
      {
        id: 1,
        name: 'Tehnični svinčnik 0,5 mm',
        sku: 'RT-TS-01',
        quantity: 10,
        unit: 'kos',
        unit_price: 1.9,
        total_price: 19,
        discount_percentage: 0
      }
    ];

    const documents = [
      {
        id: 1,
        type: 'order_summary',
        filename: '#1-order-summary-v2.pdf',
        blob_url: '#',
        created_at: new Date().toISOString()
      },
      {
        id: 2,
        type: 'order_summary',
        filename: '#1-order-summary-v1.pdf',
        blob_url: '#',
        created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      }
    ];


    return (
      <div className="container-base py-12">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50 p-6 text-sm text-amber-700">
            DATABASE_URL ni nastavljen — prikazan je demo pogled.
          </div>

          {order.is_draft && (
            <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              To naročilo je osnutek. Izpolnite podatke in shranite, da bo vidno na seznamu naročil.
            </div>
          )}

          {order.deleted_at ? (
            <div className="mt-3 rounded-lg border border-rose-300/80 bg-rose-100/70 px-3 py-2 text-sm font-semibold text-rose-800">
              To naročilo je bilo izbrisano.
            </div>
          ) : null}

          <div className="mt-6">
            <div className="grid items-start gap-6 lg:grid-cols-[2fr_1.5fr]">
              <div className="space-y-6">
                <AdminOrderHeaderChips
                  orderId={1}
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

                <AdminOrderItemsEditor orderId={1} items={items} />
              </div>

              <aside className="w-full min-w-0 space-y-5">
                <AdminOrderPdfManager orderId={1} documents={documents} paymentStatus={order.payment_status} paymentNotes={order.payment_notes} />
              </aside>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const orderId = Number(params.orderId);
  if (!Number.isFinite(orderId)) {
    notFound();
  }

  const order = await fetchOrderById(orderId);
  if (!order) {
    notFound();
  }

  const [items, documents] = await Promise.all([
    fetchOrderItems(orderId),
    fetchOrderDocuments(orderId)
  ]);

  const safeOrder = {
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
    created_at: asText(order.created_at, new Date().toISOString())
  };


  return (
    <div className="container-base py-12">
      <div className="mx-auto max-w-7xl">
        <Link href="/admin/orders" className="text-sm font-semibold text-brand-600">
          ← Nazaj na seznam
        </Link>

        {safeOrder.is_draft && (
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            To naročilo je osnutek. Izpolnite podatke in shranite, da bo vidno na seznamu naročil.
          </div>
        )}

        {safeOrder.deleted_at ? (
          <div className="mt-3 rounded-lg border border-rose-300/80 bg-rose-100/70 px-3 py-2 text-sm font-semibold text-rose-800">
            To naročilo je bilo izbrisano.
          </div>
        ) : null}

        <div className="mt-4">
          <div className="grid items-start gap-6 lg:grid-cols-[2fr_1.5fr]">
            <div className="space-y-6">
              <AdminOrderHeaderChips
                orderId={orderId}
                orderNumber={toDisplayOrderNumber(safeOrder.order_number)}
                status={safeOrder.status}
                paymentStatus={safeOrder.payment_status ?? null}
                customerType={safeOrder.customer_type}
                organizationName={safeOrder.organization_name}
                contactName={safeOrder.contact_name}
                email={safeOrder.email}
                deliveryAddress={safeOrder.delivery_address}
                notes={safeOrder.notes}
                createdAt={safeOrder.created_at}
              />

              <AdminOrderItemsEditor orderId={orderId} items={items} />
            </div>

            <aside className="w-full min-w-0 space-y-5">
              <AdminOrderPdfManager orderId={orderId} documents={documents} paymentStatus={safeOrder.payment_status} paymentNotes={safeOrder.payment_notes} />
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
