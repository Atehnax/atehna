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
  delivery_address?: string | null;
  address_line1?: string | null;
  city?: string | null;
  postal_code?: string | null;
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

type PaymentFilter = 'all' | 'unpaid' | 'paid' | 'refunded' | 'cancelled';
type SortKey = 'customer' | 'address' | 'total' | 'created_at';
type SortDirection = 'asc' | 'desc';

const CREATE_ORDER_HREF = '/order';

const paymentFilterOptions: Array<{ value: PaymentFilter; label: string }> = [
  { value: 'all', label: 'Vsa' },
  { value: 'unpaid', label: 'Neplačano' },
  { value: 'paid', label: 'Plačano' },
  { value: 'refunded', label: 'Povrnjeno' },
  { value: 'cancelled', label: 'Preklicano' }
];

const currencyFormatter = new Intl.NumberFormat('sl-SI', {
  style: 'currency',
  currency: 'EUR'
});

const textCollator = new Intl.Collator('sl', { sensitivity: 'base' });

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

const normalizePaymentStatus = (status?: string | null): Exclude<PaymentFilter, 'all'> => {
  if (status === 'paid') return 'paid';
  if (status === 'refunded') return 'refunded';
  if (status === 'cancelled') return 'cancelled';
  return 'unpaid';
};

const formatOrderAddress = (order: OrderRow) => {
  const deliveryAddress = (order.delivery_address ?? '').trim();
  if (deliveryAddress) return deliveryAddress;

  const addressLine1 = (order.address_line1 ?? '').trim();
  const city = (order.city ?? '').trim();
  const postalCode = (order.postal_code ?? '').trim();

  const cityPostal = [postalCode, city].filter(Boolean).join(' ');
  return [addressLine1, cityPostal].filter(Boolean).join(', ');
};

const getCustomerName = (order: OrderRow) =>
  (order.organization_name ?? '').trim() || order.contact_name.trim();

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
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
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

  const paymentCounts = useMemo(() => {
    const counts: Record<PaymentFilter, number> = {
      all: orders.length,
      unpaid: 0,
      paid: 0,
      refunded: 0,
      cancelled: 0
    };

    orders.forEach((order) => {
      counts[normalizePaymentStatus(order.payment_status)] += 1;
    });

    return counts;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (paymentFilter === 'all') return orders;
    return orders.filter(
      (order) => normalizePaymentStatus(order.payment_status) === paymentFilter
    );
  }, [orders, paymentFilter]);

  const visibleOrders = useMemo(() => {
    const sortedOrders = [...filteredOrders];

    sortedOrders.sort((firstOrder, secondOrder) => {
      let comparison = 0;

      if (sortKey === 'created_at') {
        const firstTimestamp = new Date(firstOrder.created_at).getTime();
        const secondTimestamp = new Date(secondOrder.created_at).getTime();
        comparison = firstTimestamp - secondTimestamp;
      } else if (sortKey === 'total') {
        comparison = toAmount(firstOrder.total) - toAmount(secondOrder.total);
      } else if (sortKey === 'customer') {
        comparison = textCollator.compare(
          getCustomerName(firstOrder),
          getCustomerName(secondOrder)
        );
      } else if (sortKey === 'address') {
        comparison = textCollator.compare(
          formatOrderAddress(firstOrder),
          formatOrderAddress(secondOrder)
        );
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sortedOrders;
  }, [filteredOrders, sortDirection, sortKey]);

  const visibleOrderIds = useMemo(
    () => visibleOrders.map((order) => order.id),
    [visibleOrders]
  );

  const allSelected =
    visibleOrderIds.length > 0 &&
    visibleOrderIds.every((orderId) => selected.includes(orderId));

  const someSelected =
    visibleOrderIds.length > 0 &&
    visibleOrderIds.some((orderId) => selected.includes(orderId));

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = someSelected && !allSelected;
  }, [allSelected, someSelected]);

  const toggleSelected = (orderId: number) => {
    setSelected((previousSelected) =>
      previousSelected.includes(orderId)
        ? previousSelected.filter((selectedId) => selectedId !== orderId)
        : [...previousSelected, orderId]
    );
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelected((previousSelected) =>
        previousSelected.filter((selectedId) => !visibleOrderIds.includes(selectedId))
      );
      return;
    }

    setSelected((previousSelected) => [
      ...new Set([...previousSelected, ...visibleOrderIds])
    ]);
  };

  const setSort = (nextSortKey: SortKey) => {
    if (sortKey === nextSortKey) {
      setSortDirection((previousDirection) =>
        previousDirection === 'asc' ? 'desc' : 'asc'
      );
      return;
    }

    setSortKey(nextSortKey);
    setSortDirection(nextSortKey === 'created_at' || nextSortKey === 'total' ? 'desc' : 'asc');
  };

  const getSortIndicator = (columnSortKey: SortKey) => {
    if (sortKey !== columnSortKey) return '↕';
    return sortDirection === 'asc' ? '↑' : '↓';
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
        selected.map((orderId) => fetch(`/api/admin/orders/${orderId}`, { method: 'DELETE' }))
      );
      setSelected([]);
      window.location.reload();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="w-full overflow-x-auto">
      <div className="mx-auto w-[96rem] max-w-none space-y-4">
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          {paymentFilterOptions.map((option) => {
            const isActive = paymentFilter === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setPaymentFilter(option.value)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {option.label} ({paymentCounts[option.value]})
              </button>
            );
          })}

          <div className="ml-auto">
            <Link
              href={CREATE_ORDER_HREF}
              className="inline-flex items-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-200 hover:text-brand-700"
            >
              + Dodaj
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full table-fixed text-left text-sm">
            <colgroup>
              <col className="w-10" />
              <col className="w-28" />
              <col className="w-56" />
              <col className="w-80" />
              <col className="w-36" />
              <col className="w-40" />
              <col className="w-32" />
              <col className="w-28" />
              <col className="w-28" />
              <col className="w-[22rem]" />
            </colgroup>

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
                <th className="px-3 py-3">
                  <button
                    type="button"
                    onClick={() => setSort('customer')}
                    className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide hover:text-slate-700"
                  >
                    Naročnik
                    <span className="text-[11px]">{getSortIndicator('customer')}</span>
                  </button>
                </th>
                <th className="px-3 py-3">
                  <button
                    type="button"
                    onClick={() => setSort('address')}
                    className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide hover:text-slate-700"
                  >
                    Naslov
                    <span className="text-[11px]">{getSortIndicator('address')}</span>
                  </button>
                </th>
                <th className="px-3 py-3">Tip</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Plačilo</th>
                <th className="px-3 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => setSort('total')}
                    className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide hover:text-slate-700"
                  >
                    Skupaj
                    <span className="text-[11px]">{getSortIndicator('total')}</span>
                  </button>
                </th>
                <th className="px-3 py-3">
                  <button
                    type="button"
                    onClick={() => setSort('created_at')}
                    className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide hover:text-slate-700"
                  >
                    Datum
                    <span className="text-[11px]">{getSortIndicator('created_at')}</span>
                  </button>
                </th>
                <th className="px-3 py-3">PDFs</th>
              </tr>
            </thead>

            <tbody>
              {visibleOrders.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-slate-500" colSpan={10}>
                    Ni evidentiranih naročil.
                  </td>
                </tr>
              ) : (
                visibleOrders.map((order, orderIndex) => {
                  const customerName = getCustomerName(order);
                  const orderAddress = formatOrderAddress(order);

                  return (
                    <tr
                      key={order.id}
                      className={`border-t border-slate-100 ${
                        orderIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                      } hover:bg-slate-100/60`}
                    >
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selected.includes(order.id)}
                          onChange={() => toggleSelected(order.id)}
                          aria-label={`Izberi naročilo ${order.order_number}`}
                        />
                      </td>

                      <td className="px-3 py-3 font-semibold text-slate-900">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="text-sm font-semibold text-brand-600 hover:text-brand-700"
                        >
                          {order.order_number}
                        </Link>
                      </td>

                      <td className="px-3 py-3 text-slate-600">
                        <span className="block truncate" title={customerName}>
                          {customerName}
                        </span>
                      </td>

                      <td className="px-3 py-3 text-slate-600">
                        <span className="block truncate" title={orderAddress || '—'}>
                          {orderAddress || '—'}
                        </span>
                      </td>

                      <td className="px-3 py-3 text-slate-600">
                        {getCustomerTypeLabel(order.customer_type)}
                      </td>

                      <td className="px-3 py-3 text-slate-600">
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

                      <td className="px-3 py-3">
                        <AdminOrdersPdfCell
                          orderId={order.id}
                          documents={documentsByOrder.get(order.id) ?? []}
                          attachments={attachmentsByOrder.get(order.id) ?? []}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
