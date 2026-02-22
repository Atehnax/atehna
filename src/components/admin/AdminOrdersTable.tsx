'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import AdminOrderStatusSelect from '@/components/admin/AdminOrderStatusSelect';
import AdminOrdersPdfCell from '@/components/admin/AdminOrdersPdfCell';
import AdminOrderPaymentSelect from '@/components/admin/AdminOrderPaymentSelect';
import AdminOrdersPreviewChart from '@/components/admin/AdminOrdersPreviewChart';
import StatusChip from '@/components/admin/StatusChip';
import PaymentChip from '@/components/admin/PaymentChip';
import { getCustomerTypeLabel } from '@/lib/customerType';
import { ORDER_STATUS_OPTIONS } from '@/lib/orderStatus';
import { formatSlDate, formatSlDateFromDateInput, formatSlDateTime } from '@/lib/format/dateTime';
import { PAYMENT_STATUS_OPTIONS, getPaymentLabel, isPaymentStatus } from '@/lib/paymentStatus';
import type { AnalyticsGlobalAppearance } from '@/lib/server/analyticsCharts';

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
  getNumericOrderNumber,
  normalizeForSearch,
  shiftDateByDays,
  statusTabs,
  textCollator,
  toAmount,
  toDateInputValue,
  toDisplayOrderNumber
} from '@/components/admin/adminOrdersTableUtils';


type OrdersRangePreset = '7d' | '1m' | '3m' | '6m' | '1y' | 'ytd' | 'max' | 'custom';


const bulkDeleteButtonClass =
  'h-8 rounded-xl border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 text-xs font-semibold text-[var(--danger-600)] transition hover:bg-[var(--danger-bg)] focus-visible:border-[var(--danger-border)] focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:border-[var(--danger-border)] disabled:bg-transparent disabled:text-[var(--danger-600)] disabled:opacity-100';

const rowDeleteButtonClass =
  'inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--danger-border)] bg-transparent text-sm font-semibold leading-none text-[var(--danger-600)] transition hover:bg-[var(--danger-bg)] disabled:cursor-not-allowed disabled:opacity-45';

export default function AdminOrdersTable({
  orders,
  documents,
  attachments,
  initialFrom = '',
  initialTo = '',
  initialQuery = '',
  topAction,
  analyticsAppearance
}: {
  orders: OrderRow[];
  documents: PdfDoc[];
  attachments: Attachment[];
  initialFrom?: string;
  initialTo?: string;
  initialQuery?: string;
  topAction?: ReactNode;
  analyticsAppearance?: AnalyticsGlobalAppearance;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<number[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingRowId, setDeletingRowId] = useState<number | null>(null);
  const [isBulkUpdatingStatus, setIsBulkUpdatingStatus] = useState(false);

  const [statusFilter, setStatusFilter] = useState<StatusTab>('all');
  const [query, setQuery] = useState(initialQuery);

  const [sortKey, setSortKey] = useState<SortKey>('order_number');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const [fromDate, setFromDate] = useState(initialFrom);
  const [toDate, setToDate] = useState(initialTo);
  const [rangePreset, setRangePreset] = useState<OrdersRangePreset>('1m');
  const debouncedQuery = useDebouncedValue(query, 200);
  const debouncedFromDate = useDebouncedValue(fromDate, 200);
  const debouncedToDate = useDebouncedValue(toDate, 200);
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);

  const [documentType, setDocumentType] = useState<DocumentType>('all');
  const [message, setMessage] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const selectAllRef = useRef<HTMLInputElement>(null);
  const datePopoverRef = useRef<HTMLDivElement>(null);
  const statusHeaderMenuRef = useRef<HTMLDivElement>(null);
  const paymentHeaderMenuRef = useRef<HTMLDivElement>(null);
  const hasAutoResetFiltersRef = useRef(false);

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

  const latestOrderDate = useMemo(() => {
    const timestamps = orders
      .map((order) => new Date(order.created_at).getTime())
      .filter((value) => Number.isFinite(value));
    if (timestamps.length === 0) {
      const fallback = new Date();
      fallback.setHours(0, 0, 0, 0);
      return fallback;
    }
    const latest = new Date(Math.max(...timestamps));
    latest.setHours(0, 0, 0, 0);
    return latest;
  }, [orders]);

  const earliestOrderDate = useMemo(() => {
    const timestamps = orders
      .map((order) => new Date(order.created_at).getTime())
      .filter((value) => Number.isFinite(value));
    if (timestamps.length === 0) {
      const fallback = new Date(latestOrderDate);
      fallback.setHours(0, 0, 0, 0);
      return fallback;
    }
    const earliest = new Date(Math.min(...timestamps));
    earliest.setHours(0, 0, 0, 0);
    return earliest;
  }, [latestOrderDate, orders]);

  const toSafeDateRange = (from: Date, to: Date) => {
    const start = Number.isFinite(from.getTime()) ? from : new Date(to);
    const end = Number.isFinite(to.getTime()) ? to : new Date(start);
    if (start.getTime() > end.getTime()) {
      return { from: new Date(end), to: new Date(end) };
    }
    return { from: start, to: end };
  };

  const applyDateRange = (from: Date, to: Date, preset: OrdersRangePreset) => {
    const safe = toSafeDateRange(from, to);
    setFromDate(toDateInputValue(safe.from));
    setToDate(toDateInputValue(safe.to));
    setRangePreset(preset);
  };


  const applyAnalyticsRangePreset = (range: Exclude<OrdersRangePreset, 'custom'>) => {
    const anchorDate = new Date(latestOrderDate);

    if (range === 'ytd') {
      const ytdStart = new Date(anchorDate.getFullYear(), 0, 1);
      applyDateRange(ytdStart, anchorDate, 'ytd');
      return;
    }

    if (range === 'max') {
      applyDateRange(earliestOrderDate, anchorDate, 'max');
      return;
    }

    const dayCountByRange: Record<Exclude<OrdersRangePreset, 'custom' | 'ytd' | 'max'>, number> = {
      '7d': 6,
      '1m': 29,
      '3m': 89,
      '6m': 179,
      '1y': 364
    };

    const fromDateValue = shiftDateByDays(anchorDate, -dayCountByRange[range]);
    applyDateRange(fromDateValue, anchorDate, range);
  };

  useEffect(() => {
    if (!initialFrom && !initialTo) {
      applyAnalyticsRangePreset('1m');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyQuickDateRange = (range: 'today' | 'yesterday' | '7d' | '30d' | '3m' | '6m' | '1y') => {
    const anchorDate = new Date(latestOrderDate);

    if (range === 'today') {
      applyDateRange(anchorDate, anchorDate, 'custom');
      return;
    }

    if (range === 'yesterday') {
      const yesterdayDate = shiftDateByDays(anchorDate, -1);
      applyDateRange(yesterdayDate, yesterdayDate, 'custom');
      return;
    }

    const dayCountByRange: Record<'7d' | '30d' | '3m' | '6m' | '1y', number> = {
      '7d': 6,
      '30d': 29,
      '3m': 89,
      '6m': 179,
      '1y': 364
    };

    const fromDateValue = shiftDateByDays(anchorDate, -dayCountByRange[range]);
    applyDateRange(fromDateValue, anchorDate, 'custom');
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
    const normalizedQuery = normalizeForSearch(debouncedQuery);

    const filteredOrders = orders.filter((order) => {
      const mergedStatusValue = getMergedOrderStatusValue(order.status);

      if (statusFilter !== 'all' && mergedStatusValue !== statusFilter) {
        return false;
      }

      const orderTimestamp = new Date(order.created_at).getTime();

      if (debouncedFromDate) {
        const fromTimestamp = new Date(`${debouncedFromDate}T00:00:00`).getTime();
        if (
          !Number.isNaN(fromTimestamp) &&
          !Number.isNaN(orderTimestamp) &&
          orderTimestamp < fromTimestamp
        ) {
          return false;
        }
      }

      if (debouncedToDate) {
        const toTimestamp = new Date(`${debouncedToDate}T23:59:59.999`).getTime();
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

      const hasSelectedDocumentType = documentType !== 'all';

      if (hasSelectedDocumentType) {
        if (documentsMatchingSelectedType.length === 0) return false;
        if (!normalizedQuery) return true;
        return documentsMatch || orderMatches;
      }

      return orderMatches;
    });

    const sortedOrders = [...filteredOrders].sort((leftOrder, rightOrder) => {
      const sortMultiplier = sortDirection === 'asc' ? 1 : -1;
      const leftOrderNumberNumeric = getNumericOrderNumber(leftOrder.order_number);
      const rightOrderNumberNumeric = getNumericOrderNumber(rightOrder.order_number);

      let leftValue: string | number;
      let rightValue: string | number;

      switch (sortKey) {
        case 'order_number':
          if (
            Number.isFinite(leftOrderNumberNumeric) &&
            Number.isFinite(rightOrderNumberNumeric) &&
            leftOrderNumberNumeric !== rightOrderNumberNumeric
          ) {
            return (leftOrderNumberNumeric - rightOrderNumberNumeric) * sortMultiplier;
          }

          if (leftOrderNumberNumeric !== rightOrderNumberNumeric) {
            if (!Number.isFinite(leftOrderNumberNumeric)) return 1;
            if (!Number.isFinite(rightOrderNumberNumeric)) return -1;
          }

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
        default: {
          const leftDate = new Date(leftOrder.created_at);
          const rightDate = new Date(rightOrder.created_at);
          leftDate.setHours(0, 0, 0, 0);
          rightDate.setHours(0, 0, 0, 0);
          leftValue = leftDate.getTime();
          rightValue = rightDate.getTime();
          break;
        }
      }

      if (typeof leftValue === 'number' && typeof rightValue === 'number') {
        const primaryResult = (leftValue - rightValue) * sortMultiplier;
        if (primaryResult !== 0) return primaryResult;

        if (sortKey === 'created_at') {
          return rightOrderNumberNumeric - leftOrderNumberNumeric;
        }

        return 0;
      }

      const textResult = textCollator.compare(String(leftValue), String(rightValue)) * sortMultiplier;
      if (textResult !== 0) return textResult;

      if (sortKey === 'created_at') {
        return rightOrderNumberNumeric - leftOrderNumberNumeric;
      }

      return leftOrder.id - rightOrder.id;
    });

    return sortedOrders;
  }, [
    orders,
    statusFilter,
    debouncedQuery,
    debouncedFromDate,
    debouncedToDate,
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
    setSelected((previousSelected) =>
      previousSelected.filter((selectedOrderId) => validIds.has(selectedOrderId))
    );
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
      const deleteResults = await Promise.allSettled(
        selected.map((orderId) => fetch(`/api/admin/orders/${orderId}`, { method: 'DELETE' }))
      );

      const failedDeletes = deleteResults.filter(
        (result) => result.status === 'fulfilled' && !result.value.ok
      ).length;

      if (failedDeletes > 0) {
        setMessage(`Brisanje ni uspelo za ${failedDeletes} naročil.`);
      }

      router.refresh();
    } finally {
      setIsDeleting(false);
    }
  };


  const handleDeleteRow = async (orderId: number) => {
    const confirmed = window.confirm('Ali ste prepričani, da želite izbrisati to naročilo?');
    if (!confirmed) return;

    setDeletingRowId(orderId);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, { method: 'DELETE' });
      if (!response.ok) {
        setMessage('Brisanje naročila ni uspelo. Poskusite znova.');
        return;
      }

      router.refresh();
    } finally {
      setDeletingRowId(null);
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
    const isSameKey = sortKey === nextSortKey;

    if (isSameKey) {
      setSortDirection((previousDirection) => (previousDirection === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortKey(nextSortKey);
    if (nextSortKey === 'order_number' || nextSortKey === 'created_at' || nextSortKey === 'total') {
      setSortDirection('desc');
      return;
    }

    setSortDirection('asc');
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



  const resetAllFilters = () => {
    setStatusFilter('all');
    setQuery('');
    setFromDate('');
    setToDate('');
    setDocumentType('all');
    setMessage(null);
  };

  const hasActiveFilters =
    statusFilter !== 'all' ||
    query.trim().length > 0 ||
    fromDate.length > 0 ||
    toDate.length > 0 ||
    documentType !== 'all';

  useEffect(() => {
    if (hasAutoResetFiltersRef.current) return;
    if (orders.length === 0) return;
    if (!hasActiveFilters) return;
    if (filteredAndSortedOrders.length > 0) return;

    hasAutoResetFiltersRef.current = true;
    resetAllFilters();
  }, [orders.length, hasActiveFilters, filteredAndSortedOrders.length]);

  const handleResetDocumentFilter = () => {
    setDocumentType('all');
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
    setIsDownloading(true);
    setMessage(null);

    try {
      const filesToDownload: Array<{ url: string; filename: string }> = [];

      const downloadSourceOrders = selected.length > 0
        ? filteredAndSortedOrders.filter((order) => selected.includes(order.id))
        : filteredAndSortedOrders;

      downloadSourceOrders.forEach((order) => {
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

  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-[1600px]">
      <AdminOrdersPreviewChart
        orders={orders}
        appearance={analyticsAppearance}
        fromDate={debouncedFromDate}
        toDate={debouncedToDate}
        activeRange={rangePreset}
        onRangeChange={applyAnalyticsRangePreset}
      />
      <div className="overflow-hidden rounded-2xl border shadow-sm" style={{ background: 'linear-gradient(180deg, rgba(250,251,252,0.96) 0%, rgba(242,244,247,0.96) 100%)', borderColor: analyticsAppearance?.gridColor ?? '#e2e8f0', boxShadow: '0 10px 24px rgba(15,23,42,0.06)' }}>
        <div className="p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="relative min-w-[170px]" ref={datePopoverRef}>
            <button
              type="button"
              onClick={() => setIsDatePopoverOpen((previousState) => !previousState)}
              className="h-8 min-w-[175px] rounded-xl border border-slate-300 bg-white px-3 py-0 text-left text-xs text-slate-700 hover:border-slate-400 focus:border-[#5d3ed6] focus:ring-0 focus:ring-[#5d3ed6]"
            >
              <span className="inline-flex h-full w-full items-center gap-1.5 leading-none"> 
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-3.5 w-3.5 text-slate-600"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <rect x="3" y="5" width="18" height="16" rx="2" />
                  <path d="M16 3v4M8 3v4M3 10h18" />
                </svg>
                <span className="truncate">{dateRangeLabel}</span>
              </span>
            </button>

            {isDatePopoverOpen && (
              <div lang="sl-SI" className="absolute left-0 z-20 mt-2 w-[420px] rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
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
                        lang="sl-SI"
                        value={fromDate}
                        onChange={(event) => { setFromDate(event.target.value); setRangePreset('custom'); }}
                        className="mt-1 h-8 w-full rounded-lg border border-slate-300 px-2.5 text-xs outline-none focus:border-[#5d3ed6] focus:ring-0 focus:ring-[#5d3ed6]"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-500">Do</label>
                      <input
                        type="date"
                        lang="sl-SI"
                        value={toDate}
                        onChange={(event) => { setToDate(event.target.value); setRangePreset('custom'); }}
                        className="mt-1 h-8 w-full rounded-lg border border-slate-300 px-2.5 text-xs outline-none focus:border-[#5d3ed6] focus:ring-0 focus:ring-[#5d3ed6]"
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
                        Ponastavi
                      </button>                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="min-w-[220px] flex-1">
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Poišči naročilo, naročnika, naslov, tip, status, plačilo..."
              className="h-8 w-full rounded-xl border border-slate-300 px-3 text-xs focus:border-[#5d3ed6] focus:ring-0 focus:ring-[#5d3ed6]"
            />
          </div>

          <div className="ml-auto inline-flex h-8 items-center overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm focus-within:border-[#5d3ed6]">
            <div className="relative">
              <select
                value={documentType}
                onChange={(event) => {
                  setDocumentType(event.target.value as DocumentType);
                  setMessage(null);
                }}
                className="h-8 min-w-[180px] appearance-none border-0 bg-transparent px-3 pr-7 text-xs font-semibold text-slate-700 outline-none focus:border-[#5d3ed6] focus:ring-0 focus-visible:border-[#5d3ed6] focus-visible:ring-0"
              >
                {documentTypeOptions.map((documentTypeOption) => (
                  <option key={documentTypeOption.value} value={documentTypeOption.value}>
                    {documentTypeOption.label}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-500">▾</span>
            </div>
            <button
              type="button"
              onClick={handleResetDocumentFilter}
              disabled={documentType === 'all'}
              className="h-8 border-l border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-[#ede8ff] focus-visible:border-[#5d3ed6] focus-visible:outline-none focus-visible:ring-0 disabled:pointer-events-none disabled:opacity-45"
            >
              Ponastavi
            </button>
            <button
              type="button"
              onClick={handleDownloadAllDocuments}
              disabled={isDownloading}
              className="h-8 border-l border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-[#ede8ff] focus-visible:border-[#5d3ed6] focus-visible:outline-none focus-visible:ring-0 disabled:pointer-events-none disabled:opacity-45"
            >
              {isDownloading ? 'Prenos...' : selected.length > 0 ? `Prenesi (${selected.length})` : 'Prenesi vse'}
            </button>
          </div>

          <button
            type="button"
            onClick={handleDelete}
            disabled={selected.length === 0 || isDeleting}
            className={bulkDeleteButtonClass}
          >
            {isDeleting ? 'Brisanje...' : 'Izbriši'}
          </button>

          {topAction ? <div className="flex h-8 items-center">{topAction}</div> : null}
        </div>

        {message && <p className="mt-2 text-xs text-slate-600">{message}</p>}
        </div>

      <div className="flex flex-wrap items-center gap-2 bg-[linear-gradient(180deg,rgba(250,251,252,0.96)_0%,rgba(242,244,247,0.96)_100%)] px-3 py-2">
        <div className="inline-flex h-8 items-center gap-1 rounded-full border border-slate-300 bg-white px-1">
          {statusTabs.map((tab) => {
            const isActive = statusFilter === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setStatusFilter(tab.value)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition focus-visible:border focus-visible:border-[#5d3ed6] focus-visible:outline-none focus-visible:ring-0 ${isActive ? 'border border-[#5d3ed6] bg-[#f8f7fc] text-[#5d3ed6]' : 'text-slate-700 hover:bg-slate-100'}`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>


      <div className="overflow-x-auto" style={{ background: 'linear-gradient(180deg, rgba(250,251,252,0.96) 0%, rgba(242,244,247,0.96) 100%)' }}>
        <table className="min-w-[1180px] w-full table-auto text-left text-[13px]">
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
            <col style={{ width: columnWidths.edit }} />
          </colgroup>

          <thead className="text-[12px] uppercase text-slate-600">
            <tr>
              <th className="h-11 px-2 py-2 text-center">
                <input
                  type="checkbox"
                  ref={selectAllRef}
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Izberi vse"
                />
              </th>

              <th className="h-11 px-2 py-2 text-center">
                <button
                  type="button"
                  onClick={() => onSort('order_number')}
                  className="inline-flex items-center text-xs font-semibold hover:text-slate-700"
                >
                  Naročilo {sortIndicator('order_number')}
                </button>
              </th>

              <th className="h-11 px-2 py-2 text-center">
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

              <th className="h-11 px-2 py-2 text-center">
                <button
                  type="button"
                  onClick={() => onSort('type')}
                  className="inline-flex items-center text-xs font-semibold hover:text-slate-700"
                >
                  Tip {sortIndicator('type')}
                </button>
              </th>

              <th className="h-11 px-2 py-2 text-center">
                <div className="relative inline-flex" ref={statusHeaderMenuRef}>
                  {selectedCount > 0 ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsStatusHeaderMenuOpen((previousOpen) => !previousOpen)}
                        disabled={isBulkUpdatingStatus}
                        className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 hover:border-slate-400 disabled:cursor-not-allowed disabled:text-slate-300"
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
                              className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
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

              <th className="h-11 px-2 py-2 text-center">
                <div className="relative inline-flex" ref={paymentHeaderMenuRef}>
                  {selectedCount > 0 ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsPaymentHeaderMenuOpen((previousOpen) => !previousOpen)}
                        disabled={isBulkUpdatingStatus}
                        className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 hover:border-slate-400 disabled:cursor-not-allowed disabled:text-slate-300"
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
                              className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
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

              <th className="h-11 px-2 py-2 text-center">
                <button
                  type="button"
                  onClick={() => onSort('total')}
                  className="inline-flex items-center text-xs font-semibold hover:text-slate-700"
                >
                  Skupaj {sortIndicator('total')}
                </button>
              </th>

              <th className="min-w-[100px] px-2 py-2 text-center normal-case">PDF datoteke</th>
              <th className="px-2 py-2 text-center normal-case">Uredi</th>
            </tr>
          </thead>

          <tbody>
            {filteredAndSortedOrders.length === 0 ? (
              <tr>
                <td className="px-2 py-6 text-center text-slate-500" colSpan={10}>
                  <div className="flex flex-col items-center gap-2">
                    <span>Ni zadetkov za izbrane filtre.</span>
                    {orders.length > 0 ? (
                      <button
                        type="button"
                        onClick={resetAllFilters}
                        className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        Prikaži vsa naročila
                      </button>
                    ) : null}
                  </div>
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
                      isRowSelected ? 'bg-[#f8f7fc]' : orderIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                    } hover:bg-[#f8f7fc]`}
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

                    <td className="px-2 py-2 align-middle text-center font-semibold text-slate-900" data-no-row-nav>
                      <a
                        href={`/admin/orders/${order.id}`}
                        className="inline-flex rounded-sm px-1 text-[13px] font-semibold text-brand-700 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-[#5d3ed6]"
                        aria-label={`Odpri naročilo ${toDisplayOrderNumber(order.order_number)}`}
                      >
                        {toDisplayOrderNumber(order.order_number)}
                      </a>
                    </td>

                    <td className="px-2 py-2 align-middle text-center whitespace-nowrap text-slate-700">
                      <span
                        className="inline-block rounded-sm px-1 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-[#5d3ed6]"
                        title={formatSlDateTime(order.created_at)}
                        aria-label={`Datum naročila ${formatSlDateTime(order.created_at)}`}
                        tabIndex={0}
                      >
                        {formatSlDate(order.created_at)}
                      </span>
                    </td>

                    <td className="px-2 py-2 align-middle text-slate-700">
                      <span className="block truncate" title={order.organization_name || order.contact_name}>
                        {order.organization_name || order.contact_name}
                      </span>
                    </td>

                    <td className="px-2 py-2 align-middle text-slate-700">
                      <span className="block truncate" title={orderAddress || '—'}>
                        {orderAddress || '—'}
                      </span>
                    </td>

                    <td className="px-2 py-2 align-middle text-center text-slate-700">{typeLabel}</td>

                    <td className="px-2 py-2 align-middle text-center text-slate-700">
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

                    <td className="px-2 py-2 align-middle text-center text-slate-700">
                      {formatCurrency(order.total)}
                    </td>

                    <td className="min-w-[100px] pl-0 pr-0 py-2 align-middle text-center" data-no-row-nav>
                      <div className="flex justify-center">
                        <AdminOrdersPdfCell
                          orderId={order.id}
                          documents={documentsByOrder.get(order.id) ?? []}
                          attachments={attachmentsByOrder.get(order.id) ?? []}
                          interactionsDisabled={false}
                        />
                      </div>
                    </td>

                    <td className="pl-0 pr-0 py-2 align-middle text-center" data-no-row-nav>
                      <div className="flex items-center justify-center gap-1">
                        <a
                          href={`/admin/orders/${order.id}`}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-100"
                          aria-label={`Uredi naročilo ${toDisplayOrderNumber(order.order_number)}`}
                          title="Uredi"
                        >
                          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                            <path d="M4 14.5l.5-3L13.5 2.5l3 3L7.5 14.5z" />
                            <path d="M11.5 4.5l3 3" />
                          </svg>
                        </a>
                        <button
                          type="button"
                          onClick={() => void handleDeleteRow(order.id)}
                          disabled={deletingRowId === order.id}
                          className={rowDeleteButtonClass}
                          aria-label={`Izbriši naročilo ${toDisplayOrderNumber(order.order_number)}`}
                          title="Izbriši"
                        >
                          {deletingRowId === order.id ? '…' : '×'}
                        </button>
                      </div>
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
    </div>
  );
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timeoutId);
  }, [value, delayMs]);

  return debounced;
}
