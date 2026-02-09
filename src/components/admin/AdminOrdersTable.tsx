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

type StatusFilterValue =
  | 'all'
  | 'received'
  | 'in_progress'
  | 'sent'
  | 'partially_sent'
  | 'finished'
  | 'cancelled'
  | 'refunded';

type SortKey = 'customer' | 'address' | 'total' | 'created_at';
type SortDirection = 'asc' | 'desc';

type LatestDocumentRow = {
  orderId: number;
  orderNumber: string;
  customer: string;
  address: string;
  orderStatus: string;
  paymentStatus?: string | null;
  orderCreatedAt: string;
  type: string;
  typeLabel: string;
  filename: string;
  url: string;
  createdAt: string;
};

const currencyFormatter = new Intl.NumberFormat('sl-SI', {
  style: 'currency',
  currency: 'EUR'
});

const statusFilters: Array<{ value: StatusFilterValue; label: string }> = [
  { value: 'all', label: 'Vsa' },
  { value: 'received', label: 'Prejeto' },
  { value: 'in_progress', label: 'V obdelavi' },
  { value: 'sent', label: 'Poslano' },
  { value: 'partially_sent', label: 'Delno poslano' },
  { value: 'finished', label: 'Zaključeno' },
  { value: 'cancelled', label: 'Preklicano' },
  { value: 'refunded', label: 'Povrnjeno...' }
];

const documentTypeOptions = [
  { value: 'all', label: 'Vse vrste' },
  { value: 'order_summary', label: 'Povzetek naročila' },
  { value: 'predracun', label: 'Predračun' },
  { value: 'dobavnica', label: 'Dobavnica' },
  { value: 'invoice', label: 'Račun' },
  { value: 'purchase_order', label: 'Naročilnica' }
] as const;

const documentTypeLabelMap = new Map<string, string>(
  documentTypeOptions.map((option): [string, string] => [option.value, option.label])
);

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

const normalizeForSearch = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const isInDateRange = (isoDate: string, fromDate: string, toDate: string) => {
  const target = new Date(isoDate);
  if (Number.isNaN(target.getTime())) return false;

  if (fromDate) {
    const fromBoundary = new Date(`${fromDate}T00:00:00`);
    if (target < fromBoundary) return false;
  }

  if (toDate) {
    const toBoundary = new Date(`${toDate}T23:59:59.999`);
    if (target > toBoundary) return false;
  }

  return true;
};

const orderMatchesStatusFilter = (
  orderStatus: string,
  paymentStatus: string | null | undefined,
  statusFilter: StatusFilterValue
) => {
  if (statusFilter === 'all') return true;

  if (statusFilter === 'refunded') {
    return (
      orderStatus === 'refunded_returned' ||
      orderStatus === 'refunded_not_returned' ||
      paymentStatus === 'refunded'
    );
  }

  return orderStatus === statusFilter;
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

  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>('all');

  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const [isFileSearchEnabled, setIsFileSearchEnabled] = useState(false);
  const [documentType, setDocumentType] = useState<(typeof documentTypeOptions)[number]['value']>('all');
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [isDownloadingDocuments, setIsDownloadingDocuments] = useState(false);
  const [documentMessage, setDocumentMessage] = useState<string | null>(null);
  const [loadedDocuments, setLoadedDocuments] = useState<LatestDocumentRow[]>([]);

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

  const searchQueryNormalized = useMemo(() => normalizeForSearch(searchQuery), [searchQuery]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (!isInDateRange(order.created_at, fromDate, toDate)) return false;
      if (!orderMatchesStatusFilter(order.status, order.payment_status, statusFilter)) return false;

      if (!searchQueryNormalized) return true;

      const address = formatOrderAddress(order);
      const customer = order.organization_name || order.contact_name;
      const paymentLabel = getPaymentLabel(order.payment_status);
      const customerTypeLabel = getCustomerTypeLabel(order.customer_type);

      const searchableText = normalizeForSearch(
        [
          order.order_number,
          customer,
          address,
          order.customer_type,
          customerTypeLabel,
          order.status,
          paymentLabel
        ]
          .filter(Boolean)
          .join(' ')
      );

      return searchableText.includes(searchQueryNormalized);
    });
  }, [orders, fromDate, toDate, statusFilter, searchQueryNormalized]);

  const sortedOrders = useMemo(() => {
    const rows = [...filteredOrders];
    const directionMultiplier = sortDirection === 'asc' ? 1 : -1;

    rows.sort((leftOrder, rightOrder) => {
      if (sortKey === 'total') {
        const leftTotal = toAmount(leftOrder.total);
        const rightTotal = toAmount(rightOrder.total);
        return (leftTotal - rightTotal) * directionMultiplier;
      }

      if (sortKey === 'created_at') {
        const leftDate = new Date(leftOrder.created_at).getTime();
        const rightDate = new Date(rightOrder.created_at).getTime();
        return (leftDate - rightDate) * directionMultiplier;
      }

      if (sortKey === 'customer') {
        const leftCustomer = (leftOrder.organization_name || leftOrder.contact_name || '').trim();
        const rightCustomer = (rightOrder.organization_name || rightOrder.contact_name || '').trim();
        return leftCustomer.localeCompare(rightCustomer, 'sl', { sensitivity: 'base' }) * directionMultiplier;
      }

      const leftAddress = formatOrderAddress(leftOrder);
      const rightAddress = formatOrderAddress(rightOrder);
      return leftAddress.localeCompare(rightAddress, 'sl', { sensitivity: 'base' }) * directionMultiplier;
    });

    return rows;
  }, [filteredOrders, sortKey, sortDirection]);

  const latestDocumentsPerOrderAndType = useMemo(() => {
    const orderById = new Map<number, OrderRow>();
    orders.forEach((order) => orderById.set(order.id, order));

    const combinedDocuments: Array<{
      order_id: number;
      type: string;
      filename: string;
      blob_url: string;
      created_at: string;
    }> = [
      ...documents.map((documentItem) => ({
        order_id: documentItem.order_id,
        type: documentItem.type,
        filename: documentItem.filename,
        blob_url: documentItem.blob_url,
        created_at: documentItem.created_at
      })),
      ...attachments.map((attachmentItem) => ({
        order_id: attachmentItem.order_id,
        type: 'purchase_order',
        filename: attachmentItem.filename,
        blob_url: attachmentItem.blob_url,
        created_at: attachmentItem.created_at
      }))
    ];

    const latestByOrderAndType = new Map<string, LatestDocumentRow>();

    combinedDocuments.forEach((documentItem) => {
      const order = orderById.get(documentItem.order_id);
      if (!order) return;

      const key = `${documentItem.order_id}:${documentItem.type}`;
      const existing = latestByOrderAndType.get(key);

      const existingTimestamp = existing ? new Date(existing.createdAt).getTime() : -1;
      const currentTimestamp = new Date(documentItem.created_at).getTime();

      if (existing && currentTimestamp <= existingTimestamp) return;

      const customer = order.organization_name || order.contact_name;
      const address = formatOrderAddress(order);

      latestByOrderAndType.set(key, {
        orderId: order.id,
        orderNumber: order.order_number,
        customer,
        address,
        orderStatus: order.status,
        paymentStatus: order.payment_status,
        orderCreatedAt: order.created_at,
        type: documentItem.type,
        typeLabel: documentTypeLabelMap.get(documentItem.type) ?? documentItem.type,
        filename: documentItem.filename,
        url: documentItem.blob_url,
        createdAt: documentItem.created_at
      });
    });

    return Array.from(latestByOrderAndType.values()).sort(
      (leftDocument, rightDocument) =>
        new Date(rightDocument.createdAt).getTime() - new Date(leftDocument.createdAt).getTime()
    );
  }, [orders, documents, attachments]);

  const filteredLatestDocuments = useMemo(() => {
    return latestDocumentsPerOrderAndType.filter((documentItem) => {
      if (!isInDateRange(documentItem.orderCreatedAt, fromDate, toDate)) return false;

      if (
        !orderMatchesStatusFilter(
          documentItem.orderStatus,
          documentItem.paymentStatus,
          statusFilter
        )
      ) {
        return false;
      }

      if (documentType !== 'all' && documentItem.type !== documentType) return false;

      if (!searchQueryNormalized) return true;

      const searchableText = normalizeForSearch(
        [
          documentItem.orderNumber,
          documentItem.customer,
          documentItem.address,
          documentItem.type,
          documentItem.typeLabel,
          documentItem.filename
        ]
          .filter(Boolean)
          .join(' ')
      );

      return searchableText.includes(searchQueryNormalized);
    });
  }, [
    latestDocumentsPerOrderAndType,
    fromDate,
    toDate,
    statusFilter,
    documentType,
    searchQueryNormalized
  ]);

  const visibleOrderIds = useMemo(() => sortedOrders.map((order) => order.id), [sortedOrders]);

  const allSelected =
    visibleOrderIds.length > 0 && visibleOrderIds.every((orderId) => selected.includes(orderId));

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = selected.length > 0 && !allSelected;
  }, [allSelected, selected.length]);

  useEffect(() => {
    // keep selection clean when dataset changes
    const existingOrderIds = new Set(orders.map((order) => order.id));
    setSelected((previousSelected) =>
      previousSelected.filter((orderId) => existingOrderIds.has(orderId))
    );
  }, [orders]);

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

    setSelected((previousSelected) => {
      const merged = new Set([...previousSelected, ...visibleOrderIds]);
      return Array.from(merged);
    });
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

  const toggleSort = (column: SortKey) => {
    if (sortKey === column) {
      setSortDirection((previousDirection) => (previousDirection === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortKey(column);
    setSortDirection(column === 'created_at' ? 'desc' : 'asc');
  };

  const sortIndicator = (column: SortKey) => {
    if (sortKey !== column) return '↕';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  const resetFileSearchResults = () => {
    setLoadedDocuments([]);
    setDocumentMessage(null);
  };

  const handleLoadDocuments = async () => {
    if (!isFileSearchEnabled) return;

    setIsLoadingDocuments(true);
    setDocumentMessage(null);

    try {
      const result = filteredLatestDocuments;
      setLoadedDocuments(result);

      if (result.length === 0) {
        setDocumentMessage('Ni dokumentov za izbrane filtre.');
        return;
      }

      setDocumentMessage(`Najdenih dokumentov (zadnje verzije): ${result.length}`);
    } finally {
      setIsLoadingDocuments(false);
    }
  };

  const downloadFile = async (documentItem: LatestDocumentRow) => {
    const response = await fetch(documentItem.url);
    if (!response.ok) return;

    const blob = await response.blob();
    const link = document.createElement('a');

    link.href = URL.createObjectURL(blob);
    link.download = `${documentItem.orderNumber}-${documentItem.filename}`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(link.href);
  };

  const handleDownloadAll = async () => {
    if (!isFileSearchEnabled) return;

    setIsDownloadingDocuments(true);
    setDocumentMessage(null);

    try {
      const source = loadedDocuments.length > 0 ? loadedDocuments : filteredLatestDocuments;
      if (source.length === 0) {
        setDocumentMessage('Ni dokumentov za prenos.');
        return;
      }

      for (const documentItem of source) {
        // sequential to avoid browser throttling / race mess
        await downloadFile(documentItem);
      }

      setDocumentMessage(`Prenesenih dokumentov: ${source.length}`);
    } finally {
      setIsDownloadingDocuments(false);
    }
  };

  const tableColSpan = 10;

  return (
    <div className="w-full">
      <div className="mx-auto w-fit max-w-full space-y-4">
        {/* unified filters + file search */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[180px_180px_minmax(360px,1fr)]">
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">Od</label>
              <input
                type="date"
                value={fromDate}
                onChange={(event) => {
                  setFromDate(event.target.value);
                  resetFileSearchResults();
                }}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">Do</label>
              <input
                type="date"
                value={toDate}
                onChange={(event) => {
                  setToDate(event.target.value);
                  resetFileSearchResults();
                }}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">Iskanje</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  resetFileSearchResults();
                }}
                placeholder="Šola, kontakt, naslov, tip..."
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {statusFilters.map((statusOption) => {
              const isActive = statusFilter === statusOption.value;

              return (
                <button
                  key={statusOption.value}
                  type="button"
                  onClick={() => {
                    setStatusFilter(statusOption.value);
                    resetFileSearchResults();
                  }}
                  className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-brand-600 text-white'
                      : 'border border-slate-200 bg-white text-slate-600 hover:border-brand-200 hover:text-brand-600'
                  }`}
                >
                  {statusOption.label}
                </button>
              );
            })}
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-end gap-3">
              <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={isFileSearchEnabled}
                  onChange={(event) => {
                    const nextChecked = event.target.checked;
                    setIsFileSearchEnabled(nextChecked);
                    if (!nextChecked) {
                      setLoadedDocuments([]);
                      setDocumentMessage(null);
                    }
                  }}
                />
                Išči pdf-je
              </label>

              <div className="min-w-[220px]">
                <label className="text-xs font-semibold uppercase text-slate-500">Vrsta dokumenta</label>
                <select
                  value={documentType}
                  onChange={(event) => {
                    setDocumentType(event.target.value as (typeof documentTypeOptions)[number]['value']);
                    resetFileSearchResults();
                  }}
                  disabled={!isFileSearchEnabled}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
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
                disabled={!isFileSearchEnabled || isLoadingDocuments}
                className="rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
              >
                {isLoadingDocuments ? 'Nalaganje...' : 'Naloži datoteke'}
              </button>

              <button
                type="button"
                onClick={handleDownloadAll}
                disabled={!isFileSearchEnabled || isDownloadingDocuments || isLoadingDocuments}
                className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600 transition hover:border-brand-200 hover:text-brand-600 disabled:cursor-not-allowed disabled:text-slate-300"
              >
                {isDownloadingDocuments ? 'Prenos...' : 'Prenesi vse'}
              </button>
            </div>

            {documentMessage && <p className="mt-2 text-sm text-slate-600">{documentMessage}</p>}

            {isFileSearchEnabled && loadedDocuments.length > 0 && (
              <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Št. naročila</th>
                      <th className="px-3 py-2">Naročnik</th>
                      <th className="px-3 py-2">Vrsta dokumenta</th>
                      <th className="px-3 py-2">Datum dokumenta</th>
                      <th className="px-3 py-2">Datoteka</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadedDocuments.map((documentItem) => (
                      <tr
                        key={`${documentItem.orderId}-${documentItem.type}-${documentItem.createdAt}`}
                        className="border-t border-slate-100"
                      >
                        <td className="px-3 py-2 text-slate-700">{documentItem.orderNumber}</td>
                        <td className="px-3 py-2 text-slate-600">{documentItem.customer}</td>
                        <td className="px-3 py-2 text-slate-600">{documentItem.typeLabel}</td>
                        <td className="px-3 py-2 text-slate-600">
                          {new Date(documentItem.createdAt).toLocaleDateString('sl-SI')}
                        </td>
                        <td className="px-3 py-2">
                          <a
                            href={documentItem.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                          >
                            Odpri →
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-max table-auto whitespace-nowrap text-left text-sm">
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
                    className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700"
                  >
                    Naročnik <span>{sortIndicator('customer')}</span>
                  </button>
                </th>

                <th className="px-3 py-3">
                  <button
                    type="button"
                    onClick={() => toggleSort('address')}
                    className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700"
                  >
                    Naslov <span>{sortIndicator('address')}</span>
                  </button>
                </th>

                <th className="px-3 py-3">Tip</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Plačilo</th>

                <th className="px-3 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort('total')}
                    className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700"
                  >
                    Skupaj <span>{sortIndicator('total')}</span>
                  </button>
                </th>

                <th className="px-3 py-3">
                  <button
                    type="button"
                    onClick={() => toggleSort('created_at')}
                    className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700"
                  >
                    Datum <span>{sortIndicator('created_at')}</span>
                  </button>
                </th>

                <th className="px-3 py-3">PDFs</th>
              </tr>
            </thead>

            <tbody>
              {sortedOrders.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-slate-500" colSpan={tableColSpan}>
                    Ni zadetkov za izbrane filtre.
                  </td>
                </tr>
              ) : (
                sortedOrders.map((order, rowIndex) => {
                  const orderAddress = formatOrderAddress(order);

                  return (
                    <tr
                      key={order.id}
                      className={`border-t border-slate-100 ${
                        rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50'
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
                        {order.organization_name || order.contact_name}
                      </td>

                      <td className="px-3 py-3 text-slate-600">
                        {orderAddress || '—'}
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
      </div>
    </div>
  );
}
