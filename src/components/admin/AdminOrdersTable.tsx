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

type DownloadItem = {
  orderNumber: string;
  type: string;
  filename: string;
  url: string;
  createdAt: string;
};

const statusTabs = [
  { value: 'all', label: 'Vsa' },
  { value: 'received', label: 'Prejeto' },
  { value: 'in_progress', label: 'V obdelavi' },
  { value: 'sent', label: 'Poslano' },
  { value: 'partially_sent', label: 'Delno poslano' },
  { value: 'finished', label: 'Zaključeno' },
  { value: 'cancelled', label: 'Preklicano' },
  { value: 'refunded', label: 'Povrnjeno' }
] as const;

type StatusFilterValue = (typeof statusTabs)[number]['value'];

const documentTypeOptions = [
  { value: 'all', label: 'Vse vrste' },
  { value: 'order_summary', label: 'Povzetek naročila' },
  { value: 'predracun', label: 'Predračun' },
  { value: 'dobavnica', label: 'Dobavnica' },
  { value: 'invoice', label: 'Račun' },
  { value: 'purchase_order', label: 'Naročilnica' }
] as const;

type DocumentTypeValue = (typeof documentTypeOptions)[number]['value'];

const documentTypeLabelMap = new Map<string, string>(
  documentTypeOptions.map((option) => [option.value, option.label])
);

type SortField = 'customer' | 'address' | 'total' | 'created_at';
type SortDirection = 'asc' | 'desc';

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

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

const startOfDay = (dateText: string) => {
  const date = new Date(`${dateText}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const endOfDay = (dateText: string) => {
  const date = new Date(`${dateText}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const statusMatches = (status: string, filter: StatusFilterValue) => {
  if (filter === 'all') return true;
  if (filter === 'refunded') {
    return status === 'refunded_returned' || status === 'refunded_not_returned';
  }
  return status === filter;
};

const getSortArrow = (
  field: SortField,
  currentField: SortField,
  direction: SortDirection
) => {
  if (field !== currentField) return '↕';
  return direction === 'asc' ? '↑' : '↓';
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

  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [query, setQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const [searchDocumentsEnabled, setSearchDocumentsEnabled] = useState(false);
  const [documentType, setDocumentType] = useState<DocumentTypeValue>('all');
  const [documentMessage, setDocumentMessage] = useState<string | null>(null);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [documentItems, setDocumentItems] = useState<DownloadItem[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);

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
    const normalizedQuery = normalizeText(query.trim());
    const from = fromDate ? startOfDay(fromDate) : null;
    const to = toDate ? endOfDay(toDate) : null;

    const filtered = orders.filter((order) => {
      if (!statusMatches(order.status, statusFilter)) return false;

      const createdAt = new Date(order.created_at);
      if (from && createdAt < from) return false;
      if (to && createdAt > to) return false;

      if (!normalizedQuery) return true;

      const customer = order.organization_name || order.contact_name || '';
      const address = formatOrderAddress(order);
      const searchable = normalizeText(
        [
          order.order_number,
          customer,
          address,
          getCustomerTypeLabel(order.customer_type),
          getPaymentLabel(order.payment_status)
        ]
          .filter(Boolean)
          .join(' ')
      );

      return searchable.includes(normalizedQuery);
    });

    return [...filtered].sort((leftOrder, rightOrder) => {
      let comparison = 0;

      if (sortField === 'created_at') {
        comparison =
          new Date(leftOrder.created_at).getTime() -
          new Date(rightOrder.created_at).getTime();
      } else if (sortField === 'total') {
        comparison = toAmount(leftOrder.total) - toAmount(rightOrder.total);
      } else if (sortField === 'customer') {
        const leftCustomer = (leftOrder.organization_name || leftOrder.contact_name || '').toLowerCase();
        const rightCustomer = (rightOrder.organization_name || rightOrder.contact_name || '').toLowerCase();
        comparison = leftCustomer.localeCompare(rightCustomer, 'sl');
      } else if (sortField === 'address') {
        const leftAddress = formatOrderAddress(leftOrder).toLowerCase();
        const rightAddress = formatOrderAddress(rightOrder).toLowerCase();
        comparison = leftAddress.localeCompare(rightAddress, 'sl');
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [orders, statusFilter, fromDate, toDate, query, sortField, sortDirection]);

  const visibleOrderIds = filteredAndSortedOrders.map((order) => order.id);
  const selectedVisibleCount = visibleOrderIds.filter((orderId) =>
    selected.includes(orderId)
  ).length;

  const allSelected =
    visibleOrderIds.length > 0 && selectedVisibleCount === visibleOrderIds.length;

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate =
      selectedVisibleCount > 0 && selectedVisibleCount < visibleOrderIds.length;
  }, [selectedVisibleCount, visibleOrderIds.length]);

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
        previousSelected.filter((orderId) => !visibleOrderIds.includes(orderId))
      );
      return;
    }

    setSelected((previousSelected) => [
      ...previousSelected,
      ...visibleOrderIds.filter((orderId) => !previousSelected.includes(orderId))
    ]);
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

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((previousDirection) =>
        previousDirection === 'asc' ? 'desc' : 'asc'
      );
      return;
    }
    setSortField(field);
    setSortDirection(field === 'created_at' ? 'desc' : 'asc');
  };

  const downloadFile = async (item: DownloadItem) => {
    const response = await fetch(item.url);
    if (!response.ok) return;
    const blob = await response.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${item.orderNumber}-${item.filename}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  };

  const handleLoadDocuments = async () => {
    if (!searchDocumentsEnabled) return [];
    setDocumentMessage(null);
    setIsLoadingDocuments(true);

    try {
      const params = new URLSearchParams();
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);
      if (query.trim()) params.set('q', query.trim());
      if (documentType !== 'all') params.set('type', documentType);

      const response = await fetch(`/api/admin/orders/download?${params.toString()}`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Nalaganje dokumentov ni uspelo.');
      }

      const payload = (await response.json()) as { items: DownloadItem[] };
      setDocumentItems(payload.items ?? []);
      setDocumentMessage(
        payload.items?.length
          ? `Najdenih dokumentov: ${payload.items.length}`
          : 'Ni dokumentov za izbrane filtre.'
      );
      return payload.items ?? [];
    } catch (error) {
      setDocumentItems([]);
      setDocumentMessage(
        error instanceof Error ? error.message : 'Napaka pri nalaganju dokumentov.'
      );
      return [];
    } finally {
      setIsLoadingDocuments(false);
    }
  };

  const handleDownloadAllDocuments = async () => {
    if (!searchDocumentsEnabled) return;
    setIsDownloading(true);
    try {
      const toDownload =
        documentItems.length > 0 ? documentItems : await handleLoadDocuments();
      for (const item of toDownload) {
        await downloadFile(item);
      }
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="relative left-1/2 w-[75vw] -translate-x-1/2 space-y-3 min-w-[1100px]">
      {/* unified search row */}
      <section className="w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">Od</label>
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="mt-1 h-10 w-40 rounded-lg border border-slate-300 px-3 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">Do</label>
            <input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className="mt-1 h-10 w-40 rounded-lg border border-slate-300 px-3 text-sm"
            />
          </div>

          <div className="min-w-[260px] flex-1 max-w-[420px]">
            <label className="text-xs font-semibold uppercase text-slate-500">Iskanje</label>
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Št. naročila, naročnik, naslov, tip, plačilo"
              className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
            />
          </div>

          <label className="mb-2 inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={searchDocumentsEnabled}
              onChange={(event) => {
                const checked = event.target.checked;
                setSearchDocumentsEnabled(checked);
                if (!checked) {
                  setDocumentItems([]);
                  setDocumentMessage(null);
                }
              }}
              className="h-4 w-4 rounded border-slate-300"
            />
            Išči dokumente
          </label>

          <div className="w-[210px]">
            <label className="text-xs font-semibold uppercase text-slate-500">
              Vrsta dokumenta
            </label>
            <select
              value={documentType}
              onChange={(event) =>
                setDocumentType(event.target.value as DocumentTypeValue)
              }
              disabled={!searchDocumentsEnabled}
              className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            >
              {documentTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleLoadDocuments}
            disabled={!searchDocumentsEnabled || isLoadingDocuments}
            className="h-10 rounded-full bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            {isLoadingDocuments ? 'Nalaganje...' : 'Naloži dokumente'}
          </button>

          <button
            type="button"
            onClick={handleDownloadAllDocuments}
            disabled={!searchDocumentsEnabled || isLoadingDocuments || isDownloading}
            className="h-10 rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:border-brand-200 hover:text-brand-600 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
          >
            {isDownloading ? 'Prenos...' : 'Prenesi vse'}
          </button>
        </div>

        {documentMessage && (
          <p className="mt-2 text-sm text-slate-600">{documentMessage}</p>
        )}
      </section>

      {/* status tabs directly above table */}
      <section className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {statusTabs.map((tab) => {
            const isActive = statusFilter === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setStatusFilter(tab.value)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* table */}
      <div className="w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full table-fixed text-left text-sm">
          <colgroup>
            <col style={{ width: '3%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '17%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '11%' }} />
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
                  className="inline-flex items-center gap-1 hover:text-slate-700"
                >
                  Naročnik
                  <span>{getSortArrow('customer', sortField, sortDirection)}</span>
                </button>
              </th>

              <th className="px-3 py-3">
                <button
                  type="button"
                  onClick={() => toggleSort('address')}
                  className="inline-flex items-center gap-1 hover:text-slate-700"
                >
                  Naslov
                  <span>{getSortArrow('address', sortField, sortDirection)}</span>
                </button>
              </th>

              <th className="px-3 py-3">Tip</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Plačilo</th>

              <th className="px-3 py-3 text-right">
                <button
                  type="button"
                  onClick={() => toggleSort('total')}
                  className="inline-flex items-center gap-1 hover:text-slate-700"
                >
                  Skupaj
                  <span>{getSortArrow('total', sortField, sortDirection)}</span>
                </button>
              </th>

              <th className="px-3 py-3">
                <button
                  type="button"
                  onClick={() => toggleSort('created_at')}
                  className="inline-flex items-center gap-1 hover:text-slate-700"
                >
                  Datum
                  <span>{getSortArrow('created_at', sortField, sortDirection)}</span>
                </button>
              </th>

              <th className="px-3 py-3">PDFs</th>
            </tr>
          </thead>

          <tbody>
            {filteredAndSortedOrders.length === 0 ? (
              <tr>
                <td className="px-3 py-8 text-center text-slate-500" colSpan={10}>
                  Ni zadetkov za izbrane filtre.
                </td>
              </tr>
            ) : (
              filteredAndSortedOrders.map((order, orderIndex) => {
                const orderAddress = formatOrderAddress(order);
                const customer = order.organization_name || order.contact_name;

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

                    <td className="px-3 py-3">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="block truncate text-sm font-semibold text-brand-600 hover:text-brand-700"
                        title={order.order_number}
                      >
                        {order.order_number}
                      </Link>
                    </td>

                    <td className="px-3 py-3 text-slate-700">
                      <span className="block truncate" title={customer}>
                        {customer}
                      </span>
                    </td>

                    <td className="px-3 py-3 text-slate-600">
                      <span className="block truncate" title={orderAddress || '—'}>
                        {orderAddress || '—'}
                      </span>
                    </td>

                    <td className="px-3 py-3 text-slate-600">
                      <span className="block truncate" title={getCustomerTypeLabel(order.customer_type)}>
                        {getCustomerTypeLabel(order.customer_type)}
                      </span>
                    </td>

                    <td className="px-3 py-3">
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

                    <td className="px-3 py-3 text-right text-slate-700">
                      {formatCurrency(order.total)}
                    </td>

                    <td className="px-3 py-3 text-slate-600">
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

      {searchDocumentsEnabled && documentItems.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <table className="w-full table-fixed text-left text-sm">
            <colgroup>
              <col style={{ width: '18%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '30%' }} />
            </colgroup>
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Št. naročila</th>
                <th className="px-3 py-2">Tip</th>
                <th className="px-3 py-2">Datum</th>
                <th className="px-3 py-2">Prenos</th>
                <th className="px-3 py-2">Datoteka</th>
              </tr>
            </thead>
            <tbody>
              {documentItems.map((item, index) => (
                <tr
                  key={`${item.orderNumber}-${item.filename}-${item.createdAt}-${index}`}
                  className={`border-t border-slate-100 ${
                    index % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                  }`}
                >
                  <td className="px-3 py-2 text-slate-700">{item.orderNumber}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {documentTypeLabelMap.get(item.type) ?? item.type}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {new Date(item.createdAt).toLocaleDateString('sl-SI')}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => downloadFile(item)}
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-brand-200 hover:text-brand-600"
                    >
                      Prenesi
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-xs font-semibold text-brand-600 hover:text-brand-700"
                      title={item.filename}
                    >
                      {item.filename}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
