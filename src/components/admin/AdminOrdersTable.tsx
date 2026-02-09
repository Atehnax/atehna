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

type SortKey = 'customer' | 'address' | 'total' | 'date';
type SortDirection = 'asc' | 'desc';

type StatusFilter =
  | 'all'
  | 'received'
  | 'in_progress'
  | 'sent'
  | 'partially_sent'
  | 'finished'
  | 'cancelled'
  | 'refunded';

const STATUS_FILTER_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'Vsa' },
  { value: 'received', label: 'Prejeto' },
  { value: 'in_progress', label: 'V obdelavi' },
  { value: 'sent', label: 'Poslano' },
  { value: 'partially_sent', label: 'Delno poslano' },
  { value: 'finished', label: 'Zaključeno' },
  { value: 'cancelled', label: 'Preklicano' },
  { value: 'refunded', label: 'Povrnjeno' }
];

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

const formatOrderAddress = (order: OrderRow) => {
  const deliveryAddress = (order.delivery_address ?? '').trim();
  if (deliveryAddress) return deliveryAddress;

  const addressLine1 = (order.address_line1 ?? '').trim();
  const city = (order.city ?? '').trim();
  const postalCode = (order.postal_code ?? '').trim();

  const cityPostal = [postalCode, city].filter(Boolean).join(' ');
  return [addressLine1, cityPostal].filter(Boolean).join(', ');
};

const getOrderCustomerName = (order: OrderRow) =>
  (order.organization_name || order.contact_name || '').trim();

const getOrderTimestamp = (createdAt: string) => {
  const timestamp = new Date(createdAt).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const isRefundedStatus = (status: string) =>
  status === 'refunded_returned' || status === 'refunded_not_returned';

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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortState, setSortState] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'date',
    direction: 'desc'
  });

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

  const filteredAndSortedOrders = useMemo(() => {
    const filteredOrders = orders.filter((order) => {
      if (statusFilter === 'all') return true;
      if (statusFilter === 'refunded') return isRefundedStatus(order.status);
      return order.status === statusFilter;
    });

    const sortedOrders = [...filteredOrders].sort((leftOrder, rightOrder) => {
      let comparison = 0;

      if (sortState.key === 'customer') {
        comparison = getOrderCustomerName(leftOrder).localeCompare(
          getOrderCustomerName(rightOrder),
          'sl-SI',
          { sensitivity: 'base' }
        );
      } else if (sortState.key === 'address') {
        comparison = formatOrderAddress(leftOrder).localeCompare(
          formatOrderAddress(rightOrder),
          'sl-SI',
          { sensitivity: 'base' }
        );
      } else if (sortState.key === 'total') {
        comparison = toAmount(leftOrder.total) - toAmount(rightOrder.total);
      } else if (sortState.key === 'date') {
        comparison = getOrderTimestamp(leftOrder.created_at) - getOrderTimestamp(rightOrder.created_at);
      }

      if (comparison === 0) comparison = leftOrder.id - rightOrder.id;
      return sortState.direction === 'asc' ? comparison : -comparison;
    });

    return sortedOrders;
  }, [orders, statusFilter, sortState]);

  useEffect(() => {
    // clear selection when filter changes to avoid deleting hidden rows
    setSelected([]);
  }, [statusFilter]);

  const visibleOrderIds = useMemo(
    () => filteredAndSortedOrders.map((order) => order.id),
    [filteredAndSortedOrders]
  );

  const allSelected =
    visibleOrderIds.length > 0 &&
    visibleOrderIds.every((visibleOrderId) => selected.includes(visibleOrderId));

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = selected.length > 0 && !allSelected;
  }, [allSelected, selected.length]);

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

    setSelected((previousSelected) =>
      Array.from(new Set([...previousSelected, ...visibleOrderIds]))
    );
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

  const toggleSort = (key: SortKey) => {
    setSortState((previousState) => {
      if (previousState.key === key) {
        return {
          key,
          direction: previousState.direction === 'asc' ? 'desc' : 'asc'
        };
      }

      return {
        key,
        direction: key === 'date' ? 'desc' : 'asc'
      };
    });
  };

  const sortIndicator = (key: SortKey) => {
    if (sortState.key !== key) return '↕';
    return sortState.direction === 'asc' ? '↑' : '↓';
  };

  return (
    <div className="space-y-4">
      {/* top status filters */}
      <div className="w-full overflow-x-auto">
        <div className="mx-auto flex w-fit min-w-[980px] flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          {STATUS_FILTER_OPTIONS.map((option) => {
            const isActive = statusFilter === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setStatusFilter(option.value)}
                className={
                  isActive
                    ? 'rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white'
                    : 'rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200'
                }
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* centered, stable-width table */}
      <div className="w-full overflow-x-auto">
        <div className="mx-auto min-w-[1560px] max-w-[1560px] rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[44px]" />
              <col className="w-[116px]" />
              <col className="w-[220px]" />
              <col className="w-[300px]" />
              <col className="w-[145px]" />
              <col className="w-[180px]" />
              <col className="w-[130px]" />
              <col className="w-[120px]" />
              <col className="w-[120px]" />
              <col className="w-[285px]" />
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
                    onClick={() => toggleSort('customer')}
                    className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900"
                  >
                    Naročnik
                    <span className="text-[11px]">{sortIndicator('customer')}</span>
                  </button>
                </th>

                <th className="px-3 py-3">
                  <button
                    type="button"
                    onClick={() => toggleSort('address')}
                    className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900"
                  >
                    Naslov
                    <span className="text-[11px]">{sortIndicator('address')}</span>
                  </button>
                </th>

                <th className="px-3 py-3">Tip</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Plačilo</th>

                <th className="px-3 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort('total')}
                    className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900"
                  >
                    Skupaj
                    <span className="text-[11px]">{sortIndicator('total')}</span>
                  </button>
                </th>

                <th className="px-3 py-3">
                  <button
                    type="button"
                    onClick={() => toggleSort('date')}
                    className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900"
                  >
                    Datum
                    <span className="text-[11px]">{sortIndicator('date')}</span>
                  </button>
                </th>

                <th className="px-3 py-3">PDFs</th>
              </tr>
            </thead>

            <tbody>
              {filteredAndSortedOrders.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-slate-500" colSpan={10}>
                    Ni evidentiranih naročil.
                  </td>
                </tr>
              ) : (
                filteredAndSortedOrders.map((order, orderIndex) => {
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
                        <span className="block truncate" title={getOrderCustomerName(order)}>
                          {getOrderCustomerName(order) || '—'}
                        </span>
                      </td>

                      <td className="px-3 py-3 text-slate-600">
                        <span className="block truncate" title={orderAddress}>
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
