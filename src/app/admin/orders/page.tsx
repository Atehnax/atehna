import Link from 'next/link';
import { query } from '@/lib/server/db';

type OrderRow = {
  id: string;
  order_number: string;
  buyer_type: string;
  status: string;
  first_name: string;
  last_name: string;
  email: string;
  total_cents: number;
  created_at: Date;
  po_received: boolean;
};

const formatCurrency = (amountCents: number) =>
  new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR' }).format(
    amountCents / 100
  );

export default async function AdminOrdersPage({
  searchParams
}: {
  searchParams?: { status?: string; buyerType?: string };
}) {
  const filters: string[] = [];
  const params: unknown[] = [];

  if (searchParams?.status) {
    params.push(searchParams.status);
    filters.push(`o.status = $${params.length}`);
  }

  if (searchParams?.buyerType) {
    params.push(searchParams.buyerType);
    filters.push(`o.buyer_type = $${params.length}`);
  }

  const whereClause = filters.length ? `where ${filters.join(' and ')}` : '';

  const result = await query<OrderRow>(
    `
      select
        o.id,
        o.order_number,
        o.buyer_type,
        o.status,
        o.first_name,
        o.last_name,
        o.email,
        o.total_cents,
        o.created_at,
        exists(
          select 1 from attachments a
          where a.order_id = o.id and a.attachment_type = 'school_purchase_order'
        ) as po_received
      from orders o
      ${whereClause}
      order by o.created_at desc
    `,
    params
  );

  return (
    <div className="container-base py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-slate-900">Administracija naročil</h1>
        <form className="flex flex-wrap gap-2 text-sm" method="get">
          <select
            name="status"
            defaultValue={searchParams?.status ?? ''}
            className="rounded-lg border border-slate-200 px-3 py-2"
          >
            <option value="">Vsi statusi</option>
            <option value="awaiting_payment">Čaka na plačilo</option>
            <option value="awaiting_purchase_order">Čaka na naročilnico</option>
            <option value="purchase_order_received">Naročilnica prejeta</option>
            <option value="paid">Plačano</option>
            <option value="flagged">Označeno</option>
            <option value="cancelled">Preklicano</option>
          </select>
          <select
            name="buyerType"
            defaultValue={searchParams?.buyerType ?? ''}
            className="rounded-lg border border-slate-200 px-3 py-2"
          >
            <option value="">Vsi kupci</option>
            <option value="individual">Posameznik</option>
            <option value="company">Podjetje</option>
            <option value="school">Šola</option>
          </select>
          <button
            type="submit"
            className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white"
          >
            Filtriraj
          </button>
        </form>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-widest text-slate-500">
            <tr>
              <th className="px-4 py-3">Naročilo</th>
              <th className="px-4 py-3">Kupec</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Skupaj</th>
              <th className="px-4 py-3">Datum</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">PO</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((order) => (
              <tr key={order.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-semibold text-brand-600">
                  <Link href={`/admin/orders/${order.id}`}>{order.order_number}</Link>
                </td>
                <td className="px-4 py-3">
                  {order.first_name} {order.last_name}
                </td>
                <td className="px-4 py-3">{order.email}</td>
                <td className="px-4 py-3">{formatCurrency(Number(order.total_cents))}</td>
                <td className="px-4 py-3">
                  {new Date(order.created_at).toLocaleDateString('sl-SI')}
                </td>
                <td className="px-4 py-3">{order.status}</td>
                <td className="px-4 py-3">{order.po_received ? '✓' : '—'}</td>
              </tr>
            ))}
            {result.rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                  Ni naročil za izbrane filtre.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
