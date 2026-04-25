'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { IconButton } from '@/shared/ui/icon-button';
import { AdminSearchInput } from '@/shared/ui/admin-search-input';
import { MenuItem, MenuPanel } from '@/shared/ui/menu';
import { Spinner } from '@/shared/ui/loading';
import { EuiTablePagination, useTablePagination } from '@/shared/ui/pagination';
import {
  CheckIcon,
  CloseIcon,
  ColumnFilterIcon,
  DownloadIcon,
  OpenArticleIcon,
  PanelAddRemoveIcon,
  PencilIcon,
  TrashCanIcon
} from '@/shared/ui/icons/AdminActionIcons';
import { useToast } from '@/shared/ui/toast';
import { EmptyState, RowActions, RowActionsDropdown, Table, TBody, TD, THead, TH, TR } from '@/shared/ui/table';
import { AdminCheckbox } from '@/shared/ui/checkbox';
import { Input } from '@/shared/ui/input';
import {
  adminStatusInfoPillTableCellClassName,
  adminTableRowToneClasses,
  adminTextButtonTypographyTokenClasses,
  filterPillTokenClasses
} from '@/shared/ui/theme/tokens';
import {
  adminTableCardClassName,
  adminTableCardStyle,
  adminTableBulkHeaderButtonClassName,
  adminTableCompactPopoverPanelClassName,
  adminTableContentClassName,
  adminTableHeaderButtonClassName,
  adminTableHeaderClassName,
  adminTableHeaderTextClassName,
  adminTableInlineActionRowClassName,
  adminTableInlineCancelButtonClassName,
  adminTableInlineCancelIconClassName,
  adminTableInlineConfirmButtonClassName,
  adminTableInlineConfirmIconClassName,
  adminTableNeutralIconButtonClassName,
  adminTablePopoverPanelClassName,
  adminTablePopoverPrimaryButtonClassName,
  adminTablePopoverSecondaryButtonClassName,
  adminTableSearchIconClassName,
  adminTableSearchInputClassName,
  adminTableSearchWrapperClassName,
  adminTableSelectedDangerIconButtonClassName,
  adminTableToolbarActionsClassName,
  adminTableToolbarGroupClassName,
  AdminTableLayout,
  ColumnVisibilityControl
} from '@/shared/ui/admin-table';
import AdminRangeFilterPanel, { type RangePreset } from '@/shared/ui/admin-range-filter-panel';
import AdminFilterInput from '@/shared/ui/admin-filter-input';
import {
  HeaderFilterPortal,
  HEADER_FILTER_BUTTON_CLASS,
  HEADER_FILTER_ROOT_ATTR,
  getHeaderPopoverStyle,
  useHeaderFilterDismiss
} from '@/shared/ui/admin-header-filter';
import StatusChip from '@/admin/components/StatusChip';
import PaymentChip from '@/admin/components/PaymentChip';
import { CustomSelect } from '@/shared/ui/select';
import { CUSTOMER_TYPE_FORM_OPTIONS, getCustomerTypeLabel, type CustomerType } from '@/shared/domain/order/customerType';
import { ORDER_STATUS_OPTIONS, getStatusMenuItemClassName } from '@/shared/domain/order/orderStatus';
import { formatSlDate, formatSlDateTime } from '@/shared/domain/order/dateTime';
import { PAYMENT_STATUS_OPTIONS, getPaymentLabel, getPaymentMenuItemClassName, isPaymentStatus, type PaymentStatus } from '@/shared/domain/order/paymentStatus';
import type { AnalyticsGlobalAppearance } from '@/shared/server/analyticsCharts';

import {
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
  deliveryAddress: string | null,
  reference: string | null,
  notes: string | null,
  status: string,
  paymentStatus: string | null,
  adminOrderNotes: string | null,
  subtotal: number | string | null,
  tax: number | string | null,
  total: number | string | null,
  createdAt: string,
  isDraft: boolean,
  deletedAt?: string | null
];
type PdfDocTuple = readonly [id: number, orderId: number, type: PdfDoc['type'], filename: string, blobUrl: string, createdAt: string];
type OrderQuickEditState = {
  orderId: number;
  draftOrderNumber: string;
  initialOrderNumber: string;
  draftOrderDate: string;
  initialOrderDate: string;
  draftCustomerName: string;
  initialCustomerName: string;
  draftAddress: string;
  initialAddress: string;
  draftCustomerType: string;
  initialCustomerType: string;
  draftStatus: string;
  initialStatus: string;
  draftPaymentStatus: string;
  initialPaymentStatus: string;
  email: string;
  contactName: string;
  organizationName: string | null;
  reference: string | null;
  notes: string | null;
  postalCode: string | null;
  isSaving: boolean;
};

type OrdersRangePreset = '7d' | '1m' | '3m' | '6m' | '1y' | 'ytd' | 'max' | 'custom';
type OrdersQuickDateRange = '7d' | '30d' | '90d' | '180d' | '365d' | 'ytd';
type OrdersColumnKey = 'order' | 'date' | 'customer' | 'address' | 'type' | 'status' | 'payment' | 'total' | 'documents';
type SortableColumnKey = 'order' | 'date' | 'customer' | 'address' | 'status' | 'payment' | 'total' | 'type';
type TypePriority = CustomerType;
type ColumnTypeFilter = 'all' | TypePriority;
type ColumnPaymentFilter = 'all' | PaymentStatus;
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
const HEADER_TITLE_BUTTON_CLASS = adminTableHeaderButtonClassName;
const ORDERS_NUMERIC_RANGE_PRESETS: RangePreset[] = ['20', '50', '100', '200', '500', '1000'].map((maxValue) => ({
  label: `0-${maxValue === '1000' ? '1k' : maxValue}`,
  value: { min: '0', max: maxValue }
}));
const ORDERS_QUICK_DATE_RANGE_OPTIONS: Array<{
  key: OrdersQuickDateRange;
  label: string;
  value: string;
  unit?: string;
}> = [
  { key: '7d', label: 'Zadnjih 7 dni', value: '7', unit: 'dni' },
  { key: '30d', label: 'Zadnjih 30 dni', value: '30', unit: 'dni' },
  { key: '90d', label: 'Zadnjih 90 dni', value: '90', unit: 'dni' },
  { key: '180d', label: 'Zadnjih 180 dni', value: '180', unit: 'dni' },
  { key: '365d', label: 'Zadnje leto', value: '1', unit: 'leto' },
  { key: 'ytd', label: 'Letos', value: 'Letos' }
];
const ORDERS_DATE_PRESET_BUTTON_CLASS =
  "inline-flex h-8 items-center justify-center gap-1 rounded-md border border-slate-200 bg-slate-50/80 px-2.5 font-['Inter',system-ui,sans-serif] text-slate-600 transition-colors hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 focus:border-[#3e67d6] focus:outline-none focus:ring-0 focus-visible:border-[#3e67d6] focus-visible:outline-none focus-visible:ring-0";
const ORDERS_DATE_PRESET_VALUE_CLASS =
  "font-['Inter',system-ui,sans-serif] text-[12px] font-semibold leading-none text-slate-800";
const ORDERS_DATE_PRESET_UNIT_CLASS =
  "font-['Inter',system-ui,sans-serif] text-[10px] font-medium leading-none text-slate-500";
const ORDER_CUSTOMER_TYPE_ROW_OPTIONS = CUSTOMER_TYPE_FORM_OPTIONS.map((option) => ({
  value: option.value,
  label: getCustomerTypeLabel(option.value)
}));
const ORDERS_HEADER_CELL_BASE_CLASS = 'h-11 border-b border-slate-200 px-3 py-0 align-middle text-[12px] font-semibold text-slate-700';
const ORDERS_HEADER_CELL_CENTER_CLASS = `${ORDERS_HEADER_CELL_BASE_CLASS} text-center`;
const ORDERS_HEADER_CELL_LEFT_CLASS = `${ORDERS_HEADER_CELL_BASE_CLASS} text-left`;
const ORDERS_HEADER_CONTENT_CLASS = 'relative inline-flex h-11 items-center gap-1.5 align-middle';
const ORDERS_BODY_CELL_BASE_CLASS = 'h-12 px-3 py-0 align-middle text-[12px] text-slate-700';
const ORDERS_BODY_CELL_CENTER_CLASS = `${ORDERS_BODY_CELL_BASE_CLASS} text-center`;
const ORDERS_STATUS_INFO_HEADER_CELL_CLASS =
  `${ORDERS_HEADER_CELL_BASE_CLASS} ${adminStatusInfoPillTableCellClassName}`;
const ORDERS_STATUS_INFO_BODY_CELL_CLASS =
  `${ORDERS_BODY_CELL_BASE_CLASS} ${adminStatusInfoPillTableCellClassName}`;
const ORDERS_ROW_CLASS = 'h-12 border-t border-slate-200/90 bg-white text-[12px] transition-colors duration-200';
const ORDERS_INLINE_CONTROL_FRAME_CLASS = 'mx-auto flex h-7 w-full items-center justify-center';
const ORDERS_INLINE_SELECT_TRIGGER_CLASS =
  '!h-7 !rounded-md !border-slate-300 !bg-white !px-2 !py-0 !text-[12px] !leading-none !text-slate-700';
const ORDERS_BULK_HEADER_BUTTON_CLASS = adminTableBulkHeaderButtonClassName;
const ORDERS_INLINE_TEXT_INPUT_CLASS =
  'h-7 !rounded-md border-slate-300 bg-white px-2 text-[12px] text-slate-900';
const ORDERS_ORDER_INPUT_CLASS = `${ORDERS_INLINE_TEXT_INPUT_CLASS} !w-[52px] !text-center font-semibold`;
const ORDERS_DATE_INPUT_CLASS = `${ORDERS_INLINE_TEXT_INPUT_CLASS} admin-orders-date-input !w-[100px] !max-w-[100px] !pl-2 !pr-[3px] !font-normal`;
const ORDERS_TEXT_INPUT_FULL_CLASS = `${ORDERS_INLINE_TEXT_INPUT_CLASS} !w-full !font-normal`;
const ORDERS_TYPE_SELECT_TRIGGER_CLASS = `${ORDERS_INLINE_SELECT_TRIGGER_CLASS} !min-w-[82px] !font-normal`;
const ORDERS_EMPHASIZED_VALUE_CLASS = 'font-semibold text-slate-900';
const ORDERS_STANDARD_VALUE_CLASS = 'font-normal text-slate-700';
const DATE_DISPLAY_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/;

type InlineChipSelectOption<Value extends string> = {
  value: Value;
  label: string;
};

function OrdersInlineChipSelect<Value extends string>({
  value,
  options,
  disabled = false,
  ariaLabel,
  menuWidth = 144,
  optionClassName,
  onChange,
  children
}: {
  value: Value;
  options: readonly InlineChipSelectOption<Value>[];
  disabled?: boolean;
  ariaLabel: string;
  menuWidth?: number;
  optionClassName?: (value: Value) => string;
  onChange: (next: Value) => void;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updateMenuPosition = useCallback(() => {
    if (!triggerRef.current || typeof window === 'undefined') return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const resolvedWidth = Math.max(menuWidth, triggerRect.width, menuRef.current?.offsetWidth ?? 0);
    const resolvedHeight = menuRef.current?.offsetHeight ?? 0;
    const left = Math.min(
      Math.max(8, triggerRect.left + triggerRect.width / 2 - resolvedWidth / 2),
      window.innerWidth - resolvedWidth - 8
    );
    const belowTop = triggerRect.bottom + 6;
    const aboveTop = Math.max(8, triggerRect.top - resolvedHeight - 6);
    const top =
      resolvedHeight > 0 && belowTop + resolvedHeight + 8 > window.innerHeight && aboveTop >= 8
        ? aboveTop
        : belowTop;

    setMenuPosition({ top, left, width: resolvedWidth });
  }, [menuWidth]);

  useEffect(() => {
    if (!isOpen) return;

    updateMenuPosition();
    const frameId = window.requestAnimationFrame(() => updateMenuPosition());

    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setIsOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const handleWindowChange = () => updateMenuPosition();

    document.addEventListener('mousedown', handleDocumentClick);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', handleWindowChange);
    window.addEventListener('scroll', handleWindowChange, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      document.removeEventListener('mousedown', handleDocumentClick);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', handleWindowChange);
      window.removeEventListener('scroll', handleWindowChange, true);
    };
  }, [isOpen, updateMenuPosition]);

  useEffect(() => {
    if (!disabled) return;
    setIsOpen(false);
  }, [disabled]);

  return (
    <div ref={rootRef} className="relative inline-flex max-w-full items-center justify-center">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setIsOpen((current) => !current);
        }}
        className="relative inline-flex max-w-full items-center justify-center rounded-md focus:outline-none"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <span className="block">{children}</span>
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-slate-500">▾</span>
      </button>

      {isOpen && menuPosition && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              className="fixed z-[1100]"
              style={{ top: menuPosition.top, left: menuPosition.left, width: menuPosition.width }}
            >
              <MenuPanel className="w-full">
                {options.map((option) => (
                  <MenuItem
                    key={option.value}
                    isActive={option.value === value}
                    className={optionClassName?.(option.value)}
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                  >
                    {option.label}
                  </MenuItem>
                ))}
              </MenuPanel>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

const toEditableOrderNumber = (value: string) => value.trim().replace(/^#/, '');
const toDisplayOrderNumberValue = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '#';
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
};
const toApiOrderDate = (value: string) => {
  const trimmed = value.trim();
  const displayMatch = DATE_DISPLAY_PATTERN.exec(trimmed);
  if (displayMatch) {
    const [, day, month, year] = displayMatch;
    const isoCandidate = `${year}-${month}-${day}`;
    const parsed = new Date(`${isoCandidate}T00:00:00`);
    if (!Number.isNaN(parsed.getTime()) && parsed.getUTCFullYear() === Number(year) && parsed.getUTCMonth() + 1 === Number(month) && parsed.getUTCDate() === Number(day)) {
      return isoCandidate;
    }
    return '';
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return '';
};
const formatDateForRangeChip = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '—';
  const [year, month, day] = trimmed.split('-');
  if (!year || !month || !day) return trimmed;
  return `${day}.${month}.${year}`;
};
const AdminOrdersPreviewChart = dynamic(() => import('@/admin/components/AdminOrdersPreviewChart'), { ssr: false });
const LazyAdminOrdersPdfCell = dynamic(() => import('@/admin/components/AdminOrdersPdfCell'), {
  ssr: false,
  loading: () => (
    <button
      type="button"
      disabled
      className={`inline-flex h-8 min-w-[72px] items-center justify-center rounded-md border border-slate-300 bg-slate-100 px-2 text-slate-500 ${adminTextButtonTypographyTokenClasses}`}
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
  analyticsOrders: serializedAnalyticsOrders,
  documents: serializedDocuments,
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
  analyticsOrders?: ReadonlyArray<Readonly<OrderRowTuple>>;
  documents: ReadonlyArray<PdfDocTuple>;
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
        delivery_address: row[6] ?? '',
        reference: row[7] ?? '',
        notes: row[8],
        status: row[9],
        payment_status: row[10],
        admin_order_notes: row[11],
        subtotal: row[12] ?? 0,
        tax: row[13] ?? 0,
        total: row[14] ?? 0,
        created_at: row[15],
        is_draft: row[16],
        deleted_at: row[17] ?? null
      })),
    [serializedOrders]
  );
  const analyticsOrders = useMemo<OrderRow[]>(
    () =>
      (serializedAnalyticsOrders ?? serializedOrders).map((row) => ({
        id: row[0],
        order_number: row[1],
        customer_type: row[2],
        organization_name: row[3] ?? '',
        contact_name: row[4],
        email: row[5],
        delivery_address: row[6] ?? '',
        reference: row[7] ?? '',
        notes: row[8],
        status: row[9],
        payment_status: row[10],
        admin_order_notes: row[11],
        subtotal: row[12] ?? 0,
        tax: row[13] ?? 0,
        total: row[14] ?? 0,
        created_at: row[15],
        is_draft: row[16],
        deleted_at: row[17] ?? null
      })),
    [serializedAnalyticsOrders, serializedOrders]
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
  const router = useRouter();
  const pathname = usePathname();
  const isServerFilteredMode = typeof totalCount === 'number';
  const [selected, setSelected] = useState<number[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingRowId, setDeletingRowId] = useState<number | null>(null);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [confirmDeleteRowId, setConfirmDeleteRowId] = useState<number | null>(null);
  const [isBulkUpdatingStatus, setIsBulkUpdatingStatus] = useState(false);
  const [quickEdit, setQuickEdit] = useState<OrderQuickEditState | null>(null);

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
  const [columnPaymentFilter, setColumnPaymentFilter] = useState<ColumnPaymentFilter>('all');
  const [columnTypeFilter, setColumnTypeFilter] = useState<ColumnTypeFilter>('all');
  const [totalRange, setTotalRange] = useState<{ min: string; max: string }>({ min: '', max: '' });
  const [draftTotalRange, setDraftTotalRange] = useState<{ min: string; max: string }>({ min: '', max: '' });
  const [orderNumberRange, setOrderNumberRange] = useState<{ min: string; max: string }>({ min: '', max: '' });
  const [draftOrderNumberRange, setDraftOrderNumberRange] = useState<{ min: string; max: string }>({ min: '', max: '' });
  const [draftFromDate, setDraftFromDate] = useState(initialFrom);
  const [draftToDate, setDraftToDate] = useState(initialTo);
  const [openHeaderFilter, setOpenHeaderFilter] = useState<null | 'order' | 'date' | 'type' | 'status' | 'payment' | 'total' | 'documents'>(null);
  const { toast } = useToast();
  const [isDownloading, setIsDownloading] = useState(false);
  const [hoveredCellMatch, setHoveredCellMatch] = useState<{ column: OrdersColumnKey; value: string } | null>(null);

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
    if (typeof window === 'undefined') return;

    const refreshOrders = () => {
      const hasPendingRefresh = window.sessionStorage.getItem('admin-orders-needs-refresh') === '1';
      if (hasPendingRefresh) {
        window.sessionStorage.removeItem('admin-orders-needs-refresh');
      }
      if (document.visibilityState === 'visible') {
        router.refresh();
      }
    };

    const handlePageShow = () => refreshOrders();
    const handleWindowFocus = () => refreshOrders();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshOrders();
    };

    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [router, pathname]);

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

  useHeaderFilterDismiss({
    isOpen: Boolean(openHeaderFilter),
    onClose: () => setOpenHeaderFilter(null)
  });

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
    const timestamps = analyticsOrders
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
  }, [analyticsOrders]);

  const earliestOrderDate = useMemo(() => {
    const timestamps = analyticsOrders
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
  }, [latestOrderDate, analyticsOrders]);

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

  const applyQuickDateRange = (range: OrdersQuickDateRange) => {
    const anchorDate = new Date(latestOrderDate);

    if (range === 'ytd') {
      const ytdStart = new Date(anchorDate.getFullYear(), 0, 1);
      return { from: toDateInputValue(ytdStart), to: toDateInputValue(anchorDate) };
    }

    const dayCountByRange: Record<Exclude<OrdersQuickDateRange, 'ytd'>, number> = {
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

    const result = new Map<number, UnifiedDocument[]>();
    byOrderByType.forEach((byType, orderId) => {
      result.set(orderId, Array.from(byType.values()));
    });

    return result;
  }, [documents]);

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

  const visibleOrderIds = useMemo(() => pagedOrders.map((order) => order.id), [pagedOrders]);
  const selectedOrderIds = useMemo(() => new Set(selected), [selected]);

  const selectedVisibleCount = useMemo(
    () => visibleOrderIds.filter((orderId) => selectedOrderIds.has(orderId)).length,
    [visibleOrderIds, selectedOrderIds]
  );

  const allSelected = visibleOrderIds.length > 0 && selectedVisibleCount === visibleOrderIds.length;
  const selectedCount = selected.length;
  const hasSelectedRows = selectedCount > 0;
  const hasBulkSelectedRows = selectedCount > 1;
  const singleSelectedOrderId = selectedCount === 1 ? selected[0] ?? null : null;

  const [rowStatusOverrides, setRowStatusOverrides] = useState<Record<number, string>>({});
  const [rowPaymentOverrides, setRowPaymentOverrides] = useState<Record<number, string | null>>({});
  const [rowDetailOverrides, setRowDetailOverrides] = useState<Record<number, Partial<OrderRow>>>({});
  const rowDisplayByOrderId = useMemo(() => {
    const next = new Map<number, { dateLabel: string; dateTimeLabel: string; orderAddress: string; typeLabel: string; totalLabel: string }>();
    pagedOrders.forEach((order) => {
      const effectiveOrder = {
        ...order,
        ...(rowDetailOverrides[order.id] ?? {}),
        status: rowStatusOverrides[order.id] ?? order.status,
        payment_status: rowPaymentOverrides[order.id] ?? order.payment_status ?? null
      };
      next.set(order.id, {
        dateLabel: formatSlDate(effectiveOrder.created_at),
        dateTimeLabel: formatSlDateTime(effectiveOrder.created_at),
        orderAddress: formatOrderAddress(effectiveOrder),
        typeLabel: getCustomerTypeLabel(effectiveOrder.customer_type),
        totalLabel: formatCurrency(effectiveOrder.total)
      });
    });
    return next;
  }, [pagedOrders, rowDetailOverrides, rowPaymentOverrides, rowStatusOverrides]);

  const startQuickEdit = useCallback(
    (order: OrderRow) => {
      if (
        quickEdit &&
        quickEdit.orderId !== order.id &&
        (
          quickEdit.draftOrderNumber.trim() !== quickEdit.initialOrderNumber.trim() ||
          quickEdit.draftOrderDate !== quickEdit.initialOrderDate ||
          quickEdit.draftCustomerName.trim() !== quickEdit.initialCustomerName.trim() ||
          quickEdit.draftAddress.trim() !== quickEdit.initialAddress.trim() ||
          quickEdit.draftCustomerType !== quickEdit.initialCustomerType ||
          quickEdit.draftStatus !== quickEdit.initialStatus ||
          quickEdit.draftPaymentStatus !== quickEdit.initialPaymentStatus
        )
      ) {
        toast.error('Najprej shranite ali prekličite trenutno urejanje.');
        return;
      }

      const detailOverrides = rowDetailOverrides[order.id] ?? {};
      const nextStatus = rowStatusOverrides[order.id] ?? order.status;
      const nextPaymentStatus = rowPaymentOverrides[order.id] ?? order.payment_status ?? null;
      const normalizedPaymentStatus = isPaymentStatus(nextPaymentStatus ?? '') ? nextPaymentStatus ?? '' : '';
      const nextCreatedAt = typeof detailOverrides.created_at === 'string' ? detailOverrides.created_at : order.created_at;
      const nextCustomerType = typeof detailOverrides.customer_type === 'string' ? detailOverrides.customer_type : order.customer_type;
      const nextOrganizationName =
        typeof detailOverrides.organization_name === 'string' ? detailOverrides.organization_name : order.organization_name;
      const nextContactName =
        typeof detailOverrides.contact_name === 'string' ? detailOverrides.contact_name : order.contact_name;
      const nextCustomerName = (nextOrganizationName?.trim() || nextContactName || '').trim();
      const nextAddress =
        typeof detailOverrides.delivery_address === 'string'
          ? detailOverrides.delivery_address
          : formatOrderAddress({ ...order, ...detailOverrides });

      setQuickEdit({
        orderId: order.id,
        draftOrderNumber: toEditableOrderNumber(String(detailOverrides.order_number ?? order.order_number ?? '')),
        initialOrderNumber: toEditableOrderNumber(String(detailOverrides.order_number ?? order.order_number ?? '')),
        draftOrderDate: toDateInputValue(new Date(nextCreatedAt)),
        initialOrderDate: toDateInputValue(new Date(nextCreatedAt)),
        draftCustomerName: nextCustomerName,
        initialCustomerName: nextCustomerName,
        draftAddress: nextAddress,
        initialAddress: nextAddress,
        draftCustomerType: nextCustomerType,
        initialCustomerType: nextCustomerType,
        draftStatus: nextStatus,
        initialStatus: nextStatus,
        draftPaymentStatus: normalizedPaymentStatus,
        initialPaymentStatus: normalizedPaymentStatus,
        email: typeof detailOverrides.email === 'string' ? detailOverrides.email : order.email,
        contactName: nextContactName,
        organizationName: nextOrganizationName,
        reference: typeof detailOverrides.reference === 'string' ? detailOverrides.reference : order.reference ?? null,
        notes: typeof detailOverrides.notes === 'string' ? detailOverrides.notes : order.notes ?? null,
        postalCode:
          typeof detailOverrides.postal_code === 'string'
            ? detailOverrides.postal_code
            : order.postal_code ?? null,
        isSaving: false
      });
    },
    [quickEdit, rowDetailOverrides, rowPaymentOverrides, rowStatusOverrides, toast]
  );

  const cancelQuickEdit = useCallback(() => {
    setQuickEdit(null);
  }, []);

  const saveQuickEdit = useCallback(async () => {
    if (!quickEdit) return;
    if (!quickEdit.draftCustomerName.trim() || !quickEdit.draftOrderDate.trim() || !quickEdit.draftCustomerType.trim()) {
      return;
    }

    const detailsDirty =
      quickEdit.draftOrderNumber.trim() !== quickEdit.initialOrderNumber.trim() ||
      quickEdit.draftOrderDate !== quickEdit.initialOrderDate ||
      quickEdit.draftCustomerName.trim() !== quickEdit.initialCustomerName.trim() ||
      quickEdit.draftAddress.trim() !== quickEdit.initialAddress.trim() ||
      quickEdit.draftCustomerType !== quickEdit.initialCustomerType;
    const statusDirty = quickEdit.draftStatus !== quickEdit.initialStatus;
    const paymentDirty = quickEdit.draftPaymentStatus !== quickEdit.initialPaymentStatus;
    if (!detailsDirty && !statusDirty && !paymentDirty) return;

    setQuickEdit((current) => (current ? { ...current, isSaving: true } : current));

    let nextInitialOrderNumber = quickEdit.initialOrderNumber;
    let nextInitialOrderDate = quickEdit.initialOrderDate;
    let nextInitialCustomerName = quickEdit.initialCustomerName;
    let nextInitialAddress = quickEdit.initialAddress;
    let nextInitialCustomerType = quickEdit.initialCustomerType;
    let nextInitialStatus = quickEdit.initialStatus;
    let nextInitialPaymentStatus = quickEdit.initialPaymentStatus;
    let hasError = false;

    if (detailsDirty) {
      const normalizedCustomerName = quickEdit.draftCustomerName.trim();
      const normalizedAddress = quickEdit.draftAddress.trim();
      const isCompanyLike = quickEdit.draftCustomerType === 'company' || quickEdit.draftCustomerType === 'school';
      const nextOrganizationName = isCompanyLike ? normalizedCustomerName : '';
      const nextContactName = isCompanyLike ? (quickEdit.contactName.trim() || normalizedCustomerName) : normalizedCustomerName;
      const nextOrderNumber = quickEdit.draftOrderNumber.trim() ? toDisplayOrderNumberValue(quickEdit.draftOrderNumber) : '';
      const nextOrderDate = toApiOrderDate(quickEdit.draftOrderDate);

      try {
        const response = await fetch(`/api/admin/orders/${quickEdit.orderId}/details`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderNumber: nextOrderNumber,
            customerType: quickEdit.draftCustomerType,
            organizationName: nextOrganizationName,
            contactName: nextContactName,
            email: quickEdit.email,
            deliveryAddress: normalizedAddress,
            postalCode: quickEdit.postalCode ?? '',
            reference: quickEdit.reference ?? '',
            notes: quickEdit.notes ?? '',
            orderDate: nextOrderDate
          })
        });

        if (!response.ok) {
          hasError = true;
        } else {
          nextInitialOrderNumber = quickEdit.draftOrderNumber;
          nextInitialOrderDate = quickEdit.draftOrderDate;
          nextInitialCustomerName = normalizedCustomerName;
          nextInitialAddress = normalizedAddress;
          nextInitialCustomerType = quickEdit.draftCustomerType;
          setRowDetailOverrides((current) => ({
            ...current,
            [quickEdit.orderId]: {
              ...current[quickEdit.orderId],
              order_number: nextOrderNumber || toDisplayOrderNumberValue(quickEdit.initialOrderNumber),
              created_at: `${(nextOrderDate || quickEdit.initialOrderDate)}T00:00:00.000Z`,
              customer_type: quickEdit.draftCustomerType,
              organization_name: nextOrganizationName || null,
              contact_name: nextContactName,
              delivery_address: normalizedAddress,
              email: quickEdit.email,
              postal_code: quickEdit.postalCode ?? null,
              reference: quickEdit.reference ?? null,
              notes: quickEdit.notes ?? null
            }
          }));
        }
      } catch {
        hasError = true;
      }
    }

    if (statusDirty) {
      try {
        const response = await fetch(`/api/admin/orders/${quickEdit.orderId}/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: quickEdit.draftStatus })
        });

        if (!response.ok) {
          hasError = true;
        } else {
          nextInitialStatus = quickEdit.draftStatus;
          setRowStatusOverrides((current) => ({
            ...current,
            [quickEdit.orderId]: quickEdit.draftStatus
          }));
        }
      } catch {
        hasError = true;
      }
    }

    if (paymentDirty) {
      try {
        const response = await fetch(`/api/admin/orders/${quickEdit.orderId}/payment-status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: quickEdit.draftPaymentStatus, note: '' })
        });

        if (!response.ok) {
          hasError = true;
        } else {
          nextInitialPaymentStatus = quickEdit.draftPaymentStatus;
          setRowPaymentOverrides((current) => ({
            ...current,
            [quickEdit.orderId]: quickEdit.draftPaymentStatus
          }));
        }
      } catch {
        hasError = true;
      }
    }

    if (hasError) {
      toast.error('Nekaterih sprememb ni bilo mogoče shraniti.');
      setQuickEdit((current) =>
        current && current.orderId === quickEdit.orderId
          ? {
              ...current,
              initialOrderNumber: nextInitialOrderNumber,
              initialOrderDate: nextInitialOrderDate,
              initialCustomerName: nextInitialCustomerName,
              initialAddress: nextInitialAddress,
              initialCustomerType: nextInitialCustomerType,
              initialStatus: nextInitialStatus,
              initialPaymentStatus: nextInitialPaymentStatus,
              isSaving: false
            }
          : current
      );
      return;
    }

    toast.success('Shranjeno');
    setQuickEdit(null);
  }, [quickEdit, toast]);

  useEffect(() => {
    if (!hasBulkSelectedRows) {
      setIsStatusHeaderMenuOpen(false);
      setIsPaymentHeaderMenuOpen(false);
    }
  }, [hasBulkSelectedRows]);

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = selectedVisibleCount > 0 && !allSelected;
  }, [allSelected, selectedVisibleCount]);

  useEffect(() => {
    const validIds = new Set(orders.map((order) => order.id));
    setSelected((previousSelected) => previousSelected.filter((selectedOrderId) => validIds.has(selectedOrderId)));
    setQuickEdit((current) => (current && validIds.has(current.orderId) ? current : null));
    setRowDetailOverrides((previousOverrides) =>
      Object.fromEntries(Object.entries(previousOverrides).filter(([orderId]) => validIds.has(Number(orderId))))
    );
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

  const handleQuickEditInputKeyDown = useCallback((event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void saveQuickEdit();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      cancelQuickEdit();
    }
  }, [cancelQuickEdit, saveQuickEdit]);

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
    if (selected.length <= 1) return;

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
    if (selected.length <= 1 || !isPaymentStatus(nextPaymentStatus)) return;

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

  const handleSingleRowStatusUpdate = async (orderId: number, nextStatus: string) => {
    setIsBulkUpdatingStatus(true);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });

      if (!response.ok) throw new Error('Status update failed');

      setRowStatusOverrides((previousOverrides) => ({
        ...previousOverrides,
        [orderId]: nextStatus
      }));
      toast.success('Shranjeno');
    } catch (error) {
      console.error(error);
      toast.error('Napaka pri shranjevanju');
    } finally {
      setIsBulkUpdatingStatus(false);
    }
  };

  const handleSingleRowPaymentUpdate = async (orderId: number, nextPaymentStatus: string) => {
    if (!isPaymentStatus(nextPaymentStatus)) return;

    setIsBulkUpdatingStatus(true);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/payment-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextPaymentStatus, note: '' })
      });

      if (!response.ok) throw new Error('Payment status update failed');

      setRowPaymentOverrides((previousOverrides) => ({
        ...previousOverrides,
        [orderId]: nextPaymentStatus
      }));
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
    const chipByKey: Record<string, { key: string; title: string; value: string; clear: () => void } | null> = {
      date: hasDateChip
        ? {
            key: 'date',
            title: 'Datum:',
            value: `${formatDateForRangeChip(fromDate)} – ${formatDateForRangeChip(toDate)}`,
            clear: () => {
              setFromDate('');
              setToDate('');
            }
          }
        : null,
      type: hasTypeChip
        ? {
            key: 'type',
            title: 'Tip:',
            value: getCustomerTypeLabel(columnTypeFilter),
            clear: () => setColumnTypeFilter('all')
          }
        : null,
      status: hasStatusChip
        ? {
            key: 'status',
            title: 'Status:',
            value: ORDER_STATUS_OPTIONS.find((option) => option.value === columnStatusFilter)?.label ?? columnStatusFilter,
            clear: () => setColumnStatusFilter('all')
          }
        : null,
      payment: hasPaymentChip
        ? {
            key: 'payment',
            title: 'Plačilo:',
            value: PAYMENT_STATUS_OPTIONS.find((option) => option.value === columnPaymentFilter)?.label ?? columnPaymentFilter,
            clear: () => setColumnPaymentFilter('all')
          }
        : null,
      documents: hasDocumentsChip
        ? {
            key: 'documents',
            title: 'Dokumenti:',
            value: documentTypeOptions.find((option) => option.value === documentType)?.label ?? documentType,
            clear: () => setDocumentType('all')
          }
        : null,
      total: hasTotalChip
        ? {
            key: 'total',
            title: 'Skupaj:',
            value: `${totalRange.min || '0'} – ${totalRange.max || '∞'} €`,
            clear: () => setTotalRange({ min: '', max: '' })
          }
        : null,
      orderNumber: hasOrderNumberChip
        ? {
            key: 'orderNumber',
            title: 'Naročila:',
            value: `#${orderNumberRange.min || '0'} – #${orderNumberRange.max || '∞'}`,
            clear: () => setOrderNumberRange({ min: '', max: '' })
          }
        : null
    };

    return filterChipOrder.map((key) => chipByKey[key]).filter((chip): chip is { key: string; title: string; value: string; clear: () => void } => Boolean(chip));
  }, [hasDateChip, hasTypeChip, hasStatusChip, hasPaymentChip, hasDocumentsChip, hasTotalChip, hasOrderNumberChip, fromDate, toDate, columnTypeFilter, columnStatusFilter, columnPaymentFilter, documentType, totalRange.min, totalRange.max, orderNumberRange.min, orderNumberRange.max, filterChipOrder]);

  const getHeaderTitleClass = (column: SortableColumnKey) =>
    `${HEADER_TITLE_BUTTON_CLASS} ${sortState?.column === column ? 'underline underline-offset-2' : ''}`;
  const getComparableCellValue = (value: string) => normalizeForSearch(value || '—');
  const isMatchingHoveredCell = (column: OrdersColumnKey, value: string) =>
    hoveredCellMatch?.column === column && hoveredCellMatch.value === getComparableCellValue(value);
  const matchingValueHighlightClass = 'rounded-[4px] border border-dashed border-amber-500/80 bg-amber-100/70 px-1';
  const matchingValueHighlightNoShiftClass = 'rounded-[4px] bg-amber-100/70 outline outline-1 outline-dashed outline-amber-500/80';

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
            orders={analyticsOrders}
            appearance={analyticsAppearance}
            fromDate={debouncedFromDate}
            toDate={debouncedToDate}
            activeRange={rangePreset}
            onRangeChange={applyAnalyticsRangePreset}
          />
        ) : (
          <div aria-hidden="true" className="mb-3 h-[120px] rounded-[11px] border border-slate-200/80 bg-white/60" />
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
          className={adminTableCardClassName}
          style={adminTableCardStyle}
          contentClassName={adminTableContentClassName}
          headerClassName={adminTableHeaderClassName}
          showDivider={false}
          headerLeft={
            <div className={adminTableToolbarGroupClassName}>
              <div className="min-w-0 w-full">
                <AdminSearchInput
                  wrapperClassName={`${adminTableSearchWrapperClassName} sm:!flex-none sm:!w-[40%] sm:min-w-[20rem] sm:max-w-[30rem]`}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Poišči naročila"
                  aria-label="Poišči naročila"
                  inputClassName={adminTableSearchInputClassName}
                  iconClassName={adminTableSearchIconClassName}
                />
              </div>
            </div>
          }
          headerRight={
            <>
              <div className={adminTableToolbarActionsClassName}>
                <IconButton
                  type="button"
                  onClick={handleDownloadAllDocuments}
                  disabled={isDownloading}
                  tone="neutral"
                  size="sm"
                  className={adminTableNeutralIconButtonClassName}
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
                  triggerClassName={adminTableNeutralIconButtonClassName}
                  icon={<PanelAddRemoveIcon className="!scale-[0.8]" />}
                  menuClassName="!w-32"
                />
                <IconButton
                  type="button"
                  onClick={handleDelete}
                  disabled={!hasSelectedRows || isDeleting}
                  tone={hasSelectedRows ? 'danger' : 'neutral'}
                  size="sm"
                  className={hasSelectedRows ? adminTableSelectedDangerIconButtonClassName : `${adminTableNeutralIconButtonClassName} !transition-none`}
                  aria-label="Izbriši izbrana naročila"
                  title="Izbriši"
                >
                  {isDeleting ? (
                    <Spinner size="sm" className="text-[var(--danger-600)]" />
                  ) : (
                    <TrashCanIcon />
                  )}
                </IconButton>
                {topAction ? <div className="flex items-center [&_button]:!rounded-md [&_button]:!px-4">{topAction}</div> : null}
              </div>
            </>
          }
          filterRowLeft={
            activeFilterChips.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                {activeFilterChips.map((chip) => (
                  <span key={chip.key} className={filterPillTokenClasses.base}>
                    <span>
                      {chip.title}{' '}
                      <span className="font-semibold">{chip.value}</span>
                    </span>
                    <button type="button" onClick={chip.clear} className={filterPillTokenClasses.clear} aria-label={`Odstrani filter ${chip.title} ${chip.value}`}>×</button>
                  </span>
                ))}
              </div>
            ) : null
          }
          filterRowRight={
            <EuiTablePagination
              page={page}
              pageCount={pageCount}
              onPageChange={handlePageChange}
              itemsPerPage={pageSize}
              onChangeItemsPerPage={handlePageSizeChange}
              itemsPerPageOptions={PAGE_SIZE_OPTIONS}
            />
          }
          footerRight={
            <EuiTablePagination
              page={page}
              pageCount={pageCount}
              onPageChange={handlePageChange}
              itemsPerPage={pageSize}
              onChangeItemsPerPage={handlePageSizeChange}
              itemsPerPageOptions={PAGE_SIZE_OPTIONS}
            />
          }
        >
          <Table className="min-w-[1250px] w-full table-fixed text-[12px] [&_thead_th]:!border-slate-200">
            <colgroup>
              <col style={{ width: columnWidths.selectAndDelete }} />
              {visibleColumns.order ? <col style={{ width: columnWidths.order }} /> : null}
              {visibleColumns.date ? <col style={{ width: columnWidths.date }} /> : null}
              {visibleColumns.customer ? <col style={{ width: columnWidths.customer }} /> : null}
              {visibleColumns.address ? <col /> : null}
              {visibleColumns.type ? <col style={{ width: columnWidths.type }} /> : null}
              {visibleColumns.status ? <col style={{ width: columnWidths.status }} /> : null}
              {visibleColumns.payment ? <col style={{ width: columnWidths.payment }} /> : null}
              {visibleColumns.total ? <col style={{ width: columnWidths.total }} /> : null}
              {visibleColumns.documents ? <col style={{ width: columnWidths.documents }} /> : null}
              <col style={{ width: columnWidths.edit }} />
            </colgroup>

            <THead className="border-t border-slate-200">
              <TR>
                <TH className={`${ORDERS_HEADER_CELL_CENTER_CLASS} px-2`}>
                  <div className="flex h-11 items-center justify-center">
                    <AdminCheckbox
                      ref={selectAllRef}
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="Izberi vse"
                      className="block h-3.5 w-3.5"
                    />
                  </div>
                </TH>

                {visibleColumns.order ? <TH className={ORDERS_HEADER_CELL_CENTER_CLASS}>
                  <div className={ORDERS_HEADER_CONTENT_CLASS} {...{ [HEADER_FILTER_ROOT_ATTR]: 'true' }}>
                    <button type="button" onClick={() => onSort('order')} className={getHeaderTitleClass('order')}>Naročilo</button>
                    <button ref={orderFilterButtonRef} data-active={openHeaderFilter === 'order'} type="button" onClick={(event) => { event.stopPropagation(); toggleHeaderFilter('order'); }} className={HEADER_FILTER_BUTTON_CLASS} aria-label="Filtriraj Naročilo">
                      <ColumnFilterIcon className="!h-[12px] !w-[12px]" />
                    </button>
                  </div>
                </TH> : null}

                {visibleColumns.date ? <TH className={ORDERS_HEADER_CELL_CENTER_CLASS}>
                  <div className={ORDERS_HEADER_CONTENT_CLASS} {...{ [HEADER_FILTER_ROOT_ATTR]: 'true' }}>
                    <button type="button" onClick={() => onSort('date')} className={getHeaderTitleClass('date')}>Datum</button>
                    <button ref={dateFilterButtonRef} data-active={openHeaderFilter === 'date'} type="button" onClick={(event) => { event.stopPropagation(); toggleHeaderFilter('date'); }} className={HEADER_FILTER_BUTTON_CLASS} aria-label="Filtriraj Datum">
                      <ColumnFilterIcon className="!h-[12px] !w-[12px]" />
                    </button>
                  </div>
                </TH> : null}

                {visibleColumns.customer ? <TH className={ORDERS_HEADER_CELL_LEFT_CLASS}><div className="flex h-11 items-center"><button type="button" onClick={() => onSort('customer')} className={getHeaderTitleClass('customer')}>Naročnik</button></div></TH> : null}

                {visibleColumns.address ? <TH className={ORDERS_HEADER_CELL_LEFT_CLASS}><div className="flex h-11 items-center"><button type="button" onClick={() => onSort('address')} className={getHeaderTitleClass('address')}>Naslov</button></div></TH> : null}

                {visibleColumns.type ? <TH className={ORDERS_HEADER_CELL_CENTER_CLASS}>
                  <div className={ORDERS_HEADER_CONTENT_CLASS} {...{ [HEADER_FILTER_ROOT_ATTR]: 'true' }}>
                    <button type="button" onClick={() => onSort('type')} className={getHeaderTitleClass('type')}>Tip</button>
                    <button ref={typeFilterButtonRef} data-active={openHeaderFilter === 'type'} type="button" onClick={(event) => { event.stopPropagation(); toggleHeaderFilter('type'); }} className={HEADER_FILTER_BUTTON_CLASS} aria-label="Filtriraj Tip"><ColumnFilterIcon className="!h-[12px] !w-[12px]" /></button>
                  </div>
                </TH> : null}

                {visibleColumns.status ? <TH className={ORDERS_STATUS_INFO_HEADER_CELL_CLASS}>
                  <div className="relative flex h-11 items-center justify-center" ref={statusHeaderMenuRef}>
                    {hasBulkSelectedRows ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setIsStatusHeaderMenuOpen((previousOpen) => !previousOpen)}
                          disabled={isBulkUpdatingStatus}
                          className={ORDERS_BULK_HEADER_BUTTON_CLASS}
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
                                  className={getStatusMenuItemClassName(option.value)}
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
                      <div className={ORDERS_HEADER_CONTENT_CLASS} {...{ [HEADER_FILTER_ROOT_ATTR]: 'true' }}>
                        <button type="button" onClick={() => onSort('status')} className={getHeaderTitleClass('status')}>Status</button>
                        <button ref={statusFilterButtonRef} data-active={openHeaderFilter === 'status'} type="button" onClick={(event) => { event.stopPropagation(); toggleHeaderFilter('status'); }} className={HEADER_FILTER_BUTTON_CLASS} aria-label="Filtriraj Status"><ColumnFilterIcon className="!h-[12px] !w-[12px]" /></button>
                      </div>
                    )}
                  </div>
                </TH> : null}

                {visibleColumns.payment ? <TH className={ORDERS_STATUS_INFO_HEADER_CELL_CLASS}>
                  <div className="relative flex h-11 items-center justify-center" ref={paymentHeaderMenuRef}>
                    {hasBulkSelectedRows ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setIsPaymentHeaderMenuOpen((previousOpen) => !previousOpen)}
                          disabled={isBulkUpdatingStatus}
                          className={ORDERS_BULK_HEADER_BUTTON_CLASS}
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
                                  className={getPaymentMenuItemClassName(option.value)}
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
                      <div className={ORDERS_HEADER_CONTENT_CLASS} {...{ [HEADER_FILTER_ROOT_ATTR]: 'true' }}>
                        <button type="button" onClick={() => onSort('payment')} className={getHeaderTitleClass('payment')}>Plačilo</button>
                        <button ref={paymentFilterButtonRef} data-active={openHeaderFilter === 'payment'} type="button" onClick={(event) => { event.stopPropagation(); toggleHeaderFilter('payment'); }} className={HEADER_FILTER_BUTTON_CLASS} aria-label="Filtriraj Plačilo"><ColumnFilterIcon className="!h-[12px] !w-[12px]" /></button>
                      </div>
                    )}
                  </div>
                </TH> : null}

                {visibleColumns.total ? <TH className={ORDERS_HEADER_CELL_CENTER_CLASS}>
                  <div className={ORDERS_HEADER_CONTENT_CLASS} {...{ [HEADER_FILTER_ROOT_ATTR]: 'true' }}>
                    <button type="button" onClick={() => onSort('total')} className={getHeaderTitleClass('total')}>Skupaj</button>
                    <button ref={totalFilterButtonRef} data-active={openHeaderFilter === 'total'} type="button" onClick={(event) => { event.stopPropagation(); toggleHeaderFilter('total'); }} className={HEADER_FILTER_BUTTON_CLASS} aria-label="Filtriraj Skupaj"><ColumnFilterIcon className="!h-[12px] !w-[12px]" /></button>
                  </div>
                </TH> : null}

                {visibleColumns.documents ? <TH className={`${ORDERS_HEADER_CELL_CENTER_CLASS} whitespace-nowrap`} style={{ minWidth: columnWidths.documents }}>
                  <div className={`${ORDERS_HEADER_CONTENT_CLASS} whitespace-nowrap`} {...{ [HEADER_FILTER_ROOT_ATTR]: 'true' }}>
                    <span className={adminTableHeaderTextClassName}>PDF datoteke</span>
                    <button ref={documentsFilterButtonRef} data-active={openHeaderFilter === 'documents'} type="button" onClick={(event) => { event.stopPropagation(); toggleHeaderFilter('documents'); }} className={HEADER_FILTER_BUTTON_CLASS} aria-label="Filtriraj PDF datoteke"><ColumnFilterIcon className="!h-[12px] !w-[12px]" /></button>
                  </div>
                </TH> : null}
                <TH className={ORDERS_HEADER_CELL_CENTER_CLASS}>
                  <div className="flex h-11 items-center justify-center">
                    <span className={adminTableHeaderTextClassName}>Uredi</span>
                  </div>
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
                            className={`rounded-md border border-slate-300 px-3 py-1 text-slate-700 hover:border-[color:var(--blue-500)] hover:bg-[color:var(--hover-neutral)] ${adminTextButtonTypographyTokenClasses}`}
                          >
                            Prikaži vsa naročila
                          </button>
                        ) : null
                      }
                    />
                  </TD>
                </TR>
              ) : (
                pagedOrders.map((order) => {
                  const effectiveOrder = {
                    ...order,
                    ...(rowDetailOverrides[order.id] ?? {}),
                    status: rowStatusOverrides[order.id] ?? order.status,
                    payment_status: rowPaymentOverrides[order.id] ?? order.payment_status ?? null
                  };
                  const rowDisplay = rowDisplayByOrderId.get(order.id);
                  const orderAddress = rowDisplay?.orderAddress ?? formatOrderAddress(effectiveOrder);
                  const typeLabel = rowDisplay?.typeLabel ?? getCustomerTypeLabel(effectiveOrder.customer_type);
                  const rowStatus = effectiveOrder.status;
                  const rowPaymentStatus = effectiveOrder.payment_status ?? null;
                  const normalizedRowPaymentStatus = isPaymentStatus(rowPaymentStatus ?? '') ? rowPaymentStatus ?? 'unpaid' : 'unpaid';
                  const isRowSelected = selected.includes(order.id);
                  const isSingleSelectedOrder = singleSelectedOrderId === order.id;
                  const activeQuickEdit = quickEdit?.orderId === order.id ? quickEdit : null;
                  const isRowQuickEditing = activeQuickEdit !== null;
                  const isQuickEditValid = activeQuickEdit
                    ? Boolean(
                        activeQuickEdit.draftCustomerName.trim() &&
                        activeQuickEdit.draftOrderDate.trim() &&
                        activeQuickEdit.draftCustomerType.trim()
                      )
                    : false;
                  const isQuickEditDirty = activeQuickEdit
                    ? activeQuickEdit.draftOrderNumber.trim() !== activeQuickEdit.initialOrderNumber.trim() ||
                      activeQuickEdit.draftOrderDate !== activeQuickEdit.initialOrderDate ||
                      activeQuickEdit.draftCustomerName.trim() !== activeQuickEdit.initialCustomerName.trim() ||
                      activeQuickEdit.draftAddress.trim() !== activeQuickEdit.initialAddress.trim() ||
                      activeQuickEdit.draftCustomerType !== activeQuickEdit.initialCustomerType ||
                      activeQuickEdit.draftStatus !== activeQuickEdit.initialStatus ||
                      activeQuickEdit.draftPaymentStatus !== activeQuickEdit.initialPaymentStatus
                    : false;

                  return (
                    <TR
                      key={order.id}
                      className={`${ORDERS_ROW_CLASS} ${
                        isRowSelected ? adminTableRowToneClasses.selected : ''
                      } ${adminTableRowToneClasses.hover}`}
                    >
                      <TD className="h-12 px-0 py-0 text-center align-middle">
                        <div className="flex h-12 items-center justify-center">
                          <AdminCheckbox
                            data-no-row-nav
                            checked={selected.includes(order.id)}
                            onChange={() => toggleSelected(order.id)}
                            aria-label={`Izberi naročilo ${toDisplayOrderNumber(order.order_number)}`}
                            className="h-3.5 w-3.5"
                          />
                        </div>
                      </TD>

                      {visibleColumns.order ? <TD className={`${ORDERS_BODY_CELL_CENTER_CLASS} font-semibold text-slate-900`} data-no-row-nav>
                        {isRowQuickEditing ? (
                          <div className="mx-auto flex h-7 w-full items-center justify-center">
                            <Input
                              id={`order-quick-edit-number-${order.id}`}
                              name={`orderQuickEditNumber-${order.id}`}
                              value={activeQuickEdit.draftOrderNumber}
                              onChange={(event) =>
                                setQuickEdit((current) =>
                                  current && current.orderId === order.id
                                    ? { ...current, draftOrderNumber: event.target.value.replace(/[^\d#]/g, '') }
                                    : current
                                )
                              }
                              onKeyDown={handleQuickEditInputKeyDown}
                              inputMode="numeric"
                              className={ORDERS_ORDER_INPUT_CLASS}
                              aria-label={`Številka naročila ${order.id}`}
                              autoFocus
                            />
                          </div>
                        ) : (
                          <Link
                            href={`/admin/orders/${order.id}`}
                            prefetch={false}
                            className="inline-flex w-full items-center justify-center rounded-sm px-1 text-center text-[12px] font-semibold text-slate-900 transition-colors hover:text-[color:var(--blue-500)] hover:underline underline-offset-2 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-[#3e67d6]"
                            aria-label={`Odpri naročilo ${toDisplayOrderNumber(effectiveOrder.order_number)}`}
                          >
                            {toDisplayOrderNumber(effectiveOrder.order_number)}
                          </Link>
                        )}
                      </TD> : null}

                      {visibleColumns.date ? <TD className={`${ORDERS_BODY_CELL_CENTER_CLASS} whitespace-nowrap`}>
                        {isRowQuickEditing ? (
                          <div className="mx-auto flex h-7 w-full items-center justify-center">
                            <Input
                              id={`order-quick-edit-date-${order.id}`}
                              name={`orderQuickEditDate-${order.id}`}
                              type="date"
                              value={activeQuickEdit.draftOrderDate}
                              onChange={(event) =>
                                setQuickEdit((current) =>
                                  current && current.orderId === order.id
                                    ? { ...current, draftOrderDate: event.target.value }
                                    : current
                                )
                              }
                              onKeyDown={handleQuickEditInputKeyDown}
                              className={ORDERS_DATE_INPUT_CLASS}
                              aria-label={`Datum naročila ${order.id}`}
                            />
                          </div>
                        ) : (
                          <span
                            className={`inline-block rounded-sm focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-[#3e67d6] ${isMatchingHoveredCell('date', rowDisplay?.dateLabel ?? formatSlDate(effectiveOrder.created_at)) ? matchingValueHighlightClass : 'px-1'}`}
                            title={rowDisplay?.dateTimeLabel ?? formatSlDateTime(effectiveOrder.created_at)}
                            aria-label={`Datum naročila ${rowDisplay?.dateTimeLabel ?? formatSlDateTime(effectiveOrder.created_at)}`}
                            tabIndex={0}
                            onMouseEnter={() =>
                              setHoveredCellMatch({
                                column: 'date',
                                value: getComparableCellValue(rowDisplay?.dateLabel ?? formatSlDate(effectiveOrder.created_at))
                              })}
                            onMouseLeave={() => setHoveredCellMatch(null)}
                          >
                            {rowDisplay?.dateLabel ?? formatSlDate(effectiveOrder.created_at)}
                          </span>
                        )}
                      </TD> : null}

                      {visibleColumns.customer ? <TD className={ORDERS_BODY_CELL_BASE_CLASS}>
                        {isRowQuickEditing ? (
                          <Input
                            id={`order-quick-edit-customer-${order.id}`}
                            name={`orderQuickEditCustomer-${order.id}`}
                            value={activeQuickEdit.draftCustomerName}
                            onChange={(event) =>
                              setQuickEdit((current) =>
                                current && current.orderId === order.id
                                  ? { ...current, draftCustomerName: event.target.value }
                                  : current
                              )
                            }
                            onKeyDown={handleQuickEditInputKeyDown}
                            className={ORDERS_TEXT_INPUT_FULL_CLASS}
                            aria-label={`Naročnik ${order.id}`}
                          />
                        ) : (
                          <span
                            className={`inline-flex max-w-full items-center truncate ${ORDERS_STANDARD_VALUE_CLASS} ${isMatchingHoveredCell('customer', effectiveOrder.organization_name || effectiveOrder.contact_name) ? matchingValueHighlightNoShiftClass : ''}`}
                            title={effectiveOrder.organization_name || effectiveOrder.contact_name}
                            onMouseEnter={() => setHoveredCellMatch({ column: 'customer', value: getComparableCellValue(effectiveOrder.organization_name || effectiveOrder.contact_name) })}
                            onMouseLeave={() => setHoveredCellMatch(null)}
                          >
                            {effectiveOrder.organization_name || effectiveOrder.contact_name}
                          </span>
                        )}
                      </TD> : null}

                      {visibleColumns.address ? <TD className={ORDERS_BODY_CELL_BASE_CLASS}>
                        {isRowQuickEditing ? (
                          <Input
                            id={`order-quick-edit-address-${order.id}`}
                            name={`orderQuickEditAddress-${order.id}`}
                            value={activeQuickEdit.draftAddress}
                            onChange={(event) =>
                              setQuickEdit((current) =>
                                current && current.orderId === order.id
                                  ? { ...current, draftAddress: event.target.value }
                                  : current
                              )
                            }
                            onKeyDown={handleQuickEditInputKeyDown}
                            className={ORDERS_TEXT_INPUT_FULL_CLASS}
                            aria-label={`Naslov ${order.id}`}
                          />
                        ) : (
                          <span
                            className={`inline-flex max-w-full items-center truncate ${ORDERS_STANDARD_VALUE_CLASS} ${isMatchingHoveredCell('address', orderAddress || '—') ? matchingValueHighlightNoShiftClass : ''}`}
                            title={orderAddress || '—'}
                            onMouseEnter={() => setHoveredCellMatch({ column: 'address', value: getComparableCellValue(orderAddress || '—') })}
                            onMouseLeave={() => setHoveredCellMatch(null)}
                          >
                            {orderAddress || '—'}
                          </span>
                        )}
                      </TD> : null}

                      {visibleColumns.type ? <TD className={ORDERS_BODY_CELL_CENTER_CLASS}>
                        {isRowQuickEditing ? (
                          <div className={ORDERS_INLINE_CONTROL_FRAME_CLASS}>
                            <CustomSelect
                              value={activeQuickEdit.draftCustomerType}
                              onChange={(value) =>
                                setQuickEdit((current) =>
                                  current && current.orderId === order.id
                                    ? { ...current, draftCustomerType: value }
                                    : current
                                )
                              }
                              options={ORDER_CUSTOMER_TYPE_ROW_OPTIONS}
                              disabled={activeQuickEdit.isSaving}
                              className="w-full"
                              triggerClassName={ORDERS_TYPE_SELECT_TRIGGER_CLASS}
                              menuClassName="min-w-full"
                              valueClassName="text-[12px]"
                            />
                          </div>
                        ) : (
                          <span
                            className={isMatchingHoveredCell('type', typeLabel) ? matchingValueHighlightClass : ''}
                            onMouseEnter={() => setHoveredCellMatch({ column: 'type', value: getComparableCellValue(typeLabel) })}
                            onMouseLeave={() => setHoveredCellMatch(null)}
                          >
                            {typeLabel}
                          </span>
                        )}
                      </TD> : null}

                      {visibleColumns.status ? <TD className={ORDERS_STATUS_INFO_BODY_CELL_CLASS}>
                        <div className={ORDERS_INLINE_CONTROL_FRAME_CLASS}>
                          {isRowQuickEditing ? (
                            <OrdersInlineChipSelect
                              value={activeQuickEdit.draftStatus}
                              onChange={(value) =>
                                setQuickEdit((current) =>
                                  current && current.orderId === order.id
                                    ? { ...current, draftStatus: value }
                                    : current
                                )
                              }
                              options={ORDER_STATUS_OPTIONS}
                              disabled={activeQuickEdit.isSaving}
                              ariaLabel={`Status naročila ${order.id}`}
                              menuWidth={152}
                              optionClassName={getStatusMenuItemClassName}
                            >
                              <StatusChip status={activeQuickEdit.draftStatus} />
                            </OrdersInlineChipSelect>
                          ) : isSingleSelectedOrder ? (
                            <OrdersInlineChipSelect
                              value={rowStatus}
                              onChange={(value) => void handleSingleRowStatusUpdate(order.id, value)}
                              options={ORDER_STATUS_OPTIONS}
                              disabled={isBulkUpdatingStatus}
                              ariaLabel={`Status naročila ${order.id}`}
                              menuWidth={152}
                              optionClassName={getStatusMenuItemClassName}
                            >
                              <StatusChip status={rowStatus} />
                            </OrdersInlineChipSelect>
                          ) : (
                            <StatusChip status={rowStatus} />
                          )}
                        </div>
                      </TD> : null}

                      {visibleColumns.payment ? <TD className={ORDERS_STATUS_INFO_BODY_CELL_CLASS}>
                        <div className={ORDERS_INLINE_CONTROL_FRAME_CLASS}>
                          {isRowQuickEditing ? (
                            <OrdersInlineChipSelect
                              value={activeQuickEdit.draftPaymentStatus}
                              onChange={(value) =>
                                setQuickEdit((current) =>
                                  current && current.orderId === order.id
                                    ? { ...current, draftPaymentStatus: value }
                                    : current
                                )
                              }
                              options={PAYMENT_STATUS_OPTIONS}
                              disabled={activeQuickEdit.isSaving}
                              ariaLabel={`Plačilo naročila ${order.id}`}
                              menuWidth={140}
                              optionClassName={getPaymentMenuItemClassName}
                            >
                              <PaymentChip status={activeQuickEdit.draftPaymentStatus} />
                            </OrdersInlineChipSelect>
                          ) : isSingleSelectedOrder ? (
                            <OrdersInlineChipSelect
                              value={normalizedRowPaymentStatus}
                              onChange={(value) => void handleSingleRowPaymentUpdate(order.id, value)}
                              options={PAYMENT_STATUS_OPTIONS}
                              disabled={isBulkUpdatingStatus}
                              ariaLabel={`Plačilo naročila ${order.id}`}
                              menuWidth={140}
                              optionClassName={getPaymentMenuItemClassName}
                            >
                              <PaymentChip status={rowPaymentStatus} />
                            </OrdersInlineChipSelect>
                          ) : (
                            <PaymentChip status={rowPaymentStatus} />
                          )}
                        </div>
                      </TD> : null}

                      {visibleColumns.total ? <TD className={ORDERS_BODY_CELL_CENTER_CLASS}>
                        <span
                          className={`${ORDERS_EMPHASIZED_VALUE_CLASS} ${isMatchingHoveredCell('total', rowDisplay?.totalLabel ?? formatCurrency(order.total)) ? matchingValueHighlightClass : ''}`}
                          onMouseEnter={() => setHoveredCellMatch({ column: 'total', value: getComparableCellValue(rowDisplay?.totalLabel ?? formatCurrency(order.total)) })}
                          onMouseLeave={() => setHoveredCellMatch(null)}
                        >
                          {rowDisplay?.totalLabel ?? formatCurrency(order.total)}
                        </span>
                      </TD> : null}

                      {visibleColumns.documents ? <TD className="relative z-10 h-12 px-0 py-0 text-center align-middle" style={{ minWidth: columnWidths.documents }} data-no-row-nav>
                        <div className="flex justify-center">
                          <LazyAdminOrdersPdfCell
                            orderId={order.id}
                            documents={documentsByOrder.get(order.id) ?? []}
                            interactionsDisabled={false}
                          />
                        </div>
                      </TD> : null}

                      <TD className="relative z-0 h-12 px-0 py-0 text-center align-middle" data-no-row-nav>
                        <div className="flex h-12 items-center justify-center">
                          {isRowQuickEditing ? (
                            <div className={adminTableInlineActionRowClassName}>
                              <IconButton
                                type="button"
                                tone="neutral"
                                size="sm"
                                className={adminTableInlineConfirmButtonClassName}
                                onClick={() => {
                                  void saveQuickEdit();
                                }}
                                disabled={!isQuickEditDirty || !isQuickEditValid || activeQuickEdit.isSaving}
                                aria-label={`Shrani hitro urejanje za naročilo ${toDisplayOrderNumber(order.order_number)}`}
                                title={!isQuickEditValid ? 'Izpolnite obvezna polja' : (!isQuickEditDirty ? 'Ni sprememb za shranjevanje' : 'Shrani')}
                              >
                                <CheckIcon className={adminTableInlineConfirmIconClassName} strokeWidth={2.2} />
                              </IconButton>
                              <IconButton
                                type="button"
                                tone="neutral"
                                size="sm"
                                className={adminTableInlineCancelButtonClassName}
                                onClick={cancelQuickEdit}
                                disabled={activeQuickEdit.isSaving}
                                aria-label={`Prekliči hitro urejanje za naročilo ${toDisplayOrderNumber(order.order_number)}`}
                                title="Prekliči"
                              >
                                <CloseIcon className={adminTableInlineCancelIconClassName} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
                              </IconButton>
                            </div>
                          ) : (
                            <RowActions className="relative">
                              <RowActionsDropdown
                                menuWidth={144}
                                menuClassName="w-36"
                                label={`Možnosti za naročilo ${toDisplayOrderNumber(order.order_number)}`}
                                items={[
                                  {
                                    key: 'quick-edit',
                                    label: 'Hitro urejanje',
                                    icon: <PencilIcon />,
                                    onSelect: () => {
                                      startQuickEdit(order);
                                    }
                                  },
                                  {
                                    key: 'open',
                                    label: 'Odpri naročilo',
                                    icon: <OpenArticleIcon />,
                                    onSelect: () => {
                                      router.push(`/admin/orders/${order.id}`);
                                    }
                                  },
                                  {
                                    key: 'delete',
                                    label: 'Izbriši',
                                    icon: deletingRowId === order.id ? <Spinner size="sm" className="text-[var(--danger-600)]" /> : <TrashCanIcon />,
                                    className: 'text-rose-600 hover:!bg-rose-50 hover:!text-rose-600',
                                    disabled: deletingRowId === order.id,
                                    onSelect: () => {
                                      void handleDeleteRow(order.id);
                                    }
                                  }
                                ]}
                              />
                            </RowActions>
                          )}
                        </div>
                      </TD>
                    </TR>
                  );
                })
              )}
            </TBody>
          </Table>
        </AdminTableLayout>
        <HeaderFilterPortal open={Boolean(openHeaderFilter)}>
            {openHeaderFilter === 'order' ? (
              <div style={getHeaderPopoverStyle(orderFilterButtonRef.current, 192)} className={adminTableCompactPopoverPanelClassName}>
                <h4 className="mb-2 text-[11px] font-semibold text-slate-800">Nastavi razpon naročil</h4>
                <div className="grid grid-cols-2 gap-2">
                  <AdminFilterInput type="number" placeholder="Od" value={draftOrderNumberRange.min} onChange={(event) => setDraftOrderNumberRange((current) => ({ ...current, min: event.target.value }))} aria-label="Od" />
                  <AdminFilterInput type="number" placeholder="Do" value={draftOrderNumberRange.max} onChange={(event) => setDraftOrderNumberRange((current) => ({ ...current, max: event.target.value }))} aria-label="Do" />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button type="button" className={adminTablePopoverPrimaryButtonClassName} onClick={() => { setOrderNumberRange(draftOrderNumberRange); setOpenHeaderFilter(null); }}>Potrdi</button>
                  <button type="button" className={adminTablePopoverSecondaryButtonClassName} onClick={() => { const emptyRange = { min: '', max: '' }; setDraftOrderNumberRange(emptyRange); setOrderNumberRange(emptyRange); setOpenHeaderFilter(null); }}>Ponastavi</button>
                </div>
              </div>
            ) : null}
            {openHeaderFilter === 'date' ? (
              <div lang="sl-SI" style={getHeaderPopoverStyle(dateFilterButtonRef.current, 380)} className={adminTablePopoverPanelClassName}>
                <h4 className="mb-2 text-[11px] font-semibold text-slate-800">Nastavi obdobje</h4>
                <div className="mb-3 grid grid-cols-3 gap-2">
                  {ORDERS_QUICK_DATE_RANGE_OPTIONS.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      aria-label={item.label}
                      onClick={() => {
                        const quickRange = applyQuickDateRange(item.key);
                        setDraftFromDate(quickRange.from);
                        setDraftToDate(quickRange.to);
                        setFromDate(quickRange.from);
                        setToDate(quickRange.to);
                        setHasExplicitDateFilter(true);
                        setOpenHeaderFilter(null);
                      }}
                      className={ORDERS_DATE_PRESET_BUTTON_CLASS}
                    >
                      <span className={ORDERS_DATE_PRESET_VALUE_CLASS}>{item.value}</span>
                      {item.unit ? <span className={ORDERS_DATE_PRESET_UNIT_CLASS}>{item.unit}</span> : null}
                    </button>
                  ))}
                </div>
                <div className="mb-3 border-t border-slate-200 pt-3">
                  <div className="grid grid-cols-2 gap-2">
                    <AdminFilterInput type="date" lang="sl-SI" value={draftFromDate} onChange={(event) => setDraftFromDate(event.target.value)} aria-label="Od" />
                    <AdminFilterInput type="date" lang="sl-SI" value={draftToDate} onChange={(event) => setDraftToDate(event.target.value)} aria-label="Do" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" className={adminTablePopoverPrimaryButtonClassName} onClick={() => { setFromDate(draftFromDate); setToDate(draftToDate); setHasExplicitDateFilter(Boolean(draftFromDate || draftToDate)); setOpenHeaderFilter(null); }}>Potrdi</button>
                  <button type="button" className={adminTablePopoverSecondaryButtonClassName} onClick={() => { setDraftFromDate(''); setDraftToDate(''); setFromDate(''); setToDate(''); setHasExplicitDateFilter(false); setOpenHeaderFilter(null); }}>Ponastavi</button>
                </div>
              </div>
            ) : null}
            {openHeaderFilter === 'type' ? (
              <div style={getHeaderPopoverStyle(typeFilterButtonRef.current, 144)}>
                <MenuPanel>
                  {[
                    { value: 'all', label: 'Vsi' },
                    { value: 'school', label: 'Šola' },
                    { value: 'company', label: 'Podjetje' },
                    { value: 'individual', label: 'Fiz. oseba' }
                  ].map((option) => <MenuItem key={option.value} onClick={() => { setColumnTypeFilter(option.value as ColumnTypeFilter); setOpenHeaderFilter(null); }}>{option.label}</MenuItem>)}
                </MenuPanel>
              </div>
            ) : null}
            {openHeaderFilter === 'status' ? (
              <div style={getHeaderPopoverStyle(statusFilterButtonRef.current, 160)}>
                <MenuPanel>
                  {[{ value: 'all', label: 'Vsi' } as const, ...ORDER_STATUS_OPTIONS].map((option) => (
                    <MenuItem
                      key={option.value}
                      className={option.value === 'all' ? undefined : getStatusMenuItemClassName(option.value)}
                      onClick={() => { setColumnStatusFilter(option.value as StatusTab); setOpenHeaderFilter(null); }}
                    >
                      {option.label}
                    </MenuItem>
                  ))}
                </MenuPanel>
              </div>
            ) : null}
            {openHeaderFilter === 'payment' ? (
              <div style={getHeaderPopoverStyle(paymentFilterButtonRef.current, 160)}>
                <MenuPanel>
                  {[{ value: 'all', label: 'Vsa' }, ...PAYMENT_STATUS_OPTIONS].map((option) => (
                    <MenuItem
                      key={option.value}
                      className={option.value === 'all' ? undefined : getPaymentMenuItemClassName(option.value)}
                      onClick={() => { setColumnPaymentFilter(option.value as ColumnPaymentFilter); setOpenHeaderFilter(null); }}
                    >
                      {option.label}
                    </MenuItem>
                  ))}
                </MenuPanel>
              </div>
            ) : null}
            {openHeaderFilter === 'total' ? (
              <div style={getHeaderPopoverStyle(totalFilterButtonRef.current, 192)}>
                <AdminRangeFilterPanel
                  title="Nastavi razpon zneskov (€)"
                  draftRange={draftTotalRange}
                  presets={ORDERS_NUMERIC_RANGE_PRESETS}
                  onDraftChange={setDraftTotalRange}
                  onConfirm={() => {
                    setTotalRange(draftTotalRange);
                    setOpenHeaderFilter(null);
                  }}
                  onReset={() => {
                    const emptyRange = { min: '', max: '' };
                    setDraftTotalRange(emptyRange);
                    setTotalRange(emptyRange);
                    setOpenHeaderFilter(null);
                  }}
                />
              </div>
            ) : null}
            {openHeaderFilter === 'documents' ? (
              <div style={getHeaderPopoverStyle(documentsFilterButtonRef.current, 160)}>
                <MenuPanel>
                  {documentTypeOptions.map((option) => <MenuItem key={option.value} onClick={() => { setDocumentType(option.value); setOpenHeaderFilter(null); }}>{option.label}</MenuItem>)}
                </MenuPanel>
              </div>
            ) : null}
        </HeaderFilterPortal>
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
