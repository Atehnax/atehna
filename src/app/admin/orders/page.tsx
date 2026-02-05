import Link from 'next/link';
import AdminOrdersPdfCell from '@/components/admin/AdminOrdersPdfCell';
import AdminOrderStatusSelect from '@/components/admin/AdminOrderStatusSelect';
import AdminOrdersDownloadControls from '@/components/admin/AdminOrdersDownloadControls';
import AdminOrdersRowActions from '@/components/admin/AdminOrdersRowActions';
import { getCustomerTypeLabel } from '@/lib/customerType';
import {
  fetchOrderAttachmentsForOrders,
  fetchOrderDocumentsForOrders,
  fetchOrders
} from '@/lib/server/orders';

export const metadata = {
  title: 'Administracija naročil'
};

export const dynamic = 'force-dynamic';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR' }).format(value);

const getPaymentBadge = (status?: string | null) => {
  if (status === 'paid') return 'bg-emerald-100 text-emerald-700';
  if (status === 'refunded') return 'bg-amber-100 text-amber-700';
  if (status === 'cancelled') return 'bg-rose-100 text-rose-700';
  return 'bg-slate-100 text-slate-600';
};

const getPaymentLabel = (status?: string | null) => {
  if (status === 'paid') return 'Plačano';
  if (status === 'refunded') return 'Povrnjeno';
  if (status === 'cancelled') return 'Preklicano';
  return 'Neplačano';
};

export default async function AdminOrdersPage({
  searchParams
}: {
  searchParams?: { from?: string; to?: string; q?: string };
}) {
  const from = searchParams?.from ?? '';
  const to = searchParams?.to ?? '';
  const query = searchParams?.q ?? '';

  if (!process.env.DATABASE_URL) {
    const demoOrders = [
      {
        id: 1,
        order_number: 'ORD-1',
        customer_type: 'school',
        organization_name: 'Osnovna šola Triglav',
        contact_name: 'Maja Kovač',
        email: 'maja.kovac@example.com',
        phone: '041 555 123',
        delivery_address: 'Šolska ulica 1, Ljubljana',
        reference: 'PO-2024-01',
        notes: null,
        status: 'received',
        payment_status: 'paid',
        payment_notes: null,
        subtotal: 0,
        tax: 0,
        total: 0,
        created_at: new Date().toISOString()
      }
    ];
    const demoDocuments = [
      {
        id: 1,
        order_id: 1,
        type: 'order_summary',
        filename: 'ORD-1-order-summary.pdf',
        blob_url: '#',
        blob_pathname: null,
        created_at: new Date().toISOString()
      }
    ];
    const demoAttachments = [
      {
        id: 1,
        order_id: 1,
        type: 'purchase_order',
        filename: 'ORD-1-narocilnica.pdf',
        blob_url: '#',
        created_at: new Date().toISOString()
      }
    ];
    const documentsByOrder = new Map<number, typeof demoDocuments>();
    const attachmentsByOrder = new Map<number, typeof demoAttachments>();
    documentsByOrder.set(1, demoDocuments);
    attachmentsByOrder.set(1, demoAttachments);

    return (
      <div className="container-base py-12">
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50 p-6 text-sm text-amber-700">
            DATABASE_URL ni nastavljen — prikazan je demo pogled.
          </div>

          <form className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
              <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                <div className="flex-1">
                  <label className="text-xs font-semibold uppercase text-slate-500">Od</label>
                  <input
                    type="date"
                    name="from"
                    defaultValue={from}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-semibold uppercase text-slate-500">Do</label>
                  <input
                    type="date"
                    name="to"
                    defaultValue={to}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex-[2]">
                  <label className="text-xs font-semibold uppercase text-slate-500">
                    Iskanje
                  </label>
                  <input
                    type="text"
                    name="q"
                    defaultValue={query}
                    placeholder="Šola, kontakt, naslov"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
              >
                Filtriraj
              </button>
            </div>
          </form>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Št. naročila</th>
                  <th className="px-4 py-3">Naročnik</th>
                  <th className="px-4 py-3">Tip</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Plačilo</th>
                  <th className="px-4 py-3 text-right">Skupaj</th>
                  <th className="px-4 py-3">Datum</th>
                  <th className="px-4 py-3">PDFs</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {demoOrders.map((order) => (
                  <tr key={order.id} className="border-t border-slate-100">
                    <td className="px-4 py-4 font-semibold text-slate-900">
                      {order.order_number}
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {order.organization_name || order.contact_name}
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {getCustomerTypeLabel(order.customer_type)}
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      <AdminOrderStatusSelect orderId={order.id} status={order.status} />
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getPaymentBadge(
                          order.payment_status
                        )}`}
                      >
                        {getPaymentLabel(order.payment_status)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right text-slate-700">
                      {formatCurrency(order.total)}
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {new Date(order.created_at).toLocaleDateString('sl-SI')}
                    </td>
                    <td className="px-4 py-4">
                      <AdminOrdersPdfCell
                        orderId={order.id}
                        documents={documentsByOrder.get(order.id) ?? []}
                        attachments={attachmentsByOrder.get(order.id) ?? []}
                      />
                    </td>
                    <td className="px-4 py-4 text-right">
                      <AdminOrdersRowActions orderId={order.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  const orders = await fetchOrders({
    fromDate: from ? new Date(from).toISOString() : null,
    toDate: to ? new Date(to).toISOString() : null,
    query: query ? query.trim() : null
  });
  const orderIds = orders.map((order) => order.id);
  const [documents, attachments] = await Promise.all([
    fetchOrderDocumentsForOrders(orderIds),
    fetchOrderAttachmentsForOrders(orderIds)
  ]);
  const documentsByOrder = new Map<number, typeof documents>();
  const attachmentsByOrder = new Map<number, typeof attachments>();

  documents.forEach((doc) => {
    const list = documentsByOrder.get(doc.order_id) ?? [];
    list.push(doc);
    documentsByOrder.set(doc.order_id, list);
  });

  attachments.forEach((attachment) => {
    const list = attachmentsByOrder.get(attachment.order_id) ?? [];
    list.push({
      ...attachment,
      created_at: attachment.created_at,
      type: 'purchase_order'
    });
    attachmentsByOrder.set(attachment.order_id, list);
  });

  return (
    <div className="container-base py-12">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Administracija naročil</h1>
          <p className="mt-2 text-sm text-slate-600">
            Pregled oddanih naročil, statusov in PDF dokumentov.
          </p>
        </div>

        <form className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="flex flex-1 flex-col gap-2 sm:flex-row">
              <div className="flex-1">
                <label className="text-xs font-semibold uppercase text-slate-500">Od</label>
                <input
                  type="date"
                  name="from"
                  defaultValue={from}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-semibold uppercase text-slate-500">Do</label>
                <input
                  type="date"
                  name="to"
                  defaultValue={to}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex-[2]">
                <label className="text-xs font-semibold uppercase text-slate-500">
                  Iskanje
                </label>
                <input
                  type="text"
                  name="q"
                  defaultValue={query}
                  placeholder="Šola, kontakt, naslov"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <button
              type="submit"
              className="rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
            >
              Filtriraj
            </button>
          </div>
        </form>

        <AdminOrdersDownloadControls />

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Št. naročila</th>
                <th className="px-4 py-3">Naročnik</th>
                <th className="px-4 py-3">Tip</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Plačilo</th>
                <th className="px-4 py-3 text-right">Skupaj</th>
                <th className="px-4 py-3">Datum</th>
                <th className="px-4 py-3">PDFs</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-500" colSpan={9}>
                    Ni evidentiranih naročil.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="border-t border-slate-100">
                    <td className="px-4 py-4 font-semibold text-slate-900">
                      {order.order_number}
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {order.organization_name || order.contact_name}
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {getCustomerTypeLabel(order.customer_type)}
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      <AdminOrderStatusSelect orderId={order.id} status={order.status} />
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getPaymentBadge(
                          order.payment_status
                        )}`}
                      >
                        {getPaymentLabel(order.payment_status)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right text-slate-700">
                      {formatCurrency(order.total)}
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {new Date(order.created_at).toLocaleDateString('sl-SI')}
                    </td>
                    <td className="px-4 py-4">
                      <AdminOrdersPdfCell
                        orderId={order.id}
                        documents={documentsByOrder.get(order.id) ?? []}
                        attachments={attachmentsByOrder.get(order.id) ?? []}
                      />
                    </td>
                    <td className="px-4 py-4 text-right">
                      <AdminOrdersRowActions orderId={order.id} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
