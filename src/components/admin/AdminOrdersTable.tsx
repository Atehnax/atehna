'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import AdminOrderStatusSelect from '@/components/admin/AdminOrderStatusSelect';
import AdminOrdersPdfCell from '@/components/admin/AdminOrdersPdfCell';
import { getCustomerTypeLabel } from '@/lib/customerType';
import { getStatusLabel } from '@/lib/orderStatus';

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

type SortKey =
  | 'order_number'
  | 'customer'
  | 'address'
  | 'type'
  | 'status'
  | 'payment'
  | 'total'
  | 'created_at';

type SortDirection = 'asc' | 'desc';

type StatusTab =
  | 'all'
  | 'received'
  | 'in_progress'
  | 'sent'
  | 'partially_sent'
  | 'finished'
  | 'cancelled'
  | 'refunded';

type DocumentType =
  | 'all'
  | 'order_summary'
  | 'predracun'
  | 'dobavnica'
  | 'invoice'
  | 'purchase_order';

type UnifiedDocument = {
  order_id: number;
  type: string;
  filename: string;
  blob_url: string;
  created_at: string;
  typeLabel: string;
};

const currencyFormatter = new Intl.NumberFormat('sl-SI', {
  style: 'currency',
  currency: 'EUR'
});

const collator = new Intl.Collator('sl', { sensitivity: 'base', numeric: true });

const documentTypeOptions: Array<{ value: DocumentType; label: string }> = [
  { value: 'all', label: 'Vse vrste' },
  { value: 'order_summary', label: 'Povzetek naročila' },
  { value: 'predracun', label: 'Predračun' },
  { value: 'dobavnica', label: 'Dobavnica' },
  { value: 'invoice', label: 'Račun' },
  { value: 'purchase_order', label: 'Naročilnica' }
];

const documentTypeLabelMap: Map<string, string> = new Map(
  documentTypeOptions.map((option) => [option.value, option.label])
);

const statusTabs: Array<{ value: StatusTab; label: string }> = [
  { value: 'all', label: 'Vsa' },
  { value: 'received', label: 'Prejeto' },
  { value: 'in_progress', label: 'V obdelavi' },
  { value: 'sent', label: 'Poslano' },
  { value: 'partially_sent', label: 'Delno poslano' },
  { value: 'finished', label: 'Zaključeno' },
  { value: 'cancelled', label: 'Preklicano' },
  { value: 'refunded', label: 'Povrnjeno' }
];

// tweak these values to adjust individual column widths
const columnWidths = {
  select: 44,
  order: 120,
  customer: 180,
  address: 250,
  type: 130,
  status: 170,
  payment: 130,
  total: 120,
  date: 190,
  pdfs: 240
};

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

const isRefundedOrderStatus = (status: string) => status === 'refunded_returned';

const getMergedOrderStatusValue = (status: string): StatusTab | string =>
  isRefundedOrderStatus(status) ? 'refunded' : status;

const getOrderStatusLabelForUi = (status: string) => {
  if (isRefundedOrderStatus(status)) return 'Povrnjeno';
  if (status === 'partially_sent') return 'Delno poslano';
  return getStatusLabel(status);
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
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('sl-SI', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date);
};

const formatShortDateForButton = (value: string) => {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('sl-SI', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
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

  const [statusFilter, setStatusFilter] = useState<StatusTab>('all');
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);

  const [isDocumentSearchEnabled, setIsDocumentSearchEnabled] = useState(false);
  const [isDocumentFilterApplied, setIsDocumentFilterApplied] = useState(false);
  const [documentType, setDocumentType] = useState<DocumentType>('all');
  const [message, setMessage] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const selectAllRef = useRef<HTMLInputElement>(null);
  const datePopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!datePopoverRef.current) return;
      if (!datePopoverRef.current.contains(event.target as Node)) {
        setIsDatePopoverOpen(false);
      }
    };

    if (isDatePopoverOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDatePopoverOpen]);

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

  // latest per order + per type
  const latestDocumentsByOrder = useMemo(() => {
    const byOrderByType = new Map<number, Map<string, UnifiedDocument>>();

    const upsert = (documentItem: UnifiedDocument) => {
      const perType = byOrderByType.get(documentItem.order_id) ?? new Map<string, UnifiedDocument>();
      const existing = perType.get(documentItem.type);

      if (!existing) {
        perType.set(documentItem.type, documentItem);
      } else {
        const currentTime = new Date(documentItem.created_at).getTime();
        const existingTime = new Date(existing.created_at).getTime();
        if (Number.isNaN(existingTime) || (!Number.isNaN(currentTime) && currentTime > existingTime)) {
          perType.set(documentItem.type, documentItem);
        }
      }

      byOrderByType.set(documentItem.order_id, perType);
    };

    documents.forEach((documentItem) => {
      upsert({
        order_id: documentItem.order_id,
        type: documentItem.type,
        filename: documentItem.filename,
        blob_url: documentItem.blob_url,
        created_at: documentItem.created_at,
        typeLabel: documentTypeLabelMap.get(documentItem.type) ?? documentItem.type
      });
    });

    attachments.forEach((attachmentItem) => {
      upsert({
        order_id: attachmentItem.order_id,
        type: 'purchase_order',
        filename: attachmentItem.filename,
        blob_url: attachmentItem.blob_url,
        created_at: attachmentItem.created_at,
        typeLabel: documentTypeLabelMap.get('purchase_order') ?? 'Naročilnica'
      });
    });

    const result = new Map<number, UnifiedDocument[]>();
    byOrderByType.forEach((value, key) => {
      result.set(key, Array.from(value.values()));
    });

    return result;
  }, [documents, attachments]);

  const filteredAndSortedOrders = useMemo(() => {
    const normalizedQuery = normalizeForSearch(query);

    const filtered = orders.filter((order) => {
      const mergedStatusValue = getMergedOrderStatusValue(order.status);

      if (statusFilter !== 'all' && mergedStatusValue !== statusFilter) {
        return false;
      }

      // date filter (works across all dates if both empty)
      const orderDate = new Date(order.created_at).getTime();
      if (fromDate) {
        const fromTime = new Date(`${fromDate}T00:00:00`).getTime();
        if (!Number.isNaN(fromTime) && !Number.isNaN(orderDate) && orderDate < fromTime) {
          return false;
        }
      }
      if (toDate) {
        const toTime = new Date(`${toDate}T23:59:59.999`).getTime();
        if (!Number.isNaN(toTime) && !Number.isNaN(orderDate) && orderDate > toTime) {
          return false;
        }
      }

      // main searchable fields
      const customer = order.organization_name || order.contact_name || '';
      const address = formatOrderAddress(order);
      const typeLabel = getCustomerTypeLabel(order.customer_type);
      const statusLabel = getOrderStatusLabelForUi(order.status);
      const paymentLabel = getPaymentLabel(order.payment_status);

      const orderSearchBlob = normalizeForSearch(
        [order.order_number, customer, address, typeLabel, statusLabel, paymentLabel]
          .filter(Boolean)
          .join(' ')
      );

      const orderMatches = !normalizedQuery || orderSearchBlob.includes(normalizedQuery);

      // document searchable fields (latest docs only)
      const latestDocs = latestDocumentsByOrder.get(order.id) ?? [];
      const docsBySelectedType =
        documentType === 'all'
          ? latestDocs
          : latestDocs.filter((documentItem) => documentItem.type === documentType);

      const docsSearchBlob = normalizeForSearch(
        docsBySelectedType
          .map((documentItem) => `${documentItem.typeLabel} ${documentItem.filename}`)
          .join(' ')
      );

      const docsMatch = !normalizedQuery || docsSearchBlob.includes(normalizedQuery);

      if (!isDocumentSearchEnabled) {
        return orderMatches;
      }

      // checkbox on, but "Naloži dokumente" not clicked yet:
      // allow unified search over orders + docs
      if (!isDocumentFilterApplied) {
        if (!normalizedQuery) return true;
        return orderMatches || docsMatch;
      }

      // checkbox on + "Naloži dokumente" clicked:
      // restrict table to orders with selected document types
      if (docsBySelectedType.length === 0) return false;
      if (normalizedQuery && !(orderMatches || docsMatch)) return false;
      return true;
    });

    const sorted = [...filtered].sort((orderA, orderB) => {
      const factor = sortDirection === 'asc' ? 1 : -1;

      let left: string | number;
      let right: string | number;

      switch (sortKey) {
        case 'order_number':
          left = orderA.order_number;
          right = orderB.order_number;
          break;
        case 'customer':
          left = orderA.organization_name || orderA.contact_name || '';
          right = orderB.organization_name || orderB.contact_name || '';
          break;
        case 'address':
          left = formatOrderAddress(orderA);
          right = formatOrderAddress(orderB);
          break;
        case 'type':
          left = getCustomerTypeLabel(orderA.customer_type);
          right = getCustomerTypeLabel(orderB.customer_type);
          break;
        case 'status':
          left = getOrderStatusLabelForUi(orderA.status);
          right = getOrderStatusLabelForUi(orderB.status);
          break;
        case 'payment':
          left = getPaymentLabel(orderA.payment_status);
          right = getPaymentLabel(orderB.payment_status);
          break;
        case 'total':
          left = toAmount(orderA.total);
          right = toAmount(orderB.total);
          break;
        case 'created_at':
        default:
          left = new Date(orderA.created_at).getTime();
          right = new Date(orderB.created_at).getTime();
          break;
      }

      if (typeof left === 'number' && typeof right === 'number') {
        return (left - right) * factor;
      }

      return collator.compare(String(left), String(right)) * factor;
    });

    return sorted;
  }, [
    orders,
    statusFilter,
    query,
    fromDate,
    toDate,
    isDocumentSearchEnabled,
    isDocumentFilterApplied,
    documentType,
    latestDocumentsByOrder,
    sortKey,
    sortDirection
  ]);

  const visibleOrderIds = useMemo(
    () => filteredAndSortedOrders.map((order) => order.id),
    [filteredAndSortedOrders]
  );

  const selectedVisibleCount = useMemo(
    () => visibleOrderIds.filter((orderId) => selected.includes(orderId)).length,
    [visibleOrderIds, selected]
  );

  const allSelected = visibleOrderIds.length > 0 && selectedVisibleCount === visibleOrderIds.length;

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = selectedVisibleCount > 0 && !allSelected;
  }, [allSelected, selectedVisibleCount]);

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
      const merged = new Set(previousSelected);
      visibleOrderIds.forEach((orderId) => merged.add(orderId));
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

  const onSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((previousDirection) => (previousDirection === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortKey(key);
    if (key === 'created_at' || key === 'total') {
      setSortDirection('desc');
    } else {
      setSortDirection('asc');
    }
  };

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return <span className="ml-1 text-slate-300">↕</span>;
    return <span className="ml-1 text-slate-500">{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };

  const dateRangeLabel =
    fromDate || toDate
      ? `${formatShortDateForButton(fromDate)} – ${formatShortDateForButton(toDate)}`
      : 'Izberi interval';

  const handleApplyDocuments = () => {
    if (!isDocumentSearchEnabled) return;
    setIsDocumentFilterApplied(true);
    setMessage('Prikazana so naročila z dokumenti glede na izbrani filter.');
  };

  const handleResetDocumentFilter = () => {
    setIsDocumentFilterApplied(false);
    setMessage(null);
  };

  const downloadFile = async (url: string, filename: string) => {
    const response = await fetch(url);
    if (!response.ok) return false;

    const blob = await response.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);

    return true;
  };

  const handleDownloadAllDocuments = async () => {
    if (!isDocumentSearchEnabled) return;

    setIsDownloading(true);
    setMessage(null);

    try {
      const filesToDownload: Array<{ url: string; filename: string }> = [];

      filteredAndSortedOrders.forEach((order) => {
        const latestDocs = latestDocumentsByOrder.get(order.id) ?? [];
        const docsByType =
          documentType === 'all'
            ? latestDocs
            : latestDocs.filter((documentItem) => documentItem.type === documentType);

        docsByType.forEach((documentItem) => {
          filesToDownload.push({
            url: documentItem.blob_url,
            filename: `${order.order_number}-${documentItem.filename}`
          });
        });
      });

      if (filesToDownload.length === 0) {
        setMessage('Ni dokumentov za prenos glede na trenutno izbiro.');
        return;
      }

      for (const file of filesToDownload) {
        await downloadFile(file.url, file.filename);
      }

      setMessage(`Prenesenih dokumentov: ${filesToDownload.length}`);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="mx-auto w-[75vw]">
      {/* status tabs directly above table controls */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {statusTabs.map((tab) => {
          const isActive = statusFilter === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatusFilter(tab.value)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                isActive
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* unified search/filter row */}
      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative" ref={datePopoverRef}>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
              Datum
            </label>
            <button
              type="button"
              onClick={() => setIsDatePopoverOpen((previousState) => !previousState)}
              className="h-10 min-w-[220px] rounded-lg border border-slate-300 bg-white px-3 text-left text-sm text-slate-700 hover:border-slate-400"
            >
              {dateRangeLabel}
            </button>

            {isDatePopoverOpen && (
              <div className="absolute left-0 z-20 mt-2 w-[320px] rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
                <div className="grid gap-3">
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-500">Od</label>
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(event) => setFromDate(event.target.value)}
                      className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-500">Do</label>
                    <input
                      type="date"
                      value={toDate}
                      onChange={(event) => setToDate(event.target.value)}
                      className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        setFromDate('');
                        setToDate('');
                      }}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                    >
                      Počisti datum
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsDatePopoverOpen(false)}
                      className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white"
                    >
                      Zapri
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="min-w-[240px] flex-1">
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
              Iskanje
            </label>
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ORD, naročnik, naslov, tip, status, plačilo..."
              className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
            />
          </div>

          <div className="flex items-center gap-2 pb-0.5">
            <input
              id="search-documents"
              type="checkbox"
              checked={isDocumentSearchEnabled}
              onChange={(event) => {
                const checked = event.target.checked;
                setIsDocumentSearchEnabled(checked);
                if (!checked) {
                  setIsDocumentFilterApplied(false);
                  setMessage(null);
                }
              }}
              className="h-4 w-4 rounded border-slate-300"
            />
            <label htmlFor="search-documents" className="text-sm text-slate-700">
              Išči dokumente
            </label>
          </div>

          <div className="min-w-[190px]">
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
              Vrsta dokumenta
            </label>
            <select
              value={documentType}
              onChange={(event) => setDocumentType(event.target.value as DocumentType)}
              disabled={!isDocumentSearchEnabled}
              className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100 disabled:text-slate-400"
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
            onClick={handleApplyDocuments}
            disabled={!isDocumentSearchEnabled}
            className="h-10 rounded-full bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            Naloži dokumente
          </button>

          <button
            type="button"
            onClick={handleDownloadAllDocuments}
            disabled={!isDocumentSearchEnabled || isDownloading}
            className="h-10 rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
          >
            {isDownloading ? 'Prenos...' : 'Prenesi vse'}
          </button>

          {isDocumentFilterApplied && (
            <button
              type="button"
              onClick={handleResetDocumentFilter}
              className="h-10 rounded-full px-4 text-sm font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            >
              Počisti filter dokumentov
            </button>
          )}
        </div>

        {message && <p className="mt-2 text-sm text-slate-600">{message}</p>}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full table-fixed text-left text-sm">
          <colgroup>
            <col style={{ width: `${columnWidths.select}px` }} />
            <col style={{ width: `${columnWidths.order}px` }} />
            <col style={{ width: `${columnWidths.customer}px` }} />
            <col style={{ width: `${columnWidths.address}px` }} />
            <col style={{ width: `${columnWidths.type}px` }} />
            <col style={{ width: `${columnWidths.status}px` }} />
            <col style={{ width: `${columnWidths.payment}px` }} />
            <col style={{ width: `${columnWidths.total}px` }} />
            <col style={{ width: `${columnWidths.date}px` }} />
            <col style={{ width: `${columnWidths.pdfs}px` }} />
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
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={selected.length === 0 || isDeleting}
                    className="text-xs font-semibold text-rose-600 disabled:text-slate-300"
                  >
                    {isDeleting ? 'Brisanje...' : 'Izbriši'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onSort('order_number')}
                    className="inline-flex items-center text-xs font-semibold hover:text-slate-700"
                  >
                    Naročilo {sortIndicator('order_number')}
                  </button>
                </div>
              </th>

              <th className="px-3 py-3">
                <button
                  type="button"
                  onClick={() => onSort('customer')}
                  className="inline-flex items-center text-xs font-semibold hover:text-slate-700"
                >
                  Naročnik {sortIndicator('customer')}
                </button>
              </th>

              <th className="px-3 py-3">
                <button
                  type="button"
                  onClick={() => onSort('address')}
                  className="inline-flex items-center text-xs font-semibold hover:text-slate-700"
                >
                  Naslov {sortIndicator('address')}
                </button>
              </th>

              <th className="px-3 py-3">
                <button
                  type="button"
                  onClick={() => onSort('type')}
                  className="inline-flex items-center text-xs font-semibold hover:text-slate-700"
                >
                  Tip {sortIndicator('type')}
                </button>
              </th>

              <th className="px-3 py-3">
                <button
                  type="button"
                  onClick={() => onSort('status')}
                  className="inline-flex items-center text-xs font-semibold hover:text-slate-700"
                >
                  Status {sortIndicator('status')}
                </button>
              </th>

              <th className="px-3 py-3">
                <button
                  type="button"
                  onClick={() => onSort('payment')}
                  className="inline-flex items-center text-xs font-semibold hover:text-slate-700"
                >
                  Plačilo {sortIndicator('payment')}
                </button>
              </th>

              <th className="px-3 py-3 text-right">
                <button
                  type="button"
                  onClick={() => onSort('total')}
                  className="inline-flex items-center text-xs font-semibold hover:text-slate-700"
                >
                  Skupaj {sortIndicator('total')}
                </button>
              </th>

              <th className="px-3 py-3">
                <button
                  type="button"
                  onClick={() => onSort('created_at')}
                  className="inline-flex items-center text-xs font-semibold hover:text-slate-700"
                >
                  Datum {sortIndicator('created_at')}
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
                      <span className="block truncate" title={order.organization_name || order.contact_name}>
                        {order.organization_name || order.contact_name}
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

                    <td className="px-3 py-3 text-right text-slate-700">
                      {formatCurrency(order.total)}
                    </td>

                    <td className="px-3 py-3 whitespace-nowrap text-slate-600">
                      {formatDateTime(order.created_at)}
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
  );
}
