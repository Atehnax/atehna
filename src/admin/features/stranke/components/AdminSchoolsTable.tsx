'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  SchoolDirectoryColumn,
  SchoolDirectoryData,
  SchoolDirectoryMutation,
  SchoolDirectoryRow
} from '@/shared/domain/schoolDirectory';
import { AdminSearchInput } from '@/shared/ui/admin-search-input';
import {
  AdminTableLayout,
  AdminTablePrimaryActionButton,
  ColumnVisibilityControl,
  adminExpandableTableCheckboxColumnClassName,
  adminTableBodyCellCenterClassName,
  adminTableBodyCellLeftClassName,
  adminTableCardClassName,
  adminTableCardStyle,
  adminTableContentClassName,
  adminTableHeaderCellLeftClassName,
  adminTableHeaderCellCenterClassName,
  adminTableHeaderButtonClassName,
  adminTableHeaderAdjacentControlsClassName,
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
  adminTableSelectedDangerIconButtonClassName,
  adminTableToolbarActionsClassName,
  adminTableToolbarSearchWrapperClassName
} from '@/shared/ui/admin-table';
import LazyConfirmDialog from '@/shared/ui/confirm-dialog/lazy-confirm-dialog';
import {
  HeaderFilterPortal,
  HEADER_FILTER_BUTTON_CLASS,
  HEADER_FILTER_ROOT_ATTR,
  getHeaderPopoverStyle,
  useHeaderFilterDismiss
} from '@/shared/ui/admin-header-filter';
import { AdminCheckbox } from '@/shared/ui/checkbox';
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
import {
  adminTableRowToneClasses,
  filterPillClearGlyph,
  filterPillTokenClasses
} from '@/shared/ui/theme/tokens';
import { useToast } from '@/shared/ui/toast';
import { useDropdownDismiss } from '@/shared/ui/dropdown/use-dropdown-dismiss';
import { downloadTableAsCsv, downloadTableAsXlsx } from '@/shared/utils/table-export';

type ActiveRowEdit = {
  rowId: string;
  originalCells: Record<string, string>;
  draftCells: Record<string, string>;
  isSaving: boolean;
};

type SortState = {
  columnId: string;
  direction: 'asc' | 'desc';
};

type HoveredCellMatch = {
  columnId: string;
  value: string;
};

type PendingDelete = {
  rows: SchoolDirectoryRow[];
};

const FILTERABLE_COLUMN_IDS = [
  'statisticna-regija',
  'obcina',
  'postna-stevilka',
  'posta'
] as const;

type FilterableColumnId = (typeof FILTERABLE_COLUMN_IDS)[number];
type SchoolColumnFilters = Record<FilterableColumnId, string>;

type MutationResponse = {
  ok?: boolean;
  message?: string;
  updatedAt?: string;
  row?: SchoolDirectoryRow;
  rows?: SchoolDirectoryRow[];
  deletedRowIds?: string[];
  missingRowIds?: string[];
};

class SchoolDirectoryRequestError extends Error {
  readonly status: number;
  readonly row?: SchoolDirectoryRow;
  readonly rows?: SchoolDirectoryRow[];
  readonly missingRowIds?: string[];

  constructor(
    message: string,
    status: number,
    row?: SchoolDirectoryRow,
    rows?: SchoolDirectoryRow[],
    missingRowIds?: string[]
  ) {
    super(message);
    this.name = 'SchoolDirectoryRequestError';
    this.status = status;
    this.row = row;
    this.rows = rows;
    this.missingRowIds = missingRowIds;
  }
}

const PAGE_SIZE_OPTIONS = [25, 50, 100];
const EMPTY_COLUMN_FILTERS: SchoolColumnFilters = {
  'statisticna-regija': '',
  obcina: '',
  'postna-stevilka': '',
  posta: ''
};
const FILTERABLE_COLUMN_LABELS: Record<FilterableColumnId, string> = {
  'statisticna-regija': 'Statistična regija',
  obcina: 'Občina',
  'postna-stevilka': 'P. št.',
  posta: 'Pošta'
};
const FILTERABLE_COLUMN_ALL_LABELS: Record<FilterableColumnId, string> = {
  'statisticna-regija': 'Vse statistične regije',
  obcina: 'Vse občine',
  'postna-stevilka': 'Vse poštne številke',
  posta: 'Vse pošte'
};
const DEFAULT_HIDDEN_COLUMN_IDS = new Set([
  'zavsif',
  'prsmss',
  'statisticna-regija',
  'obcina',
  'ds',
  'trr'
]);
const MATCHING_VALUE_HOVER_COLUMN_IDS = new Set([
  'naziv',
  'naslov',
  'postna-stevilka',
  'posta'
]);
const COLUMN_TITLE_OVERRIDES: Record<string, string> = {
  'postna-stevilka': 'P. št.',
  'spletna-stran': 'Spletna stran',
  'kontaktne-osebe': 'Kontakti'
};
const SCHOOL_SELECTION_COLUMN_WIDTH = 40;
const SCHOOL_ROW_NUMBER_COLUMN_WIDTH = 48;
const SCHOOL_ACTIONS_COLUMN_WIDTH = 88;
const SCHOOL_FIXED_COLUMNS_WIDTH = SCHOOL_SELECTION_COLUMN_WIDTH
  + SCHOOL_ROW_NUMBER_COLUMN_WIDTH
  + SCHOOL_ACTIONS_COLUMN_WIDTH;
const SCHOOL_COLUMN_WIDTHS: Record<string, number> = {
  zavsif: 112,
  prsmss: 112,
  'statisticna-regija': 200,
  obcina: 160,
  naziv: 260,
  naslov: 180,
  'postna-stevilka': 112,
  posta: 176,
  telefon: 115,
  'e-naslov': 240,
  'spletna-stran': 280,
  ds: 96,
  trr: 144,
  'kontaktne-osebe': 144
};
const schoolCellCollator = new Intl.Collator('sl', { sensitivity: 'base', numeric: true });
const EMPTY_CELL_MATCH_VALUE = '\u0000empty-cell';
const FILTER_MENU_MIN_WIDTH = 120;
const FILTER_MENU_MAX_WIDTH = 360;
const FILTER_MENU_HORIZONTAL_CHROME = 52;

const isFilterableColumnId = (columnId: string): columnId is FilterableColumnId =>
  FILTERABLE_COLUMN_IDS.includes(columnId as FilterableColumnId);

const getColumnTitle = (column: SchoolDirectoryColumn) => COLUMN_TITLE_OVERRIDES[column.id] ?? column.label;
const isCenteredColumn = (columnId: string) => columnId === 'postna-stevilka';

const getCellDisplayLines = (value: string, columnId: string) => {
  const delimiter = columnId === 'telefon' ? /[;,\r\n]+/ : /[;\r\n]+/;
  const lines = value
    .split(delimiter)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length > 0 ? lines : [value.trim()];
};

const getWebsiteHref = (value: string) => {
  const trimmedValue = value.trim();
  if (!trimmedValue) return null;

  const candidate = /^https?:\/\//i.test(trimmedValue)
    ? trimmedValue
    : `https://${trimmedValue}`;
  try {
    const url = new URL(candidate);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
};

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
      // Some browsers expose rich clipboard writes but reject them. Fall back to plain text.
    }
  }

  if (!navigator.clipboard.writeText) throw new Error('Clipboard text API is unavailable.');
  await navigator.clipboard.writeText(plainText);
};

const getFilterMenuWidth = (labels: readonly string[]) => {
  const fallbackTextWidth = Math.max(...labels.map((label) => Array.from(label).length * 6.5), 0);
  if (typeof document === 'undefined') {
    return Math.min(FILTER_MENU_MAX_WIDTH, Math.max(FILTER_MENU_MIN_WIDTH, Math.ceil(fallbackTextWidth + FILTER_MENU_HORIZONTAL_CHROME)));
  }

  const context = document.createElement('canvas').getContext('2d');
  if (!context) {
    return Math.min(FILTER_MENU_MAX_WIDTH, Math.max(FILTER_MENU_MIN_WIDTH, Math.ceil(fallbackTextWidth + FILTER_MENU_HORIZONTAL_CHROME)));
  }

  context.font = '400 12px Inter, system-ui, sans-serif';
  const measuredTextWidth = Math.max(...labels.map((label) => context.measureText(label).width), 0);
  return Math.min(
    FILTER_MENU_MAX_WIDTH,
    Math.max(FILTER_MENU_MIN_WIDTH, Math.ceil(measuredTextWidth + FILTER_MENU_HORIZONTAL_CHROME))
  );
};

const normalizeComparableCellValue = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return EMPTY_CELL_MATCH_VALUE;
  return trimmed
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('sl')
    .trim();
};

const parseNumericCellValue = (value: string) => {
  const normalized = value.trim();
  if (!/^[+-]?\d+(?:[.,]\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

const compareCanonicalRowOrder = (left: SchoolDirectoryRow, right: SchoolDirectoryRow) =>
  left.position - right.position || left.id.localeCompare(right.id);

const createClientId = () => {
  const randomPart = typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `row-${randomPart}`;
};

const getSchoolColumnWidth = (columnId: string) => SCHOOL_COLUMN_WIDTHS[columnId] ?? 160;

const getResponsiveSchoolColumnWidth = (columnId: string, totalColumnWidth: number) => {
  if (totalColumnWidth <= 0) return 'auto';
  const widthRatio = getSchoolColumnWidth(columnId) / totalColumnWidth;
  const percentage = (widthRatio * 100).toFixed(6);
  const fixedColumnOffset = (widthRatio * SCHOOL_FIXED_COLUMNS_WIDTH).toFixed(3);
  return `calc(${percentage}% - ${fixedColumnOffset}px)`;
};

export default function AdminSchoolsTable({ initialDirectory }: { initialDirectory: SchoolDirectoryData }) {
  const [columns] = useState(initialDirectory.columns);
  const [rows, setRows] = useState(initialDirectory.rows);
  const [query, setQuery] = useState('');
  const [columnFilters, setColumnFilters] = useState<SchoolColumnFilters>(() => ({ ...EMPTY_COLUMN_FILTERS }));
  const [openColumnFilter, setOpenColumnFilter] = useState<FilterableColumnId | null>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [visibleMap, setVisibleMap] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      initialDirectory.columns.map((column) => [column.id, !DEFAULT_HIDDEN_COLUMN_IDS.has(column.id)])
    )
  );
  const [activeRowEdit, setActiveRowEdit] = useState<ActiveRowEdit | null>(null);
  const [sortState, setSortState] = useState<SortState | null>(null);
  const [hoveredCellMatch, setHoveredCellMatch] = useState<HoveredCellMatch | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(() => new Set());
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [pendingMutations, setPendingMutations] = useState(0);
  const [isStructuralMutationPending, setIsStructuralMutationPending] = useState(false);
  const [isDuplicatingSelected, setIsDuplicatingSelected] = useState(false);
  const selectAllRowsRef = useRef<HTMLInputElement | null>(null);
  const columnFilterButtonRefs = useRef<Partial<Record<FilterableColumnId, HTMLButtonElement | null>>>({});
  const columnFilterMenuRef = useRef<HTMLDivElement | null>(null);
  const exportMenuRootRef = useRef<HTMLDivElement | null>(null);
  const exportMenuDismissRefs = useMemo(() => [exportMenuRootRef], []);
  const { toast } = useToast();
  const persistenceAvailable = initialDirectory.persistenceAvailable;

  const orderedColumns = useMemo(() => {
    const nextColumns = [...columns].sort(
      (left, right) => left.position - right.position || left.id.localeCompare(right.id)
    );
    const contactsIndex = nextColumns.findIndex((column) => column.id === 'kontaktne-osebe');
    const emailIndex = nextColumns.findIndex((column) => column.id === 'e-naslov');

    if (contactsIndex < 0 || emailIndex < 0 || contactsIndex === emailIndex - 1) return nextColumns;

    const [contactsColumn] = nextColumns.splice(contactsIndex, 1);
    const nextEmailIndex = nextColumns.findIndex((column) => column.id === 'e-naslov');
    nextColumns.splice(nextEmailIndex, 0, contactsColumn);
    return nextColumns;
  }, [columns]);
  const visibleColumns = useMemo(
    () => orderedColumns.filter((column) => visibleMap[column.id] !== false),
    [orderedColumns, visibleMap]
  );
  const visibleSchoolColumnWidth = visibleColumns.reduce(
    (total, column) => total + getSchoolColumnWidth(column.id),
    0
  );
  const columnFilterOptions = useMemo<Record<FilterableColumnId, string[]>>(() => {
    const options = {} as Record<FilterableColumnId, string[]>;
    FILTERABLE_COLUMN_IDS.forEach((columnId) => {
      const uniqueValues = new Map<string, string>();
      rows.forEach((row) => {
        const value = (row.cells[columnId] ?? '').trim();
        if (!value) return;
        const comparableValue = normalizeComparableCellValue(value);
        if (!uniqueValues.has(comparableValue)) uniqueValues.set(comparableValue, value);
      });
      options[columnId] = Array.from(uniqueValues.values()).sort((left, right) =>
        schoolCellCollator.compare(left, right));
    });
    return options;
  }, [rows]);
  const columnFilterMenuWidths = useMemo<Record<FilterableColumnId, number>>(() => {
    const widths = {} as Record<FilterableColumnId, number>;
    FILTERABLE_COLUMN_IDS.forEach((columnId) => {
      widths[columnId] = getFilterMenuWidth([
        FILTERABLE_COLUMN_ALL_LABELS[columnId],
        ...columnFilterOptions[columnId]
      ]);
    });
    return widths;
  }, [columnFilterOptions]);
  const activeColumnFilters = useMemo(
    () => FILTERABLE_COLUMN_IDS.flatMap((columnId) => {
      const value = columnFilters[columnId];
      return value ? [{ columnId, label: FILTERABLE_COLUMN_LABELS[columnId], value }] : [];
    }),
    [columnFilters]
  );
  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('sl');
    const orderedRows = [...rows].sort(compareCanonicalRowOrder);
    return orderedRows.filter((row) => {
      const matchesSearch = !normalizedQuery || orderedColumns.some((column) =>
        (row.cells[column.id] ?? '').toLocaleLowerCase('sl').includes(normalizedQuery));
      const matchesColumnFilters = FILTERABLE_COLUMN_IDS.every((columnId) => {
        const selectedValue = columnFilters[columnId];
        return !selectedValue
          || normalizeComparableCellValue(row.cells[columnId] ?? '') === normalizeComparableCellValue(selectedValue);
      });
      return matchesSearch && matchesColumnFilters;
    });
  }, [columnFilters, orderedColumns, query, rows]);
  const filteredAndSortedRows = useMemo(() => {
    if (!sortState) return filteredRows;

    const nonEmptyValues = rows
      .map((row) => row.cells[sortState.columnId] ?? '')
      .filter((value) => value.trim().length > 0);
    const isNumericColumn = nonEmptyValues.length > 0
      && nonEmptyValues.every((value) => parseNumericCellValue(value) !== null);
    const directionMultiplier = sortState.direction === 'asc' ? 1 : -1;

    return [...filteredRows].sort((left, right) => {
      const leftValue = left.cells[sortState.columnId] ?? '';
      const rightValue = right.cells[sortState.columnId] ?? '';
      const leftIsBlank = leftValue.trim().length === 0;
      const rightIsBlank = rightValue.trim().length === 0;

      if (leftIsBlank !== rightIsBlank) return leftIsBlank ? 1 : -1;
      if (leftIsBlank && rightIsBlank) return compareCanonicalRowOrder(left, right);

      const primaryResult = isNumericColumn
        ? (parseNumericCellValue(leftValue) as number) - (parseNumericCellValue(rightValue) as number)
        : schoolCellCollator.compare(leftValue.trim(), rightValue.trim());
      if (primaryResult !== 0) return primaryResult * directionMultiplier;
      return compareCanonicalRowOrder(left, right);
    });
  }, [filteredRows, rows, sortState]);
  const pagination = useTablePagination({
    totalCount: filteredRows.length,
    storageKey: 'admin-schools-page-size-v3',
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
        return compareCanonicalRowOrder(left, right);
      });
  }, [filteredAndSortedRows, rows, selectedRowIds]);
  const selectedVisibleCount = useMemo(
    () => pagedRowIds.reduce((count, rowId) => count + (selectedRowIds.has(rowId) ? 1 : 0), 0),
    [pagedRowIds, selectedRowIds]
  );
  const allVisibleRowsSelected = pagedRowIds.length > 0 && selectedVisibleCount === pagedRowIds.length;
  const hasSelectedRows = selectedRows.length > 0;
  const rowNumberOffset = (pagination.page - 1) * pagination.pageSize;
  const selectionControlsDisabled = Boolean(activeRowEdit)
    || isStructuralMutationPending
    || pendingMutations > 0;
  const isActiveRowDirty = useMemo(() => activeRowEdit
    ? orderedColumns.some((column) =>
      (activeRowEdit.draftCells[column.id] ?? '') !== (activeRowEdit.originalCells[column.id] ?? ''))
    : false, [activeRowEdit, orderedColumns]);

  useEffect(() => {
    setPage(1);
  }, [columnFilters, query, setPage, sortState]);

  useEffect(() => {
    const input = selectAllRowsRef.current;
    if (!input) return;
    input.indeterminate = selectedVisibleCount > 0 && !allVisibleRowsSelected;
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
    if (!openColumnFilter) return;
    const frameId = window.requestAnimationFrame(() => {
      const selectedOption = columnFilterMenuRef.current?.querySelector<HTMLElement>('[role="option"][aria-selected="true"]');
      const firstOption = columnFilterMenuRef.current?.querySelector<HTMLElement>('[role="option"]');
      (selectedOption ?? firstOption)?.focus();
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [openColumnFilter]);

  const persistMutation = async (mutation: SchoolDirectoryMutation) => {
    if (!persistenceAvailable) throw new Error('Povezava z bazo ni nastavljena.');
    setPendingMutations((count) => count + 1);
    try {
      const response = await fetch('/api/admin/schools', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(mutation)
      });
      const payload = await response.json().catch(() => ({})) as MutationResponse;
      if (!response.ok) {
        throw new SchoolDirectoryRequestError(
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

  const beginRowEdit = (row: SchoolDirectoryRow) => {
    if (!persistenceAvailable || isStructuralMutationPending || pendingMutations > 0) return;
    if (activeRowEdit && activeRowEdit.rowId !== row.id && isActiveRowDirty) {
      toast.error('Najprej shranite ali prekličite trenutno urejanje.');
      return;
    }
    setOpenColumnFilter(null);
    setIsExportMenuOpen(false);
    setHoveredCellMatch(null);
    setActiveRowEdit({
      rowId: row.id,
      originalCells: { ...row.cells },
      draftCells: { ...row.cells },
      isSaving: false
    });
  };

  const toggleRowSelection = (rowId: string) => {
    if (activeRowEdit || isStructuralMutationPending || pendingMutations > 0) return;
    setSelectedRowIds((current) => {
      const next = new Set(current);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };

  const toggleAllVisibleRows = () => {
    if (activeRowEdit || isStructuralMutationPending || pendingMutations > 0) return;
    setSelectedRowIds((current) => {
      const next = new Set(current);
      if (allVisibleRowsSelected) pagedRowIds.forEach((rowId) => next.delete(rowId));
      else pagedRowIds.forEach((rowId) => next.add(rowId));
      return next;
    });
  };

  const cancelRowEdit = () => {
    if (activeRowEdit?.isSaving) return;
    setActiveRowEdit(null);
  };

  const toggleSort = (columnId: string) => {
    if (activeRowEdit || isStructuralMutationPending || pendingMutations > 0) return;
    setOpenColumnFilter(null);
    setSortState((current) => {
      if (!current || current.columnId !== columnId) return { columnId, direction: 'asc' };
      if (current.direction === 'asc') return { columnId, direction: 'desc' };
      return null;
    });
  };

  const getSortActionLabel = (column: SchoolDirectoryColumn) => {
    const columnTitle = getColumnTitle(column);
    if (sortState?.columnId !== column.id) return `${columnTitle}: razvrsti naraščajoče`;
    if (sortState.direction === 'asc') return `${columnTitle}: razvrsti padajoče`;
    return `${columnTitle}: povrni prvotni vrstni red`;
  };

  const restoreColumnFilterTriggerFocus = (columnId: FilterableColumnId) => {
    window.requestAnimationFrame(() => columnFilterButtonRefs.current[columnId]?.focus());
  };

  const getMatchingValueClassName = (columnId: string, value: string) =>
    MATCHING_VALUE_HOVER_COLUMN_IDS.has(columnId)
    && hoveredCellMatch?.columnId === columnId
    && hoveredCellMatch.value === normalizeComparableCellValue(value)
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

  const copyColumnValues = async (column: SchoolDirectoryColumn) => {
    const values = filteredAndSortedRows.flatMap((row) =>
      (row.cells[column.id] ?? '')
        .split(/[;\r\n]+/)
        .map((value) => value.trim())
        .filter(Boolean));

    if (values.length === 0) {
      toast.info('Ni vrednosti za kopiranje glede na trenutne filtre.');
      return;
    }

    setOpenColumnFilter(null);
    setIsExportMenuOpen(false);
    const plainText = values.join(';\r\n');
    const htmlText = values.map(escapeClipboardHtml).join(';<br>');

    try {
      await writeClipboardContent(plainText, htmlText);
      toast.success(`Kopirano: ${values.length} vrednosti iz stolpca »${getColumnTitle(column)}«.`);
    } catch {
      toast.error('Stolpca ni bilo mogoče kopirati.');
    }
  };

  const exportSchools = (format: 'csv' | 'xlsx') => {
    setIsExportMenuOpen(false);
    const sourceRows = hasSelectedRows ? selectedRows : filteredAndSortedRows;
    if (sourceRows.length === 0) {
      toast.info('Ni šol za izvoz glede na trenutne filtre.');
      return;
    }

    const exportRows = [
      orderedColumns.map((column) => getColumnTitle(column)),
      ...sourceRows.map((row) =>
        orderedColumns.map((column) => row.cells[column.id] ?? ''))
    ];

    try {
      if (format === 'csv') {
        downloadTableAsCsv(exportRows, 'seznam-sol.csv');
      } else {
        downloadTableAsXlsx(exportRows, 'seznam-sol.xlsx', { sheetName: 'Seznam šol' });
      }
      toast.success(`${hasSelectedRows ? 'Izbrane vrstice so izvožene' : 'Tabela je izvožena'} kot ${format.toUpperCase()}.`);
    } catch {
      toast.error('Tabele ni bilo mogoče izvoziti.');
    }
  };

  const saveRowEdit = async () => {
    const edit = activeRowEdit;
    if (!edit || edit.isSaving) return;

    const changedCells: Record<string, string> = {};
    orderedColumns.forEach((column) => {
      const original = edit.originalCells[column.id] ?? '';
      const draft = edit.draftCells[column.id] ?? '';
      if (draft !== original) changedCells[column.id] = draft;
    });
    if (!Object.keys(changedCells).length) {
      return;
    }
    const expectedCells = Object.fromEntries(
      Object.keys(changedCells).map((columnId) => [columnId, edit.originalCells[columnId] ?? ''])
    );

    setActiveRowEdit((current) => current?.rowId === edit.rowId
      ? { ...current, isSaving: true }
      : current);
    try {
      const response = await persistMutation({
        operation: 'update-row',
        rowId: edit.rowId,
        cells: changedCells,
        expectedCells
      });
      setRows((currentRows) => currentRows.map((row) => row.id === edit.rowId
        ? (response.row ?? { ...row, cells: { ...row.cells, ...changedCells } })
        : row));
      setActiveRowEdit(null);
      toast.success('Vrstica je posodobljena.');
    } catch (error) {
      if (error instanceof SchoolDirectoryRequestError && error.status === 409 && error.row) {
        const refreshedRow = error.row;
        const changedColumnIds = orderedColumns
          .filter((column) =>
            (edit.draftCells[column.id] ?? '') !== (edit.originalCells[column.id] ?? ''))
          .map((column) => column.id);
        const refreshedDraftCells = { ...refreshedRow.cells };
        changedColumnIds.forEach((columnId) => {
          refreshedDraftCells[columnId] = edit.draftCells[columnId] ?? '';
        });
        setRows((currentRows) => currentRows.map((row) => row.id === edit.rowId ? refreshedRow : row));
        setActiveRowEdit((current) => current?.rowId === edit.rowId
          ? {
            ...current,
            originalCells: { ...refreshedRow.cells },
            draftCells: refreshedDraftCells,
            isSaving: false
          }
          : current);
        toast.error(`${error.message} Najnovejši podatki so prikazani, vaš osnutek pa je ohranjen.`);
        return;
      }
      setActiveRowEdit((current) => current?.rowId === edit.rowId
        ? { ...current, isSaving: false }
        : current);
      toast.error(error instanceof Error ? error.message : 'Vrstice ni bilo mogoče shraniti.');
    }
  };

  const addRow = async () => {
    if (!persistenceAvailable || isStructuralMutationPending || pendingMutations > 0 || activeRowEdit) return;
    setIsStructuralMutationPending(true);
    const rowId = createClientId();
    const position = rows.reduce((minimum, row) => Math.min(minimum, row.position), 0) - 1;
    const optimisticRow: SchoolDirectoryRow = {
      id: rowId,
      position,
      cells: Object.fromEntries(orderedColumns.map((column) => [column.id, '']))
    };
    setSortState(null);
    setColumnFilters({ ...EMPTY_COLUMN_FILTERS });
    setOpenColumnFilter(null);
    setHoveredCellMatch(null);
    setRows((currentRows) => [optimisticRow, ...currentRows]);
    setQuery('');
    pagination.setPage(1);
    try {
      const response = await persistMutation({ operation: 'add-row', rowId });
      if (response.row) {
        setRows((currentRows) => currentRows.map((row) => row.id === rowId ? response.row as SchoolDirectoryRow : row));
      }
      toast.success('Nova stranka je dodana.');
    } catch (error) {
      setRows((currentRows) => currentRows.filter((row) => row.id !== rowId));
      toast.error(error instanceof Error ? error.message : 'Vrstice ni bilo mogoče dodati.');
    } finally {
      setIsStructuralMutationPending(false);
    }
  };

  const reconcileBatchConflict = (error: SchoolDirectoryRequestError) => {
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
      ...row,
      cells: { ...row.cells }
    }));
    setOpenColumnFilter(null);
    setIsExportMenuOpen(false);
    setIsDuplicatingSelected(true);
    setIsStructuralMutationPending(true);
    try {
      const response = await persistMutation({
        operation: 'duplicate-rows',
        rows: sourceRows.map((row) => ({
          sourceRowId: row.id,
          newRowId: createClientId(),
          expectedCells: row.cells
        }))
      });
      if (!response.rows?.length) throw new Error('Strežnik ni vrnil podvojenih vrstic.');

      const duplicatedRowIds = new Set(response.rows.map((row) => row.id));
      setRows((currentRows) => [
        ...response.rows as SchoolDirectoryRow[],
        ...currentRows.filter((row) => !duplicatedRowIds.has(row.id))
      ]);
      setSelectedRowIds(duplicatedRowIds);
      setSortState(null);
      setColumnFilters({ ...EMPTY_COLUMN_FILTERS });
      setHoveredCellMatch(null);
      setQuery('');
      pagination.setPage(1);
      toast.success(response.rows.length === 1
        ? 'Vrstica je podvojena.'
        : `${response.rows.length} vrstic je podvojenih.`);
    } catch (error) {
      if (error instanceof SchoolDirectoryRequestError && error.status === 409) {
        reconcileBatchConflict(error);
        toast.error(`${error.message} Podatki so osveženi; preverite izbor in poskusite znova.`);
      } else {
        toast.error(error instanceof Error ? error.message : 'Vrstic ni bilo mogoče podvojiti.');
      }
    } finally {
      setIsDuplicatingSelected(false);
      setIsStructuralMutationPending(false);
    }
  };

  const openDeleteDialog = (targetRows: readonly SchoolDirectoryRow[]) => {
    if (!targetRows.length) return;
    setOpenColumnFilter(null);
    setIsExportMenuOpen(false);
    setPendingDelete({
      rows: targetRows.map((row) => ({ ...row, cells: { ...row.cells } }))
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
          expectedCells: row.cells
        }))
      });
      const deletedRowIds = new Set(response.deletedRowIds ?? target.rows.map((row) => row.id));
      setRows((currentRows) => currentRows.filter((row) => !deletedRowIds.has(row.id)));
      setSelectedRowIds((current) => new Set(Array.from(current).filter((rowId) => !deletedRowIds.has(rowId))));
      toast.success(deletedRowIds.size === 1
        ? 'Vrstica je izbrisana.'
        : `${deletedRowIds.size} vrstic je izbrisanih.`);
    } catch (error) {
      if (error instanceof SchoolDirectoryRequestError && error.status === 409) {
        reconcileBatchConflict(error);
        toast.error(`${error.message} Podatki so osveženi; preverite izbor in poskusite znova.`);
      } else {
        toast.error(error instanceof Error ? error.message : 'Vrstic ni bilo mogoče izbrisati.');
      }
    } finally {
      setIsStructuralMutationPending(false);
    }
  };

  return (
    <div className="space-y-3">
      {!persistenceAvailable ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Prikazani so uvoženi podatki, vendar povezava z bazo ni na voljo. Urejanje je začasno onemogočeno.
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
            placeholder="Išči po vseh podatkih šol ..."
            wrapperClassName={adminTableToolbarSearchWrapperClassName}
          />
        }
        headerRight={
          <div className={adminTableToolbarActionsClassName}>
            <span className="hidden whitespace-nowrap text-xs text-slate-500 xl:inline">
              {pendingMutations > 0
                ? 'Shranjevanje ...'
                : hasSelectedRows
                  ? `${selectedRows.length} ${selectedRows.length === 1 ? 'izbrana' : 'izbranih'} / ${filteredRows.length} vrstic`
                  : `${filteredRows.length} vrstic`}
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
                aria-label={hasSelectedRows ? `Izvozi izbrane vrstice (${selectedRows.length})` : 'Izvozi tabelo'}
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
                    <MenuItem className="whitespace-nowrap !text-[12px]" onClick={() => exportSchools('csv')}>
                      CSV
                    </MenuItem>
                    <MenuItem className="whitespace-nowrap !text-[12px]" onClick={() => exportSchools('xlsx')}>
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
                ? `Podvoji izbrane vrstice (${selectedRows.length})`
                : 'Podvoji izbrane vrstice'}
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
                ? `Izbriši izbrane vrstice (${selectedRows.length})`
                : 'Izbriši izbrane vrstice'}
              title="Izbriši"
            >
              <TrashCanIcon className="!h-[18px] !w-[18px]" />
            </IconButton>
            <ColumnVisibilityControl
              options={orderedColumns.map((column) => ({ key: column.id, label: getColumnTitle(column) }))}
              visibleMap={visibleMap}
              onToggle={(columnId) => {
                const willHideColumn = visibleMap[columnId] !== false;
                setVisibleMap((currentMap) => ({
                  ...currentMap,
                  [columnId]: currentMap[columnId] === false
                }));
                if (willHideColumn) {
                  setOpenColumnFilter((current) => current === columnId ? null : current);
                  setSortState((current) => current?.columnId === columnId ? null : current);
                  setHoveredCellMatch(null);
                }
              }}
              showLabel={false}
              triggerClassName={adminTableNeutralIconButtonClassName}
              menuWidth={240}
            />
            <AdminTablePrimaryActionButton
              type="button"
              disabled={!persistenceAvailable || isStructuralMutationPending || pendingMutations > 0 || Boolean(activeRowEdit)}
              onClick={() => void addRow()}
            >
              Nova stranka
            </AdminTablePrimaryActionButton>
          </div>
        }
        filterRowLeft={activeColumnFilters.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {activeColumnFilters.map((filter) => (
              <span key={filter.columnId} className={filterPillTokenClasses.base}>
                <span>
                  {filter.label}:{' '}
                  <span className="font-semibold">{filter.value}</span>
                </span>
                <button
                  type="button"
                  className={filterPillTokenClasses.clear}
                  onClick={() => setColumnFilters((current) => ({ ...current, [filter.columnId]: '' }))}
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
            <col style={{ width: SCHOOL_SELECTION_COLUMN_WIDTH }} />
            <col style={{ width: SCHOOL_ROW_NUMBER_COLUMN_WIDTH }} />
            {visibleColumns.map((column) => (
              <col
                key={column.id}
                style={{ width: getResponsiveSchoolColumnWidth(column.id, visibleSchoolColumnWidth) }}
              />
            ))}
            <col style={{ width: SCHOOL_ACTIONS_COLUMN_WIDTH }} />
          </colgroup>
          <THead className="border-t border-slate-200 font-['Inter',system-ui,sans-serif]">
            <TR className="hover:bg-transparent">
              <TH className={`${adminTableHeaderCellCenterClassName} ${adminExpandableTableCheckboxColumnClassName} px-2`}>
                <div className="flex h-11 items-center justify-center">
                  <AdminCheckbox
                    ref={selectAllRowsRef}
                    checked={allVisibleRowsSelected}
                    disabled={selectionControlsDisabled || pagedRowIds.length === 0}
                    onChange={toggleAllVisibleRows}
                    aria-label="Izberi vse vrstice na trenutni strani"
                  />
                </div>
              </TH>
              <TH className={`${adminTableHeaderCellCenterClassName} w-12 min-w-12 max-w-12 px-2`}>
                <span className="tabular-nums">#</span>
              </TH>
              {visibleColumns.map((column) => {
                const isSortedColumn = sortState?.columnId === column.id;
                const filterableColumnId = isFilterableColumnId(column.id) ? column.id : null;
                const columnTitle = getColumnTitle(column);
                const centered = isCenteredColumn(column.id);
                const filterControlsDisabled = Boolean(activeRowEdit)
                  || isStructuralMutationPending
                  || pendingMutations > 0;
                return (
                  <TH
                    key={column.id}
                    className={centered ? adminTableHeaderCellCenterClassName : adminTableHeaderCellLeftClassName}
                    aria-sort={isSortedColumn
                      ? (sortState.direction === 'asc' ? 'ascending' : 'descending')
                      : 'none'}
                  >
                    <div
                      className={`relative flex h-11 min-w-0 items-center gap-2 ${centered ? 'justify-center' : ''}`}
                      {...(filterableColumnId ? { [HEADER_FILTER_ROOT_ATTR]: 'true' } : {})}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(column.id)}
                        disabled={filterControlsDisabled}
                        className={`${adminTableHeaderButtonClassName} ${centered ? 'text-center' : `${adminTableMatchingValueHeaderStartClassName} text-left`} min-w-0 max-w-full shrink overflow-hidden disabled:cursor-default disabled:text-slate-400 ${isSortedColumn ? 'underline underline-offset-2' : ''}`}
                        aria-label={getSortActionLabel(column)}
                        title={getSortActionLabel(column)}
                      >
                        <span className="block min-w-0 truncate">{columnTitle}</span>
                      </button>
                      <span className={adminTableHeaderAdjacentControlsClassName}>
                        {filterableColumnId ? (
                          <button
                            ref={(element) => {
                              columnFilterButtonRefs.current[filterableColumnId] = element;
                            }}
                            type="button"
                            className={HEADER_FILTER_BUTTON_CLASS}
                            data-active={openColumnFilter === filterableColumnId || Boolean(columnFilters[filterableColumnId])}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (filterControlsDisabled) return;
                              setOpenColumnFilter((current) =>
                                current === filterableColumnId ? null : filterableColumnId);
                            }}
                            disabled={filterControlsDisabled}
                            aria-label={`Filtriraj ${columnTitle}`}
                            aria-haspopup="listbox"
                            aria-expanded={openColumnFilter === filterableColumnId}
                            title={`Filtriraj ${columnTitle}`}
                          >
                            <ColumnFilterIcon className="!h-[12px] !w-[12px]" />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 transition-colors hover:text-[color:var(--blue-500)] focus-visible:outline-none focus-visible:text-[color:var(--blue-500)] disabled:cursor-default disabled:text-slate-200"
                          onClick={(event) => {
                            event.stopPropagation();
                            if (filterControlsDisabled) return;
                            void copyColumnValues(column);
                          }}
                          disabled={filterControlsDisabled}
                          aria-label={`Kopiraj stolpec ${columnTitle}`}
                          title={`Kopiraj stolpec ${columnTitle} (ena vrednost na vrstico)`}
                        >
                          <CopyIcon className="!h-[11px] !w-[11px]" />
                        </button>
                      </span>
                    </div>
                  </TH>
                );
              })}
              <TH className={`${adminTableHeaderCellLeftClassName} w-[88px] min-w-[88px] max-w-[88px] text-center`}>
                <span>Uredi</span>
              </TH>
            </TR>
          </THead>
          <TBody>
            {pagedRows.length === 0 ? (
              <TR>
                <TD colSpan={Math.max(1, visibleColumns.length + 3)} className="h-36 text-center">
                  <EmptyState
                    title={query || activeColumnFilters.length > 0
                      ? 'Ni zadetkov za izbrano iskanje ali filtre.'
                      : 'Seznam šol je prazen.'}
                    description={query || activeColumnFilters.length > 0
                      ? 'Poskusite z drugim iskalnim nizom ali odstranite katerega od filtrov.'
                      : 'Dodajte prvo vrstico.'}
                  />
                </TD>
              </TR>
            ) : pagedRows.map((row, rowIndex) => {
              const rowEdit = activeRowEdit?.rowId === row.id ? activeRowEdit : null;
              const isSelected = selectedRowIds.has(row.id);
              return (
              <TR
                key={row.id}
                className={`border-b border-slate-100 last:border-b-0 ${isSelected ? adminTableRowToneClasses.selected : ''}`}
              >
                <TD className={`${adminTableBodyCellCenterClassName} ${adminExpandableTableCheckboxColumnClassName} px-2`}>
                  <div className="flex h-12 items-center justify-center">
                    <AdminCheckbox
                      checked={isSelected}
                      disabled={selectionControlsDisabled}
                      onChange={() => toggleRowSelection(row.id)}
                      aria-label={`Izberi ${row.cells.naziv || 'vrstico'}`}
                    />
                  </div>
                </TD>
                <TD className={`${adminTableBodyCellCenterClassName} w-12 min-w-12 max-w-12 px-2 text-slate-500`}>
                  <span className="tabular-nums">{rowNumberOffset + rowIndex + 1}</span>
                </TD>
                {visibleColumns.map((column, columnIndex) => {
                  const value = row.cells[column.id] ?? '';
                  const columnTitle = getColumnTitle(column);
                  const centered = isCenteredColumn(column.id);
                  const supportsMatchingValueHover = MATCHING_VALUE_HOVER_COLUMN_IDS.has(column.id);
                  const hasDisplayValue = value.trim().length > 0;
                  const displayValue = hasDisplayValue ? value : '—';
                  const displayLines = hasDisplayValue ? getCellDisplayLines(value, column.id) : [displayValue];
                  const hasMultipleDisplayLines = displayLines.length > 1;
                  return (
                    <TD
                      key={column.id}
                      className={centered ? adminTableBodyCellCenterClassName : adminTableBodyCellLeftClassName}
                    >
                      {rowEdit ? (
                        <input
                          autoFocus={columnIndex === 0}
                          value={rowEdit.draftCells[column.id] ?? ''}
                          onFocus={(event) => {
                            if (columnIndex === 0) event.currentTarget.select();
                          }}
                          onChange={(event) => {
                            const nextValue = event.target.value;
                            setActiveRowEdit((current) => current?.rowId === row.id
                              ? {
                                ...current,
                                draftCells: { ...current.draftCells, [column.id]: nextValue }
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
                          className={`${adminTableInlineEditInputClassName} ${centered ? 'text-center' : ''}`}
                          aria-label={`${columnTitle}, urejanje vrstice`}
                        />
                      ) : column.id === 'spletna-stran' ? (
                        hasDisplayValue ? (
                          <div
                            className={`flex min-h-8 w-full rounded-md px-0 text-left text-[12px] ${hasMultipleDisplayLines ? 'flex-col items-start justify-center gap-0.5 py-1' : 'items-center'}`}
                            title={displayValue}
                          >
                            {displayLines.map((line, lineIndex) => {
                              const websiteHref = getWebsiteHref(line);
                              return websiteHref ? (
                                <a
                                  key={`${line}-${lineIndex}`}
                                  href={websiteHref}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`${adminTableMatchingValueBaseClassName} block min-w-0 max-w-full truncate text-[color:var(--blue-500)] transition hover:underline focus-visible:bg-slate-50 focus-visible:outline-none focus-visible:underline`}
                                  aria-label={`${columnTitle}: ${line}. Odpri v novem zavihku.`}
                                >
                                  {line}
                                </a>
                              ) : (
                                <span
                                  key={`${line}-${lineIndex}`}
                                  className={`${adminTableMatchingValueBaseClassName} block min-w-0 max-w-full truncate text-slate-700`}
                                >
                                  {line}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="flex h-8 w-full items-center px-0 text-left text-[12px] text-slate-300">
                            <span className={`${adminTableMatchingValueBaseClassName} min-w-0 max-w-full truncate`}>
                              {displayValue}
                            </span>
                          </span>
                        )
                      ) : (
                        <button
                          type="button"
                          className={`flex w-full cursor-default items-center rounded-md px-0 text-[12px] text-slate-700 focus-visible:bg-slate-50 focus-visible:outline-none ${hasMultipleDisplayLines ? 'min-h-8 py-1' : 'h-8'} ${centered ? 'justify-center text-center' : 'text-left'}`}
                          onClick={() => void copyCellValue(value)}
                          title={displayValue}
                          aria-label={`${columnTitle}: ${hasDisplayValue ? value : 'prazno'}. Kopiraj vrednost.`}
                        >
                          <span
                            className={`${adminTableMatchingValueBaseClassName} min-w-0 max-w-full ${hasMultipleDisplayLines ? `flex-col gap-0.5 ${centered ? '!items-center' : '!items-start'}` : 'truncate'} ${hasDisplayValue ? '' : 'text-slate-300'} ${getMatchingValueClassName(column.id, value)}`}
                            onMouseEnter={supportsMatchingValueHover
                              ? () => setHoveredCellMatch({
                                columnId: column.id,
                                value: normalizeComparableCellValue(value)
                              })
                              : undefined}
                            onMouseLeave={supportsMatchingValueHover
                              ? () => setHoveredCellMatch(null)
                              : undefined}
                          >
                            {displayLines.map((line, lineIndex) => (
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
                <TD className={`${adminTableBodyCellLeftClassName} w-[88px] min-w-[88px] max-w-[88px] text-center`}>
                  {rowEdit ? (
                    <RowActions className={adminTableInlineActionRowClassName}>
                      <IconButton
                        type="button"
                        tone="neutral"
                        size="sm"
                        className={adminTableInlineConfirmButtonClassName}
                        onClick={() => void saveRowEdit()}
                        disabled={!isActiveRowDirty || rowEdit.isSaving}
                        aria-label={`Shrani urejanje vrstice ${row.cells.naziv || row.id}`}
                        title={isActiveRowDirty ? 'Shrani' : 'Ni sprememb za shranjevanje'}
                      >
                        <CheckIcon className={adminTableInlineConfirmIconClassName} strokeWidth={2.2} />
                      </IconButton>
                      <IconButton
                        type="button"
                        tone="neutral"
                        size="sm"
                        className={adminTableInlineCancelButtonClassName}
                        onClick={cancelRowEdit}
                        disabled={rowEdit.isSaving}
                        aria-label={`Prekliči urejanje vrstice ${row.cells.naziv || row.id}`}
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
                        label="Dejanja vrstice"
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
        {openColumnFilter ? (
          <div
            style={getHeaderPopoverStyle(
              columnFilterButtonRefs.current[openColumnFilter] ?? null,
              columnFilterMenuWidths[openColumnFilter]
            )}
          >
            <MenuPanel
              ref={columnFilterMenuRef}
              className="w-full overflow-x-hidden overflow-y-auto whitespace-nowrap shadow-lg"
              style={{ maxHeight: 'min(24rem, calc(100vh - 12rem))' }}
            >
              <div
                role="listbox"
                aria-label={`Filter: ${FILTERABLE_COLUMN_LABELS[openColumnFilter]}`}
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
                    const columnId = openColumnFilter;
                    setOpenColumnFilter(null);
                    restoreColumnFilterTriggerFocus(columnId);
                  }
                }}
              >
                <MenuItem
                  role="option"
                  ariaSelected={!columnFilters[openColumnFilter]}
                  isActive={!columnFilters[openColumnFilter]}
                  className="sticky top-0 z-10 bg-white font-semibold"
                  onClick={() => {
                    const columnId = openColumnFilter;
                    setColumnFilters((current) => ({ ...current, [columnId]: '' }));
                    setOpenColumnFilter(null);
                    restoreColumnFilterTriggerFocus(columnId);
                  }}
                >
                  {FILTERABLE_COLUMN_ALL_LABELS[openColumnFilter]}
                </MenuItem>
                {columnFilterOptions[openColumnFilter].map((option) => {
                  const isSelected = normalizeComparableCellValue(columnFilters[openColumnFilter])
                    === normalizeComparableCellValue(option);
                  return (
                    <MenuItem
                      key={option}
                      role="option"
                      ariaSelected={isSelected}
                      isActive={isSelected}
                      className={isSelected ? 'bg-slate-100 font-semibold' : undefined}
                      onClick={() => {
                        const columnId = openColumnFilter;
                        setColumnFilters((current) => ({ ...current, [columnId]: option }));
                        setOpenColumnFilter(null);
                        restoreColumnFilterTriggerFocus(columnId);
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
      </HeaderFilterPortal>

      <LazyConfirmDialog
        open={pendingDelete !== null}
        title={pendingDelete?.rows.length === 1 ? 'Izbrišem vrstico?' : 'Izbrišem izbrane vrstice?'}
        description={pendingDelete?.rows.length === 1
          ? `Vrstica »${pendingDelete.rows[0]?.cells.naziv || 'izbrana vrstica'}« bo trajno izbrisana.`
          : `${pendingDelete?.rows.length ?? 0} izbranih vrstic bo trajno izbrisanih.`}
        confirmLabel="Izbriši"
        cancelLabel="Prekliči"
        isDanger
        confirmDisabled={isStructuralMutationPending}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
