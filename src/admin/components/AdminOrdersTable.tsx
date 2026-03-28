'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { IconButton } from '@/shared/ui/icon-button';
import AdminOrderStatusSelect from '@/admin/components/AdminOrderStatusSelect';
import { MenuItem, MenuPanel } from '@/shared/ui/menu';
import { CustomSelect } from '@/shared/ui/select';
import { Spinner } from '@/shared/ui/loading';
import { Pagination, PageSizeSelect, useTablePagination } from '@/shared/ui/pagination';
import {
  DownloadIcon,
  FilterIcon,
  PencilIcon,
  TrashCanIcon
} from '@/shared/ui/icons/AdminActionIcons';
import { useToast } from '@/shared/ui/toast';
import { EmptyState, RowActions, Table, TBody, TD, THead, TH, TR } from '@/shared/ui/table';
import { AdminSearchInput } from '@/shared/ui/admin-search-input';
import { ADMIN_CONTROL_HEIGHT, ADMIN_CONTROL_PADDING_X } from '@/shared/ui/admin-controls/controlSizes';
import {
  adminTableRowToneClasses,
  dateInputTokenClasses,
  getAdminStripedRowToneClass
} from '@/shared/ui/theme/tokens';
import { AdminTableLayout, ColumnVisibilityControl } from '@/shared/ui/admin-table';
import AdminOrderPaymentSelect from '@/admin/components/AdminOrderPaymentSelect';
import StatusChip from '@/admin/components/StatusChip';
import PaymentChip from '@/admin/components/PaymentChip';
import { getCustomerTypeLabel } from '@/shared/domain/order/customerType';
import { ORDER_STATUS_OPTIONS } from '@/shared/domain/order/orderStatus';
import { formatSlDate, formatSlDateTime } from '@/shared/domain/order/dateTime';
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
type OrderRowTuple = [
  id: number,
  orderNumber: string,
  customerType: string,
  organizationName: string | null,
  contactName: string,
  email: string,
  phone: string | null,
  deliveryAddress: string | null,
  reference: string | null,
  notes: string | null,
  status: string,
  paymentStatus: string | null,
  paymentNotes: string | null,
  subtotal: number | string | null,
  tax: number | string | null,
  total: number | string | null,
  createdAt: string,
  isDraft: boolean,
  deletedAt?: string | null
];
type PdfDocTuple = readonly [id: number, orderId: number, type: PdfDoc['type'], filename: string, blobUrl: string, createdAt: string];
type AttachmentTuple = readonly [id: number, orderId: number, type: Attachment['type'], filename: string, blobUrl: string, createdAt?: string];

type OrdersRangePreset = '7d' | '1m' | '3m' | '6m' | '1y' | 'ytd' | 'max' | 'custom';
type OrdersColumnKey = 'order' | 'date' | 'customer' | 'address' | 'type' | 'status' | 'payment' | 'total' | 'documents';

const PAGE_SIZE_OPTIONS = [50, 100];
const ORDER_COLUMN_OPTIONS: Array<{ key: OrdersColumnKey; label: string }> = [
  { key: 'order', label: 'Naročilo' },
  { key: 'date', label: 'Datum' },
  { key: 'customer', label: 'Naročnik' },
  { key: 'address', label: 'Naslov' },
  { key: 'type', label: 'Tip' },
  { key: 'status', label: 'Status' },
  { key: 'payment', label: 'Plačilo' },
  { key: 'total', label: 'Skupaj' },
  { key: 'documents', label: 'PDF datoteke' }
];
const AdminOrdersPreviewChart = dynamic(() => import('@/admin/components/AdminOrdersPreviewChart'), { ssr: false });
const LazyAdminOrdersPdfCell = dynamic(() => import('@/admin/components/AdminOrdersPdfCell'), {
  ssr: false,
  loading: () => (
    <button
      type="button"
      disabled
      className="inline-flex h-8 min-w-[72px] items-center justify-center rounded-md border border-slate-300 bg-slate-100 px-2 text-[11px] font-medium text-slate-500"
    >
      PDF
    </button>
  )
});
const LazyConfirmDialog = dynamic(
  () => import('@/shared/ui/confirm-dialog').then((module) => module.ConfirmDialog),
  { ssr: false }
);

export default function AdminOrdersTable({
  orders: serializedOrders,
  documents: serializedDocuments,
  attachments: serializedAttachments,
  initialFrom = '',
  initialTo = '',
  initialQuery = '',
  initialStatusFilter = 'all',
  initialDocumentType = 'all',
  initialPage = 1,
  initialPageSize = 50,
  totalCount,
  topAction,
  analyticsAppearance
}: {
  orders: ReadonlyArray<Readonly<OrderRowTuple>>;
  documents: ReadonlyArray<PdfDocTuple>;
  attachments: ReadonlyArray<AttachmentTuple>;
  initialFrom?: string;
  initialTo?: string;
  initialQuery?: string;
  initialStatusFilter?: StatusTab | string;
  initialDocumentType?: DocumentType | string;
  initialPage?: number;
  initialPageSize?: number;
  totalCount?: number;
  topAction?: ReactNode;
  analyticsAppearance?: AnalyticsGlobalAppearance;
}) {
  const orders = useMemo<OrderRow[]>(
    () =>
      serializedOrders.map((row) => ({
        id: row[0],
        order_number: row[1],
        customer_type: row[2],
        organization_name: row[3] ?? '',
        contact_name: row[4],
        email: row[5],
        phone: row[6] ?? '',
        delivery_address: row[7] ?? '',
        reference: row[8] ?? '',
        notes: row[9],
        status: row[10],
        payment_status: row[11],
        payment_notes: row[12],
        subtotal: row[13] ?? 0,
        tax: row[14] ?? 0,
        total: row[15] ?? 0,
        created_at: row[16],
        is_draft: row[17],
        deleted_at: row[18] ?? null
      })),
    [serializedOrders]
  );
  const documents = useMemo<PdfDoc[]>(
    () =>
      serializedDocuments.map((entry) => ({
        id: entry[0],
        order_id: entry[1],
        type: entry[2],
        filename: entry[3],
        blob_url: entry[4],
        created_at: entry[5]
      })),
    [serializedDocuments]
  );
  const attachments = useMemo<Attachment[]>(
    () =>
      serializedAttachments.map((entry) => ({
        id: entry[0],
        order_id: entry[1],
        type: entry[2],
        filename: entry[3],
        blob_url: entry[4],
        created_at: entry[5] ?? ''
      })),
    [serializedAttachments]
  );
  const router = useRouter();
  const pathname = usePathname();
  const isServerFilteredMode = typeof totalCount === 'number';
  const [selected, setSelected] = useState<number[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingRowId, setDeletingRowId] = useState<number | null>(null);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [confirmDeleteRowId, setConfirmDeleteRowId] = useState<number | null>(null);
  const [isBulkUpdatingStatus, setIsBulkUpdatingStatus] = useState(false);

  const [statusFilter, setStatusFilter] = useState<StatusTab>((initialStatusFilter as StatusTab) ?? 'all');
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
  const [isChartReady, setIsChartReady] = useState(false);

  const [documentType, setDocumentType] = useState<DocumentType>((initialDocumentType as DocumentType) ?? 'all');
  const { toast } = useToast();
  const [isDownloading, setIsDownloading] = useState(false);

  const selectAllRef = useRef<HTMLInputElement>(null);
  const datePopoverRef = useRef<HTMLDivElement>(null);
  const statusHeaderMenuRef = useRef<HTMLDivElement>(null);
  const paymentHeaderMenuRef = useRef<HTMLDivElement>(null);
  const hasAutoResetFiltersRef = useRef(false);

  const [isStatusHeaderMenuOpen, setIsStatusHeaderMenuOpen] = useState(false);
  const [isPaymentHeaderMenuOpen, setIsPaymentHeaderMenuOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<OrdersColumnKey, boolean>>({
    order: true,
    date: true,
    customer: true,
    address: true,
    type: true,
    status: true,
    payment: true,
    total: true,
    documents: true
  });

  useEffect(() => {
    if (typeof globalThis.window === 'undefined') return;
    if ('requestIdleCallback' in globalThis.window) {
      const idleId = globalThis.window.requestIdleCallback(() => setIsChartReady(true), { timeout: 1200 });
      return () => globalThis.window.cancelIdleCallback(idleId);
    }

    const timeoutId = globalThis.setTimeout(() => setIsChartReady(true), 0);
    return () => globalThis.clearTimeout(timeoutId);
  }, []);

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

  const orderRuntimeById = useMemo(() => {
    const runtime = new Map<number, {
      createdAtTimestamp: number;
      createdAtDayTimestamp: number;
      numericOrderNumber: number;
      customerLabel: string;
      addressLabel: string;
      typeLabel: string;
      statusLabel: string;
      paymentLabel: string;
      searchBlob: string;
    }>();

    orders.forEach((order) => {
      const createdAtTimestamp = new Date(order.created_at).getTime();
      const createdAtDate = new Date(order.created_at);
      createdAtDate.setHours(0, 0, 0, 0);
      const customerLabel = order.organization_name || order.contact_name || '';
      const addressLabel = formatOrderAddress(order);
      const typeLabel = getCustomerTypeLabel(order.customer_type);
      const statusLabel = getOrderStatusLabelForUi(order.status);
      const paymentLabel = getPaymentLabel(order.payment_status);
      runtime.set(order.id, {
        createdAtTimestamp,
        createdAtDayTimestamp: createdAtDate.getTime(),
        numericOrderNumber: getNumericOrderNumber(order.order_number),
        customerLabel,
        addressLabel,
        typeLabel,
        statusLabel,
        paymentLabel,
        searchBlob: normalizeForSearch(
          [order.order_number, customerLabel, addressLabel, typeLabel, statusLabel, paymentLabel]
            .filter(Boolean)
            .join(' ')
        )
      });
    });

    return runtime;
  }, [orders]);

  const filteredAndSortedOrders = useMemo(() => {
    if (isServerFilteredMode) {
      return orders;
    }
    const normalizedQuery = normalizeForSearch(debouncedQuery);

    const filteredOrders = orders.filter((order) => {
      const mergedStatusValue = getMergedOrderStatusValue(order.status);

      if (statusFilter !== 'all' && mergedStatusValue !== statusFilter) {
        return false;
      }

      const orderRuntime = orderRuntimeById.get(order.id);
      const orderTimestamp = orderRuntime?.createdAtTimestamp ?? new Date(order.created_at).getTime();

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

      const orderSearchBlob = orderRuntime?.searchBlob ?? '';

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
      const leftRuntime = orderRuntimeById.get(leftOrder.id);
      const rightRuntime = orderRuntimeById.get(rightOrder.id);
      const leftOrderNumberNumeric = leftRuntime?.numericOrderNumber ?? getNumericOrderNumber(leftOrder.order_number);
      const rightOrderNumberNumeric = rightRuntime?.numericOrderNumber ?? getNumericOrderNumber(rightOrder.order_number);

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
          leftValue = leftRuntime?.customerLabel ?? (leftOrder.organization_name || leftOrder.contact_name || '');
          rightValue = rightRuntime?.customerLabel ?? (rightOrder.organization_name || rightOrder.contact_name || '');
          break;
        case 'address':
          leftValue = leftRuntime?.addressLabel ?? formatOrderAddress(leftOrder);
          rightValue = rightRuntime?.addressLabel ?? formatOrderAddress(rightOrder);
          break;
        case 'type':
          leftValue = leftRuntime?.typeLabel ?? getCustomerTypeLabel(leftOrder.customer_type);
          rightValue = rightRuntime?.typeLabel ?? getCustomerTypeLabel(rightOrder.customer_type);
          break;
        case 'status':
          leftValue = leftRuntime?.statusLabel ?? getOrderStatusLabelForUi(leftOrder.status);
          rightValue = rightRuntime?.statusLabel ?? getOrderStatusLabelForUi(rightOrder.status);
          break;
        case 'payment':
          leftValue = leftRuntime?.paymentLabel ?? getPaymentLabel(leftOrder.payment_status);
          rightValue = rightRuntime?.paymentLabel ?? getPaymentLabel(rightOrder.payment_status);
          break;
        case 'total':
          leftValue = toAmount(leftOrder.total);
          rightValue = toAmount(rightOrder.total);
          break;
        case 'created_at':
        default: {
          leftValue = leftRuntime?.createdAtDayTimestamp ?? 0;
          rightValue = rightRuntime?.createdAtDayTimestamp ?? 0;
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
    orderRuntimeById,
    sortKey,
    sortDirection,
    isServerFilteredMode
  ]);

  const { page: clientPage, pageSize: clientPageSize, pageCount: clientPageCount, setPage, setPageSize } = useTablePagination({
    totalCount: filteredAndSortedOrders.length,
    storageKey: 'adminOrders.pageSize',
    defaultPageSize: 50,
    pageSizeOptions: PAGE_SIZE_OPTIONS
  });

  const page = isServerFilteredMode ? Math.max(1, initialPage) : clientPage;
  const pageSize = isServerFilteredMode ? initialPageSize : clientPageSize;
  const pageCount = isServerFilteredMode ? Math.max(1, Math.ceil((totalCount ?? orders.length) / Math.max(1, pageSize))) : clientPageCount;

  const updateServerFilters = useCallback(
    (updates: Partial<Record<'from' | 'to' | 'q' | 'status' | 'docType' | 'page' | 'pageSize', string>>) => {
      if (!isServerFilteredMode) return;
      const params = new URLSearchParams();
      const applyValue = (key: keyof typeof updates, fallbackValue: string) => {
        const candidate = (updates[key] ?? fallbackValue).trim();
        if (candidate) params.set(key, candidate);
      };
      applyValue('from', debouncedFromDate);
      applyValue('to', debouncedToDate);
      applyValue('q', debouncedQuery);
      applyValue('status', statusFilter === 'all' ? '' : statusFilter);
      applyValue('docType', documentType === 'all' ? '' : documentType);
      applyValue('page', String(page));
      applyValue('pageSize', String(pageSize));

      router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ''}`);
    },
    [debouncedFromDate, debouncedQuery, debouncedToDate, documentType, isServerFilteredMode, page, pageSize, pathname, router, statusFilter]
  );
  const handlePageChange = useCallback(
    (nextPage: number) => {
      if (isServerFilteredMode) {
        updateServerFilters({ page: String(nextPage) });
        return;
      }
      setPage(nextPage);
    },
    [isServerFilteredMode, setPage, updateServerFilters]
  );

  const handlePageSizeChange = useCallback(
    (nextPageSize: number) => {
      if (isServerFilteredMode) {
        updateServerFilters({ pageSize: String(nextPageSize), page: '1' });
        return;
      }
      setPageSize(nextPageSize);
    },
    [isServerFilteredMode, setPageSize, updateServerFilters]
  );

  const pagedOrders = useMemo(() => {
    if (isServerFilteredMode) return filteredAndSortedOrders;
    const startIndex = (page - 1) * pageSize;
    return filteredAndSortedOrders.slice(startIndex, startIndex + pageSize);
  }, [filteredAndSortedOrders, isServerFilteredMode, page, pageSize]);
  const rowDisplayByOrderId = useMemo(() => {
    const next = new Map<number, { dateLabel: string; dateTimeLabel: string; orderAddress: string; typeLabel: string; totalLabel: string }>();
    pagedOrders.forEach((order) => {
      next.set(order.id, {
        dateLabel: formatSlDate(order.created_at),
        dateTimeLabel: formatSlDateTime(order.created_at),
        orderAddress: formatOrderAddress(order),
        typeLabel: getCustomerTypeLabel(order.customer_type),
        totalLabel: formatCurrency(order.total)
      });
    });
    return next;
  }, [pagedOrders]);

  const visibleOrderIds = useMemo(() => pagedOrders.map((order) => order.id), [pagedOrders]);
  const selectedOrderIds = useMemo(() => new Set(selected), [selected]);

  const selectedVisibleCount = useMemo(
    () => visibleOrderIds.filter((orderId) => selectedOrderIds.has(orderId)).length,
    [visibleOrderIds, selectedOrderIds]
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
    if (isServerFilteredMode) {
      updateServerFilters({ page: '1' });
      return;
    }
    setPage(1);
  }, [debouncedFromDate, debouncedQuery, debouncedToDate, documentType, isServerFilteredMode, setPage, sortDirection, sortKey, statusFilter, updateServerFilters]);

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
    if (orders.length === 0) return '—';

    const timestamps = orders
      .map((order) => new Date(order.created_at).getTime())
      .filter((timestamp) => !Number.isNaN(timestamp));

    if (timestamps.length === 0) return '—';

    const minTimestamp = Math.min(...timestamps);
    const maxTimestamp = Math.max(...timestamps);

    return `${formatCompactDate(new Date(minTimestamp))} - ${formatCompactDate(new Date(maxTimestamp))}`;
  }, [orders]);

  const dateRangeLabel =
    fromDate || toDate
      ? `${formatCompactDateFromDateInput(fromDate)} - ${formatCompactDateFromDateInput(toDate)}`
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
      <div className="w-full">
        {isChartReady ? (
          <AdminOrdersPreviewChart
            orders={orders}
            appearance={analyticsAppearance}
            fromDate={debouncedFromDate}
            toDate={debouncedToDate}
            activeRange={rangePreset}
            onRangeChange={applyAnalyticsRangePreset}
          />
        ) : (
          <div aria-hidden="true" className="mb-3 h-[292px] rounded-2xl border border-slate-200/80 bg-white/60" />
        )}

        {isBulkDeleteDialogOpen ? (
          <LazyConfirmDialog
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
        ) : null}

        {confirmDeleteRowId !== null ? (
          <LazyConfirmDialog
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
        ) : null}

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
              <div className="inline-flex items-center gap-0.5 border-b border-slate-200 pb-1">
                {statusTabs.map((tab) => {
                  const isActive = statusFilter === tab.value;
                  return (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => setStatusFilter(tab.value)}
                      className={`relative px-3 py-1.5 text-[11px] font-medium transition ${
                        isActive
                          ? 'text-slate-900 after:absolute after:inset-x-0 after:bottom-[-5px] after:h-[2px] after:rounded-full after:bg-slate-800'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </>
          }
          headerRight={
            <>
              <div className="flex items-center gap-2 pb-1">
                <div className="relative" ref={datePopoverRef}>
                  <button
                    type="button"
                    onClick={() => setIsDatePopoverOpen((previousState) => !previousState)}
                    className={`${ADMIN_CONTROL_HEIGHT} w-[124px] rounded-xl border border-slate-300 bg-white ${ADMIN_CONTROL_PADDING_X} py-0 text-left text-xs font-medium text-slate-700 hover:bg-[color:var(--hover-neutral)] focus:bg-[color:var(--hover-neutral)] focus:ring-1 focus:ring-inset focus:ring-blue-500 focus:outline-none`}
                  >
                    <span className="inline-flex h-full w-full items-center gap-1.5 leading-none">
                      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-600" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <rect x="3" y="5" width="18" height="16" rx="2" />
                        <path d="M16 3v4M8 3v4M3 10h18" />
                      </svg>
                      <span className="truncate">{dateRangeLabel}</span>
                    </span>
                  </button>
                  {isDatePopoverOpen && (
                    <div lang="sl-SI" className="absolute right-0 top-9 z-20 w-[420px] rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
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
                <CustomSelect
                  value={documentType}
                  onChange={(next) => setDocumentType(next as DocumentType)}
                  options={documentTypeOptions}
                  triggerClassName={`${ADMIN_CONTROL_HEIGHT} w-[126px] rounded-xl border border-slate-300 bg-white ${ADMIN_CONTROL_PADDING_X} py-0 text-xs font-semibold text-slate-700 shadow-none hover:bg-[color:var(--hover-neutral)]`}
                />
                <IconButton
                  type="button"
                  onClick={handleDownloadAllDocuments}
                  disabled={isDownloading}
                  tone="neutral"
                  size="sm"
                  aria-label={selected.length > 0 ? `Prenesi izbrane (${selected.length})` : 'Prenesi vse dokumente'}
                  title={selected.length > 0 ? `Prenesi (${selected.length})` : 'Prenesi vse'}
                >
                  {isDownloading ? (
                    <Spinner size="sm" className="text-slate-500" />
                  ) : (
                    <DownloadIcon />
                  )}
                </IconButton>
                <ColumnVisibilityControl
                  options={ORDER_COLUMN_OPTIONS}
                  visibleMap={visibleColumns}
                  onToggle={(key) => setVisibleColumns((current) => ({ ...current, [key]: !current[key as OrdersColumnKey] }))}
                  showLabel={false}
                  className="[&>button]:!h-7 [&>button]:!w-7 [&>button]:!rounded-md [&>button]:!border-slate-200 [&>button]:!bg-transparent [&>button]:!px-0 [&>button]:!text-slate-600 [&>button]:hover:!border-slate-300 [&>button]:hover:!bg-[color:var(--hover-neutral)] [&>button]:hover:!text-slate-700"
                  icon={<FilterIcon className="h-3.5 w-3.5" />}
                />
                <IconButton
                  type="button"
                  onClick={handleDelete}
                  disabled={selected.length === 0 || isDeleting}
                  tone="danger"
                  size="sm"
                  aria-label="Izbriši izbrana naročila"
                  title="Izbriši"
                >
                  {isDeleting ? (
                    <Spinner size="sm" className="text-[var(--danger-600)]" />
                  ) : (
                    <TrashCanIcon className="h-[18px] w-[18px]" />
                  )}
                </IconButton>
                {topAction ? <div className="flex items-center [&_button]:!rounded-xl">{topAction}</div> : null}
              </div>
            </>
          }
          filterRowLeft={
            <AdminSearchInput
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Poišči naročila"
              className="h-12 min-w-[360px] rounded-2xl border-slate-200 bg-slate-100 pl-10 pr-3 text-sm"
            />
          }
          filterRowRight={
            <></>
          }
          footerRight={
            <div className="flex w-full flex-wrap items-center justify-between gap-2">
              <PageSizeSelect value={pageSize} options={PAGE_SIZE_OPTIONS} onChange={handlePageSizeChange} />
              <Pagination page={page} pageCount={pageCount} onPageChange={handlePageChange} variant="bottomBar" size="sm" showNumbers={false} />
            </div>
          }
        >
          <Table className="min-w-[1060px] w-full text-[11px]">
            <colgroup>
              <col style={{ width: columnWidths.selectAndDelete }} />
              {visibleColumns.order ? <col style={{ width: columnWidths.order }} /> : null}
              {visibleColumns.date ? <col style={{ width: columnWidths.date }} /> : null}
              {visibleColumns.customer ? <col style={{ width: columnWidths.customer }} /> : null}
              {visibleColumns.address ? <col style={{ width: columnWidths.address }} /> : null}
              {visibleColumns.type ? <col style={{ width: columnWidths.type }} /> : null}
              {visibleColumns.status ? <col style={{ width: columnWidths.status }} /> : null}
              {visibleColumns.payment ? <col style={{ width: columnWidths.payment }} /> : null}
              {visibleColumns.total ? <col style={{ width: columnWidths.total }} /> : null}
              {visibleColumns.documents ? <col style={{ width: columnWidths.documents }} /> : null}
              <col style={{ width: columnWidths.edit }} />
            </colgroup>

            <THead>
              <TR>
                <TH className="h-11 text-center text-[11px]">
                  <input
                    type="checkbox"
                    ref={selectAllRef}
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Izberi vse"
                  />
                </TH>

                {visibleColumns.order ? <TH className="h-11 text-center">
                  <button
                    type="button"
                    onClick={() => onSort('order_number')}
                    className="inline-flex items-center text-[11px] font-semibold hover:text-slate-700"
                  >
                    Naročilo {sortIndicator('order_number')}
                  </button>
                </TH> : null}

                {visibleColumns.date ? <TH className="h-11 text-center text-[11px]">
                  <button
                    type="button"
                    onClick={() => onSort('created_at')}
                    className="inline-flex items-center text-[11px] font-semibold hover:text-slate-700"
                  >
                    Datum {sortIndicator('created_at')}
                  </button>
                </TH> : null}

                {visibleColumns.customer ? <TH className="text-[11px]">
                  <button
                    type="button"
                    onClick={() => onSort('customer')}
                    className="inline-flex items-center text-[11px] font-semibold hover:text-slate-700"
                  >
                    Naročnik {sortIndicator('customer')}
                  </button>
                </TH> : null}

                {visibleColumns.address ? <TH className="text-[11px]">
                  <button
                    type="button"
                    onClick={() => onSort('address')}
                    className="inline-flex items-center text-[11px] font-semibold hover:text-slate-700"
                  >
                    Naslov {sortIndicator('address')}
                  </button>
                </TH> : null}

                {visibleColumns.type ? <TH className="h-11 text-center text-[11px]">
                  <button
                    type="button"
                    onClick={() => onSort('type')}
                    className="inline-flex items-center text-[11px] font-semibold hover:text-slate-700"
                  >
                    Tip {sortIndicator('type')}
                  </button>
                </TH> : null}

                {visibleColumns.status ? <TH className="h-11 text-center text-[11px]">
                  <div className="relative inline-flex" ref={statusHeaderMenuRef}>
                    {selectedCount > 0 ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setIsStatusHeaderMenuOpen((previousOpen) => !previousOpen)}
                          disabled={isBulkUpdatingStatus}
                        className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-[color:var(--hover-neutral)] disabled:cursor-default disabled:text-slate-300"
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
                        className="inline-flex items-center text-[11px] font-semibold hover:text-slate-700"
                      >
                        Status {sortIndicator('status')}
                      </button>
                    )}
                  </div>
                </TH> : null}

                {visibleColumns.payment ? <TH className="h-11 text-center text-[11px]">
                  <div className="relative inline-flex" ref={paymentHeaderMenuRef}>
                    {selectedCount > 0 ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setIsPaymentHeaderMenuOpen((previousOpen) => !previousOpen)}
                          disabled={isBulkUpdatingStatus}
                        className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-[color:var(--hover-neutral)] disabled:cursor-default disabled:text-slate-300"
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
                        className="inline-flex items-center text-[11px] font-semibold hover:text-slate-700"
                      >
                        Plačilo {sortIndicator('payment')}
                      </button>
                    )}
                  </div>
                </TH> : null}

                {visibleColumns.total ? <TH className="h-11 text-center text-[11px]">
                  <button
                    type="button"
                    onClick={() => onSort('total')}
                    className="inline-flex items-center text-[11px] font-semibold hover:text-slate-700"
                  >
                    Skupaj {sortIndicator('total')}
                  </button>
                </TH> : null}

                {visibleColumns.documents ? <TH className="h-11 min-w-[100px] text-center text-[11px] font-semibold leading-none">PDF datoteke</TH> : null}
                <TH className="h-11 text-center text-[11px] font-semibold leading-none">Uredi</TH>
              </TR>
            </THead>

            <TBody>
              {filteredAndSortedOrders.length === 0 ? (
                <TR>
                  <TD className="py-6 text-center text-slate-500" colSpan={Object.values(visibleColumns).filter(Boolean).length + 2}>
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
                  const rowDisplay = rowDisplayByOrderId.get(order.id);
                  const orderAddress = rowDisplay?.orderAddress ?? formatOrderAddress(order);
                  const typeLabel = rowDisplay?.typeLabel ?? getCustomerTypeLabel(order.customer_type);
                  const rowStatus = rowStatusOverrides[order.id] ?? order.status;
                  const rowPaymentStatus = rowPaymentOverrides[order.id] ?? order.payment_status ?? null;
                  const isRowSelected = selected.includes(order.id);
                  const canEditStatus = isSingleSelection && isRowSelected;
                  const canEditPayment = isSingleSelection && isRowSelected;

                  return (
                    <TR
                      key={order.id}
                      className={`border-t border-slate-100 text-[11px] transition-colors duration-200 ${
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

                      {visibleColumns.order ? <TD className="text-center font-semibold text-slate-900" data-no-row-nav>
                        <Link
                          href={`/admin/orders/${order.id}`}
                          prefetch={false}
                          className="inline-flex rounded-sm px-1 text-[11px] font-semibold text-[color:var(--blue-500)] focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-[#3e67d6]"
                          aria-label={`Odpri naročilo ${toDisplayOrderNumber(order.order_number)}`}
                        >
                          {toDisplayOrderNumber(order.order_number)}
                        </Link>
                      </TD> : null}

                      {visibleColumns.date ? <TD className="text-center whitespace-nowrap text-slate-700">
                        <span
                          className="inline-block rounded-sm px-1 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-[#3e67d6]"
                          title={rowDisplay?.dateTimeLabel ?? formatSlDateTime(order.created_at)}
                          aria-label={`Datum naročila ${rowDisplay?.dateTimeLabel ?? formatSlDateTime(order.created_at)}`}
                          tabIndex={0}
                        >
                          {rowDisplay?.dateLabel ?? formatSlDate(order.created_at)}
                        </span>
                      </TD> : null}

                      {visibleColumns.customer ? <TD className="text-slate-700">
                        <span className="block truncate" title={order.organization_name || order.contact_name}>
                          {order.organization_name || order.contact_name}
                        </span>
                      </TD> : null}

                      {visibleColumns.address ? <TD className="text-slate-700">
                        <span className="block truncate" title={orderAddress || '—'}>
                          {orderAddress || '—'}
                        </span>
                      </TD> : null}

                      {visibleColumns.type ? <TD className="text-center text-slate-700">{typeLabel}</TD> : null}

                      {visibleColumns.status ? <TD className="text-center text-slate-700">
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
                      </TD> : null}

                      {visibleColumns.payment ? <TD className="text-center">
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
                      </TD> : null}

                      {visibleColumns.total ? <TD className="text-center text-slate-700">{rowDisplay?.totalLabel ?? formatCurrency(order.total)}</TD> : null}

                      {visibleColumns.documents ? <TD className="min-w-[100px] pl-0 pr-0 text-center" data-no-row-nav>
                        <div className="flex justify-center">
                          <LazyAdminOrdersPdfCell
                            orderId={order.id}
                            documents={documentsByOrder.get(order.id) ?? []}
                            attachments={attachmentsByOrder.get(order.id) ?? []}
                            interactionsDisabled={false}
                          />
                        </div>
                      </TD> : null}

                      <TD className="pl-0 pr-0 text-center" data-no-row-nav>
                        <RowActions>
                          <IconButton
                            href={`/admin/orders/${order.id}`}
                            prefetch={false}
                            tone="neutral"
                            className="h-8 w-8 border-0 bg-transparent text-slate-600 shadow-none hover:text-slate-800 active:bg-transparent"
                            aria-label={`Uredi naročilo ${toDisplayOrderNumber(order.order_number)}`}
                            title="Uredi"
                          >
                            <PencilIcon />
                          </IconButton>

                          <button
                            type="button"
                            onClick={() => void handleDeleteRow(order.id)}
                            disabled={deletingRowId === order.id}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border-0 bg-transparent text-[rgb(192,64,46)] hover:text-[rgb(170,56,40)] active:bg-transparent disabled:opacity-40"
                            aria-label={`Izbriši naročilo ${toDisplayOrderNumber(order.order_number)}`}
                            title="Izbriši"
                          >
                            {deletingRowId === order.id ? (
                              <Spinner size="sm" className="text-[var(--danger-600)]" />
                            ) : (
                              <TrashCanIcon className="h-[18px] w-[18px]" />
                            )}
                          </button>
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

function formatCompactDate(dateValue: Date) {
  if (Number.isNaN(dateValue.getTime())) return '—';
  return `${String(dateValue.getDate()).padStart(2, '0')}.${String(dateValue.getMonth() + 1).padStart(2, '0')}`;
}

function formatCompactDateFromDateInput(value: string) {
  if (!value) return '—';
  const parsedDate = new Date(`${value}T00:00:00`);
  return formatCompactDate(parsedDate);
}
