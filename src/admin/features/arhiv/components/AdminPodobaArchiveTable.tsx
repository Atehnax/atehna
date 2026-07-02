'use client';

import { useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import {
  HeaderFilterPortal,
  HEADER_FILTER_BUTTON_CLASS,
  HEADER_FILTER_ROOT_ATTR,
  getHeaderPopoverStyle,
  useHeaderFilterDismiss
} from '@/shared/ui/admin-header-filter';
import AdminFilterInput from '@/shared/ui/admin-filter-input';
import { AdminSearchInput } from '@/shared/ui/admin-search-input';
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
  adminTableToolbarActionsClassName,
  adminTableToolbarGroupClassName,
  adminTableToolbarSearchWrapperClassName,
  AdminTableLayout,
  ColumnVisibilityControl
} from '@/shared/ui/admin-table';
import { DATE_RANGE_PRESETS, getQuickDateRange } from '@/shared/ui/admin-table/dateRangePresets';
import { ColumnFilterIcon, PanelAddRemoveIcon } from '@/shared/ui/icons/AdminActionIcons';
import { EuiTablePagination, useTablePagination } from '@/shared/ui/pagination';
import { EmptyState, Table, TBody, TD, THead, TH, TR } from '@/shared/ui/table';
import { MenuItem, MenuPanel } from '@/shared/ui/menu';
import { adminTableRowToneClasses, filterPillClearGlyph, filterPillTokenClasses } from '@/shared/ui/theme/tokens';
import type { SiteNavigationChangeLogEntry } from '@/shared/server/siteNavigation';

type PodobaArchiveColumnKey = 'occurredAt' | 'action' | 'entityType' | 'location' | 'changes' | 'actor';
type PodobaArchiveSortKey = PodobaArchiveColumnKey;
type PodobaArchiveHeaderFilter = 'occurredAt' | 'action' | null;
type SortDirection = 'asc' | 'desc';

const PAGE_SIZE_OPTIONS = [25, 50, 100];
const COLUMN_OPTIONS: Array<{ key: PodobaArchiveColumnKey; label: string; disabled?: boolean }> = [
  { key: 'occurredAt', label: 'Zabeleženo' },
  { key: 'action', label: 'Dejanje' },
  { key: 'entityType', label: 'Tip' },
  { key: 'location', label: 'Lokacija', disabled: true },
  { key: 'changes', label: 'Spremembe' },
  { key: 'actor', label: 'Uporabnik' }
];

const dateFormatter = new Intl.DateTimeFormat('sl-SI', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Ljubljana'
});

function formatDateTime(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : dateFormatter.format(parsed);
}

function normalizeText(value: unknown) {
  return String(value ?? '').trim().toLocaleLowerCase('sl-SI');
}

function dateInRange(value: string, from: string, to: string) {
  if (!from && !to) return true;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  const isoDate = parsed.toISOString().slice(0, 10);
  if (from && isoDate < from) return false;
  if (to && isoDate > to) return false;
  return true;
}

function entrySearchText(entry: SiteNavigationChangeLogEntry) {
  return [
    entry.actionLabel,
    entry.entityTypeLabel,
    entry.entityLabel,
    entry.parentLabel,
    entry.summary,
    entry.actorName,
    ...entry.changes.flatMap((change) => [change.field, change.before, change.after])
  ].join(' ');
}

function sortValue(entry: SiteNavigationChangeLogEntry, key: PodobaArchiveSortKey) {
  if (key === 'occurredAt') return new Date(entry.occurredAt).getTime();
  if (key === 'action') return entry.actionLabel;
  if (key === 'entityType') return entry.entityTypeLabel;
  if (key === 'location') return `${entry.parentLabel ?? ''} ${entry.entityLabel}`;
  if (key === 'actor') return entry.actorName ?? 'System';
  return entry.summary;
}

export default function AdminPodobaArchiveTable({ entries }: { entries: SiteNavigationChangeLogEntry[] }) {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [draftDateRange, setDraftDateRange] = useState({ from: '', to: '' });
  const [openHeaderFilter, setOpenHeaderFilter] = useState<PodobaArchiveHeaderFilter>(null);
  const [sortState, setSortState] = useState<{ key: PodobaArchiveSortKey; direction: SortDirection } | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<Record<PodobaArchiveColumnKey, boolean>>({
    occurredAt: true,
    action: true,
    entityType: true,
    location: true,
    changes: true,
    actor: true
  });
  const dateFilterButtonRef = useRef<HTMLButtonElement | null>(null);
  const actionFilterButtonRef = useRef<HTMLButtonElement | null>(null);
  const uniqueActions = useMemo(
    () => Array.from(new Set(entries.map((entry) => entry.actionLabel))).sort((left, right) => left.localeCompare(right, 'sl')),
    [entries]
  );

  useHeaderFilterDismiss({
    isOpen: Boolean(openHeaderFilter),
    onClose: () => setOpenHeaderFilter(null)
  });

  const filteredEntries = useMemo(() => {
    const query = normalizeText(search);
    return entries.filter((entry) => {
      if (actionFilter && entry.actionLabel !== actionFilter) return false;
      if (!dateInRange(entry.occurredAt, dateRange.from, dateRange.to)) return false;
      if (!query) return true;
      return normalizeText(entrySearchText(entry)).includes(query);
    });
  }, [actionFilter, dateRange.from, dateRange.to, entries, search]);

  const sortedEntries = useMemo(() => {
    const collator = new Intl.Collator('sl-SI', { numeric: true, sensitivity: 'base' });
    const sorted = [...filteredEntries];
    if (!sortState) {
      sorted.sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime());
      return sorted;
    }
    sorted.sort((left, right) => {
      const leftValue = sortValue(left, sortState.key);
      const rightValue = sortValue(right, sortState.key);
      const comparison =
        typeof leftValue === 'number' && typeof rightValue === 'number'
          ? leftValue - rightValue
          : collator.compare(String(leftValue), String(rightValue));
      return sortState.direction === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [filteredEntries, sortState]);

  const { page, pageSize, pageCount, setPage, setPageSize } = useTablePagination({
    totalCount: sortedEntries.length,
    storageKey: 'adminArhivPodoba.pageSize',
    defaultPageSize: 50,
    pageSizeOptions: PAGE_SIZE_OPTIONS
  });

  const pagedEntries = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedEntries.slice(start, start + pageSize);
  }, [page, pageSize, sortedEntries]);

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; title: string; value: string; clear: () => void }> = [];
    const trimmedSearch = search.trim();
    if (trimmedSearch) {
      chips.push({ key: 'search', title: 'Iskanje:', value: trimmedSearch, clear: () => setSearch('') });
    }
    if (actionFilter) {
      chips.push({ key: 'action', title: 'Dejanje:', value: actionFilter, clear: () => setActionFilter('') });
    }
    if (dateRange.from || dateRange.to) {
      chips.push({
        key: 'date',
        title: 'Zabeleženo:',
        value: `${dateRange.from || '—'} – ${dateRange.to || '—'}`,
        clear: () => {
          const empty = { from: '', to: '' };
          setDateRange(empty);
          setDraftDateRange(empty);
        }
      });
    }
    return chips;
  }, [actionFilter, dateRange.from, dateRange.to, search]);

  function toggleColumnVisibility(key: PodobaArchiveColumnKey) {
    setVisibleColumns((current) => {
      const next = { ...current, [key]: !current[key] };
      if (!next.location) return current;
      if (Object.values(next).every((isVisible) => !isVisible)) return current;
      return next;
    });
  }

  function handleSort(key: PodobaArchiveSortKey) {
    const currentDirection = sortState?.key === key ? sortState.direction : null;
    const nextDirection = currentDirection === 'desc' ? 'asc' : currentDirection === 'asc' ? null : 'desc';
    setSortState(nextDirection ? { key, direction: nextDirection } : null);
  }

  const getHeaderTitleClass = (key: PodobaArchiveSortKey) =>
    `${adminTableHeaderButtonClassName} ${sortState?.key === key ? 'underline underline-offset-2 text-slate-900' : ''}`;

  function renderHeader(
    key: PodobaArchiveColumnKey,
    label: string,
    align: 'left' | 'center',
    filterButtonRef?: RefObject<HTMLButtonElement | null>
  ) {
    const filterKey = key === 'occurredAt' || key === 'action' ? key : null;
    return (
      <TH className={align === 'center' ? adminTableHeaderCellCenterClassName : adminTableHeaderCellLeftClassName}>
        <div className={adminTableHeaderContentClassName} {...{ [HEADER_FILTER_ROOT_ATTR]: filterKey ? 'true' : undefined }}>
          <button type="button" onClick={() => handleSort(key)} className={getHeaderTitleClass(key)}>
            {label}
          </button>
          {filterKey && filterButtonRef ? (
            <button
              ref={filterButtonRef}
              type="button"
              className={HEADER_FILTER_BUTTON_CLASS}
              data-active={openHeaderFilter === filterKey}
              aria-label={`Filtriraj ${label}`}
              onClick={(event) => {
                event.stopPropagation();
                setOpenHeaderFilter((current) => (current === filterKey ? null : filterKey));
              }}
            >
              <ColumnFilterIcon className="!h-[12px] !w-[12px]" />
            </button>
          ) : null}
        </div>
      </TH>
    );
  }

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
              placeholder="Poišči spremembe podobe"
              aria-label="Poišči spremembe podobe"
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
            options={COLUMN_OPTIONS}
            visibleMap={visibleColumns}
            onToggle={(key) => toggleColumnVisibility(key as PodobaArchiveColumnKey)}
            showLabel={false}
            menuClassName="!w-[164px]"
            triggerClassName={adminTableNeutralIconButtonClassName}
            icon={<PanelAddRemoveIcon className="!scale-[0.8]" />}
          />
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
      <Table className="w-full min-w-[1080px] table-fixed border-collapse text-[12px] font-['Inter',system-ui,sans-serif]">
        <colgroup>
          {visibleColumns.occurredAt ? <col className="w-[150px]" /> : null}
          {visibleColumns.action ? <col className="w-[116px]" /> : null}
          {visibleColumns.entityType ? <col className="w-[145px]" /> : null}
          {visibleColumns.location ? <col className="w-[210px]" /> : null}
          {visibleColumns.changes ? <col /> : null}
          {visibleColumns.actor ? <col className="w-[130px]" /> : null}
        </colgroup>
        <THead className="border-t border-slate-200 bg-[color:var(--admin-table-header-bg)]">
          <TR>
            {visibleColumns.occurredAt ? renderHeader('occurredAt', 'Zabeleženo', 'center', dateFilterButtonRef) : null}
            {visibleColumns.action ? renderHeader('action', 'Dejanje', 'center', actionFilterButtonRef) : null}
            {visibleColumns.entityType ? renderHeader('entityType', 'Tip', 'left') : null}
            {visibleColumns.location ? renderHeader('location', 'Lokacija', 'left') : null}
            {visibleColumns.changes ? renderHeader('changes', 'Spremembe', 'left') : null}
            {visibleColumns.actor ? renderHeader('actor', 'Uporabnik', 'center') : null}
          </TR>
        </THead>
        <TBody>
          {pagedEntries.length === 0 ? (
            <TR>
              <TD colSpan={Object.values(visibleColumns).filter(Boolean).length} className="px-3 py-8">
                <EmptyState
                  title={entries.length === 0 ? 'Ni zabeleženih sprememb podobe.' : 'Ni zadetkov za izbrane filtre.'}
                  description={
                    entries.length === 0
                      ? 'Ko shranite spremembe navigacije, se bodo prikazale tukaj.'
                      : 'Poskusite z drugim iskalnim izrazom ali filtrom.'
                  }
                />
              </TD>
            </TR>
          ) : null}
          {pagedEntries.map((entry) => (
            <TR key={entry.id} className={`h-12 border-t border-slate-200/90 bg-white text-[12px] transition-colors ${adminTableRowToneClasses.hover}`}>
              {visibleColumns.occurredAt ? <TD className={`${adminTableBodyCellCenterClassName} whitespace-nowrap`}>{formatDateTime(entry.occurredAt)}</TD> : null}
              {visibleColumns.action ? (
                <TD className={adminTableBodyCellCenterClassName}>
                  <span className="inline-flex h-7 items-center rounded-md bg-slate-100 px-2 font-semibold text-slate-700">
                    {entry.actionLabel}
                  </span>
                </TD>
              ) : null}
              {visibleColumns.entityType ? <TD className={`${adminTableBodyCellBaseClassName} font-medium text-slate-900`}>{entry.entityTypeLabel}</TD> : null}
              {visibleColumns.location ? (
                <TD className={adminTableBodyCellBaseClassName}>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900" title={entry.entityLabel}>{entry.entityLabel}</p>
                    {entry.parentLabel ? <p className="truncate text-[11px] text-slate-500" title={entry.parentLabel}>{entry.parentLabel}</p> : null}
                  </div>
                </TD>
              ) : null}
              {visibleColumns.changes ? (
                <TD className={adminTableBodyCellBaseClassName}>
                  <div className="grid gap-1">
                    <p className="truncate font-medium text-slate-700" title={entry.summary}>{entry.summary}</p>
                    {entry.changes.slice(0, 3).map((change) => (
                      <p key={`${entry.id}-${change.field}`} className="truncate text-[11px] text-slate-500">
                        <span className="font-semibold text-slate-600">{change.field}:</span>{' '}
                        <span className="text-rose-700">{change.before || 'prazno'}</span>
                        <span className="px-1 text-slate-400">→</span>
                        <span className="text-emerald-700">{change.after || 'prazno'}</span>
                      </p>
                    ))}
                    {entry.changes.length > 3 ? (
                      <p className="text-[11px] text-slate-400">+ {entry.changes.length - 3} dodatnih sprememb</p>
                    ) : null}
                  </div>
                </TD>
              ) : null}
              {visibleColumns.actor ? <TD className={`${adminTableBodyCellCenterClassName} truncate`} title={entry.actorName ?? 'System'}>{entry.actorName ?? 'System'}</TD> : null}
            </TR>
          ))}
        </TBody>
      </Table>

      <HeaderFilterPortal open={Boolean(openHeaderFilter)}>
        {openHeaderFilter === 'action' ? (
          <div style={getHeaderPopoverStyle(actionFilterButtonRef.current, 180)}>
            <MenuPanel className="w-44">
              <MenuItem isActive={!actionFilter} onClick={() => { setActionFilter(''); setOpenHeaderFilter(null); }}>Vsa dejanja</MenuItem>
              {uniqueActions.map((action) => (
                <MenuItem key={action} isActive={actionFilter === action} onClick={() => { setActionFilter(action); setOpenHeaderFilter(null); }}>
                  {action}
                </MenuItem>
              ))}
            </MenuPanel>
          </div>
        ) : null}
        {openHeaderFilter === 'occurredAt' ? (
          <div role="menu" style={getHeaderPopoverStyle(dateFilterButtonRef.current, 380)} className={adminTablePopoverPanelClassName}>
            <div className="mb-3 grid grid-cols-3 gap-2">
              {DATE_RANGE_PRESETS.map((preset) => (
                <button key={preset.key} type="button" className={adminTablePopoverPresetButtonClassName} onClick={() => setDraftDateRange(getQuickDateRange(preset.key))}>
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="mb-3 grid grid-cols-2 gap-2 border-t border-slate-200 pt-3">
              <AdminFilterInput
                type="date"
                value={draftDateRange.from}
                onChange={(event) => setDraftDateRange((current) => ({ ...current, from: event.target.value }))}
                aria-label="Zabeleženo od"
              />
              <AdminFilterInput
                type="date"
                value={draftDateRange.to}
                onChange={(event) => setDraftDateRange((current) => ({ ...current, to: event.target.value }))}
                aria-label="Zabeleženo do"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={adminTablePopoverPrimaryButtonClassName} onClick={() => { setDateRange(draftDateRange); setOpenHeaderFilter(null); }}>Potrdi</button>
              <button type="button" className={adminTablePopoverSecondaryButtonClassName} onClick={() => { const empty = { from: '', to: '' }; setDraftDateRange(empty); setDateRange(empty); setOpenHeaderFilter(null); }}>Ponastavi</button>
            </div>
          </div>
        ) : null}
      </HeaderFilterPortal>
    </AdminTableLayout>
  );
}
