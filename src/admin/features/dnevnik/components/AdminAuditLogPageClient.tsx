'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AdminPageHeader } from '@/shared/ui/admin-primitives';
import { AdminSwitch } from '@/shared/ui/admin-switch';
import {
  adminTableCardClassName,
  adminTableCardStyle,
  adminTableContentClassName,
  adminExpandableSubtableParentContentCellClassName,
  adminExpandableSubtableParentRowClassName,
  adminExpandableTableCheckboxColumnClassName,
  adminExpandableTableHeaderCellCenterClassName,
  adminExpandableTableHeaderCellLeftClassName,
  adminExpandableTableHeaderContentClassName,
  adminExpandableTableHeaderFirstValueAlignClassName,
  adminExpandableTableHeaderValueAlignClassName,
  adminExpandableTableMainCellClassName,
  adminExpandableTableMainCenterCellClassName,
  adminExpandableTableTextSlotClassName,
  adminTableHeaderButtonClassName,
  adminTableHeaderClassName,
  adminTableMatchingValueActiveClassName,
  adminTableMatchingValueBaseClassName,
  adminTablePopoverPanelClassName,
  adminTablePopoverPrimaryButtonClassName,
  adminTablePopoverSecondaryButtonClassName,
  adminTableSearchIconClassName,
  adminTableSearchInputClassName,
  adminTableRowHeightClassName,
  adminTableTextStackClassName,
  adminTablePrimaryTextClassName,
  adminTableSecondaryTextClassName,
  adminSubtableCellClassName,
  adminSubtableFirstTextColumnTextOffsetClassName,
  adminSubtableHeaderCellClassName,
  adminSubtableHeaderCellLeftClassName,
  adminSubtableHeaderRowClassName,
  adminSubtableRowClassName,
  adminTableToolbarActionsClassName,
  adminTableToolbarGroupClassName,
  adminTableToolbarSearchWrapperClassName,
  AdminTableLayout
} from '@/shared/ui/admin-table';
import {
  HeaderFilterPortal,
  HEADER_FILTER_BUTTON_CLASS,
  HEADER_FILTER_ROOT_ATTR,
  getHeaderPopoverStyle,
  useHeaderFilterDismiss
} from '@/shared/ui/admin-header-filter';
import AdminFilterInput from '@/shared/ui/admin-filter-input';
import { EuiTablePagination } from '@/shared/ui/pagination';
import { EmptyState, Table, TBody, TD, THead, TH, TR } from '@/shared/ui/table';
import { TableSkeleton } from '@/shared/ui/loading';
import { AdminSearchInput } from '@/shared/ui/admin-search-input';
import { AdminCheckbox } from '@/shared/ui/checkbox';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { ColumnFilterIcon, TrashCanIcon } from '@/shared/ui/icons/AdminActionIcons';
import { adminTableRowToneClasses, filterPillClearGlyph, filterPillTokenClasses } from '@/shared/ui/theme/tokens';
import { MenuItem, MenuPanel } from '@/shared/ui/menu';
import { AUDIT_ENTITY_LABELS } from '@/shared/audit/auditLabels';
import { getAuditLocation } from '@/shared/audit/auditLocation';
import { useAdminCollapse } from '@/shared/ui/use-admin-collapse';
import collapseStyles from '@/shared/ui/admin-collapse.module.css';
import { getAuditRetentionUntil, isDurableOrderAudit } from '@/shared/audit/auditRetention';
import {
  AUDIT_ACTION_FILTER_LABELS,
  getAuditActionsForFilter,
  getAuditDisplayAction,
  groupAuditEvents,
  type AuditActionFilterValue,
  type AuditEventGroup
} from '@/shared/audit/auditPresentation';
import type { AuditAction, AuditEntityType, AuditEventListResult, AuditLoggingSettingsResponse } from '@/shared/audit/auditTypes';
import { isAllPageSize, parsePageSizeValue, type PageSizeValue } from '@/shared/domain/pagination';

type Filters = {
  q: string;
  entityType: '' | AuditEntityType;
  entityId: string;
  entityQuery: string;
  action: AuditActionFilterValue;
  actorId: string;
  dateFrom: string;
  dateTo: string;
  deletionFrom: string;
  deletionTo: string;
  page: number;
  pageSize: PageSizeValue;
};

type AuditHeaderFilter = 'date' | 'actor' | 'type' | 'location' | 'action' | 'deletion' | null;
type AuditSortableColumn = 'date' | 'actor' | 'type' | 'location' | 'action' | 'summary' | 'deletion';
type AuditSortState = { column: AuditSortableColumn; index: number } | null;
type AuditMatchColumn = Exclude<AuditHeaderFilter, null>;
type AuditBulkAction = 'delete' | null;

const PAGE_SIZE_OPTIONS = [25, 50, 100];
const AUDIT_STANDARD_COLUMN_CLASS = 'w-[170px] min-w-[170px] max-w-[170px]';
const AUDIT_SUMMARY_COLUMN_CLASS = 'w-[220px] min-w-[220px] max-w-[220px]';
const AUDIT_DATE_COLUMN_CLASS = 'w-[140px] min-w-[140px] max-w-[140px]';
// Match the parent table's selection column, including its proportional stretch.
const AUDIT_TABLE_BASE_WIDTH = 1220;
const AUDIT_SELECTION_COLUMN_WIDTH = 40;
const AUDIT_DETAIL_COLUMN_WIDTHS = [352, 291, 255, 238];
const AUDIT_DETAIL_BASE_WIDTH = AUDIT_DETAIL_COLUMN_WIDTHS.reduce((sum, width) => sum + width, 0);
const AUDIT_SUBTABLE_TIME_ALIGN_CLASS = 'relative -left-[50px] inline-flex w-[140px] items-center justify-center';
// Article labels start after the 28px arrow, 6px gap and 9px text inset.
// Expanded labels use the same position plus the standard 16px child indent.
const AUDIT_SUBTABLE_LOCATION_INDENT_CLASS = 'ml-[59px]';
const AUDIT_SUBTABLE_LOCATION_TEXT_SLOT_CLASS =
  `inline-flex h-7 max-w-full ${adminSubtableFirstTextColumnTextOffsetClassName} items-center rounded-md border border-transparent`;
const AUDIT_ACTION_HEADER_ALIGN_CLASS = 'ml-[52px]';
const AUDIT_ACTION_VALUE_ALIGN_CLASS = 'ml-12';
const AUDIT_SUMMARY_EXPAND_THRESHOLD = 30;

const entityOptions: Array<{ value: '' | AuditEntityType; label: string }> = [
  { value: '', label: 'Vsi' },
  { value: 'item', label: 'Artikel' },
  { value: 'order', label: 'Naročilo' },
  { value: 'category', label: 'Kategorija' },
  { value: 'media', label: 'Mediji' },
  { value: 'system', label: 'Sistem' }
];

const actionOptions: Array<{ value: AuditActionFilterValue; label: string }> = [
  { value: '', label: AUDIT_ACTION_FILTER_LABELS[''] },
  { value: 'created', label: AUDIT_ACTION_FILTER_LABELS.created },
  { value: 'updated', label: AUDIT_ACTION_FILTER_LABELS.updated },
  { value: 'archived', label: AUDIT_ACTION_FILTER_LABELS.archived },
  { value: 'restored', label: AUDIT_ACTION_FILTER_LABELS.restored },
  { value: 'removed', label: AUDIT_ACTION_FILTER_LABELS.removed }
];

const dateFormatter = new Intl.DateTimeFormat('sl-SI', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Ljubljana'
});
const numericDateTimeFormatter = new Intl.DateTimeFormat('sl-SI', {
  timeZone: 'Europe/Ljubljana',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});
const auditTextCollator = new Intl.Collator('sl-SI', { numeric: true, sensitivity: 'base' });

function formatTimestampParts(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return { date: value, time: '' };
  const parts = numericDateTimeFormatter.formatToParts(parsed);
  const day = parts.find((part) => part.type === 'day')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const year = parts.find((part) => part.type === 'year')?.value;
  const hour = parts.find((part) => part.type === 'hour')?.value;
  const minute = parts.find((part) => part.type === 'minute')?.value;
  return {
    date: day && month && year ? `${day}.${month}.${year}` : dateFormatter.format(parsed).split(',')[0],
    time: hour && minute ? `${hour}:${minute}` : ''
  };
}

function formatTimeOnly(value: string) {
  return formatTimestampParts(value).time || '—';
}

function parseAuditTime(value: string) {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function getAuditDeletionDate(group: AuditEventGroup) {
  return getAuditRetentionUntil(group.entityType, group.occurredAt, group.events[0]?.metadata);
}

function formatDateOnly(value: Date | string) {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return typeof value === 'string' ? value : '—';
  return formatTimestampParts(parsed.toISOString()).date;
}

function formatChipDate(value: string) {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}.${month}.${year}` : value;
}

function slovenianCountLabel(count: number, forms: { one: string; two: string; few: string; many: string }) {
  const lastTwoDigits = Math.abs(count) % 100;
  if (lastTwoDigits === 1) return `${count} ${forms.one}`;
  if (lastTwoDigits === 2) return `${count} ${forms.two}`;
  if (lastTwoDigits === 3 || lastTwoDigits === 4) return `${count} ${forms.few}`;
  return `${count} ${forms.many}`;
}

function pluralizeEvents(count: number) {
  return slovenianCountLabel(count, {
    one: 'zapis',
    two: 'zapisa',
    few: 'zapisi',
    many: 'zapisov'
  });
}

function pluralizeChanges(count: number) {
  return slovenianCountLabel(count, {
    one: 'sprememba',
    two: 'spremembi',
    few: 'spremembe',
    many: 'sprememb'
  });
}

function buildQuery(filters: Filters) {
  const params = new URLSearchParams();
  const actions = getAuditActionsForFilter(filters.action);
  if (filters.q.trim()) params.set('q', filters.q.trim());
  if (filters.entityType) params.set('entity_type', filters.entityType);
  if (filters.entityId.trim()) params.set('entity_id', filters.entityId.trim());
  if (filters.entityQuery.trim()) params.set('entity_query', filters.entityQuery.trim());
  if (actions.length > 0) params.set('action', actions.join(','));
  if (filters.actorId.trim()) params.set('actor_id', filters.actorId.trim());
  if (filters.dateFrom) params.set('date_from', filters.dateFrom);
  if (filters.dateTo) params.set('date_to', filters.dateTo);
  if (filters.deletionFrom) params.set('deletion_from', filters.deletionFrom);
  if (filters.deletionTo) params.set('deletion_to', filters.deletionTo);
  params.set('page', String(filters.page));
  params.set('page_size', String(filters.pageSize));
  return params.toString();
}

function actionFilterFromQuery(value: string | null): AuditActionFilterValue {
  if (!value) return '';
  if (actionOptions.some((option) => option.value === value)) return value as AuditActionFilterValue;
  const firstKnownAction = value.split(',').find(Boolean) as AuditAction | undefined;
  return firstKnownAction ? getAuditDisplayAction(firstKnownAction) : '';
}

function getInitialFilters(searchParams: URLSearchParams): Filters {
  const entityType = entityOptions.some((option) => option.value === searchParams.get('entity_type'))
    ? searchParams.get('entity_type') as Filters['entityType']
    : '';
  const pageSize = parsePageSizeValue(searchParams.get('page_size'), PAGE_SIZE_OPTIONS) ?? 25;
  return {
    q: searchParams.get('q') ?? '',
    entityType,
    entityId: searchParams.get('entity_id') ?? '',
    entityQuery: searchParams.get('entity_query') ?? '',
    action: actionFilterFromQuery(searchParams.get('action')),
    actorId: searchParams.get('actor_id') ?? '',
    dateFrom: searchParams.get('date_from') ?? '',
    dateTo: searchParams.get('date_to') ?? '',
    deletionFrom: searchParams.get('deletion_from') ?? '',
    deletionTo: searchParams.get('deletion_to') ?? '',
    page: isAllPageSize(pageSize) ? 1 : Math.max(1, Number(searchParams.get('page') ?? 1) || 1),
    pageSize
  };
}

function actorLabel(group: AuditEventGroup) {
  return group.actorName || group.actorEmail || group.actorId || 'System';
}

function getComparableCellValue(value: string) {
  return value.trim().toLocaleLowerCase('sl-SI').replace(/\s+/g, ' ') || '—';
}

function getAuditSortValue(group: AuditEventGroup, column: AuditSortableColumn) {
  switch (column) {
    case 'date':
      return parseAuditTime(group.occurredAt);
    case 'actor':
      return actorLabel(group);
    case 'type':
      return AUDIT_ENTITY_LABELS[group.entityType];
    case 'location':
      return group.entityLabel || group.entityId;
    case 'action':
      return group.actionLabel;
    case 'summary':
      return group.summary;
    case 'deletion':
      return getAuditDeletionDate(group)?.getTime() ?? Number.POSITIVE_INFINITY;
    default:
      return '';
  }
}

function renderTextFilterPanel({
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
}) {
  return (
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
}

function AuditChangeValue({ value, href }: { value: string; href?: string | null }) {
  if (href) {
    return (
      <Link
        href={href}
        target="_blank"
        rel="noreferrer"
        className="block max-w-full truncate transition hover:text-[#1982bf]"
        title={value}
      >
        {value}
      </Link>
    );
  }
  return <span className="block max-w-full truncate" title={value}>{value}</span>;
}

function AuditLoggingToggle({
  enabled,
  loading,
  saving,
  error,
  onToggle
}: {
  enabled: boolean;
  loading: boolean;
  saving: boolean;
  error: string | null;
  onToggle: () => void;
}) {
  const label = enabled ? 'Izklopi beleženje sprememb' : 'Vklopi beleženje sprememb';
  return (
    <div className="flex min-h-9 items-center" title={error || label} aria-busy={loading || saving}>
      <AdminSwitch
        checked={enabled}
        disabled={loading || saving}
        ariaLabel={label}
        onChange={onToggle}
      />
      {error ? <span className="sr-only" role="alert">{error}</span> : null}
    </div>
  );
}

function GroupDetails({ group, open }: { group: AuditEventGroup; open: boolean }) {
  const motion = useAdminCollapse(open);
  if (!motion.mounted) return null;
  return (
    <tr className={adminExpandableSubtableParentRowClassName}>
      <td colSpan={8} className={adminExpandableSubtableParentContentCellClassName}>
        <div className={collapseStyles.collapse} data-open={motion.expanded} aria-hidden={!open} inert={!open} onTransitionEnd={motion.onTransitionEnd}>
        <div className={collapseStyles.content}>
        <table className="w-full table-fixed text-[12px]" aria-label="Podrobnosti sprememb">
          <colgroup>
            <col style={{ width: `${100 * AUDIT_SELECTION_COLUMN_WIDTH / AUDIT_TABLE_BASE_WIDTH}%` }} />
            {AUDIT_DETAIL_COLUMN_WIDTHS.map((width, index) => <col key={index} style={{ width: `${100 * (AUDIT_TABLE_BASE_WIDTH - AUDIT_SELECTION_COLUMN_WIDTH) / AUDIT_TABLE_BASE_WIDTH * width / AUDIT_DETAIL_BASE_WIDTH}%` }} />)}
          </colgroup>
          <thead className="bg-[color:var(--admin-table-header-bg)]">
            <tr className={adminSubtableHeaderRowClassName}>
              <th className={adminSubtableHeaderCellClassName} aria-label="Odmik" />
              <th className={`${adminSubtableHeaderCellLeftClassName}`}>
                <span className={AUDIT_SUBTABLE_LOCATION_INDENT_CLASS}>Točna lokacija</span>
              </th>
              <th className={`${adminSubtableHeaderCellLeftClassName}`}>Prej</th>
              <th className={`${adminSubtableHeaderCellLeftClassName}`}>Potem</th>
              <th className={`${adminSubtableHeaderCellLeftClassName}`}>
                <span className={AUDIT_SUBTABLE_TIME_ALIGN_CLASS}>Čas spremembe</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {group.changes.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-500">Ni podrobnih sprememb.</td>
              </tr>
            ) : null}
            {group.changes.map((change) => (
              <tr key={change.id} className={`${adminSubtableRowClassName} !h-[41px] bg-[#f8fafc] align-middle text-[12px] transition-colors hover:bg-[#f1f5f9]`}>
                <td className={adminSubtableCellClassName} />
                <td className={`${adminSubtableCellClassName} whitespace-nowrap font-semibold text-slate-900`}>
                  <span className={`${AUDIT_SUBTABLE_LOCATION_TEXT_SLOT_CLASS} ${AUDIT_SUBTABLE_LOCATION_INDENT_CLASS} truncate`} title={change.field}>
                    {change.field}
                  </span>
                </td>
                <td className={`${adminSubtableCellClassName} whitespace-nowrap !text-rose-700`}>
                  <AuditChangeValue value={change.before} href={change.beforeHref} />
                </td>
                <td className={`${adminSubtableCellClassName} whitespace-nowrap !text-emerald-700`}>
                  <AuditChangeValue value={change.after} href={change.afterHref} />
                </td>
                <td className={`${adminSubtableCellClassName} whitespace-nowrap text-slate-500`}>
                  <span className={AUDIT_SUBTABLE_TIME_ALIGN_CLASS}>{formatTimeOnly(change.eventOccurredAt)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        </div>
      </td>
    </tr>
  );
}

export default function AdminAuditLogPageClient() {
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<Filters>(() => getInitialFilters(searchParams));
  const [draftActorId, setDraftActorId] = useState(filters.actorId);
  const [draftEntityQuery, setDraftEntityQuery] = useState(filters.entityQuery || filters.entityId);
  const [draftDateFrom, setDraftDateFrom] = useState(filters.dateFrom);
  const [draftDateTo, setDraftDateTo] = useState(filters.dateTo);
  const [draftDeletionFrom, setDraftDeletionFrom] = useState(filters.deletionFrom);
  const [draftDeletionTo, setDraftDeletionTo] = useState(filters.deletionTo);
  const [data, setData] = useState<AuditEventListResult | null>(null);
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(() => new Set());
  const [expandedSummaryGroupIds, setExpandedSummaryGroupIds] = useState<Set<string>>(() => new Set());
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(() => new Set());
  const [bulkNotice, setBulkNotice] = useState<string | null>(null);
  const [bulkAction, setBulkAction] = useState<AuditBulkAction>(null);
  const [bulkActionSaving, setBulkActionSaving] = useState(false);
  const [openHeaderFilter, setOpenHeaderFilter] = useState<AuditHeaderFilter>(null);
  const [sortState, setSortState] = useState<AuditSortState>(null);
  const [hoveredCellMatch, setHoveredCellMatch] = useState<{ column: AuditMatchColumn; value: string } | null>(null);
  const [auditLoggingEnabled, setAuditLoggingEnabled] = useState(true);
  const [auditLoggingLoading, setAuditLoggingLoading] = useState(true);
  const [auditLoggingSaving, setAuditLoggingSaving] = useState(false);
  const [auditLoggingError, setAuditLoggingError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const dateFilterButtonRef = useRef<HTMLButtonElement | null>(null);
  const actorFilterButtonRef = useRef<HTMLButtonElement | null>(null);
  const typeFilterButtonRef = useRef<HTMLButtonElement | null>(null);
  const locationFilterButtonRef = useRef<HTMLButtonElement | null>(null);
  const actionFilterButtonRef = useRef<HTMLButtonElement | null>(null);
  const deletionFilterButtonRef = useRef<HTMLButtonElement | null>(null);

  useHeaderFilterDismiss({
    isOpen: Boolean(openHeaderFilter),
    onClose: () => setOpenHeaderFilter(null)
  });

  const query = useMemo(() => buildQuery(filters), [filters]);
  const rawGroups = useMemo(() => groupAuditEvents(data?.events ?? []), [data?.events]);
  const groups = useMemo(() => {
    if (!sortState) return rawGroups;
    const isDescending = sortState.index === 1;
    const multiplier = isDescending ? -1 : 1;
    return [...rawGroups].sort((left, right) => {
      const leftValue = getAuditSortValue(left, sortState.column);
      const rightValue = getAuditSortValue(right, sortState.column);
      const fallbackStable = parseAuditTime(right.occurredAt) - parseAuditTime(left.occurredAt);

      if (typeof leftValue === 'number' && typeof rightValue === 'number') {
        const result = (leftValue - rightValue) * multiplier;
        return result || fallbackStable;
      }

      const result = auditTextCollator.compare(String(leftValue), String(rightValue)) * multiplier;
      return result || fallbackStable;
    });
  }, [rawGroups, sortState]);
  const selectedGroups = useMemo(() => groups.filter((group) => !isDurableOrderAudit(group.entityType, group.events[0]?.metadata) && selectedGroupIds.has(group.id)), [groups, selectedGroupIds]);
  const selectedEventIdList = useMemo(() => selectedGroups.flatMap((group) => group.events.map((event) => event.id)), [selectedGroups]);
  const selectedCount = selectedEventIdList.length;
  const selectableGroups = groups.filter((group) => !isDurableOrderAudit(group.entityType, group.events[0]?.metadata));
  const allVisibleSelected = selectableGroups.length > 0 && selectableGroups.every((group) => selectedGroupIds.has(group.id));

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/audit-events?${query}`, { cache: 'no-store' });
      const payload = (await response.json().catch(() => ({}))) as AuditEventListResult & { message?: string };
      if (!response.ok) throw new Error(payload.message || 'Dnevnika sprememb ni bilo mogoče naložiti.');
      setData(payload);
      setExpandedGroupIds(new Set());
      setExpandedSummaryGroupIds(new Set());
      setSelectedGroupIds(new Set());
      setBulkNotice(null);
      setHoveredCellMatch(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Dnevnika sprememb ni bilo mogoče naložiti.');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const loadAuditLoggingSettings = useCallback(async () => {
    setAuditLoggingLoading(true);
    setAuditLoggingError(null);
    try {
      const response = await fetch('/api/admin/audit-events/settings', { cache: 'no-store' });
      const payload = (await response.json().catch(() => ({}))) as AuditLoggingSettingsResponse;
      if (!response.ok) throw new Error(payload.message || 'Nastavitev beleženja ni bilo mogoče naložiti.');
      setAuditLoggingEnabled(payload.enabled !== false);
      if (payload.warning) setAuditLoggingError(payload.warning);
    } catch (settingsError) {
      setAuditLoggingError(settingsError instanceof Error ? settingsError.message : 'Nastavitev beleženja ni bilo mogoče naložiti.');
    } finally {
      setAuditLoggingLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAuditLoggingSettings();
  }, [loadAuditLoggingSettings]);

  const toggleAuditLogging = async () => {
    const previousEnabled = auditLoggingEnabled;
    const nextEnabled = !previousEnabled;
    setAuditLoggingEnabled(nextEnabled);
    setAuditLoggingSaving(true);
    setAuditLoggingError(null);

    try {
      const response = await fetch('/api/admin/audit-events/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextEnabled })
      });
      const payload = (await response.json().catch(() => ({}))) as AuditLoggingSettingsResponse;
      if (!response.ok) throw new Error(payload.message || 'Shranjevanje nastavitve beleženja ni uspelo.');
      setAuditLoggingEnabled(payload.enabled !== false);
    } catch (settingsError) {
      setAuditLoggingEnabled(previousEnabled);
      setAuditLoggingError(settingsError instanceof Error ? settingsError.message : 'Shranjevanje nastavitve beleženja ni uspelo.');
    } finally {
      setAuditLoggingSaving(false);
    }
  };

  const updateFilters = (updates: Partial<Filters>) => {
    setFilters((current) => {
      const pageSize = updates.pageSize ?? current.pageSize;
      return {
        ...current,
        ...updates,
        page: isAllPageSize(pageSize) ? 1 : updates.page ?? 1
      };
    });
  };

  const toggleHeaderFilter = (filter: AuditHeaderFilter) => {
    setOpenHeaderFilter((current) => (current === filter ? null : filter));
  };

  const getSortCycleLength = (column: AuditSortableColumn) => (column === 'date' ? 1 : 2);

  const onSort = (column: AuditSortableColumn) => {
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

  const getMatchingValueClassName = (column: AuditMatchColumn, value: string) =>
    hoveredCellMatch?.column === column && hoveredCellMatch.value === getComparableCellValue(value)
      ? adminTableMatchingValueActiveClassName
      : '';

  const handleMatchEnter = (column: AuditMatchColumn, value: string) => {
    setHoveredCellMatch({ column, value: getComparableCellValue(value) });
  };

  const toggleGroupExpanded = useCallback((groupId: string) => {
    setExpandedGroupIds((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  const toggleSummaryExpanded = useCallback((groupId: string) => {
    setExpandedSummaryGroupIds((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  const toggleGroupSelection = (group: AuditEventGroup, checked: boolean) => {
    if (isDurableOrderAudit(group.entityType, group.events[0]?.metadata)) return;
    setSelectedGroupIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(group.id);
      } else {
        next.delete(group.id);
      }
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelectedGroupIds((current) => {
      const next = new Set(current);
      selectableGroups.forEach((group) => {
        if (allVisibleSelected) {
          next.delete(group.id);
        } else {
          next.add(group.id);
        }
      });
      return next;
    });
  };

  const confirmDeleteSelected = async () => {
    if (selectedEventIdList.length === 0) return;
    setBulkActionSaving(true);
    setError(null);
    setBulkNotice(null);
    try {
      const response = await fetch('/api/admin/audit-events', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventIds: selectedEventIdList })
      });
      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
        deletedEvents?: number;
      };
      if (!response.ok) throw new Error(payload.message || 'Brisanje zapisov ni uspelo.');
      setBulkAction(null);
      await loadEvents();
      setBulkNotice('Zapisi so bili trajno izbrisani.');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Brisanje zapisov ni uspelo.');
    } finally {
      setBulkActionSaving(false);
    }
  };

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; title: string; value: string; clear: () => void }> = [];
    if (filters.dateFrom || filters.dateTo) {
      chips.push({
        key: 'date',
        title: 'Zabeleženo:',
        value: `${formatChipDate(filters.dateFrom) || 'od začetka'} - ${formatChipDate(filters.dateTo) || 'danes'}`,
        clear: () => {
          setDraftDateFrom('');
          setDraftDateTo('');
          updateFilters({ dateFrom: '', dateTo: '' });
        }
      });
    }
    if (filters.deletionFrom || filters.deletionTo) {
      chips.push({
        key: 'deletion',
        title: 'Izbris:',
        value: `${formatChipDate(filters.deletionFrom) || 'od začetka'} - ${formatChipDate(filters.deletionTo) || 'brez omejitve'}`,
        clear: () => {
          setDraftDeletionFrom('');
          setDraftDeletionTo('');
          updateFilters({ deletionFrom: '', deletionTo: '' });
        }
      });
    }
    if (filters.actorId.trim()) {
      chips.push({
        key: 'actor',
        title: 'Uporabnik:',
        value: filters.actorId.trim(),
        clear: () => {
          setDraftActorId('');
          updateFilters({ actorId: '' });
        }
      });
    }
    if (filters.entityType) {
      chips.push({
        key: 'type',
        title: 'Tip:',
        value: entityOptions.find((option) => option.value === filters.entityType)?.label ?? filters.entityType,
        clear: () => updateFilters({ entityType: '' })
      });
    }
    if (filters.entityId.trim() || filters.entityQuery.trim()) {
      chips.push({
        key: 'location',
        title: 'Lokacija:',
        value: filters.entityQuery.trim() || filters.entityId.trim(),
        clear: () => {
          setDraftEntityQuery('');
          updateFilters({ entityId: '', entityQuery: '' });
        }
      });
    }
    if (filters.action) {
      chips.push({
        key: 'action',
        title: 'Dejanje:',
        value: AUDIT_ACTION_FILTER_LABELS[filters.action],
        clear: () => updateFilters({ action: '' })
      });
    }
    return chips;
  }, [filters]);

  const renderHeader = (
    key: Exclude<AuditHeaderFilter, null>,
    label: string,
    align: 'left' | 'center',
    filterButtonRef: RefObject<HTMLButtonElement | null>,
    columnClassName: string
  ) => {
    const isCentered = align === 'center';
    const headerAlignClassName =
      key === 'location'
        ? adminExpandableTableHeaderFirstValueAlignClassName
        : key === 'action'
          ? AUDIT_ACTION_HEADER_ALIGN_CLASS
          : adminExpandableTableHeaderValueAlignClassName;
    return (
      <TH className={`${isCentered ? adminExpandableTableHeaderCellCenterClassName : adminExpandableTableHeaderCellLeftClassName} ${columnClassName}`}>
        <div
          className={isCentered
            ? 'grid h-11 w-full grid-cols-[1fr_auto_1fr] items-center'
            : `${adminExpandableTableHeaderContentClassName} ${headerAlignClassName}`}
          {...{ [HEADER_FILTER_ROOT_ATTR]: 'true' }}
        >
        <button
          type="button"
          onClick={() => onSort(key)}
          className={`${adminTableHeaderButtonClassName} ${isCentered ? 'col-start-2 justify-self-center' : ''} ${sortState?.column === key ? 'underline underline-offset-2' : ''}`}
        >
          {label}
        </button>
        <button
          ref={filterButtonRef}
          type="button"
          className={`${HEADER_FILTER_BUTTON_CLASS} ${isCentered ? 'col-start-3 ml-2 justify-self-start' : ''}`}
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
  };

  const renderSummaryHeader = () => (
    <TH className={`${adminExpandableTableHeaderCellLeftClassName} ${AUDIT_SUMMARY_COLUMN_CLASS}`}>
      <span className="ml-1">
        <button
          type="button"
          onClick={() => onSort('summary')}
          className={`${adminTableHeaderButtonClassName} ${sortState?.column === 'summary' ? 'underline underline-offset-2' : ''}`}
        >
          Povzetek
        </button>
      </span>
    </TH>
  );

  const pageCount = data?.pageCount ?? 1;
  const currentPage = data?.page ?? filters.page;

  return (
    <div className="w-full space-y-4 font-['Inter',system-ui,sans-serif]">
      <AdminPageHeader
        title="Dnevnik sprememb"
        description="Pregled sprememb artiklov, naročil in kategorij. Podrobno so prikazane samo spremembe in odstranitve; novi vnosi so zabeleženi kot kratek povzetek."
      />

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
      {bulkNotice ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {bulkNotice}
        </div>
      ) : null}

      <ConfirmDialog
        open={bulkAction === 'delete'}
        title="Trajno izbriši zapise iz dnevnika?"
        description="Izbrani zapisi bodo trajno odstranjeni iz dnevnika sprememb. To ne bo obnovilo, izbrisalo ali spremenilo povezanih artiklov, naročil ali kategorij."
        confirmLabel="Trajno izbriši"
        cancelLabel="Prekliči"
        isDanger
        onCancel={() => setBulkAction(null)}
        onConfirm={() => {
          void confirmDeleteSelected();
        }}
        confirmDisabled={bulkActionSaving || selectedCount === 0}
      />

      <AdminTableLayout
        className={`w-full ${adminTableCardClassName}`}
        style={adminTableCardStyle}
        headerClassName={adminTableHeaderClassName}
        contentClassName={adminTableContentClassName}
        showDivider={false}
        headerLeft={
          <div className={adminTableToolbarGroupClassName}>
            <div className="min-w-0 w-full">
              <AdminSearchInput
                value={filters.q}
                onChange={(event) => updateFilters({ q: event.target.value })}
                placeholder="Iskanje"
                aria-label="Iskanje"
                wrapperClassName={adminTableToolbarSearchWrapperClassName}
                inputClassName={adminTableSearchInputClassName}
                iconClassName={adminTableSearchIconClassName}
              />
            </div>
          </div>
        }
        headerRight={
          <div className={adminTableToolbarActionsClassName}>
            <AuditLoggingToggle
              enabled={auditLoggingEnabled}
              loading={auditLoggingLoading}
              saving={auditLoggingSaving}
              error={auditLoggingError}
              onToggle={toggleAuditLogging}
            />
            <button
              type="button"
              className={
                selectedCount > 0
                  ? 'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 p-0 text-rose-700 transition hover:bg-rose-100'
                  : 'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white p-0 text-slate-400 transition'
              }
              disabled={selectedCount === 0}
              aria-label={selectedCount > 0 ? 'Trajno izbriši' : 'Trajno izbriši zapise'}
              title={selectedCount > 0 ? 'Trajno izbriši' : 'Trajno izbriši zapise'}
              onClick={() => setBulkAction('delete')}
            >
              <TrashCanIcon />
            </button>
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
            allowAll
            page={currentPage}
            pageCount={pageCount}
            onPageChange={(page) => updateFilters({ page })}
            itemsPerPage={filters.pageSize}
            onChangeItemsPerPage={(pageSize) => updateFilters({ pageSize })}
            itemsPerPageOptions={PAGE_SIZE_OPTIONS}
          />
        }
        footerRight={
          <EuiTablePagination
            allowAll
            page={currentPage}
            pageCount={pageCount}
            onPageChange={(page) => updateFilters({ page })}
            itemsPerPage={filters.pageSize}
            onChangeItemsPerPage={(pageSize) => updateFilters({ pageSize })}
            itemsPerPageOptions={PAGE_SIZE_OPTIONS}
          />
        }
      >
        {loading ? (
          <div className="p-4">
            <TableSkeleton rows={isAllPageSize(filters.pageSize) || filters.pageSize > 25 ? 12 : 8} cols={8} />
          </div>
        ) : (
          <Table className="w-full min-w-[1220px] table-fixed text-[12px] font-['Inter',system-ui,sans-serif] [&>thead>tr>th]:!h-12 [&>thead>tr>th]:!border-slate-200 [&>thead>tr>th]:!py-0">
            <THead className="border-t border-slate-200 bg-[color:var(--admin-table-header-bg)]">
              <TR className={adminTableRowHeightClassName}>
                <TH className={`${adminExpandableTableHeaderCellCenterClassName} ${adminExpandableTableCheckboxColumnClassName}`}>
                  <AdminCheckbox
                    checked={allVisibleSelected}
                    disabled={groups.length === 0}
                    onChange={toggleAllVisible}
                    aria-label="Izberi vse vidne zapise za izbris"
                  />
                </TH>
                {renderHeader('location', 'Lokacija', 'left', locationFilterButtonRef, AUDIT_STANDARD_COLUMN_CLASS)}
                {renderHeader('type', 'Tip', 'center', typeFilterButtonRef, AUDIT_STANDARD_COLUMN_CLASS)}
                {renderHeader('action', 'Dejanje', 'left', actionFilterButtonRef, AUDIT_STANDARD_COLUMN_CLASS)}
                {renderHeader('actor', 'Uporabnik', 'center', actorFilterButtonRef, AUDIT_STANDARD_COLUMN_CLASS)}
                {renderSummaryHeader()}
                {renderHeader('date', 'Zabeleženo', 'center', dateFilterButtonRef, AUDIT_DATE_COLUMN_CLASS)}
                {renderHeader('deletion', 'Izbris', 'center', deletionFilterButtonRef, AUDIT_DATE_COLUMN_CLASS)}
              </TR>
            </THead>
            <TBody>
              {groups.length === 0 ? (
                <TR>
                  <TD colSpan={8} className="px-3 py-8">
                    <EmptyState title="Ni najdenih sprememb." />
                  </TD>
                </TR>
              ) : null}
              {groups.map((group) => {
                const canExpand = group.changes.length > 0;
                const expanded = canExpand && expandedGroupIds.has(group.id);
                const allSelected = selectedGroupIds.has(group.id);
                const { href: locationHref, label: locationLabel } = getAuditLocation(group);
                const timestampParts = formatTimestampParts(group.occurredAt);
                const deletionDate = getAuditDeletionDate(group);
                const deletionDateLabel = deletionDate ? formatDateOnly(deletionDate) : 'Brez omejitve';
                const actor = actorLabel(group);
                const typeLabel = AUDIT_ENTITY_LABELS[group.entityType];
                const actionLabel = group.actionLabel;
                const summaryDetail =
                  group.events.length > 1
                    ? `${pluralizeEvents(group.events.length)} · ${pluralizeChanges(group.changes.length)}`
                    : '';
                const summaryExpanded = expandedSummaryGroupIds.has(group.id);
                const summaryCanExpand =
                  group.summary.length > AUDIT_SUMMARY_EXPAND_THRESHOLD ||
                  summaryDetail.length > AUDIT_SUMMARY_EXPAND_THRESHOLD;
                return (
                  <Fragment key={group.id}>
                    <TR
                      className={`${adminTableRowHeightClassName} border-t border-slate-200/90 bg-white ${adminTableRowToneClasses.hover} ${canExpand ? 'cursor-pointer' : ''}`}
                      onClick={() => {
                        if (canExpand) toggleGroupExpanded(group.id);
                      }}
                    >
                      <TD className={adminExpandableTableMainCenterCellClassName}>
                        <AdminCheckbox
                          checked={allSelected}
                          disabled={isDurableOrderAudit(group.entityType, group.events[0]?.metadata)}
                          title={isDurableOrderAudit(group.entityType, group.events[0]?.metadata) ? 'Zgodovina naročila se trajno ohrani.' : undefined}
                          aria-label={`Izberi zapis ${group.summary}`}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => toggleGroupSelection(group, event.target.checked)}
                        />
                      </TD>
                      <TD className={`${adminExpandableTableMainCellClassName} truncate`}>
                        <div className="flex min-h-9 min-w-0 items-center gap-1.5">
                          {canExpand ? (
                            <button
                              type="button"
                              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"
                              aria-label={expanded ? 'Strni spremembe' : 'Razširi spremembe'}
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleGroupExpanded(group.id);
                              }}
                            >
                              <span className="inline-flex h-4 w-4 items-center justify-center">{expanded ? '▾' : '▸'}</span>
                            </button>
                          ) : (
                            <span className="inline-flex h-7 w-7 shrink-0" aria-hidden="true" />
                          )}
                          <div className={`${adminTableTextStackClassName} flex-1 py-1`}>
                            <span className={`${adminTablePrimaryTextClassName} truncate text-[12px] font-semibold text-slate-900`} title={locationLabel}
                              onMouseEnter={() => handleMatchEnter('location', locationLabel)} onMouseLeave={() => setHoveredCellMatch(null)}>
                              <span className={`${adminTableMatchingValueBaseClassName} max-w-full truncate !px-2 ${getMatchingValueClassName('location', locationLabel)}`}>{locationLabel}</span>
                            </span>
                            {locationHref ? <Link href={locationHref} onClick={(event) => event.stopPropagation()}
                              className={`${adminTableSecondaryTextClassName} truncate px-[9px] text-[11px] text-slate-500 hover:text-[color:var(--blue-500)] hover:underline`} title={locationHref}>
                              {locationHref}
                            </Link> : null}
                          </div>
                        </div>
                      </TD>
                      <TD className={adminExpandableTableMainCenterCellClassName}>
                        <span
                          className={`${adminExpandableTableTextSlotClassName} text-slate-600`}
                          onMouseEnter={() => handleMatchEnter('type', typeLabel)}
                          onMouseLeave={() => setHoveredCellMatch(null)}
                        >
                          <span className={`${adminTableMatchingValueBaseClassName} ${getMatchingValueClassName('type', typeLabel)}`}>
                            {typeLabel}
                          </span>
                        </span>
                      </TD>
                      <TD className={`${adminExpandableTableMainCellClassName} truncate`}>
                        <span
                          className={`${adminExpandableTableTextSlotClassName} ${AUDIT_ACTION_VALUE_ALIGN_CLASS} text-slate-600`}
                          onMouseEnter={() => handleMatchEnter('action', actionLabel)}
                          onMouseLeave={() => setHoveredCellMatch(null)}
                        >
                          <span className={`${adminTableMatchingValueBaseClassName} ${getMatchingValueClassName('action', actionLabel)}`}>
                            {actionLabel}
                          </span>
                        </span>
                      </TD>
                      <TD className={adminExpandableTableMainCenterCellClassName}>
                        <span
                          className={`${adminExpandableTableTextSlotClassName} max-w-full truncate text-slate-600`}
                          title={actor}
                          onMouseEnter={() => handleMatchEnter('actor', actor)}
                          onMouseLeave={() => setHoveredCellMatch(null)}
                        >
                          <span className={`${adminTableMatchingValueBaseClassName} max-w-full truncate ${getMatchingValueClassName('actor', actor)}`}>
                            {actor}
                          </span>
                        </span>
                      </TD>
                      <TD className={adminExpandableTableMainCellClassName}>
                        <div
                          className={`inline-flex w-full max-w-full rounded-md border border-transparent px-2 text-left text-slate-700 ${
                            summaryExpanded
                              ? 'min-h-9 items-start gap-1.5 py-1.5'
                              : 'min-h-9 items-center gap-1.5 py-0.5'
                          }`}
                          title={summaryExpanded ? undefined : group.summary}
                        >
                          <div className="min-w-0 flex-1">
                            <span
                              className={`${adminTablePrimaryTextClassName} w-full max-w-full text-left ${
                                summaryExpanded ? 'whitespace-normal break-words' : 'truncate'
                              }`}
                            >
                              {group.summary}
                            </span>
                            {summaryDetail ? (
                              <span
                                className={`${adminTableSecondaryTextClassName} w-full max-w-full text-left text-[11px] text-slate-400 ${
                                  summaryExpanded ? 'whitespace-normal break-words' : 'truncate'
                                }`}
                              >
                                {summaryDetail}
                              </span>
                            ) : null}
                          </div>
                          {summaryCanExpand ? (
                            <button
                              type="button"
                              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[12px] font-semibold leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                              aria-label={summaryExpanded ? 'Strni povzetek' : 'Razširi povzetek'}
                              title={summaryExpanded ? 'Strni povzetek' : 'Prikaži cel povzetek'}
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleSummaryExpanded(group.id);
                              }}
                            >
                              {summaryExpanded ? '−' : '+'}
                            </button>
                          ) : null}
                        </div>
                      </TD>
                      <TD className={adminExpandableTableMainCenterCellClassName}>
                        <span
                          className={`${adminExpandableTableTextSlotClassName} text-slate-600`}
                          title={timestampParts.date}
                          onMouseEnter={() => handleMatchEnter('date', timestampParts.date)}
                          onMouseLeave={() => setHoveredCellMatch(null)}
                        >
                          <span className={`${adminTableMatchingValueBaseClassName} ${getMatchingValueClassName('date', timestampParts.date)}`}>
                            {timestampParts.date}
                          </span>
                        </span>
                      </TD>
                      <TD className={adminExpandableTableMainCenterCellClassName} title={deletionDateLabel}>
                        <span
                          className={`${adminExpandableTableTextSlotClassName} whitespace-nowrap text-slate-600`}
                          onMouseEnter={() => handleMatchEnter('deletion', deletionDateLabel)}
                          onMouseLeave={() => setHoveredCellMatch(null)}
                        >
                          <span className={`${adminTableMatchingValueBaseClassName} ${getMatchingValueClassName('deletion', deletionDateLabel)}`}>
                            {deletionDateLabel}
                          </span>
                        </span>
                      </TD>
                    </TR>
                    <GroupDetails group={group} open={expanded} />
                  </Fragment>
                );
              })}
            </TBody>
          </Table>
        )}

        <HeaderFilterPortal open={Boolean(openHeaderFilter)}>
          {openHeaderFilter === 'date' ? (
            <div role="menu" style={getHeaderPopoverStyle(dateFilterButtonRef.current, 300)} className={adminTablePopoverPanelClassName}>
              <div className="mb-3 grid grid-cols-2 gap-2">
                <AdminFilterInput
                  type="date"
                  value={draftDateFrom}
                  onChange={(event) => setDraftDateFrom(event.target.value)}
                  aria-label="Zabeleženo od"
                />
                <AdminFilterInput
                  type="date"
                  value={draftDateTo}
                  onChange={(event) => setDraftDateTo(event.target.value)}
                  aria-label="Zabeleženo do"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className={adminTablePopoverPrimaryButtonClassName} onClick={() => { updateFilters({ dateFrom: draftDateFrom, dateTo: draftDateTo }); setOpenHeaderFilter(null); }}>Potrdi</button>
                <button type="button" className={adminTablePopoverSecondaryButtonClassName} onClick={() => { setDraftDateFrom(''); setDraftDateTo(''); updateFilters({ dateFrom: '', dateTo: '' }); setOpenHeaderFilter(null); }}>Ponastavi</button>
              </div>
            </div>
          ) : null}
          {openHeaderFilter === 'deletion' ? (
            <div role="menu" style={getHeaderPopoverStyle(deletionFilterButtonRef.current, 300)} className={adminTablePopoverPanelClassName}>
              <div className="mb-3 grid grid-cols-2 gap-2">
                <AdminFilterInput
                  type="date"
                  value={draftDeletionFrom}
                  onChange={(event) => setDraftDeletionFrom(event.target.value)}
                  aria-label="Izbris od"
                />
                <AdminFilterInput
                  type="date"
                  value={draftDeletionTo}
                  onChange={(event) => setDraftDeletionTo(event.target.value)}
                  aria-label="Izbris do"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className={adminTablePopoverPrimaryButtonClassName} onClick={() => { updateFilters({ deletionFrom: draftDeletionFrom, deletionTo: draftDeletionTo }); setOpenHeaderFilter(null); }}>Potrdi</button>
                <button type="button" className={adminTablePopoverSecondaryButtonClassName} onClick={() => { setDraftDeletionFrom(''); setDraftDeletionTo(''); updateFilters({ deletionFrom: '', deletionTo: '' }); setOpenHeaderFilter(null); }}>Ponastavi</button>
              </div>
            </div>
          ) : null}
          {openHeaderFilter === 'actor' ? (
            <div style={getHeaderPopoverStyle(actorFilterButtonRef.current, 260)}>
              {renderTextFilterPanel({
                label: 'Filtriraj uporabnika',
                draftValue: draftActorId,
                setDraftValue: setDraftActorId,
                commitValue: () => {
                  updateFilters({ actorId: draftActorId.trim() });
                  setOpenHeaderFilter(null);
                },
                resetValue: () => {
                  setDraftActorId('');
                  updateFilters({ actorId: '' });
                  setOpenHeaderFilter(null);
                }
              })}
            </div>
          ) : null}
          {openHeaderFilter === 'type' ? (
            <div style={getHeaderPopoverStyle(typeFilterButtonRef.current, 150)}>
              <MenuPanel>
                {entityOptions.map((option) => (
                  <MenuItem key={option.value} isActive={filters.entityType === option.value} onClick={() => { updateFilters({ entityType: option.value }); setOpenHeaderFilter(null); }}>
                    {option.label}
                  </MenuItem>
                ))}
              </MenuPanel>
            </div>
          ) : null}
          {openHeaderFilter === 'location' ? (
            <div style={getHeaderPopoverStyle(locationFilterButtonRef.current, 260)}>
              {renderTextFilterPanel({
                label: 'Filtriraj lokacijo',
                draftValue: draftEntityQuery,
                setDraftValue: setDraftEntityQuery,
                commitValue: () => {
                  updateFilters({ entityId: '', entityQuery: draftEntityQuery.trim() });
                  setOpenHeaderFilter(null);
                },
                resetValue: () => {
                  setDraftEntityQuery('');
                  updateFilters({ entityId: '', entityQuery: '' });
                  setOpenHeaderFilter(null);
                }
              })}
            </div>
          ) : null}
          {openHeaderFilter === 'action' ? (
            <div style={getHeaderPopoverStyle(actionFilterButtonRef.current, 160)}>
              <MenuPanel>
                {actionOptions.map((option) => (
                  <MenuItem key={option.value} isActive={filters.action === option.value} onClick={() => { updateFilters({ action: option.value }); setOpenHeaderFilter(null); }}>
                    {option.label}
                  </MenuItem>
                ))}
              </MenuPanel>
            </div>
          ) : null}
        </HeaderFilterPortal>
      </AdminTableLayout>
    </div>
  );
}
