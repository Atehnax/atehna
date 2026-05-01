'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconButton } from '@/shared/ui/icon-button';
import { useToast } from '@/shared/ui/toast';
import { Spinner } from '@/shared/ui/loading';
import { EmptyState, Table, TBody, TD, THead, TH, TR } from '@/shared/ui/table';
import { AdminCheckbox } from '@/shared/ui/checkbox';
import {
  adminTableCardClassName,
  adminTableCardStyle,
  adminTableContentClassName,
  adminTableHeaderButtonClassName,
  adminTableHeaderCellCenterClassName,
  adminTableHeaderCellLeftClassName,
  adminTableHeaderClassName,
  adminTableHeaderContentClassName,
  adminTableMatchingValueActiveClassName,
  adminTableMatchingValueBaseClassName,
  adminTableMatchingValueHeaderStartClassName,
  adminTableNeutralIconButtonClassName,
  adminTablePopoverPanelClassName,
  adminTablePopoverPresetButtonClassName,
  adminTablePopoverPrimaryButtonClassName,
  adminTablePopoverSecondaryButtonClassName,
  adminTableSearchIconClassName,
  adminTableSearchInputClassName,
  adminTableSelectedDangerIconButtonClassName,
  adminTableSelectedSuccessIconButtonClassName,
  adminTableToolbarActionsClassName,
  adminTableToolbarGroupClassName,
  adminTableToolbarSearchWrapperClassName,
  AdminTableLayout,
  ColumnVisibilityControl
} from '@/shared/ui/admin-table';
import { DATE_RANGE_PRESETS, getQuickDateRange } from '@/shared/ui/admin-table/dateRangePresets';
import { ActionRestoreIcon, ColumnFilterIcon, PanelAddRemoveIcon, TrashCanIcon } from '@/shared/ui/icons/AdminActionIcons';
import { EuiTablePagination, useTablePagination } from '@/shared/ui/pagination';
import { MenuItem, MenuPanel } from '@/shared/ui/menu';
import { AdminSearchInput } from '@/shared/ui/admin-search-input';
import AdminFilterInput from '@/shared/ui/admin-filter-input';
import {
  HeaderFilterPortal,
  HEADER_FILTER_BUTTON_CLASS,
  HEADER_FILTER_ROOT_ATTR,
  getHeaderPopoverStyle,
  useHeaderFilterDismiss
} from '@/shared/ui/admin-header-filter';
import { getCustomerTypeLabel, type CustomerType } from '@/shared/domain/order/customerType';
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
type CustomerTypeFilterValue = 'all' | CustomerType;
type ArchiveHeaderFilter = 'type' | 'orderDate' | 'customerType' | 'deletedDate' | 'expiresDate' | null;
type ArchiveSortKey = 'type' | 'element' | 'order_created_at' | 'customer_name' | 'address' | 'customer_type' | 'deleted_at' | 'expires_at';
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
    orderType: false,
    deleted: true,
    expires: true
  });
  const typeFilterButtonRef = useRef<HTMLButtonElement | null>(null);
  const orderDateFilterButtonRef = useRef<HTMLButtonElement | null>(null);
  const customerTypeFilterButtonRef = useRef<HTMLButtonElement | null>(null);
  const deletedDateFilterButtonRef = useRef<HTMLButtonElement | null>(null);
  const expiresDateFilterButtonRef = useRef<HTMLButtonElement | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const { toast } = useToast();

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
      const resolveSortValue = (entry: ArchiveEntry): string | number => {
        if (sortState.key === 'type') return entry.item_type;
        if (sortState.key === 'element') {
          if (typeof entry.order_id === 'number') return entry.order_id;
          if (typeof entry.document_id === 'number') return entry.document_id;
          return 0;
        }
        return String(entry[sortState.key] ?? '');
      };
      const leftValue = resolveSortValue(leftRow.entry);
      const rightValue = resolveSortValue(rightRow.entry);
      if (sortState.key === 'element') {
        const numericComparison = Number(leftValue) - Number(rightValue);
        return sortState.direction === 'asc' ? numericComparison : -numericComparison;
      }
      const isDateKey = sortState.key.includes('date') || sortState.key.includes('created') || sortState.key.includes('expires');
      let comparison = 0;
      if (isDateKey) {
        comparison = new Date(String(leftValue || 0)).getTime() - new Date(String(rightValue || 0)).getTime();
      } else {
        comparison = String(leftValue).localeCompare(String(rightValue), 'sl', { sensitivity: 'base' });
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
    `${adminTableHeaderButtonClassName} ${sortState?.key === key ? 'underline underline-offset-2 text-slate-900' : ''}`;

  const toComparableValue = (value: string) => (value || '—').toLowerCase();
  const isMatchingHoveredCell = (key: ArchiveSortKey, value: string) =>
    hoveredCellMatch?.column === key && hoveredCellMatch.value === toComparableValue(value);
  const getMatchingValueClassName = (key: ArchiveSortKey, value: string) =>
    isMatchingHoveredCell(key, value) ? adminTableMatchingValueActiveClassName : '';

  useEffect(() => {
    setPage(1);
  }, [customerTypeFilter, deletedDateRange.from, deletedDateRange.to, expiresDateRange.from, expiresDateRange.to, orderDateRange.from, orderDateRange.to, search, setPage, sortState, typeFilter]);

  useHeaderFilterDismiss({
    isOpen: Boolean(openHeaderFilter),
    onClose: () => setOpenHeaderFilter(null)
  });

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
      className={`w-full ${adminTableCardClassName}`}
      style={adminTableCardStyle}
      headerClassName={adminTableHeaderClassName}
      headerLeft={
        <div className={adminTableToolbarGroupClassName}>
          <div className="min-w-0 w-full">
            <AdminSearchInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Poišči arhivirane zapise"
              aria-label="Poišči arhivirane zapise"
              wrapperClassName={adminTableToolbarSearchWrapperClassName}
              inputClassName={adminTableSearchInputClassName}
              iconClassName={adminTableSearchIconClassName}
            />
          </div>
        </div>
      }
      headerRight={
        <div className={adminTableToolbarActionsClassName}>
          <ColumnVisibilityControl
            options={ARCHIVE_COLUMN_OPTIONS.map((option) => ({ ...option, disabled: option.key === 'element' }))}
            visibleMap={visibleColumns}
            onToggle={(key) => toggleColumnVisibility(key as ArchiveColumnKey)}
            showLabel={false}
            menuClassName="!w-[156px]"
            triggerClassName={adminTableNeutralIconButtonClassName}
            icon={<PanelAddRemoveIcon className="!scale-[0.8]" />}
          />
          <IconButton
            type="button"
            size="sm"
            tone={hasSelectedRows ? 'success' : 'neutral'}
            className={hasSelectedRows ? adminTableSelectedSuccessIconButtonClassName : `${adminTableNeutralIconButtonClassName} !transition-none`}
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
            className={hasSelectedRows ? adminTableSelectedDangerIconButtonClassName : `${adminTableNeutralIconButtonClassName} !transition-none`}
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
      contentClassName={`${adminTableContentClassName} overflow-y-visible`}
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

      <Table className="w-full min-w-[1080px] table-fixed border-collapse text-[12px] font-['Inter',system-ui,sans-serif]">
          <colgroup>
            <col className="w-[44px]" />
            {visibleColumns.type ? <col className="w-[108px]" /> : null}
            {visibleColumns.element ? <col className="w-[240px]" /> : null}
            {visibleColumns.orderDate ? <col className="w-[130px]" /> : null}
            {visibleColumns.customer ? <col className="w-[150px]" /> : null}
            {visibleColumns.address ? <col className="w-[209px]" /> : null}
            {visibleColumns.orderType ? <col className="w-[100px]" /> : null}
            {visibleColumns.deleted ? <col className="w-[150px]" /> : null}
            {visibleColumns.expires ? <col className="w-[161px]" /> : null}
          </colgroup>
          <THead className="border-t border-slate-200 bg-[color:var(--admin-table-header-bg)]">
            <TR>
              <TH className={`${adminTableHeaderCellCenterClassName} w-10 px-2`}>
                <AdminCheckbox checked={allSelected} onChange={toggleAll} aria-label="Izberi vse" />
              </TH>
              {visibleColumns.type ? (
                <TH className={`${adminTableHeaderCellCenterClassName} w-[108px]`}>
                  <div className={adminTableHeaderContentClassName} {...{ [HEADER_FILTER_ROOT_ATTR]: 'true' }}>
                    <button type="button" onClick={() => handleSort('type')} className={getHeaderTitleClass('type')}>Vrsta</button>
                    <button ref={typeFilterButtonRef} type="button" className={HEADER_FILTER_BUTTON_CLASS} data-active={openHeaderFilter === 'type'} aria-label="Filtriraj vrsto" onClick={() => setOpenHeaderFilter((previousFilter) => (previousFilter === 'type' ? null : 'type'))}>
                      <ColumnFilterIcon className="!h-[12px] !w-[12px]" />
                    </button>
                  </div>
                </TH>
              ) : null}
              {visibleColumns.element ? <TH className={adminTableHeaderCellLeftClassName}><div className="flex h-11 items-center"><button type="button" onClick={() => handleSort('element')} className={getHeaderTitleClass('element')}>Element</button></div></TH> : null}
              {visibleColumns.orderDate ? <TH className={adminTableHeaderCellCenterClassName}>
                <div className={adminTableHeaderContentClassName} {...{ [HEADER_FILTER_ROOT_ATTR]: 'true' }}>
                  <button type="button" onClick={() => handleSort('order_created_at')} className={getHeaderTitleClass('order_created_at')}>Datum naročila</button>
                  <button ref={orderDateFilterButtonRef} type="button" className={HEADER_FILTER_BUTTON_CLASS} data-active={openHeaderFilter === 'orderDate'} aria-label="Filtriraj datum naročila" onClick={() => setOpenHeaderFilter((previousFilter) => (previousFilter === 'orderDate' ? null : 'orderDate'))}>
                    <ColumnFilterIcon className="!h-[12px] !w-[12px]" />
                  </button>
                </div>
              </TH> : null}
              {visibleColumns.customer ? <TH className={adminTableHeaderCellLeftClassName}><div className="flex h-11 items-center"><button type="button" onClick={() => handleSort('customer_name')} className={`${getHeaderTitleClass('customer_name')} ${adminTableMatchingValueHeaderStartClassName}`}>Naročnik</button></div></TH> : null}
              {visibleColumns.address ? <TH className={adminTableHeaderCellLeftClassName}><div className="flex h-11 items-center"><button type="button" onClick={() => handleSort('address')} className={`${getHeaderTitleClass('address')} ${adminTableMatchingValueHeaderStartClassName}`}>Naslov</button></div></TH> : null}
              {visibleColumns.orderType ? <TH className={adminTableHeaderCellCenterClassName}>
                <div className={adminTableHeaderContentClassName} {...{ [HEADER_FILTER_ROOT_ATTR]: 'true' }}>
                  <button type="button" onClick={() => handleSort('customer_type')} className={getHeaderTitleClass('customer_type')}>Tip</button>
                  <button ref={customerTypeFilterButtonRef} type="button" className={HEADER_FILTER_BUTTON_CLASS} data-active={openHeaderFilter === 'customerType'} aria-label="Filtriraj tip" onClick={() => setOpenHeaderFilter((previousFilter) => (previousFilter === 'customerType' ? null : 'customerType'))}>
                    <ColumnFilterIcon className="!h-[12px] !w-[12px]" />
                  </button>
                </div>
              </TH> : null}
              {visibleColumns.deleted ? <TH className={`${adminTableHeaderCellCenterClassName} w-40`}>
                <div className={adminTableHeaderContentClassName} {...{ [HEADER_FILTER_ROOT_ATTR]: 'true' }}>
                  <button type="button" onClick={() => handleSort('deleted_at')} className={getHeaderTitleClass('deleted_at')}>
                    Izbris
                  </button>
                  <button ref={deletedDateFilterButtonRef} type="button" className={HEADER_FILTER_BUTTON_CLASS} data-active={openHeaderFilter === 'deletedDate'} aria-label="Filtriraj datum izbrisa" onClick={() => setOpenHeaderFilter((previousFilter) => (previousFilter === 'deletedDate' ? null : 'deletedDate'))}>
                    <ColumnFilterIcon className="!h-[12px] !w-[12px]" />
                  </button>
                </div>
              </TH> : null}
              {visibleColumns.expires ? <TH className={`${adminTableHeaderCellCenterClassName} w-40 pr-5`}>
                <div className={adminTableHeaderContentClassName} {...{ [HEADER_FILTER_ROOT_ATTR]: 'true' }}>
                  <button type="button" onClick={() => handleSort('expires_at')} className={getHeaderTitleClass('expires_at')}>
                    Iztek
                  </button>
                  <button ref={expiresDateFilterButtonRef} type="button" className={HEADER_FILTER_BUTTON_CLASS} data-active={openHeaderFilter === 'expiresDate'} aria-label="Filtriraj datum izteka" onClick={() => setOpenHeaderFilter((previousFilter) => (previousFilter === 'expiresDate' ? null : 'expiresDate'))}>
                    <ColumnFilterIcon className="!h-[12px] !w-[12px]" />
                  </button>
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
                <TR key={entry.id} className={`border-t border-slate-200/90 bg-white text-[12px] transition-colors ${adminTableRowToneClasses.hover}`}>
                  <TD className="px-0 py-3 text-center">
                    <AdminCheckbox
                      className="disabled:cursor-default disabled:opacity-50"
                      checked={selectedIdSet.has(entry.id)}
                      onChange={() => toggleOne(row)}
                      disabled={isChild && !parentSelected}
                      aria-label={`Izberi zapis ${entry.label}`}
                    />
                  </TD>
                  {visibleColumns.type ? <TD className="px-3 py-3 text-center font-semibold text-slate-700">
                    <span
                      className={`${adminTableMatchingValueBaseClassName} ${getMatchingValueClassName('type', entry.item_type === 'order' ? 'Naročilo' : 'PDF datoteka')}`}
                      onMouseEnter={() => setHoveredCellMatch({ column: 'type', value: toComparableValue(entry.item_type === 'order' ? 'Naročilo' : 'PDF datoteka') })}
                      onMouseLeave={() => setHoveredCellMatch(null)}
                    >
                      {entry.item_type === 'order' ? 'Naročilo' : 'PDF datoteka'}
                    </span>
                  </TD> : null}
                  {visibleColumns.element ? <TD className={`px-3 py-3 font-['Inter',system-ui,sans-serif] text-slate-800 ${isChild ? 'pl-6' : ''}`}>
                    {entry.item_type === 'order' && entry.order_id ? (
                      <a href={`/admin/orders/${entry.order_id}`} className="font-medium text-[color:var(--blue-500)] hover:text-[color:var(--blue-600)]">
                        {entry.label}
                      </a>
                    ) : (
                      <span>{isChild ? `↳ ${entry.label}` : entry.label}</span>
                    )}
                  </TD> : null}
                  {visibleColumns.orderDate ? <TD className="px-3 py-3 text-center text-slate-600">
                    <span
                      className={`${adminTableMatchingValueBaseClassName} ${getMatchingValueClassName('order_created_at', entry.order_created_at ? formatDateOnly(entry.order_created_at) : '—')}`}
                      onMouseEnter={() => setHoveredCellMatch({ column: 'order_created_at', value: toComparableValue(entry.order_created_at ? formatDateOnly(entry.order_created_at) : '—') })}
                      onMouseLeave={() => setHoveredCellMatch(null)}
                    >
                      {entry.order_created_at ? formatDateOnly(entry.order_created_at) : '—'}
                    </span>
                  </TD> : null}
                  {visibleColumns.customer ? <TD className="px-3 py-3 text-slate-600">
                    <span className={`${adminTableMatchingValueBaseClassName} max-w-full truncate ${getMatchingValueClassName('customer_name', entry.customer_name ?? '—')}`} onMouseEnter={() => setHoveredCellMatch({ column: 'customer_name', value: toComparableValue(entry.customer_name ?? '—') })} onMouseLeave={() => setHoveredCellMatch(null)}>
                      {entry.customer_name ?? '—'}
                    </span>
                  </TD> : null}
                  {visibleColumns.address ? <TD className="px-3 py-3 text-slate-600">
                    <span className={`${adminTableMatchingValueBaseClassName} max-w-full truncate ${getMatchingValueClassName('address', entry.address ?? '—')}`} onMouseEnter={() => setHoveredCellMatch({ column: 'address', value: toComparableValue(entry.address ?? '—') })} onMouseLeave={() => setHoveredCellMatch(null)}>
                      {entry.address ?? '—'}
                    </span>
                  </TD> : null}
                  {visibleColumns.orderType ? <TD className="px-3 py-3 text-center text-slate-600">
                    <span className={`${adminTableMatchingValueBaseClassName} ${getMatchingValueClassName('customer_type', entry.customer_type ? getCustomerTypeLabel(entry.customer_type) : '—')}`} onMouseEnter={() => setHoveredCellMatch({ column: 'customer_type', value: toComparableValue(entry.customer_type ? getCustomerTypeLabel(entry.customer_type) : '—') })} onMouseLeave={() => setHoveredCellMatch(null)}>
                      {entry.customer_type ? getCustomerTypeLabel(entry.customer_type) : '—'}
                    </span>
                  </TD> : null}
                  {visibleColumns.deleted ? <TD className="px-3 py-3 text-center text-slate-600">
                    <span className={`${adminTableMatchingValueBaseClassName} ${getMatchingValueClassName('deleted_at', formatDateOnly(entry.deleted_at))}`} onMouseEnter={() => setHoveredCellMatch({ column: 'deleted_at', value: toComparableValue(formatDateOnly(entry.deleted_at)) })} onMouseLeave={() => setHoveredCellMatch(null)}>
                      {formatDateOnly(entry.deleted_at)}
                    </span>
                  </TD> : null}
                  {visibleColumns.expires ? <TD className="px-3 py-3 pr-5 text-center text-slate-600">
                    <span className={`${adminTableMatchingValueBaseClassName} ${getMatchingValueClassName('expires_at', formatDateOnly(entry.expires_at))}`} onMouseEnter={() => setHoveredCellMatch({ column: 'expires_at', value: toComparableValue(formatDateOnly(entry.expires_at)) })} onMouseLeave={() => setHoveredCellMatch(null)}>
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
      <HeaderFilterPortal open={Boolean(openHeaderFilter)}>
        {openHeaderFilter === 'type' ? (
          <div style={getHeaderPopoverStyle(typeFilterButtonRef.current, 160)}>
            <MenuPanel className="w-40">
              {TYPE_FILTER_OPTIONS.map((option) => (
                <MenuItem key={option.value} onClick={() => { setTypeFilter(option.value); setOpenHeaderFilter(null); }}>
                  {option.label}
                </MenuItem>
              ))}
            </MenuPanel>
          </div>
        ) : null}
        {openHeaderFilter === 'orderDate' ? (
          <div role="menu" style={getHeaderPopoverStyle(orderDateFilterButtonRef.current, 380)} className={adminTablePopoverPanelClassName}>
            <div className="mb-3 grid grid-cols-3 gap-2">
              {DATE_RANGE_PRESETS.map((preset) => (
                <button key={preset.key} type="button" className={adminTablePopoverPresetButtonClassName} onClick={() => setDraftOrderDateRange(getQuickDateRange(preset.key))}>
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="mb-3 border-t border-slate-200 pt-3 grid grid-cols-2 gap-2">
              <AdminFilterInput type="date" value={draftOrderDateRange.from} onChange={(event) => setDraftOrderDateRange((current) => ({ ...current, from: event.target.value }))} aria-label="Od" />
              <AdminFilterInput type="date" value={draftOrderDateRange.to} onChange={(event) => setDraftOrderDateRange((current) => ({ ...current, to: event.target.value }))} aria-label="Do" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={adminTablePopoverPrimaryButtonClassName} onClick={() => { setOrderDateRange(draftOrderDateRange); setOpenHeaderFilter(null); }}>Potrdi</button>
              <button type="button" className={adminTablePopoverSecondaryButtonClassName} onClick={() => { const empty = { from: '', to: '' }; setDraftOrderDateRange(empty); setOrderDateRange(empty); setOpenHeaderFilter(null); }}>Ponastavi</button>
            </div>
          </div>
        ) : null}
        {openHeaderFilter === 'customerType' ? (
          <div style={getHeaderPopoverStyle(customerTypeFilterButtonRef.current, 160)}>
            <MenuPanel className="w-40">
              <MenuItem onClick={() => { setCustomerTypeFilter('all'); setOpenHeaderFilter(null); }}>Vsi tipi</MenuItem>
              <MenuItem onClick={() => { setCustomerTypeFilter('individual'); setOpenHeaderFilter(null); }}>Fiz. oseba</MenuItem>
              <MenuItem onClick={() => { setCustomerTypeFilter('company'); setOpenHeaderFilter(null); }}>Podjetje</MenuItem>
              <MenuItem onClick={() => { setCustomerTypeFilter('school'); setOpenHeaderFilter(null); }}>Šola</MenuItem>
            </MenuPanel>
          </div>
        ) : null}
        {openHeaderFilter === 'deletedDate' ? (
          <div role="menu" style={getHeaderPopoverStyle(deletedDateFilterButtonRef.current, 380)} className={adminTablePopoverPanelClassName}>
            <div className="mb-3 grid grid-cols-3 gap-2">
              {DATE_RANGE_PRESETS.map((preset) => (
                <button key={preset.key} type="button" className={adminTablePopoverPresetButtonClassName} onClick={() => setDraftDeletedDateRange(getQuickDateRange(preset.key))}>
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="mb-3 border-t border-slate-200 pt-3 grid grid-cols-2 gap-2">
              <AdminFilterInput type="date" value={draftDeletedDateRange.from} onChange={(event) => setDraftDeletedDateRange((current) => ({ ...current, from: event.target.value }))} aria-label="Od" />
              <AdminFilterInput type="date" value={draftDeletedDateRange.to} onChange={(event) => setDraftDeletedDateRange((current) => ({ ...current, to: event.target.value }))} aria-label="Do" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={adminTablePopoverPrimaryButtonClassName} onClick={() => { setDeletedDateRange(draftDeletedDateRange); setOpenHeaderFilter(null); }}>Potrdi</button>
              <button type="button" className={adminTablePopoverSecondaryButtonClassName} onClick={() => { const empty = { from: '', to: '' }; setDraftDeletedDateRange(empty); setDeletedDateRange(empty); setOpenHeaderFilter(null); }}>Ponastavi</button>
            </div>
          </div>
        ) : null}
        {openHeaderFilter === 'expiresDate' ? (
          <div role="menu" style={getHeaderPopoverStyle(expiresDateFilterButtonRef.current, 380)} className={adminTablePopoverPanelClassName}>
            <div className="mb-3 grid grid-cols-3 gap-2">
              {DATE_RANGE_PRESETS.map((preset) => (
                <button key={preset.key} type="button" className={adminTablePopoverPresetButtonClassName} onClick={() => setDraftExpiresDateRange(getQuickDateRange(preset.key))}>
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="mb-3 border-t border-slate-200 pt-3 grid grid-cols-2 gap-2">
              <AdminFilterInput type="date" value={draftExpiresDateRange.from} onChange={(event) => setDraftExpiresDateRange((current) => ({ ...current, from: event.target.value }))} aria-label="Od" />
              <AdminFilterInput type="date" value={draftExpiresDateRange.to} onChange={(event) => setDraftExpiresDateRange((current) => ({ ...current, to: event.target.value }))} aria-label="Do" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={adminTablePopoverPrimaryButtonClassName} onClick={() => { setExpiresDateRange(draftExpiresDateRange); setOpenHeaderFilter(null); }}>Potrdi</button>
              <button type="button" className={adminTablePopoverSecondaryButtonClassName} onClick={() => { const empty = { from: '', to: '' }; setDraftExpiresDateRange(empty); setExpiresDateRange(empty); setOpenHeaderFilter(null); }}>Ponastavi</button>
            </div>
          </div>
        ) : null}
      </HeaderFilterPortal>

    </AdminTableLayout>
  );
}
