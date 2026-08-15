'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  CustomerDirectoryData,
  CustomerDirectoryEditableFields,
  CustomerDirectoryMutation,
  CustomerDirectoryRow
} from '@/shared/domain/customerDirectory';
import { formatEuro } from '@/shared/domain/formatting';
import { formatSlDate } from '@/shared/domain/order/dateTime';
import { AdminSearchInput } from '@/shared/ui/admin-search-input';
import {
  AdminTableLayout,
  AdminTablePrimaryActionButton,
  ColumnVisibilityControl,
  adminExpandableTableCheckboxColumnClassName,
  adminTableBodyCellBaseClassName,
  adminTableCardClassName,
  adminTableCardStyle,
  adminTableContentClassName,
  adminTableHeaderAdjacentControlsClassName,
  adminTableHeaderButtonClassName,
  adminTableHeaderCellBaseClassName,
  adminTableHeaderClassName,
  adminTableInlineActionRowClassName,
  adminTableInlineCancelButtonClassName,
  adminTableInlineCancelIconClassName,
  adminTableInlineConfirmButtonClassName,
  adminTableInlineConfirmIconClassName,
  adminTableInlineEditInputClassName,
  adminTableMatchingValueActiveClassName,
  adminTableMatchingValueBaseClassName,
  adminTableMatchingValueHeaderStartClassName,
  adminTableNeutralIconButtonClassName,
  adminTablePopoverPanelClassName,
  adminTablePopoverPrimaryButtonClassName,
  adminTablePopoverSecondaryButtonClassName,
  adminTableSelectedDangerIconButtonClassName,
  adminTableToolbarActionsClassName,
  adminTableToolbarSearchWrapperClassName
} from '@/shared/ui/admin-table';
import AdminFilterInput from '@/shared/ui/admin-filter-input';
import LazyConfirmDialog from '@/shared/ui/confirm-dialog/lazy-confirm-dialog';
import {
  HeaderFilterPortal,
  HEADER_FILTER_BUTTON_CLASS,
  HEADER_FILTER_ROOT_ATTR,
  getHeaderPopoverStyle,
  useHeaderFilterDismiss
} from '@/shared/ui/admin-header-filter';
import { AdminCheckbox } from '@/shared/ui/checkbox';
import { useDropdownDismiss } from '@/shared/ui/dropdown/use-dropdown-dismiss';
import IconButton from '@/shared/ui/icon-button/IconButton';
import {
  CheckIcon,
  CloseIcon,
  ColumnFilterIcon,
  CopyIcon,
  DownloadIcon,
  PencilIcon,
  TrashCanIcon
} from '@/shared/ui/icons/AdminActionIcons';
import { Spinner } from '@/shared/ui/loading';
import { MenuItem, MenuPanel } from '@/shared/ui/menu';
import { EuiTablePagination, useTablePagination } from '@/shared/ui/pagination';
import { EmptyState, RowActions, RowActionsDropdown, Table, TBody, TD, TH, THead, TR } from '@/shared/ui/table';
import { adminTableRowToneClasses, filterPillClearGlyph, filterPillTokenClasses } from '@/shared/ui/theme/tokens';
import { useToast } from '@/shared/ui/toast';
import { downloadTableAsCsv, downloadTableAsXlsx } from '@/shared/utils/table-export';

const PAGE_SIZE_OPTIONS = [25, 50, 100];
const SELECTION_COLUMN_WIDTH = 40;
const ACTIONS_COLUMN_WIDTH = 88;
const FIXED_COLUMNS_WIDTH = SELECTION_COLUMN_WIDTH + ACTIONS_COLUMN_WIDTH;
const EMPTY_MATCH_VALUE = '\u0000empty-customer-cell';
const FILTER_MENU_MIN_WIDTH = 120;
const FILTER_MENU_MAX_WIDTH = 360;
const FILTER_MENU_HORIZONTAL_CHROME = 52;

const CUSTOMER_COLUMNS = [
  { id: 'name', label: 'Naziv', weight: 227.4667, align: 'left', kind: 'text' },
  { id: 'address', label: 'Naslov', weight: 197.4666, align: 'left', kind: 'text' },
  { id: 'postalCode', label: 'P. št.', weight: 61.2, align: 'center', kind: 'text' },
  { id: 'city', label: 'Pošta', weight: 105, align: 'left', kind: 'text' },
  { id: 'contacts', label: 'Kontakti', weight: 130, align: 'left', kind: 'text' },
  { id: 'emails', label: 'E-naslov', weight: 227.4667, align: 'left', kind: 'text' },
  { id: 'purchaseCount', label: 'Nakupi', weight: 71.4, align: 'center', kind: 'number' },
  { id: 'firstPurchaseAt', label: 'Prvi nakup', weight: 115, align: 'center', kind: 'date' },
  { id: 'lastPurchaseAt', label: 'Zadnji nakup', weight: 115, align: 'center', kind: 'date' },
  { id: 'averagePurchaseValue', label: 'x̄', weight: 88.4, align: 'center', kind: 'number' },
  { id: 'totalPurchaseValue', label: 'Σ', weight: 81.6, align: 'center', kind: 'number' }
] as const;

type CustomerColumn = (typeof CUSTOMER_COLUMNS)[number];
type CustomerColumnId = CustomerColumn['id'];
type FilterableColumnId = 'postalCode' | 'city';
type DateFilterColumnId = 'firstPurchaseAt' | 'lastPurchaseAt';
type HeaderFilterColumnId = FilterableColumnId | DateFilterColumnId;
type ColumnFilters = Record<FilterableColumnId, string>;
type DateRange = { from: string; to: string };
type QuickDateRange = '7d' | '30d' | '90d' | '180d' | '365d' | 'ytd';
type SortState = { columnId: CustomerColumnId; direction: 'asc' | 'desc' };
type HoveredCellMatch = { columnId: CustomerColumnId; value: string };
type EditableCustomerColumnId = 'name' | 'address' | 'postalCode' | 'city' | 'contacts' | 'emails';
type EditableCustomerFields = CustomerDirectoryEditableFields;
type EditableCustomerDraft = Record<EditableCustomerColumnId, string>;

type ActiveRowEdit = {
  rowId: string;
  originalFields: EditableCustomerFields;
  draftFields: EditableCustomerDraft;
  isNew: boolean;
  isSaving: boolean;
};

type PendingDelete = {
  rows: CustomerDirectoryRow[];
};

type MutationResponse = {
  ok?: boolean;
  message?: string;
  row?: CustomerDirectoryRow;
  rows?: CustomerDirectoryRow[];
  deletedRowIds?: string[];
  missingRowIds?: string[];
};

class CustomerDirectoryRequestError extends Error {
  readonly status: number;
  readonly row?: CustomerDirectoryRow;
  readonly rows?: CustomerDirectoryRow[];
  readonly missingRowIds?: string[];

  constructor(
    message: string,
    status: number,
    row?: CustomerDirectoryRow,
    rows?: CustomerDirectoryRow[],
    missingRowIds?: string[]
  ) {
    super(message);
    this.name = 'CustomerDirectoryRequestError';
    this.status = status;
    this.row = row;
    this.rows = rows;
    this.missingRowIds = missingRowIds;
  }
}

const COLUMN_ACCESSIBLE_LABELS: Partial<Record<CustomerColumnId, string>> = {
  averagePurchaseValue: 'Povprečje nakupa',
  totalPurchaseValue: 'Vsi nakupi'
};

const getColumnAccessibleLabel = (column: CustomerColumn) =>
  COLUMN_ACCESSIBLE_LABELS[column.id] ?? column.label;

const FILTERABLE_COLUMN_IDS: readonly FilterableColumnId[] = ['postalCode', 'city'];
const DATE_FILTER_COLUMN_IDS: readonly DateFilterColumnId[] = ['firstPurchaseAt', 'lastPurchaseAt'];
const FILTER_LABELS: Record<FilterableColumnId, string> = {
  postalCode: 'P. št.',
  city: 'Pošta'
};
const FILTER_ALL_LABELS: Record<FilterableColumnId, string> = {
  postalCode: 'Vse poštne številke',
  city: 'Vse pošte'
};
const DATE_FILTER_LABELS: Record<DateFilterColumnId, string> = {
  firstPurchaseAt: 'Prvi nakup',
  lastPurchaseAt: 'Zadnji nakup'
};
const QUICK_DATE_RANGE_OPTIONS: Array<{
  key: QuickDateRange;
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
const DATE_PRESET_BUTTON_CLASS =
  "inline-flex h-8 items-center justify-center gap-1 rounded-md border border-slate-200 bg-slate-50/80 px-2.5 font-['Inter',system-ui,sans-serif] text-slate-600 transition-colors hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 focus:border-[#3e67d6] focus:outline-none focus:ring-0 focus-visible:border-[#3e67d6] focus-visible:outline-none focus-visible:ring-0";
const DATE_PRESET_VALUE_CLASS =
  "font-['Inter',system-ui,sans-serif] text-[12px] font-semibold leading-none text-slate-800";
const DATE_PRESET_UNIT_CLASS =
  "font-['Inter',system-ui,sans-serif] text-[10px] font-medium leading-none text-slate-500";
const MATCHING_HOVER_COLUMN_IDS = new Set<CustomerColumnId>([
  'name',
  'address',
  'postalCode',
  'city',
  'purchaseCount',
  'firstPurchaseAt',
  'lastPurchaseAt'
]);
const MULTILINE_COLUMN_IDS = new Set<CustomerColumnId>(['contacts', 'emails']);
const HEADER_COPY_COLUMN_IDS = new Set<CustomerColumnId>([
  'name',
  'address',
  'contacts',
  'emails'
]);
const CENTERED_HEADER_COLUMN_IDS = new Set<CustomerColumnId>([
  'averagePurchaseValue',
  'totalPurchaseValue'
]);
const EDITABLE_COLUMN_IDS = new Set<CustomerColumnId>([
  'name',
  'address',
  'postalCode',
  'city',
  'contacts',
  'emails'
]);
const customerCollator = new Intl.Collator('sl', { sensitivity: 'base', numeric: true });

const isFilterableColumnId = (columnId: CustomerColumnId): columnId is FilterableColumnId =>
  FILTERABLE_COLUMN_IDS.includes(columnId as FilterableColumnId);

const isDateFilterColumnId = (columnId: CustomerColumnId): columnId is DateFilterColumnId =>
  DATE_FILTER_COLUMN_IDS.includes(columnId as DateFilterColumnId);

const normalizeText = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('sl')
  .trim();

const normalizeComparableValue = (value: string) => {
  const normalizedValue = normalizeText(value);
  return normalizedValue || EMPTY_MATCH_VALUE;
};

const padTwoDigits = (value: number) => String(value).padStart(2, '0');

const toDateInputValue = (dateValue: Date) =>
  `${dateValue.getFullYear()}-${padTwoDigits(dateValue.getMonth() + 1)}-${padTwoDigits(dateValue.getDate())}`;

const shiftDateByDays = (dateValue: Date, dayShift: number) => {
  const shiftedDate = new Date(dateValue);
  shiftedDate.setDate(shiftedDate.getDate() + dayShift);
  return shiftedDate;
};

const formatDateForRangeChip = (value: string) => {
  const trimmedValue = value.trim();
  if (!trimmedValue) return '—';
  const [year, month, day] = trimmedValue.split('-');
  return year && month && day ? `${day}.${month}.${year}` : trimmedValue;
};

const isDateRangeActive = (range: DateRange) => Boolean(range.from || range.to);

const matchesDateRange = (value: string, range: DateRange) => {
  if (!isDateRangeActive(range)) return true;
  if (!value) return false;

  const valueTimestamp = new Date(value).getTime();
  if (Number.isNaN(valueTimestamp)) return false;

  if (range.from) {
    const fromTimestamp = new Date(`${range.from}T00:00:00`).getTime();
    if (!Number.isNaN(fromTimestamp) && valueTimestamp < fromTimestamp) return false;
  }

  if (range.to) {
    const toTimestamp = new Date(`${range.to}T23:59:59.999`).getTime();
    if (!Number.isNaN(toTimestamp) && valueTimestamp > toTimestamp) return false;
  }

  return true;
};

const getColumnDisplayValue = (row: CustomerDirectoryRow, columnId: CustomerColumnId): string => {
  switch (columnId) {
    case 'name': return row.name;
    case 'address': return row.address;
    case 'postalCode': return row.postalCode;
    case 'city': return row.city;
    case 'contacts': return row.contacts.join('; ');
    case 'emails': return row.emails.join('; ');
    case 'purchaseCount': return String(row.purchaseCount);
    case 'firstPurchaseAt': return formatSlDate(row.firstPurchaseAt);
    case 'lastPurchaseAt': return formatSlDate(row.lastPurchaseAt);
    case 'averagePurchaseValue': return formatEuro(row.averagePurchaseValue);
    case 'totalPurchaseValue': return formatEuro(row.totalPurchaseValue);
  }
};

const getColumnSortValue = (row: CustomerDirectoryRow, columnId: CustomerColumnId): string | number => {
  switch (columnId) {
    case 'purchaseCount': return row.purchaseCount;
    case 'firstPurchaseAt': return row.firstPurchaseAt ? new Date(row.firstPurchaseAt).getTime() : '';
    case 'lastPurchaseAt': return row.lastPurchaseAt ? new Date(row.lastPurchaseAt).getTime() : '';
    case 'averagePurchaseValue': return row.averagePurchaseValue;
    case 'totalPurchaseValue': return row.totalPurchaseValue;
    default: return getColumnDisplayValue(row, columnId);
  }
};

const getDateFilterValue = (row: CustomerDirectoryRow, columnId: DateFilterColumnId) =>
  columnId === 'firstPurchaseAt' ? row.firstPurchaseAt : row.lastPurchaseAt;

const getCellLines = (row: CustomerDirectoryRow, columnId: CustomerColumnId) => {
  if (columnId === 'contacts') return row.contacts;
  if (columnId === 'emails') return row.emails;
  const value = getColumnDisplayValue(row, columnId);
  return value.trim() ? [value] : [];
};

const createClientId = () => {
  const randomPart = typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `customer-${randomPart}`;
};

const splitMultiValueField = (value: string) => value
  .split(/[;\r\n]+/)
  .map((entry) => entry.trim())
  .filter(Boolean);

const getEditableFields = (row: CustomerDirectoryRow): EditableCustomerFields => ({
  name: row.name,
  address: row.address,
  postalCode: row.postalCode,
  city: row.city,
  contacts: [...row.contacts],
  emails: [...row.emails]
});

const editableFieldsToDraft = (fields: EditableCustomerFields): EditableCustomerDraft => ({
  name: fields.name,
  address: fields.address,
  postalCode: fields.postalCode,
  city: fields.city,
  contacts: fields.contacts.join('; '),
  emails: fields.emails.join('; ')
});

const draftToEditableFields = (draft: EditableCustomerDraft): EditableCustomerFields => ({
  name: draft.name.trim(),
  address: draft.address.trim(),
  postalCode: draft.postalCode.trim(),
  city: draft.city.trim(),
  contacts: splitMultiValueField(draft.contacts),
  emails: splitMultiValueField(draft.emails)
});

const editableFieldEquals = <K extends EditableCustomerColumnId>(
  columnId: K,
  left: EditableCustomerFields[K],
  right: EditableCustomerFields[K]
) => columnId === 'contacts' || columnId === 'emails'
  ? JSON.stringify(left) === JSON.stringify(right)
  : left === right;

const escapeClipboardHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const writeClipboardContent = async (plainText: string, htmlText?: string) => {
  if (!navigator.clipboard) throw new Error('Clipboard API is unavailable.');

  if (htmlText && navigator.clipboard.write && typeof ClipboardItem !== 'undefined') {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': new Blob([plainText], { type: 'text/plain' }),
          'text/html': new Blob([htmlText], { type: 'text/html' })
        })
      ]);
      return;
    } catch {
      // Fall back to plain text in browsers that reject rich clipboard writes.
    }
  }

  if (!navigator.clipboard.writeText) throw new Error('Clipboard text API is unavailable.');
  await navigator.clipboard.writeText(plainText);
};

const getFilterMenuWidth = (labels: readonly string[]) => {
  const fallbackTextWidth = Math.max(...labels.map((label) => Array.from(label).length * 6.5), 0);
  if (typeof document === 'undefined') {
    return Math.min(
      FILTER_MENU_MAX_WIDTH,
      Math.max(FILTER_MENU_MIN_WIDTH, Math.ceil(fallbackTextWidth + FILTER_MENU_HORIZONTAL_CHROME))
    );
  }

  const context = document.createElement('canvas').getContext('2d');
  if (!context) {
    return Math.min(
      FILTER_MENU_MAX_WIDTH,
      Math.max(FILTER_MENU_MIN_WIDTH, Math.ceil(fallbackTextWidth + FILTER_MENU_HORIZONTAL_CHROME))
    );
  }

  context.font = '400 12px Inter, system-ui, sans-serif';
  const measuredTextWidth = Math.max(...labels.map((label) => context.measureText(label).width), 0);
  return Math.min(
    FILTER_MENU_MAX_WIDTH,
    Math.max(FILTER_MENU_MIN_WIDTH, Math.ceil(measuredTextWidth + FILTER_MENU_HORIZONTAL_CHROME))
  );
};

const getResponsiveColumnWidth = (column: CustomerColumn, totalWeight: number) => {
  if (totalWeight <= 0) return 'auto';
  const share = column.weight / totalWeight;
  return `calc(${(share * 100).toFixed(6)}% - ${(share * FIXED_COLUMNS_WIDTH).toFixed(3)}px)`;
};

const getHeaderCellClassName = (align: CustomerColumn['align']) =>
  `${adminTableHeaderCellBaseClassName} ${align === 'center' ? 'text-center' : 'text-left'}`;

const getBodyCellClassName = (align: CustomerColumn['align']) =>
  `${adminTableBodyCellBaseClassName} ${align === 'center' ? 'text-center' : 'text-left'}`;

export default function AdminCustomersTable({ initialDirectory }: { initialDirectory: CustomerDirectoryData }) {
  const [rows, setRows] = useState(initialDirectory.rows);
  const [query, setQuery] = useState('');
  const [sortState, setSortState] = useState<SortState | null>(null);
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({ postalCode: '', city: '' });
  const [dateFilters, setDateFilters] = useState<Record<DateFilterColumnId, DateRange>>({
    firstPurchaseAt: { from: '', to: '' },
    lastPurchaseAt: { from: '', to: '' }
  });
  const [draftDateRange, setDraftDateRange] = useState<DateRange>({ from: '', to: '' });
  const [openColumnFilter, setOpenColumnFilter] = useState<HeaderFilterColumnId | null>(null);
  const [visibleMap, setVisibleMap] = useState<Record<CustomerColumnId, boolean>>(() =>
    Object.fromEntries(CUSTOMER_COLUMNS.map((column) => [column.id, true])) as Record<CustomerColumnId, boolean>
  );
  const [hoveredCellMatch, setHoveredCellMatch] = useState<HoveredCellMatch | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(() => new Set());
  const [activeRowEdit, setActiveRowEdit] = useState<ActiveRowEdit | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [pendingMutations, setPendingMutations] = useState(0);
  const [isStructuralMutationPending, setIsStructuralMutationPending] = useState(false);
  const [isDuplicatingSelected, setIsDuplicatingSelected] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const selectAllRowsRef = useRef<HTMLInputElement | null>(null);
  const columnFilterButtonRefs = useRef<Partial<Record<HeaderFilterColumnId, HTMLButtonElement | null>>>({});
  const columnFilterMenuRef = useRef<HTMLDivElement | null>(null);
  const dateFilterPanelRef = useRef<HTMLDivElement | null>(null);
  const exportMenuRootRef = useRef<HTMLDivElement | null>(null);
  const exportMenuDismissRefs = useMemo(() => [exportMenuRootRef], []);
  const { toast } = useToast();
  const persistenceAvailable = initialDirectory.persistenceAvailable;

  const visibleColumns = useMemo(
    () => CUSTOMER_COLUMNS.filter((column) => visibleMap[column.id]),
    [visibleMap]
  );
  const visibleColumnWeight = visibleColumns.reduce((total, column) => total + column.weight, 0);
  const canonicalOrder = useMemo(
    () => new Map(rows.map((row, index) => [row.id, index])),
    [rows]
  );
  const latestDateByColumn = useMemo<Record<DateFilterColumnId, Date>>(() => {
    const resolveLatestDate = (columnId: DateFilterColumnId) => {
      const timestamps = rows
        .map((row) => new Date(getDateFilterValue(row, columnId)).getTime())
        .filter(Number.isFinite);
      const latestDate = timestamps.length > 0 ? new Date(Math.max(...timestamps)) : new Date();
      latestDate.setHours(0, 0, 0, 0);
      return latestDate;
    };

    return {
      firstPurchaseAt: resolveLatestDate('firstPurchaseAt'),
      lastPurchaseAt: resolveLatestDate('lastPurchaseAt')
    };
  }, [rows]);
  const columnFilterOptions = useMemo<Record<FilterableColumnId, string[]>>(() => ({
    postalCode: Array.from(new Set(rows.map((row) => row.postalCode.trim()).filter(Boolean))).sort(customerCollator.compare),
    city: Array.from(new Set(rows.map((row) => row.city.trim()).filter(Boolean))).sort(customerCollator.compare)
  }), [rows]);
  const columnFilterMenuWidths = useMemo<Record<FilterableColumnId, number>>(() => ({
    postalCode: getFilterMenuWidth([FILTER_ALL_LABELS.postalCode, ...columnFilterOptions.postalCode]),
    city: getFilterMenuWidth([FILTER_ALL_LABELS.city, ...columnFilterOptions.city])
  }), [columnFilterOptions]);
  const activeColumnFilters = useMemo(
    () => FILTERABLE_COLUMN_IDS.flatMap((columnId) => {
      const value = columnFilters[columnId];
      return value ? [{ columnId, label: FILTER_LABELS[columnId], value }] : [];
    }),
    [columnFilters]
  );
  const activeFilterChips = useMemo(() => [
    ...activeColumnFilters.map((filter) => ({
      key: filter.columnId,
      label: filter.label,
      value: filter.value,
      clear: () => setColumnFilters((current) => ({ ...current, [filter.columnId]: '' }))
    })),
    ...DATE_FILTER_COLUMN_IDS.flatMap((columnId) => {
      const range = dateFilters[columnId];
      return isDateRangeActive(range) ? [{
        key: columnId,
        label: DATE_FILTER_LABELS[columnId],
        value: `${formatDateForRangeChip(range.from)} – ${formatDateForRangeChip(range.to)}`,
        clear: () => setDateFilters((current) => ({
          ...current,
          [columnId]: { from: '', to: '' }
        }))
      }] : [];
    })
  ], [activeColumnFilters, dateFilters]);
  const filteredRows = useMemo(() => {
    const normalizedQuery = normalizeText(query);
    return rows.filter((row) => {
      const matchesQuery = !normalizedQuery || CUSTOMER_COLUMNS.some((column) =>
        normalizeText(getColumnDisplayValue(row, column.id)).includes(normalizedQuery));
      const matchesPostalCode = !columnFilters.postalCode
        || normalizeComparableValue(row.postalCode) === normalizeComparableValue(columnFilters.postalCode);
      const matchesCity = !columnFilters.city
        || normalizeComparableValue(row.city) === normalizeComparableValue(columnFilters.city);
      const matchesFirstPurchase = matchesDateRange(row.firstPurchaseAt, dateFilters.firstPurchaseAt);
      const matchesLastPurchase = matchesDateRange(row.lastPurchaseAt, dateFilters.lastPurchaseAt);
      return matchesQuery
        && matchesPostalCode
        && matchesCity
        && matchesFirstPurchase
        && matchesLastPurchase;
    });
  }, [columnFilters, dateFilters, query, rows]);
  const filteredAndSortedRows = useMemo(() => {
    if (!sortState) return filteredRows;
    const direction = sortState.direction === 'asc' ? 1 : -1;
    return [...filteredRows].sort((left, right) => {
      const leftValue = getColumnSortValue(left, sortState.columnId);
      const rightValue = getColumnSortValue(right, sortState.columnId);
      const leftBlank = typeof leftValue === 'string' && !leftValue.trim();
      const rightBlank = typeof rightValue === 'string' && !rightValue.trim();
      if (leftBlank !== rightBlank) return leftBlank ? 1 : -1;

      const comparison = typeof leftValue === 'number' && typeof rightValue === 'number'
        ? leftValue - rightValue
        : customerCollator.compare(String(leftValue), String(rightValue));
      if (comparison !== 0) return comparison * direction;
      return (canonicalOrder.get(left.id) ?? 0) - (canonicalOrder.get(right.id) ?? 0);
    });
  }, [canonicalOrder, filteredRows, sortState]);
  const pagination = useTablePagination({
    totalCount: filteredRows.length,
    storageKey: 'admin-customers-page-size-v1',
    defaultPageSize: 100,
    pageSizeOptions: PAGE_SIZE_OPTIONS
  });
  const setPage = pagination.setPage;
  const pagedRows = useMemo(() => {
    const start = (pagination.page - 1) * pagination.pageSize;
    return filteredAndSortedRows.slice(start, start + pagination.pageSize);
  }, [filteredAndSortedRows, pagination.page, pagination.pageSize]);
  const pagedRowIds = useMemo(() => pagedRows.map((row) => row.id), [pagedRows]);
  const selectedRows = useMemo(() => {
    const visibleOrder = new Map(filteredAndSortedRows.map((row, index) => [row.id, index]));
    return rows
      .filter((row) => selectedRowIds.has(row.id))
      .sort((left, right) => {
        const leftIndex = visibleOrder.get(left.id);
        const rightIndex = visibleOrder.get(right.id);
        if (leftIndex !== undefined && rightIndex !== undefined) return leftIndex - rightIndex;
        if (leftIndex !== undefined) return -1;
        if (rightIndex !== undefined) return 1;
        return (canonicalOrder.get(left.id) ?? 0) - (canonicalOrder.get(right.id) ?? 0);
      });
  }, [canonicalOrder, filteredAndSortedRows, rows, selectedRowIds]);
  const selectedVisibleCount = pagedRowIds.reduce(
    (count, rowId) => count + (selectedRowIds.has(rowId) ? 1 : 0),
    0
  );
  const allVisibleRowsSelected = pagedRowIds.length > 0 && selectedVisibleCount === pagedRowIds.length;
  const hasSelectedRows = selectedRows.length > 0;
  const selectionControlsDisabled = Boolean(activeRowEdit)
    || isStructuralMutationPending
    || pendingMutations > 0;
  const isActiveRowDirty = useMemo(() => {
    if (!activeRowEdit) return false;
    const draftFields = draftToEditableFields(activeRowEdit.draftFields);
    return Array.from(EDITABLE_COLUMN_IDS).some((columnId) => {
      if (!EDITABLE_COLUMN_IDS.has(columnId)) return false;
      const editableColumnId = columnId as EditableCustomerColumnId;
      return !editableFieldEquals(
        editableColumnId,
        activeRowEdit.originalFields[editableColumnId],
        draftFields[editableColumnId]
      );
    });
  }, [activeRowEdit]);

  useEffect(() => {
    setPage(1);
  }, [columnFilters, dateFilters, query, setPage, sortState]);

  useEffect(() => {
    const matchingRowIds = new Set(filteredRows.map((row) => row.id));
    setSelectedRowIds((current) => {
      const next = new Set(Array.from(current).filter((rowId) => matchingRowIds.has(rowId)));
      return next.size === current.size ? current : next;
    });
  }, [filteredRows]);

  useEffect(() => {
    const checkbox = selectAllRowsRef.current;
    if (checkbox) checkbox.indeterminate = selectedVisibleCount > 0 && !allVisibleRowsSelected;
  }, [allVisibleRowsSelected, selectedVisibleCount]);

  useEffect(() => {
    const availableRowIds = new Set(rows.map((row) => row.id));
    setSelectedRowIds((current) => {
      if (Array.from(current).every((rowId) => availableRowIds.has(rowId))) return current;
      return new Set(Array.from(current).filter((rowId) => availableRowIds.has(rowId)));
    });
  }, [rows]);

  useHeaderFilterDismiss({
    isOpen: Boolean(openColumnFilter),
    onClose: () => setOpenColumnFilter(null)
  });

  useDropdownDismiss({
    open: isExportMenuOpen,
    refs: exportMenuDismissRefs,
    onClose: () => setIsExportMenuOpen(false)
  });

  useEffect(() => {
    if (!openColumnFilter || !isFilterableColumnId(openColumnFilter)) return;
    const frameId = window.requestAnimationFrame(() => {
      const selectedOption = columnFilterMenuRef.current?.querySelector<HTMLElement>('[role="option"][aria-selected="true"]');
      const firstOption = columnFilterMenuRef.current?.querySelector<HTMLElement>('[role="option"]');
      (selectedOption ?? firstOption)?.focus();
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [openColumnFilter]);

  useEffect(() => {
    if (!openColumnFilter || !isDateFilterColumnId(openColumnFilter)) return;
    setDraftDateRange(dateFilters[openColumnFilter]);
    const frameId = window.requestAnimationFrame(() => {
      dateFilterPanelRef.current?.querySelector<HTMLElement>('button, input')?.focus();
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [dateFilters, openColumnFilter]);

  const persistMutation = async (mutation: CustomerDirectoryMutation) => {
    if (!persistenceAvailable) throw new Error('Povezava z bazo ni nastavljena.');
    setPendingMutations((count) => count + 1);
    try {
      const response = await fetch('/api/admin/customers', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(mutation)
      });
      const payload = await response.json().catch(() => ({})) as MutationResponse;
      if (!response.ok) {
        throw new CustomerDirectoryRequestError(
          payload.message || 'Shranjevanje ni uspelo.',
          response.status,
          payload.row,
          payload.rows,
          payload.missingRowIds
        );
      }
      return payload;
    } finally {
      setPendingMutations((count) => Math.max(0, count - 1));
    }
  };

  const beginRowEdit = (row: CustomerDirectoryRow) => {
    if (!persistenceAvailable || isStructuralMutationPending || pendingMutations > 0) return;
    if (activeRowEdit && activeRowEdit.rowId !== row.id && isActiveRowDirty) {
      toast.error('Najprej shranite ali prekličite trenutno urejanje.');
      return;
    }
    const originalFields = getEditableFields(row);
    setOpenColumnFilter(null);
    setIsExportMenuOpen(false);
    setHoveredCellMatch(null);
    setActiveRowEdit({
      rowId: row.id,
      originalFields,
      draftFields: editableFieldsToDraft(originalFields),
      isNew: false,
      isSaving: false
    });
  };

  const cancelRowEdit = () => {
    if (!activeRowEdit || activeRowEdit.isSaving) return;
    if (activeRowEdit.isNew) {
      setRows((currentRows) => currentRows.filter((row) => row.id !== activeRowEdit.rowId));
    }
    setActiveRowEdit(null);
  };

  const toggleAllVisibleRows = () => {
    if (selectionControlsDisabled) return;
    setSelectedRowIds((current) => {
      const next = new Set(current);
      if (allVisibleRowsSelected) pagedRowIds.forEach((rowId) => next.delete(rowId));
      else pagedRowIds.forEach((rowId) => next.add(rowId));
      return next;
    });
  };

  const toggleRowSelection = (rowId: string) => {
    if (selectionControlsDisabled) return;
    setSelectedRowIds((current) => {
      const next = new Set(current);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };

  const toggleSort = (columnId: CustomerColumnId) => {
    if (activeRowEdit || isStructuralMutationPending || pendingMutations > 0) return;
    setOpenColumnFilter(null);
    setSortState((current) => {
      if (!current || current.columnId !== columnId) return { columnId, direction: 'asc' };
      if (current.direction === 'asc') return { columnId, direction: 'desc' };
      return null;
    });
  };

  const applyQuickDateRange = (columnId: DateFilterColumnId, range: QuickDateRange): DateRange => {
    const anchorDate = new Date(latestDateByColumn[columnId]);
    if (range === 'ytd') {
      const yearStart = new Date(anchorDate.getFullYear(), 0, 1);
      return { from: toDateInputValue(yearStart), to: toDateInputValue(anchorDate) };
    }

    const dayCountByRange: Record<Exclude<QuickDateRange, 'ytd'>, number> = {
      '7d': 6,
      '30d': 29,
      '90d': 89,
      '180d': 179,
      '365d': 364
    };
    return {
      from: toDateInputValue(shiftDateByDays(anchorDate, -dayCountByRange[range])),
      to: toDateInputValue(anchorDate)
    };
  };

  const getSortActionLabel = (column: CustomerColumn) => {
    const accessibleLabel = getColumnAccessibleLabel(column);
    if (sortState?.columnId !== column.id) return `${accessibleLabel}: razvrsti naraščajoče`;
    if (sortState.direction === 'asc') return `${accessibleLabel}: razvrsti padajoče`;
    return `${accessibleLabel}: povrni prvotni vrstni red`;
  };

  const setHoveredMatch = (columnId: CustomerColumnId, value: string) => {
    if (!MATCHING_HOVER_COLUMN_IDS.has(columnId)) return;
    setHoveredCellMatch({ columnId, value: normalizeComparableValue(value) });
  };

  const getMatchingValueClassName = (columnId: CustomerColumnId, value: string) =>
    MATCHING_HOVER_COLUMN_IDS.has(columnId)
    && hoveredCellMatch?.columnId === columnId
    && hoveredCellMatch.value === normalizeComparableValue(value)
      ? adminTableMatchingValueActiveClassName
      : '';

  const copyCellValue = async (value: string) => {
    try {
      await writeClipboardContent(value);
      toast.success('Vrednost je kopirana.');
    } catch {
      toast.error('Vrednosti ni bilo mogoče kopirati.');
    }
  };

  const copyColumnValues = async (column: CustomerColumn) => {
    const values = filteredAndSortedRows.flatMap((row) => {
      const value = getColumnDisplayValue(row, column.id);
      return MULTILINE_COLUMN_IDS.has(column.id)
        ? value.split(/[;\r\n]+/).map((entry) => entry.trim()).filter(Boolean)
        : value.trim() ? [value.trim()] : [];
    });
    if (values.length === 0) {
      toast.info('Ni vrednosti za kopiranje glede na trenutne filtre.');
      return;
    }

    setOpenColumnFilter(null);
    setIsExportMenuOpen(false);
    try {
      await writeClipboardContent(
        values.join(';\r\n'),
        values.map(escapeClipboardHtml).join(';<br>')
      );
      toast.success(`Kopirano: ${values.length} vrednosti iz stolpca »${column.label}«.`);
    } catch {
      toast.error('Stolpca ni bilo mogoče kopirati.');
    }
  };

  const exportCustomers = (format: 'csv' | 'xlsx') => {
    setIsExportMenuOpen(false);
    const sourceRows = hasSelectedRows ? selectedRows : filteredAndSortedRows;
    if (sourceRows.length === 0) {
      toast.info('Ni strank za izvoz glede na trenutne filtre.');
      return;
    }

    const exportRows = [
      CUSTOMER_COLUMNS.map((column) => column.label),
      ...sourceRows.map((row) => CUSTOMER_COLUMNS.map((column) => getColumnDisplayValue(row, column.id)))
    ];
    try {
      if (format === 'csv') downloadTableAsCsv(exportRows, 'seznam-strank.csv');
      else downloadTableAsXlsx(exportRows, 'seznam-strank.xlsx', { sheetName: 'Seznam strank' });
      toast.success(`${hasSelectedRows ? 'Izbrane stranke so izvožene' : 'Tabela je izvožena'} kot ${format.toUpperCase()}.`);
    } catch {
      toast.error('Tabele ni bilo mogoče izvoziti.');
    }
  };

  const saveRowEdit = async () => {
    const edit = activeRowEdit;
    if (!edit || edit.isSaving || !isActiveRowDirty) return;

    const fields = draftToEditableFields(edit.draftFields);
    setActiveRowEdit((current) => current?.rowId === edit.rowId
      ? { ...current, isSaving: true }
      : current);
    try {
      const mutation: CustomerDirectoryMutation = edit.isNew
        ? {
          operation: 'add-row',
          rowId: edit.rowId,
          fields
        }
        : {
          operation: 'update-row',
          rowId: edit.rowId,
          fields,
          expectedFields: edit.originalFields
        };
      const response = await persistMutation(mutation);
      setRows((currentRows) => currentRows.map((row) => row.id === edit.rowId
        ? (response.row ?? { ...row, ...fields })
        : row));
      setActiveRowEdit(null);
      toast.success(edit.isNew ? 'Nova stranka je dodana.' : 'Stranka je posodobljena.');
    } catch (error) {
      if (error instanceof CustomerDirectoryRequestError && error.status === 409) {
        const refreshedRow = error.row
          ?? error.rows?.find((row) => row.id === edit.rowId);
        const rowIsMissing = error.missingRowIds?.includes(edit.rowId) ?? false;
        if (rowIsMissing) {
          setRows((currentRows) => currentRows.filter((row) => row.id !== edit.rowId));
          setActiveRowEdit(null);
          toast.error(`${error.message} Urejanje je zaključeno.`);
          return;
        }
        if (!refreshedRow) {
          setActiveRowEdit(null);
          toast.error(`${error.message} Urejanje je zaključeno; poskusite znova.`);
          return;
        }
        setRows((currentRows) => [
          refreshedRow,
          ...currentRows.filter((row) => row.id !== edit.rowId)
        ]);
        resetTableViewForStructuralChange();
        setActiveRowEdit((current) => current?.rowId === edit.rowId
          ? {
            ...current,
            originalFields: getEditableFields(refreshedRow),
            isSaving: false
          }
          : current);
        toast.error(`${error.message} Najnovejši podatki so prikazani, vaš osnutek pa je ohranjen.`);
        return;
      }
      setActiveRowEdit((current) => current?.rowId === edit.rowId
        ? { ...current, isSaving: false }
        : current);
      toast.error(error instanceof Error ? error.message : 'Stranke ni bilo mogoče shraniti.');
    }
  };

  const resetTableViewForStructuralChange = () => {
    setSortState(null);
    setColumnFilters({ postalCode: '', city: '' });
    setDateFilters({
      firstPurchaseAt: { from: '', to: '' },
      lastPurchaseAt: { from: '', to: '' }
    });
    setOpenColumnFilter(null);
    setHoveredCellMatch(null);
    setQuery('');
    pagination.setPage(1);
  };

  const addRow = () => {
    if (!persistenceAvailable || isStructuralMutationPending || pendingMutations > 0 || activeRowEdit) return;
    const rowId = createClientId();
    const draftRow: CustomerDirectoryRow = {
      id: rowId,
      origin: 'manual',
      revision: null,
      name: '',
      address: '',
      postalCode: '',
      city: '',
      contacts: [],
      emails: [],
      purchaseCount: 0,
      firstPurchaseAt: '',
      lastPurchaseAt: '',
      averagePurchaseValue: 0,
      totalPurchaseValue: 0
    };
    resetTableViewForStructuralChange();
    setRows((currentRows) => [draftRow, ...currentRows]);
    const originalFields = getEditableFields(draftRow);
    setActiveRowEdit({
      rowId: draftRow.id,
      originalFields,
      draftFields: editableFieldsToDraft(originalFields),
      isNew: true,
      isSaving: false
    });
  };

  const reconcileBatchConflict = (error: CustomerDirectoryRequestError) => {
    const latestRowsById = new Map((error.rows ?? []).map((row) => [row.id, row]));
    const missingRowIds = new Set(error.missingRowIds ?? []);
    if (!latestRowsById.size && !missingRowIds.size) return;
    setRows((currentRows) => currentRows
      .filter((row) => !missingRowIds.has(row.id))
      .map((row) => latestRowsById.get(row.id) ?? row));
  };

  const duplicateSelectedRows = async () => {
    if (
      !persistenceAvailable
      || !hasSelectedRows
      || isStructuralMutationPending
      || pendingMutations > 0
      || activeRowEdit
    ) return;

    const sourceRows = selectedRows.map((row) => ({
      row,
      expectedFields: getEditableFields(row)
    }));
    setOpenColumnFilter(null);
    setIsExportMenuOpen(false);
    setIsDuplicatingSelected(true);
    setIsStructuralMutationPending(true);
    try {
      const response = await persistMutation({
        operation: 'duplicate-rows',
        rows: sourceRows.map(({ row, expectedFields }) => ({
          sourceRowId: row.id,
          newRowId: createClientId(),
          expectedFields
        }))
      });
      if (!response.rows?.length) throw new Error('Strežnik ni vrnil podvojenih strank.');

      const duplicatedRowIds = new Set(response.rows.map((row) => row.id));
      setRows((currentRows) => [
        ...response.rows as CustomerDirectoryRow[],
        ...currentRows.filter((row) => !duplicatedRowIds.has(row.id))
      ]);
      setSelectedRowIds(duplicatedRowIds);
      resetTableViewForStructuralChange();
      toast.success(response.rows.length === 1
        ? 'Stranka je podvojena.'
        : `${response.rows.length} strank je podvojenih.`);
    } catch (error) {
      if (error instanceof CustomerDirectoryRequestError && error.status === 409) {
        reconcileBatchConflict(error);
        toast.error(`${error.message} Podatki so osveženi; preverite izbor in poskusite znova.`);
      } else {
        toast.error(error instanceof Error ? error.message : 'Strank ni bilo mogoče podvojiti.');
      }
    } finally {
      setIsDuplicatingSelected(false);
      setIsStructuralMutationPending(false);
    }
  };

  const openDeleteDialog = (targetRows: readonly CustomerDirectoryRow[]) => {
    if (!targetRows.length || activeRowEdit) return;
    setOpenColumnFilter(null);
    setIsExportMenuOpen(false);
    setPendingDelete({
      rows: targetRows.map((row) => ({
        ...row,
        contacts: [...row.contacts],
        emails: [...row.emails]
      }))
    });
  };

  const confirmDelete = async () => {
    if (!pendingDelete || !persistenceAvailable || isStructuralMutationPending || pendingMutations > 0 || activeRowEdit) return;
    const target = pendingDelete;
    setPendingDelete(null);
    setIsStructuralMutationPending(true);
    try {
      const response = await persistMutation({
        operation: 'delete-rows',
        rows: target.rows.map((row) => ({
          rowId: row.id,
          expectedFields: getEditableFields(row)
        }))
      });
      const deletedRowIds = new Set(response.deletedRowIds ?? target.rows.map((row) => row.id));
      setRows((currentRows) => currentRows.filter((row) => !deletedRowIds.has(row.id)));
      setSelectedRowIds((current) => new Set(Array.from(current).filter((rowId) => !deletedRowIds.has(rowId))));
      toast.success(deletedRowIds.size === 1
        ? 'Stranka je odstranjena s seznama.'
        : `${deletedRowIds.size} strank je odstranjenih s seznama.`);
    } catch (error) {
      if (error instanceof CustomerDirectoryRequestError && error.status === 409) {
        reconcileBatchConflict(error);
        toast.error(`${error.message} Podatki so osveženi; preverite izbor in poskusite znova.`);
      } else {
        toast.error(error instanceof Error ? error.message : 'Strank ni bilo mogoče odstraniti s seznama.');
      }
    } finally {
      setIsStructuralMutationPending(false);
    }
  };

  const restoreColumnFilterFocus = (columnId: HeaderFilterColumnId) => {
    window.requestAnimationFrame(() => columnFilterButtonRefs.current[columnId]?.focus());
  };

  const openCategoricalFilter = openColumnFilter && isFilterableColumnId(openColumnFilter)
    ? openColumnFilter
    : null;
  const openDateFilter = openColumnFilter && isDateFilterColumnId(openColumnFilter)
    ? openColumnFilter
    : null;

  return (
    <div className="space-y-3">
      {initialDirectory.warningMessage || !persistenceAvailable ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {initialDirectory.warningMessage
            ?? 'Podatki so prikazani, vendar povezava z bazo ni na voljo. Urejanje je začasno onemogočeno.'}
        </div>
      ) : null}

      <AdminTableLayout
        className={adminTableCardClassName}
        style={adminTableCardStyle}
        headerClassName={adminTableHeaderClassName}
        contentClassName={`${adminTableContentClassName} !overflow-x-hidden`}
        showDivider={false}
        headerLeft={
          <AdminSearchInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            disabled={Boolean(activeRowEdit)}
            placeholder="Išči po vseh podatkih strank ..."
            wrapperClassName={adminTableToolbarSearchWrapperClassName}
          />
        }
        headerRight={
          <div className={adminTableToolbarActionsClassName}>
            <span className="hidden whitespace-nowrap text-xs text-slate-500 xl:inline">
              {pendingMutations > 0
                ? 'Shranjevanje ...'
                : hasSelectedRows
                  ? `${selectedRows.length} ${selectedRows.length === 1 ? 'izbrana' : 'izbranih'} / ${filteredRows.length} strank`
                  : `${filteredRows.length} strank`}
            </span>
            <div ref={exportMenuRootRef} className="relative">
              <IconButton
                type="button"
                tone="neutral"
                size="sm"
                className={`${adminTableNeutralIconButtonClassName} ${isExportMenuOpen ? '!bg-slate-50 !text-[color:var(--blue-500)]' : ''}`}
                disabled={isStructuralMutationPending || pendingMutations > 0 || Boolean(activeRowEdit)}
                aria-haspopup="menu"
                aria-expanded={isExportMenuOpen}
                aria-label={hasSelectedRows ? `Izvozi izbrane stranke (${selectedRows.length})` : 'Izvozi tabelo'}
                title={hasSelectedRows ? 'Izvozi izbrane' : 'Izvozi'}
                onClick={() => {
                  setOpenColumnFilter(null);
                  setIsExportMenuOpen((current) => !current);
                }}
              >
                <DownloadIcon className="!h-[18px] !w-[18px]" />
              </IconButton>
              {isExportMenuOpen ? (
                <div className="absolute right-0 top-10 z-40" role="menu" aria-label="Format izvoza">
                  <MenuPanel className="w-28">
                    <MenuItem className="whitespace-nowrap !text-[12px]" onClick={() => exportCustomers('csv')}>
                      CSV
                    </MenuItem>
                    <MenuItem className="whitespace-nowrap !text-[12px]" onClick={() => exportCustomers('xlsx')}>
                      XLSX
                    </MenuItem>
                  </MenuPanel>
                </div>
              ) : null}
            </div>
            <IconButton
              type="button"
              tone="neutral"
              size="sm"
              className={adminTableNeutralIconButtonClassName}
              disabled={
                !persistenceAvailable
                || !hasSelectedRows
                || isStructuralMutationPending
                || pendingMutations > 0
                || Boolean(activeRowEdit)
              }
              onClick={() => void duplicateSelectedRows()}
              aria-label={hasSelectedRows
                ? `Podvoji izbrane stranke (${selectedRows.length})`
                : 'Podvoji izbrane stranke'}
              title="Podvoji"
            >
              {isDuplicatingSelected
                ? <Spinner size="sm" className="text-[#1982bf]" />
                : <CopyIcon className="!h-[18px] !w-[18px]" />}
            </IconButton>
            <IconButton
              type="button"
              tone={hasSelectedRows ? 'danger' : 'neutral'}
              size="sm"
              className={hasSelectedRows
                ? adminTableSelectedDangerIconButtonClassName
                : `${adminTableNeutralIconButtonClassName} !transition-none`}
              disabled={
                !persistenceAvailable
                || !hasSelectedRows
                || isStructuralMutationPending
                || pendingMutations > 0
                || Boolean(activeRowEdit)
              }
              onClick={() => openDeleteDialog(selectedRows)}
              aria-label={hasSelectedRows
                ? `Odstrani izbrane stranke (${selectedRows.length})`
                : 'Odstrani izbrane stranke'}
              title="Odstrani"
            >
              <TrashCanIcon className="!h-[18px] !w-[18px]" />
            </IconButton>
            <div
              aria-disabled={selectionControlsDisabled}
              className={selectionControlsDisabled ? 'pointer-events-none opacity-60' : undefined}
            >
              <ColumnVisibilityControl
                options={CUSTOMER_COLUMNS.map((column) => ({
                  key: column.id,
                  label: column.label,
                  disabled: column.id === 'name'
                }))}
                visibleMap={visibleMap}
                onToggle={(columnId) => {
                  if (columnId === 'name' || selectionControlsDisabled) return;
                  setVisibleMap((current) => ({
                    ...current,
                    [columnId]: !current[columnId as CustomerColumnId]
                  }));
                  setSortState((current) => current?.columnId === columnId ? null : current);
                  setOpenColumnFilter((current) => current === columnId ? null : current);
                  setHoveredCellMatch(null);
                }}
                showLabel={false}
                triggerClassName={adminTableNeutralIconButtonClassName}
                menuWidth={240}
              />
            </div>
            <AdminTablePrimaryActionButton
              type="button"
              disabled={!persistenceAvailable || isStructuralMutationPending || pendingMutations > 0 || Boolean(activeRowEdit)}
              onClick={() => void addRow()}
            >
              Nova stranka
            </AdminTablePrimaryActionButton>
          </div>
        }
        filterRowLeft={activeFilterChips.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {activeFilterChips.map((filter) => (
              <span key={filter.key} className={filterPillTokenClasses.base}>
                <span>
                  {filter.label}:{' '}
                  <span className="font-semibold">{filter.value}</span>
                </span>
                <button
                  type="button"
                  className={filterPillTokenClasses.clear}
                  onClick={filter.clear}
                  disabled={Boolean(activeRowEdit)}
                  aria-label={`Odstrani filter ${filter.label} ${filter.value}`}
                >
                  {filterPillClearGlyph}
                </button>
              </span>
            ))}
          </div>
        ) : undefined}
        filterRowRight={
          <div
            aria-disabled={Boolean(activeRowEdit)}
            className={activeRowEdit ? 'pointer-events-none opacity-60' : undefined}
          >
            <EuiTablePagination
              allowAll
              page={pagination.page}
              pageCount={pagination.pageCount}
              onPageChange={(page) => {
                if (!activeRowEdit) pagination.setPage(page);
              }}
              itemsPerPage={pagination.pageSizeSelection}
              onChangeItemsPerPage={(pageSize) => {
                if (!activeRowEdit) pagination.setPageSize(pageSize);
              }}
              itemsPerPageOptions={PAGE_SIZE_OPTIONS}
            />
          </div>
        }
        footerRight={
          <div
            aria-disabled={Boolean(activeRowEdit)}
            className={activeRowEdit ? 'pointer-events-none opacity-60' : undefined}
          >
            <EuiTablePagination
              allowAll
              page={pagination.page}
              pageCount={pagination.pageCount}
              onPageChange={(page) => {
                if (!activeRowEdit) pagination.setPage(page);
              }}
              itemsPerPage={pagination.pageSizeSelection}
              onChangeItemsPerPage={(pageSize) => {
                if (!activeRowEdit) pagination.setPageSize(pageSize);
              }}
              itemsPerPageOptions={PAGE_SIZE_OPTIONS}
            />
          </div>
        }
      >
        <Table className="w-full table-fixed">
          <colgroup>
            <col style={{ width: SELECTION_COLUMN_WIDTH }} />
            {visibleColumns.map((column) => (
              <col key={column.id} style={{ width: getResponsiveColumnWidth(column, visibleColumnWeight) }} />
            ))}
            <col style={{ width: ACTIONS_COLUMN_WIDTH }} />
          </colgroup>
          <THead className="border-t border-slate-200 font-['Inter',system-ui,sans-serif]">
            <TR className="hover:bg-transparent">
              <TH className={`${adminTableHeaderCellBaseClassName} ${adminExpandableTableCheckboxColumnClassName} px-2 text-center`}>
                <div className="flex h-11 items-center justify-center">
                  <AdminCheckbox
                    ref={selectAllRowsRef}
                    checked={allVisibleRowsSelected}
                    disabled={selectionControlsDisabled || pagedRows.length === 0}
                    onChange={toggleAllVisibleRows}
                    aria-label="Izberi vse stranke na trenutni strani"
                  />
                </div>
              </TH>
              {visibleColumns.map((column) => {
                const categoricalFilterColumnId = isFilterableColumnId(column.id) ? column.id : null;
                const dateFilterColumnId = isDateFilterColumnId(column.id) ? column.id : null;
                const headerFilterColumnId = categoricalFilterColumnId ?? dateFilterColumnId;
                const hasActiveHeaderFilter = categoricalFilterColumnId
                  ? Boolean(columnFilters[categoricalFilterColumnId])
                  : dateFilterColumnId
                    ? isDateRangeActive(dateFilters[dateFilterColumnId])
                    : false;
                const supportsHeaderCopy = HEADER_COPY_COLUMN_IDS.has(column.id);
                const headerAlign = CENTERED_HEADER_COLUMN_IDS.has(column.id) ? 'center' : column.align;
                const isSortedColumn = sortState?.columnId === column.id;
                return (
                  <TH
                    key={column.id}
                    className={getHeaderCellClassName(headerAlign)}
                    aria-sort={isSortedColumn
                      ? (sortState.direction === 'asc' ? 'ascending' : 'descending')
                      : 'none'}
                  >
                    <div
                      className={`relative flex h-11 min-w-0 items-center gap-2 ${headerAlign === 'center' ? 'justify-center' : ''}`}
                      {...(headerFilterColumnId ? { [HEADER_FILTER_ROOT_ATTR]: 'true' } : {})}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(column.id)}
                        disabled={selectionControlsDisabled}
                        className={`${adminTableHeaderButtonClassName} ${headerAlign === 'left' ? `${adminTableMatchingValueHeaderStartClassName} text-left` : 'text-center'} min-w-0 max-w-full shrink overflow-hidden disabled:cursor-default disabled:text-slate-400 ${isSortedColumn ? 'underline underline-offset-2' : ''}`}
                        aria-label={getSortActionLabel(column)}
                        title={getSortActionLabel(column)}
                      >
                        <span className="block min-w-0 truncate">{column.label}</span>
                      </button>
                      {headerFilterColumnId || supportsHeaderCopy ? (
                        <span className={adminTableHeaderAdjacentControlsClassName}>
                          {headerFilterColumnId ? (
                            <button
                              ref={(element) => {
                                columnFilterButtonRefs.current[headerFilterColumnId] = element;
                              }}
                              type="button"
                              className={HEADER_FILTER_BUTTON_CLASS}
                              data-active={openColumnFilter === headerFilterColumnId || hasActiveHeaderFilter}
                              onClick={(event) => {
                                event.stopPropagation();
                                if (selectionControlsDisabled) return;
                                setOpenColumnFilter((current) => current === headerFilterColumnId ? null : headerFilterColumnId);
                              }}
                              disabled={selectionControlsDisabled}
                              aria-label={`Filtriraj ${column.label}`}
                              aria-haspopup={dateFilterColumnId ? 'dialog' : 'listbox'}
                              aria-expanded={openColumnFilter === headerFilterColumnId}
                              title={`Filtriraj ${column.label}`}
                            >
                              <ColumnFilterIcon className="!h-[12px] !w-[12px]" />
                            </button>
                          ) : null}
                          {supportsHeaderCopy ? (
                            <button
                              type="button"
                              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 transition-colors hover:text-[color:var(--blue-500)] focus-visible:text-[color:var(--blue-500)] focus-visible:outline-none"
                              onClick={(event) => {
                                event.stopPropagation();
                                if (selectionControlsDisabled) return;
                                void copyColumnValues(column);
                              }}
                              disabled={selectionControlsDisabled}
                              aria-label={`Kopiraj stolpec ${column.label}`}
                              title={`Kopiraj stolpec ${column.label} (ena vrednost na vrstico)`}
                            >
                              <CopyIcon className="!h-[11px] !w-[11px]" />
                            </button>
                          ) : null}
                        </span>
                      ) : null}
                    </div>
                  </TH>
                );
              })}
              <TH className={`${adminTableHeaderCellBaseClassName} w-[88px] min-w-[88px] max-w-[88px] text-center`}>
                <span>Uredi</span>
              </TH>
            </TR>
          </THead>
          <TBody>
            {pagedRows.length === 0 ? (
              <TR>
                <TD colSpan={Math.max(1, visibleColumns.length + 2)} className="h-36 text-center">
                  <EmptyState
                    title={initialDirectory.warningMessage
                      ? 'Podatki o strankah niso na voljo.'
                      : query || activeFilterChips.length > 0
                        ? 'Ni zadetkov za izbrano iskanje ali filtre.'
                        : 'Seznam strank je prazen.'}
                    description={initialDirectory.warningMessage
                      ?? (query || activeFilterChips.length > 0
                        ? 'Poskusite z drugim iskalnim nizom ali odstranite katerega od filtrov.'
                        : 'Dodajte prvo stranko ali počakajte na prvo veljavno naročilo.')}
                  />
                </TD>
              </TR>
            ) : pagedRows.map((row) => {
              const rowEdit = activeRowEdit?.rowId === row.id ? activeRowEdit : null;
              const isSelected = selectedRowIds.has(row.id);
              return (
                <TR
                  key={row.id}
                  className={`border-b border-slate-100 last:border-b-0 ${isSelected ? adminTableRowToneClasses.selected : ''}`}
                >
                  <TD className={`${adminTableBodyCellBaseClassName} ${adminExpandableTableCheckboxColumnClassName} px-2 text-center`}>
                    <div className="flex h-12 items-center justify-center">
                      <AdminCheckbox
                        checked={isSelected}
                        disabled={selectionControlsDisabled}
                        onChange={() => toggleRowSelection(row.id)}
                        aria-label={`Izberi ${row.name}`}
                      />
                    </div>
                  </TD>
                  {visibleColumns.map((column, columnIndex) => {
                    const value = getColumnDisplayValue(row, column.id);
                    const displayLines = getCellLines(row, column.id);
                    const hasValue = displayLines.length > 0;
                    const renderedLines = hasValue ? displayLines : ['—'];
                    const hasMultipleLines = renderedLines.length > 1;
                    const supportsMatchingHover = MATCHING_HOVER_COLUMN_IDS.has(column.id);
                    const isEditableColumn = EDITABLE_COLUMN_IDS.has(column.id);
                    const editableColumnId = isEditableColumn
                      ? column.id as EditableCustomerColumnId
                      : null;
                    return (
                      <TD key={column.id} className={getBodyCellClassName(column.align)}>
                        {rowEdit && editableColumnId ? (
                          <input
                            autoFocus={columnIndex === 0}
                            value={rowEdit.draftFields[editableColumnId]}
                            onFocus={(event) => {
                              if (columnIndex === 0) event.currentTarget.select();
                            }}
                            onChange={(event) => {
                              const nextValue = event.target.value;
                              setActiveRowEdit((current) => current?.rowId === row.id
                                ? {
                                  ...current,
                                  draftFields: {
                                    ...current.draftFields,
                                    [editableColumnId]: nextValue
                                  }
                                }
                                : current);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                void saveRowEdit();
                              }
                              if (event.key === 'Escape') {
                                event.preventDefault();
                                cancelRowEdit();
                              }
                            }}
                            disabled={rowEdit.isSaving}
                            className={`${adminTableInlineEditInputClassName} ${column.align === 'center' ? 'text-center' : ''}`}
                            aria-label={`${getColumnAccessibleLabel(column)}, urejanje stranke`}
                          />
                        ) : (
                          <button
                            type="button"
                            className={`flex w-full cursor-default items-center rounded-md px-0 text-[12px] text-slate-700 focus-visible:bg-slate-50 focus-visible:outline-none ${hasMultipleLines ? 'min-h-8 py-1' : 'h-8'} ${column.align === 'center' ? 'justify-center text-center' : 'text-left'} ${column.kind === 'number' || column.kind === 'date' ? 'tabular-nums' : ''}`}
                            onClick={() => void copyCellValue(value)}
                            title={value || '—'}
                            aria-label={`${getColumnAccessibleLabel(column)}: ${value || 'prazno'}. Kopiraj vrednost.`}
                            onFocus={supportsMatchingHover && !rowEdit ? () => setHoveredMatch(column.id, value) : undefined}
                            onBlur={supportsMatchingHover && !rowEdit ? () => setHoveredCellMatch(null) : undefined}
                          >
                            <span
                              className={`${adminTableMatchingValueBaseClassName} min-w-0 max-w-full ${hasMultipleLines ? `flex-col gap-0.5 ${column.align === 'center' ? '!items-center' : '!items-start'}` : 'truncate'} ${hasValue ? '' : 'text-slate-300'} ${getMatchingValueClassName(column.id, value)}`}
                              onMouseEnter={supportsMatchingHover && !rowEdit ? () => setHoveredMatch(column.id, value) : undefined}
                              onMouseLeave={supportsMatchingHover && !rowEdit ? () => setHoveredCellMatch(null) : undefined}
                            >
                              {renderedLines.map((line, lineIndex) => (
                                <span key={`${line}-${lineIndex}`} className="block max-w-full truncate">
                                  {line}
                                </span>
                              ))}
                            </span>
                          </button>
                        )}
                      </TD>
                    );
                  })}
                  <TD className={`${adminTableBodyCellBaseClassName} w-[88px] min-w-[88px] max-w-[88px] text-center`}>
                    {rowEdit ? (
                      <RowActions className={adminTableInlineActionRowClassName}>
                        <IconButton
                          type="button"
                          tone="neutral"
                          size="sm"
                          className={adminTableInlineConfirmButtonClassName}
                          onClick={() => void saveRowEdit()}
                          disabled={!isActiveRowDirty || rowEdit.isSaving}
                          aria-label={`Shrani urejanje stranke ${row.name || row.id}`}
                          title={isActiveRowDirty ? 'Shrani' : 'Ni sprememb za shranjevanje'}
                        >
                          {rowEdit.isSaving
                            ? <Spinner size="sm" className="text-[#1982bf]" />
                            : <CheckIcon className={adminTableInlineConfirmIconClassName} strokeWidth={2.2} />}
                        </IconButton>
                        <IconButton
                          type="button"
                          tone="neutral"
                          size="sm"
                          className={adminTableInlineCancelButtonClassName}
                          onClick={cancelRowEdit}
                          disabled={rowEdit.isSaving}
                          aria-label={`Prekliči urejanje stranke ${row.name || row.id}`}
                          title="Prekliči"
                        >
                          <CloseIcon
                            className={adminTableInlineCancelIconClassName}
                            strokeWidth={1.9}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </IconButton>
                      </RowActions>
                    ) : (
                      <RowActions className="relative">
                        <RowActionsDropdown
                          label="Dejanja stranke"
                          menuWidth={144}
                          menuClassName="w-36"
                          items={[
                            {
                              key: 'edit',
                              label: 'Uredi',
                              icon: <PencilIcon />,
                              disabled: !persistenceAvailable || isStructuralMutationPending || pendingMutations > 0,
                              onSelect: () => beginRowEdit(row)
                            },
                            {
                              key: 'delete',
                              label: 'Izbriši',
                              icon: <TrashCanIcon />,
                              disabled: !persistenceAvailable || isStructuralMutationPending || pendingMutations > 0 || Boolean(activeRowEdit),
                              className: 'text-rose-600 hover:!bg-rose-50 hover:!text-rose-600',
                              onSelect: () => openDeleteDialog([row])
                            }
                          ]}
                        />
                      </RowActions>
                    )}
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </AdminTableLayout>

      <HeaderFilterPortal open={Boolean(openColumnFilter)}>
        {openCategoricalFilter ? (
          <div
            style={getHeaderPopoverStyle(
              columnFilterButtonRefs.current[openCategoricalFilter] ?? null,
              columnFilterMenuWidths[openCategoricalFilter]
            )}
          >
            <MenuPanel
              ref={columnFilterMenuRef}
              className="w-full overflow-x-hidden overflow-y-auto whitespace-nowrap shadow-lg"
              style={{ maxHeight: 'min(24rem, calc(100vh - 12rem))' }}
            >
              <div
                role="listbox"
                aria-label={`Filter: ${FILTER_LABELS[openCategoricalFilter]}`}
                onKeyDown={(event) => {
                  const options = Array.from(
                    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]:not(:disabled)')
                  );
                  const currentIndex = options.indexOf(document.activeElement as HTMLButtonElement);
                  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    const offset = event.key === 'ArrowDown' ? 1 : -1;
                    const nextIndex = currentIndex < 0
                      ? 0
                      : (currentIndex + offset + options.length) % options.length;
                    options[nextIndex]?.focus();
                  }
                  if (event.key === 'Home' || event.key === 'End') {
                    event.preventDefault();
                    options[event.key === 'Home' ? 0 : options.length - 1]?.focus();
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    event.stopPropagation();
                    const columnId = openCategoricalFilter;
                    setOpenColumnFilter(null);
                    restoreColumnFilterFocus(columnId);
                  }
                }}
              >
                <MenuItem
                  role="option"
                  ariaSelected={!columnFilters[openCategoricalFilter]}
                  isActive={!columnFilters[openCategoricalFilter]}
                  className="sticky top-0 z-10 bg-white font-semibold"
                  onClick={() => {
                    const columnId = openCategoricalFilter;
                    setColumnFilters((current) => ({ ...current, [columnId]: '' }));
                    setOpenColumnFilter(null);
                    restoreColumnFilterFocus(columnId);
                  }}
                >
                  {FILTER_ALL_LABELS[openCategoricalFilter]}
                </MenuItem>
                {columnFilterOptions[openCategoricalFilter].map((option) => {
                  const isSelected = normalizeComparableValue(columnFilters[openCategoricalFilter])
                    === normalizeComparableValue(option);
                  return (
                    <MenuItem
                      key={option}
                      role="option"
                      ariaSelected={isSelected}
                      isActive={isSelected}
                      className={isSelected ? 'bg-slate-100 font-semibold' : undefined}
                      onClick={() => {
                        const columnId = openCategoricalFilter;
                        setColumnFilters((current) => ({ ...current, [columnId]: option }));
                        setOpenColumnFilter(null);
                        restoreColumnFilterFocus(columnId);
                      }}
                    >
                      {option}
                    </MenuItem>
                  );
                })}
              </div>
            </MenuPanel>
          </div>
        ) : null}
        {openDateFilter ? (
          <div
            ref={dateFilterPanelRef}
            lang="sl-SI"
            role="dialog"
            aria-label={`Filter: ${DATE_FILTER_LABELS[openDateFilter]}`}
            onKeyDown={(event) => {
              if (event.key !== 'Escape') return;
              event.preventDefault();
              event.stopPropagation();
              const columnId = openDateFilter;
              setOpenColumnFilter(null);
              restoreColumnFilterFocus(columnId);
            }}
            style={getHeaderPopoverStyle(
              columnFilterButtonRefs.current[openDateFilter] ?? null,
              380
            )}
            className={adminTablePopoverPanelClassName}
          >
            <h4 className="mb-2 text-[11px] font-semibold text-slate-800">Nastavi obdobje</h4>
            <div className="mb-3 grid grid-cols-3 gap-2">
              {QUICK_DATE_RANGE_OPTIONS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  aria-label={item.label}
                  onClick={() => {
                    const columnId = openDateFilter;
                    const quickRange = applyQuickDateRange(columnId, item.key);
                    setDraftDateRange(quickRange);
                    setDateFilters((current) => ({ ...current, [columnId]: quickRange }));
                    setOpenColumnFilter(null);
                    restoreColumnFilterFocus(columnId);
                  }}
                  className={DATE_PRESET_BUTTON_CLASS}
                >
                  <span className={DATE_PRESET_VALUE_CLASS}>{item.value}</span>
                  {item.unit ? <span className={DATE_PRESET_UNIT_CLASS}>{item.unit}</span> : null}
                </button>
              ))}
            </div>
            <div className="mb-3 border-t border-slate-200 pt-3">
              <div className="grid grid-cols-2 gap-2">
                <AdminFilterInput
                  type="date"
                  lang="sl-SI"
                  value={draftDateRange.from}
                  onChange={(event) => setDraftDateRange((current) => ({
                    ...current,
                    from: event.target.value
                  }))}
                  aria-label="Od"
                />
                <AdminFilterInput
                  type="date"
                  lang="sl-SI"
                  value={draftDateRange.to}
                  onChange={(event) => setDraftDateRange((current) => ({
                    ...current,
                    to: event.target.value
                  }))}
                  aria-label="Do"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className={adminTablePopoverPrimaryButtonClassName}
                onClick={() => {
                  const columnId = openDateFilter;
                  setDateFilters((current) => ({ ...current, [columnId]: draftDateRange }));
                  setOpenColumnFilter(null);
                  restoreColumnFilterFocus(columnId);
                }}
              >
                Potrdi
              </button>
              <button
                type="button"
                className={adminTablePopoverSecondaryButtonClassName}
                onClick={() => {
                  const columnId = openDateFilter;
                  const emptyRange = { from: '', to: '' };
                  setDraftDateRange(emptyRange);
                  setDateFilters((current) => ({ ...current, [columnId]: emptyRange }));
                  setOpenColumnFilter(null);
                  restoreColumnFilterFocus(columnId);
                }}
              >
                Ponastavi
              </button>
            </div>
          </div>
        ) : null}
      </HeaderFilterPortal>

      <LazyConfirmDialog
        open={pendingDelete !== null}
        title={pendingDelete?.rows.length === 1
          ? 'Odstranim stranko s seznama?'
          : 'Odstranim izbrane stranke s seznama?'}
        description={pendingDelete?.rows.length === 1
          ? `Stranka »${pendingDelete.rows[0]?.name || 'izbrana stranka'}« bo odstranjena s seznama. Njena obstoječa naročila in zgodovina nakupov ostanejo nespremenjeni.`
          : `${pendingDelete?.rows.length ?? 0} izbranih strank bo odstranjenih s seznama. Njihova obstoječa naročila in zgodovina nakupov ostanejo nespremenjeni.`}
        confirmLabel="Odstrani"
        cancelLabel="Prekliči"
        isDanger
        confirmDisabled={isStructuralMutationPending}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
