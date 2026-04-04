'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconButton } from '@/shared/ui/icon-button';
import { useToast } from '@/shared/ui/toast';
import { Spinner } from '@/shared/ui/loading';
import { EmptyState, Table, TBody, TD, THead, TH, TR } from '@/shared/ui/table';
import { AdminCheckbox } from '@/shared/ui/checkbox';
import { AdminTableLayout, ColumnVisibilityControl } from '@/shared/ui/admin-table';
import { ActionRestoreIcon, ColumnFilterIcon, PanelAddRemoveIcon, TrashCanIcon } from '@/shared/ui/icons/AdminActionIcons';
import { EuiTablePagination, useTablePagination } from '@/shared/ui/pagination';
import { MenuItem, MenuPanel } from '@/shared/ui/menu';
import { AdminSearchInput } from '@/shared/ui/admin-search-input';
import AdminFilterInput from '@/shared/ui/admin-filter-input';
import { getCustomerTypeLabel } from '@/shared/domain/order/customerType';
import { adminTableRowToneClasses, filterPillTokenClasses } from '@/shared/ui/theme/tokens';

type ArchiveEntry = {
  id: number;
  item_type: 'order' | 'pdf';
  order_id: number | null;
  document_id: number | null;
  label: string;
  order_created_at: string | null;
  customer_name: string | null;
  address: string | null;
  customer_type: string | null;
  deleted_at: string;
  expires_at: string;
};
type ArchiveEntryTuple = readonly [
  id: number,
  itemType: 'order' | 'pdf',
  orderId: number | null,
  documentId: number | null,
  label: string,
  orderCreatedAt: string | null,
  customerName: string | null,
  address: string | null,
  customerType: string | null,
  deletedAt: string,
  expiresAt: string
];

type DisplayRow = {
  entry: ArchiveEntry;
  isChild: boolean;
  parentOrderId: number | null;
};

type TypeFilterValue = 'all' | 'order' | 'pdf';
type CustomerTypeFilterValue = 'all' | 'individual' | 'company' | 'school';
type ArchiveHeaderFilter = 'type' | 'orderDate' | 'customerType' | 'deletedDate' | 'expiresDate' | null;
type ArchiveSortKey = 'type' | 'order_created_at' | 'customer_name' | 'address' | 'customer_type' | 'deleted_at' | 'expires_at';
type ArchiveSortDirection = 'asc' | 'desc';
type ArchiveColumnKey = 'type' | 'element' | 'orderDate' | 'customer' | 'address' | 'orderType' | 'deleted' | 'expires';

const TYPE_FILTER_OPTIONS: Array<{ value: TypeFilterValue; label: string }> = [
  { value: 'all', label: 'Vse vrste' },
  { value: 'order', label: 'Naročila' },
  { value: 'pdf', label: 'PDF datoteke' }
];
const ARCHIVE_COLUMN_OPTIONS: Array<{ key: ArchiveColumnKey; label: string }> = [
  { key: 'type', label: 'Vrsta' },
  { key: 'element', label: 'Element' },
  { key: 'orderDate', label: 'Datum naročila' },
  { key: 'customer', label: 'Naročnik' },
  { key: 'address', label: 'Naslov' },
  { key: 'orderType', label: 'Tip' },
  { key: 'deleted', label: 'Izbris' },
  { key: 'expires', label: 'Iztek' }
];
const PAGE_SIZE_OPTIONS = [25, 50, 100];
const LazyConfirmDialog = dynamic(
  () => import('@/shared/ui/confirm-dialog').then((module) => module.ConfirmDialog),
  { ssr: false }
);

const formatDateOnly = (value: string) => {
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return '—';
  const day = String(parsedDate.getDate()).padStart(2, '0');
  const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
  const year = parsedDate.getFullYear();
  return `${day}.${month}.${year}`;
};

const toDateInputValue = (date: Date) => date.toISOString().slice(0, 10);
const shiftDateByDays = (baseDate: Date, days: number) => {
  const nextDate = new Date(baseDate);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
};
const DATE_RANGE_PRESETS = [
  { key: '7d', label: 'Zadnjih 7d', days: 7 },
  { key: '30d', label: 'Zadnjih 30d', days: 30 },
  { key: '90d', label: 'Zadnjih 90d', days: 90 },
  { key: '180d', label: 'Zadnjih 180d', days: 180 },
  { key: '365d', label: 'Zadnjih 365d', days: 365 },
  { key: 'ytd', label: 'Letos', days: null }
] as const;

const tupleToArchiveEntry = (entry: ArchiveEntryTuple): ArchiveEntry => ({
  id: entry[0],
  item_type: entry[1],
  order_id: entry[2],
  document_id: entry[3],
  label: entry[4],
  order_created_at: entry[5],
  customer_name: entry[6],
  address: entry[7],
  customer_type: entry[8],
  deleted_at: entry[9],
  expires_at: entry[10]
});

export default function AdminDeletedArchiveTable({
  initialEntries
}: {
  initialEntries: ArchiveEntryTuple[];
}) {
  const normalizedInitialEntries = useMemo(() => initialEntries.map(tupleToArchiveEntry), [initialEntries]);
  const router = useRouter();
  const [entries, setEntries] = useState(normalizedInitialEntries);
  const [selected, setSelected] = useState<number[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilterValue>('all');
  const [customerTypeFilter, setCustomerTypeFilter] = useState<CustomerTypeFilterValue>('all');
  const [orderDateRange, setOrderDateRange] = useState({ from: '', to: '' });
  const [draftOrderDateRange, setDraftOrderDateRange] = useState({ from: '', to: '' });
  const [deletedDateRange, setDeletedDateRange] = useState({ from: '', to: '' });
  const [draftDeletedDateRange, setDraftDeletedDateRange] = useState({ from: '', to: '' });
  const [expiresDateRange, setExpiresDateRange] = useState({ from: '', to: '' });
  const [draftExpiresDateRange, setDraftExpiresDateRange] = useState({ from: '', to: '' });
  const [openHeaderFilter, setOpenHeaderFilter] = useState<ArchiveHeaderFilter>(null);
  const [sortState, setSortState] = useState<{ key: ArchiveSortKey; direction: ArchiveSortDirection } | null>(null);
  const [hoveredCellMatch, setHoveredCellMatch] = useState<{ column: ArchiveSortKey; value: string } | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<Record<ArchiveColumnKey, boolean>>({
    type: true,
    element: true,
    orderDate: true,
    customer: true,
    address: true,
    orderType: true,
    deleted: true,
    expires: true
  });
  const typeFilterRootRef = useRef<HTMLDivElement | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const { toast } = useToast();

  const applyQuickDateRange = (presetKey: (typeof DATE_RANGE_PRESETS)[number]['key']) => {
    const now = new Date();
    if (presetKey === 'ytd') {
      return { from: `${now.getFullYear()}-01-01`, to: toDateInputValue(now) };
    }
    const preset = DATE_RANGE_PRESETS.find((entry) => entry.key === presetKey);
    const days = preset?.days ?? 30;
    return { from: toDateInputValue(shiftDateByDays(now, -days + 1)), to: toDateInputValue(now) };
  };

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const dateInRange = (value: string | null, from: string, to: string) => {
      if (!from && !to) return true;
      if (!value) return false;
      const isoDate = new Date(value).toISOString().slice(0, 10);
      if (from && isoDate < from) return false;
      if (to && isoDate > to) return false;
      return true;
    };
    return entries.filter((entry) => {
      const matchesType = typeFilter === 'all' ? true : entry.item_type === typeFilter;
      const matchesCustomerType = customerTypeFilter === 'all' ? true : entry.customer_type === customerTypeFilter;
      const matchesOrderDate = dateInRange(entry.order_created_at, orderDateRange.from, orderDateRange.to);
      const matchesDeletedDate = dateInRange(entry.deleted_at, deletedDateRange.from, deletedDateRange.to);
      const matchesExpiresDate = dateInRange(entry.expires_at, expiresDateRange.from, expiresDateRange.to);
      if (!matchesType || !matchesCustomerType || !matchesOrderDate || !matchesDeletedDate || !matchesExpiresDate) return false;
      if (!query) return true;
      const values = [
        entry.label,
        entry.customer_name ?? '',
        entry.address ?? '',
        entry.customer_type ?? '',
        entry.order_created_at ?? '',
        entry.order_id ? String(entry.order_id) : ''
      ];
      return values.some((value) => value.toLowerCase().includes(query));
    });
  }, [customerTypeFilter, deletedDateRange.from, deletedDateRange.to, entries, expiresDateRange.from, expiresDateRange.to, orderDateRange.from, orderDateRange.to, search, typeFilter]);

  const displayRows = useMemo<DisplayRow[]>(() => {
    if (typeFilter === 'pdf') {
      return filtered
        .filter((entry) => entry.item_type === 'pdf')
        .map((entry) => ({ entry, isChild: false, parentOrderId: null }));
    }

    const rows: DisplayRow[] = [];
    const orderRows = filtered.filter((entry) => entry.item_type === 'order');
    const deletedOrderIds = new Set(
      orderRows.map((entry) => entry.order_id).filter((orderId): orderId is number => typeof orderId === 'number')
    );

    const pdfByOrder = new Map<number, ArchiveEntry[]>();
    filtered
      .filter((entry) => entry.item_type === 'pdf' && typeof entry.order_id === 'number' && deletedOrderIds.has(entry.order_id))
      .forEach((entry) => {
        const orderId = entry.order_id as number;
        const existingList = pdfByOrder.get(orderId) ?? [];
        existingList.push(entry);
        pdfByOrder.set(orderId, existingList);
      });

    orderRows.forEach((entry) => {
      rows.push({ entry, isChild: false, parentOrderId: null });
      if (typeFilter !== 'all') return;

      const childEntries = pdfByOrder.get(entry.order_id ?? -1) ?? [];
      childEntries
        .sort((leftEntry, rightEntry) => new Date(rightEntry.deleted_at).getTime() - new Date(leftEntry.deleted_at).getTime())
        .forEach((childEntry) => rows.push({ entry: childEntry, isChild: true, parentOrderId: entry.order_id ?? null }));
    });

    if (typeFilter === 'all') {
      filtered
        .filter(
          (entry) =>
            entry.item_type === 'pdf' &&
            (!entry.order_id || !deletedOrderIds.has(entry.order_id))
        )
        .forEach((entry) => rows.push({ entry, isChild: false, parentOrderId: null }));
    }

    const sortedRows = [...rows];
    if (!sortState) {
      sortedRows.sort((leftRow, rightRow) => new Date(rightRow.entry.deleted_at).getTime() - new Date(leftRow.entry.deleted_at).getTime());
      return sortedRows;
    }

    sortedRows.sort((leftRow, rightRow) => {
      const resolveSortValue = (entry: ArchiveEntry) => {
        if (sortState.key === 'type') return entry.item_type;
        return String(entry[sortState.key] ?? '');
      };
      const leftValue = resolveSortValue(leftRow.entry);
      const rightValue = resolveSortValue(rightRow.entry);
      const isDateKey = sortState.key.includes('date') || sortState.key.includes('created') || sortState.key.includes('expires');
      let comparison = 0;
      if (isDateKey) {
        comparison = new Date(leftValue || 0).getTime() - new Date(rightValue || 0).getTime();
      } else {
        comparison = leftValue.localeCompare(rightValue, 'sl', { sensitivity: 'base' });
      }
      return sortState.direction === 'asc' ? comparison : -comparison;
    });

    return sortedRows;
  }, [filtered, sortState, typeFilter]);

  const { page, pageSize, pageCount, setPage, setPageSize } = useTablePagination({
    totalCount: displayRows.length,
    storageKey: 'adminArhiv.pageSize',
    defaultPageSize: 50,
    pageSizeOptions: PAGE_SIZE_OPTIONS
  });

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return displayRows.slice(start, start + pageSize);
  }, [displayRows, page, pageSize]);

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; title: string; value: string; clear: () => void }> = [];
    const trimmedSearch = search.trim();
    if (trimmedSearch) {
      chips.push({ key: 'search', title: 'Iskanje:', value: trimmedSearch, clear: () => setSearch('') });
    }
    if (typeFilter !== 'all') {
      chips.push({
        key: 'type',
        title: 'Vrsta:',
        value: typeFilter === 'order' ? 'Naročila' : 'PDF datoteke',
        clear: () => setTypeFilter('all')
      });
    }
    if (customerTypeFilter !== 'all') {
      chips.push({
        key: 'customerType',
        title: 'Tip:',
        value: getCustomerTypeLabel(customerTypeFilter),
        clear: () => setCustomerTypeFilter('all')
      });
    }
    if (orderDateRange.from || orderDateRange.to) {
      chips.push({ key: 'orderDate', title: 'Datum naročila:', value: `${orderDateRange.from || '—'} – ${orderDateRange.to || '—'}`, clear: () => { setOrderDateRange({ from: '', to: '' }); setDraftOrderDateRange({ from: '', to: '' }); } });
    }
    if (deletedDateRange.from || deletedDateRange.to) {
      chips.push({ key: 'deletedDate', title: 'Datum izbrisa:', value: `${deletedDateRange.from || '—'} – ${deletedDateRange.to || '—'}`, clear: () => { setDeletedDateRange({ from: '', to: '' }); setDraftDeletedDateRange({ from: '', to: '' }); } });
    }
    if (expiresDateRange.from || expiresDateRange.to) {
      chips.push({ key: 'expiresDate', title: 'Datum izteka:', value: `${expiresDateRange.from || '—'} – ${expiresDateRange.to || '—'}`, clear: () => { setExpiresDateRange({ from: '', to: '' }); setDraftExpiresDateRange({ from: '', to: '' }); } });
    }
    return chips;
  }, [customerTypeFilter, deletedDateRange.from, deletedDateRange.to, expiresDateRange.from, expiresDateRange.to, orderDateRange.from, orderDateRange.to, search, typeFilter]);

  const toggleColumnVisibility = (key: ArchiveColumnKey) => {
    setVisibleColumns((current) => {
      const next = { ...current, [key]: !current[key] };
      if (!next.element) return current;
      if (Object.values(next).every((isVisible) => !isVisible)) return current;
      return next;
    });
  };

  const visibleIds = useMemo(() => pagedRows.map((row) => row.entry.id), [pagedRows]);
  const selectedIdSet = useMemo(() => new Set(selected), [selected]);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIdSet.has(id));
  const hasSelectedRows = selected.length > 0;

  const groupedChildIdsByOrder = useMemo(() => {
    const groupedChildIds = new Map<number, number[]>();
    displayRows.forEach((row) => {
      if (!row.isChild || row.parentOrderId === null) return;
      const existingList = groupedChildIds.get(row.parentOrderId) ?? [];
      existingList.push(row.entry.id);
      groupedChildIds.set(row.parentOrderId, existingList);
    });
    return groupedChildIds;
  }, [displayRows]);

  const parentRowIdByOrder = useMemo(() => {
    const parentIdsByOrder = new Map<number, number>();
    displayRows.forEach((row) => {
      if (row.isChild) return;
      if (row.entry.item_type !== 'order' || row.entry.order_id === null) return;
      parentIdsByOrder.set(row.entry.order_id, row.entry.id);
    });
    return parentIdsByOrder;
  }, [displayRows]);

  const selectedEntriesFromRows = useMemo(
    () =>
      displayRows
        .map((row) => row.entry)
        .filter(
          (entry, index, entriesArray) =>
            selectedIdSet.has(entry.id) && entriesArray.findIndex((candidate) => candidate.id === entry.id) === index
        ),
    [displayRows, selectedIdSet]
  );

  const toggleOne = (row: DisplayRow) => {
    const { entry, isChild, parentOrderId } = row;

    if (isChild && parentOrderId !== null) {
      const parentRowId = parentRowIdByOrder.get(parentOrderId);
      if (!parentRowId || !selectedIdSet.has(parentRowId)) return;
    }

    setSelected((previousSelected) => {
      if (isChild && parentOrderId !== null) {
        return previousSelected.includes(entry.id)
          ? previousSelected.filter((itemId) => itemId !== entry.id)
          : [...previousSelected, entry.id];
      }

      const nextSelected = new Set(previousSelected);
      const isCurrentlySelected = nextSelected.has(entry.id);
      const childIds =
        entry.item_type === 'order' && entry.order_id !== null
          ? groupedChildIdsByOrder.get(entry.order_id) ?? []
          : [];

      if (isCurrentlySelected) {
        nextSelected.delete(entry.id);
        childIds.forEach((childId) => nextSelected.delete(childId));
      } else {
        nextSelected.add(entry.id);
        childIds.forEach((childId) => nextSelected.add(childId));
      }

      return Array.from(nextSelected);
    });
  };

  const toggleAll = () => {
    setSelected((previousSelected) => {
      if (allSelected) {
        const visibleIdSet = new Set(visibleIds);
        return previousSelected.filter((id) => !visibleIdSet.has(id));
      }

      const mergedSelection = new Set(previousSelected);
      displayRows.forEach((row) => {
        mergedSelection.add(row.entry.id);
        if (!row.isChild && row.entry.item_type === 'order' && row.entry.order_id !== null) {
          const childIds = groupedChildIdsByOrder.get(row.entry.order_id) ?? [];
          childIds.forEach((childId) => mergedSelection.add(childId));
        }
      });

      return Array.from(mergedSelection);
    });
  };

  const bulkRestore = async () => {
    const selectedEntries = selectedEntriesFromRows;
    const restorableIds = selectedEntries.filter((entry) => entry.id > 0).map((entry) => entry.id);
    const targets = selectedEntries
      .filter((entry) => entry.id <= 0)
      .map((entry) => ({
        item_type: entry.item_type,
        order_id: entry.order_id,
        document_id: entry.document_id
      }));

    if (restorableIds.length === 0 && targets.length === 0) {
      toast.info('Ni izbranih zapisov za obnovo.');
      return;
    }

    setIsRestoring(true);
    try {
      const response = await fetch('/api/admin/archive', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: restorableIds, targets })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(body.message || 'Obnova ni uspela.');
        return;
      }

      setEntries((previousEntries) => previousEntries.filter((entry) => !selected.includes(entry.id)));
      setSelected([]);
      toast.success('Izbrani zapisi so obnovljeni.');
      router.refresh();
    } finally {
      setIsRestoring(false);
    }
  };

  const bulkDelete = () => {
    const deletableIds = selected.filter((id) => id > 0);
    if (deletableIds.length === 0) {
      toast.info('Izbrani zapisi nimajo arhivske postavke za trajni izbris.');
      return;
    }

    setIsDeleteConfirmOpen(true);
  };


  const handleSort = (key: ArchiveSortKey) => {
    const currentDirection = sortState?.key === key ? sortState.direction : null;
    const nextDirection = currentDirection === 'desc' ? 'asc' : currentDirection === 'asc' ? null : 'desc';
    if (!nextDirection) {
      setSortState(null);
      return;
    }
    setSortState({ key, direction: nextDirection });
  };

  const getHeaderTitleClass = (key: ArchiveSortKey) =>
    `inline-flex items-center text-[11px] font-semibold leading-none hover:text-slate-700 ${sortState?.key === key ? 'underline underline-offset-2' : ''}`;

  const toComparableValue = (value: string) => (value || '—').toLowerCase();
  const isMatchingHoveredCell = (key: ArchiveSortKey, value: string) =>
    hoveredCellMatch?.column === key && hoveredCellMatch.value === toComparableValue(value);
  const matchingValueHighlightClass = 'rounded-[4px] bg-amber-100/70 outline outline-1 outline-dashed outline-amber-500/80';
  const matchingValueHighlightNoShiftClass = 'rounded-[4px] bg-amber-100/70 outline outline-1 outline-dashed outline-amber-500/80';

  useEffect(() => {
    setPage(1);
  }, [customerTypeFilter, deletedDateRange.from, deletedDateRange.to, expiresDateRange.from, expiresDateRange.to, orderDateRange.from, orderDateRange.to, search, setPage, sortState, typeFilter]);

  useEffect(() => {
    if (!openHeaderFilter) return;
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-archive-header-filter="true"]')) return;
      setOpenHeaderFilter(null);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [openHeaderFilter]);

  const confirmBulkDelete = async () => {
    const deletableIds = selected.filter((id) => id > 0);
    if (deletableIds.length === 0) {
      toast.info('Izbrani zapisi nimajo arhivske postavke za trajni izbris.');
      setIsDeleteConfirmOpen(false);
      return;
    }

    setIsDeleteConfirmOpen(false);
    setIsDeleting(true);
    try {
      const response = await fetch('/api/admin/archive', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: deletableIds })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(body.message || 'Trajni izbris ni uspel.');
        return;
      }

      setEntries((previousEntries) => previousEntries.filter((entry) => !deletableIds.includes(entry.id)));
      setSelected([]);
      toast.success('Izbrani zapisi so trajno izbrisani.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AdminTableLayout
      className="w-full !overflow-visible border shadow-sm"
      style={{ background: '#ffffff', borderColor: '#e2e8f0', boxShadow: '0 10px 24px rgba(15,23,42,0.06)' }}
      headerClassName="!bg-white"
      headerLeft={
        <div className="flex h-7 w-full items-stretch">
          <div className="min-w-0 w-full rounded-md border border-slate-200 bg-white transition-colors focus-within:border-[#3e67d6]">
            <AdminSearchInput
              showIcon={false}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Poišči arhivirane zapise"
              aria-label="Poišči arhivirane zapise"
              className="!m-0 !h-7 min-w-0 w-full flex-1 !rounded-md !border-0 !bg-transparent !shadow-none !outline-none ring-0 transition-colors placeholder:text-slate-400 [--euiFormControlStateWidth:0px] focus:[--euiFormControlStateWidth:0px] focus-visible:[--euiFormControlStateWidth:0px] focus:!border-0 focus:!shadow-none focus:!outline-none focus-visible:!border-0 focus-visible:!shadow-none focus-visible:!outline-none"
            />
          </div>
        </div>
      }
      headerRight={
        <div className="flex h-7 items-center gap-2 self-center">
          <ColumnVisibilityControl
            options={ARCHIVE_COLUMN_OPTIONS.map((option) => ({ ...option, disabled: option.key === 'element' }))}
            visibleMap={visibleColumns}
            onToggle={(key) => toggleColumnVisibility(key as ArchiveColumnKey)}
            showLabel={false}
            className="[&>button]:!h-7 [&>button]:!w-7 [&>button:hover]:text-[color:var(--blue-500)] [&>button[aria-expanded='true']]:text-[color:var(--blue-500)]"
            menuClassName="!w-[312px]"
            icon={<PanelAddRemoveIcon className="!scale-[0.8]" />}
          />
          <IconButton
            type="button"
            size="sm"
            tone={hasSelectedRows ? 'success' : 'neutral'}
            className={hasSelectedRows ? '!border-emerald-300 !bg-emerald-50/70 !text-emerald-700 !transition-none' : '!transition-none'}
            onClick={bulkRestore}
            disabled={!hasSelectedRows || isRestoring || isDeleting}
            aria-label="Obnovi izbrano"
            title="Obnovi"
          >
            {isRestoring ? (
              <Spinner size="sm" className="text-slate-500" />
            ) : (
              <ActionRestoreIcon />
            )}
          </IconButton>
          <IconButton
            type="button"
            size="sm"
            tone={hasSelectedRows ? 'danger' : 'neutral'}
            className={hasSelectedRows ? '!border-rose-300 !bg-rose-50/70 !text-rose-700 !transition-none' : '!transition-none'}
            onClick={bulkDelete}
            disabled={!hasSelectedRows || isDeleting || isRestoring}
            aria-label="Trajno izbriši izbrano"
            title="Trajno izbriši"
          >
            {isDeleting ? (
              <Spinner size="sm" className="text-rose-700" />
            ) : (
              <TrashCanIcon />
            )}
          </IconButton>
        </div>
      }
      filterRowLeft={
        activeFilterChips.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {activeFilterChips.map((chip) => (
              <span key={chip.key} className={filterPillTokenClasses.base}>
                <span>
                  {chip.title} <span className="font-semibold">{chip.value}</span>
                </span>
                <button type="button" className={filterPillTokenClasses.clear} onClick={chip.clear} aria-label={`Odstrani filter ${chip.title}`}>
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null
      }
      filterRowRight={
        <EuiTablePagination
          page={page}
          pageCount={pageCount}
          onPageChange={setPage}
          itemsPerPage={pageSize}
          onChangeItemsPerPage={setPageSize}
          itemsPerPageOptions={PAGE_SIZE_OPTIONS}
        />
      }
      contentClassName="overflow-x-auto overflow-y-visible bg-white"
      showDivider={false}
      footerRight={
        <EuiTablePagination
          page={page}
          pageCount={pageCount}
          onPageChange={setPage}
          itemsPerPage={pageSize}
          onChangeItemsPerPage={setPageSize}
          itemsPerPageOptions={PAGE_SIZE_OPTIONS}
        />
      }
    >
      {isDeleteConfirmOpen ? (
        <LazyConfirmDialog
          open={isDeleteConfirmOpen}
          title="Trajni izbris"
          description="Ali ste prepričani, da želite trajno izbrisati izbrane zapise?"
          confirmLabel="Izbriši"
          cancelLabel="Prekliči"
          isDanger
          onCancel={() => setIsDeleteConfirmOpen(false)}
          onConfirm={() => {
            void confirmBulkDelete();
          }}
          confirmDisabled={isDeleting}
        />
      ) : null}

      <Table className="w-full min-w-[1080px] table-fixed border-collapse text-[11px] font-['Inter',system-ui,sans-serif]">
          <colgroup>
            <col className="w-[44px]" />
            {visibleColumns.type ? <col className="w-[120px]" /> : null}
            {visibleColumns.element ? <col className="w-[240px]" /> : null}
            {visibleColumns.orderDate ? <col className="w-[130px]" /> : null}
            {visibleColumns.customer ? <col className="w-[150px]" /> : null}
            {visibleColumns.address ? <col className="w-[209px]" /> : null}
            {visibleColumns.orderType ? <col className="w-[100px]" /> : null}
            {visibleColumns.deleted ? <col className="w-[150px]" /> : null}
            {visibleColumns.expires ? <col className="w-[161px]" /> : null}
          </colgroup>
          <THead>
            <TR>
              <TH className="w-10 text-center">
                <AdminCheckbox checked={allSelected} onChange={toggleAll} aria-label="Izberi vse" />
              </TH>
              {visibleColumns.type ? (
                <TH className="w-24 text-[11px]">
                  <div className="relative inline-flex items-center gap-1.5 align-middle" data-archive-header-filter="true" ref={typeFilterRootRef}>
                    <button type="button" onClick={() => handleSort('type')} className={getHeaderTitleClass('type')}>Vrsta</button>
                    <button type="button" className="group inline-flex h-[12px] w-[12px] shrink-0 self-center items-center justify-center text-slate-500" data-active={openHeaderFilter === 'type'} aria-label="Filtriraj vrsto" onClick={() => setOpenHeaderFilter((previousFilter) => (previousFilter === 'type' ? null : 'type'))}>
                      <ColumnFilterIcon className="!h-[12px] !w-[12px]" />
                    </button>
                    {openHeaderFilter === 'type' ? (
                      <div role="menu" className="absolute left-1/2 top-8 z-30 w-40 -translate-x-1/2">
                        <MenuPanel className="w-full">
                          {TYPE_FILTER_OPTIONS.map((option) => (
                            <MenuItem key={option.value} onClick={() => { setTypeFilter(option.value); setOpenHeaderFilter(null); }}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </MenuPanel>
                      </div>
                    ) : null}
                  </div>
                </TH>
              ) : null}
              {visibleColumns.element ? <TH className="text-[11px]">Element</TH> : null}
              {visibleColumns.orderDate ? <TH className="text-center text-[11px]">
                <div className="relative inline-flex items-center gap-1.5 align-middle" data-archive-header-filter="true">
                  <button type="button" onClick={() => handleSort('order_created_at')} className={getHeaderTitleClass('order_created_at')}>Datum naročila</button>
                  <button type="button" className="group inline-flex h-[12px] w-[12px] shrink-0 self-center items-center justify-center text-slate-500" data-active={openHeaderFilter === 'orderDate'} aria-label="Filtriraj datum naročila" onClick={() => setOpenHeaderFilter((previousFilter) => (previousFilter === 'orderDate' ? null : 'orderDate'))}>
                    <ColumnFilterIcon className="!h-[12px] !w-[12px]" />
                  </button>
                  {openHeaderFilter === 'orderDate' ? (
                    <div role="menu" className="absolute left-1/2 top-8 z-30 w-[380px] -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-lg">
                      <div className="mb-3 grid grid-cols-3 gap-2">
                        {DATE_RANGE_PRESETS.map((preset) => (
                          <button key={preset.key} type="button" className="rounded-lg border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-800 hover:bg-[color:var(--hover-neutral)]" onClick={() => setDraftOrderDateRange(applyQuickDateRange(preset.key))}>
                            {preset.label}
                          </button>
                        ))}
                      </div>
                      <div className="mb-3 border-t border-slate-200 pt-3 grid grid-cols-2 gap-2">
                        <AdminFilterInput type="date" value={draftOrderDateRange.from} onChange={(event) => setDraftOrderDateRange((current) => ({ ...current, from: event.target.value }))} aria-label="Od" />
                        <AdminFilterInput type="date" value={draftOrderDateRange.to} onChange={(event) => setDraftOrderDateRange((current) => ({ ...current, to: event.target.value }))} aria-label="Do" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" className="rounded-xl bg-[color:var(--blue-500)] py-2 text-[11px] font-semibold text-white" onClick={() => { setOrderDateRange(draftOrderDateRange); setOpenHeaderFilter(null); }}>Potrdi</button>
                        <button type="button" className="rounded-xl border border-slate-300 bg-[color:var(--ui-neutral-bg)] py-2 text-[11px] font-semibold text-slate-700 hover:bg-[color:var(--ui-neutral-bg-hover)]" onClick={() => { const empty = { from: '', to: '' }; setDraftOrderDateRange(empty); setOrderDateRange(empty); setOpenHeaderFilter(null); }}>Ponastavi</button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </TH> : null}
              {visibleColumns.customer ? <TH className="text-[11px]"><button type="button" onClick={() => handleSort('customer_name')} className={getHeaderTitleClass('customer_name')}>Naročnik</button></TH> : null}
              {visibleColumns.address ? <TH className="text-[11px]"><button type="button" onClick={() => handleSort('address')} className={getHeaderTitleClass('address')}>Naslov</button></TH> : null}
              {visibleColumns.orderType ? <TH className="text-center text-[11px]">
                <div className="relative inline-flex items-center gap-1.5 align-middle" data-archive-header-filter="true">
                  <button type="button" onClick={() => handleSort('customer_type')} className={getHeaderTitleClass('customer_type')}>Tip</button>
                  <button type="button" className="group inline-flex h-[12px] w-[12px] shrink-0 self-center items-center justify-center text-slate-500" data-active={openHeaderFilter === 'customerType'} aria-label="Filtriraj tip" onClick={() => setOpenHeaderFilter((previousFilter) => (previousFilter === 'customerType' ? null : 'customerType'))}>
                    <ColumnFilterIcon className="!h-[12px] !w-[12px]" />
                  </button>
                  {openHeaderFilter === 'customerType' ? (
                    <div role="menu" className="absolute left-1/2 top-8 z-30 w-40 -translate-x-1/2">
                      <MenuPanel className="w-full">
                        <MenuItem onClick={() => { setCustomerTypeFilter('all'); setOpenHeaderFilter(null); }}>Vsi tipi</MenuItem>
                        <MenuItem onClick={() => { setCustomerTypeFilter('individual'); setOpenHeaderFilter(null); }}>Fiz. oseba</MenuItem>
                        <MenuItem onClick={() => { setCustomerTypeFilter('company'); setOpenHeaderFilter(null); }}>Podjetje</MenuItem>
                        <MenuItem onClick={() => { setCustomerTypeFilter('school'); setOpenHeaderFilter(null); }}>Šola</MenuItem>
                      </MenuPanel>
                    </div>
                  ) : null}
                </div>
              </TH> : null}
              {visibleColumns.deleted ? <TH className="w-40 text-center text-[11px]">
                <div className="relative inline-flex items-center gap-1.5 align-middle" data-archive-header-filter="true">
                  <button type="button" onClick={() => handleSort('deleted_at')} className={getHeaderTitleClass('deleted_at')}>
                    Izbris
                  </button>
                  <button type="button" className="group inline-flex h-[12px] w-[12px] shrink-0 self-center items-center justify-center text-slate-500" data-active={openHeaderFilter === 'deletedDate'} aria-label="Filtriraj datum izbrisa" onClick={() => setOpenHeaderFilter((previousFilter) => (previousFilter === 'deletedDate' ? null : 'deletedDate'))}>
                    <ColumnFilterIcon className="!h-[12px] !w-[12px]" />
                  </button>
                  {openHeaderFilter === 'deletedDate' ? (
                    <div role="menu" className="absolute left-1/2 top-8 z-30 w-[380px] -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-lg">
                      <div className="mb-3 grid grid-cols-3 gap-2">
                        {DATE_RANGE_PRESETS.map((preset) => (
                          <button key={preset.key} type="button" className="rounded-lg border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-800 hover:bg-[color:var(--hover-neutral)]" onClick={() => setDraftDeletedDateRange(applyQuickDateRange(preset.key))}>
                            {preset.label}
                          </button>
                        ))}
                      </div>
                      <div className="mb-3 border-t border-slate-200 pt-3 grid grid-cols-2 gap-2">
                        <AdminFilterInput type="date" value={draftDeletedDateRange.from} onChange={(event) => setDraftDeletedDateRange((current) => ({ ...current, from: event.target.value }))} aria-label="Od" />
                        <AdminFilterInput type="date" value={draftDeletedDateRange.to} onChange={(event) => setDraftDeletedDateRange((current) => ({ ...current, to: event.target.value }))} aria-label="Do" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" className="rounded-xl bg-[color:var(--blue-500)] py-2 text-[11px] font-semibold text-white" onClick={() => { setDeletedDateRange(draftDeletedDateRange); setOpenHeaderFilter(null); }}>Potrdi</button>
                        <button type="button" className="rounded-xl border border-slate-300 bg-[color:var(--ui-neutral-bg)] py-2 text-[11px] font-semibold text-slate-700 hover:bg-[color:var(--ui-neutral-bg-hover)]" onClick={() => { const empty = { from: '', to: '' }; setDraftDeletedDateRange(empty); setDeletedDateRange(empty); setOpenHeaderFilter(null); }}>Ponastavi</button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </TH> : null}
              {visibleColumns.expires ? <TH className="w-40 pr-5 text-center text-[11px]">
                <div className="relative inline-flex items-center gap-1.5 align-middle" data-archive-header-filter="true">
                  <button type="button" onClick={() => handleSort('expires_at')} className={getHeaderTitleClass('expires_at')}>
                    Iztek
                  </button>
                  <button type="button" className="group inline-flex h-[12px] w-[12px] shrink-0 self-center items-center justify-center text-slate-500" data-active={openHeaderFilter === 'expiresDate'} aria-label="Filtriraj datum izteka" onClick={() => setOpenHeaderFilter((previousFilter) => (previousFilter === 'expiresDate' ? null : 'expiresDate'))}>
                    <ColumnFilterIcon className="!h-[12px] !w-[12px]" />
                  </button>
                  {openHeaderFilter === 'expiresDate' ? (
                    <div role="menu" className="absolute left-1/2 top-8 z-30 w-[380px] -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-lg">
                      <div className="mb-3 grid grid-cols-3 gap-2">
                        {DATE_RANGE_PRESETS.map((preset) => (
                          <button key={preset.key} type="button" className="rounded-lg border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-800 hover:bg-[color:var(--hover-neutral)]" onClick={() => setDraftExpiresDateRange(applyQuickDateRange(preset.key))}>
                            {preset.label}
                          </button>
                        ))}
                      </div>
                      <div className="mb-3 border-t border-slate-200 pt-3 grid grid-cols-2 gap-2">
                        <AdminFilterInput type="date" value={draftExpiresDateRange.from} onChange={(event) => setDraftExpiresDateRange((current) => ({ ...current, from: event.target.value }))} aria-label="Od" />
                        <AdminFilterInput type="date" value={draftExpiresDateRange.to} onChange={(event) => setDraftExpiresDateRange((current) => ({ ...current, to: event.target.value }))} aria-label="Do" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" className="rounded-xl bg-[color:var(--blue-500)] py-2 text-[11px] font-semibold text-white" onClick={() => { setExpiresDateRange(draftExpiresDateRange); setOpenHeaderFilter(null); }}>Potrdi</button>
                        <button type="button" className="rounded-xl border border-slate-300 bg-[color:var(--ui-neutral-bg)] py-2 text-[11px] font-semibold text-slate-700 hover:bg-[color:var(--ui-neutral-bg-hover)]" onClick={() => { const empty = { from: '', to: '' }; setDraftExpiresDateRange(empty); setExpiresDateRange(empty); setOpenHeaderFilter(null); }}>Ponastavi</button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </TH> : null}
            </TR>
          </THead>
          <TBody>
            {pagedRows.map((row) => {
              const { entry, isChild, parentOrderId } = row;
              const parentSelected =
                !isChild || parentOrderId === null
                  ? true
                  : (() => {
                      const parentRowId = parentRowIdByOrder.get(parentOrderId);
                      return parentRowId ? selectedIdSet.has(parentRowId) : false;
                    })();

              return (
                <TR key={entry.id} className={`border-b border-slate-100 bg-white transition-colors ${adminTableRowToneClasses.hover}`}>
                  <TD className="px-0 py-2 text-center">
                    <AdminCheckbox
                      className="disabled:cursor-default disabled:opacity-50"
                      checked={selectedIdSet.has(entry.id)}
                      onChange={() => toggleOne(row)}
                      disabled={isChild && !parentSelected}
                      aria-label={`Izberi zapis ${entry.label}`}
                    />
                  </TD>
                  {visibleColumns.type ? <TD className="px-3 py-2 text-[11px] font-semibold text-slate-700">
                    <span
                      className={isMatchingHoveredCell('type', entry.item_type === 'order' ? 'Naročilo' : 'PDF datoteka') ? matchingValueHighlightClass : ''}
                      onMouseEnter={() => setHoveredCellMatch({ column: 'type', value: toComparableValue(entry.item_type === 'order' ? 'Naročilo' : 'PDF datoteka') })}
                      onMouseLeave={() => setHoveredCellMatch(null)}
                    >
                      {entry.item_type === 'order' ? 'Naročilo' : 'PDF datoteka'}
                    </span>
                  </TD> : null}
                  {visibleColumns.element ? <TD className={`px-3 py-2 text-slate-800 ${isChild ? 'pl-6' : ''}`}>
                    {entry.item_type === 'order' && entry.order_id ? (
                      <a href={`/admin/orders/${entry.order_id}`} className="font-medium text-[color:var(--blue-500)] hover:text-[color:var(--blue-600)]">
                        {entry.label}
                      </a>
                    ) : (
                      <span>{isChild ? `↳ ${entry.label}` : entry.label}</span>
                    )}
                  </TD> : null}
                  {visibleColumns.orderDate ? <TD className="px-3 py-2 text-center text-xs text-slate-500">
                    <span
                      className={isMatchingHoveredCell('order_created_at', entry.order_created_at ? formatDateOnly(entry.order_created_at) : '—') ? matchingValueHighlightClass : ''}
                      onMouseEnter={() => setHoveredCellMatch({ column: 'order_created_at', value: toComparableValue(entry.order_created_at ? formatDateOnly(entry.order_created_at) : '—') })}
                      onMouseLeave={() => setHoveredCellMatch(null)}
                    >
                      {entry.order_created_at ? formatDateOnly(entry.order_created_at) : '—'}
                    </span>
                  </TD> : null}
                  {visibleColumns.customer ? <TD className="px-3 py-2 text-xs text-slate-600">
                    <span className={`inline-flex max-w-full items-center truncate ${isMatchingHoveredCell('customer_name', entry.customer_name ?? '—') ? matchingValueHighlightNoShiftClass : ''}`} onMouseEnter={() => setHoveredCellMatch({ column: 'customer_name', value: toComparableValue(entry.customer_name ?? '—') })} onMouseLeave={() => setHoveredCellMatch(null)}>
                      {entry.customer_name ?? '—'}
                    </span>
                  </TD> : null}
                  {visibleColumns.address ? <TD className="px-3 py-2 text-xs text-slate-600">
                    <span className={`inline-flex max-w-full items-center truncate ${isMatchingHoveredCell('address', entry.address ?? '—') ? matchingValueHighlightNoShiftClass : ''}`} onMouseEnter={() => setHoveredCellMatch({ column: 'address', value: toComparableValue(entry.address ?? '—') })} onMouseLeave={() => setHoveredCellMatch(null)}>
                      {entry.address ?? '—'}
                    </span>
                  </TD> : null}
                  {visibleColumns.orderType ? <TD className="px-3 py-2 text-center text-xs text-slate-600">
                    <span className={isMatchingHoveredCell('customer_type', entry.customer_type ? getCustomerTypeLabel(entry.customer_type) : '—') ? matchingValueHighlightClass : ''} onMouseEnter={() => setHoveredCellMatch({ column: 'customer_type', value: toComparableValue(entry.customer_type ? getCustomerTypeLabel(entry.customer_type) : '—') })} onMouseLeave={() => setHoveredCellMatch(null)}>
                      {entry.customer_type ? getCustomerTypeLabel(entry.customer_type) : '—'}
                    </span>
                  </TD> : null}
                  {visibleColumns.deleted ? <TD className="px-3 py-2 text-center text-xs text-slate-500">
                    <span className={isMatchingHoveredCell('deleted_at', formatDateOnly(entry.deleted_at)) ? matchingValueHighlightClass : ''} onMouseEnter={() => setHoveredCellMatch({ column: 'deleted_at', value: toComparableValue(formatDateOnly(entry.deleted_at)) })} onMouseLeave={() => setHoveredCellMatch(null)}>
                      {formatDateOnly(entry.deleted_at)}
                    </span>
                  </TD> : null}
                  {visibleColumns.expires ? <TD className="px-3 pr-5 py-2 text-center text-xs text-slate-500">
                    <span className={isMatchingHoveredCell('expires_at', formatDateOnly(entry.expires_at)) ? matchingValueHighlightClass : ''} onMouseEnter={() => setHoveredCellMatch({ column: 'expires_at', value: toComparableValue(formatDateOnly(entry.expires_at)) })} onMouseLeave={() => setHoveredCellMatch(null)}>
                      {formatDateOnly(entry.expires_at)}
                    </span>
                  </TD> : null}
                </TR>
              );
            })}
            {pagedRows.length === 0 ? (
              <TR>
                <TD colSpan={1 + Object.values(visibleColumns).filter(Boolean).length} className="py-8 text-center text-sm text-slate-500">
                  <EmptyState title="Arhiv je prazen." />
                </TD>
              </TR>
            ) : null}
          </TBody>
        </Table>

    </AdminTableLayout>
  );
}
