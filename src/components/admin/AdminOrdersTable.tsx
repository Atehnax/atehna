'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import AdminOrderStatusSelect from '@/components/admin/AdminOrderStatusSelect';
import AdminOrdersPdfCell from '@/components/admin/AdminOrdersPdfCell';
import { getCustomerTypeLabel } from '@/lib/customerType';

type OrderRow = {
  id: number;
  order_number: string;
  customer_type: string;
  organization_name: string | null;
  contact_name: string;
  status: string;
  payment_status?: string | null;
  total: number | null;
  created_at: string;
};

type PdfDoc = {
  id: number;
  order_id: number;
  type: string;
  filename: string;
  blob_url: string;
  created_at: string;
};

type Attachment = {
  id: number;
  order_id: number;
  type: string;
  filename: string;
  blob_url: string;
  created_at: string;
};

const formatCurrency = (value: number | null | undefined) =>
  typeof value === 'number'
    ? new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR' }).format(value)
    : 'Po dogovoru';

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

export default function AdminOrdersTable({
  orders,
  documents,
  attachments
}: {
  orders: OrderRow[];
  documents: PdfDoc[];
  attachments: Attachment[];
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const docsByOrder = useMemo(() => {
    const map = new Map<number, PdfDoc[]>();
    documents.forEach((doc) => {
      const list = map.get(doc.order_id) ?? [];
      list.push(doc);
      map.set(doc.order_id, list);
    });
    return map;
  }, [documents]);

  const attachmentsByOrder = useMemo(() => {
    const map = new Map<number, Attachment[]>();
    attachments.forEach((attachment) => {
      const list = map.get(attachment.order_id) ?? [];
      list.push({ ...attachment, type: 'purchase_order' });
      map.set(attachment.order_id, list);
    });
    return map;
  }, [attachments]);

  const toggleSelected = (orderId: number) => {
    setSelected((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  const allSelected = orders.length > 0 && selected.length === orders.length;

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = selected.length > 0 && !allSelected;
  }, [allSelected, selected.length]);

  const toggleAll = () => {
    if (allSelected) {
      setSelected([]);
    } else {
      setSelected(orders.map((order) => order.id));
    }
  };

  const handleDelete = async () => {
    if (selected.length === 0) return;
    const confirmed = window.confirm(
      `Ali ste prepričani, da želite izbrisati ${selected.length} naročil?`
    );
    if (!confirmed) return;
    setIsDeleting(true);
    try {
      await Promise.all(
        selected.map((orderId) =>
          fetch(`/api/admin/orders/${orderId}`, { method: 'DELETE' })
        )
      );
      setSelected([]);
      window.location.reload();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full table-auto text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">
              <input
                type="checkbox"
                ref={selectAllRef}
                checked={allSelected}
                onChange={toggleAll}
                aria-label="Izberi vse"
              />
            </th>
            <th className="px-4 py-3">
              <button
                type="button"
                onClick={handleDelete}
                disabled={selected.length === 0 || isDeleting}
                className="text-xs font-semibold text-rose-600 disabled:text-slate-300"
              >
                {isDeleting ? 'Brisanje...' : 'Izbriši'}
              </button>
            </th>
            <th className="px-4 py-3">Naročnik</th>
            <th className="px-4 py-3">Tip</th>
            <th className="px-4 py-3 min-w-[140px]">Status</th>
            <th className="px-4 py-3">Plačilo</th>
            <th className="px-4 py-3 text-right">Skupaj</th>
            <th className="px-4 py-3">Datum</th>
            <th className="px-4 py-3 min-w-[260px]">PDFs</th>
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
                <td className="px-4 py-4">
                  <input
                    type="checkbox"
                    checked={selected.includes(order.id)}
                    onChange={() => toggleSelected(order.id)}
                    aria-label={`Izberi naročilo ${order.order_number}`}
                  />
                </td>
                <td className="px-4 py-4 whitespace-nowrap font-semibold text-slate-900">
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="text-sm font-semibold text-brand-600 hover:text-brand-700"
                  >
                    {order.order_number}
                  </Link>
                </td>
                <td className="px-4 py-4 text-slate-600">
                  {order.organization_name || order.contact_name}
                </td>
                <td className="px-4 py-4 text-slate-600">
                  {getCustomerTypeLabel(order.customer_type)}
                </td>
                <td className="px-4 py-4 text-slate-600 min-w-[140px]">
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
                <td className="px-4 py-4 text-right text-slate-700 whitespace-nowrap">
                  {formatCurrency(order.total)}
                </td>
                <td className="px-4 py-4 text-slate-600 whitespace-nowrap">
                  {new Date(order.created_at).toLocaleDateString('sl-SI')}
                </td>
                <td className="px-4 py-4 min-w-[260px]">
                  <AdminOrdersPdfCell
                    orderId={order.id}
                    documents={docsByOrder.get(order.id) ?? []}
                    attachments={attachmentsByOrder.get(order.id) ?? []}
                  />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
