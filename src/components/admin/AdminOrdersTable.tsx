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
  total: number | string | null;
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

const currencyFormatter = new Intl.NumberFormat('sl-SI', {
  style: 'currency',
  currency: 'EUR'
});

const toAmount = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  if (typeof value === 'string') {
    const normalizedValue = value.replace(',', '.').trim();
    const parsedValue = Number(normalizedValue);
    if (Number.isFinite(parsedValue)) return parsedValue;
  }

  return 0;
};

const formatCurrency = (value: unknown) => currencyFormatter.format(toAmount(value));

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

  const documentsByOrder = useMemo(() => {
    const byOrder = new Map<number, PdfDoc[]>();
    documents.forEach((documentItem) => {
      const existingList = byOrder.get(documentItem.order_id) ?? [];
      existingList.push(documentItem);
      byOrder.set(documentItem.order_id, existingList);
    });
    return byOrder;
  }, [documents]);

  const attachmentsByOrder = useMemo(() => {
    const byOrder = new Map<number, Attachment[]>();
    attachments.forEach((attachmentItem) => {
      const existingList = byOrder.get(attachmentItem.order_id) ?? [];
      existingList.push({ ...attachmentItem, type: 'purchase_order' });
      byOrder.set(attachmentItem.order_id, existingList);
    });
    return byOrder;
  }, [attachments]);

  const toggleSelected = (orderId: number) => {
    setSelected((previousSelected) =>
      previousSelected.includes(orderId)
        ? previousSelected.filter((selectedId) => selectedId !== orderId)
        : [...previousSelected, orderId]
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
      return;
    }
    setSelected(orders.map((order) => order.id));
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
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[1060px] table-auto text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-3 py-3">
              <input
                type="checkbox"
                ref={selectAllRef}
                checked={allSelected}
                onChange={toggleAll}
                aria-label="Izberi vse"
              />
            </th>
            <th className="px-3 py-3">
              <button
                type="button"
                onClick={handleDelete}
                disabled={selected.length === 0 || isDeleting}
                className="text-xs font-semibold text-rose-600 disabled:text-slate-300"
              >
                {isDeleting ? 'Brisanje...' : 'Izbriši'}
              </button>
            </th>
            <th className="px-3 py-3">Naročnik</th>
            <th className="px-3 py-3">Tip</th>
            <th className="px-3 py-3 min-w-[130px]">Status</th>
            <th className="px-3 py-3">Plačilo</th>
            <th className="px-3 py-3 text-right">Skupaj</th>
            <th className="px-3 py-3">Datum</th>
            <th className="px-3 py-3 min-w-[300px]">PDFs</th>
          </tr>
        </thead>
        <tbody>
          {orders.length === 0 ? (
            <tr>
              <td className="px-3 py-6 text-center text-slate-500" colSpan={9}>
                Ni evidentiranih naročil.
              </td>
            </tr>
          ) : (
            orders.map((order) => (
              <tr key={order.id} className="border-t border-slate-100">
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={selected.includes(order.id)}
                    onChange={() => toggleSelected(order.id)}
                    aria-label={`Izberi naročilo ${order.order_number}`}
                  />
                </td>
                <td className="px-3 py-3 whitespace-nowrap font-semibold text-slate-900">
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="text-sm font-semibold text-brand-600 hover:text-brand-700"
                  >
                    {order.order_number}
                  </Link>
                </td>
                <td className="px-3 py-3 text-slate-600">
                  {order.organization_name || order.contact_name}
                </td>
                <td className="px-3 py-3 text-slate-600">
                  {getCustomerTypeLabel(order.customer_type)}
                </td>
                <td className="px-3 py-3 text-slate-600 min-w-[130px]">
                  <AdminOrderStatusSelect orderId={order.id} status={order.status} />
                </td>
                <td className="px-3 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getPaymentBadge(
                      order.payment_status
                    )}`}
                  >
                    {getPaymentLabel(order.payment_status)}
                  </span>
                </td>
                <td className="px-3 py-3 text-right text-slate-700 whitespace-nowrap">
                  {formatCurrency(order.total)}
                </td>
                <td className="px-3 py-3 text-slate-600 whitespace-nowrap">
                  {new Date(order.created_at).toLocaleDateString('sl-SI')}
                </td>
                <td className="px-3 py-3 min-w-[300px]">
                  <AdminOrdersPdfCell
                    orderId={order.id}
                    documents={documentsByOrder.get(order.id) ?? []}
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
