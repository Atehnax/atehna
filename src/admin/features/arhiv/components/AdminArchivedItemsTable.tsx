'use client';

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { AdminCheckbox } from '@/shared/ui/checkbox';
import { IconButton } from '@/shared/ui/icon-button';
import { AdminSearchInput } from '@/shared/ui/admin-search-input';
import AdminFilterInput from '@/shared/ui/admin-filter-input';
import {
  HeaderFilterPortal,
  HEADER_FILTER_BUTTON_CLASS,
  HEADER_FILTER_ROOT_ATTR,
  getHeaderPopoverStyle,
  useHeaderFilterDismiss
} from '@/shared/ui/admin-header-filter';
import {
  adminTableBodyCellBaseClassName,
  adminTableBodyCellCenterClassName,
  adminTableCardClassName,
  adminTableCardStyle,
  adminTableContentClassName,
  adminTableHeaderButtonClassName,
  adminTableHeaderCellCenterClassName,
  adminTableHeaderCellLeftClassName,
  adminTableHeaderClassName,
  adminTableHeaderContentClassName,
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
import { EuiTablePagination, useTablePagination } from '@/shared/ui/pagination';
import { ActionRestoreIcon, ColumnFilterIcon, PanelAddRemoveIcon, TrashCanIcon } from '@/shared/ui/icons/AdminActionIcons';
import { adminTableRowToneClasses, filterPillClearGlyph, filterPillTokenClasses } from '@/shared/ui/theme/tokens';
import { EmptyState, Table, TBody, TD, THead, TH, TR } from '@/shared/ui/table';
import { useToast } from '@/shared/ui/toast';
import { formatEuro } from '@/shared/domain/formatting';
import { saveCatalogItemPayload } from '@/admin/lib/catalogItemClient';
import type { CatalogItemEditorPayload } from '@/shared/domain/catalog/catalogAdminTypes';

const STORAGE_KEY = 'admin-items-crud-v2';
const PAGE_SIZE_OPTIONS = [25, 50, 100];

type Item = {
  id: string;
  name: string;
  category: string;
  sku: string;
  price: number;
  discountPct?: number | null;
  active: boolean;
  archivedAt?: string | null;
  restorePayload?: CatalogItemEditorPayload | null;
};

type ArchivedItemsColumnKey = 'name' | 'sku' | 'category' | 'price' | 'archivedAt';
type ArchivedItemsSortKey = ArchivedItemsColumnKey;
type ArchivedItemsHeaderFilter = ArchivedItemsColumnKey | null;
type SortDirection = 'asc' | 'desc';

const ARCHIVED_ITEMS_COLUMN_OPTIONS: Array<{ key: ArchivedItemsColumnKey; label: string; disabled?: boolean }> = [
  { key: 'name', label: 'Naziv', disabled: true },
  { key: 'sku', label: 'SKU' },
  { key: 'category', label: 'Kategorija' },
  { key: 'price', label: 'Cena' },
  { key: 'archivedAt', label: 'Arhivirano' }
];

const formatCurrency = formatEuro;

const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  return new Date(value).toLocaleString('sl-SI', { dateStyle: 'medium', timeStyle: 'short' });
};

function createRestoreInsertPayload(payload: CatalogItemEditorPayload): CatalogItemEditorPayload {
  const { id: _id, ...itemPayload } = payload;
  return {
    ...itemPayload,
    variants: itemPayload.variants.map(({ id: _variantId, ...variant }) => variant),
    quantityDiscounts: itemPayload.quantityDiscounts?.map(({ id: _discountId, ...rule }) => rule),
    media: itemPayload.media.map(({ id: _mediaId, ...media }) => media)
  };
}

const normalizeText = (value: string | number | null | undefined) =>
  String(value ?? '').trim().toLocaleLowerCase('sl');

const parseNumberFilterValue = (value: string) => {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const getDiscountedPrice = (item: Item) => {
  const price = Number(item.price);
  const discountPct = Number(item.discountPct ?? 0);
  if (!Number.isFinite(price)) return 0;
  return price * (1 - (Number.isFinite(discountPct) ? discountPct : 0) / 100);
};

const dateInRange = (value: string | null | undefined, from: string, to: string) => {
  if (!from && !to) return true;
  if (!value) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  const isoDate = parsed.toISOString().slice(0, 10);
  if (from && isoDate < from) return false;
  if (to && isoDate > to) return false;
  return true;
};

export default function AdminArchivedItemsTable() {
  const { toast } = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [draftNameFilter, setDraftNameFilter] = useState('');
  const [skuFilter, setSkuFilter] = useState('');
  const [draftSkuFilter, setDraftSkuFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [draftCategoryFilter, setDraftCategoryFilter] = useState('');
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  const [draftPriceRange, setDraftPriceRange] = useState({ min: '', max: '' });
  const [archivedDateRange, setArchivedDateRange] = useState({ from: '', to: '' });
  const [draftArchivedDateRange, setDraftArchivedDateRange] = useState({ from: '', to: '' });
  const [openHeaderFilter, setOpenHeaderFilter] = useState<ArchivedItemsHeaderFilter>(null);
  const [sortState, setSortState] = useState<{ key: ArchivedItemsSortKey; direction: SortDirection } | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<Record<ArchivedItemsColumnKey, boolean>>({
    name: true,
    sku: true,
    category: true,
    price: true,
    archivedAt: true
  });
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isRestoringSelected, setIsRestoringSelected] = useState(false);
  const nameFilterButtonRef = useRef<HTMLButtonElement | null>(null);
  const skuFilterButtonRef = useRef<HTMLButtonElement | null>(null);
  const categoryFilterButtonRef = useRef<HTMLButtonElement | null>(null);
  const priceFilterButtonRef = useRef<HTMLButtonElement | null>(null);
  const archivedDateFilterButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Item[];
      if (Array.isArray(parsed)) {
        setItems(parsed.map((item) => ({ ...item, archivedAt: item.archivedAt ?? null })));
      }
    } catch {
      // ignore malformed state
    }
  }, []);

  const archivedItems = useMemo(
    () => items.filter((item) => item.archivedAt),
    [items]
  );

  const filteredArchivedItems = useMemo(() => {
    const query = normalizeText(search);
    const normalizedNameFilter = normalizeText(nameFilter);
    const normalizedSkuFilter = normalizeText(skuFilter);
    const normalizedCategoryFilter = normalizeText(categoryFilter);
    const minPrice = parseNumberFilterValue(priceRange.min);
    const maxPrice = parseNumberFilterValue(priceRange.max);

    return archivedItems.filter((item) => {
      const price = getDiscountedPrice(item);
      const searchableValues = [
        item.name,
        item.sku,
        item.category,
        formatCurrency(price),
        formatDateTime(item.archivedAt)
      ];
      const matchesSearch = !query || searchableValues.some((value) => normalizeText(value).includes(query));
      const matchesName = !normalizedNameFilter || normalizeText(item.name).includes(normalizedNameFilter);
      const matchesSku = !normalizedSkuFilter || normalizeText(item.sku).includes(normalizedSkuFilter);
      const matchesCategory = !normalizedCategoryFilter || normalizeText(item.category).includes(normalizedCategoryFilter);
      const matchesMinPrice = minPrice === null || price >= minPrice;
      const matchesMaxPrice = maxPrice === null || price <= maxPrice;
      const matchesArchivedDate = dateInRange(item.archivedAt, archivedDateRange.from, archivedDateRange.to);

      return (
        matchesSearch &&
        matchesName &&
        matchesSku &&
        matchesCategory &&
        matchesMinPrice &&
        matchesMaxPrice &&
        matchesArchivedDate
      );
    });
  }, [archivedDateRange.from, archivedDateRange.to, archivedItems, categoryFilter, nameFilter, priceRange.max, priceRange.min, search, skuFilter]);

  const sortedArchivedItems = useMemo(() => {
    const collator = new Intl.Collator('sl', { numeric: true, sensitivity: 'base' });
    const sortedItems = [...filteredArchivedItems];

    if (!sortState) {
      sortedItems.sort((leftItem, rightItem) => String(rightItem.archivedAt ?? '').localeCompare(String(leftItem.archivedAt ?? '')));
      return sortedItems;
    }

    sortedItems.sort((leftItem, rightItem) => {
      let comparison = 0;
      if (sortState.key === 'price') {
        comparison = getDiscountedPrice(leftItem) - getDiscountedPrice(rightItem);
      } else if (sortState.key === 'archivedAt') {
        comparison =
          new Date(leftItem.archivedAt ?? 0).getTime() -
          new Date(rightItem.archivedAt ?? 0).getTime();
      } else {
        comparison = collator.compare(String(leftItem[sortState.key] ?? ''), String(rightItem[sortState.key] ?? ''));
      }
      return sortState.direction === 'asc' ? comparison : -comparison;
    });

    return sortedItems;
  }, [filteredArchivedItems, sortState]);

  const { page, pageSize, pageCount, setPage, setPageSize } = useTablePagination({
    totalCount: sortedArchivedItems.length,
    storageKey: 'adminArhivArtikli.pageSize',
    defaultPageSize: 50,
    pageSizeOptions: PAGE_SIZE_OPTIONS
  });

  const pagedArchivedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedArchivedItems.slice(start, start + pageSize);
  }, [page, pageSize, sortedArchivedItems]);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const visibleIds = useMemo(() => pagedArchivedItems.map((item) => item.id), [pagedArchivedItems]);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIdSet.has(id));

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; title: string; value: string; clear: () => void }> = [];
    const trimmedSearch = search.trim();
    if (trimmedSearch) {
      chips.push({ key: 'search', title: 'Iskanje:', value: trimmedSearch, clear: () => setSearch('') });
    }
    if (nameFilter.trim()) {
      chips.push({ key: 'name', title: 'Naziv:', value: nameFilter.trim(), clear: () => { setNameFilter(''); setDraftNameFilter(''); } });
    }
    if (skuFilter.trim()) {
      chips.push({ key: 'sku', title: 'SKU:', value: skuFilter.trim(), clear: () => { setSkuFilter(''); setDraftSkuFilter(''); } });
    }
    if (categoryFilter.trim()) {
      chips.push({ key: 'category', title: 'Kategorija:', value: categoryFilter.trim(), clear: () => { setCategoryFilter(''); setDraftCategoryFilter(''); } });
    }
    if (priceRange.min || priceRange.max) {
      chips.push({
        key: 'price',
        title: 'Cena:',
        value: `${priceRange.min || '—'} – ${priceRange.max || '—'}`,
        clear: () => {
          const empty = { min: '', max: '' };
          setPriceRange(empty);
          setDraftPriceRange(empty);
        }
      });
    }
    if (archivedDateRange.from || archivedDateRange.to) {
      chips.push({
        key: 'archivedAt',
        title: 'Arhivirano:',
        value: `${archivedDateRange.from || '—'} – ${archivedDateRange.to || '—'}`,
        clear: () => {
          const empty = { from: '', to: '' };
          setArchivedDateRange(empty);
          setDraftArchivedDateRange(empty);
        }
      });
    }
    return chips;
  }, [archivedDateRange.from, archivedDateRange.to, categoryFilter, nameFilter, priceRange.max, priceRange.min, search, skuFilter]);

  useEffect(() => {
    setPage(1);
  }, [archivedDateRange.from, archivedDateRange.to, categoryFilter, nameFilter, priceRange.max, priceRange.min, search, setPage, skuFilter, sortState]);

  useHeaderFilterDismiss({
    isOpen: Boolean(openHeaderFilter),
    onClose: () => setOpenHeaderFilter(null)
  });

  const persist = (next: Item[]) => {
    setItems(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const restoreSelected = async () => {
    if (selectedIds.length === 0 || isRestoringSelected) return;
    const selectedSet = new Set(selectedIds);
    const selectedItems = items.filter((item) => selectedSet.has(item.id));
    const missingPayloadCount = selectedItems.filter((item) => !item.restorePayload).length;
    if (missingPayloadCount > 0) {
      toast.error('Izbrani arhivski zapis ne vsebuje podatkov za obnovitev.');
      return;
    }

    setIsRestoringSelected(true);
    try {
      for (const item of selectedItems) {
        if (!item.restorePayload) throw new Error('Arhivski zapis ne vsebuje podatkov za obnovitev.');
        await saveCatalogItemPayload(createRestoreInsertPayload(item.restorePayload));
      }

      const next = items.map((item) => (selectedSet.has(item.id) ? { ...item, archivedAt: null } : item));
      persist(next);
      setSelectedIds([]);
      toast.success(selectedIds.length === 1 ? 'Artikel je obnovljen.' : `Obnovljenih artiklov: ${selectedIds.length}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Obnova artikla ni uspela.');
    } finally {
      setIsRestoringSelected(false);
    }
  };

  const hardDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    setIsDeleteConfirmOpen(true);
  };

  const confirmHardDeleteSelected = () => {
    const selectedSet = new Set(selectedIds);
    const deletedCount = selectedIds.length;
    const next = items.filter((item) => !selectedSet.has(item.id));
    persist(next);
    setSelectedIds([]);
    setIsDeleteConfirmOpen(false);
    toast.success(deletedCount === 1 ? 'Artikel je trajno izbrisan.' : `Trajno izbrisanih artiklov: ${deletedCount}.`);
  };

  const toggleAll = () => {
    setSelectedIds((current) => {
      const visibleIdSet = new Set(visibleIds);
      if (allSelected) return current.filter((id) => !visibleIdSet.has(id));
      return Array.from(new Set([...current, ...visibleIds]));
    });
  };

  const toggleColumnVisibility = (key: ArchivedItemsColumnKey) => {
    setVisibleColumns((current) => {
      const next = { ...current, [key]: !current[key] };
      if (!next.name) return current;
      if (Object.values(next).every((isVisible) => !isVisible)) return current;
      return next;
    });
  };

  const handleSort = (key: ArchivedItemsSortKey) => {
    const currentDirection = sortState?.key === key ? sortState.direction : null;
    const nextDirection = currentDirection === 'desc' ? 'asc' : currentDirection === 'asc' ? null : 'desc';
    setSortState(nextDirection ? { key, direction: nextDirection } : null);
  };

  const getHeaderTitleClass = (key: ArchivedItemsSortKey) =>
    `${adminTableHeaderButtonClassName} ${sortState?.key === key ? 'underline underline-offset-2 text-slate-900' : ''}`;

  const toggleHeaderFilter = (filter: ArchivedItemsHeaderFilter) => {
    setOpenHeaderFilter((current) => (current === filter ? null : filter));
  };

  const renderTextFilterPanel = ({
    label,
    draftValue,
    setDraftValue,
    commitValue,
    resetValue
  }: {
    label: string;
    draftValue: string;
    setDraftValue: (value: string) => void;
    commitValue: () => void;
    resetValue: () => void;
  }) => (
    <div role="menu" className={adminTablePopoverPanelClassName}>
      <div className="mb-3">
        <AdminFilterInput
          value={draftValue}
          onChange={(event) => setDraftValue(event.target.value)}
          aria-label={label}
          placeholder={label}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className={adminTablePopoverPrimaryButtonClassName} onClick={commitValue}>
          Potrdi
        </button>
        <button type="button" className={adminTablePopoverSecondaryButtonClassName} onClick={resetValue}>
          Ponastavi
        </button>
      </div>
    </div>
  );

  const renderHeader = (
    key: ArchivedItemsColumnKey,
    label: string,
    align: 'left' | 'center',
    filterButtonRef: RefObject<HTMLButtonElement | null>
  ) => (
    <TH className={align === 'center' ? adminTableHeaderCellCenterClassName : adminTableHeaderCellLeftClassName}>
      <div className={adminTableHeaderContentClassName} {...{ [HEADER_FILTER_ROOT_ATTR]: 'true' }}>
        <button type="button" onClick={() => handleSort(key)} className={getHeaderTitleClass(key)}>
          {label}
        </button>
        <button
          ref={filterButtonRef}
          type="button"
          className={HEADER_FILTER_BUTTON_CLASS}
          data-active={openHeaderFilter === key}
          aria-label={`Filtriraj ${label}`}
          onClick={(event) => {
            event.stopPropagation();
            toggleHeaderFilter(key);
          }}
        >
          <ColumnFilterIcon className="!h-[12px] !w-[12px]" />
        </button>
      </div>
    </TH>
  );

  return (
    <AdminTableLayout
      className={`w-full ${adminTableCardClassName}`}
      style={adminTableCardStyle}
      headerClassName={adminTableHeaderClassName}
      contentClassName={`${adminTableContentClassName} overflow-y-visible`}
      showDivider={false}
      headerLeft={
        <div className={adminTableToolbarGroupClassName}>
          <div className="min-w-0 w-full">
            <AdminSearchInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Poišči arhivirane artikle"
              aria-label="Poišči arhivirane artikle"
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
            options={ARCHIVED_ITEMS_COLUMN_OPTIONS}
            visibleMap={visibleColumns}
            onToggle={(key) => toggleColumnVisibility(key as ArchivedItemsColumnKey)}
            showLabel={false}
            menuClassName="!w-[156px]"
            triggerClassName={adminTableNeutralIconButtonClassName}
            icon={<PanelAddRemoveIcon className="!scale-[0.8]" />}
          />
          <IconButton
            type="button"
            size="sm"
            tone={selectedIds.length > 0 ? 'success' : 'neutral'}
            className={selectedIds.length > 0 ? adminTableSelectedSuccessIconButtonClassName : `${adminTableNeutralIconButtonClassName} !transition-none`}
            onClick={() => void restoreSelected()}
            disabled={selectedIds.length === 0 || isRestoringSelected}
            aria-label="Obnovi izbrane artikle"
            title="Obnovi"
          >
            <ActionRestoreIcon />
          </IconButton>
          <IconButton
            type="button"
            size="sm"
            tone={selectedIds.length > 0 ? 'danger' : 'neutral'}
            className={selectedIds.length > 0 ? adminTableSelectedDangerIconButtonClassName : `${adminTableNeutralIconButtonClassName} !transition-none`}
            onClick={hardDeleteSelected}
            disabled={selectedIds.length === 0}
            aria-label="Trajno izbriši izbrane artikle"
            title="Trajno izbriši"
          >
            <TrashCanIcon />
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
                <button type="button" onClick={chip.clear} className={filterPillTokenClasses.clear} aria-label={`Odstrani filter ${chip.title}`}>
                  {filterPillClearGlyph}
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
        <ConfirmDialog
          open={isDeleteConfirmOpen}
          title="Trajni izbris"
          description="Ali želite trajno izbrisati izbrane arhivirane artikle?"
          confirmLabel="Izbriši"
          cancelLabel="Prekliči"
          isDanger
          onCancel={() => setIsDeleteConfirmOpen(false)}
          onConfirm={confirmHardDeleteSelected}
        />
      ) : null}

      <Table className="w-full min-w-[960px] table-fixed border-collapse text-[12px] font-['Inter',system-ui,sans-serif]">
        <colgroup>
          <col className="w-[44px]" />
          {visibleColumns.name ? <col className="w-[30%]" /> : null}
          {visibleColumns.sku ? <col className="w-[18%]" /> : null}
          {visibleColumns.category ? <col className="w-[20%]" /> : null}
          {visibleColumns.price ? <col className="w-[14%]" /> : null}
          {visibleColumns.archivedAt ? <col className="w-[18%]" /> : null}
        </colgroup>
        <THead className="border-t border-slate-200 bg-[color:var(--admin-table-header-bg)]">
          <TR>
            <TH className={`${adminTableHeaderCellCenterClassName} w-[44px] px-2`}>
              <AdminCheckbox
                checked={allSelected}
                onChange={toggleAll}
                aria-label="Izberi vse"
              />
            </TH>
            {visibleColumns.name ? renderHeader('name', 'Naziv', 'left', nameFilterButtonRef) : null}
            {visibleColumns.sku ? renderHeader('sku', 'SKU', 'left', skuFilterButtonRef) : null}
            {visibleColumns.category ? renderHeader('category', 'Kategorija', 'left', categoryFilterButtonRef) : null}
            {visibleColumns.price ? renderHeader('price', 'Cena', 'center', priceFilterButtonRef) : null}
            {visibleColumns.archivedAt ? renderHeader('archivedAt', 'Arhivirano', 'center', archivedDateFilterButtonRef) : null}
          </TR>
        </THead>
        <TBody>
          {pagedArchivedItems.length === 0 ? (
            <TR>
              <TD colSpan={1 + Object.values(visibleColumns).filter(Boolean).length} className="px-3 py-8">
                <EmptyState
                  title={archivedItems.length === 0 ? 'Ni arhiviranih artiklov' : 'Ni zadetkov za izbrane filtre.'}
                  description={
                    archivedItems.length === 0
                      ? 'Ko arhivirate artikel, se bo prikazal tukaj.'
                      : 'Poskusite z drugim iskalnim izrazom ali filtrom.'
                  }
                />
              </TD>
            </TR>
          ) : null}

          {pagedArchivedItems.map((item) => {
            const isSelected = selectedIdSet.has(item.id);
            return (
              <TR
                key={item.id}
                className={`h-12 border-t border-slate-200/90 bg-white text-[12px] transition-colors ${isSelected ? adminTableRowToneClasses.selected : ''} ${adminTableRowToneClasses.hover}`}
              >
                <TD className="h-12 px-0 py-0 text-center align-middle">
                  <div className="flex h-12 items-center justify-center">
                    <AdminCheckbox
                      checked={isSelected}
                      onChange={() =>
                        setSelectedIds((current) =>
                          current.includes(item.id)
                            ? current.filter((entry) => entry !== item.id)
                            : [...current, item.id]
                        )
                      }
                      aria-label={`Izberi ${item.name}`}
                    />
                  </div>
                </TD>
                {visibleColumns.name ? <TD className={`${adminTableBodyCellBaseClassName} font-medium text-slate-900`}>{item.name}</TD> : null}
                {visibleColumns.sku ? <TD className={adminTableBodyCellBaseClassName}>{item.sku}</TD> : null}
                {visibleColumns.category ? <TD className={adminTableBodyCellBaseClassName}>{item.category || '—'}</TD> : null}
                {visibleColumns.price ? <TD className={`${adminTableBodyCellCenterClassName} tabular-nums`}>{formatCurrency(getDiscountedPrice(item))}</TD> : null}
                {visibleColumns.archivedAt ? <TD className={adminTableBodyCellCenterClassName}>{formatDateTime(item.archivedAt)}</TD> : null}
              </TR>
            );
          })}
        </TBody>
      </Table>

      <HeaderFilterPortal open={Boolean(openHeaderFilter)}>
        {openHeaderFilter === 'name' ? (
          <div style={getHeaderPopoverStyle(nameFilterButtonRef.current, 260)}>
            {renderTextFilterPanel({
              label: 'Filtriraj naziv',
              draftValue: draftNameFilter,
              setDraftValue: setDraftNameFilter,
              commitValue: () => {
                setNameFilter(draftNameFilter.trim());
                setOpenHeaderFilter(null);
              },
              resetValue: () => {
                setDraftNameFilter('');
                setNameFilter('');
                setOpenHeaderFilter(null);
              }
            })}
          </div>
        ) : null}
        {openHeaderFilter === 'sku' ? (
          <div style={getHeaderPopoverStyle(skuFilterButtonRef.current, 240)}>
            {renderTextFilterPanel({
              label: 'Filtriraj SKU',
              draftValue: draftSkuFilter,
              setDraftValue: setDraftSkuFilter,
              commitValue: () => {
                setSkuFilter(draftSkuFilter.trim());
                setOpenHeaderFilter(null);
              },
              resetValue: () => {
                setDraftSkuFilter('');
                setSkuFilter('');
                setOpenHeaderFilter(null);
              }
            })}
          </div>
        ) : null}
        {openHeaderFilter === 'category' ? (
          <div style={getHeaderPopoverStyle(categoryFilterButtonRef.current, 260)}>
            {renderTextFilterPanel({
              label: 'Filtriraj kategorijo',
              draftValue: draftCategoryFilter,
              setDraftValue: setDraftCategoryFilter,
              commitValue: () => {
                setCategoryFilter(draftCategoryFilter.trim());
                setOpenHeaderFilter(null);
              },
              resetValue: () => {
                setDraftCategoryFilter('');
                setCategoryFilter('');
                setOpenHeaderFilter(null);
              }
            })}
          </div>
        ) : null}
        {openHeaderFilter === 'price' ? (
          <div role="menu" style={getHeaderPopoverStyle(priceFilterButtonRef.current, 240)} className={adminTablePopoverPanelClassName}>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <AdminFilterInput
                inputMode="decimal"
                value={draftPriceRange.min}
                onChange={(event) => setDraftPriceRange((current) => ({ ...current, min: event.target.value }))}
                aria-label="Najnižja cena"
                placeholder="Od"
              />
              <AdminFilterInput
                inputMode="decimal"
                value={draftPriceRange.max}
                onChange={(event) => setDraftPriceRange((current) => ({ ...current, max: event.target.value }))}
                aria-label="Najvišja cena"
                placeholder="Do"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={adminTablePopoverPrimaryButtonClassName} onClick={() => { setPriceRange(draftPriceRange); setOpenHeaderFilter(null); }}>Potrdi</button>
              <button type="button" className={adminTablePopoverSecondaryButtonClassName} onClick={() => { const empty = { min: '', max: '' }; setDraftPriceRange(empty); setPriceRange(empty); setOpenHeaderFilter(null); }}>Ponastavi</button>
            </div>
          </div>
        ) : null}
        {openHeaderFilter === 'archivedAt' ? (
          <div role="menu" style={getHeaderPopoverStyle(archivedDateFilterButtonRef.current, 380)} className={adminTablePopoverPanelClassName}>
            <div className="mb-3 grid grid-cols-3 gap-2">
              {DATE_RANGE_PRESETS.map((preset) => (
                <button key={preset.key} type="button" className={adminTablePopoverPresetButtonClassName} onClick={() => setDraftArchivedDateRange(getQuickDateRange(preset.key))}>
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="mb-3 grid grid-cols-2 gap-2 border-t border-slate-200 pt-3">
              <AdminFilterInput
                type="date"
                value={draftArchivedDateRange.from}
                onChange={(event) => setDraftArchivedDateRange((current) => ({ ...current, from: event.target.value }))}
                aria-label="Arhivirano od"
              />
              <AdminFilterInput
                type="date"
                value={draftArchivedDateRange.to}
                onChange={(event) => setDraftArchivedDateRange((current) => ({ ...current, to: event.target.value }))}
                aria-label="Arhivirano do"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={adminTablePopoverPrimaryButtonClassName} onClick={() => { setArchivedDateRange(draftArchivedDateRange); setOpenHeaderFilter(null); }}>Potrdi</button>
              <button type="button" className={adminTablePopoverSecondaryButtonClassName} onClick={() => { const empty = { from: '', to: '' }; setDraftArchivedDateRange(empty); setArchivedDateRange(empty); setOpenHeaderFilter(null); }}>Ponastavi</button>
            </div>
          </div>
        ) : null}
      </HeaderFilterPortal>
    </AdminTableLayout>
  );
}
