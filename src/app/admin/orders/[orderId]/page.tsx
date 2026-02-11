import Link from 'next/link';
import { notFound } from 'next/navigation';
import AdminOrderActions from '@/components/admin/AdminOrderActions';
import AdminOrderEditForm from '@/components/admin/AdminOrderEditForm';
import AdminOrderPdfManager from '@/components/admin/AdminOrderPdfManager';
import AdminOrderPaymentStatus from '@/components/admin/AdminOrderPaymentStatus';
import { getCustomerTypeLabel } from '@/lib/customerType';
import { getStatusLabel } from '@/lib/orderStatus';
import {
  fetchOrderAttachments,
  fetchOrderById,
  fetchOrderDocuments,
  fetchOrderItems,
  fetchPaymentLogs
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
      order_number: 'N-1',
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
        unit_price: 1.9
      }
    ];

    const documents = [
      {
        id: 1,
        type: 'order_summary',
        filename: 'N-1-order-summary.pdf',
        blob_url: '#',
        created_at: new Date().toISOString()
      }
    ];

    const attachments = [
      {
        id: 1,
        type: 'purchase_order',
        filename: 'N-1-narocilnica.pdf',
        blob_url: '#'
      }
    ];

    const paymentLogs = [
      {
        id: 1,
        order_id: 1,
        previous_status: 'unpaid',
        new_status: 'paid',
        note: 'Plačano ob prevzemu.',
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
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50 p-6 text-sm text-amber-700">
            DATABASE_URL ni nastavljen — prikazan je demo pogled.
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
            <div className="space-y-6">
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h1 className="text-2xl font-semibold text-slate-900">{order.order_number}</h1>
                <p className="mt-2 text-sm text-slate-600">Status: {getStatusLabel(order.status)}</p>

                <div className="mt-4 grid gap-4 text-sm text-slate-600 md:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase text-slate-400">Naročnik</p>
                    <p className="font-semibold text-slate-900">{order.organization_name}</p>
                    <p>{getCustomerTypeLabel(order.customer_type)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-400">Kontakt</p>
                    <p>{order.contact_name}</p>
                    <p>{order.email}</p>
                    <p>{order.phone}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-400">Naslov</p>
                    <p>{order.delivery_address}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-400">Sklic</p>
                    <p>{order.reference}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-xs uppercase text-slate-400">Opombe</p>
                    <p>{order.notes}</p>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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
                          <p className="text-slate-500">SKU: {item.sku}</p>
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

              <AdminOrderPdfManager orderId={1} documents={documents} />
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
              />
              <AdminOrderPaymentStatus
                orderId={1}
                status={order.payment_status}
                notes={order.payment_notes}
                logs={paymentLogs}
              />

              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Priponke</h2>
                <ul className="mt-4 space-y-2 text-sm text-slate-600">
                  {attachments.map((attachment) => (
                    <li key={attachment.filename}>
                      <a
                        href={attachment.blob_url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-brand-600 hover:text-brand-700"
                      >
                        {attachment.type.replace('_', ' ').toUpperCase()}
                      </a>{' '}
                      <span className="text-xs text-slate-400">({attachment.filename})</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <AdminOrderActions orderId={1} status={order.status} />
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

  const [items, documents, attachments, paymentLogs] = await Promise.all([
    fetchOrderItems(orderId),
    fetchOrderDocuments(orderId),
    fetchOrderAttachments(orderId),
    fetchPaymentLogs(orderId)
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
      <div className="mx-auto max-w-6xl">
        <Link href="/admin/orders" className="text-sm font-semibold text-brand-600">
          ← Nazaj na seznam
        </Link>

        <div className="mt-4 grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h1 className="text-2xl font-semibold text-slate-900">{order.order_number}</h1>
              <p className="mt-2 text-sm text-slate-600">Status: {getStatusLabel(order.status)}</p>

              <div className="mt-4 grid gap-4 text-sm text-slate-600 md:grid-cols-2">
                <div>
                  <p className="text-xs uppercase text-slate-400">Naročnik</p>
                  <p className="font-semibold text-slate-900">
                    {order.organization_name || order.contact_name}
                  </p>
                  <p>{getCustomerTypeLabel(order.customer_type)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400">Kontakt</p>
                  <p>{order.contact_name}</p>
                  <p>{order.email}</p>
                  {order.phone && <p>{order.phone}</p>}
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400">Naslov</p>
                  <p>{order.delivery_address || 'Ni podan.'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400">Sklic</p>
                  <p>{order.reference || 'Ni podan.'}</p>
                </div>
                {order.notes && (
                  <div className="md:col-span-2">
                    <p className="text-xs uppercase text-slate-400">Opombe</p>
                    <p>{order.notes}</p>
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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
                        <p className="text-slate-500">SKU: {item.sku}</p>
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

            <AdminOrderPdfManager orderId={orderId} documents={documents} />
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
            />
            <AdminOrderPaymentStatus
              orderId={orderId}
              status={order.payment_status ?? null}
              notes={order.payment_notes ?? null}
              logs={paymentLogs}
            />

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Priponke</h2>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                {attachments.length === 0 ? (
                  <li>Ni naloženih priponk.</li>
                ) : (
                  attachments.map((attachment) => (
                    <li key={attachment.id}>
                      <a
                        href={attachment.blob_url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-brand-600 hover:text-brand-700"
                      >
                        {attachment.type.replace('_', ' ').toUpperCase()}
                      </a>{' '}
                      <span className="text-xs text-slate-400">({attachment.filename})</span>
                    </li>
                  ))
                )}
              </ul>
            </section>
          </div>

          <AdminOrderActions orderId={orderId} status={order.status} />
        </div>
      </div>
    </div>
  );
}
