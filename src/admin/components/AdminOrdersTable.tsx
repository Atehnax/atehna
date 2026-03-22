'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/shared/ui/button';
import { ButtonGroup } from '@/shared/ui/button-group';
import { IconButton } from '@/shared/ui/icon-button';
import AdminOrderStatusSelect from '@/admin/components/AdminOrderStatusSelect';
import { MenuItem, MenuPanel } from '@/shared/ui/menu';
import { SegmentedControl } from '@/shared/ui/segmented';
import { CustomSelect } from '@/shared/ui/select';
import { Spinner } from '@/shared/ui/loading';
import { Pagination, PageSizeSelect, useTablePagination } from '@/shared/ui/pagination';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { useToast } from '@/shared/ui/toast';
import { EmptyState, RowActions, Table, TBody, TD, THead, TH, TR } from '@/shared/ui/table';
import { ADMIN_CONTROL_HEIGHT, ADMIN_CONTROL_PADDING_X } from '@/shared/ui/admin-controls/controlSizes';
import {
  adminTableRowToneClasses,
  buttonTokenClasses,
  dateInputTokenClasses,
  getAdminStripedRowToneClass
} from '@/shared/ui/theme/tokens';
import { AdminTableLayout } from '@/shared/ui/admin-table';
import AdminOrdersPdfCell from '@/admin/components/AdminOrdersPdfCell';
import AdminOrderPaymentSelect from '@/admin/components/AdminOrderPaymentSelect';
import AdminOrdersPreviewChart from '@/admin/components/AdminOrdersPreviewChart';
import StatusChip from '@/admin/components/StatusChip';
import PaymentChip from '@/admin/components/PaymentChip';
import { getCustomerTypeLabel } from '@/shared/domain/order/customerType';
import { ORDER_STATUS_OPTIONS } from '@/shared/domain/order/orderStatus';
import { formatSlDate, formatSlDateFromDateInput, formatSlDateTime } from '@/shared/domain/order/dateTime';
import { PAYMENT_STATUS_OPTIONS, getPaymentLabel, isPaymentStatus } from '@/shared/domain/order/paymentStatus';
import type { AnalyticsGlobalAppearance } from '@/shared/server/analyticsCharts';

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
} from '@/admin/components/adminOrdersTableUtils';

type OrdersRangePreset = '7d' | '1m' | '3m' | '6m' | '1y' | 'ytd' | 'max' | 'custom';

const bulkDeleteButtonClass = buttonTokenClasses.danger;
const PAGE_SIZE_OPTIONS = [50, 100];

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
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [confirmDeleteRowId, setConfirmDeleteRowId] = useState<number | null>(null);
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
  const { toast } = useToast();
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
        if (!Number.isNaN(fromTimestamp) && !Number.isNaN(orderTimestamp) && orderTimestamp < fromTimestamp) {
          return false;
        }
      }

      if (debouncedToDate) {
        const toTimestamp = new Date(`${debouncedToDate}T23:59:59.999`).getTime();
        if (!Number.isNaN(toTimestamp) && !Number.isNaN(orderTimestamp) && orderTimestamp > toTimestamp) {
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

  const { page, pageSize, pageCount, setPage, setPageSize } = useTablePagination({
    totalCount: filteredAndSortedOrders.length,
    storageKey: 'adminOrders.pageSize',
    defaultPageSize: 50,
    pageSizeOptions: PAGE_SIZE_OPTIONS
  });

  const pagedOrders = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return filteredAndSortedOrders.slice(startIndex, startIndex + pageSize);
  }, [filteredAndSortedOrders, page, pageSize]);

  const visibleOrderIds = useMemo(() => pagedOrders.map((order) => order.id), [pagedOrders]);

  const selectedVisibleCount = useMemo(
    () => visibleOrderIds.filter((orderId) => selected.includes(orderId)).length,
    [visibleOrderIds, selected]
  );

  const allSelected = visibleOrderIds.length > 0 && selectedVisibleCount === visibleOrderIds.length;
  const selectedCount = selected.length;
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
    setSelected((previousSelected) => previousSelected.filter((selectedOrderId) => validIds.has(selectedOrderId)));
    setRowStatusOverrides((previousOverrides) =>
      Object.fromEntries(Object.entries(previousOverrides).filter(([orderId]) => validIds.has(Number(orderId))))
    );
    setRowPaymentOverrides((previousOverrides) =>
      Object.fromEntries(Object.entries(previousOverrides).filter(([orderId]) => validIds.has(Number(orderId))))
    );
  }, [orders]);

  useEffect(() => {
    setPage(1);
  }, [debouncedFromDate, debouncedQuery, debouncedToDate, documentType, setPage, sortDirection, sortKey, statusFilter]);

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

  const handleDelete = () => {
    if (selected.length === 0) return;
    setIsBulkDeleteDialogOpen(true);
  };

  const confirmDeleteSelected = async () => {
    setIsBulkDeleteDialogOpen(false);
    setIsDeleting(true);
    try {
      const deleteResults = await Promise.allSettled(
        selected.map((orderId) => fetch(`/api/admin/orders/${orderId}`, { method: 'DELETE' }))
      );

      const failedDeletes = deleteResults.filter((result) => result.status === 'fulfilled' && !result.value.ok).length;

      if (failedDeletes > 0) {
        toast.error(`Brisanje ni uspelo za ${failedDeletes} naročil.`);
      }

      toast.success('Izbrisano');
      router.refresh();
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteRow = (orderId: number) => {
    setConfirmDeleteRowId(orderId);
  };

  const confirmDeleteRow = async () => {
    if (confirmDeleteRowId === null) return;

    const orderId = confirmDeleteRowId;
    setConfirmDeleteRowId(null);
    setDeletingRowId(orderId);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, { method: 'DELETE' });
      if (!response.ok) {
        toast.error('Brisanje naročila ni uspelo. Poskusite znova.');
        return;
      }

      toast.success('Izbrisano');
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
      toast.success('Shranjeno');
    } catch (error) {
      console.error(error);
      toast.error('Napaka pri shranjevanju');
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
      toast.success('Shranjeno');
    } catch (error) {
      console.error(error);
      toast.error('Napaka pri shranjevanju');
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

    try {
      const filesToDownload: Array<{ url: string; filename: string }> = [];

      const downloadSourceOrders =
        selected.length > 0
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
        toast.info('Ni dokumentov za prenos glede na trenutno izbiro.');
        return;
      }

      for (const fileToDownload of filesToDownload) {
        await downloadFile(fileToDownload.url, fileToDownload.filename);
      }

      toast.success(`Prenesenih dokumentov: ${filesToDownload.length}`);
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

        <ConfirmDialog
          open={isBulkDeleteDialogOpen}
          title="Izbris naročil"
          description={`Ali ste prepričani, da želite izbrisati ${selected.length} naročil?`}
          confirmLabel="Izbriši"
          cancelLabel="Prekliči"
          isDanger
          onCancel={() => setIsBulkDeleteDialogOpen(false)}
          onConfirm={() => {
            void confirmDeleteSelected();
          }}
          confirmDisabled={isDeleting}
        />

        <ConfirmDialog
          open={confirmDeleteRowId !== null}
          title="Izbris naročila"
          description="Ali ste prepričani, da želite izbrisati to naročilo?"
          confirmLabel="Izbriši"
          cancelLabel="Prekliči"
          isDanger
          onCancel={() => setConfirmDeleteRowId(null)}
          onConfirm={() => {
            void confirmDeleteRow();
          }}
          confirmDisabled={deletingRowId !== null}
        />

        <AdminTableLayout
          className="border"
          style={{
            background: 'linear-gradient(180deg, rgba(250,251,252,0.96) 0%, rgba(242,244,247,0.96) 100%)',
            borderColor: analyticsAppearance?.gridColor ?? '#e2e8f0',
            boxShadow: '0 10px 24px rgba(15,23,42,0.06)'
          }}
          contentClassName="overflow-x-auto"
          headerLeft={
            <>
              <div className="relative min-w-[170px]" ref={datePopoverRef}>
                <button
                  type="button"
                  onClick={() => setIsDatePopoverOpen((previousState) => !previousState)}
                  className={`${ADMIN_CONTROL_HEIGHT} min-w-[175px] rounded-xl border border-slate-300 bg-transparent ${ADMIN_CONTROL_PADDING_X} py-0 text-left text-xs font-medium text-slate-700 hover:bg-[color:var(--hover-neutral)] focus:bg-[color:var(--hover-neutral)] focus:ring-1 focus:ring-inset focus:ring-blue-500 focus:outline-none`}
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
                  <div
                    lang="sl-SI"
                    className="absolute left-0 z-20 mt-2 w-[420px] rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
                  >
                    <div className="grid grid-cols-[180px_1fr] gap-4">
                      <div className="space-y-1 border-r border-slate-200 pr-3">
                        {[
                          { key: 'today', label: 'Danes' },
                          { key: 'yesterday', label: 'Včeraj' },
                          { key: '7d', label: 'Zadnjih 7 dni' },
                          { key: '30d', label: 'Zadnjih 30 dni' },
                          { key: '3m', label: 'Zadnje 3 mesece' },
                          { key: '6m', label: 'Zadnjih 6 mesecev' },
                          { key: '1y', label: 'Zadnje leto' }
                        ].map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => applyQuickDateRange(item.key as any)}
                            className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-left text-xs font-medium text-slate-700 hover:bg-[color:var(--hover-neutral)] focus:bg-[color:var(--hover-neutral)] focus:outline-none"
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-semibold uppercase text-slate-500">Od</label>
                          <input
                            type="date"
                            lang="sl-SI"
                            value={fromDate}
                            onChange={(event) => {
                              setFromDate(event.target.value);
                              setRangePreset('custom');
                            }}
                            className={`mt-1 ${dateInputTokenClasses.base} ${dateInputTokenClasses.compact}`}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold uppercase text-slate-500">Do</label>
                          <input
                            type="date"
                            lang="sl-SI"
                            value={toDate}
                            onChange={(event) => {
                              setToDate(event.target.value);
                              setRangePreset('custom');
                            }}
                            className={`mt-1 ${dateInputTokenClasses.base} ${dateInputTokenClasses.compact}`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Poišči po številki, naročniku, naslovu, opombi ..."
                className={`${ADMIN_CONTROL_HEIGHT} min-w-[260px] flex-1 rounded-xl border border-slate-300 ${ADMIN_CONTROL_PADDING_X} text-xs text-slate-700 outline-none focus:border-[#3e67d6] focus:ring-0 focus:ring-[#3e67d6]`}
              />

              <ButtonGroup
                className={`${ADMIN_CONTROL_HEIGHT} w-fit rounded-xl border border-slate-300 overflow-hidden bg-white divide-x divide-slate-300`}
              >
                <CustomSelect
                  value={documentType}
                  onChange={(next) => setDocumentType(next as DocumentType)}
                  options={documentTypeOptions}
                  triggerClassName={`relative h-full min-w-[140px] bg-transparent border-0 ${ADMIN_CONTROL_PADDING_X} py-0 text-sm font-medium flex items-center justify-between !rounded-l-xl !rounded-r-none shadow-none hover:!bg-[color:var(--hover-neutral)] focus:bg-[color:var(--hover-neutral)] focus:ring-1 focus:ring-inset focus:ring-blue-500 focus:outline-none focus:z-10`}
                />

                <Button
                  type="button"
                  variant="default"
                  onClick={handleResetDocumentFilter}
                  disabled={documentType === 'all'}
                  className={`relative ${ADMIN_CONTROL_PADDING_X} h-full rounded-none border-0 bg-transparent text-sm font-medium shadow-none hover:bg-[color:var(--hover-neutral)] focus:bg-[color:var(--hover-neutral)] focus:ring-1 focus:ring-inset focus:ring-blue-500 focus:outline-none focus:z-10`}
                >
                  Ponastavi
                </Button>

                <Button
                  type="button"
                  variant="default"
                  onClick={handleDownloadAllDocuments}
                  disabled={isDownloading}
                  className="relative h-full w-[80px] inline-flex items-center justify-center rounded-none border-0 bg-transparent px-2 whitespace-nowrap text-sm font-medium tabular-nums shadow-none hover:bg-[color:var(--hover-neutral)] focus:bg-[color:var(--hover-neutral)] focus:ring-1 focus:ring-inset focus:ring-blue-500 focus:outline-none focus:z-10"
                >
                  {isDownloading ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Spinner size="sm" className="text-slate-500" />
                      Prenos...
                    </span>
                  ) : selected.length > 0 ? (
                    `Prenesi (${selected.length})`
                  ) : (
                    'Prenesi vse'
                  )}
                </Button>
              </ButtonGroup>
            </>
          }
          headerRight={
            <>
              <button
                type="button"
                onClick={handleDelete}
                disabled={selected.length === 0 || isDeleting}
                className={bulkDeleteButtonClass}
              >
                {isDeleting ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Spinner size="sm" className="text-[var(--danger-600)]" />
                    Brisanje...
                  </span>
                ) : (
                  'Izbriši'
                )}
              </button>

              {topAction ? <div className="flex h-8 items-center">{topAction}</div> : null}
            </>
          }
          filterRowLeft={
            <SegmentedControl
              size="sm"
              value={statusFilter}
              onChange={(next) => setStatusFilter(next as typeof statusFilter)}
              options={statusTabs.map((tab) => ({ value: tab.value, label: tab.label }))}
            />
          }
          filterRowRight={
            <>
              <PageSizeSelect value={pageSize} options={PAGE_SIZE_OPTIONS} onChange={setPageSize} />
              <Pagination page={page} pageCount={pageCount} onPageChange={setPage} variant="topPills" size="sm" showNumbers={false} />
            </>
          }
          footerRight={<Pagination page={page} pageCount={pageCount} onPageChange={setPage} variant="bottomBar" size="sm" showNumbers={false} />}
        >
          <Table className="min-w-[1180px] w-full">
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

            <THead>
              <TR>
                <TH className="h-11 text-center">
                  <input
                    type="checkbox"
                    ref={selectAllRef}
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Izberi vse"
                  />
                </TH>

                <TH className="h-11 text-center">
                  <button
                    type="button"
                    onClick={() => onSort('order_number')}
                    className="inline-flex items-center text-xs font-semibold hover:text-slate-700"
                  >
                    Naročilo {sortIndicator('order_number')}
                  </button>
                </TH>

                <TH className="h-11 text-center">
                  <button
                    type="button"
                    onClick={() => onSort('created_at')}
                    className="inline-flex items-center text-xs font-semibold hover:text-slate-700"
                  >
                    Datum {sortIndicator('created_at')}
                  </button>
                </TH>

                <TH>
                  <button
                    type="button"
                    onClick={() => onSort('customer')}
                    className="inline-flex items-center text-xs font-semibold hover:text-slate-700"
                  >
                    Naročnik {sortIndicator('customer')}
                  </button>
                </TH>

                <TH>
                  <button
                    type="button"
                    onClick={() => onSort('address')}
                    className="inline-flex items-center text-xs font-semibold hover:text-slate-700"
                  >
                    Naslov {sortIndicator('address')}
                  </button>
                </TH>

                <TH className="h-11 text-center">
                  <button
                    type="button"
                    onClick={() => onSort('type')}
                    className="inline-flex items-center text-xs font-semibold hover:text-slate-700"
                  >
                    Tip {sortIndicator('type')}
                  </button>
                </TH>

                <TH className="h-11 text-center">
                  <div className="relative inline-flex" ref={statusHeaderMenuRef}>
                    {selectedCount > 0 ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setIsStatusHeaderMenuOpen((previousOpen) => !previousOpen)}
                          disabled={isBulkUpdatingStatus}
                          className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 hover:bg-[color:var(--hover-neutral)] disabled:cursor-default disabled:text-slate-300"
                          aria-haspopup="menu"
                          aria-expanded={isStatusHeaderMenuOpen}
                        >
                          Status ▾ ({selectedCount})
                        </button>

                        {isStatusHeaderMenuOpen && (
                          <div role="menu">
                            <MenuPanel className="absolute left-1/2 top-8 z-20 w-44 -translate-x-1/2">
                              {ORDER_STATUS_OPTIONS.map((option) => (
                                <MenuItem
                                  key={option.value}
                                  onClick={() => handleBulkStatusUpdate(option.value)}
                                  disabled={isBulkUpdatingStatus}
                                >
                                  {option.label}
                                </MenuItem>
                              ))}
                            </MenuPanel>
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
                </TH>

                <TH className="h-11 text-center">
                  <div className="relative inline-flex" ref={paymentHeaderMenuRef}>
                    {selectedCount > 0 ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setIsPaymentHeaderMenuOpen((previousOpen) => !previousOpen)}
                          disabled={isBulkUpdatingStatus}
                          className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 hover:bg-[color:var(--hover-neutral)] disabled:cursor-default disabled:text-slate-300"
                          aria-haspopup="menu"
                          aria-expanded={isPaymentHeaderMenuOpen}
                        >
                          Plačilo ▾ ({selectedCount})
                        </button>

                        {isPaymentHeaderMenuOpen && (
                          <div role="menu">
                            <MenuPanel className="absolute left-1/2 top-8 z-20 w-44 -translate-x-1/2">
                              {PAYMENT_STATUS_OPTIONS.map((option) => (
                                <MenuItem
                                  key={option.value}
                                  onClick={() => handleBulkPaymentUpdate(option.value)}
                                  disabled={isBulkUpdatingStatus}
                                >
                                  {option.label}
                                </MenuItem>
                              ))}
                            </MenuPanel>
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
                </TH>

                <TH className="h-11 text-center">
                  <button
                    type="button"
                    onClick={() => onSort('total')}
                    className="inline-flex items-center text-xs font-semibold hover:text-slate-700"
                  >
                    Skupaj {sortIndicator('total')}
                  </button>
                </TH>

                <TH className="min-w-[100px] text-center">PDF datoteke</TH>
                <TH className="text-center">Uredi</TH>
              </TR>
            </THead>

            <TBody>
              {filteredAndSortedOrders.length === 0 ? (
                <TR>
                  <TD className="py-6 text-center text-slate-500" colSpan={10}>
                    <EmptyState
                      title="Ni zadetkov za izbrane filtre."
                      action={
                        orders.length > 0 ? (
                          <button
                            type="button"
                            onClick={resetAllFilters}
                            className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-[color:var(--blue-500)] hover:bg-[#dbe7fb]"
                          >
                            Prikaži vsa naročila
                          </button>
                        ) : null
                      }
                    />
                  </TD>
                </TR>
              ) : (
                pagedOrders.map((order, orderIndex) => {
                  const orderAddress = formatOrderAddress(order);
                  const typeLabel = getCustomerTypeLabel(order.customer_type);
                  const rowStatus = rowStatusOverrides[order.id] ?? order.status;
                  const rowPaymentStatus = rowPaymentOverrides[order.id] ?? order.payment_status ?? null;
                  const isRowSelected = selected.includes(order.id);
                  const canEditStatus = isSingleSelection && isRowSelected;
                  const canEditPayment = isSingleSelection && isRowSelected;

                  return (
                    <TR
                      key={order.id}
                      className={`border-t border-slate-100 transition-colors duration-200 ${
                        isRowSelected ? adminTableRowToneClasses.selected : getAdminStripedRowToneClass(orderIndex)
                      } ${adminTableRowToneClasses.hover}`}
                    >
                      <TD>
                        <div className="flex justify-center">
                          <input
                            data-no-row-nav
                            type="checkbox"
                            checked={selected.includes(order.id)}
                            onChange={() => toggleSelected(order.id)}
                            aria-label={`Izberi naročilo ${toDisplayOrderNumber(order.order_number)}`}
                          />
                        </div>
                      </TD>

                      <TD className="text-center font-semibold text-slate-900" data-no-row-nav>
                        <Link
                          href={`/admin/orders/${order.id}`}
                          prefetch={false}
                          className="inline-flex rounded-sm px-1 text-[13px] font-semibold text-[color:var(--blue-500)] focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-[#3e67d6]"
                          aria-label={`Odpri naročilo ${toDisplayOrderNumber(order.order_number)}`}
                        >
                          {toDisplayOrderNumber(order.order_number)}
                        </Link>
                      </TD>

                      <TD className="text-center whitespace-nowrap text-slate-700">
                        <span
                          className="inline-block rounded-sm px-1 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-[#3e67d6]"
                          title={formatSlDateTime(order.created_at)}
                          aria-label={`Datum naročila ${formatSlDateTime(order.created_at)}`}
                          tabIndex={0}
                        >
                          {formatSlDate(order.created_at)}
                        </span>
                      </TD>

                      <TD className="text-slate-700">
                        <span className="block truncate" title={order.organization_name || order.contact_name}>
                          {order.organization_name || order.contact_name}
                        </span>
                      </TD>

                      <TD className="text-slate-700">
                        <span className="block truncate" title={orderAddress || '—'}>
                          {orderAddress || '—'}
                        </span>
                      </TD>

                      <TD className="text-center text-slate-700">{typeLabel}</TD>

                      <TD className="text-center text-slate-700">
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
                      </TD>

                      <TD className="text-center">
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
                      </TD>

                      <TD className="text-center text-slate-700">{formatCurrency(order.total)}</TD>

                      <TD className="min-w-[100px] pl-0 pr-0 text-center" data-no-row-nav>
                        <div className="flex justify-center">
                          <AdminOrdersPdfCell
                            orderId={order.id}
                            documents={documentsByOrder.get(order.id) ?? []}
                            attachments={attachmentsByOrder.get(order.id) ?? []}
                            interactionsDisabled={false}
                          />
                        </div>
                      </TD>

                      <TD className="pl-0 pr-0 text-center" data-no-row-nav>
                        <RowActions>
                          <IconButton
                            href={`/admin/orders/${order.id}`}
                            prefetch={false}
                            tone="neutral"
                            aria-label={`Uredi naročilo ${toDisplayOrderNumber(order.order_number)}`}
                            title="Uredi"
                          >
                            <svg
                              viewBox="0 0 20 20"
                              className="h-3.5 w-3.5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              aria-hidden="true"
                            >
                              <path d="M4 14.5l.5-3L13.5 2.5l3 3L7.5 14.5z" />
                              <path d="M11.5 4.5l3 3" />
                            </svg>
                          </IconButton>

                          <Button
                            type="button"
                            variant="close-x"
                            onClick={() => void handleDeleteRow(order.id)}
                            disabled={deletingRowId === order.id}
                            aria-label={`Izbriši naročilo ${toDisplayOrderNumber(order.order_number)}`}
                            title="Izbriši"
                          >
                            {deletingRowId === order.id ? (
                              <Spinner size="sm" className="text-[var(--danger-600)]" />
                            ) : (
                              '×'
                            )}
                          </Button>
                        </RowActions>
                      </TD>
                    </TR>
                  );
                })
              )}
            </TBody>
          </Table>
        </AdminTableLayout>
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
