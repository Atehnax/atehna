export const dynamic = 'force-dynamic';
export const revalidate = 0;

import Link from 'next/link';
import { fetchOrders } from '@/lib/server/orders';

export const metadata = {
  title: 'Administracija naročil'
};

export default async function AdminOrdersPage() {
  const orders = await fetchOrders();

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
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-slate-500" colSpan={6}>
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
