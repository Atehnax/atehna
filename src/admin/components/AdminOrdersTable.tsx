'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { IconButton } from '@/shared/ui/icon-button';
import AdminOrderStatusSelect from '@/admin/components/AdminOrderStatusSelect';
import { MenuItem, MenuPanel } from '@/shared/ui/menu';
import { Spinner } from '@/shared/ui/loading';
import { Pagination, PageSizeSelect, useTablePagination } from '@/shared/ui/pagination';
import {
  DownloadIcon,
  FilterIcon,
  PencilIcon,
  TrashCanIcon
} from '@/shared/ui/icons/AdminActionIcons';
import { useToast } from '@/shared/ui/toast';
import { EmptyState, RowActions, RowActionsDropdown, Table, TBody, TD, THead, TH, TR } from '@/shared/ui/table';
import { AdminSearchInput } from '@/shared/ui/admin-search-input';
import {
  adminTableRowToneClasses,
  dateInputTokenClasses
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
type SortableColumnKey = 'order' | 'date' | 'customer' | 'address' | 'status' | 'payment' | 'total' | 'type';
type TypePriority = 'school' | 'company' | 'individual';
type SortCycleState = { column: SortableColumnKey; index: number } | null;

const PAGE_SIZE_OPTIONS = [25, 50, 100];
const ORDER_COLUMN_OPTIONS: Array<{ key: OrdersColumnKey; label: string }> = [
  { key: 'date', label: 'Datum' },
  { key: 'customer', label: 'Naročnik' },
  { key: 'address', label: 'Naslov' },
  { key: 'type', label: 'Tip' },
  { key: 'status', label: 'Status' },
  { key: 'payment', label: 'Plačilo' },
  { key: 'total', label: 'Skupaj' },
  { key: 'documents', label: 'PDF datoteke' }
];
const STATUS_SORT_PRIORITY: Record<string, number> = {
  finished: 0,
  sent: 1,
  partially_sent: 2,
  in_progress: 3,
  cancelled: 4,
  received: 5
};
const PAYMENT_SORT_PRIORITY: Record<string, number> = {
  paid: 0,
  refunded: 1,
  unpaid: 2
};
const TYPE_SORT_CYCLE: TypePriority[] = ['school', 'company', 'individual'];
const HEADER_TITLE_BUTTON_CLASS = 'inline-flex items-center text-[11px] font-semibold leading-none hover:text-slate-700';
const HEADER_FILTER_BUTTON_CLASS = 'group inline-flex h-[12px] w-[12px] shrink-0 self-center items-center justify-center text-slate-500';
const COMPACT_FILTER_INPUT_CLASS = `h-7 rounded-md px-2 text-[11px] ${dateInputTokenClasses.base}`;
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
  initialPageSize = 25,
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

  const [sortState, setSortState] = useState<SortCycleState>(null);

  const [fromDate, setFromDate] = useState(initialFrom);
  const [toDate, setToDate] = useState(initialTo);
  const [hasExplicitDateFilter, setHasExplicitDateFilter] = useState(Boolean(initialFrom || initialTo));
  const [rangePreset, setRangePreset] = useState<OrdersRangePreset>('max');
  const debouncedQuery = useDebouncedValue(query, 200);
  const debouncedFromDate = useDebouncedValue(fromDate, 200);
  const debouncedToDate = useDebouncedValue(toDate, 200);
  const [isChartReady, setIsChartReady] = useState(false);

  const [documentType, setDocumentType] = useState<DocumentType>((initialDocumentType as DocumentType) ?? 'all');
  const [columnStatusFilter, setColumnStatusFilter] = useState<StatusTab>('all');
  const [columnPaymentFilter, setColumnPaymentFilter] = useState<'all' | 'paid' | 'refunded' | 'unpaid'>('all');
  const [columnTypeFilter, setColumnTypeFilter] = useState<'all' | TypePriority>('all');
  const [totalRange, setTotalRange] = useState<{ min: string; max: string }>({ min: '', max: '' });
  const [draftTotalRange, setDraftTotalRange] = useState<{ min: string; max: string }>({ min: '', max: '' });
  const [orderNumberRange, setOrderNumberRange] = useState<{ min: string; max: string }>({ min: '', max: '' });
  const [draftOrderNumberRange, setDraftOrderNumberRange] = useState<{ min: string; max: string }>({ min: '', max: '' });
  const [draftFromDate, setDraftFromDate] = useState(initialFrom);
  const [draftToDate, setDraftToDate] = useState(initialTo);
  const [openHeaderFilter, setOpenHeaderFilter] = useState<null | 'order' | 'date' | 'type' | 'status' | 'payment' | 'total' | 'documents'>(null);
  const { toast } = useToast();
  const [isDownloading, setIsDownloading] = useState(false);

  const selectAllRef = useRef<HTMLInputElement>(null);
  const orderFilterButtonRef = useRef<HTMLButtonElement>(null);
  const dateFilterButtonRef = useRef<HTMLButtonElement>(null);
  const typeFilterButtonRef = useRef<HTMLButtonElement>(null);
  const statusFilterButtonRef = useRef<HTMLButtonElement>(null);
  const paymentFilterButtonRef = useRef<HTMLButtonElement>(null);
  const totalFilterButtonRef = useRef<HTMLButtonElement>(null);
  const documentsFilterButtonRef = useRef<HTMLButtonElement>(null);
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
    if (visibleColumns.order) return;
    setVisibleColumns((currentColumns) => ({ ...currentColumns, order: true }));
  }, [visibleColumns.order]);

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

  useEffect(() => {
    if (!openHeaderFilter) return;

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-header-filter-root="true"]')) return;
      setOpenHeaderFilter(null);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenHeaderFilter(null);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [openHeaderFilter]);

  useEffect(() => {
    if (openHeaderFilter === 'total') {
      setDraftTotalRange(totalRange);
    }
    if (openHeaderFilter === 'order') {
      setDraftOrderNumberRange(orderNumberRange);
    }
    if (openHeaderFilter === 'date') {
      setDraftFromDate(fromDate);
      setDraftToDate(toDate);
    }
  }, [openHeaderFilter, totalRange, orderNumberRange, fromDate, toDate]);

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
      const anchorDate = new Date(latestOrderDate);
      applyDateRange(earliestOrderDate, anchorDate, 'max');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyQuickDateRange = (range: '7d' | '30d' | '90d' | '180d' | '365d' | 'ytd') => {
    const anchorDate = new Date(latestOrderDate);

    if (range === 'ytd') {
      const ytdStart = new Date(anchorDate.getFullYear(), 0, 1);
      return { from: toDateInputValue(ytdStart), to: toDateInputValue(anchorDate) };
    }

    const dayCountByRange: Record<'7d' | '30d' | '90d' | '180d' | '365d', number> = {
      '7d': 6,
      '30d': 29,
      '90d': 89,
      '180d': 179,
      '365d': 364
    };

    const fromDateValue = shiftDateByDays(anchorDate, -dayCountByRange[range]);
    return { from: toDateInputValue(fromDateValue), to: toDateInputValue(anchorDate) };
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
      originalIndex: number;
      createdAtTimestamp: number;
      createdAtDayTimestamp: number;
      numericOrderNumber: number;
      customerType: TypePriority | null;
      customerLabel: string;
      addressLabel: string;
      typeLabel: string;
      statusLabel: string;
      paymentLabel: string;
      searchBlob: string;
    }>();

    orders.forEach((order, index) => {
      const createdAtTimestamp = new Date(order.created_at).getTime();
      const createdAtDate = new Date(order.created_at);
      createdAtDate.setHours(0, 0, 0, 0);
      const customerLabel = order.organization_name || order.contact_name || '';
      const addressLabel = formatOrderAddress(order);
      const typeLabel = getCustomerTypeLabel(order.customer_type);
      const statusLabel = getOrderStatusLabelForUi(order.status);
      const paymentLabel = getPaymentLabel(order.payment_status);
      runtime.set(order.id, {
        originalIndex: index,
        createdAtTimestamp,
        createdAtDayTimestamp: createdAtDate.getTime(),
        numericOrderNumber: getNumericOrderNumber(order.order_number),
        customerType: order.customer_type === 'school' || order.customer_type === 'company' || order.customer_type === 'individual'
          ? (order.customer_type as TypePriority)
          : null,
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
    const normalizedQuery = normalizeForSearch(debouncedQuery);

    const filteredOrders = orders.filter((order) => {
      const mergedStatusValue = getMergedOrderStatusValue(order.status);

      if (statusFilter !== 'all' && mergedStatusValue !== statusFilter) {
        return false;
      }
      if (columnStatusFilter !== 'all' && mergedStatusValue !== columnStatusFilter) {
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
      if (columnPaymentFilter !== 'all' && (order.payment_status ?? '') !== columnPaymentFilter) {
        return false;
      }

      if (columnTypeFilter !== 'all' && orderRuntime?.customerType !== columnTypeFilter) {
        return false;
      }

      const totalValue = toAmount(order.total);
      const minTotal = totalRange.min.trim() ? Number(totalRange.min) : null;
      const maxTotal = totalRange.max.trim() ? Number(totalRange.max) : null;
      if (minTotal !== null && Number.isFinite(minTotal) && totalValue < minTotal) return false;
      if (maxTotal !== null && Number.isFinite(maxTotal) && totalValue > maxTotal) return false;

      const orderNumberNumeric = orderRuntime?.numericOrderNumber ?? getNumericOrderNumber(order.order_number);
      const minOrderNumber = orderNumberRange.min.trim() ? Number(orderNumberRange.min) : null;
      const maxOrderNumber = orderNumberRange.max.trim() ? Number(orderNumberRange.max) : null;
      if (minOrderNumber !== null && Number.isFinite(minOrderNumber) && orderNumberNumeric < minOrderNumber) return false;
      if (maxOrderNumber !== null && Number.isFinite(maxOrderNumber) && orderNumberNumeric > maxOrderNumber) return false;

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
      const leftRuntime = orderRuntimeById.get(leftOrder.id);
      const rightRuntime = orderRuntimeById.get(rightOrder.id);
      const leftOrderNumberNumeric = leftRuntime?.numericOrderNumber ?? getNumericOrderNumber(leftOrder.order_number);
      const rightOrderNumberNumeric = rightRuntime?.numericOrderNumber ?? getNumericOrderNumber(rightOrder.order_number);
      const fallbackStable = (leftRuntime?.originalIndex ?? 0) - (rightRuntime?.originalIndex ?? 0);

      if (!sortState) {
        return fallbackStable;
      }

      const descendingFirstColumns: SortableColumnKey[] = ['total'];
      const isDescending = descendingFirstColumns.includes(sortState.column) ? sortState.index === 0 : sortState.index === 1;
      const sortMultiplier = isDescending ? -1 : 1;
      if (sortState.column === 'type') {
        const firstType = TYPE_SORT_CYCLE[sortState.index];
        const deterministicTypeOrder = [firstType, ...TYPE_SORT_CYCLE.filter((type) => type !== firstType)];
        const priorityByType = new Map<TypePriority, number>(deterministicTypeOrder.map((type, index) => [type, index]));
        const leftTypePriority = priorityByType.get(leftRuntime?.customerType ?? 'individual') ?? Number.MAX_SAFE_INTEGER;
        const rightTypePriority = priorityByType.get(rightRuntime?.customerType ?? 'individual') ?? Number.MAX_SAFE_INTEGER;
        if (leftTypePriority !== rightTypePriority) {
          return leftTypePriority - rightTypePriority;
        }
        return fallbackStable;
      }

      let leftValue: string | number;
      let rightValue: string | number;

      switch (sortState.column) {
        case 'order':
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
        case 'status':
          leftValue = STATUS_SORT_PRIORITY[leftOrder.status] ?? Number.MAX_SAFE_INTEGER;
          rightValue = STATUS_SORT_PRIORITY[rightOrder.status] ?? Number.MAX_SAFE_INTEGER;
          break;
        case 'payment':
          leftValue = PAYMENT_SORT_PRIORITY[leftOrder.payment_status ?? ''] ?? Number.MAX_SAFE_INTEGER;
          rightValue = PAYMENT_SORT_PRIORITY[rightOrder.payment_status ?? ''] ?? Number.MAX_SAFE_INTEGER;
          break;
        case 'total':
          leftValue = toAmount(leftOrder.total);
          rightValue = toAmount(rightOrder.total);
          break;
        case 'date':
        default: {
          leftValue = leftRuntime?.createdAtDayTimestamp ?? 0;
          rightValue = rightRuntime?.createdAtDayTimestamp ?? 0;
          break;
        }
      }

      if (typeof leftValue === 'number' && typeof rightValue === 'number') {
        const primaryResult = (leftValue - rightValue) * sortMultiplier;
        if (primaryResult !== 0) return primaryResult;
        return fallbackStable;
      }

      const textResult = textCollator.compare(String(leftValue), String(rightValue)) * sortMultiplier;
      if (textResult !== 0) return textResult;
      return fallbackStable;
    });

    return sortedOrders;
  }, [
    orders,
    statusFilter,
    debouncedQuery,
    debouncedFromDate,
    debouncedToDate,
    documentType,
    columnStatusFilter,
    columnPaymentFilter,
    columnTypeFilter,
    totalRange,
    orderNumberRange,
    latestDocumentsByOrder,
    orderRuntimeById,
    sortState
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
  const hasSelectedRows = selectedCount > 0;
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
  }, [
    debouncedFromDate,
    debouncedQuery,
    debouncedToDate,
    documentType,
    isServerFilteredMode,
    setPage,
    sortState,
    statusFilter,
    columnStatusFilter,
    columnPaymentFilter,
    columnTypeFilter,
    totalRange,
    orderNumberRange,
    updateServerFilters
  ]);

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

  const getSortCycleLength = (column: SortableColumnKey) => {
    if (column === 'order' || column === 'date') return 1;
    if (column === 'type') return 3;
    return 2;
  };

  const onSort = (column: SortableColumnKey) => {
    setSortState((currentState) => {
      if (!currentState || currentState.column !== column) {
        return { column, index: 0 };
      }

      const nextIndex = currentState.index + 1;
      if (nextIndex >= getSortCycleLength(column)) {
        return null;
      }
      return { column, index: nextIndex };
    });
  };

  const toggleHeaderFilter = (filterKey: NonNullable<typeof openHeaderFilter>) => {
    setOpenHeaderFilter((currentOpenFilter) => (currentOpenFilter === filterKey ? null : filterKey));
  };

  const getHeaderPopoverStyle = useCallback((anchorElement: HTMLButtonElement | null, width: number): CSSProperties => {
    if (!anchorElement || typeof window === 'undefined') return { visibility: 'hidden' };
    const anchorRect = anchorElement.getBoundingClientRect();
    const left = Math.min(
      Math.max(8, anchorRect.left + anchorRect.width / 2 - width / 2),
      window.innerWidth - width - 8
    );

    return {
      position: 'fixed',
      top: anchorRect.bottom + 6,
      left,
      width,
      zIndex: 60
    };
  }, []);

  const resetAllFilters = () => {
    setStatusFilter('all');
    setQuery('');
    setFromDate('');
    setToDate('');
    setDocumentType('all');
    setColumnStatusFilter('all');
    setColumnPaymentFilter('all');
    setColumnTypeFilter('all');
    setTotalRange({ min: '', max: '' });
    setOrderNumberRange({ min: '', max: '' });
    setSortState(null);
    setHasExplicitDateFilter(false);
  };

  const hasActiveFilters =
    statusFilter !== 'all' ||
    query.trim().length > 0 ||
    fromDate.length > 0 ||
    toDate.length > 0 ||
    documentType !== 'all' ||
    columnStatusFilter !== 'all' ||
    columnPaymentFilter !== 'all' ||
    columnTypeFilter !== 'all' ||
    totalRange.min.trim().length > 0 ||
    totalRange.max.trim().length > 0 ||
    orderNumberRange.min.trim().length > 0 ||
    orderNumberRange.max.trim().length > 0 ||
    sortState !== null;

  const [filterChipOrder, setFilterChipOrder] = useState<Array<'date' | 'type' | 'status' | 'payment' | 'documents' | 'total' | 'orderNumber'>>([]);

  const hasDateChip = Boolean(hasExplicitDateFilter && (fromDate || toDate));
  const hasTypeChip = columnTypeFilter !== 'all';
  const hasStatusChip = columnStatusFilter !== 'all';
  const hasPaymentChip = columnPaymentFilter !== 'all';
  const hasDocumentsChip = documentType !== 'all';
  const hasTotalChip = Boolean(totalRange.min || totalRange.max);
  const hasOrderNumberChip = Boolean(orderNumberRange.min || orderNumberRange.max);

  useEffect(() => {
    setFilterChipOrder((currentOrder) => {
      let nextOrder = [...currentOrder];
      const states: Array<{ key: 'date' | 'type' | 'status' | 'payment' | 'documents' | 'total' | 'orderNumber'; active: boolean }> = [
        { key: 'date', active: hasDateChip },
        { key: 'type', active: hasTypeChip },
        { key: 'status', active: hasStatusChip },
        { key: 'payment', active: hasPaymentChip },
        { key: 'documents', active: hasDocumentsChip },
        { key: 'total', active: hasTotalChip },
        { key: 'orderNumber', active: hasOrderNumberChip }
      ];
      states.forEach(({ key, active }) => {
        const index = nextOrder.indexOf(key);
        if (active && index === -1) nextOrder.push(key);
        if (!active && index !== -1) nextOrder = nextOrder.filter((entry) => entry !== key);
      });
      return nextOrder;
    });
  }, [hasDateChip, hasTypeChip, hasStatusChip, hasPaymentChip, hasDocumentsChip, hasTotalChip, hasOrderNumberChip]);

  const activeFilterChips = useMemo(() => {
    const chipByKey: Record<string, { key: string; label: string; clear: () => void } | null> = {
      date: hasDateChip
        ? {
            key: 'date',
            label: `Datum: ${fromDate || '—'} - ${toDate || '—'}`,
            clear: () => {
              setFromDate('');
              setToDate('');
            }
          }
        : null,
      type: hasTypeChip
        ? {
            key: 'type',
            label: `Tip: ${getCustomerTypeLabel(columnTypeFilter)}`,
            clear: () => setColumnTypeFilter('all')
          }
        : null,
      status: hasStatusChip
        ? {
            key: 'status',
            label: `Status: ${ORDER_STATUS_OPTIONS.find((option) => option.value === columnStatusFilter)?.label ?? columnStatusFilter}`,
            clear: () => setColumnStatusFilter('all')
          }
        : null,
      payment: hasPaymentChip
        ? {
            key: 'payment',
            label: `Plačilo: ${PAYMENT_STATUS_OPTIONS.find((option) => option.value === columnPaymentFilter)?.label ?? columnPaymentFilter}`,
            clear: () => setColumnPaymentFilter('all')
          }
        : null,
      documents: hasDocumentsChip
        ? {
            key: 'documents',
            label: `Dokumenti: ${documentTypeOptions.find((option) => option.value === documentType)?.label ?? documentType}`,
            clear: () => setDocumentType('all')
          }
        : null,
      total: hasTotalChip
        ? {
            key: 'total',
            label: `Skupaj: ${totalRange.min || '0'} - ${totalRange.max || '∞'}`,
            clear: () => setTotalRange({ min: '', max: '' })
          }
        : null,
      orderNumber: hasOrderNumberChip
        ? {
            key: 'orderNumber',
            label: `Naročila: #${orderNumberRange.min || '0'} – #${orderNumberRange.max || '∞'}`,
            clear: () => setOrderNumberRange({ min: '', max: '' })
          }
        : null
    };

    return filterChipOrder.map((key) => chipByKey[key]).filter((chip): chip is { key: string; label: string; clear: () => void } => Boolean(chip));
  }, [hasDateChip, hasTypeChip, hasStatusChip, hasPaymentChip, hasDocumentsChip, hasTotalChip, hasOrderNumberChip, fromDate, toDate, columnTypeFilter, columnStatusFilter, columnPaymentFilter, documentType, totalRange.min, totalRange.max, orderNumberRange.min, orderNumberRange.max, filterChipOrder]);

  const getHeaderTitleClass = (column: SortableColumnKey) =>
    `${HEADER_TITLE_BUTTON_CLASS} ${sortState?.column === column ? 'underline underline-offset-2' : ''}`;

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
            background: '#ffffff',
            borderColor: analyticsAppearance?.gridColor ?? '#e2e8f0',
            boxShadow: '0 10px 24px rgba(15,23,42,0.06)'
          }}
          contentClassName="overflow-x-auto bg-white"
          headerClassName="bg-white"
          showDivider={false}
          headerLeft={
            <AdminSearchInput
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Poišči naročila"
              className="h-7 min-w-[280px] flex-1 rounded-xl border-slate-200 bg-white pl-10 pr-3 text-sm"
            />
          }
          headerRight={
            <>
              <div className="flex items-center gap-2 pb-1">
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
                  onToggle={(key) => {
                    if (key === 'order') return;
                    setVisibleColumns((current) => ({ ...current, [key]: !current[key as OrdersColumnKey] }));
                  }}
                  showLabel={false}
                  className="[&>button]:!h-7 [&>button]:!w-7 [&>button]:!rounded-md [&>button]:!border-slate-200 [&>button]:!bg-transparent [&>button]:!px-0 [&>button]:!text-slate-600 [&>button]:hover:!border-slate-300 [&>button]:hover:!bg-[color:var(--hover-neutral)] [&>button]:hover:!text-slate-700"
                  icon={<FilterIcon />}
                  menuClassName="!w-44"
                />
                <IconButton
                  type="button"
                  onClick={handleDelete}
                  disabled={!hasSelectedRows || isDeleting}
                  tone={hasSelectedRows ? 'danger' : 'neutral'}
                  size="sm"
                  aria-label="Izbriši izbrana naročila"
                  title="Izbriši"
                >
                  {isDeleting ? (
                    <Spinner size="sm" className="text-[var(--danger-600)]" />
                  ) : (
                    <TrashCanIcon />
                  )}
                </IconButton>
                {topAction ? <div className="flex items-center [&_button]:!h-7 [&_button]:!rounded-xl">{topAction}</div> : null}
              </div>
            </>
          }
          filterRowLeft={
            activeFilterChips.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                {activeFilterChips.map((chip) => (
                  <span key={chip.key} className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-[color:var(--ui-neutral-bg)] px-3 py-1 text-xs text-slate-700">
                    {chip.label}
                    <button type="button" onClick={chip.clear} className="text-slate-500 hover:text-slate-800" aria-label={`Odstrani filter ${chip.label}`}>×</button>
                  </span>
                ))}
              </div>
            ) : null
          }
          filterRowRight={
            <div className="flex items-center gap-2">
              <PageSizeSelect value={pageSize} options={PAGE_SIZE_OPTIONS} onChange={handlePageSizeChange} />
              <Pagination page={page} pageCount={pageCount} onPageChange={handlePageChange} variant="topPills" size="sm" showNumbers={false} />
            </div>
          }
          footerRight={null}
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
                  <div className="flex h-full items-center justify-center">
                    <input
                      type="checkbox"
                      ref={selectAllRef}
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="Izberi vse"
                    />
                  </div>
                </TH>

                {visibleColumns.order ? <TH className="h-11 text-center">
                  <div className="relative inline-flex items-center gap-1.5 align-middle" data-header-filter-root="true">
                    <button type="button" onClick={() => onSort('order')} className={getHeaderTitleClass('order')}>Naročilo</button>
                    <button ref={orderFilterButtonRef} data-active={openHeaderFilter === 'order'} type="button" onClick={(event) => { event.stopPropagation(); toggleHeaderFilter('order'); }} className={HEADER_FILTER_BUTTON_CLASS} aria-label="Filtriraj Naročilo">
                      <FunnelIcon />
                    </button>
                  </div>
                </TH> : null}

                {visibleColumns.date ? <TH className="h-11 text-center text-[11px]">
                  <div className="relative inline-flex items-center gap-1.5 align-middle" data-header-filter-root="true">
                    <button type="button" onClick={() => onSort('date')} className={getHeaderTitleClass('date')}>Datum</button>
                    <button ref={dateFilterButtonRef} data-active={openHeaderFilter === 'date'} type="button" onClick={(event) => { event.stopPropagation(); toggleHeaderFilter('date'); }} className={HEADER_FILTER_BUTTON_CLASS} aria-label="Filtriraj Datum">
                      <FunnelIcon />
                    </button>
                  </div>
                </TH> : null}

                {visibleColumns.customer ? <TH className="text-[11px]"><button type="button" onClick={() => onSort('customer')} className={getHeaderTitleClass('customer')}>Naročnik</button></TH> : null}

                {visibleColumns.address ? <TH className="text-[11px]"><button type="button" onClick={() => onSort('address')} className={getHeaderTitleClass('address')}>Naslov</button></TH> : null}

                {visibleColumns.type ? <TH className="h-11 text-center text-[11px]">
                  <div className="relative inline-flex items-center gap-1.5 align-middle" data-header-filter-root="true">
                    <button type="button" onClick={() => onSort('type')} className={getHeaderTitleClass('type')}>Tip</button>
                    <button ref={typeFilterButtonRef} data-active={openHeaderFilter === 'type'} type="button" onClick={(event) => { event.stopPropagation(); toggleHeaderFilter('type'); }} className={HEADER_FILTER_BUTTON_CLASS} aria-label="Filtriraj Tip"><FunnelIcon /></button>
                  </div>
                </TH> : null}

                {visibleColumns.status ? <TH className="h-11 text-center text-[11px]">
                  <div className="relative inline-flex items-center gap-1.5 align-middle" ref={statusHeaderMenuRef}>
                    {selectedCount > 0 ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setIsStatusHeaderMenuOpen((previousOpen) => !previousOpen)}
                          disabled={isBulkUpdatingStatus}
                        className="inline-flex items-center rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold leading-none text-slate-700 hover:bg-[color:var(--hover-neutral)] disabled:cursor-default disabled:text-slate-300"
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
                      <div className="relative inline-flex items-center gap-1.5 align-middle" data-header-filter-root="true">
                        <button type="button" onClick={() => onSort('status')} className={getHeaderTitleClass('status')}>Status</button>
                        <button ref={statusFilterButtonRef} data-active={openHeaderFilter === 'status'} type="button" onClick={(event) => { event.stopPropagation(); toggleHeaderFilter('status'); }} className={HEADER_FILTER_BUTTON_CLASS} aria-label="Filtriraj Status"><FunnelIcon /></button>
                      </div>
                    )}
                  </div>
                </TH> : null}

                {visibleColumns.payment ? <TH className="h-11 text-center text-[11px]">
                  <div className="relative inline-flex items-center gap-1.5 align-middle" ref={paymentHeaderMenuRef}>
                    {selectedCount > 0 ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setIsPaymentHeaderMenuOpen((previousOpen) => !previousOpen)}
                          disabled={isBulkUpdatingStatus}
                        className="inline-flex items-center rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold leading-none text-slate-700 hover:bg-[color:var(--hover-neutral)] disabled:cursor-default disabled:text-slate-300"
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
                      <div className="relative inline-flex items-center gap-1.5 align-middle" data-header-filter-root="true">
                        <button type="button" onClick={() => onSort('payment')} className={getHeaderTitleClass('payment')}>Plačilo</button>
                        <button ref={paymentFilterButtonRef} data-active={openHeaderFilter === 'payment'} type="button" onClick={(event) => { event.stopPropagation(); toggleHeaderFilter('payment'); }} className={HEADER_FILTER_BUTTON_CLASS} aria-label="Filtriraj Plačilo"><FunnelIcon /></button>
                      </div>
                    )}
                  </div>
                </TH> : null}

                {visibleColumns.total ? <TH className="h-11 text-center text-[11px]">
                  <div className="relative inline-flex items-center gap-1.5 align-middle" data-header-filter-root="true">
                    <button type="button" onClick={() => onSort('total')} className={getHeaderTitleClass('total')}>Skupaj</button>
                    <button ref={totalFilterButtonRef} data-active={openHeaderFilter === 'total'} type="button" onClick={(event) => { event.stopPropagation(); toggleHeaderFilter('total'); }} className={HEADER_FILTER_BUTTON_CLASS} aria-label="Filtriraj Skupaj"><FunnelIcon /></button>
                  </div>
                </TH> : null}

                {visibleColumns.documents ? <TH className="h-11 min-w-[100px] text-center text-[11px]">
                  <div className="relative inline-flex items-center gap-1.5 align-middle" data-header-filter-root="true">
                    <span className="inline-flex items-center text-[11px] font-semibold leading-none">PDF datoteke</span>
                    <button ref={documentsFilterButtonRef} data-active={openHeaderFilter === 'documents'} type="button" onClick={(event) => { event.stopPropagation(); toggleHeaderFilter('documents'); }} className={HEADER_FILTER_BUTTON_CLASS} aria-label="Filtriraj PDF datoteke"><FunnelIcon /></button>
                  </div>
                </TH> : null}
                <TH className="h-11 text-center text-[11px]">
                  <span className="inline-flex items-center text-[11px] font-semibold leading-none text-slate-700">Uredi</span>
                </TH>
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
                            className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-[color:var(--blue-500)] hover:bg-[color:var(--hover-neutral)]"
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
                      className={`border-t border-slate-100 bg-white text-[11px] transition-colors duration-200 ${
                        isRowSelected ? adminTableRowToneClasses.selected : ''
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
                        <RowActions className="relative">
                          <RowActionsDropdown
                            label={`Možnosti za naročilo ${toDisplayOrderNumber(order.order_number)}`}
                            items={[
                              {
                                key: 'edit',
                                label: 'Uredi',
                                icon: <PencilIcon />,
                                onSelect: () => {
                                  router.push(`/admin/orders/${order.id}`);
                                }
                              },
                              {
                                key: 'delete',
                                label: 'Izbriši',
                                icon: deletingRowId === order.id ? <Spinner size="sm" className="text-[var(--danger-600)]" /> : <TrashCanIcon />,
                                className: 'text-[rgb(192,64,46)]',
                                disabled: deletingRowId === order.id,
                                onSelect: () => {
                                  void handleDeleteRow(order.id);
                                }
                              }
                            ]}
                          />
                        </RowActions>
                      </TD>
                    </TR>
                  );
                })
              )}
            </TBody>
          </Table>
        </AdminTableLayout>
        {typeof window !== 'undefined' && openHeaderFilter ? createPortal(
          <div data-header-filter-root="true">
            {openHeaderFilter === 'order' ? (
              <div style={getHeaderPopoverStyle(orderFilterButtonRef.current, 192)} className="rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                <h4 className="mb-2 text-[11px] font-semibold text-slate-800">Nastavi razpon naročil</h4>
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" placeholder="Od" value={draftOrderNumberRange.min} onChange={(event) => setDraftOrderNumberRange((current) => ({ ...current, min: event.target.value }))} className={COMPACT_FILTER_INPUT_CLASS} />
                  <input type="number" placeholder="Do" value={draftOrderNumberRange.max} onChange={(event) => setDraftOrderNumberRange((current) => ({ ...current, max: event.target.value }))} className={COMPACT_FILTER_INPUT_CLASS} />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button type="button" className="rounded-xl bg-[color:var(--blue-500)] py-2 text-[11px] font-semibold text-white" onClick={() => { setOrderNumberRange(draftOrderNumberRange); setOpenHeaderFilter(null); }}>Potrdi</button>
                  <button type="button" className="rounded-xl border border-slate-300 bg-[color:var(--ui-neutral-bg)] py-2 text-[11px] font-semibold text-slate-700 hover:bg-[color:var(--ui-neutral-bg-hover)]" onClick={() => { const emptyRange = { min: '', max: '' }; setDraftOrderNumberRange(emptyRange); setOrderNumberRange(emptyRange); setOpenHeaderFilter(null); }}>Ponastavi</button>
                </div>
              </div>
            ) : null}
            {openHeaderFilter === 'date' ? (
              <div lang="sl-SI" style={getHeaderPopoverStyle(dateFilterButtonRef.current, 380)} className="rounded-xl border border-slate-200 bg-white p-3 text-left shadow-lg">
                <h4 className="mb-2 text-[11px] font-semibold text-slate-800">Nastavi obdobje</h4>
                <div className="mb-3 grid grid-cols-3 gap-2">
                    {[
                    { key: '7d', label: 'Zadnjih 7d' },
                    { key: '30d', label: 'Zadnjih 30d' },
                    { key: '90d', label: 'Zadnjih 90d' },
                    { key: '180d', label: 'Zadnjih 180d' },
                    { key: '365d', label: 'Zadnjih 365d' },
                    { key: 'ytd', label: 'Letos' }
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        const quickRange = applyQuickDateRange(item.key as '7d' | '30d' | '90d' | '180d' | '365d' | 'ytd');
                        setDraftFromDate(quickRange.from);
                        setDraftToDate(quickRange.to);
                      }}
                      className="rounded-full border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-800 hover:bg-[color:var(--hover-neutral)]"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <div className="mb-3 border-t border-slate-200 pt-3">
                  <div className="grid grid-cols-2 gap-2">
                    <input type="date" lang="sl-SI" value={draftFromDate} onChange={(event) => setDraftFromDate(event.target.value)} className={COMPACT_FILTER_INPUT_CLASS} aria-label="Od" />
                    <input type="date" lang="sl-SI" value={draftToDate} onChange={(event) => setDraftToDate(event.target.value)} className={COMPACT_FILTER_INPUT_CLASS} aria-label="Do" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" className="rounded-xl bg-[color:var(--blue-500)] py-2 text-[11px] font-semibold text-white" onClick={() => { setFromDate(draftFromDate); setToDate(draftToDate); setHasExplicitDateFilter(Boolean(draftFromDate || draftToDate)); setOpenHeaderFilter(null); }}>Potrdi</button>
                  <button type="button" className="rounded-xl border border-slate-300 bg-[color:var(--ui-neutral-bg)] py-2 text-[11px] font-semibold text-slate-700 hover:bg-[color:var(--ui-neutral-bg-hover)]" onClick={() => { setDraftFromDate(''); setDraftToDate(''); setFromDate(''); setToDate(''); setHasExplicitDateFilter(false); setOpenHeaderFilter(null); }}>Ponastavi</button>
                </div>
              </div>
            ) : null}
            {openHeaderFilter === 'type' ? (
              <div style={getHeaderPopoverStyle(typeFilterButtonRef.current, 144)}>
                <MenuPanel className="shadow-lg">
                  {[
                    { value: 'all', label: 'Vsi' },
                    { value: 'school', label: 'Šola' },
                    { value: 'company', label: 'Podjetje' },
                    { value: 'individual', label: 'Fiz. oseba' }
                  ].map((option) => <MenuItem key={option.value} onClick={() => { setColumnTypeFilter(option.value as any); setOpenHeaderFilter(null); }}>{option.label}</MenuItem>)}
                </MenuPanel>
              </div>
            ) : null}
            {openHeaderFilter === 'status' ? (
              <div style={getHeaderPopoverStyle(statusFilterButtonRef.current, 160)}>
                <MenuPanel className="shadow-lg">
                  {[{ value: 'all', label: 'Vsi' } as const, ...ORDER_STATUS_OPTIONS].map((option) => (
                    <MenuItem key={option.value} onClick={() => { setColumnStatusFilter(option.value as StatusTab); setOpenHeaderFilter(null); }}>
                      {option.label}
                    </MenuItem>
                  ))}
                </MenuPanel>
              </div>
            ) : null}
            {openHeaderFilter === 'payment' ? (
              <div style={getHeaderPopoverStyle(paymentFilterButtonRef.current, 160)}>
                <MenuPanel className="shadow-lg">
                  {[{ value: 'all', label: 'Vsa' }, ...PAYMENT_STATUS_OPTIONS].map((option) => (
                    <MenuItem key={option.value} onClick={() => { setColumnPaymentFilter(option.value as any); setOpenHeaderFilter(null); }}>{option.label}</MenuItem>
                  ))}
                </MenuPanel>
              </div>
            ) : null}
            {openHeaderFilter === 'total' ? (
              <div style={getHeaderPopoverStyle(totalFilterButtonRef.current, 192)} className="rounded-xl border border-slate-200 bg-white p-2 text-left shadow-lg">
                <h4 className="mb-2 text-[11px] font-semibold text-slate-800">Nastavi razpon zneskov</h4>
                <div className="mb-3 grid grid-cols-3 gap-1">
                  {['20', '50', '100', '200', '500', '1000'].map((maxValue) => (
                    <button key={maxValue} type="button" onClick={() => setDraftTotalRange({ min: '0', max: maxValue })} className="rounded-full border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-800 hover:bg-[color:var(--hover-neutral)]">{`0-${maxValue === '1000' ? '1k' : maxValue}`}</button>
                  ))}
                </div>
                <div className="mb-3 border-t border-slate-200 pt-3">
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" placeholder="Od" value={draftTotalRange.min} onChange={(event) => setDraftTotalRange((current) => ({ ...current, min: event.target.value }))} className={COMPACT_FILTER_INPUT_CLASS} />
                    <input type="number" placeholder="Do" value={draftTotalRange.max} onChange={(event) => setDraftTotalRange((current) => ({ ...current, max: event.target.value }))} className={COMPACT_FILTER_INPUT_CLASS} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" className="rounded-xl bg-[color:var(--blue-500)] py-2 text-[11px] font-semibold text-white" onClick={() => { setTotalRange(draftTotalRange); setOpenHeaderFilter(null); }}>Potrdi</button>
                  <button type="button" className="rounded-xl border border-slate-300 bg-[color:var(--ui-neutral-bg)] py-2 text-[11px] font-semibold text-slate-700 hover:bg-[color:var(--ui-neutral-bg-hover)]" onClick={() => { setDraftTotalRange({ min: '', max: '' }); setTotalRange({ min: '', max: '' }); setOpenHeaderFilter(null); }}>Ponastavi</button>
                </div>
              </div>
            ) : null}
            {openHeaderFilter === 'documents' ? (
              <div style={getHeaderPopoverStyle(documentsFilterButtonRef.current, 160)}>
                <MenuPanel className="shadow-lg">
                  {documentTypeOptions.map((option) => <MenuItem key={option.value} onClick={() => { setDocumentType(option.value); setOpenHeaderFilter(null); }}>{option.label}</MenuItem>)}
                </MenuPanel>
              </div>
            ) : null}
          </div>,
          document.body
        ) : null}
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

function FunnelIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="block h-[12px] w-[12px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path className="fill-transparent transition-colors duration-150 group-hover:fill-current group-data-[active=true]:fill-current" d="M3 4h14l-5.5 6.2V16L8.5 13v-2.8L3 4Z" />
    </svg>
  );
}
