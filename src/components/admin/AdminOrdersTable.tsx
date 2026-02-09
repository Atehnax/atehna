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

type CombinedDocument = {
  id: number;
  order_id: number;
  type: string;
  typeLabel: string;
  filename: string;
  blob_url: string;
  created_at: string;
};

type StatusFilterKey =
  | 'all'
  | 'received'
  | 'in_progress'
  | 'sent'
  | 'partially_sent'
  | 'finished'
  | 'cancelled'
  | 'refunded';

type SortField = 'customer' | 'address' | 'total' | 'created_at';
type SortDirection = 'asc' | 'desc';

const statusTabs: Array<{ key: StatusFilterKey; label: string }> = [
  { key: 'all', label: 'Vsa' },
  { key: 'received', label: 'Prejeto' },
  { key: 'in_progress', label: 'V obdelavi' },
  { key: 'sent', label: 'Poslano' },
  { key: 'partially_sent', label: 'Delno poslano' },
  { key: 'finished', label: 'Zaključeno' },
  { key: 'cancelled', label: 'Preklicano' },
  { key: 'refunded', label: 'Povrnjeno' }
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
  documentTypeOptions.map((option) => [option.value, option.label])
);

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
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const includesNormalized = (haystack: string, needle: string) => {
  if (!needle) return true;
  return normalizeText(haystack).includes(needle);
};

const statusMatchesFilter = (status: string, filter: StatusFilterKey) => {
  if (filter === 'all') return true;
  if (filter === 'refunded') {
    return (
      status === 'refunded' ||
      status === 'refunded_returned' ||
      status === 'refunded_not_returned'
    );
  }
  if (filter === 'partially_sent') {
    return status === 'partially_sent' || status === 'partially_shipped';
  }
  return status === filter;
};

const toTime = (value: string | null | undefined) => {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
};

const startOfDayTime = (ymd: string) => {
  const time = new Date(`${ymd}T00:00:00`).getTime();
  return Number.isFinite(time) ? time : null;
};

const endOfDayTime = (ymd: string) => {
  const time = new Date(`${ymd}T23:59:59.999`).getTime();
  return Number.isFinite(time) ? time : null;
};

const formatDateForLabel = (ymd: string) => {
  if (!ymd) return '';
  const date = new Date(`${ymd}T00:00:00`);
  if (Number.isNaN(date.getTime())) return ymd;
  return new Intl.DateTimeFormat('sl-SI', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(date);
};

const ymd = (date: Date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy.toISOString().slice(0, 10);
};

const shiftDays = (date: Date, days: number) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};

function SortHeader({
  label,
  field,
  activeField,
  direction,
  onToggle,
  align = 'left'
}: {
  label: string;
  field: SortField;
  activeField: SortField;
  direction: SortDirection;
  onToggle: (field: SortField) => void;
  align?: 'left' | 'right';
}) {
  const isActive = activeField === field;
  const arrow = isActive ? (direction === 'asc' ? '↑' : '↓') : '↕';

  return (
    <button
      type="button"
      onClick={() => onToggle(field)}
      className={`inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700 ${
        align === 'right' ? 'ml-auto' : ''
      }`}
      title={`Razvrsti po: ${label}`}
    >
      <span>{label}</span>
      <span className="text-[11px]">{arrow}</span>
    </button>
  );
}

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

  const [statusFilter, setStatusFilter] = useState<StatusFilterKey>('all');
  const [query, setQuery] = useState('');
  const [searchDocumentsEnabled, setSearchDocumentsEnabled] = useState(false);
  const [documentType, setDocumentType] = useState<string>('all');

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [isRangeOpen, setIsRangeOpen] = useState(false);
  const rangeRef = useRef<HTMLDivElement>(null);

  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showDocumentResults, setShowDocumentResults] = useState(false);
  const [documentMessage, setDocumentMessage] = useState<string | null>(null);

  const normalizedQuery = useMemo(() => normalizeText(query), [query]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rangeRef.current) return;
      if (!rangeRef.current.contains(event.target as Node)) {
        setIsRangeOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsRangeOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!searchDocumentsEnabled) {
      setDocumentType('all');
      setShowDocumentResults(false);
      setDocumentMessage(null);
    }
  }, [searchDocumentsEnabled]);

  const normalizedFromTo = useMemo(() => {
    if (!fromDate || !toDate) return { from: fromDate, to: toDate };
    if (fromDate <= toDate) return { from: fromDate, to: toDate };
    return { from: toDate, to: fromDate };
  }, [fromDate, toDate]);

  const dateRangeLabel = useMemo(() => {
    if (!normalizedFromTo.from && !normalizedFromTo.to) return 'Vsi datumi';
    if (normalizedFromTo.from && normalizedFromTo.to) {
      return `${formatDateForLabel(normalizedFromTo.from)} – ${formatDateForLabel(
        normalizedFromTo.to
      )}`;
    }
    if (normalizedFromTo.from) return `Od ${formatDateForLabel(normalizedFromTo.from)}`;
    return `Do ${formatDateForLabel(normalizedFromTo.to)}`;
  }, [normalizedFromTo.from, normalizedFromTo.to]);

  const applyPreset = (preset: 'today' | 'yesterday' | 'last7' | 'last30' | 'last90' | 'last365') => {
    const today = new Date();

    if (preset === 'today') {
      const value = ymd(today);
      setFromDate(value);
      setToDate(value);
      setIsRangeOpen(false);
      return;
    }

    if (preset === 'yesterday') {
      const value = ymd(shiftDays(today, -1));
      setFromDate(value);
      setToDate(value);
      setIsRangeOpen(false);
      return;
    }

    if (preset === 'last7') {
      setFromDate(ymd(shiftDays(today, -6)));
      setToDate(ymd(today));
      setIsRangeOpen(false);
      return;
    }

    if (preset === 'last30') {
      setFromDate(ymd(shiftDays(today, -29)));
      setToDate(ymd(today));
      setIsRangeOpen(false);
      return;
    }

    if (preset === 'last90') {
      setFromDate(ymd(shiftDays(today, -89)));
      setToDate(ymd(today));
      setIsRangeOpen(false);
      return;
    }

    setFromDate(ymd(shiftDays(today, -364)));
    setToDate(ymd(today));
    setIsRangeOpen(false);
  };

  const clearRange = () => {
    setFromDate('');
    setToDate('');
    setIsRangeOpen(false);
  };

  const isOrderInDateRange = (order: OrderRow) => {
    if (!normalizedFromTo.from && !normalizedFromTo.to) return true;

    const orderTime = toTime(order.created_at);
    if (orderTime === 0) return false;

    const fromTime = normalizedFromTo.from ? startOfDayTime(normalizedFromTo.from) : null;
    const toTimeInclusive = normalizedFromTo.to ? endOfDayTime(normalizedFromTo.to) : null;

    if (fromTime !== null && orderTime < fromTime) return false;
    if (toTimeInclusive !== null && orderTime > toTimeInclusive) return false;
    return true;
  };

  const latestDocuments = useMemo(() => {
    const combined: CombinedDocument[] = [
      ...documents.map((documentItem) => ({
        id: documentItem.id,
        order_id: documentItem.order_id,
        type: documentItem.type,
        typeLabel: documentTypeLabelMap.get(documentItem.type) ?? documentItem.type,
        filename: documentItem.filename,
        blob_url: documentItem.blob_url,
        created_at: documentItem.created_at
      })),
      ...attachments.map((attachmentItem) => ({
        id: attachmentItem.id,
        order_id: attachmentItem.order_id,
        type: 'purchase_order',
        typeLabel: documentTypeLabelMap.get('purchase_order') ?? 'Naročilnica',
        filename: attachmentItem.filename,
        blob_url: attachmentItem.blob_url,
        created_at: attachmentItem.created_at
      }))
    ];

    const byOrderAndType = new Map<string, CombinedDocument>();

    for (const item of combined) {
      const key = `${item.order_id}::${item.type}`;
      const existing = byOrderAndType.get(key);

      if (!existing) {
        byOrderAndType.set(key, item);
        continue;
      }

      const existingTime = toTime(existing.created_at);
      const nextTime = toTime(item.created_at);

      if (nextTime > existingTime || (nextTime === existingTime && item.id > existing.id)) {
        byOrderAndType.set(key, item);
      }
    }

    return Array.from(byOrderAndType.values()).sort(
      (leftItem, rightItem) => toTime(rightItem.created_at) - toTime(leftItem.created_at)
    );
  }, [documents, attachments]);

  const latestDocumentsByOrder = useMemo(() => {
    const byOrder = new Map<number, CombinedDocument[]>();

    for (const documentItem of latestDocuments) {
      const existingList = byOrder.get(documentItem.order_id) ?? [];
      existingList.push(documentItem);
      byOrder.set(documentItem.order_id, existingList);
    }

    return byOrder;
  }, [latestDocuments]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (!statusMatchesFilter(order.status, statusFilter)) return false;
      if (!isOrderInDateRange(order)) return false;

      const orderAddress = formatOrderAddress(order);
      const customer = order.organization_name || order.contact_name;
      const orderHaystack = [
        order.order_number,
        customer,
        order.contact_name,
        order.organization_name ?? '',
        orderAddress,
        getCustomerTypeLabel(order.customer_type),
        getPaymentLabel(order.payment_status),
        formatCurrency(order.total),
        new Date(order.created_at).toLocaleDateString('sl-SI')
      ]
        .filter(Boolean)
        .join(' ');

      const orderDocumentsForOrder = latestDocumentsByOrder.get(order.id) ?? [];
      const documentsAfterTypeFilter =
        documentType === 'all'
          ? orderDocumentsForOrder
          : orderDocumentsForOrder.filter((documentItem) => documentItem.type === documentType);

      if (searchDocumentsEnabled && documentType !== 'all' && documentsAfterTypeFilter.length === 0) {
        return false;
      }

      if (!normalizedQuery) return true;

      const orderMatches = includesNormalized(orderHaystack, normalizedQuery);
      if (orderMatches) return true;

      if (!searchDocumentsEnabled) return false;

      const documentHaystack = documentsAfterTypeFilter
        .map(
          (documentItem) =>
            `${documentItem.filename} ${documentItem.type} ${documentItem.typeLabel} ${documentItem.created_at}`
        )
        .join(' ');

      return includesNormalized(documentHaystack, normalizedQuery);
    });
  }, [
    orders,
    statusFilter,
    normalizedQuery,
    searchDocumentsEnabled,
    documentType,
    latestDocumentsByOrder,
    normalizedFromTo.from,
    normalizedFromTo.to
  ]);

  const sortedOrders = useMemo(() => {
    const nextOrders = [...filteredOrders];

    nextOrders.sort((leftOrder, rightOrder) => {
      let comparison = 0;

      if (sortField === 'customer') {
        const leftCustomer = (leftOrder.organization_name || leftOrder.contact_name || '').toString();
        const rightCustomer = (rightOrder.organization_name || rightOrder.contact_name || '').toString();
        comparison = leftCustomer.localeCompare(rightCustomer, 'sl', { sensitivity: 'base' });
      } else if (sortField === 'address') {
        const leftAddress = formatOrderAddress(leftOrder);
        const rightAddress = formatOrderAddress(rightOrder);
        comparison = leftAddress.localeCompare(rightAddress, 'sl', { sensitivity: 'base' });
      } else if (sortField === 'total') {
        comparison = toAmount(leftOrder.total) - toAmount(rightOrder.total);
      } else {
        comparison = toTime(leftOrder.created_at) - toTime(rightOrder.created_at);
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return nextOrders;
  }, [filteredOrders, sortField, sortDirection]);

  const filteredLatestDocuments = useMemo(() => {
    const allowedOrderIds = new Set(sortedOrders.map((order) => order.id));

    return latestDocuments.filter((documentItem) => {
      if (!allowedOrderIds.has(documentItem.order_id)) return false;
      if (documentType !== 'all' && documentItem.type !== documentType) return false;

      if (!normalizedQuery) return true;

      const order = orders.find((orderItem) => orderItem.id === documentItem.order_id);
      const orderAddress = order ? formatOrderAddress(order) : '';
      const orderCustomer = order ? order.organization_name || order.contact_name : '';

      const haystack = [
        documentItem.filename,
        documentItem.type,
        documentItem.typeLabel,
        order?.order_number ?? '',
        orderCustomer ?? '',
        orderAddress
      ].join(' ');

      return includesNormalized(haystack, normalizedQuery);
    });
  }, [sortedOrders, latestDocuments, documentType, normalizedQuery, orders]);

  const visibleOrderIds = sortedOrders.map((order) => order.id);
  const visibleOrderIdSet = useMemo(() => new Set(visibleOrderIds), [visibleOrderIds]);

  const selectedVisibleCount = selected.filter((selectedId) => visibleOrderIdSet.has(selectedId)).length;
  const allSelected = visibleOrderIds.length > 0 && selectedVisibleCount === visibleOrderIds.length;

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = selectedVisibleCount > 0 && !allSelected;
  }, [allSelected, selectedVisibleCount]);

  const toggleSort = (field: SortField) => {
    if (sortField !== field) {
      setSortField(field);
      setSortDirection(field === 'created_at' ? 'desc' : 'asc');
      return;
    }

    setSortDirection((previousDirection) => (previousDirection === 'asc' ? 'desc' : 'asc'));
  };

  const toggleSelected = (orderId: number) => {
    setSelected((previousSelected) =>
      previousSelected.includes(orderId)
        ? previousSelected.filter((selectedId) => selectedId !== orderId)
        : [...previousSelected, orderId]
    );
  };

  const toggleAllVisible = () => {
    if (allSelected) {
      setSelected((previousSelected) =>
        previousSelected.filter((selectedId) => !visibleOrderIdSet.has(selectedId))
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
        selected.map((orderId) => fetch(`/api/admin/orders/${orderId}`, { method: 'DELETE' }))
      );
      setSelected([]);
      window.location.reload();
    } finally {
      setIsDeleting(false);
    }
  };

  const downloadFile = async (documentItem: CombinedDocument, orderNumber: string) => {
    const response = await fetch(documentItem.blob_url);
    if (!response.ok) throw new Error(`Prenos ni uspel: ${documentItem.filename}`);

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `${orderNumber}-${documentItem.filename}`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(objectUrl);
  };

  const handleLoadDocuments = async () => {
    if (!searchDocumentsEnabled) return;

    setIsLoadingDocuments(true);
    try {
      const count = filteredLatestDocuments.length;
      setDocumentMessage(count > 0 ? `Najdenih dokumentov: ${count}` : 'Ni dokumentov za izbran filter.');
      setShowDocumentResults(true);
    } finally {
      setIsLoadingDocuments(false);
    }
  };

  const handleDownloadAll = async () => {
    if (!searchDocumentsEnabled) return;
    if (filteredLatestDocuments.length === 0) return;

    setIsDownloading(true);
    try {
      const orderNumberById = new Map(sortedOrders.map((order) => [order.id, order.order_number]));

      for (const documentItem of filteredLatestDocuments) {
        const orderNumber = orderNumberById.get(documentItem.order_id) ?? `ORD-${documentItem.order_id}`;
        await downloadFile(documentItem, orderNumber);
      }
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="mx-auto w-[75vw] min-w-[1200px] max-w-[1900px]">
      <div className="flex flex-col gap-4">
        {/* Unified search row */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-3">
            <div ref={rangeRef} className="relative w-[260px]">
              <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                Datumski interval
              </label>
              <button
                type="button"
                onClick={() => setIsRangeOpen((previousOpen) => !previousOpen)}
                className="flex h-10 w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:border-slate-400"
              >
                <span className="truncate">{dateRangeLabel}</span>
                <span className="text-slate-400">▾</span>
              </button>

              {isRangeOpen && (
                <div className="absolute z-40 mt-2 w-[560px] rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
                  <div className="grid grid-cols-[190px_1fr] gap-4">
                    <div className="space-y-1 border-r border-slate-200 pr-3">
                      <button
                        type="button"
                        onClick={() => applyPreset('today')}
                        className="block w-full rounded-md px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100"
                      >
                        Danes
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('yesterday')}
                        className="block w-full rounded-md px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100"
                      >
                        Včeraj
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('last7')}
                        className="block w-full rounded-md px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100"
                      >
                        Zadnjih 7 dni
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('last30')}
                        className="block w-full rounded-md px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100"
                      >
                        Zadnjih 30 dni
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('last90')}
                        className="block w-full rounded-md px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100"
                      >
                        Zadnje 3 mesece
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('last365')}
                        className="block w-full rounded-md px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100"
                      >
                        Zadnje leto
                      </button>
                      <button
                        type="button"
                        onClick={clearRange}
                        className="mt-2 block w-full rounded-md px-2 py-1.5 text-left text-sm font-semibold text-slate-600 hover:bg-slate-100"
                      >
                        Počisti datum
                      </button>
                    </div>

                    <div>
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Obdobje po meri
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                            Od
                          </label>
                          <input
                            type="date"
                            value={fromDate}
                            onChange={(event) => setFromDate(event.target.value)}
                            className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                            Do
                          </label>
                          <input
                            type="date"
                            value={toDate}
                            onChange={(event) => setToDate(event.target.value)}
                            className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
                          />
                        </div>
                      </div>
                      <div className="mt-4 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setIsRangeOpen(false)}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                        >
                          Zapri
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsRangeOpen(false)}
                          className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                        >
                          Uporabi
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="w-[320px]">
              <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Iskanje</label>
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Št. naročila, naročnik, naslov, tip"
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
            </div>

            <label className="inline-flex h-10 items-center gap-2 self-end rounded-lg border border-slate-200 px-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={searchDocumentsEnabled}
                onChange={(event) => setSearchDocumentsEnabled(event.target.checked)}
              />
              <span>Išči dokumente</span>
            </label>

            <div className="w-[220px]">
              <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                Vrsta dokumenta
              </label>
              <select
                value={documentType}
                onChange={(event) => setDocumentType(event.target.value)}
                disabled={!searchDocumentsEnabled}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
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
              className="h-10 rounded-full bg-brand-600 px-5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              {isLoadingDocuments ? 'Nalaganje...' : 'Naloži dokumente'}
            </button>

            <button
              type="button"
              onClick={handleDownloadAll}
              disabled={!searchDocumentsEnabled || isLoadingDocuments || isDownloading}
              className="h-10 rounded-full border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition hover:border-brand-200 hover:text-brand-600 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              {isDownloading ? 'Prenos...' : 'Prenesi vse'}
            </button>
          </div>

          {documentMessage && <p className="mt-3 text-sm text-slate-600">{documentMessage}</p>}
        </section>

        {/* Status tabs immediately above table */}
        <div className="flex flex-wrap gap-2">
          {statusTabs.map((tab) => {
            const isActive = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-600 hover:border-brand-200 hover:text-brand-600'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full table-fixed text-left text-sm">
            <colgroup>
              <col style={{ width: '44px' }} />
              <col style={{ width: '96px' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '15%' }} />
            </colgroup>

            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-3">
                  <input
                    type="checkbox"
                    ref={selectAllRef}
                    checked={allSelected}
                    onChange={toggleAllVisible}
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
                  <SortHeader
                    label="Naročnik"
                    field="customer"
                    activeField={sortField}
                    direction={sortDirection}
                    onToggle={toggleSort}
                  />
                </th>
                <th className="px-3 py-3">
                  <SortHeader
                    label="Naslov"
                    field="address"
                    activeField={sortField}
                    direction={sortDirection}
                    onToggle={toggleSort}
                  />
                </th>
                <th className="px-3 py-3">Tip</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Plačilo</th>
                <th className="px-3 py-3 text-right">
                  <SortHeader
                    label="Skupaj"
                    field="total"
                    activeField={sortField}
                    direction={sortDirection}
                    onToggle={toggleSort}
                    align="right"
                  />
                </th>
                <th className="px-3 py-3">
                  <SortHeader
                    label="Datum"
                    field="created_at"
                    activeField={sortField}
                    direction={sortDirection}
                    onToggle={toggleSort}
                  />
                </th>
                <th className="px-3 py-3">Dokumenti</th>
              </tr>
            </thead>

            <tbody>
              {sortedOrders.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-slate-500" colSpan={10}>
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
                        <span
                          className="block truncate"
                          title={order.organization_name || order.contact_name}
                        >
                          {order.organization_name || order.contact_name}
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
                          documents={documents.filter((documentItem) => documentItem.order_id === order.id)}
                          attachments={attachments.filter(
                            (attachmentItem) => attachmentItem.order_id === order.id
                          )}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {showDocumentResults && searchDocumentsEnabled && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
              Najdeni dokumenti (zadnje verzije)
            </h3>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Št. naročila</th>
                    <th className="px-3 py-2">Vrsta dokumenta</th>
                    <th className="px-3 py-2">Datoteka</th>
                    <th className="px-3 py-2">Datum</th>
                    <th className="px-3 py-2">Odpri</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLatestDocuments.length === 0 ? (
                    <tr>
                      <td className="px-3 py-4 text-slate-500" colSpan={5}>
                        Ni dokumentov za izbran filter.
                      </td>
                    </tr>
                  ) : (
                    filteredLatestDocuments.map((documentItem) => {
                      const order = sortedOrders.find(
                        (orderItem) => orderItem.id === documentItem.order_id
                      );
                      const orderNumber = order?.order_number ?? `ORD-${documentItem.order_id}`;

                      return (
                        <tr
                          key={`${documentItem.order_id}-${documentItem.type}-${documentItem.id}`}
                          className="border-t border-slate-100"
                        >
                          <td className="px-3 py-2 text-slate-700">{orderNumber}</td>
                          <td className="px-3 py-2 text-slate-600">{documentItem.typeLabel}</td>
                          <td className="px-3 py-2 text-slate-600">{documentItem.filename}</td>
                          <td className="px-3 py-2 text-slate-600">
                            {new Date(documentItem.created_at).toLocaleDateString('sl-SI')}
                          </td>
                          <td className="px-3 py-2">
                            <a
                              href={documentItem.blob_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                            >
                              Odpri →
                            </a>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
