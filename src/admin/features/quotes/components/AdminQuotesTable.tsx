'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent
} from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  getAdminQuoteQuickDateRange,
  normalizeAdminQuoteAmountBound,
  normalizeAdminQuoteDateBound,
  normalizeAdminQuoteDateRange,
  normalizeAdminQuoteRequestNumberRange,
  type AdminQuoteQuickDateRange,
  type AdminQuoteCustomerTypeFilter,
  type AdminQuoteFunnelPreview,
  type AdminQuoteListRow,
  type AdminQuoteListPage,
  type AdminQuoteStatusFilter
} from '@/shared/domain/quote/quoteAdminTypes';
import {
  formatEuroWithSuffix,
  formatSlInteger
} from '@/shared/domain/formatting';
import {
  formatSlDate,
  formatSlDateTime
} from '@/shared/domain/order/dateTime';
import { formatStructuredOrderAddress } from '@/shared/domain/order/orderAddress';
import { getCustomerTypeLabel } from '@/shared/domain/order/customerType';
import {
  getQuoteRequestStatusLabel,
  getQuoteRequestStatusMenuItemClassName,
  getQuoteRequestStatusPresentation,
  isManuallyEditableQuoteRequestStatus,
  QUOTE_REQUEST_MANUAL_STATUS_OPTIONS,
  QUOTE_REQUEST_VISIBLE_STATUS_OPTIONS
} from '@/shared/domain/quote/quoteRequestStatus';
import { AdminChipDropdown } from '@/shared/ui/admin-controls/AdminChipDropdown';
import { AdminSearchInput } from '@/shared/ui/admin-search-input';
import AdminPublicCode from '@/shared/ui/admin-table/AdminPublicCode';
import LazyConfirmDialog from '@/shared/ui/confirm-dialog/lazy-confirm-dialog';
import {
  AdminTableLayout,
  adminTableBodyCellCenterClassName,
  adminTableBodyCellLeftClassName,
  adminTableCardClassName,
  adminTableCardStyle,
  adminTableCompactPopoverPanelClassName,
  adminTableContentClassName,
  adminTableHeaderCellCenterClassName,
  adminTableHeaderCellLeftClassName,
  adminTableHeaderClassName,
  adminTableHeaderContentClassName,
  adminTableHeaderTextClassName,
  adminTableInlineActionRowClassName,
  adminTableInlineCancelButtonClassName,
  adminTableInlineCancelIconClassName,
  adminTableInlineConfirmButtonClassName,
  adminTableInlineConfirmIconClassName,
  adminTableInlineEditInputClassName,
  adminTableMatchingValueActiveClassName,
  adminTableMatchingValueBaseClassName,
  adminTableNeutralIconButtonClassName,
  adminTablePopoverPanelClassName,
  adminTablePopoverPrimaryButtonClassName,
  adminTablePopoverSecondaryButtonClassName,
  adminTableSearchIconClassName,
  adminTableSearchInputClassName,
  adminTableSelectedDangerIconButtonClassName,
  adminTableToolbarActionsClassName,
  adminTableToolbarGroupClassName,
  adminTableToolbarSearchWrapperClassName,
  ColumnVisibilityControl
} from '@/shared/ui/admin-table';
import AdminFilterInput from '@/shared/ui/admin-filter-input';
import {
  HeaderFilterPortal,
  HEADER_FILTER_BUTTON_CLASS,
  HEADER_FILTER_ROOT_ATTR,
  getHeaderPopoverStyle,
  useHeaderFilterDismiss
} from '@/shared/ui/admin-header-filter';
import AdminRangeFilterPanel, {
  type RangePreset
} from '@/shared/ui/admin-range-filter-panel';
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
import AdminCreateManualQuoteRequestButton from '@/admin/features/quotes/components/AdminCreateManualQuoteRequestButton';
import AdminQuoteOfferCell from '@/admin/features/quotes/components/AdminQuoteOfferCell';
import AdminManualShippingPendingValue from '@/admin/features/shipping/components/AdminManualShippingPendingValue';
import AdminAnalyticsComparisonRow, {
  createAdminAnalyticsTrend
} from '@/shared/ui/admin-analytics-comparison-row';
import AdminAnalyticsSummaryCard from '@/shared/ui/admin-analytics-summary-card';
import { IconButton } from '@/shared/ui/icon-button';
import { AdminCheckbox } from '@/shared/ui/checkbox';
import { Input } from '@/shared/ui/input';
import { Spinner } from '@/shared/ui/loading';
import { MenuItem, MenuPanel } from '@/shared/ui/menu';
import { EuiTablePagination } from '@/shared/ui/pagination';
import { EmptyState, RowActions, RowActionsDropdown, Table, TBody, TD, THead, TH, TR } from '@/shared/ui/table';
import { useToast } from '@/shared/ui/toast';
import {
  adminStatusInfoPillClassName,
  adminTableRowToneClasses,
  adminTextButtonTypographyTokenClasses,
  filterPillClearGlyph,
  filterPillTokenClasses
} from '@/shared/ui/theme/tokens';

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
const QUOTE_TOTAL_COLUMN_LABEL = 'Skupaj';

type QuoteColumnKey =
  | 'request'
  | 'date'
  | 'customer'
  | 'address'
  | 'type'
  | 'status'
  | 'total'
  | 'offer';

const QUOTE_COLUMN_OPTIONS: Array<{ key: QuoteColumnKey; label: string }> = [
  { key: 'date', label: 'Datum' },
  { key: 'customer', label: 'Naročnik' },
  { key: 'address', label: 'Naslov' },
  { key: 'type', label: 'Tip' },
  { key: 'status', label: 'Status' },
  { key: 'total', label: QUOTE_TOTAL_COLUMN_LABEL },
  { key: 'offer', label: 'PDF' }
];

const FILTERS: ReadonlyArray<{ value: AdminQuoteStatusFilter; label: string }> = [
  { value: 'all', label: 'Vse' },
  ...QUOTE_REQUEST_VISIBLE_STATUS_OPTIONS.map(({ value, label }) => ({
    value,
    label
  }))
];

const CUSTOMER_TYPE_FILTERS: ReadonlyArray<{
  value: AdminQuoteCustomerTypeFilter;
  label: string;
}> = [
  { value: 'all', label: 'Vsi' },
  { value: 'school', label: 'Šola' },
  { value: 'company', label: 'Podjetje' },
  { value: 'individual', label: 'Fiz. oseba' }
];

const QUOTE_QUICK_DATE_RANGE_OPTIONS: ReadonlyArray<{
  key: AdminQuoteQuickDateRange;
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
const QUOTE_DATE_PRESET_BUTTON_CLASS =
  'inline-flex h-8 items-center justify-center gap-1 rounded-md border border-slate-200 bg-slate-50/80 px-2.5 text-slate-600 transition-colors hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 focus:border-[#3e67d6] focus:outline-none focus:ring-0 focus-visible:border-[#3e67d6] focus-visible:outline-none focus-visible:ring-0';
const QUOTE_DATE_PRESET_VALUE_CLASS =
  'text-[12px] font-semibold leading-none text-slate-800';
const QUOTE_DATE_PRESET_UNIT_CLASS =
  'text-[10px] font-medium leading-none text-slate-500';

const quoteDateFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Ljubljana',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

const toLjubljanaDateInputValue = (value: string | null) => {
  const parsedDate = value ? new Date(value) : new Date();
  const safeDate = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  const parts = quoteDateFormatter.formatToParts(safeDate);
  const year = parts.find((part) => part.type === 'year')?.value ?? '';
  const month = parts.find((part) => part.type === 'month')?.value ?? '';
  const day = parts.find((part) => part.type === 'day')?.value ?? '';
  return normalizeAdminQuoteDateBound(`${year}-${month}-${day}`);
};

const formatQuoteDateRangeBound = (value: string) => {
  const normalizedValue = normalizeAdminQuoteDateBound(value);
  if (!normalizedValue) return '—';
  const [year, month, day] = normalizedValue.split('-');
  return `${day}.${month}.${year}`;
};

const QUOTE_NUMERIC_RANGE_PRESETS: RangePreset[] = [
  '20',
  '50',
  '100',
  '200',
  '500',
  '1000'
].map((maxValue) => ({
  label: `0-${maxValue === '1000' ? '1k' : maxValue}`,
  value: { min: '0', max: maxValue }
}));

const statusClassName = (status: string) => {
  const tone = getQuoteRequestStatusPresentation(status).tone;
  if (tone === 'success') return 'bg-emerald-50 text-emerald-700';
  if (tone === 'danger') return 'bg-rose-50 text-rose-700';
  if (tone === 'warning') return 'bg-amber-50 text-amber-800';
  if (tone === 'info') return 'bg-blue-50 text-blue-700';
  return 'bg-slate-100 text-slate-700';
};

function QuoteStatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full ${adminStatusInfoPillClassName} ${statusClassName(status)}`}
    >
      {getQuoteRequestStatusLabel(status)}
    </span>
  );
}

const formatQuoteRequestNumber = (value: string) => {
  const match = value.trim().match(/(\d+)$/u);
  if (!match) return value;
  const numeric = Number(match[1]);
  return Number.isSafeInteger(numeric) ? `#${numeric}` : `#${match[1]}`;
};

const normalizeMatchingValue = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .trim();

const formatCurrency = (value: number | null, currency = 'EUR') =>
  value === null
    ? '—'
    : new Intl.NumberFormat('sl-SI', { style: 'currency', currency }).format(value);

const formatQuoteTableAddress = (
  row: Pick<AdminQuoteListRow, 'addressLine1' | 'postalCode' | 'city'>
) =>
  formatStructuredOrderAddress({
    addressLine1: row.addressLine1,
    postalCode: row.postalCode,
    city: row.city
  }) || '—';

const formatHours = (value: number | null) => value === null ? '—' : `${value.toFixed(1)} h`;

function buildListHref(input: {
  pathname: string;
  query: string;
  status: AdminQuoteStatusFilter;
  customerType: AdminQuoteCustomerTypeFilter;
  fromDate: string;
  toDate: string;
  minRequestNumber: string;
  maxRequestNumber: string;
  minTotal: string;
  maxTotal: string;
  page: number;
  pageSize: number;
}) {
  const params = new URLSearchParams({ view: 'quotes' });
  if (input.query) params.set('q', input.query);
  if (input.status !== 'all') params.set('quoteStatus', input.status);
  if (input.customerType !== 'all') {
    params.set('quoteCustomerType', input.customerType);
  }
  const normalizedDateRange = normalizeAdminQuoteDateRange(
    input.fromDate,
    input.toDate
  );
  const normalizedFromDate = normalizedDateRange.from;
  const normalizedToDate = normalizedDateRange.to;
  if (normalizedFromDate) params.set('quoteFrom', normalizedFromDate);
  if (normalizedToDate) params.set('quoteTo', normalizedToDate);
  const normalizedRequestNumberRange = normalizeAdminQuoteRequestNumberRange(
    input.minRequestNumber,
    input.maxRequestNumber
  );
  if (normalizedRequestNumberRange.min) {
    params.set('quoteMinRequestNumber', normalizedRequestNumberRange.min);
  }
  if (normalizedRequestNumberRange.max) {
    params.set('quoteMaxRequestNumber', normalizedRequestNumberRange.max);
  }
  const normalizedMinTotal = normalizeAdminQuoteAmountBound(input.minTotal);
  const normalizedMaxTotal = normalizeAdminQuoteAmountBound(input.maxTotal);
  if (normalizedMinTotal) params.set('quoteMinTotal', normalizedMinTotal);
  if (normalizedMaxTotal) params.set('quoteMaxTotal', normalizedMaxTotal);
  if (input.page > 1) params.set('quotePage', String(input.page));
  if (input.pageSize !== 25) params.set('quotePageSize', String(input.pageSize));
  return `${input.pathname}?${params.toString()}`;
}

const formatPercentage = (value: number) => `${value.toFixed(1)} %`;

function FunnelSummary({ funnel }: { funnel: AdminQuoteFunnelPreview }) {
  const { overall, last30Days, previous30Days } = funnel;
  const cards = [
    {
      title: 'Povpraševanja',
      metric: formatSlInteger(overall.requests),
      comparisonValue: formatSlInteger(last30Days.requests),
      comparisonTrend: createAdminAnalyticsTrend(
        last30Days.requests,
        previous30Days.requests
      ),
      focusKey: 'ponudbe-requests'
    },
    {
      title: 'Izdane ponudbe',
      metric: formatSlInteger(overall.offersIssued),
      comparisonValue: formatSlInteger(last30Days.offersIssued),
      comparisonTrend: createAdminAnalyticsTrend(
        last30Days.offersIssued,
        previous30Days.offersIssued
      ),
      focusKey: 'ponudbe-offers-issued'
    },
    {
      title: 'Sprejeto / pretvorjeno',
      metric: formatSlInteger(overall.acceptedOrConverted),
      comparisonValue: formatSlInteger(last30Days.acceptedOrConverted),
      comparisonTrend: createAdminAnalyticsTrend(
        last30Days.acceptedOrConverted,
        previous30Days.acceptedOrConverted
      ),
      focusKey: 'ponudbe-accepted-converted'
    },
    {
      title: 'Konverzija',
      metric: formatPercentage(overall.conversionRate),
      comparisonValue: formatPercentage(last30Days.conversionRate),
      comparisonTrend: createAdminAnalyticsTrend(
        last30Days.conversionRate,
        previous30Days.conversionRate
      ),
      focusKey: 'ponudbe-conversion'
    },
    {
      title: 'Ponujena vrednost',
      metric: formatEuroWithSuffix(overall.quotedValue),
      comparisonValue: formatEuroWithSuffix(last30Days.quotedValue),
      comparisonTrend: createAdminAnalyticsTrend(
        last30Days.quotedValue,
        previous30Days.quotedValue
      ),
      focusKey: 'ponudbe-quoted-value'
    },
    {
      title: 'Vrednost povezanih naročil',
      metric: formatEuroWithSuffix(overall.convertedOrderValue),
      comparisonValue: formatEuroWithSuffix(last30Days.convertedOrderValue),
      comparisonTrend: createAdminAnalyticsTrend(
        last30Days.convertedOrderValue,
        previous30Days.convertedOrderValue
      ),
      focusKey: 'ponudbe-converted-order-value'
    }
  ];

  return (
    <section
      aria-label="Lijak ponudb"
      className="mb-3 grid gap-[14px] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
    >
      {cards.map((card) => (
        <AdminAnalyticsSummaryCard
          key={card.focusKey}
          href={`/admin/analitika/ponudbe?range=max&focus=${encodeURIComponent(card.focusKey)}`}
          title={card.title}
          metric={card.metric}
          focusKey={card.focusKey}
        >
          <AdminAnalyticsComparisonRow
            items={[
              {
                label: '30d',
                value: card.comparisonValue,
                trend: card.comparisonTrend
              }
            ]}
          />
        </AdminAnalyticsSummaryCard>
      ))}
      <p className="text-[11px] text-slate-500 sm:col-span-2 xl:col-span-6">
        Povprečno od povpraševanja do izdaje: {formatHours(overall.averageRequestToIssueHours)} · od izdaje do sprejema: {formatHours(overall.averageIssueToAcceptHours)}. Ponujena vrednost ni prihodek.
      </p>
    </section>
  );
}

type QuoteListUpdates = {
  query?: string;
  status?: AdminQuoteStatusFilter;
  customerType?: AdminQuoteCustomerTypeFilter;
  fromDate?: string;
  toDate?: string;
  minRequestNumber?: string;
  maxRequestNumber?: string;
  minTotal?: string;
  maxTotal?: string;
  page?: number;
  pageSize?: number;
};

type QuoteMatchingColumn =
  | 'date'
  | 'customer'
  | 'address'
  | 'type'
  | 'offer'
  | 'total';

type QuoteQuickEditState = {
  quoteRequestId: number;
  initialCustomerName: string;
  draftCustomerName: string;
  initialStatus: string;
  draftStatus: string;
  stateVersion: number;
  isSaving: boolean;
};

const hasCompleteEditableSnapshot = (row: AdminQuoteListRow) =>
  isManuallyEditableQuoteRequestStatus(row.status) &&
  ['individual', 'company', 'school'].includes(row.customerType) &&
  Boolean(
    row.contactName.trim() &&
    row.email.trim() &&
    row.addressLine1?.trim() &&
    row.postalCode?.trim() &&
    row.city?.trim() &&
    row.countryCode?.trim() &&
    row.quoteReason?.trim()
  );

export default function AdminQuotesTable({
  result,
  funnel,
  query,
  status,
  customerType,
  fromDate,
  toDate,
  minRequestNumber,
  maxRequestNumber,
  minTotal,
  maxTotal,
  page,
  pageSize
}: {
  result: AdminQuoteListPage;
  funnel: AdminQuoteFunnelPreview | null;
  query: string;
  status: AdminQuoteStatusFilter;
  customerType: AdminQuoteCustomerTypeFilter;
  fromDate: string;
  toDate: string;
  minRequestNumber: string;
  maxRequestNumber: string;
  minTotal: string;
  maxTotal: string;
  page: number;
  pageSize: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = useState(query);
  const [selected, setSelected] = useState<number[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteTargetIds, setDeleteTargetIds] = useState<number[] | null>(null);
  const [blockedDeleteReasons, setBlockedDeleteReasons] = useState<
    Record<number, string>
  >({});
  const [visibleColumns, setVisibleColumns] = useState<
    Record<QuoteColumnKey, boolean>
  >({
    request: true,
    date: true,
    customer: true,
    address: true,
    type: true,
    status: true,
    total: true,
    offer: true
  });
  const [openHeaderFilter, setOpenHeaderFilter] = useState<
    'request' | 'date' | 'type' | 'status' | 'total' | null
  >(null);
  const [draftRequestNumberRange, setDraftRequestNumberRange] = useState({
    min: minRequestNumber,
    max: maxRequestNumber
  });
  const [draftFromDate, setDraftFromDate] = useState(fromDate);
  const [draftToDate, setDraftToDate] = useState(toDate);
  const [draftTotalRange, setDraftTotalRange] = useState({
    min: minTotal,
    max: maxTotal
  });
  const [quickEdit, setQuickEdit] = useState<QuoteQuickEditState | null>(null);
  const [rowOverrides, setRowOverrides] = useState<
    Record<number, Partial<AdminQuoteListRow>>
  >({});
  const [hoveredCellMatch, setHoveredCellMatch] = useState<{
    column: QuoteMatchingColumn;
    value: string;
  } | null>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const requestFilterButtonRef = useRef<HTMLButtonElement>(null);
  const dateFilterButtonRef = useRef<HTMLButtonElement>(null);
  const typeFilterButtonRef = useRef<HTMLButtonElement>(null);
  const statusFilterButtonRef = useRef<HTMLButtonElement>(null);
  const totalFilterButtonRef = useRef<HTMLButtonElement>(null);
  const pageCount = Math.max(1, Math.ceil(result.totalCount / pageSize));
  const activeCustomerTypeLabel =
    CUSTOMER_TYPE_FILTERS.find((filter) => filter.value === customerType)
      ?.label ?? getCustomerTypeLabel(customerType);
  const activeStatusLabel = FILTERS.find((filter) => filter.value === status)?.label ?? status;
  const hasRequestNumberFilter = Boolean(minRequestNumber || maxRequestNumber);
  const hasCustomerTypeFilter = customerType !== 'all';
  const hasDateFilter = Boolean(fromDate || toDate);
  const hasTotalFilter = Boolean(minTotal || maxTotal);
  const activeDateRangeLabel = `${formatQuoteDateRangeBound(fromDate)} – ${formatQuoteDateRangeBound(toDate)}`;
  const activeRequestNumberRangeLabel = `#${minRequestNumber || '0'} – #${maxRequestNumber || '∞'}`;
  const activeTotalRangeLabel = `${minTotal || '0'} – ${maxTotal || '∞'} €`;
  const latestQuoteDate = useMemo(
    () => toLjubljanaDateInputValue(result.latestCreatedAt),
    [result.latestCreatedAt]
  );
  const visibleQuoteIds = useMemo(
    () => result.rows.map((row) => row.id),
    [result.rows]
  );
  const selectedVisibleCount = visibleQuoteIds.filter((id) =>
    selected.includes(id)
  ).length;
  const allSelected =
    visibleQuoteIds.length > 0 &&
    selectedVisibleCount === visibleQuoteIds.length;
  const deletableSelectedIds = selected.filter(
    (id) => !blockedDeleteReasons[id]
  );

  useEffect(() => {
    setSearch(query);
  }, [query]);

  useEffect(() => {
    setDraftRequestNumberRange({
      min: minRequestNumber,
      max: maxRequestNumber
    });
  }, [maxRequestNumber, minRequestNumber]);

  useEffect(() => {
    setDraftFromDate(fromDate);
    setDraftToDate(toDate);
  }, [fromDate, toDate]);

  useEffect(() => {
    setDraftTotalRange({ min: minTotal, max: maxTotal });
  }, [maxTotal, minTotal]);

  useEffect(() => {
    const visibleIdSet = new Set(visibleQuoteIds);
    setSelected((current) => {
      const next = current.filter((id) => visibleIdSet.has(id));
      return next.length === current.length ? current : next;
    });
  }, [visibleQuoteIds]);

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate =
      selectedVisibleCount > 0 && !allSelected;
  }, [allSelected, selectedVisibleCount]);

  useHeaderFilterDismiss({
    isOpen: openHeaderFilter !== null,
    onClose: () => setOpenHeaderFilter(null)
  });

  const updateList = useCallback((updates: QuoteListUpdates = {}) => {
    router.replace(
      buildListHref({
        pathname,
        query: (updates.query ?? search).trim(),
        status: updates.status ?? status,
        customerType: updates.customerType ?? customerType,
        fromDate: updates.fromDate ?? fromDate,
        toDate: updates.toDate ?? toDate,
        minRequestNumber: updates.minRequestNumber ?? minRequestNumber,
        maxRequestNumber: updates.maxRequestNumber ?? maxRequestNumber,
        minTotal: updates.minTotal ?? minTotal,
        maxTotal: updates.maxTotal ?? maxTotal,
        page: updates.page ?? page,
        pageSize: updates.pageSize ?? pageSize
      }),
      { scroll: false }
    );
  }, [customerType, fromDate, maxRequestNumber, maxTotal, minRequestNumber, minTotal, page, pageSize, pathname, router, search, status, toDate]);

  useEffect(() => {
    const normalizedSearch = search.trim();
    if (normalizedSearch === query) return;

    const timeoutId = window.setTimeout(() => {
      updateList({ query: normalizedSearch, page: 1 });
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [query, search, updateList]);

  useEffect(() => {
    if (page <= pageCount) return;
    updateList({ page: pageCount });
  }, [page, pageCount, updateList]);

  const resetFilters = () => {
    setSearch('');
    setDraftRequestNumberRange({ min: '', max: '' });
    setDraftFromDate('');
    setDraftToDate('');
    setDraftTotalRange({ min: '', max: '' });
    updateList({
      query: '',
      status: 'all',
      customerType: 'all',
      fromDate: '',
      toDate: '',
      minRequestNumber: '',
      maxRequestNumber: '',
      minTotal: '',
      maxTotal: '',
      page: 1
    });
  };

  const toggleSelected = (id: number) => {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id]
    );
  };

  const toggleAll = () => {
    setSelected((current) => {
      if (allSelected) {
        const visibleIdSet = new Set(visibleQuoteIds);
        return current.filter((id) => !visibleIdSet.has(id));
      }
      return Array.from(new Set([...current, ...visibleQuoteIds]));
    });
  };

  const openDeleteSelected = () => {
    if (deletableSelectedIds.length === 0) {
      const firstBlockedReason = selected
        .map((id) => blockedDeleteReasons[id])
        .find(Boolean);
      if (firstBlockedReason) toast.error(firstBlockedReason);
      return;
    }
    setDeleteTargetIds(deletableSelectedIds);
  };

  const openDeleteRow = (rowId: number) => {
    const blockedReason = blockedDeleteReasons[rowId];
    if (blockedReason) {
      toast.error(blockedReason);
      return;
    }
    setDeleteTargetIds([rowId]);
  };

  const confirmDeleteRequests = async () => {
    if (!deleteTargetIds?.length || isDeleting) return;
    const targets = [...deleteTargetIds];
    setDeleteTargetIds(null);
    setIsDeleting(true);

    try {
      const results = await Promise.all(
        targets.map(async (rowId) => {
          try {
            const sourceRow = result.rows.find((row) => row.id === rowId);
            const expectedStateVersion = Number(
              rowOverrides[rowId]?.stateVersion ?? sourceRow?.stateVersion
            );
            const response = await fetch(`/api/admin/quote-requests/${rowId}`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: Number.isSafeInteger(expectedStateVersion) && expectedStateVersion > 0
                ? JSON.stringify({ expectedStateVersion })
                : undefined
            });
            const payload = (await response.json().catch(() => null)) as {
              code?: string;
              message?: string;
            } | null;
            return {
              rowId,
              ok: response.ok,
              blocked:
                response.status === 409 &&
                payload?.code === 'QUOTE_REQUEST_VOID_BLOCKED',
              message:
                payload?.message ??
                (response.ok
                  ? 'Povpraševanje je izbrisano.'
                  : 'Povpraševanja ni bilo mogoče izbrisati.')
            };
          } catch {
            return {
              rowId,
              ok: false,
              blocked: false,
              message: 'Povpraševanja ni bilo mogoče izbrisati.'
            };
          }
        })
      );

      const successfulIds = new Set(
        results.filter((resultItem) => resultItem.ok).map((resultItem) => resultItem.rowId)
      );
      const failures = results.filter((resultItem) => !resultItem.ok);
      const lifecycleBlocks = failures.filter((resultItem) => resultItem.blocked);

      if (successfulIds.size > 0) {
        setSelected((current) => current.filter((id) => !successfulIds.has(id)));
        setRowOverrides((current) => {
          const next = { ...current };
          successfulIds.forEach((id) => delete next[id]);
          return next;
        });
        toast.success(
          successfulIds.size === 1
            ? 'Povpraševanje je izbrisano.'
            : `Izbrisanih povpraševanj: ${successfulIds.size}.`
        );
      }

      if (lifecycleBlocks.length > 0) {
        setBlockedDeleteReasons((current) => {
          const next = { ...current };
          lifecycleBlocks.forEach((resultItem) => {
            next[resultItem.rowId] = resultItem.message;
          });
          return next;
        });
      }

      if (failures.length > 0) {
        const firstMessage = failures[0]?.message ?? 'Brisanje ni uspelo.';
        toast.error(
          failures.length === 1
            ? firstMessage
            : `Brisanje ni uspelo za ${failures.length} povpraševanj. ${firstMessage}`
        );
      }

      if (successfulIds.size > 0) router.refresh();
    } finally {
      setIsDeleting(false);
    }
  };

  const downloadFile = async (url: string, filename: string) => {
    const response = await fetch(url);
    if (!response.ok) return false;

    const blob = await response.blob();
    const tempLink = document.createElement('a');
    tempLink.href = URL.createObjectURL(blob);
    tempLink.download = filename;
    document.body.appendChild(tempLink);
    tempLink.click();
    tempLink.remove();
    URL.revokeObjectURL(tempLink.href);
    return true;
  };

  const handleDownloadDocuments = async () => {
    if (isDownloading) return;
    setIsDownloading(true);

    try {
      const sourceRows =
        selected.length > 0
          ? result.rows.filter((row) => selected.includes(row.id))
          : result.rows;
      const files = sourceRows.flatMap((row) =>
        row.downloadableDocuments.map((documentItem) => ({
          url: `/api/admin/quote-requests/${row.id}/documents/${documentItem.id}`,
          filename: `${row.quoteCode}-${documentItem.filename}`
        }))
      );

      if (files.length === 0) {
        toast.info('Ni dokumentov za prenos glede na trenutno izbiro.');
        return;
      }

      let downloadedCount = 0;
      for (const file of files) {
        if (await downloadFile(file.url, file.filename)) downloadedCount += 1;
      }

      if (downloadedCount === 0) {
        toast.error('Dokumentov ni bilo mogoče prenesti.');
        return;
      }
      toast.success(`Prenesenih dokumentov: ${downloadedCount}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const getEffectiveRow = (row: AdminQuoteListRow): AdminQuoteListRow => ({
    ...row,
    ...(rowOverrides[row.id] ?? {})
  });

  const getMatchingValueClassName = (
    column: QuoteMatchingColumn,
    value: string
  ) =>
    hoveredCellMatch?.column === column &&
    hoveredCellMatch.value === normalizeMatchingValue(value)
      ? adminTableMatchingValueActiveClassName
      : '';

  const setMatchingValue = (column: QuoteMatchingColumn, value: string) =>
    setHoveredCellMatch({ column, value: normalizeMatchingValue(value) });

  const startQuickEdit = (row: AdminQuoteListRow) => {
    if (quickEdit && quickEdit.quoteRequestId !== row.id) {
      toast.error('Najprej shranite ali prekličite trenutno hitro urejanje.');
      return;
    }
    if (!hasCompleteEditableSnapshot(row)) {
      toast.error('Izdane in zaključene ponudbe urejajte v podrobnem pogledu.');
      return;
    }
    setQuickEdit({
      quoteRequestId: row.id,
      initialCustomerName: row.customerName,
      draftCustomerName: row.customerName,
      initialStatus: row.status,
      draftStatus: row.status,
      stateVersion: row.stateVersion,
      isSaving: false
    });
  };

  const cancelQuickEdit = () => setQuickEdit(null);

  const saveQuickEdit = async () => {
    if (!quickEdit || quickEdit.isSaving) return;
    const sourceRow = result.rows.find(
      (row) => row.id === quickEdit.quoteRequestId
    );
    if (!sourceRow) return;

    const row = getEffectiveRow(sourceRow);
    const customerName = quickEdit.draftCustomerName.trim();
    const nextStatus = quickEdit.draftStatus;
    const isDirty =
      customerName !== quickEdit.initialCustomerName.trim() ||
      nextStatus !== quickEdit.initialStatus;
    if (
      !customerName ||
      !isDirty ||
      !isManuallyEditableQuoteRequestStatus(nextStatus)
    ) {
      return;
    }

    setQuickEdit((current) =>
      current ? { ...current, isSaving: true } : current
    );
    try {
      const response = await fetch(
        `/api/admin/quote-requests/${row.id}/details`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            expectedRequestStateVersion: quickEdit.stateVersion,
            status: nextStatus,
            customerType: row.customerType,
            organizationName:
              row.customerType === 'individual' ? '' : customerName,
            contactName:
              row.customerType === 'individual'
                ? customerName
                : row.contactName,
            email: row.email,
            addressLine1: row.addressLine1 ?? '',
            addressLine2: row.addressLine2 ?? '',
            postalCode: row.postalCode ?? '',
            city: row.city ?? '',
            countryCode: row.countryCode ?? 'SI',
            reference: row.reference ?? '',
            quoteReason: row.quoteReason ?? 'formal_offer',
            customerMessage: row.customerMessage ?? ''
          })
        }
      );
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
        stateVersion?: number;
        status?: string;
      } | null;
      if (!response.ok) {
        throw new Error(
          payload?.message ?? 'Povpraševanja ni bilo mogoče shraniti.'
        );
      }

      const stateVersion = Number(payload?.stateVersion);
      const storedStatus = payload?.status ?? nextStatus;
      setRowOverrides((current) => ({
        ...current,
        [row.id]: {
          ...current[row.id],
          customerName,
          organizationName:
            row.customerType === 'individual' ? null : customerName,
          contactName:
            row.customerType === 'individual'
              ? customerName
              : row.contactName,
          status: storedStatus,
          stateVersion:
            Number.isSafeInteger(stateVersion) && stateVersion > 0
              ? stateVersion
              : row.stateVersion
        }
      }));
      setQuickEdit(null);
      toast.success(payload?.message ?? 'Povpraševanje je shranjeno.');
      router.refresh();
    } catch (error) {
      setQuickEdit((current) =>
        current ? { ...current, isSaving: false } : current
      );
      toast.error(
        error instanceof Error
          ? error.message
          : 'Povpraševanja ni bilo mogoče shraniti.'
      );
    }
  };

  const handleQuickEditKeyDown = (
    event: ReactKeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void saveQuickEdit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancelQuickEdit();
    }
  };

  return (
    <div className="w-full" data-testid="admin-quotes-table">
      {funnel ? <FunnelSummary funnel={funnel} /> : null}

      {deleteTargetIds ? (
        <LazyConfirmDialog
          open={deleteTargetIds.length > 0}
          title={deleteTargetIds.length === 1 ? 'Izbris povpraševanja' : 'Izbris povpraševanj'}
          description={
            deleteTargetIds.length === 1
              ? 'Ali ste prepričani, da želite izbrisati to povpraševanje?'
              : `Ali ste prepričani, da želite izbrisati ${deleteTargetIds.length} povpraševanj?`
          }
          confirmLabel="Izbriši"
          cancelLabel="Prekliči"
          isDanger
          onCancel={() => setDeleteTargetIds(null)}
          onConfirm={() => void confirmDeleteRequests()}
          confirmDisabled={isDeleting}
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
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Poišči povpraševanja in ponudbe"
                aria-label="Poišči povpraševanja in ponudbe"
                wrapperClassName={adminTableToolbarSearchWrapperClassName}
                inputClassName={adminTableSearchInputClassName}
                iconClassName={adminTableSearchIconClassName}
              />
            </div>
          </div>
        }
        headerRight={
          <div
            className={adminTableToolbarActionsClassName}
            data-testid="quote-table-toolbar-actions"
          >
            <IconButton
              type="button"
              onClick={() => void handleDownloadDocuments()}
              disabled={isDownloading}
              tone="neutral"
              size="sm"
              className={adminTableNeutralIconButtonClassName}
              aria-label={
                selected.length > 0
                  ? `Prenesi izbrane (${selected.length})`
                  : 'Prenesi vse dokumente'
              }
              title={
                selected.length > 0
                  ? `Prenesi (${selected.length})`
                  : 'Prenesi vse'
              }
            >
              {isDownloading ? (
                <Spinner size="sm" className="text-slate-500" />
              ) : (
                <DownloadIcon />
              )}
            </IconButton>
            <ColumnVisibilityControl
              options={QUOTE_COLUMN_OPTIONS}
              visibleMap={visibleColumns}
              onToggle={(key) => {
                if (key === 'request') return;
                setVisibleColumns((current) => ({
                  ...current,
                  [key]: !current[key as QuoteColumnKey]
                }));
              }}
              showLabel={false}
              triggerClassName={adminTableNeutralIconButtonClassName}
              icon={<PanelAddRemoveIcon className="!scale-[0.8]" />}
              menuWidth={164}
            />
            <IconButton
              type="button"
              onClick={openDeleteSelected}
              disabled={deletableSelectedIds.length === 0 || isDeleting}
              tone={deletableSelectedIds.length > 0 ? 'danger' : 'neutral'}
              size="sm"
              className={
                deletableSelectedIds.length > 0
                  ? adminTableSelectedDangerIconButtonClassName
                  : `${adminTableNeutralIconButtonClassName} !transition-none`
              }
              aria-label="Izbriši izbrana povpraševanja"
              title={
                selected.length > 0 && deletableSelectedIds.length === 0
                  ? 'Izbranih povpraševanj ni dovoljeno izbrisati'
                  : 'Izbriši'
              }
              data-testid="quote-table-delete-selected"
            >
              {isDeleting ? (
                <Spinner size="sm" className="text-[var(--danger-600)]" />
              ) : (
                <TrashCanIcon />
              )}
            </IconButton>
            <AdminCreateManualQuoteRequestButton />
          </div>
        }
        filterRowLeft={
          hasRequestNumberFilter || hasDateFilter || hasCustomerTypeFilter || status !== 'all' || hasTotalFilter ? (
            <div className="flex flex-wrap items-center gap-2">
              {hasRequestNumberFilter ? (
                <span className={filterPillTokenClasses.base}>
                  <span>
                    P/P:{' '}
                    <span className="font-semibold">
                      {activeRequestNumberRangeLabel}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setDraftRequestNumberRange({ min: '', max: '' });
                      updateList({
                        minRequestNumber: '',
                        maxRequestNumber: '',
                        page: 1
                      });
                    }}
                    className={filterPillTokenClasses.clear}
                    aria-label={`Odstrani filter P/P ${activeRequestNumberRangeLabel}`}
                  >
                    {filterPillClearGlyph}
                  </button>
                </span>
              ) : null}
              {hasDateFilter ? (
                <span className={filterPillTokenClasses.base}>
                  <span>
                    Datum:{' '}
                    <span className="font-semibold">{activeDateRangeLabel}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setDraftFromDate('');
                      setDraftToDate('');
                      updateList({ fromDate: '', toDate: '', page: 1 });
                    }}
                    className={filterPillTokenClasses.clear}
                    aria-label={`Odstrani filter Datum ${activeDateRangeLabel}`}
                  >
                    {filterPillClearGlyph}
                  </button>
                </span>
              ) : null}
              {hasCustomerTypeFilter ? (
                <span className={filterPillTokenClasses.base}>
                  <span>
                    Tip:{' '}
                    <span className="font-semibold">
                      {activeCustomerTypeLabel}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      updateList({ customerType: 'all', page: 1 })
                    }
                    className={filterPillTokenClasses.clear}
                    aria-label={`Odstrani filter Tip ${activeCustomerTypeLabel}`}
                  >
                    {filterPillClearGlyph}
                  </button>
                </span>
              ) : null}
              {status !== 'all' ? (
                <span className={filterPillTokenClasses.base}>
                  <span>
                    Status:{' '}
                    <span className="font-semibold">{activeStatusLabel}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => updateList({ status: 'all', page: 1 })}
                    className={filterPillTokenClasses.clear}
                    aria-label={`Odstrani filter Status ${activeStatusLabel}`}
                  >
                    {filterPillClearGlyph}
                  </button>
                </span>
              ) : null}
              {hasTotalFilter ? (
                <span className={filterPillTokenClasses.base}>
                  <span>
                    {QUOTE_TOTAL_COLUMN_LABEL}:{' '}
                    <span className="font-semibold">{activeTotalRangeLabel}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      updateList({ minTotal: '', maxTotal: '', page: 1 })
                    }
                    className={filterPillTokenClasses.clear}
                    aria-label={`Odstrani filter ${QUOTE_TOTAL_COLUMN_LABEL} ${activeTotalRangeLabel}`}
                  >
                    {filterPillClearGlyph}
                  </button>
                </span>
              ) : null}
            </div>
          ) : null
        }
        filterRowRight={
          <EuiTablePagination
            page={page}
            pageCount={pageCount}
            onPageChange={(nextPage) => updateList({ page: nextPage })}
            itemsPerPage={pageSize}
            onChangeItemsPerPage={(nextPageSize) => updateList({ page: 1, pageSize: nextPageSize })}
            itemsPerPageOptions={PAGE_SIZE_OPTIONS}
          />
        }
        footerRight={
          <EuiTablePagination
            page={page}
            pageCount={pageCount}
            onPageChange={(nextPage) => updateList({ page: nextPage })}
            itemsPerPage={pageSize}
            onChangeItemsPerPage={(nextPageSize) => updateList({ page: 1, pageSize: nextPageSize })}
            itemsPerPageOptions={PAGE_SIZE_OPTIONS}
          />
        }
      >
        <Table className="min-w-[1375px] w-full table-fixed border-collapse text-[12px] [&_thead_th]:!border-slate-200">
          <colgroup>
            <col className="w-[40px]" />
            <col className="w-[190px]" />
            {visibleColumns.date ? <col className="w-[125px]" /> : null}
            {visibleColumns.customer ? <col className="w-[150px]" /> : null}
            {visibleColumns.address ? <col /> : null}
            {visibleColumns.type ? <col className="w-[100px]" /> : null}
            {visibleColumns.status ? <col className="w-[190px]" /> : null}
            {visibleColumns.total ? <col className="w-[155px]" /> : null}
            {visibleColumns.offer ? <col className="w-[160px]" /> : null}
            <col className="w-[72px]" />
          </colgroup>
          <THead className="border-t border-slate-200 bg-[color:var(--admin-table-header-bg)]">
            <TR>
              <TH className={`${adminTableHeaderCellCenterClassName} px-2`}>
                <div className="flex h-11 items-center justify-center">
                  <AdminCheckbox
                    ref={selectAllRef}
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Izberi vse"
                    className="block h-3.5 w-3.5"
                    data-testid="quote-table-select-all"
                  />
                </div>
              </TH>
              <TH className={adminTableHeaderCellCenterClassName}>
                <div className="flex h-11 items-center justify-center">
                  <div className={adminTableHeaderContentClassName} {...{ [HEADER_FILTER_ROOT_ATTR]: 'true' }}>
                    <span className={adminTableHeaderTextClassName}>Povpraševanje</span>
                    <button
                      ref={requestFilterButtonRef}
                      type="button"
                      data-active={openHeaderFilter === 'request'}
                      className={HEADER_FILTER_BUTTON_CLASS}
                      aria-label="Filtriraj po internem zaporedju"
                      onClick={(event) => {
                        event.stopPropagation();
                        setDraftRequestNumberRange({
                          min: minRequestNumber,
                          max: maxRequestNumber
                        });
                        setOpenHeaderFilter((current) =>
                          current === 'request' ? null : 'request'
                        );
                      }}
                    >
                      <ColumnFilterIcon className="!h-[12px] !w-[12px]" />
                    </button>
                  </div>
                </div>
              </TH>
              {visibleColumns.date ? <TH className={adminTableHeaderCellCenterClassName}>
                <div className="flex h-11 items-center justify-center">
                  <div className={adminTableHeaderContentClassName} {...{ [HEADER_FILTER_ROOT_ATTR]: 'true' }}>
                    <span className={adminTableHeaderTextClassName}>Datum</span>
                    <button
                      ref={dateFilterButtonRef}
                      type="button"
                      data-active={openHeaderFilter === 'date'}
                      className={HEADER_FILTER_BUTTON_CLASS}
                      aria-label="Filtriraj Datum"
                      onClick={(event) => {
                        event.stopPropagation();
                        setDraftFromDate(fromDate);
                        setDraftToDate(toDate);
                        setOpenHeaderFilter((current) =>
                          current === 'date' ? null : 'date'
                        );
                      }}
                    >
                      <ColumnFilterIcon className="!h-[12px] !w-[12px]" />
                    </button>
                  </div>
                </div>
              </TH> : null}
              {visibleColumns.customer ? <TH className={adminTableHeaderCellLeftClassName}>
                <div className="flex h-11 items-center"><span className={adminTableHeaderTextClassName}>Naročnik</span></div>
              </TH> : null}
              {visibleColumns.address ? <TH className={adminTableHeaderCellLeftClassName}>
                <div className="flex h-11 items-center"><span className={adminTableHeaderTextClassName}>Naslov</span></div>
              </TH> : null}
              {visibleColumns.type ? <TH className={adminTableHeaderCellCenterClassName}>
                <div className="flex h-11 items-center justify-center">
                  <div className={adminTableHeaderContentClassName} {...{ [HEADER_FILTER_ROOT_ATTR]: 'true' }}>
                    <span className={adminTableHeaderTextClassName}>Tip</span>
                    <button
                      ref={typeFilterButtonRef}
                      type="button"
                      data-active={openHeaderFilter === 'type'}
                      className={HEADER_FILTER_BUTTON_CLASS}
                      aria-label="Filtriraj Tip"
                      onClick={(event) => {
                        event.stopPropagation();
                        setOpenHeaderFilter((current) =>
                          current === 'type' ? null : 'type'
                        );
                      }}
                    >
                      <ColumnFilterIcon className="!h-[12px] !w-[12px]" />
                    </button>
                  </div>
                </div>
              </TH> : null}
              {visibleColumns.status ? <TH className={adminTableHeaderCellCenterClassName}>
                <div className="flex h-11 items-center justify-center">
                  <div className={adminTableHeaderContentClassName} {...{ [HEADER_FILTER_ROOT_ATTR]: 'true' }}>
                    <span className={adminTableHeaderTextClassName}>Status</span>
                    <button
                      ref={statusFilterButtonRef}
                      type="button"
                      data-active={openHeaderFilter === 'status'}
                      className={HEADER_FILTER_BUTTON_CLASS}
                      aria-label="Filtriraj Status"
                      onClick={(event) => {
                        event.stopPropagation();
                        setOpenHeaderFilter((current) =>
                          current === 'status' ? null : 'status'
                        );
                      }}
                    >
                      <ColumnFilterIcon className="!h-[12px] !w-[12px]" />
                    </button>
                  </div>
                </div>
              </TH> : null}
              {visibleColumns.total ? <TH className={adminTableHeaderCellCenterClassName}>
                <div className="flex h-11 items-center justify-center">
                  <div className={adminTableHeaderContentClassName} {...{ [HEADER_FILTER_ROOT_ATTR]: 'true' }}>
                    <span className={adminTableHeaderTextClassName}>{QUOTE_TOTAL_COLUMN_LABEL}</span>
                    <button
                      ref={totalFilterButtonRef}
                      type="button"
                      data-active={openHeaderFilter === 'total'}
                      className={HEADER_FILTER_BUTTON_CLASS}
                      aria-label={`Filtriraj ${QUOTE_TOTAL_COLUMN_LABEL}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setDraftTotalRange({ min: minTotal, max: maxTotal });
                        setOpenHeaderFilter((current) =>
                          current === 'total' ? null : 'total'
                        );
                      }}
                    >
                      <ColumnFilterIcon className="!h-[12px] !w-[12px]" />
                    </button>
                  </div>
                </div>
              </TH> : null}
              {visibleColumns.offer ? <TH className={adminTableHeaderCellCenterClassName}>
                <div className="flex h-11 items-center justify-center"><span className={adminTableHeaderTextClassName}>PDF</span></div>
              </TH> : null}
              <TH className={adminTableHeaderCellCenterClassName}>
                <div className="flex h-11 items-center justify-center"><span className={adminTableHeaderTextClassName}>Uredi</span></div>
              </TH>
            </TR>
          </THead>
          <TBody>
            {result.rows.length === 0 ? (
              <TR>
                <TD
                  colSpan={
                    Object.values(visibleColumns).filter(Boolean).length + 2
                  }
                  className="px-3 py-8 text-center text-slate-500"
                >
                  <EmptyState
                    title="Ni zadetkov za izbrane filtre."
                    action={
                      query ||
                      hasRequestNumberFilter ||
                      hasDateFilter ||
                      hasCustomerTypeFilter ||
                      status !== 'all' ||
                      hasTotalFilter ? (
                      <button
                        type="button"
                        onClick={resetFilters}
                        className={`rounded-md border border-slate-300 px-3 py-1 text-slate-700 hover:border-[color:var(--blue-500)] hover:bg-[color:var(--hover-neutral)] ${adminTextButtonTypographyTokenClasses}`}
                      >
                        Prikaži vsa povpraševanja
                      </button>
                      ) : null
                    }
                  />
                </TD>
              </TR>
            ) : result.rows.map((sourceRow) => {
              const row = getEffectiveRow(sourceRow);
              const activeQuickEdit =
                quickEdit?.quoteRequestId === row.id ? quickEdit : null;
              const isRowQuickEditing = activeQuickEdit !== null;
              const displayRequestNumber = formatQuoteRequestNumber(
                row.requestNumber
              );
              const dateLabel = formatSlDate(row.createdAt);
              const dateTimeLabel = formatSlDateTime(row.createdAt);
              const addressLabel = formatQuoteTableAddress(row);
              const customerTypeLabel = getCustomerTypeLabel(row.customerType);
              const totalLabel =
                row.quotedTotal === null && row.shippingRequiresManualEntry
                  ? 'N/A'
                  : formatCurrency(row.quotedTotal, row.currency);
              const linkedOrderCode = row.resultingOrderId
                ? row.resultingOrderCode
                : null;
              const isQuickEditDirty = activeQuickEdit
                ? activeQuickEdit.draftCustomerName.trim() !==
                    activeQuickEdit.initialCustomerName.trim() ||
                  activeQuickEdit.draftStatus !== activeQuickEdit.initialStatus
                : false;
              const isQuickEditValid = Boolean(
                activeQuickEdit?.draftCustomerName.trim() &&
                activeQuickEdit &&
                isManuallyEditableQuoteRequestStatus(
                  activeQuickEdit.draftStatus
                )
              );
              const isSelected = selected.includes(row.id);

              return (
                <TR
                  key={row.id}
                  data-testid={`quote-table-row-${row.id}`}
                  className={`h-12 border-t border-slate-200/90 bg-white text-[12px] transition-colors duration-200 ${
                    isSelected
                      ? adminTableRowToneClasses.selected
                      : adminTableRowToneClasses.hover
                  }`}
                >
                  <TD
                    className={`${adminTableBodyCellCenterClassName} px-2`}
                    data-no-row-nav
                  >
                    <div className="flex h-12 items-center justify-center">
                      <AdminCheckbox
                        checked={isSelected}
                        onChange={() => toggleSelected(row.id)}
                        aria-label={`Izberi povpraševanje ${displayRequestNumber}`}
                        className="h-3.5 w-3.5"
                        data-testid={`quote-table-select-${row.id}`}
                      />
                    </div>
                  </TD>
                  <TD
                    className={adminTableBodyCellCenterClassName}
                    data-no-row-nav
                  >
                    <div
                      className="flex h-12 w-full flex-col items-center justify-center gap-0.5 whitespace-nowrap"
                      data-testid={`quote-number-cell-${row.id}`}
                    >
                      <Link
                        href={`/admin/orders/quotes/${row.id}`}
                        prefetch={false}
                        className="inline-flex items-center justify-center rounded-sm text-center text-[11px] font-semibold tabular-nums text-slate-900 transition-colors hover:text-[color:var(--blue-500)] hover:underline underline-offset-2 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-[#3e67d6]"
                        aria-label={`Odpri povpraševanje ${displayRequestNumber}`}
                        title={row.requestNumber}
                        data-testid={`quote-request-number-${row.id}`}
                      >
                        {displayRequestNumber}
                      </Link>
                      <span className="inline-flex items-center gap-1 text-[10px] leading-none text-slate-500">
                        <AdminPublicCode
                          code={row.quoteCode}
                          label="povpraševanja"
                          testId={`quote-public-code-${row.id}`}
                        />
                        {row.resultingOrderId && linkedOrderCode ? (
                          <>
                            <span aria-hidden="true" className="text-slate-400">→</span>
                          <Link
                            href={`/admin/orders/${row.resultingOrderId}`}
                            prefetch={false}
                            className="inline-flex items-center rounded-sm font-semibold leading-none tabular-nums text-[color:var(--blue-500)] underline decoration-[1px] underline-offset-2 transition-colors hover:text-[color:var(--blue-600)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3e67d6]/30"
                            aria-label={`Odpri povezano naročilo ${linkedOrderCode}`}
                            title={`Povezano naročilo ${linkedOrderCode}`}
                            data-testid={`quote-linked-order-${row.id}`}
                          >
                            {linkedOrderCode}
                          </Link>
                          </>
                        ) : null}
                      </span>
                    </div>
                  </TD>

                  {visibleColumns.date ? <TD
                    className={`${adminTableBodyCellCenterClassName} whitespace-nowrap text-slate-600`}
                  >
                    <span
                      className={`${adminTableMatchingValueBaseClassName} ${getMatchingValueClassName('date', dateLabel)}`}
                      title={dateTimeLabel}
                      aria-label={`Datum povpraševanja ${dateTimeLabel}`}
                      data-testid={`quote-table-date-${row.id}`}
                      onMouseEnter={() => setMatchingValue('date', dateLabel)}
                      onMouseLeave={() => setHoveredCellMatch(null)}
                    >
                      {dateLabel}
                    </span>
                  </TD> : null}

                  {visibleColumns.customer ? <TD className={adminTableBodyCellLeftClassName}>
                    {activeQuickEdit ? (
                      <Input
                        value={activeQuickEdit.draftCustomerName}
                        onChange={(event) =>
                          setQuickEdit((current) =>
                            current?.quoteRequestId === row.id
                              ? {
                                  ...current,
                                  draftCustomerName: event.target.value
                                }
                              : current
                          )
                        }
                        onKeyDown={handleQuickEditKeyDown}
                        disabled={activeQuickEdit.isSaving}
                        className={adminTableInlineEditInputClassName}
                        aria-label={`Naročnik ${displayRequestNumber}`}
                      />
                    ) : (
                      <div className="min-w-0 leading-tight">
                        <span
                          className={`${adminTableMatchingValueBaseClassName} max-w-full truncate font-medium text-slate-900 ${getMatchingValueClassName('customer', row.customerName)}`}
                          title={row.customerName}
                          onMouseEnter={() =>
                            setMatchingValue('customer', row.customerName)
                          }
                          onMouseLeave={() => setHoveredCellMatch(null)}
                        >
                          {row.customerName}
                        </span>
                        <p className="mt-0.5 truncate text-[11px] text-slate-500">
                          {row.email}
                        </p>
                      </div>
                    )}
                  </TD> : null}

                  {visibleColumns.address ? <TD className={adminTableBodyCellLeftClassName}>
                    <span
                      className={`${adminTableMatchingValueBaseClassName} max-w-full truncate whitespace-nowrap font-normal text-slate-700 ${getMatchingValueClassName('address', addressLabel)}`}
                      title={addressLabel}
                      onMouseEnter={() =>
                        setMatchingValue('address', addressLabel)
                      }
                      onMouseLeave={() => setHoveredCellMatch(null)}
                      data-testid={`quote-table-address-${row.id}`}
                    >
                      {addressLabel}
                    </span>
                  </TD> : null}

                  {visibleColumns.type ? <TD className={adminTableBodyCellCenterClassName}>
                    <span
                      className={`${adminTableMatchingValueBaseClassName} whitespace-nowrap ${getMatchingValueClassName('type', customerTypeLabel)}`}
                      onMouseEnter={() =>
                        setMatchingValue('type', customerTypeLabel)
                      }
                      onMouseLeave={() => setHoveredCellMatch(null)}
                      data-testid={`quote-table-type-${row.id}`}
                    >
                      {customerTypeLabel}
                    </span>
                  </TD> : null}

                  {visibleColumns.status ? <TD className={adminTableBodyCellCenterClassName}>
                    <div className="flex h-12 items-center justify-center gap-1.5">
                      {activeQuickEdit ? (
                        <AdminChipDropdown
                          value={activeQuickEdit.draftStatus}
                          options={QUOTE_REQUEST_MANUAL_STATUS_OPTIONS}
                          disabled={activeQuickEdit.isSaving}
                          showArrow
                          interactive
                          onChange={(value) =>
                            setQuickEdit((current) =>
                              current?.quoteRequestId === row.id
                                ? { ...current, draftStatus: value }
                                : current
                            )
                          }
                          renderChip={(value) => (
                            <QuoteStatusPill status={value} />
                          )}
                          optionClassName={
                            getQuoteRequestStatusMenuItemClassName
                          }
                          ariaLabel={`Status povpraševanja ${displayRequestNumber}`}
                          testId={`quote-table-status-edit-${row.id}`}
                        />
                      ) : (
                        <QuoteStatusPill status={row.status} />
                      )}
                      {row.failedEmailCount > 0 ? (
                        <span
                          className="inline-flex h-[26px] min-w-[26px] items-center justify-center rounded-full bg-rose-50 px-1.5 text-[10px] font-semibold text-rose-700"
                          title={`Napake pri pošiljanju e-pošte: ${row.failedEmailCount}`}
                          aria-label={`Napake pri pošiljanju e-pošte: ${row.failedEmailCount}`}
                        >
                          {row.failedEmailCount}
                        </span>
                      ) : null}
                    </div>
                  </TD> : null}

                  {visibleColumns.total ? <TD
                    className={`${adminTableBodyCellCenterClassName} whitespace-nowrap font-semibold tabular-nums text-slate-900`}
                  >
                    <div
                      className="flex justify-center"
                      onMouseEnter={() => setMatchingValue('total', totalLabel)}
                      onMouseLeave={() => setHoveredCellMatch(null)}
                    >
                      {row.quotedTotal === null &&
                      row.shippingRequiresManualEntry ? (
                        <AdminManualShippingPendingValue
                          className={`${adminTableMatchingValueBaseClassName} ${getMatchingValueClassName('total', totalLabel)}`}
                        />
                      ) : (
                        <span
                          className={`${adminTableMatchingValueBaseClassName} ${getMatchingValueClassName('total', totalLabel)}`}
                        >
                          {totalLabel}
                        </span>
                      )}
                    </div>
                  </TD> : null}

                  {visibleColumns.offer ? <TD
                    className={`${adminTableBodyCellCenterClassName} relative z-10 px-0 py-0`}
                    data-no-row-nav
                  >
                    <div className="flex h-12 items-center justify-center">
                      <AdminQuoteOfferCell
                        quoteRequestId={row.id}
                        quoteRequestLabel={row.quoteCode}
                        offerVersionId={row.latestOfferVersionId}
                        offerCode={row.latestOfferCode}
                        offerStatus={row.latestOfferStatus}
                        documents={row.downloadableDocuments}
                      />
                    </div>
                  </TD> : null}

                  <TD
                    className={`${adminTableBodyCellCenterClassName} px-0`}
                  >
                    <div className="flex h-12 items-center justify-center">
                      {isRowQuickEditing && activeQuickEdit ? (
                        <div className={adminTableInlineActionRowClassName}>
                          <IconButton
                            type="button"
                            tone="neutral"
                            size="sm"
                            className={adminTableInlineConfirmButtonClassName}
                            onClick={() => void saveQuickEdit()}
                            disabled={
                              !isQuickEditDirty ||
                              !isQuickEditValid ||
                              activeQuickEdit.isSaving
                            }
                            aria-label={`Shrani hitro urejanje za povpraševanje ${displayRequestNumber}`}
                            title={
                              !isQuickEditValid
                                ? 'Vnesite naročnika'
                                : !isQuickEditDirty
                                  ? 'Ni sprememb za shranjevanje'
                                  : 'Shrani'
                            }
                          >
                            <CheckIcon
                              className={adminTableInlineConfirmIconClassName}
                              strokeWidth={2.2}
                            />
                          </IconButton>
                          <IconButton
                            type="button"
                            tone="neutral"
                            size="sm"
                            className={adminTableInlineCancelButtonClassName}
                            onClick={cancelQuickEdit}
                            disabled={activeQuickEdit.isSaving}
                            aria-label={`Prekliči hitro urejanje za povpraševanje ${displayRequestNumber}`}
                            title="Prekliči"
                          >
                            <CloseIcon
                              className={adminTableInlineCancelIconClassName}
                              strokeWidth={1.9}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </IconButton>
                        </div>
                      ) : (
                        <RowActions className="relative">
                          <RowActionsDropdown
                            menuWidth={176}
                            menuClassName="w-44"
                            label={`Možnosti za povpraševanje ${displayRequestNumber}`}
                            items={[
                              {
                                key: 'quick-edit',
                                label: 'Hitro urejanje',
                                icon: <PencilIcon />,
                                disabled: !hasCompleteEditableSnapshot(row),
                                onSelect: () => startQuickEdit(row)
                              },
                              {
                                key: 'open',
                                label: 'Odpri povpraševanje',
                                icon: <OpenArticleIcon />,
                                onSelect: () =>
                                  router.push(
                                    `/admin/orders/quotes/${row.id}`
                                  )
                              },
                              {
                                key: 'delete',
                                label: blockedDeleteReasons[row.id]
                                  ? 'Brisanje ni dovoljeno'
                                  : 'Izbriši',
                                icon:
                                  isDeleting && deleteTargetIds?.includes(row.id)
                                    ? <Spinner size="sm" className="text-[var(--danger-600)]" />
                                    : <TrashCanIcon />,
                                className: 'text-rose-600 hover:!bg-rose-50 hover:!text-rose-600',
                                disabled: isDeleting || Boolean(blockedDeleteReasons[row.id]),
                                onSelect: () => openDeleteRow(row.id)
                              }
                            ]}
                          />
                        </RowActions>
                      )}
                    </div>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </AdminTableLayout>

      <HeaderFilterPortal open={openHeaderFilter !== null}>
        {openHeaderFilter === 'request' ? (
          <div
            style={getHeaderPopoverStyle(requestFilterButtonRef.current, 192)}
            className={adminTableCompactPopoverPanelClassName}
          >
            <h4 className="mb-2 text-[11px] font-semibold text-slate-800">
              Nastavi razpon povpraševanj
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <AdminFilterInput
                type="number"
                min={0}
                max={999_999}
                step={1}
                placeholder="Od"
                value={draftRequestNumberRange.min}
                onChange={(event) =>
                  setDraftRequestNumberRange((current) => ({
                    ...current,
                    min: event.target.value
                  }))
                }
                aria-label="Od"
              />
              <AdminFilterInput
                type="number"
                min={0}
                max={999_999}
                step={1}
                placeholder="Do"
                value={draftRequestNumberRange.max}
                onChange={(event) =>
                  setDraftRequestNumberRange((current) => ({
                    ...current,
                    max: event.target.value
                  }))
                }
                aria-label="Do"
              />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                className={adminTablePopoverPrimaryButtonClassName}
                onClick={() => {
                  const normalizedRange = normalizeAdminQuoteRequestNumberRange(
                    draftRequestNumberRange.min,
                    draftRequestNumberRange.max
                  );
                  setDraftRequestNumberRange(normalizedRange);
                  setOpenHeaderFilter(null);
                  updateList({
                    minRequestNumber: normalizedRange.min,
                    maxRequestNumber: normalizedRange.max,
                    page: 1
                  });
                }}
              >
                Potrdi
              </button>
              <button
                type="button"
                className={adminTablePopoverSecondaryButtonClassName}
                onClick={() => {
                  const emptyRange = { min: '', max: '' };
                  setDraftRequestNumberRange(emptyRange);
                  setOpenHeaderFilter(null);
                  updateList({
                    minRequestNumber: '',
                    maxRequestNumber: '',
                    page: 1
                  });
                }}
              >
                Ponastavi
              </button>
            </div>
          </div>
        ) : null}
        {openHeaderFilter === 'date' ? (
          <div
            lang="sl-SI"
            style={getHeaderPopoverStyle(dateFilterButtonRef.current, 380)}
            className={adminTablePopoverPanelClassName}
          >
            <h4 className="mb-2 text-[11px] font-semibold text-slate-800">
              Nastavi obdobje
            </h4>
            <div className="mb-3 grid grid-cols-3 gap-2">
              {QUOTE_QUICK_DATE_RANGE_OPTIONS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  aria-label={item.label}
                  onClick={() => {
                    const quickRange = getAdminQuoteQuickDateRange(
                      latestQuoteDate,
                      item.key
                    );
                    setDraftFromDate(quickRange.from);
                    setDraftToDate(quickRange.to);
                    setOpenHeaderFilter(null);
                    updateList({
                      fromDate: quickRange.from,
                      toDate: quickRange.to,
                      page: 1
                    });
                  }}
                  className={QUOTE_DATE_PRESET_BUTTON_CLASS}
                >
                  <span className={QUOTE_DATE_PRESET_VALUE_CLASS}>{item.value}</span>
                  {item.unit ? (
                    <span className={QUOTE_DATE_PRESET_UNIT_CLASS}>{item.unit}</span>
                  ) : null}
                </button>
              ))}
            </div>
            <div className="mb-3 border-t border-slate-200 pt-3">
              <div className="grid grid-cols-2 gap-2">
                <AdminFilterInput
                  type="date"
                  lang="sl-SI"
                  value={draftFromDate}
                  onChange={(event) => setDraftFromDate(event.target.value)}
                  aria-label="Od"
                />
                <AdminFilterInput
                  type="date"
                  lang="sl-SI"
                  value={draftToDate}
                  onChange={(event) => setDraftToDate(event.target.value)}
                  aria-label="Do"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className={adminTablePopoverPrimaryButtonClassName}
                onClick={() => {
                  const normalizedDateRange = normalizeAdminQuoteDateRange(
                    draftFromDate,
                    draftToDate
                  );
                  const normalizedFromDate = normalizedDateRange.from;
                  const normalizedToDate = normalizedDateRange.to;
                  setDraftFromDate(normalizedFromDate);
                  setDraftToDate(normalizedToDate);
                  setOpenHeaderFilter(null);
                  updateList({
                    fromDate: normalizedFromDate,
                    toDate: normalizedToDate,
                    page: 1
                  });
                }}
              >
                Potrdi
              </button>
              <button
                type="button"
                className={adminTablePopoverSecondaryButtonClassName}
                onClick={() => {
                  setDraftFromDate('');
                  setDraftToDate('');
                  setOpenHeaderFilter(null);
                  updateList({ fromDate: '', toDate: '', page: 1 });
                }}
              >
                Ponastavi
              </button>
            </div>
          </div>
        ) : null}
        {openHeaderFilter === 'type' ? (
          <div style={getHeaderPopoverStyle(typeFilterButtonRef.current, 144)}>
            <MenuPanel className="w-36">
              {CUSTOMER_TYPE_FILTERS.map((filter) => (
                <MenuItem
                  key={filter.value}
                  onClick={() => {
                    setOpenHeaderFilter(null);
                    updateList({
                      customerType: filter.value,
                      page: 1
                    });
                  }}
                >
                  <span
                    className={
                      filter.value === customerType
                        ? 'font-semibold text-[color:var(--blue-500)]'
                        : undefined
                    }
                  >
                    {filter.label}
                  </span>
                </MenuItem>
              ))}
            </MenuPanel>
          </div>
        ) : null}
        {openHeaderFilter === 'status' ? (
          <div style={getHeaderPopoverStyle(statusFilterButtonRef.current, 192)}>
            <MenuPanel className="w-48">
              {FILTERS.map((filter) => (
                <MenuItem
                  key={filter.value}
                  onClick={() => {
                    setOpenHeaderFilter(null);
                    updateList({ status: filter.value, page: 1 });
                  }}
                >
                  <span className={filter.value === status ? 'font-semibold text-[color:var(--blue-500)]' : undefined}>
                    {filter.label}
                  </span>
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
              presets={QUOTE_NUMERIC_RANGE_PRESETS}
              min={0}
              onDraftChange={setDraftTotalRange}
              onConfirm={() => {
                const normalizedRange = {
                  min: normalizeAdminQuoteAmountBound(draftTotalRange.min),
                  max: normalizeAdminQuoteAmountBound(draftTotalRange.max)
                };
                setDraftTotalRange(normalizedRange);
                setOpenHeaderFilter(null);
                updateList({
                  minTotal: normalizedRange.min,
                  maxTotal: normalizedRange.max,
                  page: 1
                });
              }}
              onReset={() => {
                setDraftTotalRange({ min: '', max: '' });
                setOpenHeaderFilter(null);
                updateList({ minTotal: '', maxTotal: '', page: 1 });
              }}
            />
          </div>
        ) : null}
      </HeaderFilterPortal>
    </div>
  );
}
