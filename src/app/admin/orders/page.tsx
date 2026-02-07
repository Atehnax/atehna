import AdminOrdersDownloadControls from '@/components/admin/AdminOrdersDownloadControls';
import AdminOrdersTable from '@/components/admin/AdminOrdersTable';
import {
  fetchOrderAttachmentsForOrders,
  fetchOrderDocumentsForOrders,
  fetchOrders
} from '@/lib/server/orders';

export const metadata = {
  title: 'Administracija naročil'
};

export const dynamic = 'force-dynamic';

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
    return (
      <div className="mx-auto w-full max-w-none px-6 py-12">
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

          <AdminOrdersDownloadControls fromDate={from} toDate={to} />
          <AdminOrdersTable
            orders={demoOrders}
            documents={demoDocuments}
            attachments={demoAttachments}
          />
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
  return (
    <div className="mx-auto w-full max-w-none px-6 py-12">
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

        <AdminOrdersDownloadControls fromDate={from} toDate={to} />

        <AdminOrdersTable orders={orders} documents={documents} attachments={attachments} />
      </div>
    </div>
  );
}
