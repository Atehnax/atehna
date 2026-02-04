import Link from 'next/link';
import AdminOrdersPdfCell from '@/components/admin/AdminOrdersPdfCell';
import { fetchOrderDocumentsForOrders, fetchOrders } from '@/lib/server/orders';

export const metadata = {
  title: 'Administracija naročil'
};

export const dynamic = 'force-dynamic';

export default async function AdminOrdersPage() {
  if (!process.env.DATABASE_URL) {
    const orders = [
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
        subtotal: 0,
        tax: 0,
        total: 0,
        created_at: new Date().toISOString()
      }
    ];
    const documents = [
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
    const documentsByOrder = new Map<number, typeof documents>();
    documentsByOrder.set(1, documents);
    return (
      <div className="container-base py-12">
        <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50 p-6 text-sm text-amber-700">
          DATABASE_URL ni nastavljen — prikazan je demo pogled.
        </div>
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Št. naročila</th>
                <th className="px-4 py-3">Naročnik</th>
                <th className="px-4 py-3">Tip</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Datum</th>
                <th className="px-4 py-3">PDFs</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-t border-slate-100">
                  <td className="px-4 py-4 font-semibold text-slate-900">
                    {order.order_number}
                  </td>
                  <td className="px-4 py-4 text-slate-600">
                    {order.organization_name || order.contact_name}
                  </td>
                  <td className="px-4 py-4 text-slate-600">{order.customer_type}</td>
                  <td className="px-4 py-4 text-slate-600">{order.status}</td>
                  <td className="px-4 py-4 text-slate-600">
                    {new Date(order.created_at).toLocaleDateString('sl-SI')}
                  </td>
                  <td className="px-4 py-4">
                    <AdminOrdersPdfCell
                      orderId={order.id}
                      documents={documentsByOrder.get(order.id) ?? []}
                    />
                  </td>
                  <td className="px-4 py-4 text-right">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="text-sm font-semibold text-brand-600 hover:text-brand-700"
                    >
                      Odpri →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const orders = await fetchOrders();
  const orderIds = orders.map((order) => order.id);
  const documents = await fetchOrderDocumentsForOrders(orderIds);
  const documentsByOrder = new Map<number, typeof documents>();

  documents.forEach((doc) => {
    const list = documentsByOrder.get(doc.order_id) ?? [];
    list.push(doc);
    documentsByOrder.set(doc.order_id, list);
  });

  return (
    <div className="container-base py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Administracija naročil</h1>
          <p className="mt-2 text-sm text-slate-600">
            Pregled oddanih naročil in spremljanje statusov.
          </p>
        </div>
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Št. naročila</th>
              <th className="px-4 py-3">Naročnik</th>
              <th className="px-4 py-3">Tip</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Datum</th>
              <th className="px-4 py-3">PDFs</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-slate-500" colSpan={7}>
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
                  <td className="px-4 py-4 text-slate-600">{order.customer_type}</td>
                  <td className="px-4 py-4 text-slate-600">{order.status}</td>
                  <td className="px-4 py-4 text-slate-600">
                    {new Date(order.created_at).toLocaleDateString('sl-SI')}
                  </td>
                  <td className="px-4 py-4">
                    <AdminOrdersPdfCell
                      orderId={order.id}
                      documents={documentsByOrder.get(order.id) ?? []}
                    />
                  </td>
                  <td className="px-4 py-4 text-right">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="text-sm font-semibold text-brand-600 hover:text-brand-700"
                    >
                      Odpri →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
