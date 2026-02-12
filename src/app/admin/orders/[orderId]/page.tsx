import Link from 'next/link';
import { notFound } from 'next/navigation';
import AdminOrderActions from '@/components/admin/AdminOrderActions';
import AdminOrderEditForm from '@/components/admin/AdminOrderEditForm';
import AdminOrderPdfManager from '@/components/admin/AdminOrderPdfManager';
import AdminOrderHeaderChips from '@/components/admin/AdminOrderHeaderChips';
import AdminOrderOverviewCard from '@/components/admin/AdminOrderOverviewCard';
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

const toAmount = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

const formatCurrency = (value: number | null | undefined) =>
  new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR' }).format(toAmount(value));

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
      payment_notes: 'Plačano ob prevzemu.'
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
        filename: '#1-order-summary.pdf',
        blob_url: '#',
        created_at: new Date().toISOString()
      }
    ];

    const subtotal = items.reduce(
      (sum, item) => sum + toAmount(item.unit_price) * item.quantity,
      0
    );
    const tax = subtotal * 0.22;
    const total = subtotal + tax;

    return (
      <div className="container-base py-12">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50 p-6 text-sm text-amber-700">
            DATABASE_URL ni nastavljen — prikazan je demo pogled.
          </div>

          <div className="mt-6 space-y-6">
            <div className="grid items-stretch gap-6 lg:grid-cols-[2fr_1.5fr]">
              <section className="h-full rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <AdminOrderHeaderChips
                  orderNumber={toDisplayOrderNumber(order.order_number)}
                  status={order.status}
                  paymentStatus={order.payment_status ?? null}
                />

                <AdminOrderOverviewCard
                  organizationName={order.organization_name}
                  contactName={order.contact_name}
                  customerType={order.customer_type}
                  email={order.email}
                  deliveryAddress={order.delivery_address}
                  notes={order.notes}
                />
              </section>

              <AdminOrderActions
                orderId={1}
                status={order.status}
                paymentStatus={order.payment_status}
                paymentNotes={order.payment_notes}
              />
            </div>

            <div className="grid items-start gap-6 lg:grid-cols-[2fr_1.5fr]">
              <div className="space-y-6">
                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-semibold text-slate-900">Postavke</h2>
                  <div className="mt-4 space-y-3">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900">{item.name}</p>
                            <p className="text-slate-500">
                              Količina: {item.quantity} {item.unit ?? ''}
                            </p>
                          </div>
                          <div className="text-right text-sm text-slate-600">
                            <p>Enota: {formatCurrency(item.unit_price)}</p>
                            <p className="font-semibold text-slate-900">
                              Skupaj: {formatCurrency(toAmount(item.unit_price) * item.quantity)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}

                    <div className="rounded-xl border border-slate-100 bg-white p-4 text-sm text-slate-700">
                      <div className="flex items-center justify-between">
                        <span>Vmesni seštevek</span>
                        <span className="font-semibold">{formatCurrency(subtotal)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>DDV</span>
                        <span className="font-semibold">{formatCurrency(tax)}</span>
                      </div>
                      <div className="flex items-center justify-between text-base font-semibold text-slate-900">
                        <span>Skupaj</span>
                        <span>{formatCurrency(total)}</span>
                      </div>
                    </div>
                  </div>
                </section>

                <AdminOrderEditForm
                  orderId={1}
                  customerType={order.customer_type}
                  organizationName={order.organization_name}
                  contactName={order.contact_name}
                  email={order.email}
                  phone={order.phone}
                  deliveryAddress={order.delivery_address}
                  reference={order.reference}
                  notes={order.notes}
                  items={items}
                />
              </div>

              <aside className="space-y-5">
                <AdminOrderPdfManager orderId={1} documents={documents} />
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

  const computedSubtotal = items.reduce(
    (sum, item) => sum + toAmount(item.unit_price) * item.quantity,
    0
  );
  const subtotal = typeof order.subtotal === 'number' ? order.subtotal : computedSubtotal;
  const tax = typeof order.tax === 'number' ? order.tax : subtotal * 0.22;
  const total = typeof order.total === 'number' ? order.total : subtotal + tax;

  return (
    <div className="container-base py-12">
      <div className="mx-auto max-w-7xl">
        <Link href="/admin/orders" className="text-sm font-semibold text-brand-600">
          ← Nazaj na seznam
        </Link>

        <div className="mt-4 space-y-6">
          <div className="grid items-stretch gap-6 lg:grid-cols-[2fr_1.5fr]">
            <section className="h-full rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <AdminOrderHeaderChips
                orderNumber={toDisplayOrderNumber(order.order_number)}
                status={order.status}
                paymentStatus={order.payment_status ?? null}
              />

              <AdminOrderOverviewCard
                organizationName={order.organization_name}
                contactName={order.contact_name}
                customerType={order.customer_type}
                email={order.email}
                deliveryAddress={order.delivery_address}
                notes={order.notes}
              />
            </section>

            <AdminOrderActions
              orderId={orderId}
              status={order.status}
              paymentStatus={order.payment_status ?? null}
              paymentNotes={order.payment_notes ?? null}
            />
          </div>

          <div className="grid items-start gap-6 lg:grid-cols-[2fr_1.5fr]">
            <div className="space-y-6">
              <AdminOrderEditForm
                orderId={orderId}
                customerType={order.customer_type}
                organizationName={order.organization_name}
                contactName={order.contact_name}
                email={order.email}
                phone={order.phone}
                deliveryAddress={order.delivery_address}
                reference={order.reference}
                notes={order.notes}
                items={items}
              />
            </div>

            <aside className="space-y-5">
              <AdminOrderPdfManager orderId={orderId} documents={documents} />
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
