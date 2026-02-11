'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import AdminOrderStatusSelect from '@/components/admin/AdminOrderStatusSelect';
import AdminOrdersPdfCell from '@/components/admin/AdminOrdersPdfCell';
import AdminOrderPaymentSelect from '@/components/admin/AdminOrderPaymentSelect';
import StatusChip from '@/components/admin/StatusChip';
import PaymentChip from '@/components/admin/PaymentChip';
import { getCustomerTypeLabel } from '@/lib/customerType';
import { ORDER_STATUS_OPTIONS } from '@/lib/orderStatus';
import { formatSlDate, formatSlDateFromDateInput, formatSlDateTime } from '@/lib/format/dateTime';
import { PAYMENT_STATUS_OPTIONS, getPaymentLabel, isPaymentStatus } from '@/lib/paymentStatus';

import {
  type Attachment,
  type DocumentType,
  type OrderRow,
  type PdfDoc,
  type SortDirection,
  type SortKey,
  type StatusTab,
  type UnifiedDocument,
  columnWidths,
  documentTypeLabelMap,
  documentTypeOptions,
  formatCurrency,
  formatOrderAddress,
  getMergedOrderStatusValue,
  getOrderStatusLabelForUi,
  normalizeForSearch,
  shiftDateByDays,
  statusTabs,
  textCollator,
  toAmount,
  toDateInputValue,
  toDisplayOrderNumber
} from '@/components/admin/adminOrdersTableUtils';

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
  const [isBulkUpdatingStatus, setIsBulkUpdatingStatus] = useState(false);

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
  const statusHeaderMenuRef = useRef<HTMLDivElement>(null);
  const paymentHeaderMenuRef = useRef<HTMLDivElement>(null);

  const [isStatusHeaderMenuOpen, setIsStatusHeaderMenuOpen] = useState(false);
  const [isPaymentHeaderMenuOpen, setIsPaymentHeaderMenuOpen] = useState(false);

  useEffect(() => {
    const closeOnOutsideClick = (mouseEvent: MouseEvent) => {
      if (!datePopoverRef.current) return;
      if (!datePopoverRef.current.contains(mouseEvent.target as Node)) {
        setIsDatePopoverOpen(false);
      }
    };

    if (isDatePopoverOpen) {
      document.addEventListener('mousedown', closeOnOutsideClick);
    }

    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
    };
  }, [isDatePopoverOpen]);


  useEffect(() => {
    if (!isStatusHeaderMenuOpen && !isPaymentHeaderMenuOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!statusHeaderMenuRef.current?.contains(target)) {
        setIsStatusHeaderMenuOpen(false);
      }
      if (!paymentHeaderMenuRef.current?.contains(target)) {
        setIsPaymentHeaderMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsStatusHeaderMenuOpen(false);
        setIsPaymentHeaderMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isPaymentHeaderMenuOpen, isStatusHeaderMenuOpen]);

  const applyQuickDateRange = (range: 'today' | 'yesterday' | '7d' | '30d' | '3m' | '6m' | '1y') => {
    const todayDate = new Date();
    const todayAsInput = toDateInputValue(todayDate);

    if (range === 'today') {
      setFromDate(todayAsInput);
      setToDate(todayAsInput);
      return;
    }

    if (range === 'yesterday') {
      const yesterdayDate = shiftDateByDays(todayDate, -1);
      const yesterdayAsInput = toDateInputValue(yesterdayDate);
      setFromDate(yesterdayAsInput);
      setToDate(yesterdayAsInput);
      return;
    }

    const dayCountByRange: Record<'7d' | '30d' | '3m' | '6m' | '1y', number> = {
      '7d': 6,
      '30d': 29,
      '3m': 89,
      '6m': 179,
      '1y': 364
    };

    const fromDateValue = shiftDateByDays(todayDate, -dayCountByRange[range]);
    setFromDate(toDateInputValue(fromDateValue));
    setToDate(todayAsInput);
  };

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

  const latestDocumentsByOrder = useMemo(() => {
    const byOrderByType = new Map<number, Map<string, UnifiedDocument>>();

    const upsertLatestDocument = (documentItem: UnifiedDocument) => {
      const byType = byOrderByType.get(documentItem.order_id) ?? new Map<string, UnifiedDocument>();
      const existingItem = byType.get(documentItem.type);

      if (!existingItem) {
        byType.set(documentItem.type, documentItem);
      } else {
        const candidateTimestamp = new Date(documentItem.created_at).getTime();
        const existingTimestamp = new Date(existingItem.created_at).getTime();

        if (
          Number.isNaN(existingTimestamp) ||
          (!Number.isNaN(candidateTimestamp) && candidateTimestamp > existingTimestamp)
        ) {
          byType.set(documentItem.type, documentItem);
        }
      }

      byOrderByType.set(documentItem.order_id, byType);
    };

    documents.forEach((documentItem) => {
      upsertLatestDocument({
        order_id: documentItem.order_id,
        type: documentItem.type,
        filename: documentItem.filename,
        blob_url: documentItem.blob_url,
        created_at: documentItem.created_at,
        typeLabel: documentTypeLabelMap.get(documentItem.type) ?? documentItem.type
      });
    });

    attachments.forEach((attachmentItem) => {
      upsertLatestDocument({
        order_id: attachmentItem.order_id,
        type: 'purchase_order',
        filename: attachmentItem.filename,
        blob_url: attachmentItem.blob_url,
        created_at: attachmentItem.created_at,
        typeLabel: documentTypeLabelMap.get('purchase_order') ?? 'Naročilnica'
      });
    });

    const result = new Map<number, UnifiedDocument[]>();
    byOrderByType.forEach((byType, orderId) => {
      result.set(orderId, Array.from(byType.values()));
    });

    return result;
  }, [documents, attachments]);

  const filteredAndSortedOrders = useMemo(() => {
    const normalizedQuery = normalizeForSearch(query);

    const filteredOrders = orders.filter((order) => {
      const mergedStatusValue = getMergedOrderStatusValue(order.status);

      if (statusFilter !== 'all' && mergedStatusValue !== statusFilter) {
        return false;
      }

      const orderTimestamp = new Date(order.created_at).getTime();

      if (fromDate) {
        const fromTimestamp = new Date(`${fromDate}T00:00:00`).getTime();
        if (
          !Number.isNaN(fromTimestamp) &&
          !Number.isNaN(orderTimestamp) &&
          orderTimestamp < fromTimestamp
        ) {
          return false;
        }
      }

      if (toDate) {
        const toTimestamp = new Date(`${toDate}T23:59:59.999`).getTime();
        if (
          !Number.isNaN(toTimestamp) &&
          !Number.isNaN(orderTimestamp) &&
          orderTimestamp > toTimestamp
        ) {
          return false;
        }
      }

      const customerLabel = order.organization_name || order.contact_name || '';
      const addressLabel = formatOrderAddress(order);
      const typeLabel = getCustomerTypeLabel(order.customer_type);
      const statusLabel = getOrderStatusLabelForUi(order.status);
      const paymentLabel = getPaymentLabel(order.payment_status);

      const orderSearchBlob = normalizeForSearch(
        [order.order_number, customerLabel, addressLabel, typeLabel, statusLabel, paymentLabel]
          .filter(Boolean)
          .join(' ')
      );

      const orderMatches = !normalizedQuery || orderSearchBlob.includes(normalizedQuery);

      const latestDocumentsForOrder = latestDocumentsByOrder.get(order.id) ?? [];
      const documentsMatchingSelectedType =
        documentType === 'all'
          ? latestDocumentsForOrder
          : latestDocumentsForOrder.filter((documentItem) => documentItem.type === documentType);

      const documentsSearchBlob = normalizeForSearch(
        documentsMatchingSelectedType
          .map((documentItem) => `${documentItem.typeLabel} ${documentItem.filename}`)
          .join(' ')
      );

      const documentsMatch = !normalizedQuery || documentsSearchBlob.includes(normalizedQuery);

      if (!isDocumentSearchEnabled) {
        return orderMatches;
      }

      if (isDocumentFilterApplied) {
        if (documentsMatchingSelectedType.length === 0) return false;
        if (normalizedQuery && !documentsMatch) return false;
        return true;
      }

      if (!normalizedQuery) return true;
      return orderMatches || documentsMatch;
    });

    const sortedOrders = [...filteredOrders].sort((leftOrder, rightOrder) => {
      const sortMultiplier = sortDirection === 'asc' ? 1 : -1;

      let leftValue: string | number;
      let rightValue: string | number;

      switch (sortKey) {
        case 'order_number':
          leftValue = leftOrder.order_number;
          rightValue = rightOrder.order_number;
          break;
        case 'customer':
          leftValue = leftOrder.organization_name || leftOrder.contact_name || '';
          rightValue = rightOrder.organization_name || rightOrder.contact_name || '';
          break;
        case 'address':
          leftValue = formatOrderAddress(leftOrder);
          rightValue = formatOrderAddress(rightOrder);
          break;
        case 'type':
          leftValue = getCustomerTypeLabel(leftOrder.customer_type);
          rightValue = getCustomerTypeLabel(rightOrder.customer_type);
          break;
        case 'status':
          leftValue = getOrderStatusLabelForUi(leftOrder.status);
          rightValue = getOrderStatusLabelForUi(rightOrder.status);
          break;
        case 'payment':
          leftValue = getPaymentLabel(leftOrder.payment_status);
          rightValue = getPaymentLabel(rightOrder.payment_status);
          break;
        case 'total':
          leftValue = toAmount(leftOrder.total);
          rightValue = toAmount(rightOrder.total);
          break;
        case 'created_at':
        default:
          leftValue = new Date(leftOrder.created_at).getTime();
          rightValue = new Date(rightOrder.created_at).getTime();
          break;
      }

      if (typeof leftValue === 'number' && typeof rightValue === 'number') {
        return (leftValue - rightValue) * sortMultiplier;
      }

      return textCollator.compare(String(leftValue), String(rightValue)) * sortMultiplier;
    });

    return sortedOrders;
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
  const selectedCount = selected.length;
  const isBulkMode = selectedCount > 0;
  const isSingleSelection = selectedCount === 1;

  const [rowStatusOverrides, setRowStatusOverrides] = useState<Record<number, string>>({});
  const [rowPaymentOverrides, setRowPaymentOverrides] = useState<Record<number, string | null>>({});

  useEffect(() => {
    if (selectedCount === 0) {
      setIsStatusHeaderMenuOpen(false);
      setIsPaymentHeaderMenuOpen(false);
    }
  }, [selectedCount]);

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = selectedVisibleCount > 0 && !allSelected;
  }, [allSelected, selectedVisibleCount]);


  useEffect(() => {
    const validIds = new Set(orders.map((order) => order.id));
    setRowStatusOverrides((previousOverrides) =>
      Object.fromEntries(
        Object.entries(previousOverrides).filter(([orderId]) => validIds.has(Number(orderId)))
      )
    );
    setRowPaymentOverrides((previousOverrides) =>
      Object.fromEntries(
        Object.entries(previousOverrides).filter(([orderId]) => validIds.has(Number(orderId)))
      )
    );
  }, [orders]);

  const toggleSelected = (orderId: number) => {
    setSelected((previousSelected) =>
      previousSelected.includes(orderId)
        ? previousSelected.filter((selectedOrderId) => selectedOrderId !== orderId)
        : [...previousSelected, orderId]
    );
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelected((previousSelected) =>
        previousSelected.filter((selectedOrderId) => !visibleOrderIds.includes(selectedOrderId))
      );
      return;
    }

    setSelected((previousSelected) => {
      const mergedSelection = new Set(previousSelected);
      visibleOrderIds.forEach((visibleOrderId) => mergedSelection.add(visibleOrderId));
      return Array.from(mergedSelection);
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


  const handleBulkStatusUpdate = async (nextStatus: string) => {
    if (selected.length === 0) return;

    setIsBulkUpdatingStatus(true);
    try {
      await Promise.all(
        selected.map((orderId) =>
          fetch(`/api/admin/orders/${orderId}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: nextStatus })
          })
        )
      );

      setRowStatusOverrides((previousOverrides) => {
        const nextOverrides = { ...previousOverrides };
        selected.forEach((orderId) => {
          nextOverrides[orderId] = nextStatus;
        });
        return nextOverrides;
      });
      setIsStatusHeaderMenuOpen(false);
    } finally {
      setIsBulkUpdatingStatus(false);
    }
  };

  const handleBulkPaymentUpdate = async (nextPaymentStatus: string) => {
    if (selected.length === 0 || !isPaymentStatus(nextPaymentStatus)) return;

    setIsBulkUpdatingStatus(true);
    try {
      await Promise.all(
        selected.map((orderId) =>
          fetch(`/api/admin/orders/${orderId}/payment-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: nextPaymentStatus, note: '' })
          })
        )
      );

      setRowPaymentOverrides((previousOverrides) => {
        const nextOverrides = { ...previousOverrides };
        selected.forEach((orderId) => {
          nextOverrides[orderId] = nextPaymentStatus;
        });
        return nextOverrides;
      });
      setIsPaymentHeaderMenuOpen(false);
    } finally {
      setIsBulkUpdatingStatus(false);
    }
  };

  const onSort = (nextSortKey: SortKey) => {
    if (sortKey === nextSortKey) {
      setSortDirection((previousDirection) => (previousDirection === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortKey(nextSortKey);
    if (nextSortKey === 'created_at' || nextSortKey === 'total') {
      setSortDirection('desc');
    } else {
      setSortDirection('asc');
    }
  };

  const sortIndicator = (nextSortKey: SortKey) => {
    if (sortKey !== nextSortKey) return <span className="ml-1 text-slate-300">↕</span>;
    return <span className="ml-1 text-slate-500">{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };

  const defaultDateRangeLabel = useMemo(() => {
    if (orders.length === 0) return '📅 —';

    const timestamps = orders
      .map((order) => new Date(order.created_at).getTime())
      .filter((timestamp) => !Number.isNaN(timestamp));

    if (timestamps.length === 0) return '📅 —';

    const minTimestamp = Math.min(...timestamps);
    const maxTimestamp = Math.max(...timestamps);

    return `${formatSlDate(new Date(minTimestamp).toISOString())} – ${formatSlDate(new Date(maxTimestamp).toISOString())}`;
  }, [orders]);

  const dateRangeLabel =
    fromDate || toDate
      ? `${formatSlDateFromDateInput(fromDate)} – ${formatSlDateFromDateInput(toDate)}`
      : defaultDateRangeLabel;

  const handleApplyDocuments = () => {
    if (!isDocumentSearchEnabled) return;
    setIsDocumentFilterApplied(true);
    setMessage('Prikazana so naročila z dokumenti glede na izbrani filter.');
  };

  const handleResetDocumentFilter = () => {
    setIsDocumentFilterApplied(false);
    setMessage(null);
  };

  const downloadFile = async (fileUrl: string, downloadFilename: string) => {
    const response = await fetch(fileUrl);
    if (!response.ok) return false;

    const blob = await response.blob();
    const tempLink = document.createElement('a');
    tempLink.href = URL.createObjectURL(blob);
    tempLink.download = downloadFilename;
    document.body.appendChild(tempLink);
    tempLink.click();
    tempLink.remove();
    URL.revokeObjectURL(tempLink.href);

    return true;
  };

  const handleDownloadAllDocuments = async () => {
    if (!isDocumentSearchEnabled) return;

    setIsDownloading(true);
    setMessage(null);

    try {
      const filesToDownload: Array<{ url: string; filename: string }> = [];

      filteredAndSortedOrders.forEach((order) => {
        const latestDocumentsForOrder = latestDocumentsByOrder.get(order.id) ?? [];
        const documentsBySelectedType =
          documentType === 'all'
            ? latestDocumentsForOrder
            : latestDocumentsForOrder.filter((documentItem) => documentItem.type === documentType);

        documentsBySelectedType.forEach((documentItem) => {
          filesToDownload.push({
            url: documentItem.blob_url,
            filename: `${toDisplayOrderNumber(order.order_number)}-${documentItem.filename}`
          });
        });
      });

      if (filesToDownload.length === 0) {
        setMessage('Ni dokumentov za prenos glede na trenutno izbiro.');
        return;
      }

      for (const fileToDownload of filesToDownload) {
        await downloadFile(fileToDownload.url, fileToDownload.filename);
      }

      setMessage(`Prenesenih dokumentov: ${filesToDownload.length}`);
    } finally {
      setIsDownloading(false);
    }
  };


  const shouldIgnoreRowNavigation = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return false;
    return Boolean(
      target.closest('a,button,input,select,textarea,[role=menu],[role=menuitem],[data-no-row-nav]')
    );
  };

  const openOrderDetails = (orderId: number) => {
    window.location.href = `/admin/orders/${orderId}`;
  };

  return (
    <div className="w-full">
      <div className="mx-auto w-[75vw] min-w-[1180px] max-w-[1520px]">
      <div className="mb-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-end gap-2">
          <div className="relative" ref={datePopoverRef}>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Datum</label>
            <button
              type="button"
              onClick={() => setIsDatePopoverOpen((previousState) => !previousState)}
              className="h-8 min-w-[170px] rounded-lg border border-slate-300 bg-white px-2.5 text-left text-xs text-slate-700 hover:border-slate-400"
            >
              <span className="inline-flex items-center gap-1.5"> 
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-3.5 w-3.5 text-slate-700"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <rect x="3" y="5" width="18" height="16" rx="2" />
                  <path d="M16 3v4M8 3v4M3 10h18" />
                </svg>
                <span>{dateRangeLabel}</span>
              </span>
            </button>

            {isDatePopoverOpen && (
              <div className="absolute left-0 z-20 mt-2 w-[560px] rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
                <div className="grid grid-cols-[180px_1fr] gap-4">
                  <div className="space-y-1 border-r border-slate-200 pr-3">
                    <button
                      type="button"
                      onClick={() => applyQuickDateRange('today')}
                      className="w-full rounded-lg px-2 py-1 text-left text-xs text-slate-700 hover:bg-slate-100"
                    >
                      Danes
                    </button>
                    <button
                      type="button"
                      onClick={() => applyQuickDateRange('yesterday')}
                      className="w-full rounded-lg px-2 py-1 text-left text-xs text-slate-700 hover:bg-slate-100"
                    >
                      Včeraj
                    </button>
                    <button
                      type="button"
                      onClick={() => applyQuickDateRange('7d')}
                      className="w-full rounded-lg px-2 py-1 text-left text-xs text-slate-700 hover:bg-slate-100"
                    >
                      Zadnjih 7 dni
                    </button>
                    <button
                      type="button"
                      onClick={() => applyQuickDateRange('30d')}
                      className="w-full rounded-lg px-2 py-1 text-left text-xs text-slate-700 hover:bg-slate-100"
                    >
                      Zadnjih 30 dni
                    </button>
                    <button
                      type="button"
                      onClick={() => applyQuickDateRange('3m')}
                      className="w-full rounded-lg px-2 py-1 text-left text-xs text-slate-700 hover:bg-slate-100"
                    >
                      Zadnje 3 mesece
                    </button>
                    <button
                      type="button"
                      onClick={() => applyQuickDateRange('6m')}
                      className="w-full rounded-lg px-2 py-1 text-left text-xs text-slate-700 hover:bg-slate-100"
                    >
                      Zadnjih 6 mesecev
                    </button>
                    <button
                      type="button"
                      onClick={() => applyQuickDateRange('1y')}
                      className="w-full rounded-lg px-2 py-1 text-left text-xs text-slate-700 hover:bg-slate-100"
                    >
                      Zadnje leto
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-500">Od</label>
                      <input
                        type="date"
                        value={fromDate}
                        onChange={(event) => setFromDate(event.target.value)}
                        className="mt-1 h-8 w-full rounded-lg border border-slate-300 px-2.5 text-xs"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-500">Do</label>
                      <input
                        type="date"
                        value={toDate}
                        onChange={(event) => setToDate(event.target.value)}
                        className="mt-1 h-8 w-full rounded-lg border border-slate-300 px-2.5 text-xs"
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
                      </button>                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="min-w-[220px] flex-1">
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Iskanje</label>
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ORD, naročnik, naslov, tip, status, plačilo..."
              className="h-8 w-full rounded-lg border border-slate-300 px-2.5 text-xs"
            />
          </div>

          <div>
            <label className="mb-1 block select-none text-xs font-semibold uppercase text-transparent">
              Dokumenti
            </label>
            <div className="flex h-8 items-center gap-2">
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
              <label htmlFor="search-documents" className="text-xs text-slate-700">
                Išči dokumente
              </label>
            </div>
          </div>

          <div className="min-w-[180px]">
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
              Vrsta dokumenta
            </label>
            <select
              value={documentType}
              onChange={(event) => setDocumentType(event.target.value as DocumentType)}
              disabled={!isDocumentSearchEnabled}
              className="h-8 w-full rounded-lg border border-slate-300 px-2.5 text-xs disabled:bg-slate-100 disabled:text-slate-400"
            >
              {documentTypeOptions.map((documentTypeOption) => (
                <option key={documentTypeOption.value} value={documentTypeOption.value}>
                  {documentTypeOption.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleApplyDocuments}
            disabled={!isDocumentSearchEnabled}
            className="h-8 rounded-full bg-brand-600 px-3 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            Naloži dokumente
          </button>

          <button
            type="button"
            onClick={handleDownloadAllDocuments}
            disabled={!isDocumentSearchEnabled || isDownloading}
            className="h-8 rounded-full border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
          >
            {isDownloading ? 'Prenos...' : 'Prenesi vse'}
          </button>

          {isDocumentFilterApplied && (
            <button
              type="button"
              onClick={handleResetDocumentFilter}
              className="h-8 rounded-full px-3 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            >
              Počisti
            </button>
          )}
        </div>

        {message && <p className="mt-2 text-xs text-slate-600">{message}</p>}
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-2">
        {statusTabs.map((tab) => {
          const isActive = statusFilter === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatusFilter(tab.value)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
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


      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[1180px] w-full table-fixed text-left text-[13px]">
          <colgroup>
            <col style={{ width: columnWidths.selectAndDelete }} />
            <col style={{ width: columnWidths.order }} />
            <col style={{ width: columnWidths.date }} />
            <col style={{ width: columnWidths.customer }} />
            <col style={{ width: columnWidths.address }} />
            <col style={{ width: columnWidths.type }} />
            <col style={{ width: columnWidths.status }} />
            <col style={{ width: columnWidths.payment }} />
            <col style={{ width: columnWidths.total }} />
            <col style={{ width: columnWidths.documents }} />
          </colgroup>

          <thead className="bg-slate-50 text-[12px] uppercase text-slate-500">
            <tr>
              <th className="px-2 py-2">
                <div className="flex flex-col items-center gap-1">
                  <input
                    type="checkbox"
                    ref={selectAllRef}
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Izberi vse"
                  />
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={selected.length === 0 || isDeleting}
                    className="text-[10px] font-semibold text-rose-600 disabled:text-slate-300"
                  >
                    {isDeleting ? 'Brisanje...' : 'Izbriši'}
                  </button>
                </div>
              </th>

              <th className="px-2 py-2 text-center">
                <button
                  type="button"
                  onClick={() => onSort('order_number')}
                  className="inline-flex items-center text-xs font-semibold hover:text-slate-700"
                >
                  Naročilo {sortIndicator('order_number')}
                </button>
              </th>

              <th className="px-2 py-2 text-center">
                <button
                  type="button"
                  onClick={() => onSort('created_at')}
                  className="inline-flex items-center text-xs font-semibold hover:text-slate-700"
                >
                  Datum {sortIndicator('created_at')}
                </button>
              </th>

              <th className="px-2 py-2">
                <button
                  type="button"
                  onClick={() => onSort('customer')}
                  className="inline-flex items-center text-xs font-semibold hover:text-slate-700"
                >
                  Naročnik {sortIndicator('customer')}
                </button>
              </th>

              <th className="px-2 py-2">
                <button
                  type="button"
                  onClick={() => onSort('address')}
                  className="inline-flex items-center text-xs font-semibold hover:text-slate-700"
                >
                  Naslov {sortIndicator('address')}
                </button>
              </th>

              <th className="px-2 py-2 text-center">
                <button
                  type="button"
                  onClick={() => onSort('type')}
                  className="inline-flex items-center text-xs font-semibold hover:text-slate-700"
                >
                  Tip {sortIndicator('type')}
                </button>
              </th>

              <th className="px-2 py-2 text-center">
                <div className="relative inline-flex" ref={statusHeaderMenuRef}>
                  {selectedCount > 0 ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsStatusHeaderMenuOpen((previousOpen) => !previousOpen)}
                        disabled={isBulkUpdatingStatus}
                        className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:border-slate-400 disabled:cursor-not-allowed disabled:text-slate-300"
                        aria-haspopup="menu"
                        aria-expanded={isStatusHeaderMenuOpen}
                      >
                        Status ▾ ({selectedCount})
                      </button>

                      {isStatusHeaderMenuOpen && (
                        <div
                          role="menu"
                          className="absolute left-1/2 top-8 z-20 w-44 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
                        >
                          {ORDER_STATUS_OPTIONS.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              role="menuitem"
                              onClick={() => handleBulkStatusUpdate(option.value)}
                              disabled={isBulkUpdatingStatus}
                              className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSort('status')}
                      className="inline-flex items-center text-xs font-semibold hover:text-slate-700"
                    >
                      Status {sortIndicator('status')}
                    </button>
                  )}
                </div>
              </th>

              <th className="px-2 py-2 text-center">
                <div className="relative inline-flex" ref={paymentHeaderMenuRef}>
                  {selectedCount > 0 ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsPaymentHeaderMenuOpen((previousOpen) => !previousOpen)}
                        disabled={isBulkUpdatingStatus}
                        className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:border-slate-400 disabled:cursor-not-allowed disabled:text-slate-300"
                        aria-haspopup="menu"
                        aria-expanded={isPaymentHeaderMenuOpen}
                      >
                        Plačilo ▾ ({selectedCount})
                      </button>

                      {isPaymentHeaderMenuOpen && (
                        <div
                          role="menu"
                          className="absolute left-1/2 top-8 z-20 w-44 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
                        >
                          {PAYMENT_STATUS_OPTIONS.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              role="menuitem"
                              onClick={() => handleBulkPaymentUpdate(option.value)}
                              disabled={isBulkUpdatingStatus}
                              className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSort('payment')}
                      className="inline-flex items-center text-xs font-semibold hover:text-slate-700"
                    >
                      Plačilo {sortIndicator('payment')}
                    </button>
                  )}
                </div>
              </th>

              <th className="px-2 py-2 text-right">
                <button
                  type="button"
                  onClick={() => onSort('total')}
                  className="inline-flex items-center text-xs font-semibold hover:text-slate-700"
                >
                  Skupaj {sortIndicator('total')}
                </button>
              </th>

              <th className="px-2 py-2 text-left normal-case">PDF datoteke</th>
            </tr>
          </thead>

          <tbody>
            {filteredAndSortedOrders.length === 0 ? (
              <tr>
                <td className="px-2 py-6 text-center text-slate-500" colSpan={10}>
                  Ni zadetkov za izbrane filtre.
                </td>
              </tr>
            ) : (
              filteredAndSortedOrders.map((order, orderIndex) => {
                const orderAddress = formatOrderAddress(order);
                const typeLabel = getCustomerTypeLabel(order.customer_type);
                const rowStatus = rowStatusOverrides[order.id] ?? order.status;
                const rowPaymentStatus = rowPaymentOverrides[order.id] ?? order.payment_status ?? null;
                const isRowSelected = selected.includes(order.id);
                const canEditStatus = isSingleSelection && isRowSelected;
                const canEditPayment = isSingleSelection && isRowSelected;

                return (
                  <tr
                    key={order.id}
                    className={`border-t border-slate-100 transition-colors duration-200 ${
                      orderIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                    } hover:bg-[#e7efef]`}
                    onClick={(event) => {
                      if (shouldIgnoreRowNavigation(event.target)) return;
                      openOrderDetails(order.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      if (shouldIgnoreRowNavigation(event.target)) return;
                      event.preventDefault();
                      openOrderDetails(order.id);
                    }}
                    tabIndex={0}
                    aria-label={`Odpri podrobnosti naročila ${toDisplayOrderNumber(order.order_number)}`}
                  >
                    <td className="px-2 py-2 align-middle">
                      <div className="flex justify-center">
                        <input
                          data-no-row-nav
                          type="checkbox"
                          checked={selected.includes(order.id)}
                          onChange={() => toggleSelected(order.id)}
                          aria-label={`Izberi naročilo ${toDisplayOrderNumber(order.order_number)}`}
                        />
                      </div>
                    </td>

                    <td className="px-2 py-2 align-middle text-center font-semibold text-slate-900">
                      <span className="text-[13px] font-semibold text-slate-900">
                        {toDisplayOrderNumber(order.order_number)}
                      </span>
                    </td>

                    <td className="px-2 py-2 align-middle text-center whitespace-nowrap text-slate-600">
                      <span
                        className="inline-block rounded-sm px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                        title={formatSlDateTime(order.created_at)}
                        aria-label={`Datum naročila ${formatSlDateTime(order.created_at)}`}
                        tabIndex={0}
                      >
                        {formatSlDate(order.created_at)}
                      </span>
                    </td>

                    <td className="px-2 py-2 align-middle text-slate-600">
                      <span className="block truncate" title={order.organization_name || order.contact_name}>
                        {order.organization_name || order.contact_name}
                      </span>
                    </td>

                    <td className="px-2 py-2 align-middle text-slate-600">
                      <span className="block truncate" title={orderAddress || '—'}>
                        {orderAddress || '—'}
                      </span>
                    </td>

                    <td className="px-2 py-2 align-middle text-center text-slate-700">{typeLabel}</td>

                    <td className="px-2 py-2 align-middle text-center text-slate-600">
                      {selectedCount > 1 ? (
                        <div className="flex justify-center">
                          <StatusChip status={rowStatus} />
                        </div>
                      ) : (
                        <AdminOrderStatusSelect
                          orderId={order.id}
                          status={rowStatus}
                          canEdit={canEditStatus}
                          disabled={isBulkUpdatingStatus}
                          onStatusSaved={(nextStatus) =>
                            setRowStatusOverrides((previousOverrides) => ({
                              ...previousOverrides,
                              [order.id]: nextStatus
                            }))
                          }
                        />
                      )}
                    </td>

                    <td className="px-2 py-2 align-middle text-center">
                      {selectedCount > 1 ? (
                        <div className="flex justify-center">
                          <PaymentChip status={rowPaymentStatus} />
                        </div>
                      ) : (
                        <AdminOrderPaymentSelect
                          orderId={order.id}
                          status={rowPaymentStatus}
                          canEdit={canEditPayment}
                          disabled={isBulkUpdatingStatus}
                          onStatusSaved={(nextStatus) =>
                            setRowPaymentOverrides((previousOverrides) => ({
                              ...previousOverrides,
                              [order.id]: nextStatus
                            }))
                          }
                        />
                      )}
                    </td>

                    <td className="px-2 py-2 align-middle text-right text-slate-700">
                      {formatCurrency(order.total)}
                    </td>

                    <td className="px-2 py-2 align-middle text-center align-middle pr-4" data-no-row-nav>
                      <AdminOrdersPdfCell
                        orderId={order.id}
                        documents={documentsByOrder.get(order.id) ?? []}
                        attachments={attachmentsByOrder.get(order.id) ?? []}
                        interactionsDisabled={false}
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
